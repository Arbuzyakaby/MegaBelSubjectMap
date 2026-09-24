import { motion } from 'framer-motion';
import { COUNTRY } from '../data/regions';
import { useI18n } from '../i18n/I18nProvider';
import type { Lang } from '../i18n/types';
import { AnimatedNumber } from './AnimatedNumber';

interface Props {
  theme: 'dark' | 'light';
  onThemeChange: (t: 'dark' | 'light') => void;
}

export function Header({ theme, onThemeChange }: Props) {
  const { t, lang, setLang } = useI18n();
  const stats = [
    { label: t.population, value: COUNTRY.population, digits: 0, unit: t.people },
    { label: t.area, value: COUNTRY.area, digits: 0, unit: t.km2 },
    { label: t.avgSalary, value: COUNTRY.salary, digits: 1, unit: t.rub },
    { label: t.districtsTotal, value: COUNTRY.districts, digits: 0, unit: '' },
  ];

  return (
    <header className="header">
      <motion.div
        className="brand"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <span className="brand-flag" aria-hidden>
          <i />
          <i />
        </span>
        <div>
          <h1 className="brand-title">{t.title}</h1>
          <p className="brand-sub">{t.subtitle}</p>
        </div>
      </motion.div>

      <motion.dl
        className="country-stats"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } } }}
      >
        {stats.map((s) => (
          <motion.div
            key={s.label}
            className="country-stat"
            variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
          >
            <dt>{s.label}</dt>
            <dd>
              <AnimatedNumber value={s.value} digits={s.digits} duration={1.6} />
              {s.unit && <small> {s.unit}</small>}
            </dd>
          </motion.div>
        ))}
      </motion.dl>

      <div className="controls">
        <div className="segmented" role="radiogroup" aria-label={t.language}>
          {(['ru', 'be'] as Lang[]).map((code) => (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={lang === code}
              className={lang === code ? 'on' : ''}
              onClick={() => setLang(code)}
            >
              {lang === code && <motion.span layoutId="lang-bg" className="segmented-bg" />}
              <span>{code.toUpperCase()}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="icon-btn theme-btn"
          onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? t.themeLight : t.themeDark}
          title={theme === 'dark' ? t.themeLight : t.themeDark}
        >
          <motion.span key={theme} initial={{ rotate: -90, scale: 0.5 }} animate={{ rotate: 0, scale: 1 }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </motion.span>
        </button>
      </div>
    </header>
  );
}
