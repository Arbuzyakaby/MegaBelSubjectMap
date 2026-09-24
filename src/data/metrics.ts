import { scaleLinear, scaleLog } from 'd3-scale';
import { interpolateRgbBasis } from 'd3-interpolate';
import type { Strings } from '../i18n/strings';
import { COUNTRY, REGIONS, type Region } from './regions';

export type MetricKey = 'population' | 'density' | 'area' | 'salary' | 'urbanShare' | 'districts';

export interface Metric {
  key: MetricKey;
  label: keyof Strings;
  unit?: keyof Strings;
  icon: string;
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
    icon: '👥',
    value: (r) => r.population,
    country: COUNTRY.population,
    digits: 0,
  },
  {
    key: 'density',
    label: 'density',
    unit: 'perKm2',
    icon: '🏘️',
    value: density,
    country: density(COUNTRY),
    digits: 1,
    log: true,
  },
  {
    key: 'area',
    label: 'area',
    unit: 'km2',
    icon: '🗺️',
    value: (r) => r.area,
    country: COUNTRY.area,
    digits: 0,
    log: true,
  },
  {
    key: 'salary',
    label: 'salary',
    unit: 'rub',
    icon: '💰',
    value: (r) => r.salary,
    country: COUNTRY.salary,
    digits: 1,
  },
  {
    key: 'urbanShare',
    label: 'urbanShare',
    unit: 'pct',
    icon: '🏢',
    value: urbanShare,
    country: urbanShare(COUNTRY),
    digits: 1,
  },
  {
    key: 'districts',
    label: 'districts',
    icon: '📍',
    value: (r) => r.districts,
    country: COUNTRY.districts,
    digits: 0,
    skipCity: true,
  },
];

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<MetricKey, Metric>;

/** Тепловая шкала: холодный синий → фиолетовый → янтарный → красный (максимум) */
const HEAT = interpolateRgbBasis(['#1e3a8a', '#6d28d9', '#db2777', '#f97316', '#ef4444']);
export const HEAT_STOPS = [0, 0.25, 0.5, 0.75, 1].map((t) => HEAT(t));

export function regionsFor(metric: Metric): Region[] {
  return metric.skipCity ? REGIONS.filter((r) => r.kind !== 'city') : REGIONS;
}

/** Нормированное значение 0…1 для раскраски */
export function makeNormalizer(metric: Metric) {
  const values = regionsFor(metric).map(metric.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const s = metric.log ? scaleLog().domain([min, max]) : scaleLinear().domain([min, max]);
  s.range([0, 1]).clamp(true);
  return { t: (v: number) => s(v), min, max };
}

export function heatColor(t: number) {
  return HEAT(t);
}

export function rankOf(metric: Metric, region: Region): number | null {
  if (metric.skipCity && region.kind === 'city') return null;
  // Спортивная нумерация: при равенстве значений — одинаковое место
  const v = metric.value(region);
  return regionsFor(metric).filter((r) => metric.value(r) > v).length + 1;
}
