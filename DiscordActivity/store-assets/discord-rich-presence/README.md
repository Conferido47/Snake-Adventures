# Discord Rich Presence assets

Upload the four PNG files under **Rich Presence > Art Assets** in the Discord Developer Portal. Discord recommends 1024x1024 images and automatically lowercases asset keys.

| Asset key | Upload file | Live use |
| --- | --- | --- |
| `snake-adventures` | `snake-adventures.png` | Large image for every state |
| `wren` | `wren.png` | Main menu and ordinary runs |
| `phantom-fruit` | `phantom-fruit.png` | Phantom power is active |
| `hollow-king` | `hollow-king.png` | Hollow King encounter |

## Visualizer example

Use these values to preview an ordinary run:

| Visualizer field | Value |
| --- | --- |
| state | `Score 120 | Level 2` |
| details | `Endless Adventure` |
| start Timestamp | A current Unix timestamp, or blank for a static preview |
| end Timestamp | Blank |
| large Image Key | `snake-adventures` |
| large Image Text | `Snake Adventures` |
| small Image Key | `wren` |
| small Image Text | `Wren is hunting` |
| party Id | Blank |
| party Size | Blank |
| party Max | Blank |
| join Secret | Blank |

The Activity updates these fields in code. During Phantom power, use `Phantom Hunt` with the `phantom-fruit` small image. During a boss encounter, use `Battling the Hollow King` with the `hollow-king` small image.

Do not add party sizes or join secrets unless Snake Adventures gains actual shared multiplayer state. The current game is single-player.

Also set **General Information > Max Participants** to `1`. This prevents Discord from presenting the current release as a multiplayer party.

The matching SVG files are editable masters. Regenerate all Discord art exports with:

```powershell
npm run art:presence
```
