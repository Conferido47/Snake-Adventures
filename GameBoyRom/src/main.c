#include <gb/gb.h>
#include <gb/cgb.h>
#include <gb/hardware.h>
#include <rand.h>
#include <stdbool.h>
#include <stdint.h>

#include "assets.h"
#include "audio.h"
#include "game.h"
#include "render.h"

#define SAVE_VERSION 2u
#define SAVE_ADDRESS ((volatile uint8_t *)0xa000u)
#define SAVE_SLOT_SIZE 16u
#define SAVE_COMMIT 0xa5u
#define SAVE_COMMIT_INVERSE 0x5au

enum ScreenState {
    SCREEN_TITLE,
    SCREEN_SKINS,
    SCREEN_GUIDE,
    SCREEN_GAME,
    SCREEN_PAUSE,
    SCREEN_GAME_OVER
};

static uint8_t selected_skin;
static uint32_t saved_high_score;
static uint16_t entropy;
static uint16_t movement_accumulator;
static uint16_t last_game_frame;
static uint8_t screen_state;
static uint8_t menu_selection;
static uint8_t skin_preview;
static uint8_t guide_page;
static uint8_t pause_selection;
static uint8_t audio_music = 255u;
static uint8_t active_save_slot;
static uint8_t save_sequence;

static uint16_t update_crc(uint16_t crc, uint8_t value) {
    uint8_t bit;
    crc ^= (uint16_t)value << 8u;
    for (bit = 0u; bit < 8u; ++bit) {
        crc = (crc & 0x8000u) != 0u ? (crc << 1u) ^ 0x1021u : crc << 1u;
    }
    return crc;
}

static uint16_t slot_crc(uint8_t base) {
    uint8_t index;
    uint16_t crc = 0xffffu;
    for (index = 0u; index < 12u; ++index) crc = update_crc(crc, SAVE_ADDRESS[base + index]);
    return crc;
}

static bool load_slot(uint8_t slot, uint8_t *skin, uint32_t *high_score, uint8_t *sequence) {
    uint8_t base = slot * SAVE_SLOT_SIZE;
    uint16_t stored_crc;
    if (SAVE_ADDRESS[base] != 'S' || SAVE_ADDRESS[base + 1u] != 'A' ||
        SAVE_ADDRESS[base + 2u] != 'D' || SAVE_ADDRESS[base + 3u] != 'V' ||
        SAVE_ADDRESS[base + 4u] != SAVE_VERSION || SAVE_ADDRESS[base + 6u] >= SKIN_COUNT ||
        SAVE_ADDRESS[base + 14u] != SAVE_COMMIT ||
        SAVE_ADDRESS[base + 15u] != SAVE_COMMIT_INVERSE) return false;

    stored_crc = (uint16_t)SAVE_ADDRESS[base + 12u] |
        ((uint16_t)SAVE_ADDRESS[base + 13u] << 8u);
    if (stored_crc != slot_crc(base)) return false;

    *sequence = SAVE_ADDRESS[base + 5u];
    *skin = SAVE_ADDRESS[base + 6u];
    *high_score = (uint32_t)SAVE_ADDRESS[base + 8u] |
        ((uint32_t)SAVE_ADDRESS[base + 9u] << 8u) |
        ((uint32_t)SAVE_ADDRESS[base + 10u] << 16u) |
        ((uint32_t)SAVE_ADDRESS[base + 11u] << 24u);
    return true;
}

static bool sequence_is_newer(uint8_t first, uint8_t second) {
    return first != second && (uint8_t)(first - second) < 128u;
}

static void load_save(void) {
    uint8_t first_skin;
    uint8_t second_skin;
    uint8_t first_sequence;
    uint8_t second_sequence;
    uint32_t first_high_score;
    uint32_t second_high_score;
    bool first_valid;
    bool second_valid;

    ENABLE_RAM;
    SWITCH_RAM(0u);
    first_valid = load_slot(0u, &first_skin, &first_high_score, &first_sequence);
    second_valid = load_slot(1u, &second_skin, &second_high_score, &second_sequence);
    DISABLE_RAM;

    if (second_valid && (!first_valid || sequence_is_newer(second_sequence, first_sequence))) {
        active_save_slot = 1u;
        save_sequence = second_sequence;
        selected_skin = second_skin;
        saved_high_score = second_high_score;
    } else if (first_valid) {
        active_save_slot = 0u;
        save_sequence = first_sequence;
        selected_skin = first_skin;
        saved_high_score = first_high_score;
    } else {
        active_save_slot = 0u;
        save_sequence = 0u;
        selected_skin = 0u;
        saved_high_score = 0u;
    }
}

static void write_save(void) {
    uint8_t target_slot = active_save_slot ^ 1u;
    uint8_t base = target_slot * SAVE_SLOT_SIZE;
    uint8_t next_sequence = save_sequence + 1u;
    uint16_t crc;

    ENABLE_RAM;
    SWITCH_RAM(0u);
    SAVE_ADDRESS[base + 14u] = 0u;
    SAVE_ADDRESS[base + 15u] = 0u;
    SAVE_ADDRESS[base] = 'S';
    SAVE_ADDRESS[base + 1u] = 'A';
    SAVE_ADDRESS[base + 2u] = 'D';
    SAVE_ADDRESS[base + 3u] = 'V';
    SAVE_ADDRESS[base + 4u] = SAVE_VERSION;
    SAVE_ADDRESS[base + 5u] = next_sequence;
    SAVE_ADDRESS[base + 6u] = selected_skin;
    SAVE_ADDRESS[base + 7u] = 0u;
    SAVE_ADDRESS[base + 8u] = (uint8_t)saved_high_score;
    SAVE_ADDRESS[base + 9u] = (uint8_t)(saved_high_score >> 8u);
    SAVE_ADDRESS[base + 10u] = (uint8_t)(saved_high_score >> 16u);
    SAVE_ADDRESS[base + 11u] = (uint8_t)(saved_high_score >> 24u);
    crc = slot_crc(base);
    SAVE_ADDRESS[base + 12u] = (uint8_t)crc;
    SAVE_ADDRESS[base + 13u] = (uint8_t)(crc >> 8u);
    SAVE_ADDRESS[base + 15u] = SAVE_COMMIT_INVERSE;
    SAVE_ADDRESS[base + 14u] = SAVE_COMMIT;
    DISABLE_RAM;

    active_save_slot = target_slot;
    save_sequence = next_sequence;
}

static void set_music(uint8_t music) {
    if (audio_music == music) return;
    audio_set_music(music);
    audio_music = music;
}

static void show_title(void) {
    screen_state = SCREEN_TITLE;
    menu_selection = 0u;
    render_title(menu_selection, selected_skin);
    set_music(AUDIO_MUSIC_MENU);
}

static void start_run(void) {
    initrand(entropy ^ sys_time ^ ((uint16_t)DIV_REG << 8u));
    game_start(saved_high_score);
    movement_accumulator = 0u;
    last_game_frame = sys_time;
    screen_state = SCREEN_GAME;
    video_set_skin(selected_skin);
    render_game(true);
    set_music(AUDIO_MUSIC_ADVENTURE);
}

static void process_game_audio(void) {
    if (game.music == MUSIC_BOSS) set_music(AUDIO_MUSIC_BOSS);
    else if (game.music == MUSIC_ADVENTURE) set_music(AUDIO_MUSIC_ADVENTURE);
    else set_music(AUDIO_MUSIC_NONE);

    if (game.pending_sound != SOUND_NONE) {
        audio_play_sound(game.pending_sound);
        game.pending_sound = SOUND_NONE;
    }
}

static void update_title(uint8_t pressed) {
    if ((pressed & J_UP) != 0u) {
        menu_selection = menu_selection == 0u ? 2u : menu_selection - 1u;
        render_title(menu_selection, selected_skin);
    } else if ((pressed & J_DOWN) != 0u) {
        menu_selection = menu_selection == 2u ? 0u : menu_selection + 1u;
        render_title(menu_selection, selected_skin);
    }

    if ((pressed & (J_A | J_START)) == 0u) return;
    if (menu_selection == 0u || (pressed & J_START) != 0u) {
        start_run();
    } else if (menu_selection == 1u) {
        screen_state = SCREEN_SKINS;
        skin_preview = selected_skin;
        render_skin_menu(skin_preview, true);
    } else {
        screen_state = SCREEN_GUIDE;
        guide_page = 0u;
        render_guide(guide_page);
    }
}

static void update_skins(uint8_t pressed) {
    if ((pressed & (J_LEFT | J_UP)) != 0u) {
        skin_preview = skin_preview == 0u ? SKIN_COUNT - 1u : skin_preview - 1u;
        render_skin_menu(skin_preview, skin_preview == selected_skin);
    } else if ((pressed & (J_RIGHT | J_DOWN)) != 0u) {
        skin_preview = skin_preview == SKIN_COUNT - 1u ? 0u : skin_preview + 1u;
        render_skin_menu(skin_preview, skin_preview == selected_skin);
    }

    if ((pressed & J_A) != 0u) {
        selected_skin = skin_preview;
        write_save();
        render_skin_menu(skin_preview, true);
    } else if ((pressed & J_B) != 0u) {
        show_title();
    }
}

static void update_guide(uint8_t pressed) {
    if ((pressed & (J_A | J_RIGHT)) != 0u) {
        if (guide_page < 2u) {
            ++guide_page;
            render_guide(guide_page);
        } else {
            show_title();
        }
    } else if ((pressed & J_LEFT) != 0u && guide_page != 0u) {
        --guide_page;
        render_guide(guide_page);
    } else if ((pressed & J_B) != 0u) {
        show_title();
    }
}

static void update_game(uint8_t pressed) {
    uint16_t elapsed_frames;
    uint16_t threshold;

    if ((pressed & J_START) != 0u) {
        screen_state = SCREEN_PAUSE;
        pause_selection = 0u;
        render_pause(pause_selection);
        set_music(AUDIO_MUSIC_NONE);
        return;
    }

    if (game.direction_y == 0 && (pressed & J_UP) != 0u) game_set_direction(0, -1);
    else if (game.direction_y == 0 && (pressed & J_DOWN) != 0u) game_set_direction(0, 1);
    else if (game.direction_x == 0 && (pressed & J_LEFT) != 0u) game_set_direction(-1, 0);
    else if (game.direction_x == 0 && (pressed & J_RIGHT) != 0u) game_set_direction(1, 0);

    elapsed_frames = sys_time - last_game_frame;
    last_game_frame = sys_time;
    if (elapsed_frames > 4u) elapsed_frames = 4u;
    movement_accumulator += elapsed_frames * 1000u;
    threshold = game.tick_milliseconds * 60u;
    if (movement_accumulator < threshold) return;
    movement_accumulator -= threshold;
    game_tick();
    process_game_audio();

    if (game.game_over) {
        if (game.high_score > saved_high_score) saved_high_score = game.high_score;
        write_save();
        screen_state = SCREEN_GAME_OVER;
        render_game_over();
    } else {
        render_game(false);
    }
}

static void update_pause(uint8_t pressed) {
    if ((pressed & (J_UP | J_DOWN)) != 0u) {
        pause_selection ^= 1u;
        render_pause(pause_selection);
    }
    if ((pressed & (J_START | J_B)) != 0u || ((pressed & J_A) != 0u && pause_selection == 0u)) {
        screen_state = SCREEN_GAME;
        last_game_frame = sys_time;
        render_game(true);
        process_game_audio();
    } else if ((pressed & J_A) != 0u && pause_selection == 1u) {
        if (game.high_score > saved_high_score) saved_high_score = game.high_score;
        write_save();
        show_title();
    }
}

static void update_game_over(uint8_t pressed) {
    if ((pressed & (J_A | J_START)) != 0u) start_run();
    else if ((pressed & J_B) != 0u) show_title();
}

void main(void) {
    uint8_t keys = 0u;
    uint8_t previous_keys = 0u;
    uint8_t pressed;

    cpu_fast();
    load_save();
    video_initialize(selected_skin);
    audio_initialize();
    set_interrupts(VBL_IFLAG);
    enable_interrupts();
    entropy = (uint16_t)DIV_REG << 8u;
    show_title();

    while (1) {
        vsync();
        audio_update();
        previous_keys = keys;
        keys = joypad();
        pressed = keys & (uint8_t)~previous_keys;
        entropy = (entropy << 1u) ^ DIV_REG ^ sys_time;

        if (screen_state == SCREEN_TITLE) update_title(pressed);
        else if (screen_state == SCREEN_SKINS) update_skins(pressed);
        else if (screen_state == SCREEN_GUIDE) update_guide(pressed);
        else if (screen_state == SCREEN_GAME) update_game(pressed);
        else if (screen_state == SCREEN_PAUSE) update_pause(pressed);
        else update_game_over(pressed);
    }
}
