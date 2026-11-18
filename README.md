# Snake Adventures

An original arcade adventure built with C# and Windows Forms for Visual Studio Community.

Created by Justin Conferido, Najem Alayoubi, and Merj Din.

## Play the game

### Browser

[Play Snake Adventures in your browser](https://snake-adventures-discord.pages.dev/) — no download or Discord account is needed for local browser play. Online scores and other Discord-connected features require launching the Activity through Discord.

### Windows download

Download [SnakeAdventures-v1.0.1-win-x64.zip](https://github.com/Conferido47/Snake-Adventures/releases/download/v1.0.1/SnakeAdventures-v1.0.1-win-x64.zip) from the [latest release](https://github.com/Conferido47/Snake-Adventures/releases/latest).

1. On a 64-bit Windows 10 or Windows 11 PC, extract the entire ZIP to a folder.
2. Open the extracted folder and run `SnakeAdventures.exe`.

Keep the extracted files together. This self-contained build includes the .NET runtime, so Visual Studio and a separate .NET installation are not required. The Windows edition includes Endless Adventure and Story Mode Chapter 1; the browser edition provides Endless Adventure.

### Player names (version 1.0.1 and later)

The browser and updated Windows edition ask **Who's playing?** at launch. Enter a display name and choose **Play and save results** to record your platform, visits, and completed-run scores in the creators' private player database. The name is remembered on that browser/PC and can be edited at the next launch. It is a chosen name, not a verified identity; matching names on different devices remain separate players.

Choose **Play offline** for local play without reporting. Network failures never block gameplay, and records that could not be uploaded are not queued after closing the game. Previously downloaded version 1.0.0 does not report players; it must be replaced with the updated Windows build.

The updated source requires database migration `0004_named_players.sql` and deployment of the updated Pages Functions before named reporting becomes available online.

## Build from source

### Visual Studio

1. Open the Visual Studio Installer.
2. Make sure the **.NET desktop development** workload is installed.
3. Double-click `SnakeGame.sln` in this folder.
4. In Visual Studio, press `F5` or click the green **Start** button.

The project targets .NET 8 and restores NAudio automatically. All music and sound effects are synthesized from original note sequences at runtime; no external or copyrighted audio tracks are included.

### Package the Windows edition

With the .NET SDK installed, run from the repository root:

```powershell
dotnet publish SnakeGame/SnakeGame.csproj --configuration Release --runtime win-x64 --self-contained true --output SnakeGame/bin/publish/win-x64 -p:DebugType=None -p:DebugSymbols=false
```

Distribute the entire contents of `SnakeGame/bin/publish/win-x64/` together as a ZIP.

## Discord Activity

A browser port that can run inside Discord is available in `DiscordActivity/`. It preserves the original menus, synthesized music, Wren, Phantom Fruit, extra-life system, Hollow King encounters, progression, and sword crescents. Authenticated Discord play also provides private opt-in result DMs and a shareable lifetime leaderboard. The Windows edition contains the first Story Mode chapter; the Discord edition currently provides the original endless Adventure.

```powershell
cd DiscordActivity
npm install
npm run dev
```

Open the local address printed by Vite to test in a normal browser. See [`DiscordActivity/README.md`](DiscordActivity/README.md) for Discord Developer Portal, local tunnel, hosting, and server installation instructions.

## Opening menu

- Choose **Play** or **How to Play** with the mouse or keyboard.
- **Play** opens the mode selector. **How to Play** opens both Field Guide pages, followed by the same mode selector.
- Use `M` to toggle music and `S` to toggle sound effects.
- Use the arrow keys and `Enter` to navigate without a mouse.

## Game modes

- **Endless Adventure** is the original score chase. The Hollow King returns every 500 points and difficulty continues scaling without a final chapter.
- **Story Mode** currently includes Chapter 1, **The Hollow Wood**. Reach 500 points and defeat the Hollow King to complete the chapter.
- Story completion is saved to `%LocalAppData%\SnakeAdventures\progress.json`. Cleared chapters remain available for replay.

## Controls

- Move with the arrow keys or `W`, `A`, `S`, and `D`.
- Press `P` to open the pause menu. From there, resume, toggle Music or SFX, or quit to the main menu.
- Press `R` to restart the current run.
- After an Endless loss, press `Space` or `Enter` to play again. Story results provide Retry, Chapter Select, and Main Menu actions.

## Adventure rules

Red fruit grows the snake and awards 10 points. The snake wraps through every edge of the board.

Wren is a tiny masked hunter who tracks the snake across wraparound edges. Touching him normally ends the run. After every five red fruits, a gold-and-violet Phantom Fruit appears. Phantom power makes Wren vulnerable and worth 50 points while he flees.

One extra life is offered 200 points before each upcoming boss. Only one can be stored. If the player already has one, the reward becomes 50 points. Using a life preserves the current score and grants brief recovery protection.

## The Hollow King

The Hollow King appears every 500 points and Wren leaves during the fight. Body pass-through activates only during this battle. Surround the King until the snake blocks every route to the outside, then maintain the enclosure while the capture ring contracts. Opening the loop pauses progress.

At Level 5, the King telegraphs a dangerous lane before launching a traveling sword crescent. Touching the King or a crescent consumes a stored life or ends the run. Defeating the King awards 250 points, followed by `LEVEL UP` and the next difficulty tier.

## Difficulty progression

| Score | Speed | Wren | Phantom | Hollow King |
| --- | ---: | --- | ---: | --- |
| 0-499 | 95ms | Tracks | 5.0s | Base |
| 500-999 | 90ms | Faster | 5.0s | Moves faster |
| 1000-1499 | 85ms | Predicts 2 cells | 4.5s | Longer capture |
| 1500-1999 | 80ms | Moves every 2 ticks | 4.0s | Stronger |
| 2000-2499 | 75ms | Predicts 3 cells | 3.5s | Sword crescents unlock |
| 2500+ | 70ms cap | Maximum | 3.0s minimum | Capped scaling |

## Main code

- `SnakeGame/OpeningScreen.cs` draws the opening, mode, chapter-select, and Field Guide screens.
- `SnakeGame/SnakeAdventuresLogo.png` is the source artwork for the Windows application branding.
- `SnakeGame/SnakeAdventures.ico` provides matching Windows executable and title-bar icons.
- `SnakeGame/GameMode.cs` defines launch modes and Story chapter content.
- `SnakeGame/StoryProgressStore.cs` saves Story checkpoints locally.
- `SnakeGame/AudioManager.cs` synthesizes and mixes the original chiptunes and effects.
- `SnakeGame/CharacterArt.cs` contains the original Wren, Hollow King, and Phantom Fruit artwork.
- `SnakeGame/GameForm.cs` contains gameplay, scoring, enemy behavior, bosses, and drawing.
