import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { interpolateRgb } from 'd3-interpolate';
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { REGION_BY_ID, type RegionId } from '../data/regions';
import { DISTRICT_BY_ID, DISTRICTS } from '../data/districts';
import {
  DISTRICT_METRIC_BY_KEY,
  districtNormalizer,
  heatColor,
  isDistrictMetric,
  makeNormalizer,
  METRIC_BY_KEY,
  regionsFor,
  type MetricKey,
} from '../data/metrics';
import {
  DISTRICT_BORDERS,
  DISTRICT_SHAPE_BY_ID,
  DISTRICT_SHAPES,
  FULL_VIEWBOX,
  MAP_H,
  MAP_W,
  project,
  REGION_BORDERS,
  SHAPES,
  viewBoxFor,
  zoomOf,
} from '../lib/geo';
import { useI18n } from '../i18n/I18nProvider';
import { fmt, fmtCompact } from '../lib/format';
import { useTheme, type Theme } from '../lib/theme';
import { RELIEF_MARKERS } from '../lib/relief';
import { RegionGlyph } from './RegionGlyph';
import { isLightColor } from '../lib/color';
import reliefUrl from '../assets/relief.webp';
import type { Level, View } from '../App';

interface Props {
  level: Level;
  view: View;
  metric: MetricKey | null;
  selected: RegionId | null;
  selectedDistrict: string | null;
  hovered: RegionId | null;
  hoveredDistrict: string | null;
  onHover: (id: RegionId | null) => void;
  onHoverDistrict: (id: string | null) => void;
  onSelect: (id: RegionId | null) => void;
  onSelectDistrict: (id: string | null) => void;
}

const EASE = [0.22, 1, 0.36, 1] as const;

// Соседние районы одной области слегка различаются по светлоте, оставаясь в её цвете
const DISTRICT_TINT: Record<string, number> = {};
{
  const seen: Record<string, number> = {};
  for (const d of DISTRICTS) {
    const i = (seen[d.region] = (seen[d.region] ?? -1) + 1);
    DISTRICT_TINT[d.id] = ((i * 3) % 5) / 4;
  }
}
const tint = (color: string, k: number, theme: Theme) =>
  interpolateRgb(color, theme === 'dark' ? '#0b0d12' : '#ffffff')(k * 0.26);

/** Масштаб CSS zoom у контейнера приложения — координаты указателя приходят уже «увеличенными» */
function cssZoom(el: HTMLElement): number {
  const app = el.closest<HTMLElement>('.app') ?? el;
  return parseFloat(getComputedStyle(app).zoom) || 1;
}

const activate = (e: KeyboardEvent, fn: () => void) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn();
  }
};

export function MapView(props: Props) {
  const { level, view, metric, selected, selectedDistrict, hovered, hoveredDistrict } = props;
  const { onHover, onHoverDistrict, onSelect, onSelectDistrict } = props;
  const { l, t } = useI18n();
  const { theme } = useTheme();
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const relief = view === 'relief';
  const districts = level === 'districts';

  // ── Раскраска областей ──
  const m = metric && !districts ? METRIC_BY_KEY[metric] : null;
  const norm = useMemo(() => (m ? makeNormalizer(m) : null), [m]);
  const topId = useMemo(() => {
    if (!m) return null;
    return [...regionsFor(m)].sort((a, b) => m.value(b) - m.value(a))[0].id;
  }, [m]);

  const fillFor = (id: RegionId) => {
    const r = REGION_BY_ID[id];
    if (!m || !norm) return r.accent[theme];
    if (m.skipCity && r.kind === 'city') return 'var(--map-muted)';
    return heatColor(norm.t(m.value(r)), theme);
  };

  // ── Раскраска районов ──
  const dm = districts && isDistrictMetric(metric) ? DISTRICT_METRIC_BY_KEY[metric] : null;
  const dnorm = dm ? districtNormalizer(dm) : null;
  const districtFill = (id: string) => {
    const d = DISTRICT_BY_ID[id];
    if (dm && dnorm) return heatColor(dnorm.t(dm.value(d)), theme);
    return tint(REGION_BY_ID[d.region].accent[theme], DISTRICT_TINT[id], theme);
  };
  const cityFill = dm ? 'var(--map-muted)' : REGION_BY_ID.minsk.accent[theme];

  // ── Приближение ──
  const selectedShape = selected ? SHAPES.find((s) => s.id === selected) : null;
  const districtShape = selectedDistrict ? DISTRICT_SHAPE_BY_ID[selectedDistrict] : null;
  const viewBox = districtShape
    ? viewBoxFor(districtShape.bounds, 7, 0.9)
    : selectedShape
      ? viewBoxFor(selectedShape.bounds)
      : FULL_VIEWBOX;
  // Размер подписей и маркеров в единицах viewBox, чтобы на экране он не зависел от приближения
  const k = 1 / zoomOf(viewBox);

  const focusId = districts ? null : (hovered ?? selected);
  const focusShape = focusId ? SHAPES.find((s) => s.id === focusId) : null;
  const focusDistrictId = districts ? (hoveredDistrict ?? selectedDistrict) : null;
  const focusDistrict = focusDistrictId ? DISTRICT_SHAPE_BY_ID[focusDistrictId] : null;
  const cityFocused = districts && (hovered === 'minsk' || selected === 'minsk');

  const onMove = (e: ReactPointerEvent) => {
    const el = wrapRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const z = cssZoom(el);
    setPointer({ x: (e.clientX - box.left) / z, y: (e.clientY - box.top) / z });
  };

  const valueText = (id: RegionId) => {
    if (!m) return null;
    const r = REGION_BY_ID[id];
    if (m.skipCity && r.kind === 'city') return '—';
    return fmtCompact(m.value(r), m.digits) + (m.unit === 'pct' ? '%' : '');
  };

  const tooltipRegion = hovered ? REGION_BY_ID[hovered] : null;
  const tooltipDistrict = districts && hoveredDistrict ? DISTRICT_BY_ID[hoveredDistrict] : null;

  return (
    <div
      className={`map-wrap${relief ? ' map-relief' : ''}`}
      ref={wrapRef}
      onPointerMove={onMove}
      onPointerLeave={() => setPointer(null)}
    >
      <motion.svg
        className="map-svg"
        viewBox={FULL_VIEWBOX}
        animate={{ viewBox }}
        transition={{ duration: reduce ? 0 : 0.9, ease: EASE }}
        role="group"
        aria-label={districts ? t.districtHint : t.hint}
        onClick={() => {
          onSelect(null);
          onSelectDistrict(null);
        }}
      >
        <defs>
          <filter id="lift" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#000" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* мягкая «подложка» страны */}
        <g className="map-shadow" aria-hidden>
          {SHAPES.map((s) => (
            <path key={s.id} d={s.d} />
          ))}
        </g>

        <AnimatePresence>
          {relief && (
            <motion.image
              key="relief"
              href={reliefUrl}
              x={0}
              y={0}
              width={MAP_W}
              height={MAP_H}
              preserveAspectRatio="none"
              className="relief-img"
              pointerEvents="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </AnimatePresence>

        {!districts && (
          <g key="regions">
            {SHAPES.map((s, i) => {
              const r = REGION_BY_ID[s.id];
              const dim = focusId !== null && focusId !== s.id;
              const focused = focusId === s.id;
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
                    fillOpacity: relief ? (focused ? 0.28 : 0.02) : dim ? 0.42 : 0.92,
                  }}
                  transition={{
                    pathLength: { duration: 1.6, delay: i * 0.12, ease: EASE },
                    fillOpacity: { duration: 0.5, delay: reduce || relief ? 0 : 0.9 + i * 0.1 },
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
                  onKeyDown={(e) => activate(e, () => onSelect(selected === s.id ? null : s.id))}
                />
              );
            })}
          </g>
        )}

        {districts && (
          <motion.g
            key="districts"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {DISTRICT_SHAPES.map((s) => {
              const d = DISTRICT_BY_ID[s.id];
              const focused = focusDistrictId === s.id;
              const dim = selectedDistrict !== null && selectedDistrict !== s.id;
              return (
                <path
                  key={s.id}
                  d={s.d}
                  className="district"
                  tabIndex={0}
                  role="button"
                  aria-label={l(d.name)}
                  aria-pressed={selectedDistrict === s.id}
                  style={{
                    fill: districtFill(s.id),
                    fillOpacity: relief ? (focused ? 0.34 : 0.02) : dim ? 0.55 : 0.95,
                  }}
                  onPointerEnter={() => onHoverDistrict(s.id)}
                  onPointerLeave={() => onHoverDistrict(null)}
                  onFocus={() => onHoverDistrict(s.id)}
                  onBlur={() => onHoverDistrict(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectDistrict(selectedDistrict === s.id ? null : s.id);
                  }}
                  onKeyDown={(e) => activate(e, () => onSelectDistrict(selectedDistrict === s.id ? null : s.id))}
                />
              );
            })}
            {/* г. Минск не входит ни в один район — открывает карточку столицы */}
            <path
              d={SHAPES.find((s) => s.id === 'minsk')!.d}
              className="district district-city"
              tabIndex={0}
              role="button"
              aria-label={l(REGION_BY_ID.minsk.name)}
              style={{ fill: cityFill, fillOpacity: relief ? (cityFocused ? 0.34 : 0.02) : 0.95 }}
              onPointerEnter={() => onHover('minsk')}
              onPointerLeave={() => onHover(null)}
              onFocus={() => onHover('minsk')}
              onBlur={() => onHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(selected === 'minsk' ? null : 'minsk');
              }}
              onKeyDown={(e) => activate(e, () => onSelect(selected === 'minsk' ? null : 'minsk'))}
            />
            <path d={REGION_BORDERS} className="region-border" pointerEvents="none" />
          </motion.g>
        )}

        {/* подсветка активного региона поверх остальных */}
        {focusShape && (
          <motion.path
            key={focusShape.id}
            d={focusShape.d}
            className="region-focus"
            fill={fillFor(focusShape.id)}
            fillOpacity={relief ? 0.28 : 1}
            filter={relief ? undefined : 'url(#lift)'}
            pointerEvents="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          />
        )}
        {focusDistrict && (
          <motion.path
            key={focusDistrict.id}
            d={focusDistrict.d}
            className="region-focus district-focus"
            fill={districtFill(focusDistrict.id)}
            fillOpacity={relief ? 0.34 : 1}
            filter={relief ? undefined : 'url(#lift)'}
            pointerEvents="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        )}

        {/* границы районов выбранной области */}
        <AnimatePresence>
          {!districts && selected && selected !== 'minsk' && (
            <motion.path
              key={`borders-${selected}`}
              d={DISTRICT_BORDERS[selected]}
              className="district-border"
              pointerEvents="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            />
          )}
        </AnimatePresence>

        {/* пульс лидера рейтинга */}
        {topId && !selected && (
          <motion.path
            key={`pulse-${topId}-${metric}`}
            d={SHAPES.find((s) => s.id === topId)!.d}
            className="region-pulse"
            pointerEvents="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.25, 0.85, 0.25] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {!districts && (
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
              // Подпись Минска стоит на территории Минской области — контраст считаем по ней
              const under = r.callout ? 'minsk-region' : s.id;
              const tone = relief
                ? theme === 'light'
                  ? 'label-on-light'
                  : 'label-on-dark'
                : isLightColor(fillFor(under))
                  ? 'label-on-light'
                  : 'label-on-dark';
              return (
                <motion.g
                  className={tone}
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
                    {l(r.short)}
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
        )}

        {/* подпись района — только у наведённого или выбранного */}
        {focusDistrict && (
          <g
            className={`district-label ${
              relief ? (theme === 'light' ? 'label-on-light' : 'label-on-dark') : isLightColor(districtFill(focusDistrict.id)) ? 'label-on-light' : 'label-on-dark'
            }`}
            pointerEvents="none"
          >
            <text
              x={focusDistrict.centroid[0]}
              y={focusDistrict.centroid[1]}
              className="label-name"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontSize: 15 * k, strokeWidth: 3 * k }}
            >
              {l(DISTRICT_BY_ID[focusDistrict.id].name)}
            </text>
          </g>
        )}

        {/* высшая и низшая точки страны */}
        {relief && (
          <motion.g
            className={`relief-markers ${theme === 'light' ? 'label-on-light' : 'label-on-dark'}`}
            pointerEvents="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            {RELIEF_MARKERS.map((mk) => {
              const [x, y] = project(mk.at);
              const s = 7 * k;
              const up = mk.key === 'highPoint';
              return (
                <g key={mk.key}>
                  <path
                    d={
                      up
                        ? `M${x} ${y - s} L${x + s} ${y + s * 0.7} L${x - s} ${y + s * 0.7} Z`
                        : `M${x} ${y + s} L${x + s} ${y - s * 0.7} L${x - s} ${y - s * 0.7} Z`
                    }
                    className={`relief-marker ${up ? 'relief-high' : 'relief-low'}`}
                    style={{ strokeWidth: 1.5 * k }}
                  />
                  <text
                    x={up ? x : x + s * 1.6}
                    y={up ? y + s * 2.6 : y}
                    textAnchor={up ? 'middle' : 'start'}
                    dominantBaseline="middle"
                    className="label-value"
                    style={{ fontSize: 13 * k, strokeWidth: 3 * k }}
                  >
                    {t[mk.key]} · {mk.height} {t.meters}
                  </text>
                </g>
              );
            })}
          </motion.g>
        )}
      </motion.svg>

      {pointer && (tooltipDistrict || tooltipRegion) && (
        <div
          className="tooltip"
          style={
            // у правого края тултип переходит на левую сторону от курсора, а не наезжает на него
            pointer.x + 16 + 240 > (wrapRef.current?.clientWidth ?? MAP_W)
              ? { left: pointer.x - 16, top: Math.max(pointer.y - 12, 0), transform: 'translateX(-100%)' }
              : { left: pointer.x + 16, top: Math.max(pointer.y - 12, 0) }
          }
        >
          {tooltipDistrict ? (
            <>
              <div className="tooltip-name">
                <RegionGlyph
                  id={tooltipDistrict.region}
                  color={REGION_BY_ID[tooltipDistrict.region].accent[theme]}
                  size={18}
                />{' '}
                {l(tooltipDistrict.name)}
              </div>
              <div className="tooltip-sub">{l(REGION_BY_ID[tooltipDistrict.region].name)}</div>
              <div className="tooltip-value">
                {dm ? (
                  <>
                    {t[dm.label]}:{' '}
                    <b>
                      {dm.key === 'area' ? '' : '≈ '}
                      {fmt(dm.value(tooltipDistrict), dm.digits)} {dm.unit ? t[dm.unit] : ''}
                    </b>
                  </>
                ) : (
                  <>
                    {t.population}: <b>≈ {fmt(tooltipDistrict.population)}</b>
                  </>
                )}
              </div>
            </>
          ) : (
            tooltipRegion && (
              <>
                <div className="tooltip-name">
                  <RegionGlyph id={tooltipRegion.id} color={tooltipRegion.accent[theme]} size={18} />{' '}
                  {l(tooltipRegion.name)}
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
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}
