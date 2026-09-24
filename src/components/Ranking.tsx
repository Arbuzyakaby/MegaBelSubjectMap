import { motion } from 'framer-motion';
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { useMemo } from 'react';
import { REGIONS, type RegionId } from '../data/regions';
import { heatColor, makeNormalizer, METRIC_BY_KEY, rankOf, regionsFor, type MetricKey } from '../data/metrics';
import { useI18n } from '../i18n/I18nProvider';
import { fmt } from '../lib/format';
import { useTheme } from '../lib/theme';
import { RegionGlyph } from './RegionGlyph';

interface Props {
  metric: MetricKey | null;
  order: 'desc' | 'asc';
  onOrderChange: (o: 'desc' | 'asc') => void;
  hovered: RegionId | null;
  onHover: (id: RegionId | null) => void;
  onSelect: (id: RegionId) => void;
}

export function Ranking({ metric, order, onOrderChange, hovered, onHover, onSelect }: Props) {
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
