// Готовит компактную TopoJSON-геометрию Беларуси: 118 районов + г. Минск и
// 6 областей + г. Минск, собранные из районов (границы совпадают идеально).
// Источник: geoBoundaries gbOpen BLR ADM2 (CC BY 4.0), https://www.geoboundaries.org
// Запуск: npm run build:geo
import mapshaper from 'mapshaper';
import { readFile, writeFile } from 'node:fs/promises';
import { TABLE } from './source/districts.table.mjs';

const SRC = 'scripts/source/geoboundaries_blr_adm2.geojson';
const OUT = 'src/data/belarus.topo.json';

const EXPECTED = { brest: 16, vitebsk: 21, gomel: 21, grodno: 17, 'minsk-region': 22, mogilev: 21 };

// В geoBoundaries Дрибинский район слит с Горецким (1858 км² ≈ 1225 + 634).
// Отрезаем его южную часть наклонной линией, подобранной так, чтобы площадь
// составила ≈ 634 км². Граница ПРИБЛИЗИТЕЛЬНАЯ.
const DRIBIN_CUT = {
  type: 'Polygon',
  coordinates: [
    [
      [30.4, 53.8],
      [31.5, 53.8],
      [31.5, 54.1955],
      [30.4, 54.1355],
      [30.4, 53.8],
    ],
  ],
};

const byGeoName = new Map(TABLE.filter((r) => r[1]).map((r) => [r[1], { id: r[0], region: r[2] }]));

const source = JSON.parse(await readFile(SRC, 'utf8'));
const features = [];
let horki = null;
for (const f of source.features) {
  const name = f.properties.shapeName;
  if (name === 'Minsk City') {
    features.push({ ...f, properties: { id: 'minsk-city', region: 'minsk' } });
    continue;
  }
  const row = byGeoName.get(name);
  if (!row) throw new Error(`Нет района для «${name}» в таблице`);
  if (row.id === 'gorki') horki = f;
  else features.push({ ...f, properties: row });
}

const fc = (list) => JSON.stringify({ type: 'FeatureCollection', features: list });
const cut = fc([{ type: 'Feature', properties: {}, geometry: DRIBIN_CUT }]);
const split = async (cmd) =>
  JSON.parse((await mapshaper.applyCommands(`-i h.json ${cmd} c.json -o out.json format=geojson`, { 'h.json': fc([horki]), 'c.json': cut }))['out.json'])
    .features;
for (const f of await split('-clip')) features.push({ ...f, properties: { id: 'dribin', region: 'mogilev' } });
for (const f of await split('-erase')) features.push({ ...f, properties: { id: 'gorki', region: 'mogilev' } });

// Контроль количества районов по областям
const counts = {};
for (const f of features) counts[f.properties.region] = (counts[f.properties.region] ?? 0) + 1;
for (const [region, n] of Object.entries(EXPECTED)) {
  if (counts[region] !== n) throw new Error(`${region}: ${counts[region]} районов вместо ${n}`);
}
const total = features.filter((f) => f.properties.region !== 'minsk').length;
console.log(`Районов: ${total}`, Object.entries(EXPECTED).map(([r]) => `${r} ${counts[r]}`).join(', '));

// Сверка площадей: полигон vs данные таблицы (расхождение >10% — перепроверить;
// у районов вокруг городов областного подчинения полигон включает и город),
// сумма по области vs regions.ts (±2%, с учётом площади городов).
const measured = JSON.parse(
  (await mapshaper.applyCommands('-i in.json -each "A=this.area/1e6" -o out.json format=geojson', { 'in.json': fc(features) }))[
    'out.json'
  ],
).features;
const polyArea = {};
for (const f of measured) polyArea[f.properties.id] = (polyArea[f.properties.id] ?? 0) + f.properties.A;
const regionsSrc = await readFile('src/data/regions.ts', 'utf8');
const regionArea = {};
for (const m of regionsSrc.matchAll(/id: '([a-z-]+)',[\s\S]*?area: ([\d_]+),/g)) regionArea[m[1]] = Number(m[2].replaceAll('_', ''));
const sums = {};
for (const [id, , region, , , , , area, , excl] of TABLE) {
  sums[region] = (sums[region] ?? 0) + area;
  const d = ((polyArea[id] - area) / area) * 100;
  if (Math.abs(d) > 10) console.log(`  площадь ${id}: данные ${area}, полигон ${polyArea[id].toFixed(0)} (${d.toFixed(1)}%)${excl ? ' — внутри город' : ' — ПРОВЕРИТЬ'}`);
}
for (const region of Object.keys(EXPECTED)) {
  const polySum = measured.filter((f) => f.properties.region === region).reduce((s, f) => s + f.properties.A, 0);
  const d = ((polySum - regionArea[region]) / regionArea[region]) * 100;
  console.log(`  ${region}: районы ${sums[region]} км², полигоны ${polySum.toFixed(0)} км², область ${regionArea[region]} км² (${d.toFixed(1)}%)`);
}

// mapshaper сам приводит обход колец к виду, который ожидает d3-geo;
// области собираются из уже упрощённых районов — дуги общие, щелей нет.
const output = await mapshaper.applyCommands(
  [
    '-i in.json snap name=districts',
    '-simplify 22% keep-shapes',
    '-dissolve region + name=regions',
    '-rename-fields target=regions id=region',
    '-o out.json target=districts,regions format=topojson quantization=1e5',
  ].join(' '),
  { 'in.json': fc(features) },
);

await writeFile(OUT, output['out.json']);
console.log(`Wrote ${OUT} (${(output['out.json'].length / 1024).toFixed(0)} KB)`);
