// Write src/film/editorial/tileAnims.ts from a JSON set of tile specs ({tiles: [{tile, idea, anims: [...]}]}),
// keeping each animation's "why" as a comment. The header and the TileAnim type are kept from the current file.
//   npx tsx tools/write-tile-anims.ts specs.json
import fs from 'node:fs';

const target = 'src/film/editorial/tileAnims.ts';
const set = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) as {tiles: Array<{tile: string; idea: string; anims: Array<Record<string, unknown>>}>};
const src = fs.readFileSync(target, 'utf8');
const head = src.slice(0, src.indexOf('export const TILE_ANIMS'));
const order = ['concept', 'storyboard', 'filming', 'editing', 'motion', 'design', 'podcast', 'social', 'web', 'apps', 'ai', 'distribution'];
const KEYS = ['kind', 'items', 'text', 'path', 'delay', 'dur', 'stagger', 'period', 'phase', 'dx', 'dy', 'scale', 'amp', 'deg', 'min', 'spread', 'anchor', 'axis', 'from', 'to', 'offsets', 'hold', 'cps', 'rate', 'pivot'];
const wrap = (s: string, ind: string) => s.replace(/\s+/g, ' ').match(/.{1,110}(\s|$)/g)!.map((l) => `${ind}// ${l.trim()}`).join('\n');
const lines: string[] = ['export const TILE_ANIMS: Record<string, TileAnim[]> = {'];
for (const key of order) {
  const t = set.tiles.find((x) => x.tile === key);
  if (!t) continue;
  lines.push(wrap(`${key.toUpperCase()}: ${t.idea}`, '  '));
  lines.push(`  ${key}: [`);
  for (const a of t.anims) {
    if (a.why) lines.push(wrap(String(a.why), '    '));
    const parts = KEYS.filter((k) => a[k] !== undefined && a[k] !== null).map((k) => `${k}: ${JSON.stringify(a[k])}`.replace(/"([a-z]+)"(?=,|$)/g, "'$1'"));
    lines.push(`    {${parts.join(', ')}},`);
  }
  lines.push('  ],');
}
lines.push('};', '');
fs.writeFileSync(target, head + lines.join('\n'));
console.log(`wrote ${target}: ${set.tiles.length} tiles`);
