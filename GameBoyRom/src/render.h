#ifndef SNAKE_ADVENTURES_RENDER_H
#define SNAKE_ADVENTURES_RENDER_H

#include <gb/gb.h>
#include <stdbool.h>
#include <stdint.h>

void video_initialize(uint8_t skin) BANKED;
void video_set_skin(uint8_t skin) BANKED;
void render_title(uint8_t selection, uint8_t skin) BANKED;
void render_skin_menu(uint8_t skin, bool equipped) BANKED;
void render_guide(uint8_t page) BANKED;
void render_game(bool full_redraw) BANKED;
void render_pause(uint8_t selection) BANKED;
void render_game_over(void) BANKED;

#endif
