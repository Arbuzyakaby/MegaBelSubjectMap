import { geoConicConformal, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import topo from '../data/belarus.topo.json';
import type { RegionId } from '../data/regions';

// Эти константы читает и scripts/build-relief.mjs — растр рельефа строится в той же проекции
export const MAP_W = 1000;
export const MAP_H = 860;
const PAD = 28;

type RegionProps = { id: RegionId };
type DistrictProps = { id: string; region: RegionId };
const topology = topo as unknown as Topology<{
  regions: GeometryCollection<RegionProps>;
  districts: GeometryCollection<DistrictProps>;
}>;
const regions = feature(topology, topology.objects.regions) as FeatureCollection<Polygon | MultiPolygon, RegionProps>;
const districts = feature(topology, topology.objects.districts) as FeatureCollection<
  Polygon | MultiPolygon,
  DistrictProps
>;

// Коническая проекция с центральным меридианом Беларуси — страна выглядит «как в атласе»
const projection = geoConicConformal()
  .parallels([52, 55])
  .rotate([-28, 0])
  .fitExtent(
    [
      [PAD, PAD],
      [MAP_W - PAD, MAP_H - PAD],
    ],
    regions,
  );

const path = geoPath(projection);

type Bounds = [[number, number], [number, number]];

export interface RegionShape {
  id: RegionId;
  d: string;
  bounds: Bounds;
}

export interface DistrictShape {
  id: string;
  region: RegionId;
  d: string;
  bounds: Bounds;
  /** Точка для подписи — центр тяжести полигона */
  centroid: [number, number];
}

export const SHAPES: RegionShape[] = regions.features.map((f) => ({
  id: f.properties.id,
  d: path(f) ?? '',
  bounds: path.bounds(f) as Bounds,
}));

/** 118 районов (г. Минск в этот список не входит — он есть в SHAPES) */
export const DISTRICT_SHAPES: DistrictShape[] = districts.features
  .filter((f) => f.properties.region !== 'minsk')
  .map((f) => ({
    id: f.properties.id,
    region: f.properties.region,
    d: path(f) ?? '',
    bounds: path.bounds(f) as Bounds,
    centroid: path.centroid(f) as [number, number],
  }));

export const DISTRICT_SHAPE_BY_ID: Record<string, DistrictShape> = Object.fromEntries(
  DISTRICT_SHAPES.map((s) => [s.id, s]),
);

/** Все границы областей (включая внешний контур) одним путём */
export const REGION_BORDERS = path(mesh(topology, topology.objects.regions)) ?? '';

const regionOf = (g: { properties?: unknown }) => (g.properties as DistrictProps).region;

/** Внутренние границы районов для каждой области */
export const DISTRICT_BORDERS = Object.fromEntries(
  SHAPES.map((s) => [
    s.id,
    path(
      mesh(
        topology,
        topology.objects.districts,
        (a, b) => a !== b && regionOf(a) === s.id && regionOf(b) === s.id,
      ),
    ) ?? '',
  ]),
) as Record<RegionId, string>;

export function project(lonLat: [number, number]): [number, number] {
  return projection(lonLat) ?? [0, 0];
}

export const FULL_VIEWBOX = `0 0 ${MAP_W} ${MAP_H}`;

/** viewBox, приближающий к региону с запасом по краям (pad — доля размера с каждой стороны)
 *  и ограничением масштаба */
export function viewBoxFor(bounds: Bounds, maxZoom = 4.5, pad = 0.18): string {
  const [[x0, y0], [x1, y1]] = bounds;
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

/** Во сколько раз viewBox меньше полного холста (1 — вся страна) */
export function zoomOf(viewBox: string): number {
  return MAP_W / Number(viewBox.split(' ')[2]);
}
