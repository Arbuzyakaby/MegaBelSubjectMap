import { FULL_VIEWBOX, SHAPES } from '../lib/geo';
import type { RegionId } from '../data/regions';

interface Props {
  id: RegionId;
  color: string;
  size?: number;
  /** locator — вся страна с подсвеченным регионом; иначе только силуэт региона */
  variant?: 'silhouette' | 'locator';
  className?: string;
}

const SHAPE_BY_ID = Object.fromEntries(SHAPES.map((s) => [s.id, s]));

function fitViewBox(id: RegionId) {
  const [[x0, y0], [x1, y1]] = SHAPE_BY_ID[id].bounds;
  const side = Math.max(x1 - x0, y1 - y0) * 1.08;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return `${cx - side / 2} ${cy - side / 2} ${side} ${side}`;
}

/** Изображение региона, построенное из его реальной геометрии */
export function RegionGlyph({ id, color, size = 20, variant = 'silhouette', className }: Props) {
  if (variant === 'locator') {
    return (
      <svg className={className} viewBox={FULL_VIEWBOX} width={size} height={size} aria-hidden>
        {SHAPES.map((s) => (
          <path
            key={s.id}
            d={s.d}
            fill={s.id === id ? color : 'var(--glyph-muted)'}
            stroke="var(--glyph-stroke)"
            strokeWidth={6}
            strokeLinejoin="round"
          />
        ))}
      </svg>
    );
  }
  // В мелком размере силуэт города неразличим — показываем метку столицы
  if (id === 'minsk' && size < 32) {
    return (
      <svg className={className} viewBox="0 0 20 20" width={size} height={size} aria-hidden>
        <circle cx="10" cy="10" r="7.5" fill="none" stroke={color} strokeWidth="2" />
        <circle cx="10" cy="10" r="3.5" fill={color} />
      </svg>
    );
  }
  const shape = SHAPE_BY_ID[id];
  // Минск слишком мал для одиночного силуэта — рисуем его на фоне Минской области
  const context = id === 'minsk' ? SHAPE_BY_ID['minsk-region'] : null;
  const box = id === 'minsk' ? fitViewBox('minsk-region') : fitViewBox(id);
  return (
    <svg className={className} viewBox={box} width={size} height={size} aria-hidden>
      {context && <path d={context.d} fill="var(--glyph-muted)" />}
      <path d={shape.d} fill={color} />
    </svg>
  );
}
