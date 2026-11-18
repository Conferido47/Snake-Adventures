# Snake Adventures Discord Activity

This directory contains the browser and Discord Activity edition of Snake Adventures. It is a single-player HTML5 Canvas game with Web Audio, keyboard, mouse, swipe, and on-screen controls.

The Activity uses Discord's Embedded App SDK only when Discord launch parameters are present, and it also runs as a normal website.

Discord play requests the `identify` scope for online scores and account-owned cosmetics. Completed runs are stored in Cloudflare D1 and update each player's personal best, UTC daily streak, and lifetime rank. Players can opt in once to receive future result embeds privately from the bot, view the global lifetime Top 10, and explicitly share the leaderboard through Discord's share dialog. Browser-only play remains local, does not submit scores, and can preview but not purchase paid skins.

## Requirements

- Node.js 22.12 or newer
- A Discord application for Activity launches
- A public HTTPS host or HTTPS development tunnel for Discord testing

## Browser development

```powershell
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. A Discord application ID is not required for normal browser development.

Available checks:

```powershell
npm test
npm run build
```

## Create the Discord application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and create an application.
2. Copy its **Application ID** from **General Information**.
3. Under **General Information**, set **Max Participants** to `1` for the current single-player release.
4. Under **Installation**, enable **Guild Install** and select the `applications.commands` and `bot` scopes. The bot needs no guild permissions for private result DMs, but it must be installed in a server shared with each recipient. The installer needs permission to manage that server.
5. Under **Activities > Settings**, enable Activities and the Web/Desktop platform.
6. Leave mobile platforms disabled until they have been tested on the intended devices.

Create `.env.local` in this directory using `.env.example` as the template:

```dotenv
VITE_DISCORD_CLIENT_ID=YOUR_APPLICATION_ID
VITE_DEV_TUNNEL_HOST=
```

The application ID is public frontend configuration. Never place a Discord client secret or bot token in a `VITE_` variable.

## Test inside Discord

Discord loads an Activity through its HTTPS proxy. A Cloudflare quick tunnel is one way to expose the local Vite server:

```powershell
cloudflared tunnel --url http://localhost:5173
```

Copy the generated `trycloudflare.com` hostname without `https://` into `VITE_DEV_TUNNEL_HOST`, then restart Vite in Discord mode:

```powershell
npm run dev:discord
```

In the Developer Portal:

1. Open **Activities > URL Mappings**.
2. Add the prefix `/` and target the tunnel hostname without a protocol.
3. Enable Developer Mode in Discord.
4. Open a test server text or voice channel, launch the App Launcher, and select the Activity.

The configured tunnel hostname is deliberately allowlisted by Vite. Remove or update it after the temporary tunnel is finished because Cloudflare can later assign the same hostname to someone else.

## Production deployment

Current production site: [snake-adventures-discord.pages.dev](https://snake-adventures-discord.pages.dev/)

Cloudflare Pages project: `snake-adventures-discord`

Legal pages:

- Privacy Policy: [snake-adventures-discord.pages.dev/privacy/](https://snake-adventures-discord.pages.dev/privacy/)
- Terms of Service: [snake-adventures-discord.pages.dev/terms/](https://snake-adventures-discord.pages.dev/terms/)

Set `VITE_DISCORD_CLIENT_ID` in the hosting provider's build environment and use:

```powershell
npm install
npm run build:discord
```

`build:discord` fails if the application ID is missing. Deploy the generated `dist/` directory together with the Pages Functions. OAuth, scores, result preferences, the lifetime leaderboard, private DMs, verified cosmetic ownership, and equipped-skin persistence require the backend and D1 binding.

To redeploy the current Cloudflare Pages project after building:

```powershell
npx --yes wrangler@4.114.0 pages deploy dist --project-name snake-adventures-discord --branch main
```

After deployment:

1. Replace the development `/` URL mapping with the production hostname, without `https://`.
2. Launch and test the production build through Discord's proxy.
3. Use the install link from **Installation** to add the application to the server. The installer needs permission to manage the server.
4. Complete Discord's current verification and discovery requirements before broad public distribution.

## Controls

- Move: Arrow keys, `WASD`, swipe, or the on-screen direction pad
- Pause: `P` or the on-screen Select/Pause button
- Restart: `R` or the on-screen Back/Restart button
- Menu selection: Arrow keys and `Enter`, canvas buttons, or the on-screen controls
- Music: `M`
- Sound effects: `S` while in menus or paused
- Wardrobe: choose **Wardrobe** from the opening menu to preview, purchase, or equip skins
- Leaderboard: choose **Top 10** in the masthead to view lifetime rankings, manage result DMs, or share

The game automatically pauses if the Activity or browser tab is hidden.

## Rich Presence

The Activity requests Discord's `rpc.activities.write` scope and updates each player's profile with the main menu, score, level, elapsed run time, Phantom power, pause state, and Hollow King encounters. Updates are rate-limited and do not affect gameplay if Discord rejects a presence update.

Upload the four PNG files in `store-assets/discord-rich-presence/` under **Rich Presence > Art Assets** before testing. The required lowercase asset keys and matching Rich Presence Visualizer values are documented in [`store-assets/discord-rich-presence/README.md`](store-assets/discord-rich-presence/README.md).

Party size and join secrets are deliberately omitted because this edition is single-player.

## Architecture

- `src/game/model.ts`: deterministic cell-based game rules and progression
- `src/game/renderer.ts`: opening screens and Canvas rendering
- `src/game/art.ts`: code-drawn Wren, Hollow King, and Phantom Fruit artwork
- `src/game/audio.ts`: synthesized music and effects using Web Audio
- `src/game/controller.ts`: timers, menus, keyboard, pointer, swipe, and touch input
- `src/game/skins.ts`: code-drawn skin palettes, patterns, heads, state tints, and previews
- `shared/cosmetics.ts`: stable cosmetic IDs and release catalog shared by client and Functions
- `src/discord.ts`: conditional Discord SDK handshake
- `src/cosmetics.ts`: Discord SKU checkout, inventory refresh, and equip client
- `src/wardrobe.ts`: accessible Wardrobe dialog and product interaction
- `src/run-reporter.ts`: authenticated, idempotent run submission
- `src/player-hub.ts`: result-DM preference, lifetime leaderboard, and user-triggered sharing UI
- `functions/api/token.ts`: server-side Discord OAuth code exchange
- `functions/api/run.ts`: identity validation, D1 statistics, rank lookup, and private result delivery
- `functions/api/preferences.ts`: persistent result-DM opt-in
- `functions/api/leaderboard.ts`: authenticated lifetime Top 10 and player rank
- `functions/api/cosmetics.ts`: verified ownership and equipped-skin API
- `functions/lib/discord-auth.ts`: shared bearer-token identity validation
- `functions/lib/discord-dm.ts`: bounded Discord bot DM delivery
- `functions/lib/cosmetics.ts`: Discord HTTP entitlement verification
- `migrations/`: versioned D1 score, preference, and equipment schema

The current Activity is single-player, matching the Windows game. Online statistics are authenticated but the gameplay simulation remains client-side, so scores should be treated as casual rather than cheat-proof. Multiplayer rooms would require a server-authoritative game backend.

## Online services and Wardrobe deployment

The Pages project requires these encrypted secrets:

- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`

Optionally set encrypted `DISCORD_CREATOR_USER_IDS` to a comma-separated list of authenticated Discord user IDs that should receive every configured launch skin without purchasing. Keep this allowlist limited to the development team; all other users remain subject to Discord entitlement verification.

After creating the four launch products, add their public Durable SKU IDs under `vars` in `wrangler.jsonc` so deployment configuration remains reproducible:

- `DISCORD_SKU_WRENBOUND`
- `DISCORD_SKU_EMBERCOIL`
- `DISCORD_SKU_PHANTOM_ROYAL`
- `DISCORD_SKU_BONE_SERPENT`

The Wardrobe safely shows `SKU NOT CONFIGURED` until a valid numeric SKU ID is present. Discord's bot token is used only by Pages Functions to send opted-in result DMs and verify entitlements through the HTTP API; it must never be placed in `.env.local` or any `VITE_` variable. Copy `.dev.vars.example` to `.dev.vars` only for local Pages Functions development and add real secrets there.

Result DMs are best-effort. Discord can reject delivery when the player has disabled DMs, blocked the bot, or does not share a server with it. A failed DM never removes the saved run, and the result remains available through the in-Activity leaderboard. Players can disable future DMs at any time from **Top 10**.

Keep every historical SKU mapping even if a product is later unpublished, because previous purchasers remain entitled. Every skin must have a unique SKU ID. For local or staging purchase tests only, set `ALLOW_DISCORD_TEST_ENTITLEMENTS=true`; leave it false or unset in production so Application Test Mode entitlements cannot unlock production cosmetics.

Each skin should be created as a user-owned **Durable** one-time purchase and published to **Store and API**. Use Discord's returned localized price in the Activity. Confirm that `$0.99` is an available predefined price in the Developer Portal rather than assuming it.

The D1 binding is `DB`, backed by `snake-adventures-discord-scores`. Apply migrations and validate both TypeScript targets before deployment:

```powershell
npm test
npm run build:discord
npm run check:functions
npm run build:functions
npx wrangler d1 migrations apply snake-adventures-discord-scores --remote
npx wrangler pages deploy dist --project-name snake-adventures-discord --branch main
```

Test one-time purchases using Discord **Application Test Mode**, not test entitlements. Purchases are initiated by the Embedded App SDK, but ownership is granted only after the backend verifies the resulting Discord entitlement.

## View the live player database

On Windows, double-click `Open Live Player Database.cmd` in the repository's main folder. It opens a private local dashboard in the browser with live player statistics, search, and the complete paginated run history. The launcher starts one hidden local service at `http://127.0.0.1:41739`; opening the file again safely reuses it, so no terminal window needs to remain open.

The viewer reads the remote production D1 database through the locally authenticated Cloudflare account and does not create a public admin endpoint. If Cloudflare login is required, run this once from `DiscordActivity/` and then open the dashboard again:

```powershell
npx wrangler login
```

## Official Discord references

- [Activities overview](https://docs.discord.com/developers/activities/overview)
- [Building an Activity](https://docs.discord.com/developers/activities/building-an-activity)
- [Local development](https://docs.discord.com/developers/activities/development-guides/local-development)
- [Networking and URL mappings](https://docs.discord.com/developers/activities/development-guides/networking)
- [Mobile support](https://docs.discord.com/developers/activities/development-guides/mobile)
- [In-App Purchases for Activities](https://docs.discord.com/developers/monetization/implementing-iap-for-activities)
- [One-Time Purchases](https://docs.discord.com/developers/monetization/implementing-one-time-purchases)
