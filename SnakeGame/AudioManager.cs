using NAudio.Wave;
using NAudio.Wave.SampleProviders;

namespace SnakeGame;

internal enum MusicTrack
{
    None,
    Menu,
    Adventure,
    Boss
}

internal enum SoundCue
{
    MenuMove,
    PhantomFruit,
    LifeLost,
    BossDefeated,
    LevelUp,
    Win,
    Lose,
    SlashWarning,
    SwordSlash
}

internal sealed class AudioManager : IDisposable
{
    private const int SampleRate = 44100;
    private const int Channels = 1;

    private readonly Dictionary<MusicTrack, float[]> _music = new();
    private readonly Dictionary<SoundCue, float[]> _effects = new();
    private WaveOutEvent? _output;
    private MixingSampleProvider? _mixer;
    private ISampleProvider? _musicInput;
    private MusicTrack _currentTrack;
    private bool _isPaused;
    private bool _musicSuspended;
    private bool _disposed;

    public AudioManager()
    {
        MusicEnabled = true;
        SoundEffectsEnabled = true;

        try
        {
            WaveFormat format = WaveFormat.CreateIeeeFloatWaveFormat(SampleRate, Channels);
            _mixer = new MixingSampleProvider(format)
            {
                ReadFully = true
            };
            _output = new WaveOutEvent
            {
                DesiredLatency = 120
            };
            _output.Init(_mixer);
            _output.Play();
            IsAvailable = true;
        }
        catch
        {
            _output?.Dispose();
            _output = null;
            _mixer = null;
            IsAvailable = false;
        }
    }

    public bool IsAvailable { get; }

    public bool MusicEnabled { get; private set; }

    public bool SoundEffectsEnabled { get; private set; }

    public void SetMusicEnabled(bool enabled)
    {
        MusicEnabled = enabled;
        if (!enabled)
        {
            RemoveMusicInput();
            return;
        }

        StartCurrentMusic();
    }

    public void SetSoundEffectsEnabled(bool enabled)
    {
        SoundEffectsEnabled = enabled;
    }

    public void SuspendMusic()
    {
        if (_musicSuspended)
        {
            return;
        }

        _musicSuspended = true;
        RemoveMusicInput();
    }

    public void ResumeMusic()
    {
        if (!_musicSuspended)
        {
            return;
        }

        _musicSuspended = false;
        StartCurrentMusic();
    }

    public void PlayMusic(MusicTrack track)
    {
        _currentTrack = track;
        RemoveMusicInput();
        StartCurrentMusic();
    }

    public void PlayCue(SoundCue cue)
    {
        if (!IsAvailable || !SoundEffectsEnabled || _mixer is null || _isPaused)
        {
            return;
        }

        float[] samples = GetEffect(cue);
        VolumeSampleProvider input = new(new ArraySampleProvider(samples, loop: false))
        {
            Volume = cue is SoundCue.Win or SoundCue.Lose or SoundCue.BossDefeated
                ? 0.48f
                : 0.38f
        };
        _mixer.AddMixerInput(input);
    }

    public void Pause()
    {
        if (!IsAvailable || _output is null || _isPaused)
        {
            return;
        }

        _isPaused = true;
        _output.Pause();
    }

    public void Resume()
    {
        if (!IsAvailable || _output is null || !_isPaused)
        {
            return;
        }

        _isPaused = false;
        _output.Play();
    }

    private void StartCurrentMusic()
    {
        if (!IsAvailable ||
            !MusicEnabled ||
            _musicSuspended ||
            _currentTrack == MusicTrack.None ||
            _mixer is null)
        {
            return;
        }

        VolumeSampleProvider musicInput = new(
            new ArraySampleProvider(GetMusic(_currentTrack), loop: true))
        {
            Volume = _currentTrack == MusicTrack.Boss ? 0.24f : 0.20f
        };
        _musicInput = musicInput;
        _mixer.AddMixerInput(musicInput);
    }

    private void RemoveMusicInput()
    {
        if (_musicInput is not null && _mixer is not null)
        {
            _mixer.RemoveMixerInput(_musicInput);
        }

        _musicInput = null;
    }

    private float[] GetMusic(MusicTrack track)
    {
        if (_music.TryGetValue(track, out float[]? samples))
        {
            return samples;
        }

        samples = track switch
        {
            MusicTrack.Menu => RenderLoop(
                bpm: 108,
                melody: new[]
                {
                    69, -1, 72, 76, 74, 72, 69, -1,
                    67, -1, 71, 74, 72, 71, 67, -1,
                    64, -1, 67, 71, 69, 67, 64, -1,
                    62, 64, 67, 69, 67, 64, 62, -1
                },
                bass: new[] { 45, 45, 43, 43, 40, 40, 38, 38 }),
            MusicTrack.Adventure => RenderLoop(
                bpm: 148,
                melody: new[]
                {
                    72, 76, 79, 76, 74, 77, 81, 77,
                    72, 76, 79, 83, 81, 79, 76, 74,
                    69, 72, 76, 72, 71, 74, 77, 74,
                    69, 72, 76, 79, 77, 76, 74, 71
                },
                bass: new[] { 48, 48, 45, 45, 41, 41, 43, 43 }),
            MusicTrack.Boss => RenderLoop(
                bpm: 172,
                melody: new[]
                {
                    62, 65, 68, 65, 61, 65, 68, 71,
                    62, 65, 69, 68, 65, 62, 61, -1,
                    59, 62, 65, 62, 58, 62, 65, 68,
                    59, 62, 66, 65, 62, 59, 58, -1
                },
                bass: new[] { 38, 38, 37, 37, 35, 35, 34, 34 }),
            _ => Array.Empty<float>()
        };
        _music[track] = samples;
        return samples;
    }

    private float[] GetEffect(SoundCue cue)
    {
        if (_effects.TryGetValue(cue, out float[]? samples))
        {
            return samples;
        }

        samples = cue switch
        {
            SoundCue.MenuMove => RenderNotes(new[] { 81 }, 65, 0.28f, WaveShape.Square),
            SoundCue.PhantomFruit => RenderNotes(
                new[] { 76, 81, 84, 88, 91 },
                90,
                0.34f,
                WaveShape.Triangle),
            SoundCue.LifeLost => RenderNotes(
                new[] { 69, 65, 62, 57 },
                135,
                0.36f,
                WaveShape.Square),
            SoundCue.BossDefeated => RenderNotes(
                new[] { 55, 62, 67, 71, 74, 79 },
                145,
                0.40f,
                WaveShape.Square),
            SoundCue.LevelUp => RenderNotes(
                new[] { 72, 76, 79, 84 },
                125,
                0.36f,
                WaveShape.Triangle),
            SoundCue.Win => RenderNotes(
                new[] { 60, 64, 67, 72, 76, 79, 84 },
                180,
                0.42f,
                WaveShape.Square),
            SoundCue.Lose => RenderNotes(
                new[] { 67, 65, 62, 58, 55, 50 },
                190,
                0.40f,
                WaveShape.Triangle),
            SoundCue.SlashWarning => RenderNotes(
                new[] { 82, 82, 85 },
                85,
                0.30f,
                WaveShape.Square),
            SoundCue.SwordSlash => RenderWhoosh(),
            _ => Array.Empty<float>()
        };
        _effects[cue] = samples;
        return samples;
    }

    private static float[] RenderLoop(int bpm, int[] melody, int[] bass)
    {
        double stepSeconds = 60d / bpm / 2d;
        int samplesPerStep = (int)(SampleRate * stepSeconds);
        float[] output = new float[samplesPerStep * melody.Length];
        Random noise = new(17 + bpm);

        for (int step = 0; step < melody.Length; step++)
        {
            int offset = step * samplesPerStep;
            AddTone(
                output,
                offset,
                samplesPerStep,
                melody[step],
                0.24f,
                WaveShape.Square,
                gate: 0.82f);

            int bassNote = bass[(step / 4) % bass.Length];
            AddTone(
                output,
                offset,
                samplesPerStep,
                bassNote,
                0.18f,
                WaveShape.Triangle,
                gate: 0.94f);

            if (step % 4 == 0)
            {
                int drumLength = Math.Min(samplesPerStep / 2, SampleRate / 18);
                for (int i = 0; i < drumLength; i++)
                {
                    double envelope = 1d - i / (double)drumLength;
                    double kick = Math.Sin(2d * Math.PI * (74d - 34d * i / drumLength) * i / SampleRate);
                    double hiss = noise.NextDouble() * 2d - 1d;
                    output[offset + i] += (float)((kick * 0.11d + hiss * 0.025d) * envelope);
                }
            }
        }

        Normalize(output, 0.80f);
        return output;
    }

    private static float[] RenderNotes(
        int[] notes,
        int millisecondsPerNote,
        float amplitude,
        WaveShape shape)
    {
        int samplesPerNote = SampleRate * millisecondsPerNote / 1000;
        float[] output = new float[samplesPerNote * notes.Length];

        for (int i = 0; i < notes.Length; i++)
        {
            AddTone(
                output,
                i * samplesPerNote,
                samplesPerNote,
                notes[i],
                amplitude,
                shape,
                gate: 0.88f);
        }

        Normalize(output, 0.88f);
        return output;
    }

    private static float[] RenderWhoosh()
    {
        int length = SampleRate * 360 / 1000;
        float[] output = new float[length];
        Random random = new(7719);

        for (int i = 0; i < length; i++)
        {
            double progress = i / (double)length;
            double envelope = Math.Sin(Math.PI * progress) * (1d - progress * 0.35d);
            double frequency = 260d + 720d * progress;
            double tone = Math.Sin(2d * Math.PI * frequency * i / SampleRate);
            double noise = random.NextDouble() * 2d - 1d;
            output[i] = (float)((tone * 0.22d + noise * 0.18d) * envelope);
        }

        Normalize(output, 0.88f);
        return output;
    }

    private static void AddTone(
        float[] output,
        int offset,
        int length,
        int midiNote,
        float amplitude,
        WaveShape shape,
        float gate)
    {
        if (midiNote < 0)
        {
            return;
        }

        int soundingSamples = Math.Max(1, (int)(length * gate));
        double frequency = 440d * Math.Pow(2d, (midiNote - 69) / 12d);

        for (int i = 0; i < soundingSamples; i++)
        {
            double phase = frequency * i / SampleRate;
            double waveform = shape switch
            {
                WaveShape.Square => phase % 1d < 0.5d ? 1d : -1d,
                WaveShape.Triangle => 1d - 4d * Math.Abs(Math.Round(phase) - phase),
                _ => Math.Sin(2d * Math.PI * phase)
            };
            double attack = Math.Min(1d, i / (SampleRate * 0.008d));
            double releaseStart = soundingSamples * 0.72d;
            double release = i <= releaseStart
                ? 1d
                : Math.Max(0d, 1d - (i - releaseStart) / (soundingSamples - releaseStart));
            output[offset + i] += (float)(waveform * amplitude * attack * release);
        }
    }

    private static void Normalize(float[] samples, float peak)
    {
        float maximum = 0f;
        foreach (float sample in samples)
        {
            maximum = Math.Max(maximum, Math.Abs(sample));
        }

        if (maximum <= peak || maximum == 0f)
        {
            return;
        }

        float scale = peak / maximum;
        for (int i = 0; i < samples.Length; i++)
        {
            samples[i] *= scale;
        }
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        RemoveMusicInput();
        _output?.Stop();
        _output?.Dispose();
        _output = null;
        _mixer = null;
    }

    private enum WaveShape
    {
        Sine,
        Square,
        Triangle
    }

    private sealed class ArraySampleProvider : ISampleProvider
    {
        private readonly float[] _samples;
        private readonly bool _loop;
        private int _position;

        public ArraySampleProvider(float[] samples, bool loop)
        {
            _samples = samples;
            _loop = loop;
            WaveFormat = WaveFormat.CreateIeeeFloatWaveFormat(SampleRate, Channels);
        }

        public WaveFormat WaveFormat { get; }

        public int Read(float[] buffer, int offset, int count)
        {
            if (_samples.Length == 0)
            {
                return 0;
            }

            int written = 0;
            while (written < count)
            {
                int available = _samples.Length - _position;
                int toCopy = Math.Min(count - written, available);
                Array.Copy(_samples, _position, buffer, offset + written, toCopy);
                written += toCopy;
                _position += toCopy;

                if (_position < _samples.Length)
                {
                    continue;
                }

                if (!_loop)
                {
                    break;
                }

                _position = 0;
            }

            return written;
        }
    }
}
