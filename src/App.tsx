import { AnimatePresence } from 'framer-motion';
import { Map as MapIcon, Mountain } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Legend } from './components/Legend';
import { MapView } from './components/MapView';
import { MetricSwitcher } from './components/MetricSwitcher';
import { Ranking } from './components/Ranking';
import { REGION_ORDER, RegionCard } from './components/RegionCard';
import { DistrictCard, districtNeighbour } from './components/DistrictCard';
import { Segmented } from './components/Segmented';
import { REGION_BY_ID, type RegionId } from './data/regions';
import { DISTRICT_BY_ID } from './data/districts';
import { isDistrictMetric, type MetricKey } from './data/metrics';
import { useI18n } from './i18n/I18nProvider';

/** Уровень детализации карты */
export type Level = 'regions' | 'districts';
/** Вид карты: обычная раскраска или рельеф */
export type View = 'map' | 'relief';

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
  const [level, setLevel] = useState<Level>('regions');
  const [view, setView] = useState<View>('map');
  const [metric, setMetric] = useState<MetricKey | null>(null);
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [selected, setSelected] = useState<RegionId | null>(null);
  const [hovered, setHovered] = useState<RegionId | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const closeAll = () => {
    setSelected(null);
    setSelectedDistrict(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const changeLevel = (next: Level) => {
    setLevel(next);
    closeAll();
    setHovered(null);
    setHoveredDistrict(null);
    // Для районов нет зарплаты, доли горожан и числа районов
    if (next === 'districts' && metric && !isDistrictMetric(metric)) setMetric(null);
  };

  const selectRegion = (id: RegionId | null) => {
    setSelected(id);
    setSelectedDistrict(null);
  };
  const selectDistrict = (id: string | null) => {
    setSelectedDistrict(id);
    setSelected(null);
  };
  const openDistrict = (id: string) => {
    setLevel('districts');
    if (metric && !isDistrictMetric(metric)) setMetric(null);
    selectDistrict(id);
  };
  const openRegion = (id: RegionId) => {
    setLevel('regions');
    selectRegion(id);
  };

  const navigate = (dir: -1 | 1) => {
    if (!selected) return;
    const i = REGION_ORDER.indexOf(selected);
    setSelected(REGION_ORDER[(i + dir + REGION_ORDER.length) % REGION_ORDER.length]);
  };

  const region = selected ? REGION_BY_ID[selected] : null;
  const district = selectedDistrict ? DISTRICT_BY_ID[selectedDistrict] : null;
  // В режиме «Рельеф» тепловая раскраска выключена
  const shownMetric = view === 'relief' ? null : metric;

  return (
    <div className="app">
      <div className="backdrop" aria-hidden />

      <Header />

      <main className="layout">
        <section className="map-panel glass">
          <div className="map-toolbar">
            <Segmented
              id="level"
              label={t.level}
              value={level}
              onChange={changeLevel}
              options={[
                { value: 'regions', label: t.levelRegions },
                { value: 'districts', label: t.levelDistricts },
              ]}
            />
            <Segmented
              id="view"
              label={t.viewMode}
              value={view}
              onChange={setView}
              options={[
                { value: 'map', label: t.viewMap, icon: MapIcon },
                { value: 'relief', label: t.viewRelief, icon: Mountain },
              ]}
            />
          </div>
          <MetricSwitcher value={metric} onChange={setMetric} level={level} disabled={view === 'relief'} />
          <MapView
            level={level}
            view={view}
            metric={shownMetric}
            selected={selected}
            selectedDistrict={selectedDistrict}
            hovered={hovered}
            hoveredDistrict={hoveredDistrict}
            onHover={setHovered}
            onHoverDistrict={setHoveredDistrict}
            onSelect={selectRegion}
            onSelectDistrict={selectDistrict}
          />
          <Legend metric={shownMetric} level={level} view={view} />
        </section>

        <aside className="side">
          <Ranking
            level={level}
            metric={shownMetric}
            order={order}
            onOrderChange={setOrder}
            hovered={hovered}
            onHover={setHovered}
            onSelect={selectRegion}
            selectedDistrict={selectedDistrict}
            hoveredDistrict={hoveredDistrict}
            onHoverDistrict={setHoveredDistrict}
            onSelectDistrict={selectDistrict}
          />
          <AnimatePresence>
            {(district || region) && (
              <>
                {isMobile && <div className="sheet-scrim" onClick={closeAll} aria-hidden />}
                {district ? (
                  <DistrictCard
                    key="district-card"
                    district={district}
                    onClose={closeAll}
                    onNavigate={(dir) => setSelectedDistrict(districtNeighbour(district.id, dir))}
                    onOpenRegion={openRegion}
                    isMobile={isMobile}
                  />
                ) : (
                  region && (
                    <RegionCard
                      key="card"
                      region={region}
                      activeMetric={shownMetric}
                      onClose={closeAll}
                      onNavigate={navigate}
                      onOpenDistrict={openDistrict}
                      isMobile={isMobile}
                    />
                  )
                )}
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
