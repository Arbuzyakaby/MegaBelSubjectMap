// Генерирует src/data/districts.ts из scripts/source/districts.table.mjs.
// Население районов — ОЦЕНКА: «сырые» значения по памяти масштабируются внутри
// каждой области так, чтобы сумма районов и городов областного подчинения
// совпала с численностью области по Белстату на 01.01.2026 (src/data/regions.ts).
// Запуск: npm run gen:districts
import { readFile, writeFile } from 'node:fs/promises';
import { CITIES, TABLE } from './source/districts.table.mjs';

const OUT = 'src/data/districts.ts';

// Численность областей берём прямо из regions.ts, чтобы не дублировать цифры
const regionsSrc = await readFile('src/data/regions.ts', 'utf8');
const regionPop = {};
for (const m of regionsSrc.matchAll(/id: '([a-z-]+)',[\s\S]*?population: ([\d_]+),/g)) {
  regionPop[m[1]] = Number(m[2].replaceAll('_', ''));
}

const byRegion = {};
for (const row of TABLE) (byRegion[row[2]] ??= []).push(row);

const population = {};
for (const [region, rows] of Object.entries(byRegion)) {
  const cities = rows.flatMap((r) => r[9] ?? []).reduce((s, c) => s + CITIES[c].pop * 1000, 0);
  const target = regionPop[region] - cities;
  const raw = rows.reduce((s, r) => s + r[8], 0) * 1000;
  const k = target / raw;
  for (const r of rows) population[r[0]] = Math.round((r[8] * 1000 * k) / 100) * 100;
  console.log(`${region}: цель ${target}, коэффициент ${k.toFixed(3)}`);
}

const q = (s) => `'${s.replaceAll("'", "\\'")}'`;
const lit = (ru, be) => `{ ru: ${q(ru)}, be: ${q(be)} }`;
const lines = TABLE.map((r) => {
  const [id, , region, adjRu, adjBe, cRu, cBe, area, , excl] = r;
  const without = excl ? `, without: [${excl.map((c) => lit(CITIES[c].ru, CITIES[c].be)).join(', ')}]` : '';
  return `  { id: ${q(id)}, region: ${q(region)}, name: ${lit(`${adjRu} район`, `${adjBe} раён`)}, center: ${lit(cRu, cBe)}, area: ${area}, population: ${population[id]}${without} },`;
});

const out = `// СГЕНЕРИРОВАНО scripts/gen-districts.mjs — не редактировать вручную.
import type { L } from '../i18n/types';
import type { RegionId } from './regions';

export type OblastId = Exclude<RegionId, 'minsk'>;

export interface District {
  id: string;
  /** Область */
  region: OblastId;
  name: L;
  /** Административный центр */
  center: L;
  /** Площадь, км² (официальные значения; для части районов — по геометрии) */
  area: number;
  /** Население — ОЦЕНКА (≈), без городов областного подчинения */
  population: number;
  /** Города областного подчинения внутри района, не входящие в его население */
  without?: L[];
}

export const DISTRICTS: District[] = [
${lines.join('\n')}
];

export const DISTRICT_BY_ID: Record<string, District> = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));
`;

await writeFile(OUT, out);
console.log(`Wrote ${OUT}: ${TABLE.length} районов`);
