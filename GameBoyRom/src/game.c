#pragma bank 2

#include "game.h"

#include <rand.h>
#include <string.h>

#define STARTING_TICK_MS 95u
#define MINIMUM_TICK_MS 70u
#define TICK_STEP_MS 5u
#define NORMAL_FRUITS_PER_PHANTOM 5u
#define PHANTOM_SCORE 25u
#define WREN_SCORE 50u
#define BOSS_SCORE 250u
#define BOSS_SCORE_INTERVAL 500u
#define EXTRA_LIFE_LEAD_SCORE 200u
#define FULL_LIFE_BONUS_SCORE 50u
#define RECOVERY_MS 2000u
#define NOTICE_MS 1500u
#define BOSS_INTRO_MS 1500u
#define BOSS_DEFEAT_MS 1500u
#define LEVEL_UP_MS 1500u
#define BOSS_ARENA_MARGIN 2u
#define BOSS_SPAWN_CLEARANCE 1u
#define WREN_MINIMUM_SPAWN_DISTANCE 7u
#define SLASH_UNLOCK_LEVEL 5u
#define SLASH_WARNING_MS 450u
#define MAXIMUM_LEVEL 99u

GameState game;

static uint8_t blocked_cells[BOARD_CELLS / 8u];
static uint8_t visited_cells[BOARD_CELLS / 8u];
static uint16_t flood_queue[BOARD_CELLS];

static bool points_equal(Point first, Point second) {
    return first.x == second.x && first.y == second.y;
}

static uint16_t cell_index(uint8_t x, uint8_t y) {
    return (uint16_t)y * BOARD_WIDTH + x;
}

static void bit_set(uint8_t *bits, uint16_t index) {
    bits[index >> 3u] |= (uint8_t)(1u << (index & 7u));
}

static bool bit_get(const uint8_t *bits, uint16_t index) {
    return (bits[index >> 3u] & (uint8_t)(1u << (index & 7u))) != 0u;
}

static uint16_t subtract_to_zero(uint16_t value, uint16_t amount) {
    return value > amount ? value - amount : 0u;
}

static uint8_t wrap_x(int8_t x) {
    if (x < 0) return BOARD_WIDTH - 1u;
    if (x >= (int8_t)BOARD_WIDTH) return 0u;
    return (uint8_t)x;
}

static uint8_t wrap_y(int8_t y) {
    if (y < 0) return BOARD_HEIGHT - 1u;
    if (y >= (int8_t)BOARD_HEIGHT) return 0u;
    return (uint8_t)y;
}

static uint8_t absolute_difference(uint8_t first, uint8_t second) {
    return first > second ? first - second : second - first;
}

static uint8_t wrapped_distance(Point first, Point second) {
    uint8_t horizontal = absolute_difference(first.x, second.x);
    uint8_t vertical = absolute_difference(first.y, second.y);
    if (horizontal > BOARD_WIDTH - horizontal) horizontal = BOARD_WIDTH - horizontal;
    if (vertical > BOARD_HEIGHT - vertical) vertical = BOARD_HEIGHT - vertical;
    return horizontal + vertical;
}

static uint16_t random_below(uint16_t limit) {
    if (limit <= 1u) return 0u;
    return randw() % limit;
}

static bool snake_contains(uint8_t x, uint8_t y) {
    uint16_t index;
    for (index = 0u; index < game.snake_length; ++index) {
        if (game.snake_x[index] == x && game.snake_y[index] == y) return true;
    }
    return false;
}

static void build_snake_occupancy(void) {
    uint16_t index;
    memset(blocked_cells, 0, sizeof(blocked_cells));
    for (index = 0u; index < game.snake_length; ++index) {
        bit_set(blocked_cells, cell_index(game.snake_x[index], game.snake_y[index]));
    }
}

static bool boss_contains(uint8_t x, uint8_t y) {
    return game.boss_active &&
        x >= game.boss.x && x < game.boss.x + BOSS_SIZE &&
        y >= game.boss.y && y < game.boss.y + BOSS_SIZE;
}

static bool occupied_for_food(uint8_t x, uint8_t y) {
    if (bit_get(blocked_cells, cell_index(x, y))) return true;
    if (game.wren_active && game.wren.x == x && game.wren.y == y) return true;
    if (game.phantom_active && game.phantom.x == x && game.phantom.y == y) return true;
    return boss_contains(x, y);
}

static bool occupied_for_phantom(uint8_t x, uint8_t y) {
    if (bit_get(blocked_cells, cell_index(x, y))) return true;
    if (game.food.x == x && game.food.y == y) return true;
    if (game.wren_active && game.wren.x == x && game.wren.y == y) return true;
    return boss_contains(x, y);
}

static bool place_food(void) {
    uint8_t x;
    uint8_t y;
    uint16_t count = 0u;
    uint16_t choice;

    build_snake_occupancy();
    for (y = 0u; y < BOARD_HEIGHT; ++y) {
        for (x = 0u; x < BOARD_WIDTH; ++x) {
            if (!occupied_for_food(x, y)) ++count;
        }
    }
    if (count == 0u) return false;

    choice = random_below(count);
    for (y = 0u; y < BOARD_HEIGHT; ++y) {
        for (x = 0u; x < BOARD_WIDTH; ++x) {
            if (occupied_for_food(x, y)) continue;
            if (choice-- == 0u) {
                game.food.x = x;
                game.food.y = y;
                return true;
            }
        }
    }
    return false;
}

static bool place_phantom(void) {
    uint8_t x;
    uint8_t y;
    uint16_t count = 0u;
    uint16_t choice;

    build_snake_occupancy();
    for (y = 0u; y < BOARD_HEIGHT; ++y) {
        for (x = 0u; x < BOARD_WIDTH; ++x) {
            if (!occupied_for_phantom(x, y)) ++count;
        }
    }
    if (count == 0u) return false;

    choice = random_below(count);
    for (y = 0u; y < BOARD_HEIGHT; ++y) {
        for (x = 0u; x < BOARD_WIDTH; ++x) {
            if (occupied_for_phantom(x, y)) continue;
            if (choice-- == 0u) {
                game.phantom.x = x;
                game.phantom.y = y;
                game.phantom_active = true;
                return true;
            }
        }
    }
    return false;
}

static bool occupied_for_wren(uint8_t x, uint8_t y) {
    if (bit_get(blocked_cells, cell_index(x, y))) return true;
    if (game.food.x == x && game.food.y == y) return true;
    return game.phantom_active && game.phantom.x == x && game.phantom.y == y;
}

static bool place_wren(void) {
    Point head;
    Point cell;
    uint8_t x;
    uint8_t y;
    uint16_t empty_count = 0u;
    uint16_t distant_count = 0u;
    uint16_t choice;
    bool require_distance;

    build_snake_occupancy();
    head.x = game.snake_x[0];
    head.y = game.snake_y[0];
    for (y = 0u; y < BOARD_HEIGHT; ++y) {
        for (x = 0u; x < BOARD_WIDTH; ++x) {
            if (occupied_for_wren(x, y)) continue;
            ++empty_count;
            cell.x = x;
            cell.y = y;
            if (wrapped_distance(cell, head) >= WREN_MINIMUM_SPAWN_DISTANCE) ++distant_count;
        }
    }
    if (empty_count == 0u) return false;

    require_distance = distant_count != 0u;
    choice = random_below(require_distance ? distant_count : empty_count);
    for (y = 0u; y < BOARD_HEIGHT; ++y) {
        for (x = 0u; x < BOARD_WIDTH; ++x) {
            if (occupied_for_wren(x, y)) continue;
            cell.x = x;
            cell.y = y;
            if (require_distance && wrapped_distance(cell, head) < WREN_MINIMUM_SPAWN_DISTANCE) continue;
            if (choice-- == 0u) {
                game.wren = cell;
                game.wren_active = true;
                return true;
            }
        }
    }
    return false;
}

static uint16_t current_power_duration(void) {
    uint16_t reduction;
    if (game.level <= 2u) return 5000u;
    reduction = (uint16_t)(game.level - 2u) * 500u;
    return reduction >= 2000u ? 3000u : 5000u - reduction;
}

static uint8_t current_wren_move_every(void) {
    return game.level >= 4u ? 2u : 3u;
}

static uint8_t current_wren_prediction(void) {
    if (game.level >= 5u) return 3u;
    if (game.level >= 3u) return 2u;
    return 0u;
}

static uint8_t current_boss_move_every(void) {
    uint8_t amount = 8u - (game.level > 5u ? 4u : game.level - 1u);
    return amount < 4u ? 4u : amount;
}

static uint16_t current_boss_constrict_duration(void) {
    uint16_t duration = 5000u + (uint16_t)(game.level - 1u) * 500u;
    return duration > 8000u ? 8000u : duration;
}

static uint16_t current_slash_interval(void) {
    uint16_t reduction;
    if (game.level <= SLASH_UNLOCK_LEVEL) return 2000u;
    reduction = (uint16_t)(game.level - SLASH_UNLOCK_LEVEL) * 200u;
    return reduction >= 800u ? 1200u : 2000u - reduction;
}

static uint8_t current_slash_move_every(void) {
    return game.level >= 7u ? 2u : 3u;
}

static void set_notice(uint8_t notice) {
    game.notice = notice;
    game.notice_milliseconds = NOTICE_MS;
}

static void add_score(uint16_t points) {
    if (game.score > UINT32_MAX - points) game.score = UINT32_MAX;
    else game.score += points;
    if (game.score > game.high_score) game.high_score = game.score;

    while (game.next_extra_life_score != UINT32_MAX && game.score >= game.next_extra_life_score) {
        if (game.next_extra_life_score > UINT32_MAX - BOSS_SCORE_INTERVAL) {
            game.next_extra_life_score = UINT32_MAX;
        } else {
            game.next_extra_life_score += BOSS_SCORE_INTERVAL;
        }

        if (game.extra_lives == 0u) {
            game.extra_lives = 1u;
            set_notice(NOTICE_EXTRA_LIFE);
        } else {
            if (game.score > UINT32_MAX - FULL_LIFE_BONUS_SCORE) game.score = UINT32_MAX;
            else game.score += FULL_LIFE_BONUS_SCORE;
            if (game.score > game.high_score) game.high_score = game.score;
            set_notice(NOTICE_LIFE_FULL);
        }
    }
}

static bool handle_fatal_collision(void) {
    if (game.extra_lives == 0u) {
        game.game_over = true;
        game.music = MUSIC_NONE;
        game.pending_sound = SOUND_LOSE;
        return false;
    }

    game.extra_lives = 0u;
    game.recovery_milliseconds = RECOVERY_MS;
    set_notice(NOTICE_LIFE_USED);
    game.pending_sound = SOUND_LIFE;
    return true;
}

static int16_t find_body_collision(Point head, bool growing) {
    uint16_t index;
    uint16_t count = game.snake_length - (growing ? 0u : 1u);
    for (index = 0u; index < count; ++index) {
        if (game.snake_x[index] == head.x && game.snake_y[index] == head.y) {
            return (int16_t)index;
        }
    }
    return -1;
}

static void insert_head(Point head, bool growing) {
    uint16_t index;
    uint16_t destination_length = game.snake_length;
    if (growing && destination_length < BOARD_CELLS) ++destination_length;

    for (index = destination_length - 1u; index > 0u; --index) {
        game.snake_x[index] = game.snake_x[index - 1u];
        game.snake_y[index] = game.snake_y[index - 1u];
    }
    game.snake_x[0] = head.x;
    game.snake_y[0] = head.y;
    game.snake_length = destination_length;
}

static bool move_wren(void) {
    Point moves[4];
    Point target;
    Point head;
    uint8_t best_moves[4];
    uint8_t best_count = 0u;
    uint8_t best_distance = game.power_milliseconds != 0u ? 0u : 255u;
    uint8_t prediction;
    uint8_t index;
    uint8_t distance;
    bool blocked;
    bool better;

    if (!game.wren_active) return false;
    if (++game.wren_move_counter < current_wren_move_every()) return false;
    game.wren_move_counter = 0u;

    head.x = game.snake_x[0];
    head.y = game.snake_y[0];
    target = head;
    if (game.power_milliseconds == 0u) {
        prediction = current_wren_prediction();
        while (prediction-- != 0u) {
            target.x = wrap_x((int8_t)target.x + game.direction_x);
            target.y = wrap_y((int8_t)target.y + game.direction_y);
        }
    }

    moves[0].x = wrap_x((int8_t)game.wren.x + 1);
    moves[0].y = game.wren.y;
    moves[1].x = wrap_x((int8_t)game.wren.x - 1);
    moves[1].y = game.wren.y;
    moves[2].x = game.wren.x;
    moves[2].y = wrap_y((int8_t)game.wren.y + 1);
    moves[3].x = game.wren.x;
    moves[3].y = wrap_y((int8_t)game.wren.y - 1);

    for (index = 0u; index < 4u; ++index) {
        blocked = !(moves[index].x == head.x && moves[index].y == head.y) &&
            snake_contains(moves[index].x, moves[index].y);
        blocked = blocked || points_equal(moves[index], game.food) ||
            (game.phantom_active && points_equal(moves[index], game.phantom));
        if (blocked) continue;

        distance = wrapped_distance(moves[index], target);
        better = game.power_milliseconds != 0u ? distance > best_distance : distance < best_distance;
        if (better) {
            best_distance = distance;
            best_count = 0u;
            best_moves[best_count++] = index;
        } else if (distance == best_distance) {
            best_moves[best_count++] = index;
        }
    }

    if (best_count != 0u) game.wren = moves[best_moves[random_below(best_count)]];
    return points_equal(game.wren, head);
}

static bool boss_area_is_clear(uint8_t x, uint8_t y) {
    int8_t check_x;
    int8_t check_y;
    int8_t minimum_x = (int8_t)x - BOSS_SPAWN_CLEARANCE;
    int8_t minimum_y = (int8_t)y - BOSS_SPAWN_CLEARANCE;
    int8_t maximum_x = (int8_t)x + BOSS_SIZE + BOSS_SPAWN_CLEARANCE;
    int8_t maximum_y = (int8_t)y + BOSS_SIZE + BOSS_SPAWN_CLEARANCE;

    for (check_y = minimum_y; check_y < maximum_y; ++check_y) {
        for (check_x = minimum_x; check_x < maximum_x; ++check_x) {
            if (check_x < 0 || check_y < 0 ||
                check_x >= (int8_t)BOARD_WIDTH || check_y >= (int8_t)BOARD_HEIGHT) return false;
            if (bit_get(blocked_cells, cell_index((uint8_t)check_x, (uint8_t)check_y))) return false;
            if (game.food.x == (uint8_t)check_x && game.food.y == (uint8_t)check_y) return false;
            if (game.phantom_active && game.phantom.x == (uint8_t)check_x && game.phantom.y == (uint8_t)check_y) return false;
            if (game.wren_active && game.wren.x == (uint8_t)check_x && game.wren.y == (uint8_t)check_y) return false;
        }
    }
    return true;
}

static bool try_place_boss(void) {
    uint8_t x;
    uint8_t y;
    uint8_t distance;
    uint8_t greatest_distance = 0u;
    uint16_t count = 0u;
    uint16_t choice;
    Point center;
    Point head;

    build_snake_occupancy();
    head.x = game.snake_x[0];
    head.y = game.snake_y[0];
    for (y = BOSS_ARENA_MARGIN; y <= BOARD_HEIGHT - BOSS_SIZE - BOSS_ARENA_MARGIN; ++y) {
        for (x = BOSS_ARENA_MARGIN; x <= BOARD_WIDTH - BOSS_SIZE - BOSS_ARENA_MARGIN; ++x) {
            if (!boss_area_is_clear(x, y)) continue;
            center.x = x + 1u;
            center.y = y + 1u;
            distance = wrapped_distance(center, head);
            if (distance > greatest_distance) {
                greatest_distance = distance;
                count = 1u;
            } else if (distance == greatest_distance) {
                ++count;
            }
        }
    }
    if (count == 0u) return false;

    choice = random_below(count);
    for (y = BOSS_ARENA_MARGIN; y <= BOARD_HEIGHT - BOSS_SIZE - BOSS_ARENA_MARGIN; ++y) {
        for (x = BOSS_ARENA_MARGIN; x <= BOARD_WIDTH - BOSS_SIZE - BOSS_ARENA_MARGIN; ++x) {
            if (!boss_area_is_clear(x, y)) continue;
            center.x = x + 1u;
            center.y = y + 1u;
            if (wrapped_distance(center, head) != greatest_distance) continue;
            if (choice-- == 0u) {
                game.boss.x = x;
                game.boss.y = y;
                return true;
            }
        }
    }
    return false;
}

static void try_start_boss(void) {
    uint8_t index;
    if (game.next_boss_score == UINT32_MAX || game.score < game.next_boss_score ||
        game.boss_active || !try_place_boss()) return;

    game.boss_active = true;
    game.boss_enclosed = false;
    game.boss_move_counter = 0u;
    game.boss_constrict_milliseconds = 0u;
    game.boss_intro_milliseconds = BOSS_INTRO_MS;
    game.boss_slash_milliseconds = (int16_t)current_slash_interval();
    game.slash_warning_milliseconds = 0u;
    game.wren_active = false;
    game.wren_move_counter = 0u;
    for (index = 0u; index < MAX_BOSS_SLASHES; ++index) game.slashes[index].active = false;
    game.music = MUSIC_BOSS;
    game.pending_sound = SOUND_BOSS_START;
}

static bool can_boss_move_to(int8_t x, int8_t y) {
    uint8_t check_x;
    uint8_t check_y;
    if (x < (int8_t)BOSS_ARENA_MARGIN || y < (int8_t)BOSS_ARENA_MARGIN ||
        x > (int8_t)(BOARD_WIDTH - BOSS_SIZE - BOSS_ARENA_MARGIN) ||
        y > (int8_t)(BOARD_HEIGHT - BOSS_SIZE - BOSS_ARENA_MARGIN)) return false;

    for (check_y = (uint8_t)y; check_y < (uint8_t)y + BOSS_SIZE; ++check_y) {
        for (check_x = (uint8_t)x; check_x < (uint8_t)x + BOSS_SIZE; ++check_x) {
            if (snake_contains(check_x, check_y)) return false;
            if (game.food.x == check_x && game.food.y == check_y) return false;
            if (game.phantom_active && game.phantom.x == check_x && game.phantom.y == check_y) return false;
        }
    }
    return true;
}

static void move_boss(void) {
    int8_t move_x[4];
    int8_t move_y[4];
    uint8_t best[4];
    uint8_t best_count = 0u;
    uint8_t shortest = 255u;
    uint8_t index;
    uint8_t distance;
    uint8_t head_x = game.snake_x[0];
    uint8_t head_y = game.snake_y[0];

    if (game.slash_warning_milliseconds != 0u) return;
    if (++game.boss_move_counter < current_boss_move_every()) return;
    game.boss_move_counter = 0u;

    move_x[0] = (int8_t)game.boss.x + 1;
    move_y[0] = (int8_t)game.boss.y;
    move_x[1] = (int8_t)game.boss.x - 1;
    move_y[1] = (int8_t)game.boss.y;
    move_x[2] = (int8_t)game.boss.x;
    move_y[2] = (int8_t)game.boss.y + 1;
    move_x[3] = (int8_t)game.boss.x;
    move_y[3] = (int8_t)game.boss.y - 1;

    for (index = 0u; index < 4u; ++index) {
        if (!can_boss_move_to(move_x[index], move_y[index])) continue;
        distance = absolute_difference((uint8_t)move_x[index] + 1u, head_x) +
            absolute_difference((uint8_t)move_y[index] + 1u, head_y);
        if (distance < shortest) {
            shortest = distance;
            best_count = 0u;
            best[best_count++] = index;
        } else if (distance == shortest) {
            best[best_count++] = index;
        }
    }

    if (best_count != 0u) {
        index = best[random_below(best_count)];
        game.boss.x = (uint8_t)move_x[index];
        game.boss.y = (uint8_t)move_y[index];
    }
}

static bool handle_slash_at(Point cell) {
    uint8_t index;
    bool hit = false;
    for (index = 0u; index < MAX_BOSS_SLASHES; ++index) {
        if (game.slashes[index].active &&
            game.slashes[index].x == (int8_t)cell.x && game.slashes[index].y == (int8_t)cell.y) {
            game.slashes[index].active = false;
            hit = true;
        }
    }
    if (!hit || game.recovery_milliseconds != 0u) return true;
    handle_fatal_collision();
    return false;
}

static void begin_slash_warning(void) {
    int8_t center_x = (int8_t)game.boss.x + 1;
    int8_t center_y = (int8_t)game.boss.y + 1;
    int8_t horizontal = (int8_t)game.snake_x[0] - center_x;
    int8_t vertical = (int8_t)game.snake_y[0] - center_y;
    uint8_t horizontal_abs;
    uint8_t vertical_abs;

    if (horizontal == 0 && vertical == 0) {
        horizontal = game.direction_x;
        vertical = game.direction_y;
    }
    horizontal_abs = horizontal < 0 ? (uint8_t)-horizontal : (uint8_t)horizontal;
    vertical_abs = vertical < 0 ? (uint8_t)-vertical : (uint8_t)vertical;

    if (horizontal_abs >= vertical_abs) {
        game.slash_warning_dx = horizontal < 0 ? -1 : 1;
        game.slash_warning_dy = 0;
        game.slash_warning_origin.x = game.slash_warning_dx > 0
            ? game.boss.x + BOSS_SIZE
            : game.boss.x - 1u;
        game.slash_warning_origin.y = (uint8_t)center_y;
    } else {
        game.slash_warning_dx = 0;
        game.slash_warning_dy = vertical < 0 ? -1 : 1;
        game.slash_warning_origin.x = (uint8_t)center_x;
        game.slash_warning_origin.y = game.slash_warning_dy > 0
            ? game.boss.y + BOSS_SIZE
            : game.boss.y - 1u;
    }
    game.slash_warning_milliseconds = SLASH_WARNING_MS;
    game.pending_sound = SOUND_SLASH_WARNING;
}

static void launch_slash(void) {
    uint8_t index;
    for (index = 0u; index < MAX_BOSS_SLASHES; ++index) {
        if (!game.slashes[index].active) {
            game.slashes[index].x = (int8_t)game.slash_warning_origin.x;
            game.slashes[index].y = (int8_t)game.slash_warning_origin.y;
            game.slashes[index].dx = game.slash_warning_dx;
            game.slashes[index].dy = game.slash_warning_dy;
            game.slashes[index].move_counter = 0u;
            game.slashes[index].active = true;
            break;
        }
    }
    game.boss_slash_milliseconds = (int16_t)current_slash_interval();
    game.pending_sound = SOUND_SLASH;
}

static bool update_slashes(void) {
    uint8_t index;
    Point head;

    if (game.level < SLASH_UNLOCK_LEVEL) {
        for (index = 0u; index < MAX_BOSS_SLASHES; ++index) game.slashes[index].active = false;
        game.slash_warning_milliseconds = 0u;
        return true;
    }

    if (game.slash_warning_milliseconds != 0u) {
        game.slash_warning_milliseconds = subtract_to_zero(
            game.slash_warning_milliseconds,
            game.tick_milliseconds
        );
        if (game.slash_warning_milliseconds == 0u) launch_slash();
    } else {
        game.boss_slash_milliseconds -= (int16_t)game.tick_milliseconds;
        if (game.boss_slash_milliseconds <= 0) begin_slash_warning();
    }

    head.x = game.snake_x[0];
    head.y = game.snake_y[0];
    for (index = 0u; index < MAX_BOSS_SLASHES; ++index) {
        if (!game.slashes[index].active) continue;
        if (++game.slashes[index].move_counter >= current_slash_move_every()) {
            game.slashes[index].move_counter = 0u;
            game.slashes[index].x += game.slashes[index].dx;
            game.slashes[index].y += game.slashes[index].dy;
        }
        if (game.slashes[index].x < 0 || game.slashes[index].x >= (int8_t)BOARD_WIDTH ||
            game.slashes[index].y < 0 || game.slashes[index].y >= (int8_t)BOARD_HEIGHT) {
            game.slashes[index].active = false;
            continue;
        }
        if (game.slashes[index].x != (int8_t)head.x || game.slashes[index].y != (int8_t)head.y) continue;
        game.slashes[index].active = false;
        if (game.recovery_milliseconds == 0u && !handle_fatal_collision()) return false;
    }
    return true;
}

static bool is_boss_enclosed(void) {
    uint16_t read_index = 0u;
    uint16_t write_index = 0u;
    uint16_t index;
    uint16_t next_index;
    uint8_t x;
    uint8_t y;
    uint16_t snake_index;

    memset(blocked_cells, 0, sizeof(blocked_cells));
    memset(visited_cells, 0, sizeof(visited_cells));
    for (snake_index = 0u; snake_index < game.snake_length; ++snake_index) {
        bit_set(blocked_cells, cell_index(game.snake_x[snake_index], game.snake_y[snake_index]));
    }

    index = cell_index(game.boss.x + 1u, game.boss.y + 1u);
    flood_queue[write_index++] = index;
    bit_set(visited_cells, index);

    while (read_index < write_index) {
        index = flood_queue[read_index++];
        x = (uint8_t)(index % BOARD_WIDTH);
        y = (uint8_t)(index / BOARD_WIDTH);
        if (x == 0u || y == 0u || x == BOARD_WIDTH - 1u || y == BOARD_HEIGHT - 1u) return false;

        next_index = index + 1u;
        if (!bit_get(visited_cells, next_index) && !bit_get(blocked_cells, next_index)) {
            bit_set(visited_cells, next_index);
            flood_queue[write_index++] = next_index;
        }
        next_index = index - 1u;
        if (!bit_get(visited_cells, next_index) && !bit_get(blocked_cells, next_index)) {
            bit_set(visited_cells, next_index);
            flood_queue[write_index++] = next_index;
        }
        next_index = index + BOARD_WIDTH;
        if (!bit_get(visited_cells, next_index) && !bit_get(blocked_cells, next_index)) {
            bit_set(visited_cells, next_index);
            flood_queue[write_index++] = next_index;
        }
        next_index = index - BOARD_WIDTH;
        if (!bit_get(visited_cells, next_index) && !bit_get(blocked_cells, next_index)) {
            bit_set(visited_cells, next_index);
            flood_queue[write_index++] = next_index;
        }
    }
    return true;
}

static void remove_overlapping_tail(void) {
    uint16_t index;
    uint16_t position;
    memset(blocked_cells, 0, sizeof(blocked_cells));
    for (index = 0u; index < game.snake_length; ++index) {
        position = cell_index(game.snake_x[index], game.snake_y[index]);
        if (bit_get(blocked_cells, position)) {
            game.snake_length = index;
            return;
        }
        bit_set(blocked_cells, position);
    }
}

static void defeat_boss(void) {
    uint8_t index;
    game.boss_active = false;
    game.boss_enclosed = false;
    game.boss_defeat_milliseconds = BOSS_DEFEAT_MS;
    game.pending_level = game.level < MAXIMUM_LEVEL ? game.level + 1u : MAXIMUM_LEVEL;
    game.slash_warning_milliseconds = 0u;
    for (index = 0u; index < MAX_BOSS_SLASHES; ++index) game.slashes[index].active = false;
    remove_overlapping_tail();
    add_score(BOSS_SCORE);
    game.pending_sound = SOUND_BOSS_DEFEATED;
    game.music = MUSIC_NONE;

    if (game.next_boss_score <= UINT32_MAX - BOSS_SCORE_INTERVAL) {
        game.next_boss_score += BOSS_SCORE_INTERVAL;
    } else {
        game.next_boss_score = UINT32_MAX;
    }
    if (game.next_boss_score > EXTRA_LIFE_LEAD_SCORE &&
        game.next_extra_life_score < game.next_boss_score - EXTRA_LIFE_LEAD_SCORE) {
        game.next_extra_life_score = game.next_boss_score - EXTRA_LIFE_LEAD_SCORE;
    }
}

static void update_boss_constrict(void) {
    uint16_t duration;
    game.boss_enclosed = is_boss_enclosed();
    if (!game.boss_enclosed) return;

    duration = current_boss_constrict_duration();
    if (game.boss_constrict_milliseconds < duration) {
        game.boss_constrict_milliseconds += game.tick_milliseconds;
        if (game.boss_constrict_milliseconds > duration) game.boss_constrict_milliseconds = duration;
    }
    if (game.boss_constrict_milliseconds >= duration) defeat_boss();
}

static bool update_boss_transition(void) {
    if (game.boss_intro_milliseconds != 0u) {
        game.boss_intro_milliseconds = subtract_to_zero(game.boss_intro_milliseconds, game.tick_milliseconds);
        return true;
    }
    if (game.boss_defeat_milliseconds != 0u) {
        game.boss_defeat_milliseconds = subtract_to_zero(game.boss_defeat_milliseconds, game.tick_milliseconds);
        if (game.boss_defeat_milliseconds == 0u) {
            if (game.pending_level > game.level) {
                game.level_up_milliseconds = LEVEL_UP_MS;
                game.pending_sound = SOUND_LEVEL_UP;
            } else {
                game.pending_level = 0u;
                place_wren();
                game.wren_move_counter = 0u;
                game.music = MUSIC_ADVENTURE;
            }
        }
        return true;
    }
    if (game.level_up_milliseconds != 0u) {
        game.level_up_milliseconds = subtract_to_zero(game.level_up_milliseconds, game.tick_milliseconds);
        if (game.level_up_milliseconds == 0u) {
            if (game.pending_level > game.level) {
                game.level = game.pending_level;
                game.tick_milliseconds = game.level >= 6u
                    ? MINIMUM_TICK_MS
                    : STARTING_TICK_MS - (uint16_t)(game.level - 1u) * TICK_STEP_MS;
            }
            game.pending_level = 0u;
            place_wren();
            game.wren_move_counter = 0u;
            game.music = MUSIC_ADVENTURE;
        }
        return true;
    }
    return false;
}

void game_start(uint32_t high_score) BANKED {
    memset(&game, 0, sizeof(game));
    game.high_score = high_score;
    game.snake_length = 4u;
    game.snake_x[0] = 10u;
    game.snake_x[1] = 9u;
    game.snake_x[2] = 8u;
    game.snake_x[3] = 7u;
    game.snake_y[0] = 8u;
    game.snake_y[1] = 8u;
    game.snake_y[2] = 8u;
    game.snake_y[3] = 8u;
    game.direction_x = 1;
    game.next_direction_x = 1;
    game.tick_milliseconds = STARTING_TICK_MS;
    game.level = 1u;
    game.next_extra_life_score = 300u;
    game.next_boss_score = 500u;
    game.music = MUSIC_ADVENTURE;
    place_food();
    place_wren();
}

void game_set_direction(int8_t x, int8_t y) BANKED {
    if ((x == 0 && (y == 1 || y == -1)) || (y == 0 && (x == 1 || x == -1))) {
        if (x == -game.direction_x && y == -game.direction_y) return;
        game.next_direction_x = x;
        game.next_direction_y = y;
    }
}

void game_tick(void) BANKED {
    Point new_head;
    int16_t body_collision;
    bool eating_food;
    bool eating_phantom;
    bool growing;
    bool survived;

    if (game.game_over || game.snake_length == 0u) return;
    game.pending_sound = SOUND_NONE;
    if (update_boss_transition()) return;

    game.notice_milliseconds = subtract_to_zero(game.notice_milliseconds, game.tick_milliseconds);
    if (game.notice_milliseconds == 0u) game.notice = NOTICE_NONE;
    game.recovery_milliseconds = subtract_to_zero(game.recovery_milliseconds, game.tick_milliseconds);
    game.power_milliseconds = subtract_to_zero(game.power_milliseconds, game.tick_milliseconds);
    if (game.power_milliseconds == 0u && !game.wren_active && !game.boss_active) {
        place_wren();
        game.wren_move_counter = 0u;
    }

    game.direction_x = game.next_direction_x;
    game.direction_y = game.next_direction_y;
    new_head.x = wrap_x((int8_t)game.snake_x[0] + game.direction_x);
    new_head.y = wrap_y((int8_t)game.snake_y[0] + game.direction_y);
    eating_food = points_equal(new_head, game.food);
    eating_phantom = game.phantom_active && points_equal(new_head, game.phantom);
    growing = eating_food || eating_phantom;

    body_collision = game.boss_active ? -1 : find_body_collision(new_head, growing);
    if (body_collision >= 0) {
        survived = game.recovery_milliseconds != 0u || handle_fatal_collision();
        if (survived) game.snake_length = (uint16_t)body_collision;
        return;
    }

    if (game.wren_active && points_equal(new_head, game.wren)) {
        if (game.power_milliseconds != 0u) {
            game.wren_active = false;
            game.wren_move_counter = 0u;
            add_score(WREN_SCORE);
            set_notice(NOTICE_WREN_DOWN);
            game.pending_sound = SOUND_WREN_DOWN;
        } else if (game.recovery_milliseconds == 0u) {
            handle_fatal_collision();
            return;
        }
    }

    if (game.boss_active && game.recovery_milliseconds == 0u && boss_contains(new_head.x, new_head.y)) {
        handle_fatal_collision();
        return;
    }
    if (!handle_slash_at(new_head)) return;

    insert_head(new_head, growing);
    if (eating_food) {
        add_score(10u);
        ++game.normal_foods_eaten;
        game.pending_sound = SOUND_FRUIT;
        if (!place_food()) {
            game.game_over = true;
            game.won = true;
            game.music = MUSIC_NONE;
            return;
        }
        if (game.normal_foods_eaten >= NORMAL_FRUITS_PER_PHANTOM) {
            game.normal_foods_eaten = 0u;
            if (!game.phantom_active) place_phantom();
        }
    } else if (eating_phantom) {
        game.phantom_active = false;
        game.power_milliseconds = current_power_duration();
        add_score(PHANTOM_SCORE);
        game.pending_sound = SOUND_PHANTOM;
    }

    if (game.boss_active) {
        move_boss();
        if (!update_slashes()) return;
        update_boss_constrict();
    } else {
        if (move_wren() && game.power_milliseconds != 0u) {
            game.wren_active = false;
            add_score(WREN_SCORE);
            set_notice(NOTICE_WREN_DOWN);
            game.pending_sound = SOUND_WREN_DOWN;
        } else if (game.wren_active && points_equal(game.wren, new_head) &&
            game.recovery_milliseconds == 0u) {
            handle_fatal_collision();
            return;
        }
        try_start_boss();
    }
}
