#ifndef SNAKE_ADVENTURES_AUDIO_H
#define SNAKE_ADVENTURES_AUDIO_H

#include <gb/gb.h>
#include <stdint.h>

#define AUDIO_MUSIC_NONE 0u
#define AUDIO_MUSIC_ADVENTURE 1u
#define AUDIO_MUSIC_BOSS 2u
#define AUDIO_MUSIC_MENU 3u

void audio_initialize(void) BANKED;
void audio_set_music(uint8_t music) BANKED;
void audio_play_sound(uint8_t sound) BANKED;
void audio_update(void) BANKED;

#endif
