import { AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Legend } from './components/Legend';
import { MapView } from './components/MapView';
import { MetricSwitcher } from './components/MetricSwitcher';
import { Ranking } from './components/Ranking';
import { REGION_ORDER, RegionCard } from './components/RegionCard';
import { REGION_BY_ID, type RegionId } from './data/regions';
import type { MetricKey } from './data/metrics';
import { useI18n } from './i18n/I18nProvider';

function useIsMobile(query = '(max-width: 1023px)') {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

export default function App() {
  const { t } = useI18n();
  const [metric, setMetric] = useState<MetricKey | null>(null);
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [selected, setSelected] = useState<RegionId | null>(null);
  const [hovered, setHovered] = useState<RegionId | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navigate = (dir: -1 | 1) => {
    if (!selected) return;
    const i = REGION_ORDER.indexOf(selected);
    setSelected(REGION_ORDER[(i + dir + REGION_ORDER.length) % REGION_ORDER.length]);
  };

  const region = selected ? REGION_BY_ID[selected] : null;

  return (
    <div className="app">
      <div className="backdrop" aria-hidden />

      <Header />

      <main className="layout">
        <section className="map-panel glass">
          <MetricSwitcher value={metric} onChange={setMetric} />
          <MapView
            metric={metric}
            selected={selected}
            hovered={hovered}
            onHover={setHovered}
            onSelect={setSelected}
          />
          <Legend metric={metric} />
        </section>

        <aside className="side">
          <Ranking
            metric={metric}
            order={order}
            onOrderChange={setOrder}
            hovered={hovered}
            onHover={setHovered}
            onSelect={setSelected}
          />
          <AnimatePresence>
            {region && (
              <>
                {isMobile && <div className="sheet-scrim" onClick={() => setSelected(null)} aria-hidden />}
                <RegionCard
                  key="card"
                  region={region}
                  activeMetric={metric}
                  onClose={() => setSelected(null)}
                  onNavigate={navigate}
                  isMobile={isMobile}
                />
              </>
            )}
          </AnimatePresence>
        </aside>
      </main>

      <footer className="footer">
        <b>{t.sources}:</b> {t.sourcesText}
      </footer>
    </div>
  );
}
