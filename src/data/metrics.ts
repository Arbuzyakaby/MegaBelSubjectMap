import { scaleLinear, scaleLog } from 'd3-scale';
import { interpolateRgbBasis } from 'd3-interpolate';
import { Building2, LandPlot, MapPin, Users, Wallet, Grid3x3, type LucideIcon } from 'lucide-react';
import type { Strings } from '../i18n/strings';
import type { Theme } from '../lib/theme';
import { COUNTRY, REGIONS, type Region } from './regions';
import { DISTRICTS, type District } from './districts';

export type MetricKey = 'population' | 'density' | 'area' | 'salary' | 'urbanShare' | 'districts';

export interface Metric {
  key: MetricKey;
  label: keyof Strings;
  unit?: keyof Strings;
  icon: LucideIcon;
  value: (r: Region) => number;
  country: number;
  /** Сколько знаков после запятой показывать */
  digits: number;
  /** Логарифмическая шкала — когда Минск на порядки отличается от областей */
  log?: boolean;
  /** Показатель не имеет смысла для города (районы) */
  skipCity?: boolean;
}

export const density = (r: Pick<Region, 'population' | 'area'>) => r.population / r.area;
export const urbanShare = (r: Pick<Region, 'urban' | 'population'>) => (r.urban / r.population) * 100;

export const METRICS: Metric[] = [
  {
    key: 'population',
    label: 'population',
    unit: 'people',
    icon: Users,
    value: (r) => r.population,
    country: COUNTRY.population,
    digits: 0,
  },
  {
    key: 'density',
    label: 'density',
    unit: 'perKm2',
    icon: Grid3x3,
    value: density,
    country: density(COUNTRY),
    digits: 1,
    log: true,
  },
  {
    key: 'area',
    label: 'area',
    unit: 'km2',
    icon: LandPlot,
    value: (r) => r.area,
    country: COUNTRY.area,
    digits: 0,
    log: true,
  },
  {
    key: 'salary',
    label: 'salary',
    unit: 'rub',
    icon: Wallet,
    value: (r) => r.salary,
    country: COUNTRY.salary,
    digits: 1,
  },
  {
    key: 'urbanShare',
    label: 'urbanShare',
    unit: 'pct',
    icon: Building2,
    value: urbanShare,
    country: urbanShare(COUNTRY),
    digits: 1,
  },
  {
    key: 'districts',
    label: 'districts',
    icon: MapPin,
    value: (r) => r.districts,
    country: COUNTRY.districts,
    digits: 0,
    skipCity: true,
  },
];

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<MetricKey, Metric>;

/**
 * Последовательная шкала одной гаммы (красный): низкие значения почти сливаются
 * с фоном, максимум — насыщенный красный. Для каждой темы — свои ступени.
 */
const HEAT_RAMPS: Record<Theme, string[]> = {
  dark: ['#2d3240', '#473439', '#6e3a3a', '#9c443c', '#d0553f'],
  light: ['#ebe4e0', '#e2b9ad', '#cd8170', '#b04c3b', '#88251a'],
};
const HEAT: Record<Theme, (t: number) => string> = {
  dark: interpolateRgbBasis(HEAT_RAMPS.dark),
  light: interpolateRgbBasis(HEAT_RAMPS.light),
};
export const heatStops = (theme: Theme) => HEAT_RAMPS[theme];

export function regionsFor(metric: Metric): Region[] {
  return metric.skipCity ? REGIONS.filter((r) => r.kind !== 'city') : REGIONS;
}

/** Нормировка набора значений в 0…1 (линейная или логарифмическая) */
export function makeScale(values: number[], log = false) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const s = log ? scaleLog().domain([min, max]) : scaleLinear().domain([min, max]);
  s.range([0, 1]).clamp(true);
  return { t: (v: number) => s(v), min, max };
}

/** Нормированное значение 0…1 для раскраски */
export function makeNormalizer(metric: Metric) {
  return makeScale(regionsFor(metric).map(metric.value), metric.log);
}

export function heatColor(t: number, theme: Theme) {
  return HEAT[theme](t);
}

export function rankOf(metric: Metric, region: Region): number | null {
  if (metric.skipCity && region.kind === 'city') return null;
  // Спортивная нумерация: при равенстве значений — одинаковое место
  const v = metric.value(region);
  return regionsFor(metric).filter((r) => metric.value(r) > v).length + 1;
}

// ───────────── Районы ─────────────
// Для районов доступны только население (оценка), площадь и плотность.

export type DistrictMetricKey = 'population' | 'density' | 'area';

export interface DistrictMetric extends Omit<Metric, 'key' | 'value' | 'country' | 'skipCity'> {
  key: DistrictMetricKey;
  value: (d: District) => number;
}

export const DISTRICT_METRICS: DistrictMetric[] = [
  { ...METRIC_BY_KEY.population, key: 'population', value: (d) => d.population, log: true },
  { ...METRIC_BY_KEY.density, key: 'density', value: density, log: true },
  { ...METRIC_BY_KEY.area, key: 'area', value: (d) => d.area, log: false },
];

export const DISTRICT_METRIC_BY_KEY = Object.fromEntries(DISTRICT_METRICS.map((m) => [m.key, m])) as Record<
  DistrictMetricKey,
  DistrictMetric
>;

export const isDistrictMetric = (key: MetricKey | null): key is DistrictMetricKey =>
  key !== null && key in DISTRICT_METRIC_BY_KEY;

const districtScales = new Map<DistrictMetricKey, ReturnType<typeof makeScale>>();
export function districtNormalizer(m: DistrictMetric) {
  let s = districtScales.get(m.key);
  if (!s) {
    s = makeScale(DISTRICTS.map(m.value), m.log);
    districtScales.set(m.key, s);
  }
  return s;
}

export function districtRank(m: DistrictMetric, d: District): number {
  const v = m.value(d);
  return DISTRICTS.filter((x) => m.value(x) > v).length + 1;
}
