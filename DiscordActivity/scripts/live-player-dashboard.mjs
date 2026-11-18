import { execFile, spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const executeFile = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = dirname(scriptPath);
const projectDirectory = dirname(scriptDirectory);
const wranglerCli = join(projectDirectory, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const databaseName = 'snake-adventures-discord-scores';
const dashboardPort = 41_739;
const dashboardUrl = `http://127.0.0.1:${dashboardPort}`;
const dashboardService = 'snake-adventures-live-player-database';
const pageSizes = new Set([25, 50, 100, 250]);

await access(wranglerCli).catch(() => {
  throw new Error('Wrangler is missing. Run npm install in the DiscordActivity folder.');
});

if (process.argv.includes('--check')) {
  console.log('Live player dashboard files are ready.');
  process.exit(0);
} else if (process.argv.includes('--serve')) {
  startDashboardServer(dashboardPort, false);
} else if (process.argv.includes('--no-open')) {
  startDashboardServer(0, true);
} else {
  await launchDashboard().catch((error) => {
    console.error(`Dashboard launch failed: ${error.message}`);
    process.exitCode = 1;
  });
}

function startDashboardServer(port, showAddress) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');

    if (request.method === 'GET' && url.pathname === '/') {
      sendHtml(response, dashboardHtml);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, { service: dashboardService });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/data') {
      try {
        const data = await fetchDashboardData(url.searchParams);
        sendJson(response, data);
      } catch (error) {
        sendJson(response, { error: readableError(error) }, 500);
      }
      return;
    }

    if (request.method === 'GET' && url.pathname === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }

    sendJson(response, { error: 'Not found.' }, 404);
  });

  server.on('error', (error) => {
    console.error(`Dashboard server failed: ${error.message}`);
    process.exitCode = 1;
  });

  server.listen(port, '127.0.0.1', () => {
    if (!showAddress) {
      return;
    }
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('The dashboard could not choose a local port.');
    }
    console.log(`http://127.0.0.1:${address.port}`);
  });
}

async function launchDashboard() {
  if (!(await isDashboardRunning())) {
    const dashboard = spawn(process.execPath, [scriptPath, '--serve'], {
      cwd: projectDirectory,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    dashboard.on('error', () => {});
    dashboard.unref();

    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 125));
      if (await isDashboardRunning()) {
        openBrowser(dashboardUrl);
        return;
      }
    }
    throw new Error(`The local service could not start on ${dashboardUrl}.`);
  }

  openBrowser(dashboardUrl);
}

async function isDashboardRunning() {
  try {
    const response = await fetch(`${dashboardUrl}/api/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(750),
    });
    const data = await response.json();
    return response.ok && data.service === dashboardService;
  } catch {
    return false;
  }
}

async function fetchDashboardData(searchParameters) {
  const search = (searchParameters.get('q') ?? '').trim().slice(0, 80);
  const requestedPage = Number.parseInt(searchParameters.get('page') ?? '1', 10);
  const requestedPageSize = Number.parseInt(searchParameters.get('pageSize') ?? '100', 10);
  const page = Number.isSafeInteger(requestedPage) ? Math.min(100_000, Math.max(1, requestedPage)) : 1;
  const pageSize = pageSizes.has(requestedPageSize) ? requestedPageSize : 100;
  const offset = (page - 1) * pageSize;
  const playerWhere = buildPlayerWhere(search);
  const runWhere = buildRunWhere(search);

  const sql = `
    SELECT
      (SELECT COUNT(*) FROM all_player_stats) AS totalPlayers,
      (SELECT COUNT(*) FROM all_run_submissions) AS totalRuns,
      (SELECT COALESCE(MAX(high_score), 0) FROM all_player_stats) AS bestScore,
      (SELECT COALESCE(SUM(won), 0) FROM all_run_submissions) AS totalWins,
      (SELECT MAX(created_at) FROM all_run_submissions) AS latestRunAt;

    SELECT
      discord_user_id AS discordUserId,
      display_name AS displayName,
      platform,
      total_sessions AS totalSessions,
      high_score AS highScore,
      highest_level AS highestLevel,
      current_streak AS currentStreak,
      longest_streak AS longestStreak,
      last_play_date AS lastPlayDate,
      total_runs AS totalRuns,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM all_player_stats
    ${playerWhere}
    ORDER BY high_score DESC, highest_level DESC, updated_at DESC;

    SELECT COUNT(*) AS filteredRuns
    FROM all_run_submissions AS r
    LEFT JOIN all_player_stats AS p ON p.discord_user_id = r.discord_user_id
    ${runWhere};

    SELECT
      r.submission_id AS submissionId,
      r.discord_user_id AS discordUserId,
      COALESCE(p.display_name, 'Unknown player') AS displayName,
      p.platform,
      r.score,
      r.level,
      r.won,
      r.game_version AS gameVersion,
      r.created_at AS createdAt
    FROM all_run_submissions AS r
    LEFT JOIN all_player_stats AS p ON p.discord_user_id = r.discord_user_id
    ${runWhere}
    ORDER BY r.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset};
  `;

  const { stdout } = await executeFile(
    process.execPath,
    [
      wranglerCli,
      'd1',
      'execute',
      databaseName,
      '--remote',
      '--json',
      '--yes',
      '--command',
      sql,
    ],
    {
      cwd: projectDirectory,
      maxBuffer: 25 * 1024 * 1024,
      timeout: 45_000,
      windowsHide: true,
    },
  );

  const resultSets = JSON.parse(stdout);
  if (!Array.isArray(resultSets) || resultSets.length < 4 || resultSets.some((set) => !set.success)) {
    throw new Error('Cloudflare returned an unexpected database response.');
  }

  const summary = resultSets[0].results?.[0] ?? {
    totalPlayers: 0,
    totalRuns: 0,
    bestScore: 0,
    totalWins: 0,
    latestRunAt: null,
  };
  const players = resultSets[1].results ?? [];
  const filteredRuns = Number(resultSets[2].results?.[0]?.filteredRuns ?? 0);
  const runs = resultSets[3].results ?? [];

  return {
    summary,
    players,
    runs,
    pagination: { page, pageSize, totalRuns: filteredRuns },
  };
}

function buildPlayerWhere(search) {
  if (!search) {
    return '';
  }
  const term = sqlSearchLiteral(search);
  return `WHERE instr(lower(display_name), ${term}) > 0
    OR instr(discord_user_id, ${term}) > 0
    OR instr(platform, ${term}) > 0`;
}

function buildRunWhere(search) {
  if (!search) {
    return '';
  }
  const term = sqlSearchLiteral(search);
  return `WHERE instr(lower(COALESCE(p.display_name, '')), ${term}) > 0
    OR instr(r.discord_user_id, ${term}) > 0
    OR instr(lower(r.submission_id), ${term}) > 0
    OR instr(p.platform, ${term}) > 0`;
}

function sqlSearchLiteral(search) {
  // Literal substring search supports full player hashes without D1's LIKE pattern-length limit.
  return `'${search.toLowerCase().replaceAll("'", "''")}'`;
}

function readableError(error) {
  const details = [error?.stderr, error?.stdout, error?.message]
    .filter(Boolean)
    .join('\n')
    .replaceAll(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .trim();

  if (/not authenticated|not logged in|CLOUDFLARE_API_TOKEN|wrangler login|oauth token/i.test(details)) {
    return 'Cloudflare login is required. In PowerShell, open the DiscordActivity folder and run: npx wrangler login';
  }
  if (/timed out|timeout/i.test(details)) {
    return 'Cloudflare took too long to respond. Check your internet connection and refresh.';
  }
  return details.slice(0, 800) || 'The live database could not be loaded.';
}

function sendHtml(response, html) {
  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    'Content-Type': 'text/html; charset=utf-8',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(html);
}

function sendJson(response, value, status = 200) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

function openBrowser(url) {
  let command;
  let args;

  if (process.platform === 'win32') {
    command = 'rundll32.exe';
    args = ['url.dll,FileProtocolHandler', url];
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  const browser = spawn(command, args, { detached: true, stdio: 'ignore' });
  browser.on('error', () => {});
  browser.unref();
}

const dashboardHtml = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Snake Adventures | Live Player Database</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #e8f0ec;
      background: #071018;
      --ink: #e8f0ec;
      --muted: #829a91;
      --panel: rgb(10 21 29 / 92%);
      --line: rgb(119 219 193 / 25%);
      --mint: #77dbc1;
      --green: #6ac978;
      --gold: #f0d18a;
      --violet: #b29bc5;
      --danger: #ef8c8c;
    }

    * { box-sizing: border-box; }
    html { min-width: 320px; min-height: 100%; }
    body {
      min-height: 100vh;
      margin: 0;
      background:
        radial-gradient(circle at 10% 8%, rgb(42 105 88 / 24%), transparent 30rem),
        radial-gradient(circle at 92% 78%, rgb(93 47 127 / 24%), transparent 36rem),
        linear-gradient(145deg, #071018, #12131f 58%, #0a1718);
    }

    body::before {
      position: fixed;
      inset: 0;
      z-index: -1;
      content: "";
      opacity: 0.16;
      background-image:
        linear-gradient(rgb(112 224 201 / 14%) 1px, transparent 1px),
        linear-gradient(90deg, rgb(112 224 201 / 14%) 1px, transparent 1px);
      background-size: 42px 42px;
      mask-image: linear-gradient(to bottom, transparent, black 22%, black 80%, transparent);
    }

    button, input, select { font: inherit; }
    button, select { cursor: pointer; }

    .shell {
      width: min(1480px, calc(100% - 36px));
      margin: 0 auto;
      padding: 28px 0 40px;
    }

    .masthead {
      display: flex;
      align-items: center;
      gap: 14px;
      min-height: 76px;
      padding: 14px 18px;
      border: 1px solid var(--line);
      background: linear-gradient(90deg, rgb(17 31 39 / 96%), rgb(27 24 43 / 94%));
      box-shadow: 0 18px 45px rgb(0 0 0 / 28%);
    }

    .snake-mark {
      position: relative;
      width: 54px;
      height: 36px;
      flex: 0 0 auto;
    }

    .snake-mark span {
      position: absolute;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #4ea565;
      box-shadow: inset 0 -2px 0 rgb(0 0 0 / 16%);
    }

    .snake-mark span:nth-child(1) { left: 0; top: 18px; }
    .snake-mark span:nth-child(2) { left: 10px; top: 14px; }
    .snake-mark span:nth-child(3) { left: 20px; top: 9px; }
    .snake-mark span:nth-child(4) { left: 30px; top: 11px; }
    .snake-mark span:nth-child(5) {
      left: 39px;
      top: 6px;
      width: 16px;
      height: 16px;
      background: var(--green);
    }

    .brand { min-width: 0; }
    .eyebrow {
      margin: 0 0 3px;
      color: var(--mint);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.22em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font: 700 clamp(21px, 3vw, 30px) Georgia, serif;
      letter-spacing: 0.025em;
    }

    .live-state {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 9px;
      color: #b9cbc4;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.12em;
      white-space: nowrap;
    }

    .light {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--gold);
      box-shadow: 0 0 13px var(--gold);
    }

    .light.live { background: var(--green); box-shadow: 0 0 13px var(--green); }
    .light.error { background: var(--danger); box-shadow: 0 0 13px var(--danger); }

    .toolbar {
      display: grid;
      grid-template-columns: minmax(240px, 1fr) auto auto;
      gap: 10px;
      align-items: end;
      margin: 16px 0;
    }

    label span, .field-label {
      display: block;
      margin: 0 0 6px;
      color: var(--muted);
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.17em;
      text-transform: uppercase;
    }

    input, select, button {
      min-height: 42px;
      color: var(--ink);
      border: 1px solid var(--line);
      border-radius: 2px;
      background: rgb(10 21 29 / 90%);
      outline: none;
    }

    input { width: 100%; padding: 0 13px; }
    select { min-width: 110px; padding: 0 34px 0 12px; }
    button { padding: 0 17px; font-size: 12px; font-weight: 800; letter-spacing: 0.05em; }
    button:hover:not(:disabled), input:focus, select:focus { border-color: var(--mint); }
    button:hover:not(:disabled) { color: #071018; background: var(--mint); }
    button:disabled { cursor: not-allowed; opacity: 0.38; }

    .error-box {
      margin: 0 0 16px;
      padding: 15px 17px;
      border: 1px solid rgb(239 140 140 / 50%);
      border-left: 4px solid var(--danger);
      background: rgb(49 20 28 / 88%);
    }

    .error-box[hidden] { display: none; }
    .error-box strong { display: block; margin-bottom: 5px; color: #ffd4d4; }
    .error-box p { margin: 0; color: #ddbaba; line-height: 1.45; }
    .error-box code { display: inline-block; margin-top: 9px; color: var(--gold); }

    .metrics {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }

    .metric {
      position: relative;
      overflow: hidden;
      min-height: 108px;
      padding: 16px;
      border: 1px solid var(--line);
      background: var(--panel);
      box-shadow: 0 16px 35px rgb(0 0 0 / 18%);
    }

    .metric::after {
      position: absolute;
      right: -22px;
      bottom: -38px;
      width: 100px;
      height: 100px;
      content: "";
      border: 1px solid rgb(119 219 193 / 12%);
      border-radius: 50%;
    }

    .metric span { display: block; color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
    .metric strong { display: block; margin-top: 11px; color: var(--mint); font: 700 30px Georgia, serif; }
    .metric:nth-child(3) strong { color: var(--gold); }
    .metric:nth-child(4) strong { color: var(--violet); }

    .panel {
      margin-top: 12px;
      border: 1px solid var(--line);
      background: var(--panel);
      box-shadow: 0 20px 45px rgb(0 0 0 / 22%);
    }

    .panel-head {
      min-height: 58px;
      padding: 13px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(90deg, rgb(18 34 41 / 84%), rgb(24 23 39 / 76%));
    }

    .panel-head h2 { margin: 0; font: 700 17px Georgia, serif; }
    .panel-head p { margin: 3px 0 0; color: var(--muted); font-size: 11px; }
    .count {
      margin-left: auto;
      padding: 5px 8px;
      color: var(--mint);
      border: 1px solid var(--line);
      font: 800 10px ui-monospace, SFMono-Regular, Consolas, monospace;
      letter-spacing: 0.07em;
      white-space: nowrap;
    }

    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      padding: 11px 13px;
      color: var(--muted);
      border-bottom: 1px solid var(--line);
      font-size: 9px;
      letter-spacing: 0.13em;
      text-align: left;
      text-transform: uppercase;
      white-space: nowrap;
    }

    td { padding: 11px 13px; border-bottom: 1px solid rgb(119 219 193 / 10%); vertical-align: middle; white-space: nowrap; }
    tbody tr:last-child td { border-bottom: 0; }
    tbody tr:hover { background: rgb(119 219 193 / 5%); }
    .numeric { font-variant-numeric: tabular-nums; }
    .score { color: var(--gold); font-weight: 800; }
    .player-name { color: #f2f7f4; font-weight: 700; }
    .subtext { display: block; max-width: 190px; overflow: hidden; color: #627a71; font: 10px ui-monospace, SFMono-Regular, Consolas, monospace; text-overflow: ellipsis; }
    .id-cell { max-width: 190px; overflow: hidden; color: #627a71; font: 10px ui-monospace, SFMono-Regular, Consolas, monospace; text-overflow: ellipsis; }
    .badge { display: inline-block; min-width: 50px; padding: 4px 7px; border: 1px solid; font-size: 9px; font-weight: 900; letter-spacing: 0.09em; text-align: center; }
    .badge.win { color: #a5e6ad; border-color: rgb(106 201 120 / 45%); background: rgb(46 99 55 / 24%); }
    .badge.over { color: #c0aaa8; border-color: rgb(170 126 126 / 32%); background: rgb(88 47 47 / 20%); }
    .empty { padding: 30px 16px; color: var(--muted); text-align: center; }

    .pagination {
      min-height: 58px;
      padding: 10px 13px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 9px;
      border-top: 1px solid var(--line);
    }

    .pagination span { margin-right: auto; color: var(--muted); font-size: 11px; }
    .pagination button { min-height: 34px; padding: 0 12px; }

    footer {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      padding: 15px 3px 0;
      color: #60786f;
      font-size: 10px;
      line-height: 1.5;
    }

    body.loading .panel, body.loading .metrics { opacity: 0.72; }

    @media (max-width: 760px) {
      .shell { width: min(100% - 20px, 1480px); padding-top: 10px; }
      .masthead { align-items: flex-start; }
      .live-state { margin-top: 4px; font-size: 9px; }
      .toolbar { grid-template-columns: 1fr 1fr; }
      .search-field { grid-column: 1 / -1; }
      .toolbar button { width: 100%; }
      .metrics { grid-template-columns: 1fr 1fr; }
      .metric { min-height: 92px; }
      .metric strong { font-size: 25px; }
      footer { display: block; }
    }

    @media (max-width: 460px) {
      .snake-mark { display: none; }
      .live-state { align-self: center; }
      .live-state span:last-child { display: none; }
      .toolbar { grid-template-columns: 1fr; }
      .search-field { grid-column: auto; }
      .metrics { gap: 7px; }
      .metric { padding: 13px; }
      .panel-head { align-items: flex-start; }
      .count { margin-top: 1px; }
      .pagination { flex-wrap: wrap; }
      .pagination span { width: 100%; margin: 0 0 2px; }
    }
  </style>
</head>
<body class="loading">
  <main class="shell">
    <header class="masthead">
      <div class="snake-mark" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
      <div class="brand">
        <p class="eyebrow">Snake Adventures / Cloudflare D1</p>
        <h1>Live Player Database</h1>
      </div>
      <div class="live-state" aria-live="polite">
        <span class="light" id="status-light"></span>
        <span id="status-label">CONNECTING</span>
      </div>
    </header>

    <section class="toolbar" aria-label="Database controls">
      <label class="search-field">
        <span>Search name, player ID, submission ID, or platform (browser/windows/discord)</span>
        <input id="search" type="search" placeholder="Search the live database..." autocomplete="off">
      </label>
      <label>
        <span>Runs per page</span>
        <select id="page-size">
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100" selected>100</option>
          <option value="250">250</option>
        </select>
      </label>
      <div>
        <span class="field-label">Last sync</span>
        <button id="refresh" type="button">Refresh now</button>
      </div>
    </section>

    <section class="error-box" id="error-box" hidden>
      <strong>Could not read the live database</strong>
      <p id="error-message"></p>
      <code id="error-help">npx wrangler login</code>
    </section>

    <section class="metrics" aria-label="Live database totals">
      <article class="metric"><span>Total players</span><strong id="total-players">--</strong></article>
      <article class="metric"><span>Submitted runs</span><strong id="total-runs">--</strong></article>
      <article class="metric"><span>Best score</span><strong id="best-score">--</strong></article>
      <article class="metric"><span>Wins recorded</span><strong id="total-wins">--</strong></article>
    </section>

    <section class="panel">
      <header class="panel-head">
        <div>
          <h2>Players</h2>
          <p>Discord accounts and named browser/Windows players. Display names are self-reported.</p>
        </div>
        <span class="count" id="player-count">0 RECORDS</span>
      </header>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Player</th><th>High score</th><th>Level</th><th>Runs</th><th>Streak</th><th>Last played</th><th>Updated</th></tr></thead>
          <tbody id="players-body"><tr><td class="empty" colspan="7">Loading player records...</td></tr></tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <div>
          <h2>Run Log</h2>
          <p>Completed runs across Discord, browser, and Windows, newest first</p>
        </div>
        <span class="count" id="run-count">0 RUNS</span>
      </header>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Submitted</th><th>Player</th><th>Score</th><th>Level</th><th>Result</th><th>Version</th><th>Submission ID</th></tr></thead>
          <tbody id="runs-body"><tr><td class="empty" colspan="7">Loading run history...</td></tr></tbody>
        </table>
      </div>
      <div class="pagination">
        <span id="page-summary">Waiting for live data...</span>
        <button id="previous" type="button" disabled>Previous</button>
        <button id="next" type="button" disabled>Next</button>
      </div>
    </section>

    <footer>
      <span>Private local viewer. Data is read from the remote production D1 database through your Cloudflare login.</span>
      <span id="sync-time">Auto-refreshes every 30 seconds.</span>
    </footer>
  </main>

  <script>
    const numberFormat = new Intl.NumberFormat();
    const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
    const autoRefreshMilliseconds = 30_000;
    const state = { page: 1, pageSize: 100, search: '', totalPages: 1 };
    let refreshTimer;
    let searchTimer;
    let requestNumber = 0;

    const elements = {
      bestScore: document.querySelector('#best-score'),
      errorBox: document.querySelector('#error-box'),
      errorHelp: document.querySelector('#error-help'),
      errorMessage: document.querySelector('#error-message'),
      next: document.querySelector('#next'),
      pageSize: document.querySelector('#page-size'),
      pageSummary: document.querySelector('#page-summary'),
      playerCount: document.querySelector('#player-count'),
      playersBody: document.querySelector('#players-body'),
      previous: document.querySelector('#previous'),
      refresh: document.querySelector('#refresh'),
      runCount: document.querySelector('#run-count'),
      runsBody: document.querySelector('#runs-body'),
      search: document.querySelector('#search'),
      statusLabel: document.querySelector('#status-label'),
      statusLight: document.querySelector('#status-light'),
      syncTime: document.querySelector('#sync-time'),
      totalPlayers: document.querySelector('#total-players'),
      totalRuns: document.querySelector('#total-runs'),
      totalWins: document.querySelector('#total-wins'),
    };

    elements.refresh.addEventListener('click', () => loadData());
    elements.pageSize.addEventListener('change', () => {
      state.pageSize = Number(elements.pageSize.value);
      state.page = 1;
      loadData();
    });
    elements.search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = elements.search.value.trim();
        state.page = 1;
        loadData();
      }, 400);
    });
    elements.previous.addEventListener('click', () => {
      if (state.page > 1) {
        state.page -= 1;
        loadData();
      }
    });
    elements.next.addEventListener('click', () => {
      if (state.page < state.totalPages) {
        state.page += 1;
        loadData();
      }
    });

    async function loadData() {
      clearTimeout(refreshTimer);
      const currentRequest = ++requestNumber;
      setLoading(true);

      try {
        const query = new URLSearchParams({
          q: state.search,
          page: String(state.page),
          pageSize: String(state.pageSize),
        });
        const response = await fetch('/api/data?' + query);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'The database request failed.');
        }
        if (currentRequest !== requestNumber) return;

        renderSummary(payload.summary);
        renderPlayers(payload.players);
        renderRuns(payload.runs, payload.pagination);
        elements.errorBox.hidden = true;
        setStatus('LIVE / AUTO 30S', 'live');
        const now = new Date();
        elements.syncTime.textContent = 'Synced ' + dateTimeFormat.format(now) + '. Auto-refreshes every 30 seconds.';
      } catch (error) {
        if (currentRequest !== requestNumber) return;
        const localServiceStopped = error instanceof TypeError && /fetch/i.test(error.message);
        elements.errorMessage.textContent = localServiceStopped
          ? 'The local dashboard service stopped. Open the launcher file again.'
          : error.message;
        elements.errorHelp.textContent = localServiceStopped
          ? 'Open Live Player Database.cmd'
          : 'npx wrangler login';
        elements.errorBox.hidden = false;
        setStatus('CONNECTION ERROR', 'error');
      } finally {
        if (currentRequest === requestNumber) {
          setLoading(false);
          refreshTimer = setTimeout(loadData, autoRefreshMilliseconds);
        }
      }
    }

    function renderSummary(summary) {
      elements.totalPlayers.textContent = formatNumber(summary.totalPlayers);
      elements.totalRuns.textContent = formatNumber(summary.totalRuns);
      elements.bestScore.textContent = formatNumber(summary.bestScore);
      elements.totalWins.textContent = formatNumber(summary.totalWins);
    }

    function renderPlayers(players) {
      elements.playersBody.replaceChildren();
      elements.playerCount.textContent = formatNumber(players.length) + ' RECORDS';
      if (!players.length) {
        elements.playersBody.append(emptyRow('No players match this search.', 7));
        return;
      }

      for (const player of players) {
        const row = document.createElement('tr');
        row.append(
          playerCell(player.displayName, player.discordUserId, player.platform, player.totalSessions),
          tableCell(formatNumber(player.highScore), 'score numeric'),
          tableCell(formatNumber(player.highestLevel), 'numeric'),
          tableCell(formatNumber(player.totalRuns), 'numeric'),
          tableCell(player.currentStreak === null ? '—' : formatNumber(player.currentStreak) + ' current / ' + formatNumber(player.longestStreak) + ' best', 'numeric'),
          tableCell(formatDate(player.lastPlayDate)),
          tableCell(formatDateTime(player.updatedAt)),
        );
        elements.playersBody.append(row);
      }
    }

    function renderRuns(runs, pagination) {
      elements.runsBody.replaceChildren();
      state.page = pagination.page;
      state.pageSize = pagination.pageSize;
      state.totalPages = Math.max(1, Math.ceil(pagination.totalRuns / pagination.pageSize));
      elements.runCount.textContent = formatNumber(pagination.totalRuns) + ' RUNS';

      if (!runs.length) {
        elements.runsBody.append(emptyRow('No run submissions match this search.', 7));
      } else {
        for (const run of runs) {
          const result = document.createElement('span');
          result.className = 'badge ' + (Number(run.won) === 1 ? 'win' : 'over');
          result.textContent = Number(run.won) === 1 ? 'WIN' : 'OVER';

          const resultCell = document.createElement('td');
          resultCell.append(result);
          const submissionCell = tableCell(run.submissionId, 'id-cell');
          submissionCell.title = run.submissionId;

          const row = document.createElement('tr');
          row.append(
            tableCell(formatDateTime(run.createdAt)),
            playerCell(run.displayName, run.discordUserId, run.platform),
            tableCell(formatNumber(run.score), 'score numeric'),
            tableCell(formatNumber(run.level), 'numeric'),
            resultCell,
            tableCell(run.gameVersion),
            submissionCell,
          );
          elements.runsBody.append(row);
        }
      }

      const first = pagination.totalRuns ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
      const last = Math.min(pagination.totalRuns, pagination.page * pagination.pageSize);
      elements.pageSummary.textContent = 'Showing ' + formatNumber(first) + '-' + formatNumber(last) + ' of ' + formatNumber(pagination.totalRuns) + ' runs';
      elements.previous.disabled = pagination.page <= 1;
      elements.next.disabled = pagination.page >= state.totalPages;
    }

    function playerCell(name, id, platform, sessions) {
      const cell = document.createElement('td');
      const playerName = document.createElement('span');
      const playerId = document.createElement('span');
      playerName.className = 'player-name';
      playerName.textContent = name || 'Unknown player';
      playerId.className = 'subtext';
      playerId.textContent = id;
      playerId.title = id;
      const source = document.createElement('span');
      source.className = 'subtext';
      source.textContent = (platform || 'discord').toUpperCase() +
        (platform === 'discord' ? ' / verified account' : ' / chosen name') +
        (sessions == null ? '' : ' / ' + formatNumber(sessions) + ' visits');
      cell.append(playerName, source, playerId);
      return cell;
    }

    function tableCell(value, className = '') {
      const cell = document.createElement('td');
      cell.className = className;
      cell.textContent = value ?? '--';
      return cell;
    }

    function emptyRow(message, columns) {
      const row = document.createElement('tr');
      const cell = tableCell(message, 'empty');
      cell.colSpan = columns;
      row.append(cell);
      return row;
    }

    function formatNumber(value) {
      return numberFormat.format(Number(value) || 0);
    }

    function formatDate(value) {
      if (!value) return '--';
      const date = new Date(String(value) + 'T00:00:00Z');
      return Number.isNaN(date.getTime()) ? String(value) : dateFormat.format(date);
    }

    function formatDateTime(value) {
      if (!value) return '--';
      const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
      const date = new Date(normalized.endsWith('Z') ? normalized : normalized + 'Z');
      return Number.isNaN(date.getTime()) ? String(value) : dateTimeFormat.format(date);
    }

    function setLoading(loading) {
      document.body.classList.toggle('loading', loading);
      elements.refresh.disabled = loading;
      if (loading) setStatus('SYNCING REMOTE D1', '');
    }

    function setStatus(label, stateClass) {
      elements.statusLabel.textContent = label;
      elements.statusLight.className = 'light' + (stateClass ? ' ' + stateClass : '');
    }

    loadData();
  </script>
</body>
</html>`;
