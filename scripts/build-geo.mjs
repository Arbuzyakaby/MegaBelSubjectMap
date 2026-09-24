// Готовит компактную TopoJSON-геометрию субъектов Беларуси для карты.
// Источник: Natural Earth 10m admin-1 (public domain), выборка по adm0_a3 = BLR.
// Запуск: npm run build:geo
import mapshaper from 'mapshaper';
import { readFile, writeFile } from 'node:fs/promises';

const SRC = 'scripts/source/ne_10m_blr_admin1.geojson';
const OUT = 'src/data/belarus.topo.json';

const ISO_TO_ID = {
  'BY-BR': 'brest',
  'BY-VI': 'vitebsk',
  'BY-HO': 'gomel',
  'BY-HR': 'grodno',
  'BY-MI': 'minsk-region',
  'BY-MA': 'mogilev',
  'BY-HM': 'minsk',
};

const source = JSON.parse(await readFile(SRC, 'utf8'));
for (const f of source.features) {
  f.properties = { id: ISO_TO_ID[f.properties.iso] };
}

const output = await mapshaper.applyCommands(
  '-i in.json name=regions -simplify 40% keep-shapes -o out.json format=topojson quantization=1e5',
  { 'in.json': JSON.stringify(source) },
);

await writeFile(OUT, output['out.json']);
console.log(`Wrote ${OUT} (${output['out.json'].length} bytes)`);
