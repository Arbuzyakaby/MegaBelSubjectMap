import { motion } from 'framer-motion';
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { REGION_BY_ID, REGIONS, type RegionId } from '../data/regions';
import { DISTRICTS, type OblastId } from '../data/districts';
import {
  DISTRICT_METRIC_BY_KEY,
  districtNormalizer,
  districtRank,
  heatColor,
  isDistrictMetric,
  makeNormalizer,
  METRIC_BY_KEY,
  rankOf,
  regionsFor,
  type MetricKey,
} from '../data/metrics';
import { useI18n } from '../i18n/I18nProvider';
import { fmt } from '../lib/format';
import { useTheme } from '../lib/theme';
import { RegionGlyph } from './RegionGlyph';
import type { Level } from '../App';

interface Props {
  metric: MetricKey | null;
  order: 'desc' | 'asc';
  onOrderChange: (o: 'desc' | 'asc') => void;
  hovered: RegionId | null;
  onHover: (id: RegionId | null) => void;
  onSelect: (id: RegionId) => void;
}

type RankingProps = Props & {
  level: Level;
  selectedDistrict: string | null;
  hoveredDistrict: string | null;
  onHoverDistrict: (id: string | null) => void;
  onSelectDistrict: (id: string) => void;
};

export function Ranking({ level, selectedDistrict, hoveredDistrict, onHoverDistrict, onSelectDistrict, ...rest }: RankingProps) {
  if (level === 'districts')
    return (
      <DistrictRanking
        metric={rest.metric}
        order={rest.order}
        onOrderChange={rest.onOrderChange}
        selected={selectedDistrict}
        hovered={hoveredDistrict}
        onHover={onHoverDistrict}
        onSelect={onSelectDistrict}
      />
    );
  return <RegionRanking {...rest} />;
}

function RegionRanking({ metric, order, onOrderChange, hovered, onHover, onSelect }: Props) {
  const { t, l } = useI18n();
  const { theme } = useTheme();
  // В режиме «Регионы» рейтинг строится по населению, но цвета — фирменные
  const m = METRIC_BY_KEY[metric ?? 'population'];
  const norm = useMemo(() => makeNormalizer(m), [m]);

  const rows = useMemo(() => {
    const valid = REGIONS.filter((r) => !(m.skipCity && r.kind === 'city'));
    const rest = REGIONS.filter((r) => m.skipCity && r.kind === 'city');
    valid.sort((a, b) => (order === 'desc' ? m.value(b) - m.value(a) : m.value(a) - m.value(b)));
    return [...valid, ...rest];
  }, [m, order]);

  const max = norm.max;
  const valid = regionsFor(m);
  const leader = [...valid].sort((a, b) => m.value(b) - m.value(a))[0];
  const unit = m.unit ? ` ${t[m.unit]}` : '';

  return (
    <section className="ranking glass" aria-label={t.ranking}>
      <header className="ranking-head">
        <div>
          <p className="eyebrow">{t.ranking}</p>
          <h2 className="ranking-title">
            <m.icon size={20} strokeWidth={1.75} className="title-icon" /> {t[m.label]}
          </h2>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onOrderChange(order === 'desc' ? 'asc' : 'desc')}
          aria-label={order === 'desc' ? t.sortAsc : t.sortDesc}
          title={order === 'desc' ? t.sortDesc : t.sortAsc}
        >
          {order === 'desc' ? <ArrowDownWideNarrow size={18} /> : <ArrowUpNarrowWide size={18} />}
        </button>
      </header>

      <ol className="ranking-list">
        {rows.map((r, i) => {
          const na = m.skipCity && r.kind === 'city';
          const v = na ? 0 : m.value(r);
          const color = !metric ? r.accent[theme] : na ? 'var(--map-muted)' : heatColor(norm.t(v), theme);
          const width = na ? 0 : m.log ? 8 + norm.t(v) * 92 : Math.max(6, (v / max) * 100);
          return (
            <motion.li
              key={r.id}
              layout
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className={`rank-row${hovered === r.id ? ' rank-row-hover' : ''}${na ? ' rank-row-na' : ''}`}
            >
              <button
                type="button"
                className="rank-btn"
                onPointerEnter={() => onHover(r.id)}
                onPointerLeave={() => onHover(null)}
                onFocus={() => onHover(r.id)}
                onBlur={() => onHover(null)}
                onClick={() => onSelect(r.id)}
              >
                <span className="rank-pos">
                  {na ? '—' : rankOf(m, r)}
                </span>
                <span className="rank-main">
                  <span className="rank-name">
                    <RegionGlyph id={r.id} color={r.accent[theme]} size={18} className="rank-glyph" />
                    {l(r.name)}
                  </span>
                  <span className="rank-track">
                    <motion.span
                      className="rank-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%`, backgroundColor: color }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: i * 0.04 }}
                    />
                  </span>
                </span>
                <span className="rank-value">
                  {na ? t.noCity : fmt(v, m.digits)}
                  {!na && m.unit && <small> {t[m.unit]}</small>}
                </span>
              </button>
            </motion.li>
          );
        })}
      </ol>

      <motion.div
        key={m.key}
        className="insights"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="insight">
          <span className="insight-label">{t.country}</span>
          <span className="insight-value">
            {fmt(m.country, m.digits)}
            <small>{unit}</small>
          </span>
        </div>
        <div className="insight">
          <span className="insight-label">{t.leader}</span>
          <span className="insight-value">
            {l(leader.short)}
          </span>
        </div>
        <div className="insight">
          <span className="insight-label">{t.gap}</span>
          <span className="insight-value">×{fmt(norm.max / norm.min, norm.max / norm.min < 10 ? 2 : 0)}</span>
        </div>
      </motion.div>
    </section>
  );
}

const OBLASTS = REGIONS.filter((r) => r.kind === 'oblast').map((r) => r.id as OblastId);

interface DistrictProps {
  metric: MetricKey | null;
  order: 'desc' | 'asc';
  onOrderChange: (o: 'desc' | 'asc') => void;
  selected: string | null;
  hovered: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

function DistrictRanking({ metric, order, onOrderChange, selected, hovered, onHover, onSelect }: DistrictProps) {
  const { t, l } = useI18n();
  const { theme } = useTheme();
  const [filter, setFilter] = useState<OblastId | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const colored = isDistrictMetric(metric);
  const m = DISTRICT_METRIC_BY_KEY[isDistrictMetric(metric) ? metric : 'population'];
  const norm = districtNormalizer(m);
  const approx = m.key === 'area' ? '' : '≈ ';

  // При выборе района на карте фильтр переключается на его область, строка прокручивается в зону видимости
  const selectedRegion = selected ? DISTRICTS.find((d) => d.id === selected)?.region : undefined;
  useEffect(() => {
    if (selectedRegion && filter && filter !== selectedRegion) setFilter(selectedRegion);
  }, [selectedRegion, filter]);
  useEffect(() => {
    if (!selected) return;
    listRef.current
      ?.querySelector(`[data-id="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected, filter]);

  const rows = useMemo(() => {
    const list = DISTRICTS.filter((d) => !filter || d.region === filter);
    return list.sort((a, b) => (order === 'desc' ? m.value(b) - m.value(a) : m.value(a) - m.value(b)));
  }, [m, order, filter]);

  const values = rows.map(m.value);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const leader = [...rows].sort((a, b) => m.value(b) - m.value(a))[0];
  const gap = Math.max(...values) / Math.min(...values);
  const unit = m.unit ? ` ${t[m.unit]}` : '';

  return (
    <section className="ranking ranking-districts glass" aria-label={t.ranking}>
      <header className="ranking-head">
        <div>
          <p className="eyebrow">
            {t.ranking} · {rows.length} {t.districtsOf}
          </p>
          <h2 className="ranking-title">
            <m.icon size={20} strokeWidth={1.75} className="title-icon" /> {t[m.label]}
            {m.key === 'population' && <span className="badge">{t.estimate}</span>}
          </h2>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onOrderChange(order === 'desc' ? 'asc' : 'desc')}
          aria-label={order === 'desc' ? t.sortAsc : t.sortDesc}
          title={order === 'desc' ? t.sortDesc : t.sortAsc}
        >
          {order === 'desc' ? <ArrowDownWideNarrow size={18} /> : <ArrowUpNarrowWide size={18} />}
        </button>
      </header>

      <div className="region-filter" role="radiogroup" aria-label={t.filterByRegion}>
        <button
          type="button"
          role="radio"
          aria-checked={filter === null}
          className={`filter-chip filter-all${filter === null ? ' on' : ''}`}
          onClick={() => setFilter(null)}
        >
          {t.allRegions}
        </button>
        {OBLASTS.map((id) => {
          const r = REGION_BY_ID[id];
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={filter === id}
              aria-label={l(r.name)}
              title={l(r.name)}
              className={`filter-chip${filter === id ? ' on' : ''}`}
              onClick={() => setFilter(filter === id ? null : id)}
            >
              <RegionGlyph id={id} color={r.accent[theme]} size={22} />
            </button>
          );
        })}
      </div>

      <ol className="ranking-list" ref={listRef}>
        {rows.map((d, i) => {
          const v = m.value(d);
          const accent = REGION_BY_ID[d.region].accent[theme];
          const color = colored ? heatColor(norm.t(v), theme) : accent;
          const width = m.log ? 8 + norm.t(v) * 92 : Math.max(6, (v / norm.max) * 100);
          return (
            <li
              key={d.id}
              data-id={d.id}
              className={`rank-row rank-row-compact${hovered === d.id ? ' rank-row-hover' : ''}${
                selected === d.id ? ' rank-row-selected' : ''
              }`}
            >
              <button
                type="button"
                className="rank-btn"
                onPointerEnter={() => onHover(d.id)}
                onPointerLeave={() => onHover(null)}
                onFocus={() => onHover(d.id)}
                onBlur={() => onHover(null)}
                onClick={() => onSelect(d.id)}
              >
                <span className="rank-pos">{districtRank(m, d)}</span>
                <span className="rank-main">
                  <span className="rank-name">
                    <RegionGlyph id={d.region} color={accent} size={14} className="rank-glyph" />
                    {l(d.name)}
                  </span>
                  <span className="rank-track">
                    <motion.span
                      className="rank-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%`, backgroundColor: color }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 14) * 0.03 }}
                    />
                  </span>
                </span>
                <span className="rank-value">
                  {approx}
                  {fmt(v, m.digits)}
                  {m.unit && <small> {t[m.unit]}</small>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <motion.div
        key={`${m.key}-${filter}`}
        className="insights"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="insight">
          <span className="insight-label">{t.districtAverage}</span>
          <span className="insight-value">
            {approx}
            {fmt(mean, m.digits)}
            <small>{unit}</small>
          </span>
        </div>
        <div className="insight">
          <span className="insight-label">{t.leader}</span>
          <span className="insight-value">{l(leader.name).split(' ')[0]}</span>
        </div>
        <div className="insight">
          <span className="insight-label">{t.gap}</span>
          <span className="insight-value">×{fmt(gap, gap < 10 ? 2 : 0)}</span>
        </div>
      </motion.div>
    </section>
  );
}
