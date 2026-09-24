import { AnimatePresence, motion } from 'framer-motion';
import { HEAT_STOPS, makeNormalizer, METRIC_BY_KEY, type MetricKey } from '../data/metrics';
import { useI18n } from '../i18n/I18nProvider';
import { fmt } from '../lib/format';

export function Legend({ metric }: { metric: MetricKey | null }) {
  const { t } = useI18n();
  return (
    <AnimatePresence mode="wait">
      {metric ? (
        <LegendBar key={metric} metric={metric} />
      ) : (
        <motion.p
          key="hint"
          className="legend-hint"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
        >
          {t.hint}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function LegendBar({ metric }: { metric: MetricKey }) {
  const { t } = useI18n();
  const m = METRIC_BY_KEY[metric];
  const { min, max } = makeNormalizer(m);
  const unit = m.unit ? ` ${t[m.unit]}` : '';
  return (
    <motion.div
      className="legend"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.3 }}
    >
      <span className="legend-end">
        {t.lowest} · {fmt(min, m.digits)}
        {unit}
      </span>
      <motion.span
        className="legend-bar"
        style={{ background: `linear-gradient(90deg, ${HEAT_STOPS.join(', ')})` }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
      <span className="legend-end legend-end-max">
        {fmt(max, m.digits)}
        {unit} · {t.highest}
      </span>
      {m.log && <span className="legend-note">log</span>}
    </motion.div>
  );
}
