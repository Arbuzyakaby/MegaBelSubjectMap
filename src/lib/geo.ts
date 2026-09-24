import { geoConicConformal, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import topo from '../data/belarus.topo.json';
import type { RegionId } from '../data/regions';

export const MAP_W = 1000;
export const MAP_H = 860;
const PAD = 28;

type Props = { id: RegionId };
const topology = topo as unknown as Topology<{ regions: GeometryCollection<Props> }>;
const collection = feature(topology, topology.objects.regions) as FeatureCollection<Polygon | MultiPolygon, Props>;

// Коническая проекция с центральным меридианом Беларуси — страна выглядит «как в атласе»
const projection = geoConicConformal()
  .parallels([52, 55])
  .rotate([-28, 0])
  .fitExtent(
    [
      [PAD, PAD],
      [MAP_W - PAD, MAP_H - PAD],
    ],
    collection,
  );

const path = geoPath(projection);

export interface RegionShape {
  id: RegionId;
  d: string;
  bounds: [[number, number], [number, number]];
}

export const SHAPES: RegionShape[] = collection.features.map((f) => ({
  id: f.properties.id,
  d: path(f) ?? '',
  bounds: path.bounds(f) as RegionShape['bounds'],
}));

export function project(lonLat: [number, number]): [number, number] {
  return projection(lonLat) ?? [0, 0];
}

export const FULL_VIEWBOX = `0 0 ${MAP_W} ${MAP_H}`;

/** viewBox, приближающий к региону с запасом по краям и ограничением масштаба */
export function viewBoxFor(bounds: RegionShape['bounds'], maxZoom = 4.5): string {
  const [[x0, y0], [x1, y1]] = bounds;
  const pad = 0.18;
  let w = (x1 - x0) * (1 + pad * 2);
  let h = (y1 - y0) * (1 + pad * 2);
  // сохраняем пропорции холста
  const ratio = MAP_W / MAP_H;
  if (w / h > ratio) h = w / ratio;
  else w = h * ratio;
  const minW = MAP_W / maxZoom;
  if (w < minW) {
    w = minW;
    h = minW / ratio;
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`;
}
