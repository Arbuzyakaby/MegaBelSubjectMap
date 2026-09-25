// Шкала высот подложки «Рельеф» — синхронно со STOPS в scripts/build-relief.mjs
export const RELIEF_STOPS: [number, string][] = [
  [80, 'rgb(86, 140, 88)'],
  [130, 'rgb(128, 170, 104)'],
  [170, 'rgb(182, 200, 128)'],
  [210, 'rgb(226, 214, 140)'],
  [250, 'rgb(212, 176, 108)'],
  [295, 'rgb(176, 128, 80)'],
  [345, 'rgb(128, 88, 62)'],
];

export const RELIEF_MIN = RELIEF_STOPS[0][0];
export const RELIEF_MAX = RELIEF_STOPS[RELIEF_STOPS.length - 1][0];

/** CSS-градиент шкалы с позициями, пропорциональными высоте */
export const reliefGradient = `linear-gradient(90deg, ${RELIEF_STOPS.map(
  ([h, c]) => `${c} ${(((h - RELIEF_MIN) / (RELIEF_MAX - RELIEF_MIN)) * 100).toFixed(1)}%`,
).join(', ')})`;

export interface ReliefMarker {
  key: 'highPoint' | 'lowPoint';
  at: [number, number];
  height: number;
}

export const RELIEF_MARKERS: ReliefMarker[] = [
  // Дзержинская гора — высшая точка страны
  { key: 'highPoint', at: [27.1458, 53.8756], height: 345 },
  // Урез Немана на границе с Литвой — низшая точка
  { key: 'lowPoint', at: [23.93, 53.96], height: 80 },
];
