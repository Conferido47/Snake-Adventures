import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const WIDTH = 1080;
const HEIGHT = 1350;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = join(root, 'store-assets', 'discord-skus');
const outputDirectory = join(process.env.USERPROFILE ?? root, 'Pictures', 'Snake Adventures Instagram');

const products = [
  {
    id: 'wrenbound',
    name: 'WRENBOUND',
    chapter: 'THE HUNTER\'S MARK',
    description: ['Teal hunter cloak, red sash,', 'and a bronze mask inspired by Wren.'],
    backgroundA: '#081b1d',
    backgroundB: '#143d3c',
    accent: '#55b39e',
    highlight: '#d7fff3',
  },
  {
    id: 'embercoil',
    name: 'EMBERCOIL',
    chapter: 'HEAT BENEATH THE SCALE',
    description: ['Obsidian scales split by bright,', 'furnace-hot cracks.'],
    backgroundA: '#160d12',
    backgroundB: '#441714',
    accent: '#ff7a1a',
    highlight: '#ffe18a',
  },
  {
    id: 'phantom-royal',
    name: 'PHANTOM ROYAL',
    chapter: 'CROWNED BEYOND THE VEIL',
    description: ['Violet spirit scales with gold rings', 'and a spectral crown.'],
    backgroundA: '#140d25',
    backgroundB: '#38205d',
    accent: '#9e54d2',
    highlight: '#ead0ff',
  },
  {
    id: 'bone-serpent',
    name: 'BONE SERPENT',
    chapter: 'NOTHING STAYS BURIED',
    description: ['Ivory vertebrae, charcoal joints,', 'and a watchful skull.'],
    backgroundA: '#111114',
    backgroundB: '#353331',
    accent: '#ddd6b9',
    highlight: '#fffbed',
  },
];

mkdirSync(outputDirectory, { recursive: true });
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'snake-instagram-'));
const chrome = findChrome();

try {
  products.forEach((product, index) => {
    const sourcePath = join(sourceDirectory, `${product.id}-1700x600.png`);
    if (!existsSync(sourcePath)) {
      throw new Error(`Missing source banner: ${sourcePath}`);
    }
    const source = readFileSync(sourcePath).toString('base64');
    const svgPath = join(temporaryDirectory, `${product.id}.svg`);
    const pngPath = join(
      outputDirectory,
      `${String(index + 1).padStart(2, '0')}-${product.id}-instagram-1080x1350.png`,
    );
    writeFileSync(svgPath, renderPost(product, source, index + 1), 'utf8');

    const result = spawnSync(chrome, [
      '--headless=new',
      '--hide-scrollbars',
      '--no-first-run',
      '--force-device-scale-factor=1',
      `--window-size=${WIDTH},${HEIGHT}`,
      `--user-data-dir=${join(temporaryDirectory, 'chrome-profile')}`,
      `--screenshot=${pngPath}`,
      pathToFileURL(svgPath).href,
    ], { encoding: 'utf8' });

    if (result.status !== 0 || !existsSync(pngPath)) {
      throw new Error(`Chrome failed to render ${product.id}: ${result.stderr || result.stdout}`);
    }

    const png = readFileSync(pngPath);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (width !== WIDTH || height !== HEIGHT) {
      throw new Error(`${product.id} rendered at ${width}x${height}, expected ${WIDTH}x${HEIGHT}.`);
    }
    console.log(`${product.id}: ${width}x${height}, ${Math.ceil(png.length / 1024)} KB`);
  });
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

function findChrome() {
  const candidates = [
    join(process.env.PROGRAMFILES ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(process.env.PROGRAMFILES ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ];
  const executable = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!executable) {
    throw new Error('Chrome or Edge is required to export the Instagram PNGs.');
  }
  return executable;
}

function renderPost(product, source, slide) {
  const heroScale = 980 / 850;
  const heroX = 50 - 850 * heroScale;
  const heroWidth = 1700 * heroScale;
  const heroHeight = 600 * heroScale;
  const heroY = 280 - (heroHeight - 620) / 2;
  const sourceData = `data:image/png;base64,${source}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title description">
  <title id="title">${product.name} Instagram post</title>
  <description id="description">${product.description.join(' ')}</description>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${product.backgroundA}"/>
      <stop offset="0.52" stop-color="${product.backgroundB}"/>
      <stop offset="1" stop-color="${product.backgroundA}"/>
    </linearGradient>
    <linearGradient id="titleFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="${product.highlight}"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${product.accent}" stop-opacity="0.36"/>
      <stop offset="1" stop-color="${product.accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
      <path d="M42 0H0V42" fill="none" stroke="#ffffff" stroke-opacity="0.04" stroke-width="2"/>
      <rect x="3" y="3" width="4" height="4" fill="${product.accent}" fill-opacity="0.14"/>
    </pattern>
    <pattern id="slashes" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="9" height="34" fill="${product.accent}" fill-opacity="0.07"/>
    </pattern>
    <clipPath id="heroClip">
      <rect x="50" y="280" width="980" height="620" rx="28"/>
    </clipPath>
    <filter id="heroShadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="24" stdDeviation="22" flood-color="#000000" flood-opacity="0.55"/>
      <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="${product.accent}" flood-opacity="0.22"/>
    </filter>
  </defs>

  <rect width="1080" height="1350" fill="#080a0e"/>
  <rect x="24" y="24" width="1032" height="1302" rx="34" fill="url(#background)"/>
  <rect x="24" y="24" width="1032" height="1302" rx="34" fill="url(#grid)"/>
  <path d="M520 24H1056V1326H790L520 24Z" fill="url(#slashes)"/>
  <ellipse cx="760" cy="600" rx="560" ry="600" fill="url(#halo)"/>

  <g font-family="Segoe UI, Arial, sans-serif">
    <text x="58" y="78" fill="${product.accent}" font-size="20" font-weight="800" letter-spacing="4.5">SNAKE ADVENTURES // DISCORD SKIN DROP</text>
    <text x="1022" y="78" text-anchor="end" fill="#ffffff" fill-opacity="0.52" font-size="20" font-weight="800" letter-spacing="2">${String(slide).padStart(2, '0')} / 04</text>
    <rect x="58" y="105" width="72" height="7" fill="${product.accent}"/>
    <rect x="138" y="105" width="30" height="7" fill="${product.highlight}"/>
    <text x="56" y="201" fill="url(#titleFill)" font-size="82" font-weight="900" letter-spacing="-2">${product.name}</text>
    <text x="59" y="246" fill="${product.accent}" font-size="23" font-weight="800" letter-spacing="3.6">${product.chapter}</text>
  </g>

  <g filter="url(#heroShadow)">
    <rect x="48" y="278" width="984" height="624" rx="30" fill="#080a0e" stroke="${product.accent}" stroke-opacity="0.58" stroke-width="4"/>
    <g clip-path="url(#heroClip)">
      <image href="${sourceData}" x="${heroX}" y="${heroY}" width="${heroWidth}" height="${heroHeight}"/>
    </g>
  </g>

  <g font-family="Segoe UI, Arial, sans-serif">
    <text x="58" y="982" fill="#ffffff" fill-opacity="0.92" font-size="31" font-weight="600">${product.description[0]}</text>
    <text x="58" y="1024" fill="#ffffff" fill-opacity="0.92" font-size="31" font-weight="600">${product.description[1]}</text>

    <g transform="translate(58 1080)">
      <rect width="305" height="70" rx="8" fill="#07090d" fill-opacity="0.62" stroke="${product.accent}" stroke-opacity="0.72" stroke-width="2"/>
      <text x="23" y="29" fill="${product.highlight}" font-size="15" font-weight="800" letter-spacing="2.3">PERMANENT</text>
      <text x="23" y="53" fill="#ffffff" font-size="18" font-weight="700">Unlock once. Keep forever.</text>
    </g>
    <g transform="translate(382 1080)">
      <rect width="330" height="70" rx="8" fill="#07090d" fill-opacity="0.62" stroke="${product.accent}" stroke-opacity="0.72" stroke-width="2"/>
      <text x="23" y="29" fill="${product.highlight}" font-size="15" font-weight="800" letter-spacing="2.3">COSMETIC ONLY</text>
      <text x="23" y="53" fill="#ffffff" font-size="18" font-weight="700">No gameplay advantage.</text>
    </g>

    <text x="58" y="1239" fill="#ffffff" font-size="30" font-weight="900" letter-spacing="1.4">AVAILABLE NOW IN THE DISCORD WARDROBE</text>
    <text x="59" y="1283" fill="${product.accent}" font-size="18" font-weight="800" letter-spacing="3.1">SNAKE ADVENTURES // OWN YOUR LEGEND</text>
  </g>

  <path d="M50 1188H1030" stroke="${product.accent}" stroke-opacity="0.44" stroke-width="3"/>
  <path d="M54 52H104V42M1026 1298H976V1308" fill="none" stroke="${product.accent}" stroke-opacity="0.7" stroke-width="4"/>
  <rect x="24" y="24" width="1032" height="1302" rx="34" fill="none" stroke="${product.accent}" stroke-opacity="0.48" stroke-width="3"/>
  <rect x="35" y="35" width="1010" height="1280" rx="27" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>
</svg>
`;
}
