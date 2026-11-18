#pragma bank 1

#include "render.h"

#include "assets.h"
#include "game.h"

#include <gb/cgb.h>
#include <string.h>

#define SCREEN_TILES 360u
#define BOARD_SCREEN_Y 2u
#define PALETTE_UI 0u
#define PALETTE_SNAKE 1u
#define PALETTE_FIELD 2u
#define PALETTE_FRUIT 3u
#define PALETTE_PHANTOM 4u
#define PALETTE_WREN 5u
#define PALETTE_BOSS 6u
#define PALETTE_WARNING 7u

static uint8_t screen_tiles[SCREEN_TILES];
static uint8_t screen_attributes[SCREEN_TILES];
static uint8_t previous_tiles[SCREEN_TILES];
static uint8_t previous_attributes[SCREEN_TILES];
static uint8_t active_skin;
static uint8_t snake_palette_state = 255u;

static uint16_t screen_index(uint8_t x, uint8_t y) {
    return (uint16_t)y * 20u + x;
}

static void put_tile(uint8_t x, uint8_t y, uint8_t tile, uint8_t palette) {
    uint16_t index;
    if (x >= 20u || y >= 18u) return;
    index = screen_index(x, y);
    screen_tiles[index] = tile;
    screen_attributes[index] = palette;
}

static void fill_area(uint8_t x, uint8_t y, uint8_t width, uint8_t height, uint8_t tile, uint8_t palette) {
    uint8_t px;
    uint8_t py;
    for (py = y; py < y + height && py < 18u; ++py) {
        for (px = x; px < x + width && px < 20u; ++px) put_tile(px, py, tile, palette);
    }
}

static void clear_screen(void) {
    memset(screen_tiles, TILE_BLANK, sizeof(screen_tiles));
    memset(screen_attributes, PALETTE_UI, sizeof(screen_attributes));
}

static uint8_t character_tile(char character) {
    if (character >= 'A' && character <= 'Z') return TILE_FONT_A + (uint8_t)(character - 'A');
    if (character >= '0' && character <= '9') return TILE_FONT_0 + (uint8_t)(character - '0');
    switch (character) {
        case ':': return TILE_COLON;
        case '-': return TILE_DASH;
        case '+': return TILE_PLUS;
        case '/': return TILE_SLASH;
        case '.': return TILE_DOT;
        case '!': return TILE_BANG;
        case '<': return TILE_LEFT;
        case '>': return TILE_RIGHT;
        case '?': return TILE_QUESTION;
        case '=': return TILE_EQUAL;
        default: return TILE_BLANK;
    }
}

static uint8_t text_length(const char *text) {
    uint8_t length = 0u;
    while (text[length] != '\0' && length < 20u) ++length;
    return length;
}

static void draw_text(uint8_t x, uint8_t y, const char *text, uint8_t palette) {
    while (*text != '\0' && x < 20u) {
        put_tile(x++, y, character_tile(*text++), palette);
    }
}

static void draw_centered(uint8_t y, const char *text, uint8_t palette) {
    uint8_t length = text_length(text);
    draw_text((20u - length) / 2u, y, text, palette);
}

static void draw_number(uint8_t x, uint8_t y, uint32_t value, uint8_t digits, uint8_t palette) {
    uint32_t divisor = 1u;
    uint8_t index;
    for (index = 1u; index < digits; ++index) divisor *= 10u;
    if (value >= divisor * 10u) value = divisor * 10u - 1u;
    for (index = 0u; index < digits; ++index) {
        put_tile(x + index, y, TILE_FONT_0 + (uint8_t)(value / divisor % 10u), palette);
        divisor = divisor > 1u ? divisor / 10u : 1u;
    }
}

static void flush_full_screen(void) {
    DISPLAY_OFF;
    set_bkg_attributes(0u, 0u, 20u, 18u, screen_attributes);
    set_bkg_tiles(0u, 0u, 20u, 18u, screen_tiles);
    memcpy(previous_tiles, screen_tiles, sizeof(screen_tiles));
    memcpy(previous_attributes, screen_attributes, sizeof(screen_attributes));
    SHOW_BKG;
    DISPLAY_ON;
}

static void flush_changes(void) {
    uint8_t x;
    uint8_t y;
    uint16_t index;
    for (y = 0u; y < 18u; ++y) {
        for (x = 0u; x < 20u; ++x) {
            index = screen_index(x, y);
            if (screen_attributes[index] != previous_attributes[index]) {
                set_bkg_attribute_xy(x, y, screen_attributes[index]);
                previous_attributes[index] = screen_attributes[index];
            }
            if (screen_tiles[index] != previous_tiles[index]) {
                set_bkg_tile_xy(x, y, screen_tiles[index]);
                previous_tiles[index] = screen_tiles[index];
            }
        }
    }
}

static void apply_skin(uint8_t skin) {
    if (skin >= SKIN_COUNT) skin = 0u;
    active_skin = skin;
    set_bkg_data(TILE_SNAKE_BODY_A, SNAKE_TILE_COUNT, snake_skin_tiles[skin]);
    set_bkg_palette(PALETTE_SNAKE, 1u, skin_palettes[skin]);
    snake_palette_state = 0u;
}

static void update_snake_palette(void) {
    uint8_t state = game.recovery_milliseconds != 0u
        ? 2u
        : game.power_milliseconds != 0u ? 1u : 0u;
    if (state == snake_palette_state) return;
    if (state == 2u) set_bkg_palette(PALETTE_SNAKE, 1u, recovery_palette);
    else if (state == 1u) set_bkg_palette(PALETTE_SNAKE, 1u, powered_palette);
    else set_bkg_palette(PALETTE_SNAKE, 1u, skin_palettes[active_skin]);
    snake_palette_state = state;
}

static void draw_snake_preview(uint8_t y) {
    uint8_t index;
    for (index = 0u; index < 10u; ++index) {
        put_tile(5u + index, y, index == 9u
            ? TILE_SNAKE_HEAD_RIGHT
            : ((index & 1u) != 0u ? TILE_SNAKE_BODY_A : TILE_SNAKE_BODY_B), PALETTE_SNAKE);
    }
}

static void draw_hud(void) {
    uint16_t duration;
    uint16_t percent;
    draw_text(0u, 0u, "S:", PALETTE_UI);
    draw_number(2u, 0u, game.score, 6u, PALETTE_UI);
    draw_text(9u, 0u, "HI:", PALETTE_UI);
    draw_number(12u, 0u, game.high_score, 6u, PALETTE_UI);

    draw_text(0u, 1u, "LV:", PALETTE_UI);
    draw_number(3u, 1u, game.level, 2u, PALETTE_UI);
    put_tile(6u, 1u, TILE_LIFE, PALETTE_UI);
    put_tile(7u, 1u, TILE_COLON, PALETTE_UI);
    draw_number(8u, 1u, game.extra_lives, 1u, PALETTE_UI);

    if (game.boss_active) {
        duration = 5000u + (uint16_t)(game.level - 1u) * 500u;
        if (duration > 8000u) duration = 8000u;
        percent = game.boss_constrict_milliseconds / (duration / 99u);
        if (percent > 99u) percent = 99u;
        draw_text(11u, 1u, "SEAL:", PALETTE_UI);
        draw_number(16u, 1u, percent, 2u, PALETTE_UI);
    } else {
        draw_text(11u, 1u, "P:", PALETTE_UI);
        draw_number(13u, 1u, (game.power_milliseconds + 999u) / 1000u, 1u, PALETTE_UI);
    }
}

static void draw_warning_lane(void) {
    int8_t x;
    int8_t y;
    uint8_t tile;
    if (game.slash_warning_milliseconds == 0u) return;
    x = (int8_t)game.slash_warning_origin.x;
    y = (int8_t)game.slash_warning_origin.y;
    tile = game.slash_warning_dx != 0 ? TILE_WARNING_HORIZONTAL : TILE_WARNING_VERTICAL;
    while (x >= 0 && x < (int8_t)BOARD_WIDTH && y >= 0 && y < (int8_t)BOARD_HEIGHT) {
        put_tile((uint8_t)x, (uint8_t)y + BOARD_SCREEN_Y, tile, PALETTE_WARNING);
        x += game.slash_warning_dx;
        y += game.slash_warning_dy;
    }
}

static void draw_boss(void) {
    uint8_t x;
    uint8_t y;
    if (!game.boss_active) return;
    for (y = 0u; y < BOSS_SIZE; ++y) {
        for (x = 0u; x < BOSS_SIZE; ++x) {
            put_tile(game.boss.x + x, game.boss.y + y + BOARD_SCREEN_Y,
                TILE_BOSS_TOP_LEFT + y * BOSS_SIZE + x, PALETTE_BOSS);
        }
    }
}

static void draw_banner(const char *text) {
    uint8_t length = text_length(text);
    uint8_t start = (20u - length) / 2u;
    fill_area(start > 0u ? start - 1u : 0u, 9u, length + 2u, 1u, TILE_BLANK, PALETTE_UI);
    draw_centered(9u, text, PALETTE_UI);
}

static void build_game_screen(void) {
    uint8_t x;
    uint8_t y;
    uint8_t index;
    uint16_t segment;
    uint16_t segment_index;
    uint8_t head_tile;

    clear_screen();
    draw_hud();
    for (y = 0u; y < BOARD_HEIGHT; ++y) {
        for (x = 0u; x < BOARD_WIDTH; ++x) {
            put_tile(x, y + BOARD_SCREEN_Y, ((x + y) & 1u) != 0u ? TILE_FLOOR_A : TILE_FLOOR_B, PALETTE_FIELD);
        }
    }

    draw_warning_lane();
    put_tile(game.food.x, game.food.y + BOARD_SCREEN_Y, TILE_FRUIT, PALETTE_FRUIT);
    if (game.phantom_active) {
        put_tile(game.phantom.x, game.phantom.y + BOARD_SCREEN_Y, TILE_PHANTOM, PALETTE_PHANTOM);
    }
    if (game.wren_active) {
        put_tile(game.wren.x, game.wren.y + BOARD_SCREEN_Y,
            game.power_milliseconds != 0u ? TILE_WREN_VULNERABLE : TILE_WREN, PALETTE_WREN);
    }
    draw_boss();

    for (index = 0u; index < MAX_BOSS_SLASHES; ++index) {
        if (!game.slashes[index].active || game.slashes[index].x < 0 || game.slashes[index].y < 0) continue;
        put_tile((uint8_t)game.slashes[index].x, (uint8_t)game.slashes[index].y + BOARD_SCREEN_Y,
            game.slashes[index].dx != 0 ? TILE_SLASH_HORIZONTAL : TILE_SLASH_VERTICAL, PALETTE_WARNING);
    }

    for (segment = game.snake_length; segment > 1u; --segment) {
        segment_index = segment - 1u;
        put_tile(game.snake_x[segment_index], game.snake_y[segment_index] + BOARD_SCREEN_Y,
            ((game.snake_x[segment_index] + game.snake_y[segment_index]) & 1u) != 0u
                ? TILE_SNAKE_BODY_A
                : TILE_SNAKE_BODY_B,
            PALETTE_SNAKE);
    }
    if (game.direction_x < 0) head_tile = TILE_SNAKE_HEAD_LEFT;
    else if (game.direction_y < 0) head_tile = TILE_SNAKE_HEAD_UP;
    else if (game.direction_y > 0) head_tile = TILE_SNAKE_HEAD_DOWN;
    else head_tile = TILE_SNAKE_HEAD_RIGHT;
    put_tile(game.snake_x[0], game.snake_y[0] + BOARD_SCREEN_Y, head_tile, PALETTE_SNAKE);

    if (game.boss_intro_milliseconds != 0u) draw_banner("THE HOLLOW KING");
    else if (game.boss_defeat_milliseconds != 0u) draw_banner("KING DEFEATED");
    else if (game.level_up_milliseconds != 0u) draw_banner("LEVEL UP");
    else if (game.notice_milliseconds != 0u) {
        if (game.notice == NOTICE_EXTRA_LIFE) draw_banner("EXTRA LIFE +1");
        else if (game.notice == NOTICE_LIFE_FULL) draw_banner("LIFE FULL +50");
        else if (game.notice == NOTICE_LIFE_USED) draw_banner("LIFE USED");
        else if (game.notice == NOTICE_WREN_DOWN) draw_banner("WREN DOWN +50");
    }
}

void video_initialize(uint8_t skin) BANKED {
    DISPLAY_OFF;
    HIDE_WIN;
    HIDE_SPRITES;
    set_bkg_data(0u, COMMON_TILE_COUNT, common_tiles);
    set_bkg_palette(PALETTE_UI, 1u, world_palettes[0]);
    set_bkg_palette(PALETTE_FIELD, 6u, world_palettes[1]);
    apply_skin(skin);
    BGP_REG = DMG_PALETTE(DMG_BLACK, DMG_DARK_GRAY, DMG_LITE_GRAY, DMG_WHITE);
    memset(previous_tiles, 255u, sizeof(previous_tiles));
    memset(previous_attributes, 255u, sizeof(previous_attributes));
    SHOW_BKG;
    DISPLAY_ON;
}

void video_set_skin(uint8_t skin) BANKED {
    apply_skin(skin);
}

void render_title(uint8_t selection, uint8_t skin) BANKED {
    apply_skin(skin);
    clear_screen();
    draw_centered(1u, "SNAKE", PALETTE_UI);
    draw_centered(3u, "ADVENTURES", PALETTE_UI);
    draw_snake_preview(6u);
    draw_text(6u, 10u, "PLAY", PALETTE_UI);
    draw_text(6u, 12u, "SKINS", PALETTE_UI);
    draw_text(6u, 14u, "GUIDE", PALETTE_UI);
    put_tile(4u, 10u + selection * 2u, TILE_RIGHT, PALETTE_UI);
    draw_centered(17u, "A SELECT", PALETTE_UI);
    flush_full_screen();
}

void render_skin_menu(uint8_t skin, bool equipped) BANKED {
    apply_skin(skin);
    clear_screen();
    draw_centered(1u, "CHOOSE A SKIN", PALETTE_UI);
    draw_centered(4u, skin_names[skin], PALETTE_UI);
    draw_snake_preview(7u);
    put_tile(2u, 10u, TILE_LEFT, PALETTE_UI);
    draw_number(8u, 10u, skin + 1u, 1u, PALETTE_UI);
    put_tile(9u, 10u, TILE_SLASH, PALETTE_UI);
    draw_number(10u, 10u, SKIN_COUNT, 1u, PALETTE_UI);
    put_tile(17u, 10u, TILE_RIGHT, PALETTE_UI);
    draw_centered(13u, "DPAD CHANGE", PALETTE_UI);
    draw_centered(15u, equipped ? "EQUIPPED" : "A EQUIP", PALETTE_UI);
    draw_centered(17u, "B BACK", PALETTE_UI);
    flush_full_screen();
}

void render_guide(uint8_t page) BANKED {
    clear_screen();
    if (page == 0u) {
        draw_centered(1u, "MOVE AND SURVIVE", PALETTE_UI);
        draw_text(1u, 4u, "DPAD TURNS", PALETTE_UI);
        draw_text(1u, 6u, "EDGES WRAP", PALETTE_UI);
        draw_text(1u, 8u, "RED FRUIT +10", PALETTE_UI);
        draw_text(1u, 10u, "START PAUSES", PALETTE_UI);
        draw_text(1u, 13u, "AVOID YOUR BODY", PALETTE_UI);
    } else if (page == 1u) {
        draw_centered(1u, "WREN THE HUNTER", PALETTE_UI);
        draw_text(1u, 4u, "WREN TRACKS YOU", PALETTE_UI);
        draw_text(1u, 6u, "5 FRUIT SUMMONS", PALETTE_UI);
        draw_text(1u, 7u, "PHANTOM FRUIT", PALETTE_UI);
        draw_text(1u, 9u, "POWER HUNTS WREN", PALETTE_UI);
        draw_text(1u, 11u, "LIFE AT 300", PALETTE_UI);
    } else {
        draw_centered(1u, "THE HOLLOW KING", PALETTE_UI);
        draw_text(1u, 4u, "ARRIVES AT 500", PALETTE_UI);
        draw_text(1u, 6u, "BODY PASS IS ON", PALETTE_UI);
        draw_text(1u, 8u, "SURROUND THE KING", PALETTE_UI);
        draw_text(1u, 10u, "HOLD THE SEAL", PALETTE_UI);
        draw_text(1u, 12u, "LATER KINGS SLASH", PALETTE_UI);
    }
    draw_centered(16u, "A NEXT  B BACK", PALETTE_UI);
    draw_number(9u, 17u, page + 1u, 1u, PALETTE_UI);
    put_tile(10u, 17u, TILE_SLASH, PALETTE_UI);
    draw_number(11u, 17u, 3u, 1u, PALETTE_UI);
    flush_full_screen();
}

void render_game(bool full_redraw) BANKED {
    update_snake_palette();
    build_game_screen();
    if (full_redraw) flush_full_screen();
    else flush_changes();
}

void render_pause(uint8_t selection) BANKED {
    update_snake_palette();
    build_game_screen();
    fill_area(4u, 6u, 12u, 7u, TILE_BLANK, PALETTE_UI);
    draw_centered(7u, "PAUSED", PALETTE_UI);
    draw_text(7u, 9u, "RESUME", PALETTE_UI);
    draw_text(7u, 11u, "QUIT", PALETTE_UI);
    put_tile(5u, 9u + selection * 2u, TILE_RIGHT, PALETTE_UI);
    flush_full_screen();
}

void render_game_over(void) BANKED {
    update_snake_palette();
    build_game_screen();
    fill_area(2u, 6u, 16u, 8u, TILE_BLANK, PALETTE_UI);
    draw_centered(7u, game.won ? "FIELD CLEARED" : "RUN OVER", PALETTE_UI);
    draw_text(4u, 9u, "SCORE:", PALETTE_UI);
    draw_number(10u, 9u, game.score, 6u, PALETTE_UI);
    draw_centered(11u, "A RETRY", PALETTE_UI);
    draw_centered(12u, "B MENU", PALETTE_UI);
    flush_full_screen();
}
