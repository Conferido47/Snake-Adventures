#ifndef SNAKE_ADVENTURES_ASSETS_H
#define SNAKE_ADVENTURES_ASSETS_H

#include <gb/cgb.h>
#include <stdint.h>

#define SKIN_COUNT 7u
#define SNAKE_TILE_COUNT 6u
#define COMMON_TILE_COUNT 75u

#define TILE_BLANK 0u
#define TILE_FONT_A 1u
#define TILE_FONT_0 27u
#define TILE_COLON 37u
#define TILE_DASH 38u
#define TILE_PLUS 39u
#define TILE_SLASH 40u
#define TILE_DOT 41u
#define TILE_BANG 42u
#define TILE_LEFT 43u
#define TILE_RIGHT 44u
#define TILE_QUESTION 45u
#define TILE_EQUAL 46u
#define TILE_LIFE 47u
#define TILE_FLOOR_A 48u
#define TILE_FLOOR_B 49u
#define TILE_SNAKE_BODY_A 50u
#define TILE_SNAKE_BODY_B 51u
#define TILE_SNAKE_HEAD_RIGHT 52u
#define TILE_SNAKE_HEAD_LEFT 53u
#define TILE_SNAKE_HEAD_UP 54u
#define TILE_SNAKE_HEAD_DOWN 55u
#define TILE_FRUIT 56u
#define TILE_PHANTOM 57u
#define TILE_WREN 58u
#define TILE_WREN_VULNERABLE 59u
#define TILE_BOSS_TOP_LEFT 60u
#define TILE_BOSS_TOP 61u
#define TILE_BOSS_TOP_RIGHT 62u
#define TILE_BOSS_LEFT 63u
#define TILE_BOSS_CENTER 64u
#define TILE_BOSS_RIGHT 65u
#define TILE_BOSS_BOTTOM_LEFT 66u
#define TILE_BOSS_BOTTOM 67u
#define TILE_BOSS_BOTTOM_RIGHT 68u
#define TILE_SLASH_HORIZONTAL 69u
#define TILE_SLASH_VERTICAL 70u
#define TILE_WARNING_HORIZONTAL 71u
#define TILE_WARNING_VERTICAL 72u
#define TILE_SPARKLE 73u
#define TILE_GLOW 74u

extern const uint8_t common_tiles[COMMON_TILE_COUNT * 16u];
extern const uint8_t snake_skin_tiles[SKIN_COUNT][SNAKE_TILE_COUNT * 16u];
extern const palette_color_t skin_palettes[SKIN_COUNT][4];
extern const palette_color_t powered_palette[4];
extern const palette_color_t recovery_palette[4];
extern const palette_color_t world_palettes[7][4];
extern const char skin_names[SKIN_COUNT][14];

#endif
