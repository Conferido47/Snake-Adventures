# Discord Activity art assets

These files are ready for **Activities > Art Assets** in the Discord Developer Portal.

| Portal field | Upload file | Export |
| --- | --- | --- |
| Cover Art | `snake-adventures-cover-1920x1080.png` | 16:9 PNG, 1920x1080 |
| Embedded Background | `snake-adventures-embedded-background-1920x1080.png` | 16:9 PNG, 1920x1080 |
| Video Preview | `snake-adventures-video-preview-640x360.mp4` | 16:9 H.264 MP4, 640x360, 9 seconds, no audio |

The cover keeps its title and main subjects inside Discord's narrower 13:11 display crop. The embedded background keeps the center clear so Discord's interface remains readable.

The matching SVG files are editable masters. Regenerate all exports from `DiscordActivity/` with:

```powershell
npm run art:activity
```

Chrome or Edge and ImageMagick are required for rendering. The project-local `ffmpeg-static` development dependency encodes the video preview. Set `CHROME_PATH`, `MAGICK_PATH`, or `FFMPEG_PATH` to override automatic executable detection.
