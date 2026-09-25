import { motion, useReducedMotion, type PanInfo, type Variants } from 'framer-motion';
import { ArrowLeft, ArrowRight, Info, X } from 'lucide-react';
import { REGION_BY_ID, SOURCES, type RegionId } from '../data/regions';
import { DISTRICTS, type District } from '../data/districts';
import { DISTRICT_METRICS, districtNormalizer, districtRank } from '../data/metrics';
import { DISTRICT_SHAPES, SHAPES } from '../lib/geo';
import { useI18n } from '../i18n/I18nProvider';
import { fmt } from '../lib/format';
import { useTheme } from '../lib/theme';
import { AnimatedNumber } from './AnimatedNumber';
import { RegionGlyph } from './RegionGlyph';
import { ShareRing } from './RegionCard';

interface Props {
  district: District;
  onClose: () => void;
  onNavigate: (dir: -1 | 1) => void;
  onOpenRegion: (id: RegionId) => void;
  isMobile: boolean;
}

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.2 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

/** Короткая карточка района: площадь, население (оценка), плотность */
export function DistrictCard({ district: d, onClose, onNavigate, onOpenRegion, isMobile }: Props) {
  const { t, l } = useI18n();
  const { theme } = useTheme();
  const reduce = useReducedMotion();
  const region = REGION_BY_ID[d.region];
  const accent = region.accent[theme];
  const sharePct = (d.population / region.population) * 100;
  const without = d.without?.map(l);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return (
    <motion.article
      className="card card-district glass"
      style={{ ['--accent' as string]: accent }}
      initial={isMobile ? { y: '100%' } : { x: 40, opacity: 0 }}
      animate={isMobile ? { y: 0 } : { x: 0, opacity: 1 }}
      exit={isMobile ? { y: '100%' } : { x: 40, opacity: 0 }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
      drag={isMobile ? 'y' : false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={onDragEnd}
      aria-label={l(d.name)}
    >
      {isMobile && <div className="grabber" aria-hidden />}
      <div className="card-scroll">
        <motion.header
          key={d.id}
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
              <DistrictGlyph id={d.id} region={d.region} color={accent} size={60} />
            </motion.div>
            <RegionGlyph id={d.region} color={accent} size={60} variant="locator" className="card-locator" />
            <nav className="card-nav">
              <button type="button" className="icon-btn" onClick={() => onNavigate(-1)} aria-label={t.prevDistrict} title={t.prevDistrict}>
                <ArrowLeft size={17} strokeWidth={1.8} />
              </button>
              <button type="button" className="icon-btn" onClick={() => onNavigate(1)} aria-label={t.nextDistrict} title={t.nextDistrict}>
                <ArrowRight size={17} strokeWidth={1.8} />
              </button>
              <button type="button" className="icon-btn" onClick={onClose} aria-label={t.close} title={t.close}>
                <X size={17} strokeWidth={1.8} />
              </button>
            </nav>
          </div>
          <p className="eyebrow">
            {t.kindDistrict} ·{' '}
            <button type="button" className="link-btn" onClick={() => onOpenRegion(d.region)} title={t.openRegion}>
              {l(region.name)}
            </button>
          </p>
          <h2 className="card-title">{l(d.name)}</h2>
          <p className="card-center">
            {t.center}: {l(d.center)}
          </p>
        </motion.header>

        <motion.div key={`${d.id}-body`} variants={listVariants} initial="hidden" animate="show">
          <motion.div variants={itemVariants} className="stats stats-3">
            {DISTRICT_METRICS.map((m) => {
              const v = m.value(d);
              const rank = districtRank(m, d);
              const norm = districtNormalizer(m);
              const width = m.log ? 8 + norm.t(v) * 92 : (v / norm.max) * 100;
              const approx = m.key !== 'area';
              return (
                <div key={m.key} className="stat">
                  <div className="stat-top">
                    <span className="stat-label">
                      <m.icon size={14} strokeWidth={1.8} />
                      {t[m.label]}
                    </span>
                  </div>
                  <div className="stat-value">
                    {approx && <span className="approx">≈ </span>}
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
                  <span className={`badge${rank === 1 ? ' badge-gold' : ''}`}>
                    №{rank} {t.of} {DISTRICTS.length}
                  </span>
                </div>
              );
            })}
          </motion.div>

          {without && (
            <motion.p variants={itemVariants} className="card-note">
              <Info size={14} strokeWidth={1.8} />
              <span>
                {t.population}: {without.length > 1 ? t.withoutMany : t.withoutOne}{' '}
                {without.length > 1 ? `${without.slice(0, -1).join(', ')} ${t.and} ${without.at(-1)}` : without[0]}
              </span>
            </motion.p>
          )}

          <motion.div variants={itemVariants} className="share">
            <ShareRing pct={sharePct} />
            <div>
              <p className="share-label">{t.shareOfRegion}</p>
              <p className="share-value">≈ {fmt(sharePct, 1)}%</p>
              <p className="share-note">
                ≈ {fmt(d.population)} {t.of} {fmt(region.population)}
              </p>
            </div>
          </motion.div>

          <motion.p variants={itemVariants} className="card-note card-note-muted">
            <Info size={14} strokeWidth={1.8} />
            <span>{t.estimateNote}</span>
          </motion.p>

          <motion.div variants={itemVariants}>
            <button type="button" className="tag tag-btn" onClick={() => onOpenRegion(d.region)}>
              <RegionGlyph id={d.region} color={accent} size={16} /> {t.openRegion}: {l(region.short)}
            </button>
          </motion.div>

          <motion.p variants={itemVariants} className="card-source">
            {l(SOURCES.districts)} · {l(SOURCES.population)} · {l(SOURCES.area)}
          </motion.p>
        </motion.div>
      </div>
    </motion.article>
  );
}

/** Силуэт области с выделенным районом */
function DistrictGlyph({ id, region, color, size }: { id: string; region: RegionId; color: string; size: number }) {
  const shape = SHAPES.find((s) => s.id === region)!;
  const [[x0, y0], [x1, y1]] = shape.bounds;
  const side = Math.max(x1 - x0, y1 - y0) * 1.08;
  const box = `${(x0 + x1) / 2 - side / 2} ${(y0 + y1) / 2 - side / 2} ${side} ${side}`;
  return (
    <svg viewBox={box} width={size} height={size} aria-hidden>
      {DISTRICT_SHAPES.filter((s) => s.region === region).map((s) => (
        <path
          key={s.id}
          d={s.d}
          fill={s.id === id ? color : 'var(--glyph-muted)'}
          stroke="var(--glyph-stroke)"
          strokeWidth={side / 90}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/** Порядок перехода ← → внутри области: по алфавиту (русское название) */
export function districtNeighbour(id: string, dir: -1 | 1): string {
  const d = DISTRICTS.find((x) => x.id === id)!;
  const list = DISTRICTS.filter((x) => x.region === d.region).sort((a, b) => a.name.ru.localeCompare(b.name.ru, 'ru'));
  const i = list.findIndex((x) => x.id === id);
  return list[(i + dir + list.length) % list.length].id;
}
