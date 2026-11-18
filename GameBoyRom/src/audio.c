#pragma bank 3

#include "audio.h"

#include "game.h"

#include <gb/hardware.h>

static const int8_t menu_melody[] = {
    69, -1, 72, 76, 74, 72, 69, -1, 67, -1, 71, 74, 72, 71, 67, -1,
    64, -1, 67, 71, 69, 67, 64, -1, 62, 64, 67, 69, 67, 64, 62, -1
};
static const int8_t menu_bass[] = { 45, 45, 43, 43, 40, 40, 38, 38 };
static const int8_t adventure_melody[] = {
    72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 83, 81, 79, 76, 74,
    69, 72, 76, 72, 71, 74, 77, 74, 69, 72, 76, 79, 77, 76, 74, 71
};
static const int8_t adventure_bass[] = { 48, 48, 45, 45, 41, 41, 43, 43 };
static const int8_t boss_melody[] = {
    62, 65, 68, 65, 61, 65, 68, 71, 62, 65, 69, 68, 65, 62, 61, -1,
    59, 62, 65, 62, 58, 62, 65, 68, 59, 62, 66, 65, 62, 59, 58, -1
};
static const int8_t boss_bass[] = { 38, 38, 37, 37, 35, 35, 34, 34 };

static uint8_t current_music;
static uint8_t music_step;
static uint8_t music_frame;
static uint8_t sound_frames;

static uint16_t note_period(uint8_t note) {
    switch (note) {
        case 34: return 0u;
        case 35: return 0u;
        case 36: return 44u;
        case 37: return 157u;
        case 38: return 263u;
        case 40: return 457u;
        case 41: return 547u;
        case 43: return 711u;
        case 45: return 856u;
        case 48: return 1046u;
        case 57: return 1452u;
        case 58: return 1486u;
        case 59: return 1517u;
        case 61: return 1575u;
        case 62: return 1602u;
        case 64: return 1650u;
        case 65: return 1673u;
        case 66: return 1694u;
        case 67: return 1714u;
        case 68: return 1732u;
        case 69: return 1750u;
        case 71: return 1783u;
        case 72: return 1798u;
        case 74: return 1825u;
        case 76: return 1849u;
        case 77: return 1860u;
        case 79: return 1881u;
        case 81: return 1899u;
        case 83: return 1915u;
        case 84: return 1923u;
        case 88: return 1949u;
        default: return 1798u;
    }
}

static void trigger_pulse_1(uint8_t note, uint8_t envelope) {
    uint16_t period = note_period(note);
    NR10_REG = 0x00u;
    NR11_REG = 0x80u;
    NR12_REG = envelope;
    NR13_REG = (uint8_t)period;
    NR14_REG = 0x80u | (uint8_t)(period >> 8u);
}

static void trigger_pulse_2(uint8_t note) {
    uint16_t period = note_period(note);
    NR21_REG = 0xc0u;
    NR22_REG = 0x52u;
    NR23_REG = (uint8_t)period;
    NR24_REG = 0x80u | (uint8_t)(period >> 8u);
}

static void trigger_noise(uint8_t polynomial) {
    NR41_REG = 0x08u;
    NR42_REG = 0x42u;
    NR43_REG = polynomial;
    NR44_REG = 0x80u;
}

static void play_music_step(void) {
    const int8_t *melody;
    const int8_t *bass;
    int8_t note;

    if (current_music == AUDIO_MUSIC_MENU) {
        melody = menu_melody;
        bass = menu_bass;
    } else if (current_music == AUDIO_MUSIC_BOSS) {
        melody = boss_melody;
        bass = boss_bass;
    } else {
        melody = adventure_melody;
        bass = adventure_bass;
    }

    note = melody[music_step];
    if (sound_frames == 0u) {
        if (note >= 0) trigger_pulse_1((uint8_t)note, 0x73u);
        else NR12_REG = 0u;
    }
    if ((music_step & 3u) == 0u) {
        trigger_pulse_2((uint8_t)bass[music_step >> 2u]);
        trigger_noise(0x35u);
    }
    music_step = (music_step + 1u) & 31u;
}

void audio_initialize(void) BANKED {
    NR52_REG = 0x80u;
    NR50_REG = 0x77u;
    NR51_REG = 0xffu;
    current_music = AUDIO_MUSIC_NONE;
    music_step = 0u;
    music_frame = 0u;
    sound_frames = 0u;
}

void audio_set_music(uint8_t music) BANKED {
    if (music == current_music) return;
    current_music = music;
    music_step = 0u;
    music_frame = 0u;
    if (music == AUDIO_MUSIC_NONE) {
        NR12_REG = 0u;
        NR22_REG = 0u;
        NR42_REG = 0u;
    }
}

void audio_play_sound(uint8_t sound) BANKED {
    if (sound == SOUND_NONE) return;
    switch (sound) {
        case SOUND_FRUIT:
            trigger_pulse_1(84u, 0x83u);
            sound_frames = 4u;
            break;
        case SOUND_PHANTOM:
            trigger_pulse_1(88u, 0xa2u);
            sound_frames = 10u;
            break;
        case SOUND_WREN_DOWN:
            trigger_pulse_1(81u, 0x93u);
            sound_frames = 8u;
            break;
        case SOUND_LIFE:
            trigger_pulse_1(57u, 0xb3u);
            sound_frames = 12u;
            break;
        case SOUND_BOSS_START:
            trigger_pulse_1(38u, 0xc3u);
            trigger_noise(0x24u);
            sound_frames = 16u;
            break;
        case SOUND_BOSS_DEFEATED:
        case SOUND_LEVEL_UP:
            trigger_pulse_1(76u, 0xc2u);
            sound_frames = 14u;
            break;
        case SOUND_SLASH_WARNING:
            trigger_pulse_1(83u, 0x92u);
            sound_frames = 7u;
            break;
        case SOUND_SLASH:
            trigger_noise(0x13u);
            sound_frames = 10u;
            break;
        case SOUND_LOSE:
            trigger_pulse_1(48u, 0xb4u);
            sound_frames = 24u;
            break;
    }
}

void audio_update(void) BANKED {
    uint8_t step_frames;
    if (sound_frames != 0u) --sound_frames;
    if (current_music == AUDIO_MUSIC_NONE) return;
    step_frames = current_music == AUDIO_MUSIC_BOSS ? 10u : current_music == AUDIO_MUSIC_ADVENTURE ? 12u : 17u;
    if (++music_frame >= step_frames) {
        music_frame = 0u;
        play_music_step();
    }
}
