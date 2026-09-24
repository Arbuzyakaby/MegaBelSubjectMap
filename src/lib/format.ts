const cache = new Map<number, Intl.NumberFormat>();

/** Форматирование чисел с неразрывными пробелами между разрядами: 1 995 091 */
export function fmt(value: number, digits = 0): string {
  let f = cache.get(digits);
  if (!f) {
    f = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    cache.set(digits, f);
  }
  return f.format(value);
}

/** Компактная запись для подписей на карте: 1,99 млн / 40,4 тыс. (одинаково в RU и BE) */
export function fmtCompact(value: number, digits = 0): string {
  if (value >= 1_000_000) return `${fmt(value / 1_000_000, 2)} млн`;
  if (value >= 10_000) return `${fmt(value / 1000, 1)} тыс.`;
  return fmt(value, digits);
}
