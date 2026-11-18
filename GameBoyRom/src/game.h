#ifndef SNAKE_ADVENTURES_GAME_H
#define SNAKE_ADVENTURES_GAME_H

#include <gb/gb.h>
#include <stdbool.h>
#include <stdint.h>

#define BOARD_WIDTH 20u
#define BOARD_HEIGHT 16u
#define BOARD_CELLS (BOARD_WIDTH * BOARD_HEIGHT)
#define MAX_BOSS_SLASHES 4u
#define BOSS_SIZE 3u

typedef struct Point {
    uint8_t x;
    uint8_t y;
} Point;

typedef struct Slash {
    int8_t x;
    int8_t y;
    int8_t dx;
    int8_t dy;
    uint8_t move_counter;
    bool active;
} Slash;

enum GameNotice {
    NOTICE_NONE,
    NOTICE_EXTRA_LIFE,
    NOTICE_LIFE_FULL,
    NOTICE_LIFE_USED,
    NOTICE_WREN_DOWN
};

enum GameSound {
    SOUND_NONE,
    SOUND_FRUIT,
    SOUND_PHANTOM,
    SOUND_WREN_DOWN,
    SOUND_LIFE,
    SOUND_BOSS_START,
    SOUND_BOSS_DEFEATED,
    SOUND_LEVEL_UP,
    SOUND_SLASH_WARNING,
    SOUND_SLASH,
    SOUND_LOSE
};

enum GameMusic {
    MUSIC_NONE,
    MUSIC_ADVENTURE,
    MUSIC_BOSS
};

typedef struct GameState {
    uint8_t snake_x[BOARD_CELLS];
    uint8_t snake_y[BOARD_CELLS];
    uint16_t snake_length;

    Point food;
    Point phantom;
    Point wren;
    Point boss;
    Point slash_warning_origin;
    int8_t direction_x;
    int8_t direction_y;
    int8_t next_direction_x;
    int8_t next_direction_y;
    int8_t slash_warning_dx;
    int8_t slash_warning_dy;

    uint32_t score;
    uint32_t high_score;
    uint32_t next_boss_score;
    uint32_t next_extra_life_score;
    uint16_t tick_milliseconds;
    uint16_t power_milliseconds;
    uint16_t recovery_milliseconds;
    uint16_t notice_milliseconds;
    uint16_t boss_intro_milliseconds;
    uint16_t boss_defeat_milliseconds;
    uint16_t level_up_milliseconds;
    uint16_t boss_constrict_milliseconds;
    int16_t boss_slash_milliseconds;
    uint16_t slash_warning_milliseconds;

    uint8_t normal_foods_eaten;
    uint8_t level;
    uint8_t pending_level;
    uint8_t extra_lives;
    uint8_t wren_move_counter;
    uint8_t boss_move_counter;
    uint8_t notice;
    uint8_t pending_sound;
    uint8_t music;

    bool phantom_active;
    bool wren_active;
    bool boss_active;
    bool boss_enclosed;
    bool game_over;
    bool won;

    Slash slashes[MAX_BOSS_SLASHES];
} GameState;

extern GameState game;

void game_start(uint32_t high_score) BANKED;
void game_set_direction(int8_t x, int8_t y) BANKED;
void game_tick(void) BANKED;

#endif
