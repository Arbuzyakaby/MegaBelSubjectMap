import { AnimatePresence, motion } from 'framer-motion';
import {
  DISTRICT_METRIC_BY_KEY,
  districtNormalizer,
  heatStops,
  isDistrictMetric,
  makeNormalizer,
  METRIC_BY_KEY,
  type MetricKey,
} from '../data/metrics';
import { useI18n } from '../i18n/I18nProvider';
import { fmt } from '../lib/format';
import { useTheme } from '../lib/theme';
import { RELIEF_MAX, RELIEF_MIN, reliefGradient } from '../lib/relief';
import type { Level, View } from '../App';

interface Props {
  metric: MetricKey | null;
  level: Level;
  view: View;
}

const fade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.3 },
};

export function Legend({ metric, level, view }: Props) {
  const { t } = useI18n();
  const districts = level === 'districts';
  let content;
  if (view === 'relief') content = <ReliefBar key="relief" />;
  else if (metric && (!districts || isDistrictMetric(metric)))
    content = <LegendBar key={`${level}-${metric}`} metric={metric} districts={districts} />;
  else
    content = (
      <motion.p key={`hint-${level}`} className="legend-hint" {...fade}>
        {districts ? t.districtHint : t.hint}
      </motion.p>
    );
  return <AnimatePresence mode="wait">{content}</AnimatePresence>;
}

function ReliefBar() {
  const { t } = useI18n();
  return (
    <motion.div className="legend legend-relief" {...fade}>
      <span className="legend-end">
        {t.elevation} · {RELIEF_MIN} {t.meters}
      </span>
      <motion.span
        className="legend-bar"
        style={{ background: reliefGradient }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
      <span className="legend-end legend-end-max">
        {RELIEF_MAX} {t.meters}
      </span>
      <span className="legend-note legend-note-wide">{t.reliefHint}</span>
    </motion.div>
  );
}

function LegendBar({ metric, districts }: { metric: MetricKey; districts: boolean }) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const m = districts && isDistrictMetric(metric) ? DISTRICT_METRIC_BY_KEY[metric] : METRIC_BY_KEY[metric];
  const { min, max } = districts && isDistrictMetric(metric) ? districtNormalizer(DISTRICT_METRIC_BY_KEY[metric]) : makeNormalizer(METRIC_BY_KEY[metric]);
  const unit = m.unit ? ` ${t[m.unit]}` : '';
  // Население районов — оценка
  const approx = districts && metric !== 'area' ? '≈ ' : '';
  return (
    <motion.div className="legend" {...fade}>
      <span className="legend-end">
        {t.lowest} · {approx}
        {fmt(min, m.digits)}
        {unit}
      </span>
      <motion.span
        className="legend-bar"
        style={{ background: `linear-gradient(90deg, ${heatStops(theme).join(', ')})` }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
      <span className="legend-end legend-end-max">
        {approx}
        {fmt(max, m.digits)}
        {unit} · {t.highest}
      </span>
      {m.log && <span className="legend-note">log</span>}
    </motion.div>
  );
}
