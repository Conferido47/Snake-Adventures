import type { GameAudio, MusicTrack, SoundCue } from './contracts';

type WaveShape = 'sine' | 'square' | 'triangle';

interface TrackNotes {
  bpm: number;
  melody: number[];
  bass: number[];
}

interface CueNotes {
  notes: number[];
  millisecondsPerNote: number;
  amplitude: number;
  shape: WaveShape;
}

const TRACKS: Record<Exclude<MusicTrack, 'none'>, TrackNotes> = {
  menu: {
    bpm: 108,
    melody: [
      69, -1, 72, 76, 74, 72, 69, -1,
      67, -1, 71, 74, 72, 71, 67, -1,
      64, -1, 67, 71, 69, 67, 64, -1,
      62, 64, 67, 69, 67, 64, 62, -1,
    ],
    bass: [45, 45, 43, 43, 40, 40, 38, 38],
  },
  adventure: {
    bpm: 148,
    melody: [
      72, 76, 79, 76, 74, 77, 81, 77,
      72, 76, 79, 83, 81, 79, 76, 74,
      69, 72, 76, 72, 71, 74, 77, 74,
      69, 72, 76, 79, 77, 76, 74, 71,
    ],
    bass: [48, 48, 45, 45, 41, 41, 43, 43],
  },
  boss: {
    bpm: 172,
    melody: [
      62, 65, 68, 65, 61, 65, 68, 71,
      62, 65, 69, 68, 65, 62, 61, -1,
      59, 62, 65, 62, 58, 62, 65, 68,
      59, 62, 66, 65, 62, 59, 58, -1,
    ],
    bass: [38, 38, 37, 37, 35, 35, 34, 34],
  },
};

const CUES: Partial<Record<SoundCue, CueNotes>> = {
  menuMove: { notes: [81], millisecondsPerNote: 65, amplitude: 0.28, shape: 'square' },
  phantomFruit: {
    notes: [76, 81, 84, 88, 91],
    millisecondsPerNote: 90,
    amplitude: 0.34,
    shape: 'triangle',
  },
  lifeLost: {
    notes: [69, 65, 62, 57],
    millisecondsPerNote: 135,
    amplitude: 0.36,
    shape: 'square',
  },
  bossDefeated: {
    notes: [55, 62, 67, 71, 74, 79],
    millisecondsPerNote: 145,
    amplitude: 0.4,
    shape: 'square',
  },
  levelUp: {
    notes: [72, 76, 79, 84],
    millisecondsPerNote: 125,
    amplitude: 0.36,
    shape: 'triangle',
  },
  win: {
    notes: [60, 64, 67, 72, 76, 79, 84],
    millisecondsPerNote: 180,
    amplitude: 0.42,
    shape: 'square',
  },
  lose: {
    notes: [67, 65, 62, 58, 55, 50],
    millisecondsPerNote: 190,
    amplitude: 0.4,
    shape: 'triangle',
  },
  slashWarning: {
    notes: [82, 82, 85],
    millisecondsPerNote: 85,
    amplitude: 0.3,
    shape: 'square',
  },
};

export class WebAudioManager implements GameAudio {
  musicEnabled = true;
  soundEffectsEnabled = true;

  private context: AudioContext | null = null;
  private currentTrack: MusicTrack = 'none';
  private musicSuspended = false;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffers = new Map<MusicTrack, AudioBuffer>();
  private effectBuffers = new Map<SoundCue, AudioBuffer>();

  async unlock(): Promise<void> {
    const context = this.getContext();
    if (!context) {
      return;
    }

    if (context.state === 'suspended') {
      await context.resume();
    }

    this.startCurrentMusic();
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
      return;
    }

    this.startCurrentMusic();
  }

  setSoundEffectsEnabled(enabled: boolean): void {
    this.soundEffectsEnabled = enabled;
  }

  suspendMusic(): void {
    if (this.musicSuspended) {
      return;
    }

    this.musicSuspended = true;
    this.stopMusic();
  }

  resumeMusic(): void {
    if (!this.musicSuspended) {
      return;
    }

    this.musicSuspended = false;
    this.startCurrentMusic();
  }

  playMusic(track: MusicTrack): void {
    this.currentTrack = track;
    this.stopMusic();
    this.startCurrentMusic();
  }

  playCue(cue: SoundCue): void {
    if (!this.soundEffectsEnabled) {
      return;
    }

    const context = this.context;
    if (!context || context.state !== 'running') {
      return;
    }

    const source = context.createBufferSource();
    source.buffer = this.getEffectBuffer(cue);
    const gain = context.createGain();
    gain.gain.value = cue === 'win' || cue === 'lose' || cue === 'bossDefeated' ? 0.48 : 0.38;
    source.connect(gain).connect(context.destination);
    source.start();
  }

  async dispose(): Promise<void> {
    this.stopMusic();
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }

  private getContext(): AudioContext | null {
    if (this.context) {
      return this.context;
    }

    try {
      this.context = new AudioContext({ sampleRate: 44_100 });
      return this.context;
    } catch {
      return null;
    }
  }

  private startCurrentMusic(): void {
    const context = this.context;
    if (
      !context ||
      context.state !== 'running' ||
      !this.musicEnabled ||
      this.musicSuspended ||
      this.currentTrack === 'none' ||
      this.musicSource
    ) {
      return;
    }

    const source = context.createBufferSource();
    source.buffer = this.getMusicBuffer(this.currentTrack);
    source.loop = true;
    const gain = context.createGain();
    gain.gain.value = this.currentTrack === 'boss' ? 0.24 : 0.2;
    source.connect(gain).connect(context.destination);
    source.start();
    this.musicSource = source;
  }

  private stopMusic(): void {
    if (!this.musicSource) {
      return;
    }

    this.musicSource.stop();
    this.musicSource.disconnect();
    this.musicSource = null;
  }

  private getMusicBuffer(track: Exclude<MusicTrack, 'none'>): AudioBuffer {
    const cached = this.musicBuffers.get(track);
    if (cached) {
      return cached;
    }

    const context = this.context;
    if (!context) {
      throw new Error('Audio context is unavailable.');
    }

    const notes = TRACKS[track];
    const samples = renderLoop(context.sampleRate, notes.bpm, notes.melody, notes.bass);
    const buffer = createBuffer(context, samples);
    this.musicBuffers.set(track, buffer);
    return buffer;
  }

  private getEffectBuffer(cue: SoundCue): AudioBuffer {
    const cached = this.effectBuffers.get(cue);
    if (cached) {
      return cached;
    }

    const context = this.context;
    if (!context) {
      throw new Error('Audio context is unavailable.');
    }

    const cueNotes = CUES[cue];
    const samples = cueNotes
      ? renderNotes(
          context.sampleRate,
          cueNotes.notes,
          cueNotes.millisecondsPerNote,
          cueNotes.amplitude,
          cueNotes.shape,
        )
      : renderWhoosh(context.sampleRate);
    const buffer = createBuffer(context, samples);
    this.effectBuffers.set(cue, buffer);
    return buffer;
  }
}

function createBuffer(context: AudioContext, samples: Float32Array): AudioBuffer {
  const buffer = context.createBuffer(1, samples.length, context.sampleRate);
  buffer.getChannelData(0).set(samples);
  return buffer;
}

function renderLoop(
  sampleRate: number,
  bpm: number,
  melody: number[],
  bass: number[],
): Float32Array {
  const stepSeconds = 60 / bpm / 2;
  const samplesPerStep = Math.trunc(sampleRate * stepSeconds);
  const output = new Float32Array(samplesPerStep * melody.length);
  const random = seededRandom(17 + bpm);

  for (let step = 0; step < melody.length; step += 1) {
    const offset = step * samplesPerStep;
    addTone(output, sampleRate, offset, samplesPerStep, melody[step]!, 0.24, 'square', 0.82);
    const bassNote = bass[Math.trunc(step / 4) % bass.length]!;
    addTone(output, sampleRate, offset, samplesPerStep, bassNote, 0.18, 'triangle', 0.94);

    if (step % 4 === 0) {
      const drumLength = Math.min(Math.trunc(samplesPerStep / 2), Math.trunc(sampleRate / 18));
      for (let index = 0; index < drumLength; index += 1) {
        const envelope = 1 - index / drumLength;
        const kick = Math.sin(
          2 * Math.PI * (74 - (34 * index) / drumLength) * index / sampleRate,
        );
        const hiss = random() * 2 - 1;
        output[offset + index]! += (kick * 0.11 + hiss * 0.025) * envelope;
      }
    }
  }

  normalize(output, 0.8);
  return output;
}

function renderNotes(
  sampleRate: number,
  notes: number[],
  millisecondsPerNote: number,
  amplitude: number,
  shape: WaveShape,
): Float32Array {
  const samplesPerNote = Math.trunc((sampleRate * millisecondsPerNote) / 1000);
  const output = new Float32Array(samplesPerNote * notes.length);

  notes.forEach((note, index) => {
    addTone(output, sampleRate, index * samplesPerNote, samplesPerNote, note, amplitude, shape, 0.88);
  });

  normalize(output, 0.88);
  return output;
}

function renderWhoosh(sampleRate: number): Float32Array {
  const length = Math.trunc((sampleRate * 360) / 1000);
  const output = new Float32Array(length);
  const random = seededRandom(7719);

  for (let index = 0; index < length; index += 1) {
    const progress = index / length;
    const envelope = Math.sin(Math.PI * progress) * (1 - progress * 0.35);
    const frequency = 260 + 720 * progress;
    const tone = Math.sin(2 * Math.PI * frequency * index / sampleRate);
    const noise = random() * 2 - 1;
    output[index] = (tone * 0.22 + noise * 0.18) * envelope;
  }

  normalize(output, 0.88);
  return output;
}

function addTone(
  output: Float32Array,
  sampleRate: number,
  offset: number,
  length: number,
  midiNote: number,
  amplitude: number,
  shape: WaveShape,
  gate: number,
): void {
  if (midiNote < 0) {
    return;
  }

  const soundingSamples = Math.max(1, Math.trunc(length * gate));
  const frequency = 440 * 2 ** ((midiNote - 69) / 12);

  for (let index = 0; index < soundingSamples; index += 1) {
    const phase = frequency * index / sampleRate;
    let waveform: number;
    if (shape === 'square') {
      waveform = phase % 1 < 0.5 ? 1 : -1;
    } else if (shape === 'triangle') {
      waveform = 1 - 4 * Math.abs(Math.round(phase) - phase);
    } else {
      waveform = Math.sin(2 * Math.PI * phase);
    }

    const attack = Math.min(1, index / (sampleRate * 0.008));
    const releaseStart = soundingSamples * 0.72;
    const release = index <= releaseStart
      ? 1
      : Math.max(0, 1 - (index - releaseStart) / (soundingSamples - releaseStart));
    output[offset + index]! += waveform * amplitude * attack * release;
  }
}

function normalize(samples: Float32Array, peak: number): void {
  let maximum = 0;
  for (const sample of samples) {
    maximum = Math.max(maximum, Math.abs(sample));
  }

  if (maximum <= peak || maximum === 0) {
    return;
  }

  const scale = peak / maximum;
  for (let index = 0; index < samples.length; index += 1) {
    samples[index]! *= scale;
  }
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
