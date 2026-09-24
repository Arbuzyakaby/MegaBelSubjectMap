import { motion } from 'framer-motion';
import { Layers, type LucideIcon } from 'lucide-react';
import { METRICS, type MetricKey } from '../data/metrics';
import { useI18n } from '../i18n/I18nProvider';

interface Props {
  value: MetricKey | null;
  onChange: (key: MetricKey | null) => void;
}

export function MetricSwitcher({ value, onChange }: Props) {
  const { t } = useI18n();
  const items: { key: MetricKey | null; label: string; icon: LucideIcon }[] = [
    { key: null, label: t.none, icon: Layers },
    ...METRICS.map((m) => ({ key: m.key, label: t[m.label], icon: m.icon })),
  ];

  return (
    <div className="switcher" role="radiogroup" aria-label={t.colorBy}>
      <span className="switcher-caption">{t.colorBy}</span>
      <div className="chips">
        {items.map((item) => {
          const active = item.key === value;
          return (
            <button
              key={item.key ?? 'none'}
              type="button"
              role="radio"
              aria-checked={active}
              className={`chip${active ? ' chip-active' : ''}`}
              onClick={() => onChange(item.key)}
            >
              {active && (
                <motion.span
                  layoutId="chip-bg"
                  className="chip-bg"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <item.icon className="chip-icon" size={15} strokeWidth={1.9} />
              <span className="chip-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
