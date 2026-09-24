/** Светлый ли цвет (относительная яркость WCAG) — для выбора цвета подписи поверх заливки.
 *  Понимает `#rrggbb` и `rgb(r, g, b)`; CSS-переменные считаются тёмными. */
export function isLightColor(color: string): boolean {
  let rgb: number[] | null = null;
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) rgb = [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const fn = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color);
  if (fn) rgb = fn.slice(1, 4).map(Number);
  if (!rgb) return false;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3;
}
