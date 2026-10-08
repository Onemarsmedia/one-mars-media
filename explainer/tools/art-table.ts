// Print the drawing of one tile as a table, to pick item / text indices for tile animations.
//   npx tsx tools/art-table.ts <tile key, e.g. filming> [live|active|empty]
// Columns: index, tag, paint (fill/stroke colour, opacity, width), bbox in tile px (x0 x1 y0 y1), sub-paths, vertices.
// Tile = 282 x 253.4 px; header (rule, number, label, tag) is y <= 56, the art panel below it.
import art from '../src/film/editorial/art.json';

type Paint = {geo: {v: number[][]; closed: boolean}[]; color: string; opacity: number; width?: number};
const [key, look = 'live'] = process.argv.slice(2);
const tiles = art.tiles as unknown as Record<string, Record<string, {items: {tag: string; fill: Paint | null; stroke: Paint | null}[]; texts: {text: string; x: number; y: number; size: number; fill: string | null}[]}>>;
if (!key || !tiles[key]) {
  console.log('tiles:', Object.keys(tiles).join(', '));
  process.exit(1);
}
const L = tiles[key][look];
const r = (n: number) => (Math.round(n * 10) / 10).toFixed(1).padStart(6);
console.log(`# ${key} / ${look}: ${L.items.length} items, ${L.texts.length} texts (tile 282 x 253.4, header y <= 56)`);
L.items.forEach((it, i) => {
  const paints = [it.fill && `fill ${it.fill.color} a${it.fill.opacity}`, it.stroke && `stroke ${it.stroke.color} a${it.stroke.opacity} w${it.stroke.width}`].filter(Boolean).join(' + ');
  const geo = [...(it.fill?.geo ?? []), ...(it.stroke?.geo ?? [])];
  const vs = geo.flatMap((g) => g.v);
  const xs = vs.map((v) => v[0]);
  const ys = vs.map((v) => v[1]);
  const sub = (it.fill ?? it.stroke)!.geo.length;
  const nv = (it.fill ?? it.stroke)!.geo.reduce((n, g) => n + g.v.length, 0);
  console.log(`${String(i).padStart(3)} ${it.tag.padEnd(8)} ${paints.padEnd(44)} x ${r(Math.min(...xs))} ${r(Math.max(...xs))}  y ${r(Math.min(...ys))} ${r(Math.max(...ys))}  sub ${sub} v ${nv}`);
});
L.texts.forEach((t, i) => console.log(`text ${String(i).padStart(2)} "${t.text}" at (${t.x.toFixed(1)}, ${t.y.toFixed(1)}) size ${t.size.toFixed(1)} ${t.fill ?? 'stroke'}`));
