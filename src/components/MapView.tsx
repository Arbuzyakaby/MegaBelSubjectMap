import { motion, useReducedMotion } from 'framer-motion';
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { REGION_BY_ID, type RegionId } from '../data/regions';
import { heatColor, makeNormalizer, METRIC_BY_KEY, regionsFor, type MetricKey } from '../data/metrics';
import { FULL_VIEWBOX, MAP_W, project, SHAPES, viewBoxFor } from '../lib/geo';
import { useI18n } from '../i18n/I18nProvider';
import { fmt, fmtCompact } from '../lib/format';

interface Props {
  metric: MetricKey | null;
  selected: RegionId | null;
  hovered: RegionId | null;
  onHover: (id: RegionId | null) => void;
  onSelect: (id: RegionId | null) => void;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function MapView({ metric, selected, hovered, onHover, onSelect }: Props) {
  const { l, t } = useI18n();
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const m = metric ? METRIC_BY_KEY[metric] : null;
  const norm = useMemo(() => (m ? makeNormalizer(m) : null), [m]);
  const topId = useMemo(() => {
    if (!m) return null;
    return [...regionsFor(m)].sort((a, b) => m.value(b) - m.value(a))[0].id;
  }, [m]);

  const fillFor = (id: RegionId) => {
    const r = REGION_BY_ID[id];
    if (!m || !norm) return r.accent;
    if (m.skipCity && r.kind === 'city') return 'var(--map-muted)';
    return heatColor(norm.t(m.value(r)));
  };

  const selectedShape = selected ? SHAPES.find((s) => s.id === selected) : null;
  const viewBox = selectedShape ? viewBoxFor(selectedShape.bounds) : FULL_VIEWBOX;
  const focusId = hovered ?? selected;
  const focusShape = focusId ? SHAPES.find((s) => s.id === focusId) : null;

  const onMove = (e: ReactPointerEvent) => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (box) setPointer({ x: e.clientX - box.left, y: e.clientY - box.top });
  };

  const tooltipRegion = hovered ? REGION_BY_ID[hovered] : null;
  const valueText = (id: RegionId) => {
    if (!m) return null;
    const r = REGION_BY_ID[id];
    if (m.skipCity && r.kind === 'city') return '—';
    return fmtCompact(m.value(r), m.digits) + (m.unit === 'pct' ? '%' : '');
  };

  return (
    <div className="map-wrap" ref={wrapRef} onPointerMove={onMove} onPointerLeave={() => setPointer(null)}>
      <motion.svg
        className="map-svg"
        viewBox={FULL_VIEWBOX}
        animate={{ viewBox }}
        transition={{ duration: reduce ? 0 : 0.9, ease: EASE }}
        role="group"
        aria-label={t.hint}
        onClick={() => onSelect(null)}
      >
        <defs>
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="lift" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#000" floodOpacity="0.55" />
          </filter>
          <radialGradient id="sheen" cx="35%" cy="25%" r="80%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
            <stop offset="60%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* мягкая «подложка» страны */}
        <g className="map-shadow" aria-hidden>
          {SHAPES.map((s) => (
            <path key={s.id} d={s.d} />
          ))}
        </g>

        <g>
          {SHAPES.map((s, i) => {
            const r = REGION_BY_ID[s.id];
            const dim = focusId !== null && focusId !== s.id;
            return (
              <motion.path
                key={s.id}
                d={s.d}
                className="region"
                tabIndex={0}
                role="button"
                aria-label={l(r.name)}
                aria-pressed={selected === s.id}
                initial={reduce ? false : { pathLength: 0, fillOpacity: 0 }}
                animate={{
                  pathLength: 1,
                  fill: fillFor(s.id),
                  fillOpacity: dim ? 0.42 : 0.92,
                }}
                transition={{
                  pathLength: { duration: 1.6, delay: i * 0.12, ease: EASE },
                  fillOpacity: { duration: 0.5, delay: reduce ? 0 : 0.9 + i * 0.1 },
                  fill: { duration: 0.7, ease: EASE },
                }}
                onPointerEnter={() => onHover(s.id)}
                onPointerLeave={() => onHover(null)}
                onFocus={() => onHover(s.id)}
                onBlur={() => onHover(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(selected === s.id ? null : s.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(selected === s.id ? null : s.id);
                  }
                }}
              />
            );
          })}
        </g>

        {/* блик по всей стране */}
        <g aria-hidden pointerEvents="none">
          {SHAPES.map((s) => (
            <path key={s.id} d={s.d} fill="url(#sheen)" />
          ))}
        </g>

        {/* подсветка активного региона поверх остальных */}
        {focusShape && (
          <motion.path
            key={focusShape.id}
            d={focusShape.d}
            className="region-focus"
            fill={fillFor(focusShape.id)}
            filter="url(#lift)"
            pointerEvents="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          />
        )}

        {/* пульс лидера рейтинга */}
        {topId && !selected && (
          <motion.path
            key={`pulse-${topId}-${metric}`}
            d={SHAPES.find((s) => s.id === topId)!.d}
            className="region-pulse"
            pointerEvents="none"
            filter="url(#glow)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.15, 0.9, 0.15] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        <motion.g
          className="labels"
          pointerEvents="none"
          animate={{ opacity: selected ? 0 : 1 }}
          transition={{ duration: 0.3 }}
        >
          {SHAPES.map((s, i) => {
            const r = REGION_BY_ID[s.id];
            const [px, py] = project(r.labelAt);
            const [lx, ly] = r.callout ? project(r.callout) : [px, py];
            const value = valueText(s.id);
            return (
              <motion.g
                key={s.id}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduce ? 0 : 1.4 + i * 0.08, duration: 0.5 }}
              >
                {r.callout && (
                  <>
                    <line x1={px} y1={py} x2={lx} y2={ly + 14} className="callout-line" />
                    <circle cx={px} cy={py} r={5} className="callout-dot" />
                  </>
                )}
                <text x={lx} y={ly} className="label-name" textAnchor="middle">
                  {r.emoji} {l(r.short)}
                </text>
                {value && (
                  <motion.text
                    key={`${metric}-${s.id}`}
                    x={lx}
                    y={ly + 26}
                    className="label-value"
                    textAnchor="middle"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: i * 0.04 }}
                  >
                    {value}
                  </motion.text>
                )}
              </motion.g>
            );
          })}
        </motion.g>
      </motion.svg>

      {tooltipRegion && pointer && (
        <div
          className="tooltip"
          style={{
            left: Math.min(pointer.x + 16, (wrapRef.current?.clientWidth ?? MAP_W) - 220),
            top: Math.max(pointer.y - 12, 0),
          }}
        >
          <div className="tooltip-name">
            <span>{tooltipRegion.emoji}</span> {l(tooltipRegion.name)}
          </div>
          {m ? (
            <div className="tooltip-value">
              {t[m.label]}:{' '}
              <b>
                {m.skipCity && tooltipRegion.kind === 'city'
                  ? '—'
                  : `${fmt(m.value(tooltipRegion), m.digits)} ${m.unit ? t[m.unit] : ''}`}
              </b>
            </div>
          ) : (
            <div className="tooltip-value">
              {t.population}: <b>{fmt(tooltipRegion.population)}</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
