import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const WIDTH = 1700;
const HEIGHT = 600;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = join(root, 'store-assets', 'discord-skus');

const products = [
  {
    id: 'wrenbound',
    name: 'WRENBOUND',
    chapter: 'THE HUNTER\'S MARK',
    description: ['Teal hunter cloak, red sash,', 'and a bronze mask inspired by Wren.'],
    colors: {
      backgroundA: '#081b1d',
      backgroundB: '#143d3c',
      glow: '#55b39e',
      head: '#bc843a',
      body: '#1a5e5b',
      accent: '#be3030',
      highlight: '#55b39e',
      outline: '#132f31',
      eye: '#ffd15b',
    },
  },
  {
    id: 'embercoil',
    name: 'EMBERCOIL',
    chapter: 'HEAT BENEATH THE SCALE',
    description: ['Obsidian scales split by bright,', 'furnace-hot cracks.'],
    colors: {
      backgroundA: '#160d12',
      backgroundB: '#441714',
      glow: '#ff7a1a',
      head: '#c94427',
      body: '#292126',
      accent: '#ff7a1a',
      highlight: '#ffc94f',
      outline: '#100e12',
      eye: '#ffe18a',
    },
  },
  {
    id: 'phantom-royal',
    name: 'PHANTOM ROYAL',
    chapter: 'CROWNED BEYOND THE VEIL',
    description: ['Violet spirit scales with gold rings', 'and a spectral crown.'],
    colors: {
      backgroundA: '#140d25',
      backgroundB: '#38205d',
      glow: '#9e54d2',
      head: '#9e54d2',
      body: '#60358f',
      accent: '#ffd34c',
      highlight: '#d9a3ff',
      outline: '#2c1748',
      eye: '#f7efff',
    },
  },
  {
    id: 'bone-serpent',
    name: 'BONE SERPENT',
    chapter: 'NOTHING STAYS BURIED',
    description: ['Ivory vertebrae, charcoal joints,', 'and a watchful skull.'],
    colors: {
      backgroundA: '#111114',
      backgroundB: '#353331',
      glow: '#ddd6b9',
      head: '#ddd6b9',
      body: '#bcb69e',
      accent: '#3b3a3d',
      highlight: '#f4efd9',
      outline: '#29282c',
      eye: '#d94538',
    },
  },
];

mkdirSync(outputDirectory, { recursive: true });

for (const product of products) {
  const svgPath = join(outputDirectory, `${product.id}-1700x600.svg`);
  writeFileSync(svgPath, renderBanner(product), 'utf8');
}

const chrome = findChrome();
const profileDirectory = mkdtempSync(join(tmpdir(), 'snake-sku-art-'));

try {
  for (const product of products) {
    const svgPath = join(outputDirectory, `${product.id}-1700x600.svg`);
    const pngPath = join(outputDirectory, `${product.id}-1700x600.png`);
    const result = spawnSync(chrome, [
      '--headless=new',
      '--hide-scrollbars',
      '--no-first-run',
      '--force-device-scale-factor=1',
      `--window-size=${WIDTH},${HEIGHT}`,
      `--user-data-dir=${profileDirectory}`,
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
  }
} finally {
  rmSync(profileDirectory, { recursive: true, force: true });
}

function findChrome() {
  const candidates = [
    join(process.env.PROGRAMFILES ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(process.env.PROGRAMFILES ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ];
  const executable = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!executable) {
    throw new Error('Chrome or Edge is required to export the SKU banner PNGs.');
  }
  return executable;
}

function renderBanner(product) {
  const { colors } = product;
  const bodies = [
    { x: 920, y: 377, angle: -10 },
    { x: 1008, y: 335, angle: -19 },
    { x: 1094, y: 278, angle: -30 },
    { x: 1175, y: 205, angle: -35 },
    { x: 1274, y: 159, angle: -12 },
    { x: 1385, y: 166, angle: 9 },
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title description" shape-rendering="geometricPrecision">
  <title id="title">${product.name} Snake Adventures skin</title>
  <description id="description">${product.description.join(' ')}</description>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colors.backgroundA}"/>
      <stop offset="0.58" stop-color="${colors.backgroundB}"/>
      <stop offset="1" stop-color="${colors.backgroundA}"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${colors.glow}" stop-opacity="0.42"/>
      <stop offset="1" stop-color="${colors.glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="titleFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="${colors.highlight}"/>
    </linearGradient>
    <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
      <path d="M42 0H0V42" fill="none" stroke="#ffffff" stroke-opacity="0.045" stroke-width="2"/>
      <rect x="2" y="2" width="4" height="4" fill="${colors.glow}" fill-opacity="0.12"/>
    </pattern>
    <pattern id="ticks" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="8" height="28" fill="${colors.glow}" fill-opacity="0.08"/>
    </pattern>
    <filter id="snakeShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="18" stdDeviation="15" flood-color="#000000" flood-opacity="0.55"/>
      <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="${colors.glow}" flood-opacity="0.28"/>
    </filter>
    <filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="12"/>
    </filter>
    <clipPath id="frameClip">
      <rect x="20" y="20" width="1660" height="560" rx="24"/>
    </clipPath>
  </defs>

  <rect width="1700" height="600" fill="#090b0f"/>
  <rect x="20" y="20" width="1660" height="560" rx="24" fill="url(#background)"/>
  <g clip-path="url(#frameClip)">
    <rect x="20" y="20" width="1660" height="560" fill="url(#grid)"/>
    <path d="M660 20H1680V580H1150L660 20Z" fill="url(#ticks)"/>
    <ellipse cx="1302" cy="298" rx="520" ry="330" fill="url(#halo)"/>
    <path d="M770 582 1180 20H1320L910 582Z" fill="${colors.glow}" fill-opacity="0.045"/>
    <path d="M990 582 1400 20H1468L1058 582Z" fill="#ffffff" fill-opacity="0.025"/>

    <g opacity="0.5">
      <path d="M48 96H252" stroke="${colors.glow}" stroke-width="4"/>
      <path d="M48 96V58H86" fill="none" stroke="${colors.glow}" stroke-width="4"/>
      <path d="M1652 504H1448" stroke="${colors.glow}" stroke-width="4"/>
      <path d="M1652 504V542H1614" fill="none" stroke="${colors.glow}" stroke-width="4"/>
    </g>

    <g font-family="Segoe UI, Arial, sans-serif">
      <text x="88" y="91" fill="${colors.highlight}" font-size="22" font-weight="700" letter-spacing="6">SNAKE ADVENTURES // PERMANENT SKIN</text>
      <rect x="88" y="126" width="72" height="7" fill="${colors.accent}"/>
      <rect x="166" y="126" width="28" height="7" fill="${colors.highlight}"/>
      <text x="88" y="237" fill="url(#titleFill)" font-size="86" font-weight="900" letter-spacing="-3">${product.name}</text>
      <text x="91" y="282" fill="${colors.glow}" font-size="24" font-weight="800" letter-spacing="4">${product.chapter}</text>
      <text x="91" y="346" fill="#ffffff" fill-opacity="0.88" font-size="29" font-weight="500">${product.description[0]}</text>
      <text x="91" y="384" fill="#ffffff" fill-opacity="0.88" font-size="29" font-weight="500">${product.description[1]}</text>

      <g transform="translate(90 448)">
        <rect width="261" height="52" rx="6" fill="#07090d" fill-opacity="0.54" stroke="${colors.glow}" stroke-opacity="0.65" stroke-width="2"/>
        <text x="24" y="34" fill="#ffffff" font-size="20" font-weight="800" letter-spacing="2.6">OWN IT FOREVER</text>
      </g>
      <g transform="translate(373 448)">
        ${paletteSwatches(colors)}
      </g>
      <text x="91" y="548" fill="#ffffff" fill-opacity="0.46" font-size="17" font-weight="700" letter-spacing="2.8">COSMETIC ONLY // NO GAMEPLAY ADVANTAGE</text>
    </g>

    <path d="M878 457C1028 427 1061 159 1284 125 1438 102 1559 184 1637 294" fill="none" stroke="#000000" stroke-opacity="0.4" stroke-width="148" stroke-linecap="square" filter="url(#softGlow)"/>
    <g filter="url(#snakeShadow)" shape-rendering="crispEdges">
      ${bodies.map((body, index) => renderBody(product.id, colors, body, index)).join('\n      ')}
      ${renderHead(product.id, colors, { x: 1493, y: 204, angle: 15 })}
    </g>

    <g opacity="0.62" fill="${colors.highlight}">
      <rect x="1580" y="118" width="8" height="8"/>
      <rect x="1610" y="148" width="5" height="5"/>
      <rect x="1538" y="92" width="4" height="4"/>
      <rect x="900" y="232" width="6" height="6"/>
      <rect x="950" y="188" width="3" height="3"/>
    </g>
  </g>
  <rect x="20" y="20" width="1660" height="560" rx="24" fill="none" stroke="${colors.glow}" stroke-opacity="0.42" stroke-width="3"/>
  <rect x="31" y="31" width="1638" height="538" rx="17" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>
</svg>
`;
}

function paletteSwatches(colors) {
  return [colors.body, colors.accent, colors.highlight, colors.head]
    .map((color, index) => `<rect x="${index * 48}" y="8" width="36" height="36" fill="${color}" stroke="#ffffff" stroke-opacity="0.28" stroke-width="2"/>`)
    .join('');
}

function renderBody(id, colors, body, index) {
  return `<g transform="translate(${body.x} ${body.y}) rotate(${body.angle} 59 59)">
        <rect width="118" height="118" fill="${colors.outline}"/>
        <rect x="7" y="7" width="104" height="104" fill="${colors.body}"/>
        <rect x="13" y="13" width="86" height="12" fill="${colors.highlight}" fill-opacity="0.88"/>
        ${bodyPattern(id, colors, index)}
      </g>`;
}

function bodyPattern(id, colors, index) {
  switch (id) {
    case 'wrenbound':
      return `<rect x="7" y="49" width="104" height="27" fill="${colors.accent}"/>
        <rect x="${index % 2 === 0 ? 81 : 20}" y="28" width="21" height="18" fill="${colors.highlight}"/>`;
    case 'embercoil':
      return `<path d="M48 7V38H67V56H88V78H75V111" fill="none" stroke="${colors.accent}" stroke-width="16"/>
        <path d="M60 7V38H78V53" fill="none" stroke="${colors.highlight}" stroke-width="6"/>
        <rect x="24" y="84" width="44" height="13" fill="${colors.accent}"/>`;
    case 'phantom-royal':
      return `<rect x="7" y="${index % 2 === 0 ? 36 : 75}" width="104" height="20" fill="${colors.accent}"/>
        <rect x="42" y="38" width="34" height="48" fill="${colors.highlight}" fill-opacity="0.84"/>`;
    case 'bone-serpent':
      return `<rect x="47" y="7" width="25" height="104" fill="${colors.accent}"/>
        <rect x="20" y="34" width="78" height="17" fill="${colors.highlight}"/>
        <rect x="20" y="72" width="78" height="17" fill="${colors.highlight}"/>`;
    default:
      throw new Error(`Unknown skin ${id}.`);
  }
}

function renderHead(id, colors, head) {
  return `<g transform="translate(${head.x} ${head.y}) rotate(${head.angle} 65 65)">
        <rect width="130" height="130" fill="${colors.outline}"/>
        <rect x="8" y="8" width="114" height="114" fill="${colors.head}"/>
        <rect x="15" y="15" width="80" height="13" fill="${colors.highlight}"/>
        ${headPattern(id, colors)}
        <rect x="80" y="31" width="19" height="19" fill="${colors.eye}"/>
        <rect x="80" y="82" width="19" height="19" fill="${colors.eye}"/>
        <rect x="84" y="31" width="6" height="6" fill="#ffffff"/>
        <rect x="84" y="82" width="6" height="6" fill="#ffffff"/>
      </g>`;
}

function headPattern(id, colors) {
  switch (id) {
    case 'wrenbound':
      return `<rect x="8" y="8" width="41" height="114" fill="${colors.body}"/>
        <rect x="15" y="87" width="100" height="27" fill="${colors.accent}"/>
        <rect x="55" y="26" width="55" height="21" fill="${colors.highlight}"/>`;
    case 'embercoil':
      return `<path d="M49 8V48H69V67H97V96" fill="none" stroke="${colors.accent}" stroke-width="17"/>
        <path d="M61 8V46H79V58" fill="none" stroke="${colors.highlight}" stroke-width="6"/>`;
    case 'phantom-royal':
      return `<g transform="translate(126 5) rotate(90)">
          <path d="M13 37V8H34V28H54V2H78V28H99V8H119V46Z" fill="${colors.accent}"/>
        </g>
        <rect x="45" y="48" width="22" height="64" fill="${colors.highlight}" fill-opacity="0.82"/>`;
    case 'bone-serpent':
      return `<rect x="71" y="23" width="38" height="36" fill="${colors.accent}"/>
        <rect x="71" y="72" width="38" height="37" fill="${colors.accent}"/>
        <rect x="103" y="53" width="19" height="27" fill="${colors.accent}"/>
        <rect x="109" y="53" width="6" height="9" fill="${colors.highlight}"/>
        <rect x="109" y="71" width="6" height="9" fill="${colors.highlight}"/>
        <rect x="48" y="56" width="18" height="19" fill="${colors.accent}"/>
        <rect x="22" y="19" width="42" height="17" fill="${colors.highlight}"/>`;
    default:
      throw new Error(`Unknown skin ${id}.`);
  }
}
