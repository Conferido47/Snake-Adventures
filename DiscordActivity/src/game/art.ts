import type { Rect } from './contracts';

export function drawWren(
  context: CanvasRenderingContext2D,
  bounds: Rect,
  vulnerable: boolean,
): void {
  context.save();
  context.translate(bounds.x, bounds.y);
  context.scale(bounds.width / 20, bounds.height / 20);

  const cloak = vulnerable ? '#7070bd' : '#1a5e5b';
  const cloakLight = vulnerable ? '#aba1e2' : '#308b7d';
  const mask = vulnerable ? '#c3d3eb' : '#bc843a';
  const maskLight = vulnerable ? '#ecf2ff' : '#e8b85e';
  const sash = vulnerable ? '#65deff' : '#be3030';
  const dark = '#161b1f';

  fillEllipse(context, 'rgb(8 15 18 / 0.37)', 2, 17, 16, 3);
  fillRect(context, dark, 4, 15, 5, 3);
  fillRect(context, dark, 12, 15, 5, 3);
  fillPolygon(context, cloak, [[4, 7], [15, 7], [18, 17], [2, 17]]);
  fillPolygon(context, cloakLight, [[9, 8], [15, 9], [16, 16], [9, 15]]);
  fillRect(context, sash, 3, 11, 14, 3);
  fillPolygon(context, sash, [[13, 13], [18, 16], [14, 17]]);

  fillEllipse(context, cloak, 4, 1, 12, 11);
  fillPolygon(context, mask, [[5, 3], [14, 3], [17, 7], [11, 8], [9, 11], [6, 8]]);
  fillPolygon(context, maskLight, [[7, 4], [13, 4], [16, 6], [10, 7]]);
  fillRect(context, dark, 7, 6, 5, 2);
  fillRect(context, vulnerable ? '#ffffff' : '#ffc345', 9, 6, 2, 2);

  context.restore();
}

export function drawHollowKing(
  context: CanvasRenderingContext2D,
  bounds: Rect,
  attacking: boolean,
): void {
  context.save();
  context.translate(bounds.x, bounds.y);
  context.scale(bounds.width / 60, bounds.height / 60);

  const armorDark = '#272c3b';
  const armor = '#4e566b';
  const armorLight = '#81899d';
  const gold = '#d5a743';
  const goldLight = '#fada7e';

  fillEllipse(context, 'rgb(7 8 18 / 0.41)', 5, 52, 50, 7);
  fillPolygon(context, '#291947', [[14, 17], [43, 17], [52, 54], [7, 54]]);
  fillPolygon(context, '#4c3076', [[28, 18], [43, 21], [47, 51], [29, 48]]);
  fillPolygon(context, '#53beb5', [
    [12, 51], [19, 45], [23, 54], [30, 47],
    [35, 55], [45, 48], [49, 55], [10, 55],
  ]);

  fillRect(context, armorDark, 15, 20, 30, 26);
  fillPolygon(context, armor, [[17, 21], [30, 17], [43, 21], [40, 43], [20, 43]]);
  fillPolygon(context, armorLight, [[30, 19], [40, 23], [38, 31], [30, 29]]);
  fillRect(context, gold, 16, 38, 29, 5);
  fillRect(context, goldLight, 28, 38, 5, 5);

  fillRect(context, armorDark, 20, 8, 21, 15);
  fillRect(context, '#11121d', 23, 11, 15, 10);
  const eye = attacking ? '#ff7269' : '#7ef0dd';
  fillRect(context, eye, 25, 15, 4, 2);
  fillRect(context, eye, 33, 15, 4, 2);

  fillPolygon(context, gold, [
    [19, 10], [19, 2], [24, 6], [29, 1], [34, 6], [41, 2], [41, 11],
  ]);
  fillRect(context, goldLight, 20, 8, 20, 4);
  fillRect(context, gold, 27, 4, 5, 7);

  fillRect(context, armorDark, 10, 26, 10, 18);
  fillRect(context, armorDark, 41, 25, 9, 19);
  fillEllipse(context, armorLight, 8, 39, 11, 10);
  fillEllipse(context, armorLight, 43, 39, 11, 10);

  fillPolygon(context, attacking ? '#eb63a1' : '#8697ae', [
    [45, 37], [49, 39], [60, 8], [56, 4],
  ]);
  fillPolygon(context, attacking ? '#ffe1ed' : '#d1dae5', [
    [47, 35], [49, 37], [58, 8], [56, 6],
  ]);
  fillRect(context, gold, 42, 36, 12, 4);
  fillPolygon(context, armorDark, [[43, 39], [47, 41], [41, 52], [38, 50]]);

  context.restore();
}

export function drawPhantomFruit(
  context: CanvasRenderingContext2D,
  bounds: Rect,
  animationFrame: number,
): void {
  context.save();
  context.translate(bounds.x, bounds.y);
  context.scale(bounds.width / 20, bounds.height / 20);

  const pulse = Math.trunc(animationFrame / 3) % 2;
  const glow = pulse === 0 ? 'rgb(188 120 255 / 0.41)' : 'rgb(188 120 255 / 0.28)';
  fillEllipse(context, glow, pulse, pulse, 20 - pulse * 2, 20 - pulse * 2);
  fillEllipse(context, '#6f37aa', 4, 5, 13, 13);
  fillEllipse(context, '#b167e2', 6, 7, 9, 9);
  fillPolygon(context, '#ffd34c', [[10, 6], [7, 2], [11, 4], [15, 1], [14, 6]]);
  fillEllipse(context, '#faf4ff', 7, 8, 3, 3);
  fillEllipse(context, glow, 2, 13, 4, 5);
  fillEllipse(context, glow, 14, 12, 4, 6);

  context.restore();
}

function fillRect(
  context: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  context.fillStyle = color;
  context.fillRect(x, y, width, height);
}

function fillEllipse(
  context: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  context.beginPath();
  context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
}

function fillPolygon(
  context: CanvasRenderingContext2D,
  color: string,
  points: Array<[number, number]>,
): void {
  const first = points[0];
  if (!first) {
    return;
  }

  context.beginPath();
  context.moveTo(first[0], first[1]);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    context.lineTo(point[0], point[1]);
  }
  context.closePath();
  context.fillStyle = color;
  context.fill();
}
