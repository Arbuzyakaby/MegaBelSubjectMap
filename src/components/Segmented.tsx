import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface Props<T extends string> {
  /** Уникальный id для анимации подложки (framer-motion layoutId) */
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (value: T) => void;
}

/** Сегментный переключатель в стиле RU/BE из шапки */
export function Segmented<T extends string>({ id, label, value, options, onChange }: Props<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {value === o.value && <motion.span layoutId={`${id}-bg`} className="segmented-bg" />}
          <span className="segmented-label">
            {o.icon && <o.icon size={14} strokeWidth={1.9} />}
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}
