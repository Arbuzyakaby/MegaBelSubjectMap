// Строит растровую подложку «Рельеф» для карты: отмывка + гипсометрическая
// раскраска высот в той же проекции, что и векторная карта (src/lib/geo.ts).
// Высоты: Mapzen / AWS Terrain Tiles (формат Terrarium), z8.
// Запуск: npm run build:relief  (тайлы кэшируются в scripts/.cache)
import { geoConicConformal, geoPath } from 'd3-geo';
import { feature, merge } from 'topojson-client';
import sharp from 'sharp';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';

const OUT = 'src/assets/relief.webp';
const CACHE = 'scripts/.cache/terrarium';
const Z = 8;
const SCALE = 2; // холст в 2 раза крупнее viewBox карты
const EXAGGERATION = 10; // страна равнинная — усиливаем вертикаль
const SUN_AZIMUTH = 315;
const SUN_ALTITUDE = 45;

// Размеры холста и отступ берём прямо из geo.ts, чтобы проекции совпадали
const geoSrc = await readFile('src/lib/geo.ts', 'utf8');
const num = (name) => Number(new RegExp(`const ${name} = (\\d+)`).exec(geoSrc)[1]);
const MAP_W = num('MAP_W');
const MAP_H = num('MAP_H');
const PAD = num('PAD');
const W = MAP_W * SCALE;
const H = MAP_H * SCALE;

const topo = JSON.parse(await readFile('src/data/belarus.topo.json', 'utf8'));
const regions = feature(topo, topo.objects.regions);
const country = merge(topo, topo.objects.regions.geometries);
const projection = geoConicConformal()
  .parallels([52, 55])
  .rotate([-28, 0])
  .fitExtent(
    [
      [PAD, PAD],
      [MAP_W - PAD, MAP_H - PAD],
    ],
    regions,
  );

// ── 1. Тайлы высот ──
const lon2x = (lon) => ((lon + 180) / 360) * 2 ** Z;
const lat2y = (lat) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** Z;
const [[minLon, minLat], [maxLon, maxLat]] = [
  [23.0, 51.1],
  [33.0, 56.3],
];
const tx0 = Math.floor(lon2x(minLon));
const tx1 = Math.floor(lon2x(maxLon));
const ty0 = Math.floor(lat2y(maxLat));
const ty1 = Math.floor(lat2y(minLat));
const cols = tx1 - tx0 + 1;
const rows = ty1 - ty0 + 1;
console.log(`Тайлы z${Z}: ${cols}×${rows} = ${cols * rows}`);

await mkdir(CACHE, { recursive: true });
const TW = cols * 256;
const TH = rows * 256;
const dem = new Float32Array(TW * TH);
for (let ty = ty0; ty <= ty1; ty++) {
  for (let tx = tx0; tx <= tx1; tx++) {
    const file = `${CACHE}/${Z}-${tx}-${ty}.png`;
    const exists = await access(file).then(() => true, () => false);
    if (!exists) {
      const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
    }
    const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const ox = (tx - tx0) * 256;
    const oy = (ty - ty0) * 256;
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const i = (y * info.width + x) * 3;
        dem[(oy + y) * TW + ox + x] = data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
      }
    }
  }
}

// ── 2. Высота для каждого пикселя холста (обратная проекция + билинейная выборка) ──
const elev = new Float32Array(W * H);
for (let py = 0; py < H; py++) {
  for (let px = 0; px < W; px++) {
    const [lon, lat] = projection.invert([(px + 0.5) / SCALE, (py + 0.5) / SCALE]);
    const fx = (lon2x(lon) - tx0) * 256 - 0.5;
    const fy = (lat2y(lat) - ty0) * 256 - 0.5;
    const x0 = Math.max(0, Math.min(TW - 2, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(TH - 2, Math.floor(fy)));
    const dx = fx - x0;
    const dy = fy - y0;
    const a = dem[y0 * TW + x0];
    const b = dem[y0 * TW + x0 + 1];
    const c = dem[(y0 + 1) * TW + x0];
    const d = dem[(y0 + 1) * TW + x0 + 1];
    elev[py * W + px] = a * (1 - dx) * (1 - dy) + b * dx * (1 - dy) + c * (1 - dx) * dy + d * dx * dy;
  }
}

// Размер пикселя холста в метрах (по центру карты)
const [cLon, cLat] = projection.invert([MAP_W / 2, MAP_H / 2]);
const [nLon, nLat] = projection.invert([MAP_W / 2 + 1 / SCALE, MAP_H / 2]);
const cell =
  6371008 *
  Math.hypot(((nLon - cLon) * Math.PI) / 180 * Math.cos((cLat * Math.PI) / 180), ((nLat - cLat) * Math.PI) / 180);
console.log(`Пиксель холста ≈ ${cell.toFixed(0)} м`);

// ── 3. Маска страны: рисуем контур через SVG ──
const outline = geoPath(projection)(country);
const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${MAP_W} ${MAP_H}"><path d="${outline}" fill="#fff"/></svg>`;
const mask = await sharp(Buffer.from(maskSvg)).ensureAlpha().extractChannel(3).raw().toBuffer();

// ── 4. Отмывка (Horn) + гипсометрия ──
// Синхронно с RELIEF_STOPS в src/lib/relief.ts (легенда)
const STOPS = [
  [80, [86, 140, 88]],
  [130, [128, 170, 104]],
  [170, [182, 200, 128]],
  [210, [226, 214, 140]],
  [250, [212, 176, 108]],
  [295, [176, 128, 80]],
  [345, [128, 88, 62]],
];
function hypso(h) {
  if (h <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    const [h1, c1] = STOPS[i];
    if (h <= h1) {
      const [h0, c0] = STOPS[i - 1];
      const t = (h - h0) / (h1 - h0);
      return c0.map((v, k) => v + (c1[k] - v) * t);
    }
  }
  return STOPS.at(-1)[1];
}

const zen = ((90 - SUN_ALTITUDE) * Math.PI) / 180;
const azi = (((360 - SUN_AZIMUTH + 90) % 360) * Math.PI) / 180;
const flat = Math.cos(zen);
const at = (x, y) => elev[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))];
const rgba = Buffer.alloc(W * H * 4);
let minH = Infinity;
let maxH = -Infinity;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const alpha = mask[i];
    if (!alpha) continue;
    const e = elev[i];
    minH = Math.min(minH, e);
    maxH = Math.max(maxH, e);
    const [a, b, c, d, f, g, h, k] = [
      at(x - 1, y - 1), at(x, y - 1), at(x + 1, y - 1),
      at(x - 1, y), at(x + 1, y),
      at(x - 1, y + 1), at(x, y + 1), at(x + 1, y + 1),
    ];
    const dzdx = ((c + 2 * f + k) - (a + 2 * d + g)) / (8 * cell) * EXAGGERATION;
    const dzdy = ((g + 2 * h + k) - (a + 2 * b + c)) / (8 * cell) * EXAGGERATION;
    const slope = Math.atan(Math.hypot(dzdx, dzdy));
    const aspect = Math.atan2(dzdy, -dzdx);
    const shade = Math.max(0, Math.cos(zen) * Math.cos(slope) + Math.sin(zen) * Math.sin(slope) * Math.cos(azi - aspect));
    // Ровная местность = 1; склоны к солнцу светлее, от солнца — темнее
    const m = Math.min(1.25, 0.35 + 0.65 * (shade / flat));
    const col = hypso(e);
    rgba[i * 4] = Math.min(255, col[0] * m);
    rgba[i * 4 + 1] = Math.min(255, col[1] * m);
    rgba[i * 4 + 2] = Math.min(255, col[2] * m);
    rgba[i * 4 + 3] = alpha;
  }
}
console.log(`Высоты в пределах страны: ${minH.toFixed(0)}…${maxH.toFixed(0)} м`);

await mkdir('src/assets', { recursive: true });
const webp = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 78, alphaQuality: 90, effort: 6 }).toBuffer();
await writeFile(OUT, webp);
console.log(`Wrote ${OUT} (${(webp.length / 1024).toFixed(0)} KB, ${W}×${H})`);
