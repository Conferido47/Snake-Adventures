import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const COVER_WIDTH = 1920;
const COVER_HEIGHT = 1080;
const BOT_BANNER_WIDTH = 1700;
const BOT_BANNER_HEIGHT = 600;
const PRESENCE_SIZE = 1024;
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 360;
const VIDEO_FRAME_RATE = 12;
const VIDEO_OUTPUT_FRAME_RATE = 24;
const VIDEO_DURATION_SECONDS = 9;
const VIDEO_FRAME_COUNT = VIDEO_FRAME_RATE * VIDEO_DURATION_SECONDS;
const MAX_VIDEO_BYTES = 1_000_000;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = join(root, 'store-assets', 'discord-activity');
const botOutputDirectory = join(root, 'store-assets', 'discord-bot');
const presenceOutputDirectory = join(root, 'store-assets', 'discord-rich-presence');
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'snake-activity-art-'));
const framesDirectory = join(temporaryDirectory, 'frames');
const chromeProfileDirectory = join(temporaryDirectory, 'chrome-profile');
const coverSvgPath = join(outputDirectory, 'snake-adventures-cover-1920x1080.svg');
const coverPngPath = join(outputDirectory, 'snake-adventures-cover-1920x1080.png');
const backgroundSvgPath = join(
  outputDirectory,
  'snake-adventures-embedded-background-1920x1080.svg',
);
const backgroundPngPath = join(
  outputDirectory,
  'snake-adventures-embedded-background-1920x1080.png',
);
const videoPath = join(outputDirectory, 'snake-adventures-video-preview-640x360.mp4');
const botBannerSvgPath = join(botOutputDirectory, 'snake-adventures-bot-banner-1700x600.svg');
const botBannerPngPath = join(botOutputDirectory, 'snake-adventures-bot-banner-1700x600.png');
const presenceAssets = [
  { id: 'snake-adventures', title: 'Snake Adventures', accent: '#73dfc3', secondary: '#5fae58' },
  { id: 'wren', title: 'Wren', accent: '#55b39e', secondary: '#bc843a' },
  { id: 'phantom-fruit', title: 'Phantom Fruit', accent: '#b167e2', secondary: '#ffd34c' },
  { id: 'hollow-king', title: 'The Hollow King', accent: '#c36be0', secondary: '#d5a743' },
];

const CLASSIC = {
  head: '#aceb5d',
  body: '#66c35f',
  accent: '#398f77',
  highlight: '#d7ff8d',
  outline: '#173f2c',
  eye: '#0c2117',
};
const POWERED = {
  head: '#ffdc46',
  body: '#f49b33',
  accent: '#fff0a1',
  highlight: '#fff7cf',
  outline: '#713914',
  eye: '#38210f',
};

mkdirSync(outputDirectory, { recursive: true });
mkdirSync(botOutputDirectory, { recursive: true });
mkdirSync(presenceOutputDirectory, { recursive: true });
mkdirSync(framesDirectory, { recursive: true });

const chrome = findChrome();
const magick = findExecutable(
  process.env.MAGICK_PATH,
  process.platform === 'win32' ? 'magick.exe' : 'magick',
  'ImageMagick is required to render the video frames.',
);
const ffmpeg = findFfmpeg();

try {
  writeFileSync(coverSvgPath, renderCoverArt(), 'utf8');
  writeFileSync(backgroundSvgPath, renderEmbeddedBackground(), 'utf8');
  renderSvgWithChrome(coverSvgPath, coverPngPath, COVER_WIDTH, COVER_HEIGHT);
  renderSvgWithChrome(backgroundSvgPath, backgroundPngPath, COVER_WIDTH, COVER_HEIGHT);
  assertPngDimensions(coverPngPath, COVER_WIDTH, COVER_HEIGHT);
  assertPngDimensions(backgroundPngPath, COVER_WIDTH, COVER_HEIGHT);
  console.log(fileSummary('Cover art', coverPngPath));
  console.log(fileSummary('Embedded background', backgroundPngPath));

  writeFileSync(botBannerSvgPath, renderBotBanner(), 'utf8');
  renderSvgWithChrome(
    botBannerSvgPath,
    botBannerPngPath,
    BOT_BANNER_WIDTH,
    BOT_BANNER_HEIGHT,
  );
  assertPngDimensions(botBannerPngPath, BOT_BANNER_WIDTH, BOT_BANNER_HEIGHT);
  console.log(fileSummary('Bot banner', botBannerPngPath));

  for (const asset of presenceAssets) {
    const svgPath = join(presenceOutputDirectory, `${asset.id}.svg`);
    const pngPath = join(presenceOutputDirectory, `${asset.id}.png`);
    writeFileSync(svgPath, renderRichPresenceAsset(asset), 'utf8');
    renderSvgWithChrome(svgPath, pngPath, PRESENCE_SIZE, PRESENCE_SIZE);
    assertPngDimensions(pngPath, PRESENCE_SIZE, PRESENCE_SIZE);
    console.log(fileSummary(`Rich Presence ${asset.title}`, pngPath));
  }

  const framePaths = [];
  for (let index = 0; index < VIDEO_FRAME_COUNT; index += 1) {
    const framePath = join(framesDirectory, `frame-${String(index).padStart(4, '0')}.svg`);
    writeFileSync(framePath, renderPreviewFrame(index), 'utf8');
    framePaths.push(framePath);
  }
  renderVideoFrames(framePaths);
  encodeVideo(30);
  if (statSync(videoPath).size >= MAX_VIDEO_BYTES) {
    encodeVideo(34);
  }
  if (statSync(videoPath).size >= MAX_VIDEO_BYTES) {
    throw new Error(
      `Video is ${formatBytes(statSync(videoPath).size)}; Discord requires a file under 1 MB.`,
    );
  }
  verifyVideo();
  console.log(fileSummary('Video preview', videoPath));
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

function renderCoverArt() {
  const snakePoints = [
    [1530, 790], [1432, 814], [1332, 805], [1235, 770], [1137, 746],
    [1037, 754], [940, 786], [840, 818], [740, 822], [640, 799],
    [540, 770], [440, 748], [340, 756],
  ];

  return svgDocument(COVER_WIDTH, COVER_HEIGHT, 'Snake Adventures cover art', `
    ${coverDefs()}
    <rect width="1920" height="1080" fill="#05080d"/>
    <rect x="28" y="28" width="1864" height="1024" rx="24" fill="url(#coverBackground)"/>
    <rect x="28" y="28" width="1864" height="1024" rx="24" fill="url(#coverGrid)"/>
    <path d="M28 802 630 28h196L224 1052H28Z" fill="#6fe0c9" opacity="0.035"/>
    <path d="M1892 241 1530 1052h-210l362-1024h210Z" fill="#b267e2" opacity="0.045"/>
    ${stoneBorder(COVER_WIDTH, COVER_HEIGHT)}
    ${particles(COVER_WIDTH, COVER_HEIGHT, 46, 17, '#9cf7dc', 0.38)}
    <ellipse cx="955" cy="435" rx="705" ry="360" fill="url(#titleHalo)"/>
    <ellipse cx="1498" cy="516" rx="330" ry="360" fill="url(#kingHalo)"/>
    <ellipse cx="318" cy="548" rx="265" ry="330" fill="url(#wrenHalo)"/>

    <g filter="url(#deepShadow)">
      ${wrenSvg(195, 410, 235, false)}
      ${kingSvg(1430, 390, 300, false)}
    </g>

    <g font-family="Segoe UI, Arial, sans-serif" text-anchor="middle">
      <text x="960" y="112" fill="#84e7cf" font-size="25" font-weight="800" letter-spacing="10">A DARK ARCADE ADVENTURE</text>
      <rect x="842" y="142" width="172" height="7" fill="#68dbc1"/>
      <rect x="1025" y="142" width="53" height="7" fill="#f2cb69"/>
    </g>
    <g text-anchor="middle" filter="url(#titleShadow)">
      <text x="960" y="324" fill="url(#snakeTitle)" font-family="Georgia, serif" font-size="190" font-weight="900" letter-spacing="10">SNAKE</text>
      <text x="960" y="419" fill="url(#adventureTitle)" font-family="Segoe UI, Arial, sans-serif" font-size="76" font-weight="900" letter-spacing="22">ADVENTURES</text>
    </g>
    <g font-family="Segoe UI, Arial, sans-serif" text-anchor="middle">
      <text x="960" y="485" fill="#d9e8e2" font-size="25" font-weight="700" letter-spacing="7">EAT // EVADE // ENCLOSE</text>
      <text x="960" y="525" fill="#8ea49f" font-size="18" font-weight="700" letter-spacing="4">OUTRUN WREN. HARNESS THE PHANTOM. SURROUND THE KING.</text>
    </g>

    <g filter="url(#deepShadow)">
      ${snakeSvg(snakePoints, 98, CLASSIC, 'right')}
    </g>
    ${appleSvg(728, 598, 78)}
    ${phantomFruitSvg(1205, 545, 96, 0)}
    <g opacity="0.82">
      ${crescentSvg(1690, 690, 95, -24)}
    </g>

    <g font-family="Segoe UI, Arial, sans-serif" font-weight="800" letter-spacing="4">
      <text x="78" y="1008" fill="#8da19c" font-size="17">SINGLE PLAYER // ENDLESS ADVENTURE</text>
      <text x="1842" y="1008" text-anchor="end" fill="#8da19c" font-size="17">SNAKE ADVENTURES // 1.0</text>
    </g>
    ${cornerFrame(COVER_WIDTH, COVER_HEIGHT, '#73dfc3')}
  `);
}

function renderEmbeddedBackground() {
  const leftSnake = [
    [330, 266], [246, 308], [185, 377], [152, 461], [150, 551],
    [175, 640], [235, 708], [319, 745],
  ];
  const rightSnake = [
    [1632, 844], [1705, 791], [1758, 720], [1780, 634], [1774, 548],
  ];

  return svgDocument(COVER_WIDTH, COVER_HEIGHT, 'Snake Adventures embedded background', `
    ${coverDefs()}
    <rect width="1920" height="1080" fill="#05080d"/>
    <rect x="28" y="28" width="1864" height="1024" rx="24" fill="url(#coverBackground)"/>
    <rect x="28" y="28" width="1864" height="1024" rx="24" fill="url(#coverGrid)" opacity="0.72"/>
    ${stoneBorder(COVER_WIDTH, COVER_HEIGHT)}
    ${particles(COVER_WIDTH, COVER_HEIGHT, 40, 73, '#8ef0d6', 0.32)}
    <ellipse cx="190" cy="534" rx="430" ry="560" fill="url(#wrenHalo)"/>
    <ellipse cx="1742" cy="580" rx="460" ry="570" fill="url(#kingHalo)"/>
    <ellipse cx="960" cy="535" rx="690" ry="455" fill="#071016" opacity="0.88"/>
    <ellipse cx="960" cy="535" rx="540" ry="355" fill="#071016" opacity="0.72"/>

    <g filter="url(#deepShadow)">
      ${snakeSvg(leftSnake, 104, CLASSIC, 'up')}
      ${snakeSvg(rightSnake, 96, CLASSIC, 'left')}
      ${wrenSvg(70, 705, 220, false)}
      ${kingSvg(1575, 560, 350, true)}
    </g>
    ${phantomFruitSvg(1660, 170, 126, 1)}
    ${appleSvg(130, 178, 86)}
    ${crescentSvg(1450, 240, 120, 20)}
    ${crescentSvg(1770, 440, 88, -26)}
    ${cornerFrame(COVER_WIDTH, COVER_HEIGHT, '#73dfc3')}
  `);
}

function renderBotBanner() {
  const snakePoints = [
    [1282, 475], [1198, 490], [1114, 478], [1030, 451], [946, 438],
    [862, 452], [778, 480], [694, 500], [610, 494], [526, 470],
    [442, 455], [358, 469],
  ];

  return svgDocument(BOT_BANNER_WIDTH, BOT_BANNER_HEIGHT, 'Snake Adventures bot banner', `
    ${coverDefs()}
    <rect width="1700" height="600" fill="#05080d"/>
    <rect x="18" y="18" width="1664" height="564" rx="24" fill="url(#coverBackground)"/>
    <rect x="18" y="18" width="1664" height="564" rx="24" fill="url(#coverGrid)"/>
    <path d="M18 490 390 18h190L208 582H18Z" fill="#6fe0c9" opacity="0.05"/>
    <path d="M1682 112 1450 582h-230l232-564h230Z" fill="#b267e2" opacity="0.065"/>
    ${particles(1700, 600, 34, 119, '#a7f8e1', 0.34)}
    <ellipse cx="590" cy="270" rx="520" ry="265" fill="url(#titleHalo)"/>
    <ellipse cx="1440" cy="310" rx="330" ry="300" fill="url(#kingHalo)"/>

    <g font-family="Segoe UI, Arial, sans-serif" text-anchor="middle">
      <text x="585" y="94" fill="#84e7cf" font-size="20" font-weight="800" letter-spacing="8">A DARK ARCADE ADVENTURE</text>
      <rect x="500" y="116" width="130" height="6" fill="#68dbc1"/>
      <rect x="640" y="116" width="40" height="6" fill="#f2cb69"/>
    </g>
    <g text-anchor="middle" filter="url(#titleShadow)">
      <text x="585" y="254" fill="url(#snakeTitle)" font-family="Georgia, serif" font-size="150" font-weight="900" letter-spacing="8">SNAKE</text>
      <text x="585" y="329" fill="url(#adventureTitle)" font-family="Segoe UI, Arial, sans-serif" font-size="54" font-weight="900" letter-spacing="16">ADVENTURES</text>
    </g>
    <text x="585" y="374" text-anchor="middle" fill="#d5e5df" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" letter-spacing="5">EAT // EVADE // ENCLOSE</text>

    <g filter="url(#deepShadow)">
      ${wrenSvg(1065, 170, 205, false)}
      ${kingSvg(1370, 105, 300, true)}
      ${snakeSvg(snakePoints, 80, CLASSIC, 'right')}
    </g>
    ${appleSvg(923, 335, 66)}
    ${phantomFruitSvg(1240, 330, 82, 0)}
    ${crescentSvg(1320, 235, 80, -18)}

    <rect x="18" y="18" width="1664" height="564" rx="24" fill="none" stroke="#73dfc3" stroke-opacity="0.4" stroke-width="3"/>
    <rect x="30" y="30" width="1640" height="540" rx="17" fill="none" stroke="#ffffff" stroke-opacity="0.075" stroke-width="2"/>
    <path d="M56 125V56h92M1644 475v69h-92" fill="none" stroke="#73dfc3" stroke-opacity="0.78" stroke-width="6"/>
    <path d="M56 475v69h92M1644 125V56h-92" fill="none" stroke="#e7d181" stroke-opacity="0.4" stroke-width="3"/>
  `);
}

function renderRichPresenceAsset(asset) {
  let artwork;
  if (asset.id === 'snake-adventures') {
    const snakePoints = [
      [744, 278], [650, 242], [548, 247], [452, 281], [381, 342],
      [362, 420], [398, 488], [480, 529], [578, 550], [656, 596],
      [682, 671], [646, 738], [566, 780], [469, 791], [374, 768], [296, 717],
    ];
    artwork = `${snakeSvg(snakePoints, 102, CLASSIC, 'right')}${appleSvg(459, 391, 128)}`;
  } else if (asset.id === 'wren') {
    artwork = wrenSvg(202, 185, 620, false);
  } else if (asset.id === 'phantom-fruit') {
    artwork = `<ellipse cx="512" cy="512" rx="340" ry="340" fill="#b167e2" opacity="0.12"/>
      <ellipse cx="512" cy="512" rx="270" ry="270" fill="none" stroke="#ffd34c" stroke-opacity="0.25" stroke-width="18" stroke-dasharray="34 28"/>
      ${phantomFruitSvg(252, 252, 520, 0)}`;
  } else {
    artwork = kingSvg(172, 145, 680, true);
  }

  return svgDocument(PRESENCE_SIZE, PRESENCE_SIZE, `${asset.title} Rich Presence asset`, `
    ${presenceDefs(asset.accent, asset.secondary)}
    <rect width="1024" height="1024" fill="#05080d"/>
    <rect x="24" y="24" width="976" height="976" rx="76" fill="url(#presenceBackground)"/>
    <rect x="24" y="24" width="976" height="976" rx="76" fill="url(#presenceGrid)"/>
    <ellipse cx="512" cy="500" rx="450" ry="450" fill="url(#presenceHalo)"/>
    ${particles(1024, 1024, 28, asset.id.length * 29, '#d9fff3', 0.3)}
    <g filter="url(#presenceShadow)">${artwork}</g>
    <rect x="128" y="900" width="520" height="18" fill="${asset.accent}" opacity="0.82"/>
    <rect x="666" y="900" width="152" height="18" fill="${asset.secondary}" opacity="0.9"/>
    <rect x="24" y="24" width="976" height="976" rx="76" fill="none" stroke="${asset.accent}" stroke-opacity="0.48" stroke-width="8"/>
    <rect x="45" y="45" width="934" height="934" rx="59" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="4"/>
    <path d="M82 202V82h120M942 822v120H822" fill="none" stroke="${asset.accent}" stroke-opacity="0.78" stroke-width="12"/>
  `);
}

function renderPreviewFrame(index) {
  const time = (index + 0.5) / VIDEO_FRAME_RATE;
  const scene = time < 1.5
    ? titleScene(time)
    : time < 3.75
      ? chaseScene(time - 1.5)
      : time < 5.6
        ? phantomScene(time - 3.75)
        : time < 7.65
          ? bossScene(time - 5.6)
          : endScene(time - 7.65);

  return svgDocument(VIDEO_WIDTH, VIDEO_HEIGHT, `Snake Adventures preview frame ${index}`, `
    ${videoDefs()}
    ${scene}
    ${transitionFlash(time)}
    <rect x="5" y="5" width="630" height="350" fill="none" stroke="#9bf7de" stroke-opacity="0.25"/>
    <rect width="640" height="360" fill="url(#scanlines)" opacity="0.2" pointer-events="none"/>
  `);
}

function titleScene(time) {
  const reveal = easeOut(clamp(time / 0.55));
  const titleScale = 0.88 + reveal * 0.12;
  const snakePoints = Array.from({ length: 12 }, (_, index) => [
    548 - index * 43 + time * 10,
    282 + Math.sin(index * 0.72 - time * 4.2) * 13,
  ]);

  return `
    ${videoBackdrop('#64dabe', '#2d1740', time)}
    <ellipse cx="320" cy="170" rx="260" ry="160" fill="url(#videoHalo)" opacity="0.54"/>
    ${particles(640, 360, 20, 31, '#a3f9df', 0.42, time * 16)}
    <g opacity="${format(reveal)}" transform="translate(${format(320 * (1 - titleScale))} ${format(175 * (1 - titleScale))}) scale(${format(titleScale)})" text-anchor="middle">
      <text x="320" y="137" fill="url(#videoTitle)" font-family="Georgia, serif" font-size="88" font-weight="900" letter-spacing="5" filter="url(#videoShadow)">SNAKE</text>
      <text x="320" y="190" fill="#6fe0c9" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="900" letter-spacing="10">ADVENTURES</text>
      <text x="320" y="224" fill="#d3e3dd" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="800" letter-spacing="3">A DARK ARCADE ADVENTURE</text>
    </g>
    <g opacity="${format(clamp((time - 0.28) / 0.4))}" filter="url(#videoShadow)">
      ${wrenSvg(31, 191, 85, false)}
      ${kingSvg(527, 178, 104, false)}
      ${snakeSvg(snakePoints, 39, CLASSIC, 'right')}
    </g>
  `;
}

function chaseScene(time) {
  const headX = 222 + time * 100;
  const snakePoints = Array.from({ length: 10 }, (_, index) => [
    headX - index * 28,
    199 + Math.sin(time * 4.2 - index * 0.55) * 34,
  ]);
  const wrenX = 548 - time * 34;
  const wrenY = 103 + Math.sin(time * 3.4) * 28;
  const score = 70 + Math.floor(time * 3.5) * 10;

  return `
    ${boardScene('#6fe0c9')}
    ${gameHeader(score, 1, 'WREN IS HUNTING')}
    ${appleSvg(475, 225, 31)}
    ${appleSvg(115, 94, 25)}
    ${snakeSvg(snakePoints, 28, CLASSIC, 'right')}
    ${wrenSvg(wrenX, wrenY, 63, false)}
    <g font-family="Segoe UI, Arial, sans-serif" font-weight="900">
      <rect x="34" y="283" width="300" height="47" fill="#071116" fill-opacity="0.88" stroke="#6fe0c9" stroke-opacity="0.45"/>
      <text x="51" y="313" fill="#f3faf6" font-size="22" letter-spacing="2.5">EAT. GROW. SURVIVE.</text>
    </g>
  `;
}

function phantomScene(time) {
  const headX = 264 + time * 122;
  const snakePoints = Array.from({ length: 11 }, (_, index) => [
    headX - index * 27,
    205 + Math.sin(time * 5 - index * 0.52) * 26,
  ]);
  const pulse = 1 + Math.sin(time * 9) * 0.12;
  const wrenX = 515 - time * 24;

  return `
    ${boardScene('#b167e2', '#21152f')}
    ${gameHeader(275, 3, `PHANTOM ${Math.max(0, 5 - time).toFixed(1)}s`)}
    <ellipse cx="210" cy="181" rx="100" ry="100" fill="#a65ce2" opacity="0.12"/>
    <g transform="translate(${format(210 * (1 - pulse))} ${format(181 * (1 - pulse))}) scale(${format(pulse)})">
      ${phantomFruitSvg(184, 155, 52, Math.floor(time * 8))}
    </g>
    ${snakeSvg(snakePoints, 28, POWERED, 'right')}
    ${wrenSvg(wrenX, 152 + Math.sin(time * 5) * 25, 61, true)}
    <g font-family="Segoe UI, Arial, sans-serif" font-weight="900">
      <text x="320" y="306" text-anchor="middle" fill="#fff0a1" font-size="29" letter-spacing="5" filter="url(#videoShadow)">TURN THE HUNT</text>
      <text x="320" y="329" text-anchor="middle" fill="#d9c5eb" font-size="11" letter-spacing="2.5">PHANTOM POWER MAKES WREN VULNERABLE</text>
    </g>
  `;
}

function bossScene(time) {
  const ringRadius = 116 - clamp(time / 1.8) * 37;
  const coilPoints = [
    [343, 88], [304, 88], [266, 101], [235, 126], [218, 160], [216, 201],
    [231, 239], [261, 267], [300, 282], [342, 284], [383, 276], [421, 258],
    [451, 229], [469, 193], [470, 153], [457, 117],
  ];
  const slashX = 598 - (time * 190) % 430;
  const enclosed = time > 0.75;

  return `
    ${boardScene('#ff9b55', '#17131f')}
    ${gameHeader(500, 5, enclosed ? 'CONSTRICTING' : 'HOLLOW KING')}
    <ellipse cx="351" cy="184" rx="${format(ringRadius)}" ry="${format(ringRadius)}" fill="#ffd34c" fill-opacity="${enclosed ? '0.11' : '0.04'}" stroke="${enclosed ? '#ffd34c' : '#ff704f'}" stroke-width="3" stroke-dasharray="${enclosed ? '0' : '8 6'}"/>
    ${kingSvg(300, 133, 112, time % 0.75 < 0.35)}
    ${snakeSvg(coilPoints, 27, CLASSIC, 'left')}
    ${crescentSvg(slashX, 101 + Math.sin(time * 4) * 44, 52, -18)}
    <g font-family="Segoe UI, Arial, sans-serif" font-weight="900">
      <rect x="28" y="293" width="376" height="40" fill="#090e13" fill-opacity="0.9" stroke="#ff9b55" stroke-opacity="0.5"/>
      <text x="45" y="319" fill="#fff4df" font-size="19" letter-spacing="2">SURROUND THE HOLLOW KING</text>
    </g>
  `;
}

function endScene(time) {
  const reveal = easeOut(clamp(time / 0.35));
  const snakePoints = Array.from({ length: 13 }, (_, index) => [
    575 - index * 42 + time * 15,
    287 + Math.sin(index * 0.68 - time * 4) * 11,
  ]);

  return `
    ${videoBackdrop('#6fe0c9', '#281638', time + 4)}
    <ellipse cx="320" cy="165" rx="260" ry="164" fill="url(#videoHalo)" opacity="0.58"/>
    ${particles(640, 360, 18, 91, '#b7ffe9', 0.38, time * 18)}
    <g text-anchor="middle" opacity="${format(reveal)}" filter="url(#videoShadow)">
      <text x="320" y="126" fill="url(#videoTitle)" font-family="Georgia, serif" font-size="76" font-weight="900" letter-spacing="4">SNAKE</text>
      <text x="320" y="174" fill="#6fe0c9" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="900" letter-spacing="9">ADVENTURES</text>
    </g>
    <g text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" opacity="${format(clamp((time - 0.2) / 0.4))}">
      <text x="320" y="218" fill="#f2d175" font-size="18" font-weight="900" letter-spacing="4">PLAY NOW IN DISCORD</text>
      <text x="320" y="244" fill="#c9d9d3" font-size="11" font-weight="700" letter-spacing="2.5">EAT // EVADE // ENCLOSE</text>
    </g>
    ${snakeSvg(snakePoints, 37, CLASSIC, 'right')}
  `;
}

function coverDefs() {
  return `<defs>
    <linearGradient id="coverBackground" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#07131a"/>
      <stop offset="0.48" stop-color="#101720"/>
      <stop offset="1" stop-color="#20132c"/>
    </linearGradient>
    <linearGradient id="snakeTitle" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f5fff5"/>
      <stop offset="0.52" stop-color="#b8ef9c"/>
      <stop offset="1" stop-color="#61b95e"/>
    </linearGradient>
    <linearGradient id="adventureTitle" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#58c9b2"/>
      <stop offset="0.5" stop-color="#88efd5"/>
      <stop offset="1" stop-color="#d4b763"/>
    </linearGradient>
    <radialGradient id="titleHalo">
      <stop offset="0" stop-color="#4fba9d" stop-opacity="0.19"/>
      <stop offset="1" stop-color="#4fba9d" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="kingHalo">
      <stop offset="0" stop-color="#9b55d0" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#9b55d0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="wrenHalo">
      <stop offset="0" stop-color="#2f9f85" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#2f9f85" stop-opacity="0"/>
    </radialGradient>
    <pattern id="coverGrid" width="56" height="56" patternUnits="userSpaceOnUse">
      <path d="M56 0H0V56" fill="none" stroke="#9af5dc" stroke-opacity="0.055" stroke-width="2"/>
      <rect x="4" y="4" width="5" height="5" fill="#8be8cf" fill-opacity="0.11"/>
    </pattern>
    <filter id="titleShadow" x="-30%" y="-40%" width="160%" height="190%">
      <feDropShadow dx="0" dy="15" stdDeviation="12" flood-color="#000000" flood-opacity="0.8"/>
      <feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="#76e0c7" flood-opacity="0.2"/>
    </filter>
    <filter id="deepShadow" x="-40%" y="-40%" width="180%" height="190%">
      <feDropShadow dx="0" dy="18" stdDeviation="12" flood-color="#000000" flood-opacity="0.7"/>
    </filter>
  </defs>`;
}

function presenceDefs(accent, secondary) {
  return `<defs>
    <linearGradient id="presenceBackground" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#07151b"/>
      <stop offset="0.55" stop-color="#101820"/>
      <stop offset="1" stop-color="#24152f"/>
    </linearGradient>
    <radialGradient id="presenceHalo">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.34"/>
      <stop offset="0.65" stop-color="${secondary}" stop-opacity="0.09"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="presenceGrid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="#ffffff" stroke-opacity="0.045" stroke-width="2"/>
      <rect x="5" y="5" width="5" height="5" fill="${accent}" fill-opacity="0.14"/>
    </pattern>
    <filter id="presenceShadow" x="-40%" y="-40%" width="180%" height="190%">
      <feDropShadow dx="0" dy="26" stdDeviation="18" flood-color="#000000" flood-opacity="0.72"/>
      <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="${accent}" flood-opacity="0.22"/>
    </filter>
  </defs>`;
}

function videoDefs() {
  return `<defs>
    <linearGradient id="videoBackground" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#07151b"/>
      <stop offset="0.56" stop-color="#101821"/>
      <stop offset="1" stop-color="#24152f"/>
    </linearGradient>
    <linearGradient id="videoTitle" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.55" stop-color="#c9f7b0"/>
      <stop offset="1" stop-color="#66c35f"/>
    </linearGradient>
    <radialGradient id="videoHalo">
      <stop offset="0" stop-color="#5ad0b1" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#5ad0b1" stop-opacity="0"/>
    </radialGradient>
    <pattern id="videoGrid" width="28" height="28" patternUnits="userSpaceOnUse">
      <path d="M28 0H0V28" fill="none" stroke="#8df2d5" stroke-opacity="0.07"/>
    </pattern>
    <pattern id="boardGrid" width="24" height="24" patternUnits="userSpaceOnUse">
      <rect width="24" height="24" fill="#1d2925"/>
      <rect width="12" height="12" fill="#23322c"/>
      <rect x="12" y="12" width="12" height="12" fill="#23322c"/>
      <path d="M24 0H0V24" fill="none" stroke="#a4e6d4" stroke-opacity="0.035"/>
    </pattern>
    <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="1" fill="#000000" opacity="0.45"/>
    </pattern>
    <filter id="videoShadow" x="-40%" y="-40%" width="180%" height="200%">
      <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#000000" flood-opacity="0.75"/>
    </filter>
  </defs>`;
}

function videoBackdrop(accent, secondary, time) {
  const offset = (time * 18) % 28;
  return `
    <rect width="640" height="360" fill="url(#videoBackground)"/>
    <rect width="640" height="360" fill="url(#videoGrid)" transform="translate(${format(offset)} ${format(offset / 2)})" opacity="0.8"/>
    <path d="M-70 360 230 0h96L26 360Z" fill="${accent}" opacity="0.04"/>
    <path d="M430 360 690 15v180L565 360Z" fill="${secondary}" opacity="0.16"/>
    <path d="M22 62V22H62M578 338h40v-40" fill="none" stroke="${accent}" stroke-opacity="0.45" stroke-width="2"/>
  `;
}

function boardScene(accent, background = '#0b141d') {
  return `
    <rect width="640" height="360" fill="${background}"/>
    <rect x="20" y="43" width="600" height="297" fill="url(#boardGrid)" stroke="${accent}" stroke-opacity="0.3" stroke-width="2"/>
    <path d="M20 43H620M20 340H620" stroke="#ffffff" stroke-opacity="0.05"/>
  `;
}

function gameHeader(score, level, status) {
  return `
    <rect width="640" height="43" fill="#131e25"/>
    <path d="M0 42.5H640" stroke="#82e7cb" stroke-opacity="0.28"/>
    <g font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="800">
      <text x="19" y="27" fill="#edf6f1" letter-spacing="1.4">SCORE ${score}   LIFE 1   LV ${level}</text>
      <text x="621" y="27" text-anchor="end" fill="#f0cf74" letter-spacing="1.1">${status}</text>
    </g>
  `;
}

function snakeSvg(points, cell, palette, direction) {
  const pieces = [];
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const [centerX, centerY] = points[index];
    const x = centerX - cell / 2;
    const y = centerY - cell / 2;
    const inset = Math.max(2, cell * 0.08);
    const isHead = index === 0;
    pieces.push(`<g transform="translate(${format(x)} ${format(y)})" shape-rendering="crispEdges">
      <rect width="${format(cell)}" height="${format(cell)}" rx="${format(cell * 0.04)}" fill="${palette.outline}"/>
      <rect x="${format(inset)}" y="${format(inset)}" width="${format(cell - inset * 2)}" height="${format(cell - inset * 2)}" fill="${isHead ? palette.head : palette.body}"/>
      <rect x="${format(inset * 1.6)}" y="${format(inset * 1.6)}" width="${format(cell * 0.62)}" height="${format(Math.max(2, cell * 0.1))}" fill="${palette.highlight}" opacity="0.88"/>
      ${isHead ? snakeEyes(cell, palette.eye, direction) : snakeBodyPattern(cell, palette, index)}
    </g>`);
  }
  return `<g>${pieces.join('')}</g>`;
}

function snakeBodyPattern(cell, palette, index) {
  const stripeX = index % 2 === 0 ? cell * 0.64 : cell * 0.23;
  return `<rect x="${format(stripeX)}" y="${format(cell * 0.36)}" width="${format(cell * 0.14)}" height="${format(cell * 0.43)}" fill="${palette.accent}" opacity="0.82"/>`;
}

function snakeEyes(cell, color, direction) {
  const eye = Math.max(3, cell * 0.13);
  let eyes;
  let tongue;
  if (direction === 'left') {
    eyes = [[cell * 0.2, cell * 0.25], [cell * 0.2, cell * 0.62]];
    tongue = `<path d="M0 ${format(cell * 0.53)}H${format(-cell * 0.18)}l${format(-cell * 0.1)} ${format(-cell * 0.1)}m${format(cell * 0.1)} ${format(cell * 0.1)}-${format(cell * 0.1)} ${format(cell * 0.1)}" fill="none" stroke="#e887a5" stroke-width="${format(Math.max(2, cell * 0.05))}"/>`;
  } else if (direction === 'up') {
    eyes = [[cell * 0.25, cell * 0.2], [cell * 0.62, cell * 0.2]];
    tongue = `<path d="M${format(cell * 0.53)} 0V${format(-cell * 0.18)}" stroke="#e887a5" stroke-width="${format(Math.max(2, cell * 0.05))}"/>`;
  } else if (direction === 'down') {
    eyes = [[cell * 0.25, cell * 0.66], [cell * 0.62, cell * 0.66]];
    tongue = `<path d="M${format(cell * 0.53)} ${format(cell)}v${format(cell * 0.18)}" stroke="#e887a5" stroke-width="${format(Math.max(2, cell * 0.05))}"/>`;
  } else {
    eyes = [[cell * 0.67, cell * 0.25], [cell * 0.67, cell * 0.62]];
    tongue = `<path d="M${format(cell)} ${format(cell * 0.53)}h${format(cell * 0.18)}l${format(cell * 0.1)} ${format(-cell * 0.1)}m${format(-cell * 0.1)} ${format(cell * 0.1)} ${format(cell * 0.1)} ${format(cell * 0.1)}" fill="none" stroke="#e887a5" stroke-width="${format(Math.max(2, cell * 0.05))}"/>`;
  }
  return `${eyes.map(([x, y]) => `<rect x="${format(x)}" y="${format(y)}" width="${format(eye)}" height="${format(eye)}" fill="${color}"/><rect x="${format(x + eye * 0.2)}" y="${format(y + eye * 0.1)}" width="${format(eye * 0.28)}" height="${format(eye * 0.28)}" fill="#ffffff"/>`).join('')}${tongue}`;
}

function wrenSvg(x, y, size, vulnerable) {
  const scale = size / 20;
  const cloak = vulnerable ? '#7070bd' : '#1a5e5b';
  const cloakLight = vulnerable ? '#aba1e2' : '#308b7d';
  const mask = vulnerable ? '#c3d3eb' : '#bc843a';
  const maskLight = vulnerable ? '#ecf2ff' : '#e8b85e';
  const sash = vulnerable ? '#65deff' : '#be3030';
  const eye = vulnerable ? '#ffffff' : '#ffc345';
  return `<g transform="translate(${format(x)} ${format(y)}) scale(${format(scale)})" shape-rendering="crispEdges">
    <ellipse cx="10" cy="18.5" rx="8" ry="1.5" fill="#05090c" opacity="0.5"/>
    <rect x="4" y="15" width="5" height="3" fill="#161b1f"/>
    <rect x="12" y="15" width="5" height="3" fill="#161b1f"/>
    <path d="M4 7h11l3 10H2Z" fill="${cloak}"/>
    <path d="m9 8 6 1 1 7-7-1Z" fill="${cloakLight}"/>
    <rect x="3" y="11" width="14" height="3" fill="${sash}"/>
    <path d="m13 13 5 3-4 1Z" fill="${sash}"/>
    <ellipse cx="10" cy="6.5" rx="6" ry="5.5" fill="${cloak}"/>
    <path d="M5 3h9l3 4-6 1-2 3-3-3Z" fill="${mask}"/>
    <path d="M7 4h6l3 2-6 1Z" fill="${maskLight}"/>
    <rect x="7" y="6" width="5" height="2" fill="#161b1f"/>
    <rect x="9" y="6" width="2" height="2" fill="${eye}"/>
  </g>`;
}

function kingSvg(x, y, size, attacking) {
  const scale = size / 60;
  const eye = attacking ? '#ff7269' : '#7ef0dd';
  return `<g transform="translate(${format(x)} ${format(y)}) scale(${format(scale)})" shape-rendering="crispEdges">
    <ellipse cx="30" cy="55.5" rx="25" ry="3.5" fill="#050612" opacity="0.55"/>
    <path d="M14 17h29l9 37H7Z" fill="#291947"/>
    <path d="m28 18 15 3 4 30-18-3Z" fill="#4c3076"/>
    <path d="m12 51 7-6 4 9 7-7 5 8 10-7 4 7H10Z" fill="#53beb5"/>
    <rect x="15" y="20" width="30" height="26" fill="#272c3b"/>
    <path d="m17 21 13-4 13 4-3 22H20Z" fill="#4e566b"/>
    <path d="m30 19 10 4-2 8-8-2Z" fill="#81899d"/>
    <rect x="16" y="38" width="29" height="5" fill="#d5a743"/>
    <rect x="28" y="38" width="5" height="5" fill="#fada7e"/>
    <rect x="20" y="8" width="21" height="15" fill="#272c3b"/>
    <rect x="23" y="11" width="15" height="10" fill="#11121d"/>
    <rect x="25" y="15" width="4" height="2" fill="${eye}"/>
    <rect x="33" y="15" width="4" height="2" fill="${eye}"/>
    <path d="M19 10V2l5 4 5-5 5 5 7-4v9Z" fill="#d5a743"/>
    <rect x="20" y="8" width="20" height="4" fill="#fada7e"/>
    <rect x="27" y="4" width="5" height="7" fill="#d5a743"/>
    <rect x="10" y="26" width="10" height="18" fill="#272c3b"/>
    <rect x="41" y="25" width="9" height="19" fill="#272c3b"/>
    <ellipse cx="13.5" cy="44" rx="5.5" ry="5" fill="#81899d"/>
    <ellipse cx="48.5" cy="44" rx="5.5" ry="5" fill="#81899d"/>
    <path d="m45 37 4 2L60 8l-4-4Z" fill="${attacking ? '#eb63a1' : '#8697ae'}"/>
    <path d="m47 35 2 2 9-29-2-2Z" fill="${attacking ? '#ffe1ed' : '#d1dae5'}"/>
    <rect x="42" y="36" width="12" height="4" fill="#d5a743"/>
  </g>`;
}

function phantomFruitSvg(x, y, size, frame) {
  const scale = size / 20;
  const glow = frame % 2 === 0 ? 0.38 : 0.25;
  return `<g transform="translate(${format(x)} ${format(y)}) scale(${format(scale)})" shape-rendering="crispEdges">
    <ellipse cx="10" cy="10" rx="10" ry="10" fill="#bc78ff" opacity="${glow}"/>
    <ellipse cx="10.5" cy="11.5" rx="6.5" ry="6.5" fill="#6f37aa"/>
    <ellipse cx="10.5" cy="11.5" rx="4.5" ry="4.5" fill="#b167e2"/>
    <path d="m10 6-3-4 4 2 4-3-1 5Z" fill="#ffd34c"/>
    <ellipse cx="8.5" cy="9.5" rx="1.5" ry="1.5" fill="#faf4ff"/>
  </g>`;
}

function appleSvg(x, y, size) {
  return `<g transform="translate(${format(x)} ${format(y)}) scale(${format(size / 20)})" shape-rendering="crispEdges">
    <ellipse cx="10" cy="12" rx="7" ry="7" fill="#ed4e43"/>
    <ellipse cx="8" cy="9" rx="2" ry="2" fill="#ffc6ae"/>
    <rect x="10" y="2" width="2" height="5" fill="#72502b"/>
    <path d="M11 4q4-4 7-1-3 4-7 3Z" fill="#68b758"/>
  </g>`;
}

function crescentSvg(x, y, size, rotation) {
  return `<g transform="translate(${format(x)} ${format(y)}) rotate(${format(rotation)}) scale(${format(size / 100)})">
    <path d="M8 70A52 52 0 0 1 82 10 47 47 0 0 0 34 91 52 52 0 0 1 8 70Z" fill="#bd63dd" opacity="0.42"/>
    <path d="M16 67A44 44 0 0 1 78 17 39 39 0 0 0 38 84 44 44 0 0 1 16 67Z" fill="#f8e9ff"/>
    <path d="M24 64A36 36 0 0 1 70 23 34 34 0 0 0 42 77 36 36 0 0 1 24 64Z" fill="#c36be0"/>
  </g>`;
}

function stoneBorder(width, height) {
  const blocks = [];
  for (let index = 0; index < 22; index += 1) {
    const x = 36 + index * ((width - 96) / 21);
    const shade = index % 3 === 0 ? '#1d2b2d' : index % 3 === 1 ? '#182326' : '#223033';
    blocks.push(`<rect x="${format(x)}" y="38" width="${format(62 + index % 4 * 8)}" height="28" fill="${shade}" opacity="0.82"/>`);
    blocks.push(`<rect x="${format(x)}" y="${height - 66}" width="${format(62 + (index + 2) % 4 * 8)}" height="28" fill="${shade}" opacity="0.82"/>`);
  }
  for (let index = 0; index < 12; index += 1) {
    const y = 74 + index * ((height - 176) / 11);
    const shade = index % 2 === 0 ? '#1b282b' : '#243235';
    blocks.push(`<rect x="38" y="${format(y)}" width="30" height="${format(54 + index % 3 * 13)}" fill="${shade}" opacity="0.82"/>`);
    blocks.push(`<rect x="${width - 68}" y="${format(y)}" width="30" height="${format(54 + (index + 1) % 3 * 13)}" fill="${shade}" opacity="0.82"/>`);
  }
  return `<g>${blocks.join('')}</g>`;
}

function cornerFrame(width, height, accent) {
  return `<g fill="none">
    <rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="24" stroke="${accent}" stroke-opacity="0.38" stroke-width="3"/>
    <rect x="42" y="42" width="${width - 84}" height="${height - 84}" rx="17" stroke="#ffffff" stroke-opacity="0.07" stroke-width="2"/>
    <path d="M63 143V63h80M${width - 63} ${height - 143}v80h-80" stroke="${accent}" stroke-opacity="0.76" stroke-width="6"/>
    <path d="M63 ${height - 143}v80h80M${width - 63} 143V63h-80" stroke="#e7d181" stroke-opacity="0.38" stroke-width="3"/>
  </g>`;
}

function particles(width, height, count, seed, color, maximumOpacity, verticalOffset = 0) {
  const values = [];
  let state = seed >>> 0;
  for (let index = 0; index < count; index += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const x = (state / 0xffffffff) * width;
    state = (state * 1664525 + 1013904223) >>> 0;
    const baseY = (state / 0xffffffff) * height;
    const y = ((baseY - verticalOffset) % height + height) % height;
    state = (state * 1664525 + 1013904223) >>> 0;
    const size = 2 + (state % 6);
    const opacity = maximumOpacity * (0.35 + (state % 65) / 100);
    values.push(`<rect x="${format(x)}" y="${format(y)}" width="${size}" height="${size}" fill="${color}" opacity="${format(opacity)}"/>`);
  }
  return `<g>${values.join('')}</g>`;
}

function transitionFlash(time) {
  const boundaries = [1.5, 3.75, 5.6, 7.65];
  const intensity = Math.max(
    0,
    ...boundaries.map((boundary) => 1 - Math.abs(time - boundary) / 0.11),
  );
  if (intensity <= 0) {
    return '';
  }
  return `<g opacity="${format(intensity)}">
    <rect width="640" height="360" fill="#dffff5" opacity="0.66"/>
    <path d="M-80 360 245 0h160L80 360ZM315 360 640 0h95L410 360Z" fill="#6fe0c9" opacity="0.72"/>
  </g>`;
}

function svgDocument(width, height, title, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}" shape-rendering="geometricPrecision">
  <title>${title}</title>
  ${body}
</svg>
`;
}

function renderSvgWithChrome(svgPath, pngPath, width, height) {
  const result = spawnSync(chrome, [
    '--headless=new',
    '--hide-scrollbars',
    '--no-first-run',
    '--disable-gpu',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    `--user-data-dir=${chromeProfileDirectory}`,
    `--screenshot=${pngPath}`,
    pathToFileURL(svgPath).href,
  ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  ensureCommandSucceeded(result, `Chrome failed to render ${svgPath}`);
  if (!existsSync(pngPath)) {
    throw new Error(`Chrome did not create ${pngPath}.`);
  }
}

function renderVideoFrames(framePaths) {
  const result = spawnSync(magick, [
    'mogrify',
    '-background',
    'none',
    '-density',
    '96',
    '-format',
    'png',
    ...framePaths,
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  ensureCommandSucceeded(result, 'ImageMagick failed to render the video frames');
  const firstFrame = join(framesDirectory, 'frame-0000.png');
  const lastFrame = join(
    framesDirectory,
    `frame-${String(VIDEO_FRAME_COUNT - 1).padStart(4, '0')}.png`,
  );
  assertPngDimensions(firstFrame, VIDEO_WIDTH, VIDEO_HEIGHT);
  assertPngDimensions(lastFrame, VIDEO_WIDTH, VIDEO_HEIGHT);
}

function encodeVideo(crf) {
  const result = spawnSync(ffmpeg, [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-framerate',
    String(VIDEO_FRAME_RATE),
    '-i',
    join(framesDirectory, 'frame-%04d.png'),
    '-vf',
    `fps=${VIDEO_OUTPUT_FRAME_RATE},format=yuv420p`,
    '-frames:v',
    String(VIDEO_OUTPUT_FRAME_RATE * VIDEO_DURATION_SECONDS),
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-profile:v',
    'main',
    '-level',
    '3.0',
    '-crf',
    String(crf),
    '-movflags',
    '+faststart',
    videoPath,
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  ensureCommandSucceeded(result, 'FFmpeg failed to encode the video preview');
}

function verifyVideo() {
  const result = spawnSync(ffmpeg, [
    '-hide_banner',
    '-i',
    videoPath,
    '-f',
    'null',
    '-',
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  ensureCommandSucceeded(result, 'FFmpeg could not verify the video preview');
  const details = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (!details.includes('640x360')) {
    throw new Error('Encoded video is not 640x360.');
  }
  const durationMatch = details.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!durationMatch) {
    throw new Error('Could not read the encoded video duration.');
  }
  const duration = Number(durationMatch[1]) * 3600 +
    Number(durationMatch[2]) * 60 +
    Number(durationMatch[3]);
  if (duration > 10 || duration < 8.9) {
    throw new Error(`Encoded video duration is ${duration.toFixed(2)} seconds.`);
  }
}

function assertPngDimensions(path, expectedWidth, expectedHeight) {
  if (!existsSync(path)) {
    throw new Error(`Missing PNG: ${path}`);
  }
  const png = readFileSync(path);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(`${path} is ${width}x${height}; expected ${expectedWidth}x${expectedHeight}.`);
  }
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    join(process.env.PROGRAMFILES ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(process.env.PROGRAMFILES ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) {
    throw new Error('Chrome or Edge is required. Set CHROME_PATH to its executable.');
  }
  return executable;
}

function findFfmpeg() {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  const require = createRequire(import.meta.url);
  try {
    const executable = require('ffmpeg-static');
    if (typeof executable === 'string' && existsSync(executable)) {
      return executable;
    }
  } catch {
    // Fall through to a system installation.
  }
  return findExecutable(undefined, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
    'FFmpeg is required. Run npm install or set FFMPEG_PATH.');
}

function findExecutable(override, command, errorMessage) {
  if (override) {
    if (!existsSync(override)) {
      throw new Error(`Executable does not exist: ${override}`);
    }
    return override;
  }
  const result = spawnSync(command, ['-version'], { encoding: 'utf8' });
  if (!result.error && result.status === 0) {
    return command;
  }
  throw new Error(errorMessage);
}

function ensureCommandSucceeded(result, message) {
  if (result.error || result.status !== 0) {
    const details = result.error?.message || result.stderr || result.stdout || 'Unknown command error.';
    throw new Error(`${message}: ${details}`);
  }
}

function fileSummary(label, path) {
  return `${label}: ${formatBytes(statSync(path).size)} (${path})`;
}

function formatBytes(bytes) {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(2)} MB`
    : `${Math.ceil(bytes / 1_000)} KB`;
}

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function easeOut(value) {
  return 1 - (1 - value) ** 3;
}

function format(value) {
  return Number(value.toFixed(2));
}
