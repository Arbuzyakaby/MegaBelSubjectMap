import { motion, useReducedMotion, type PanInfo, type Variants } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Camera, Factory, Landmark, X, type LucideIcon } from 'lucide-react';
import { COUNTRY, REGIONS, SOURCES, type Region } from '../data/regions';
import { makeNormalizer, METRICS, rankOf, regionsFor, type MetricKey } from '../data/metrics';
import { useI18n } from '../i18n/I18nProvider';
import { fmt } from '../lib/format';
import { AnimatedNumber } from './AnimatedNumber';
import { RegionGlyph } from './RegionGlyph';
import { useTheme } from '../lib/theme';

interface Props {
  region: Region;
  activeMetric: MetricKey | null;
  onClose: () => void;
  onNavigate: (dir: -1 | 1) => void;
  isMobile: boolean;
}

const CURRENT_YEAR = 2026;

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

export function RegionCard({ region: r, activeMetric, onClose, onNavigate, isMobile }: Props) {
  const { t, l } = useI18n();
  const { theme } = useTheme();
  const accent = r.accent[theme];
  const reduce = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [r.id]);

  const urbanPct = (r.urban / r.population) * 100;
  const sharePct = (r.population / COUNTRY.population) * 100;
  const isCity = r.kind === 'city';

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return (
    <motion.article
      className="card glass"
      style={{ ['--accent' as string]: accent }}
      initial={isMobile ? { y: '100%' } : { x: 40, opacity: 0 }}
      animate={isMobile ? { y: 0 } : { x: 0, opacity: 1 }}
      exit={isMobile ? { y: '100%' } : { x: 40, opacity: 0 }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
      drag={isMobile ? 'y' : false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={onDragEnd}
      aria-label={l(r.name)}
    >
      {isMobile && <div className="grabber" aria-hidden />}
      <div className="card-scroll" ref={scrollRef}>
        <motion.header
          key={r.id}
          className="card-hero"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="card-top">
            <motion.div
              className="card-art"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <RegionGlyph id={r.id} color={accent} size={60} />
            </motion.div>
            <RegionGlyph id={r.id} color={accent} size={60} variant="locator" className="card-locator" />
            {/* Кнопки в обычном потоке, а не поверх иллюстрации — чтобы ничего не перекрывало клики */}
            <nav className="card-nav">
              <button type="button" className="icon-btn" onClick={() => onNavigate(-1)} aria-label={t.prev} title={t.prev}>
                <ArrowLeft size={17} strokeWidth={1.8} />
              </button>
              <button type="button" className="icon-btn" onClick={() => onNavigate(1)} aria-label={t.next} title={t.next}>
                <ArrowRight size={17} strokeWidth={1.8} />
              </button>
              <button type="button" className="icon-btn" onClick={onClose} aria-label={t.close} title={t.close}>
                <X size={17} strokeWidth={1.8} />
              </button>
            </nav>
          </div>
          <p className="eyebrow">
            {isCity ? t.kindCity : t.kindOblast} · {l(r.since.label)} {r.since.year} ·{' '}
            {CURRENT_YEAR - r.since.year} {t.yearsAgo}
          </p>
          <h2 className="card-title">{l(r.name)}</h2>
          <p className="card-tagline">{l(r.tagline)}</p>
          <p className="card-center">
            {t.center}: {l(r.center)}
          </p>
        </motion.header>

        <motion.div key={`${r.id}-body`} variants={listVariants} initial="hidden" animate="show">
          <motion.p variants={itemVariants} className="card-desc">
            {l(r.description)}
          </motion.p>

          <motion.div variants={itemVariants} className="stats">
            {METRICS.map((m) => {
              const na = m.skipCity && isCity;
              const v = m.value(r);
              const rank = rankOf(m, r);
              const total = regionsFor(m).length;
              const norm = makeNormalizer(m);
              const width = na ? 0 : m.log ? 8 + norm.t(v) * 92 : (v / norm.max) * 100;
              const vsAvg = ['salary', 'density', 'urbanShare'].includes(m.key)
                ? ((v - m.country) / m.country) * 100
                : null;
              return (
                <div key={m.key} className={`stat${activeMetric === m.key ? ' stat-active' : ''}`}>
                  <div className="stat-top">
                    <span className="stat-label">
                      <m.icon size={14} strokeWidth={1.8} />
                      {m.key === 'districts' && isCity ? t.cityDistricts : t[m.label]}
                    </span>
                    {rank && (
                      <span className={`badge${rank === 1 ? ' badge-gold' : ''}`}>
                        №{rank} {t.of} {total}
                      </span>
                    )}
                  </div>
                  <div className="stat-value">
                    <AnimatedNumber value={v} digits={m.digits} />
                    {m.unit && <small> {t[m.unit]}</small>}
                  </div>
                  <div className="stat-track">
                    <motion.span
                      className="stat-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%` }}
                      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                    />
                  </div>
                  {vsAvg !== null && (
                    <span className={`stat-delta ${vsAvg >= 0 ? 'up' : 'down'}`}>
                      {vsAvg > 200
                        ? `▲ ×${fmt(v / m.country, 0)}`
                        : `${vsAvg >= 0 ? '▲' : '▼'} ${fmt(Math.abs(vsAvg), 1)}%`}{' '}
                      {t.vsAverage}
                    </span>
                  )}
                </div>
              );
            })}
          </motion.div>

          <motion.section variants={itemVariants} className="block">
            <h3 className="block-title">{t.structure}</h3>
            <div className="structure">
              <div className="structure-bar">
                <motion.span
                  className="structure-urban"
                  initial={{ width: 0 }}
                  animate={{ width: `${urbanPct}%` }}
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                />
              </div>
              <div className="structure-legend">
                <span>
                  <i className="dot dot-urban" /> {t.urban}: <b>{fmt(r.urban)}</b> ({fmt(urbanPct, 1)}%)
                </span>
                <span>
                  <i className="dot dot-rural" /> {t.rural}: <b>{fmt(r.rural)}</b> ({fmt(100 - urbanPct, 1)}%)
                </span>
              </div>
            </div>
            <div className="share">
              <ShareRing pct={sharePct} />
              <div>
                <p className="share-label">{t.shareOfCountry}</p>
                <p className="share-value">{fmt(sharePct, 1)}%</p>
                <p className="share-note">
                  {fmt(r.population)} {t.of} {fmt(COUNTRY.population)}
                </p>
              </div>
            </div>
          </motion.section>

          <motion.section variants={itemVariants} className="block">
            <h3 className="block-title">{t.facts}</h3>
            <motion.ol className="facts" variants={listVariants} initial="hidden" animate="show">
              {r.facts.map((f, i) => (
                <motion.li key={i} variants={itemVariants} className="fact">
                  <span className="fact-num">{String(i + 1).padStart(2, '0')}</span>
                  <span>{l(f)}</span>
                </motion.li>
              ))}
            </motion.ol>
          </motion.section>

          <ChipBlock title={t.sights} icon={Camera} items={r.sights.map(l)} />
          {r.cities.length > 0 && <ChipBlock title={t.cities} icon={Landmark} items={r.cities.map(l)} />}
          <ChipBlock title={t.industry} icon={Factory} items={r.industry.map(l)} />

          <motion.p variants={itemVariants} className="card-source">
            {l(SOURCES.population)} · {l(SOURCES.salary)} · {l(SOURCES.area)}
          </motion.p>
        </motion.div>
      </div>
    </motion.article>
  );
}

function ChipBlock({ title, icon: Icon, items }: { title: string; icon: LucideIcon; items: string[] }) {
  return (
    <motion.section variants={itemVariants} className="block">
      <h3 className="block-title">
        <Icon size={14} strokeWidth={1.8} /> {title}
      </h3>
      <div className="tags">
        {items.map((s) => (
          <span key={s} className="tag">
            {s}
          </span>
        ))}
      </div>
    </motion.section>
  );
}

function ShareRing({ pct }: { pct: number }) {
  const R = 30;
  const C = 2 * Math.PI * R;
  return (
    <svg className="ring" viewBox="0 0 80 80" aria-hidden>
      <circle cx="40" cy="40" r={R} className="ring-bg" />
      <motion.circle
        cx="40"
        cy="40"
        r={R}
        className="ring-fg"
        strokeDasharray={C}
        initial={{ strokeDashoffset: C }}
        animate={{ strokeDashoffset: C * (1 - pct / 100) }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
        transform="rotate(-90 40 40)"
      />
    </svg>
  );
}

export const REGION_ORDER = REGIONS.map((r) => r.id);
