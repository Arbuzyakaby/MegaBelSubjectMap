import { motion } from 'framer-motion';
import { Layers, type LucideIcon } from 'lucide-react';
import { DISTRICT_METRICS, METRICS, type MetricKey } from '../data/metrics';
import { useI18n } from '../i18n/I18nProvider';
import type { Level } from '../App';

interface Props {
  value: MetricKey | null;
  onChange: (key: MetricKey | null) => void;
  level: Level;
  /** В режиме «Рельеф» раскраска недоступна */
  disabled?: boolean;
}

export function MetricSwitcher({ value, onChange, level, disabled }: Props) {
  const { t } = useI18n();
  // Для районов есть только население, плотность и площадь
  const metrics = level === 'districts' ? DISTRICT_METRICS : METRICS;
  const items: { key: MetricKey | null; label: string; icon: LucideIcon }[] = [
    { key: null, label: level === 'districts' ? t.levelRegions : t.none, icon: Layers },
    ...metrics.map((m) => ({ key: m.key, label: t[m.label], icon: m.icon })),
  ];

  return (
    <div className={`switcher${disabled ? ' switcher-disabled' : ''}`} role="radiogroup" aria-label={t.colorBy}>
      <span className="switcher-caption">
        {t.colorBy}
        {disabled && <span className="switcher-note"> · {t.reliefNoColor}</span>}
      </span>
      <div className="chips">
        {items.map((item) => {
          const active = !disabled && item.key === value;
          return (
            <button
              key={item.key ?? 'none'}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
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
