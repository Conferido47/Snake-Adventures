# Snake Adventures for Game Boy Color

This is a native Game Boy Color homebrew port of **Snake Adventures**. It is an Endless Adventure build, not a wrapper around the Windows or browser editions.

## Included

- Native 160x144 Game Boy Color presentation
- A 20x16 wraparound field
- Wren pursuit and predictive movement
- Phantom Fruit and powered Wren hunting
- One-slot extra-life system
- Recurring Hollow King enclosure battles
- Higher-level sword crescents
- Seven selectable snake skins
- Original menu, Adventure, and boss chiptune arrangements
- Battery-backed high score and equipped-skin save data

Story Mode and Discord-connected features are intentionally excluded.

## Build

On Windows, run:

```powershell
.\build.ps1
```

The script downloads the pinned GBDK-2020 4.5.0 Windows toolchain to `%LocalAppData%\SnakeAdventuresGB` when `GBDK_HOME` is not set, verifies its SHA-256 checksum, and creates:

```text
build\SnakeAdventures.gb
```

You can also double-click `compile.bat`. To use an existing GBDK installation, set `GBDK_HOME` to its root folder before building.

Regenerate the tile artwork after changing `tools/generate-assets.mjs` with:

```powershell
node tools/generate-assets.mjs
```

## Play

Open `build\SnakeAdventures.gb` in a Game Boy Color emulator or place it on a compatible flash cartridge. The ROM is marked Game Boy Color-only because each skin uses color palettes.

## Controls

- D-pad: move and navigate
- A: select, equip, or retry
- B: back or return to the menu
- Start: begin a run or pause

## Save Hardware

The cartridge header requests MBC5 with 8 KiB of battery-backed SRAM. The ROM alternates between two CRC-protected save slots so an interrupted write does not destroy the previous save. An emulator must have save-RAM persistence enabled to retain the high score and selected skin.
