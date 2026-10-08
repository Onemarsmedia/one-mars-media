// Extract the approved Editorial tile drawings as plain vector primitives.
//
// design/editorial/frames.html draws every tile with SVG helper functions. Rather than redraw them by
// hand, we let Chromium build each tile, then walk the SVG: every shape becomes a path (paper.js),
// transformed into tile space and clipped by its clip-paths (boolean intersection, so the result is
// clean vector with no masks), and every text keeps its exact position, font and colour.
//
// node tools/extract-art.mjs  ->  src/film/editorial/art.json
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
// Playwright comes preinstalled globally in this environment (matches /opt/pw-browsers).
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const paperPath = require.resolve('paper/dist/paper-core.js');
const BROWSER = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const page_ = path.resolve('design/editorial/frames.html');
const out = path.resolve('src/film/editorial/art.json');

const browser = await chromium.launch({executablePath: BROWSER});
const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
page.on('console', (m) => m.type() === 'error' && console.log('page:', m.text()));
await page.goto('file://' + page_ + '?frame=f3');
await page.waitForFunction(() => window.__ready === true);
await page.addScriptTag({path: paperPath});

const result = await page.evaluate(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const canvas = document.createElement('canvas');
  paper.setup(canvas);
  const hex = (c) => {
    const m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a] = m[1].split(',').map((s) => parseFloat(s));
    if (a === 0) return null;
    return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const alphaOf = (c) => {
    const m = c && c.match(/rgba\(([^)]+)\)/);
    return m ? parseFloat(m[1].split(',')[3]) : 1;
  };
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const warnings = [];

  function toPaper(el) {
    const g = (a) => parseFloat(el.getAttribute(a) || '0');
    switch (el.tagName) {
      case 'rect': {
        const rx = g('rx');
        return new paper.Path.Rectangle({point: [g('x'), g('y')], size: [g('width'), g('height')], radius: rx || 0, insert: false});
      }
      case 'circle':
        return new paper.Path.Circle({center: [g('cx'), g('cy')], radius: g('r'), insert: false});
      case 'ellipse':
        return new paper.Path.Ellipse({center: [g('cx'), g('cy')], radius: [g('rx'), g('ry')], insert: false});
      case 'line':
        return new paper.Path({segments: [[g('x1'), g('y1')], [g('x2'), g('y2')]], insert: false});
      case 'polyline':
      case 'polygon': {
        const pts = el.getAttribute('points').trim().split(/[\s,]+/).map(Number);
        const segs = [];
        for (let i = 0; i < pts.length; i += 2) segs.push([pts[i], pts[i + 1]]);
        return new paper.Path({segments: segs, closed: el.tagName === 'polygon', insert: false});
      }
      case 'path':
        return new paper.CompoundPath({pathData: el.getAttribute('d'), insert: false});
    }
    return null;
  }

  function relMatrix(root, el) {
    const m = root.getScreenCTM().inverse().multiply(el.getScreenCTM());
    return new paper.Matrix(m.a, m.b, m.c, m.d, m.e, m.f);
  }

  /** Clip regions from the element and its ancestors, in root space. */
  function clipsFor(root, el) {
    const clips = [];
    for (let n = el; n && n !== root; n = n.parentNode) {
      const ref = n.getAttribute && n.getAttribute('clip-path');
      if (!ref) continue;
      const id = ref.match(/url\(#([^)]+)\)/)[1];
      const cp = root.querySelector('#' + CSS.escape(id));
      const m = relMatrix(root, n.tagName === 'g' || n.tagName === 'text' ? n : n);
      for (const shape of cp.children) {
        const p = toPaper(shape);
        if (p) {
          p.transform(m);
          clips.push(p);
        }
      }
    }
    return clips;
  }

  function exportPath(item) {
    const paths = item instanceof paper.CompoundPath ? item.children : [item];
    return paths
      .filter((p) => p.segments && p.segments.length > 1)
      .map((p) => ({
        v: p.segments.map((s) => [r3(s.point.x), r3(s.point.y)]),
        i: p.segments.map((s) => [r3(s.handleIn.x), r3(s.handleIn.y)]),
        o: p.segments.map((s) => [r3(s.handleOut.x), r3(s.handleOut.y)]),
        closed: !!p.closed,
      }));
  }

  function effOpacity(root, el) {
    let o = 1;
    for (let n = el; n && n !== root; n = n.parentNode) {
      const op = n.getAttribute && n.getAttribute('opacity');
      if (op !== null && op !== undefined && op !== '') o *= parseFloat(op);
    }
    return o;
  }

  function walk(markup, w, h) {
    const host = document.createElement('div');
    host.innerHTML = `<svg xmlns="${NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${markup}</svg>`;
    document.body.appendChild(host);
    const root = host.firstChild;
    const items = [];
    const texts = [];
    const els = root.querySelectorAll('rect,circle,ellipse,line,polyline,polygon,path,text');
    for (const el of els) {
      if (el.closest('clipPath') || el.closest('defs')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const m = relMatrix(root, el);
      const scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
      const opacity = effOpacity(root, el);
      const fill = hex(cs.fill);
      const stroke = hex(cs.stroke);
      const fillOpacity = parseFloat(cs.fillOpacity) * alphaOf(cs.fill) * opacity;
      const strokeOpacity = parseFloat(cs.strokeOpacity) * alphaOf(cs.stroke) * opacity;
      const strokeWidth = parseFloat(cs.strokeWidth) * scale;
      if (el.tagName === 'text') {
        if (el.querySelector('tspan')) warnings.push('tspan in text: ' + el.textContent);
        const x = parseFloat(el.getAttribute('x') || '0');
        const y = parseFloat(el.getAttribute('y') || '0');
        const p = m.transform(new paper.Point(x, y));
        const rot = (Math.atan2(m.b, m.a) * 180) / Math.PI;
        const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
        if (clipsFor(root, el).length) {
          const bb = el.getBBox();
          const cr = clipsFor(root, el)[0].bounds;
          const tb = new paper.Rectangle(bb.x, bb.y, bb.width, bb.height).transform ? null : null;
          void tb;
          void cr;
        }
        texts.push({
          text: el.textContent,
          x: r3(p.x),
          y: r3(p.y),
          rotation: r3(rot),
          family: cs.fontFamily.replace(/["']/g, '').split(',')[0].trim(),
          weight: parseInt(cs.fontWeight, 10),
          size: r3(parseFloat(cs.fontSize) * scale),
          letterSpacing: r3(ls * scale),
          anchor: cs.textAnchor,
          fill: fill,
          fillOpacity: r3(fillOpacity),
          stroke: stroke,
          strokeWidth: r3(stroke ? strokeWidth : 0),
          strokeOpacity: r3(strokeOpacity),
        });
        continue;
      }
      let item = toPaper(el);
      if (!item) continue;
      item.transform(m);
      const clips = clipsFor(root, el);
      const out = {fill: null, stroke: null};
      const base = item;
      if (fill && fillOpacity > 0) {
        let f = base.clone({insert: false});
        if (!f.closed && !(f instanceof paper.CompoundPath)) f.closed = true;
        for (const c of clips) {
          if (!c.bounds.contains(f.bounds)) f = f.intersect(c, {insert: false});
        }
        const geo = exportPath(f);
        if (geo.length && Math.abs(f.area || 0) > 0.01) out.fill = {geo, color: fill, opacity: r3(fillOpacity)};
      }
      if (stroke && strokeOpacity > 0 && strokeWidth > 0) {
        let s = base.clone({insert: false});
        for (const c of clips) {
          if (c.bounds.contains(s.strokeBounds || s.bounds)) continue;
          if (s.closed || s instanceof paper.CompoundPath) {
            // clip a closed outline as open strokes
            const parts = (s instanceof paper.CompoundPath ? s.children : [s]).map((p) => {
              const q = p.clone({insert: false});
              q.closed = false;
              q.add(q.firstSegment.point.clone());
              return q;
            });
            s = new paper.CompoundPath({children: parts, insert: false});
          }
          s = s.intersect(c, {trace: false, insert: false});
        }
        const geo = exportPath(s);
        if (geo.length) {
          const dash = cs.strokeDasharray && cs.strokeDasharray !== 'none' ? cs.strokeDasharray.split(/[\s,]+/).map((v) => parseFloat(v) * scale) : null;
          out.stroke = {
            geo,
            color: stroke,
            opacity: r3(strokeOpacity),
            width: r3(strokeWidth),
            cap: cs.strokeLinecap,
            join: cs.strokeLinejoin,
            dash,
          };
        }
      }
      if (out.fill || out.stroke) items.push({tag: el.tagName, ...out});
    }
    host.remove();
    return {items, texts};
  }

  const tiles = {};
  for (let i = 0; i < 12; i++) {
    const [num, name, fn] = TILES[i];
    tiles[fn] = {num, name};
    for (const state of ['live', 'active', 'empty']) {
      // tile() returns a group translated to (x, y); place it at 0,0
      tiles[fn][state] = walk(tile(i, 0, 0, state), TW, TH_);
    }
  }
  return {tile: {w: TW, h: TH_, head: HEAD, panelH: PANEL_H, labelX: LBX}, tiles, warnings};
});

fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, JSON.stringify(result));
let nItems = 0;
let nTexts = 0;
for (const t of Object.values(result.tiles)) for (const s of ['live', 'active', 'empty']) {
  nItems += t[s].items.length;
  nTexts += t[s].texts.length;
}
console.log(`wrote ${out}: ${nItems} shapes, ${nTexts} texts, ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
if (result.warnings.length) console.log('warnings:', [...new Set(result.warnings)].join(' | '));
await browser.close();
