import {bezierToAe} from '../src/scene/ease';
import {hexToRgb01, isAnimated, isLinked, isLinkedVec} from '../src/scene/eval';
import {baseText} from '../src/scene/text';
import type {
  Animated,
  Comp,
  Effect,
  Geometry,
  Key,
  Layer,
  Linked,
  LinkedVec2,
  Num,
  PathData,
  Prop,
  Scene,
  ShapeItem,
  TextLayer,
  Vec2,
} from '../src/scene/types';

// Scene -> ExtendScript (.jsx) that rebuilds the film as a native, editable After Effects project.
//
// All maths (eases, colours, timing) happens here in TypeScript; the generated script only applies
// precomputed values, which keeps the ES3 side small and easy to verify. ae/mock runs the output
// against a recording mock of the AE object model (tests/ae-roundtrip.test.ts).
//
// Output must be ES3: var/function only, no JSON object, no trailing commas, ASCII-only source.

export interface ManifestEntry {
  /** Path as the mock records it: comp/layer/matchName/index/... */
  path: string;
  prop: Num | Prop<Vec2> | LinkedVec2;
  /** For separated position: which dimension this AE property carries. */
  dim?: 0 | 1;
  /** Value scale applied on the way out (e.g. colour or opacity conversions). */
  spatial?: boolean;
  fps: number;
}

export interface EmitResult {
  jsx: string;
  manifest: ManifestEntry[];
}

// 8 decimals: frame times like 20/30 s must survive exactly enough for AE to land on the frame.
const num = (n: number) => Math.round(n * 1e8) / 1e8;

/** ASCII-only JS string literal (non-ASCII as \uXXXX) safe for ExtendScript. */
export function jsStr(s: string): string {
  let out = '"';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (c < 0x20 || c > 0x7e) {
      if (c > 0xffff) {
        const hi = Math.floor((c - 0x10000) / 0x400) + 0xd800;
        const lo = ((c - 0x10000) % 0x400) + 0xdc00;
        out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
      } else out += `\\u${c.toString(16).padStart(4, '0')}`;
    } else out += ch;
  }
  return out + '"';
}

function lit(v: unknown): string {
  if (typeof v === 'number') return String(num(v));
  if (typeof v === 'string') return jsStr(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return '[' + v.map(lit).join(',') + ']';
  return '{' + Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}:${lit(x)}`).join(',') + '}';
}

type EaseSide = [number, number]; // [speed, influence%]
type KeyRow = [number, number | number[], string, string, EaseSide[], EaseSide[]];

/**
 * Convert DSL keys into AE key rows: [timeSec, value, inType, outType, inEase[], outEase[]].
 * `dims` is the number of value dimensions; `spatial` = one ease along the path (AE spatial props).
 */
function keyRows<T extends number | Vec2>(keys: Key<T>[], fps: number, spatial: boolean, map: (v: T) => number | number[]): KeyRow[] {
  const vals = keys.map((k) => map(k.v));
  const n = keys.length;
  const asArr = (v: number | number[]) => (Array.isArray(v) ? v : [v]);
  const dimCount = asArr(vals[0]).length;
  const rows: KeyRow[] = keys.map((k, i) => [k.t / fps, vals[i], 'L', 'L', [[0, 33.33]], [[0, 33.33]]]);
  for (let i = 0; i < n - 1; i++) {
    const ease = keys[i].ease ?? 'linear';
    const dt = (keys[i + 1].t - keys[i].t) / fps;
    if (ease === 'hold') {
      rows[i][3] = 'H';
      rows[i + 1][2] = 'H';
      continue;
    }
    if (ease === 'linear') continue;
    const a = asArr(vals[i]);
    const b = asArr(vals[i + 1]);
    let outs: EaseSide[];
    let ins: EaseSide[];
    if (spatial) {
      const dist = Math.hypot(...a.map((x, d) => b[d] - x));
      const e = bezierToAe(ease, dist, dt);
      outs = [[num(e.out.speed), num(e.out.influence)]];
      ins = [[num(e.in.speed), num(e.in.influence)]];
    } else {
      outs = [];
      ins = [];
      for (let d = 0; d < dimCount; d++) {
        const e = bezierToAe(ease, b[d] - a[d], dt);
        outs.push([num(e.out.speed), num(e.out.influence)]);
        ins.push([num(e.in.speed), num(e.in.influence)]);
      }
    }
    rows[i][3] = 'B';
    rows[i][5] = outs;
    rows[i + 1][2] = 'B';
    rows[i + 1][4] = ins;
  }
  // First/last free sides mirror their neighbour type so AE draws them consistently.
  rows[0][2] = rows[0][3] === 'H' ? 'L' : rows[0][3];
  rows[n - 1][3] = rows[n - 1][2] === 'H' ? 'L' : rows[n - 1][2];
  return rows;
}

class Emitter {
  lines: string[] = [];
  manifest: ManifestEntry[] = [];
  /** Effects added so far on the layer being emitted (manifest paths address effects by index). */
  fx = 0;
  constructor(private scene: Scene) {}

  out(s: string) {
    this.lines.push(s);
  }

  /** Emit a spec literal for a property and record it in the manifest. */
  spec<T extends number | Vec2>(
    p: Prop<T> | Linked | LinkedVec2,
    fps: number,
    path: string,
    opts: {spatial?: boolean; map?: (v: T) => number | number[]; dim?: 0 | 1; noManifest?: boolean} = {},
  ): string {
    const map = opts.map ?? ((v: T) => (Array.isArray(v) ? [v[0], v[1]] : (v as number)));
    if (isLinked(p)) {
      if (!opts.noManifest) this.manifest.push({path, prop: p, fps});
      return `{x:${jsStr(linkExpr(p) + ';')}}`;
    }
    if (isLinkedVec(p)) {
      if (!opts.noManifest) this.manifest.push({path, prop: p, fps});
      return `{x:${jsStr(linkVecExpr(p) + ';')}}`;
    }
    if (!isAnimated(p)) return `{v:${lit(map(p as T))}}`;
    const anim = p as Animated<T>;
    if (!opts.noManifest) this.manifest.push({path, prop: p as Prop<number>, dim: opts.dim, spatial: opts.spatial, fps});
    return `{k:${lit(keyRows(anim.keys, fps, !!opts.spatial, map))}}`;
  }

  compOrder(): string[] {
    const order: string[] = [];
    const visit = (name: string, stack: string[]) => {
      if (order.includes(name)) return;
      if (stack.includes(name)) throw new Error(`Precomp cycle: ${[...stack, name].join(' -> ')}`);
      const c = this.scene.comps[name];
      if (!c) throw new Error(`Missing comp ${name}`);
      for (const l of c.layers) if (l.kind === 'precomp') visit(l.comp, [...stack, name]);
      order.push(name);
    };
    for (const name of Object.keys(this.scene.comps)) visit(name, []);
    return order;
  }

  /** "comp/layer" of layers whose position, scale or rotation jumps on a hold key. */
  private holdJumpLayers(): string[] {
    const out: string[] = [];
    const jumps = (p: unknown) => {
      if (!p || typeof p !== 'object' || Array.isArray(p) || !Array.isArray((p as {keys?: unknown}).keys)) return false;
      const keys = (p as {keys: Array<{v: unknown; ease?: unknown}>}).keys;
      return keys.some((k, i) => k.ease === 'hold' && i < keys.length - 1 && JSON.stringify(k.v) !== JSON.stringify(keys[i + 1].v));
    };
    for (const c of Object.values(this.scene.comps))
      for (const l of c.layers) {
        const tr = l.transform ?? {};
        if (jumps(tr.position) || jumps(tr.scale) || jumps(tr.rotation)) out.push(`${c.name}/${l.name}`);
      }
    return out;
  }

  emit(): EmitResult {
    const s = this.scene;
    const order = this.compOrder();
    this.out(PRELUDE);
    this.out(`var FONTS = ${lit(s.fonts.map((f) => f.postscript))};`);
    this.out(`var NOBLUR = {${this.holdJumpLayers().map((n) => `${jsStr(n)}: 1`).join(', ')}};`);
    this.out('if (!checkFonts(FONTS)) return;');
    this.out(START);
    for (const name of order) {
      const c = s.comps[name];
      const isMain = name === s.main;
      this.out(`\n// ---- comp: ${name.replace(/[^\x20-\x7e]/g, '?')}`);
      this.out(
        `COMPS[${jsStr(name)}] = mkComp(${jsStr(name)}, ${c.width}, ${c.height}, ${num(c.duration / c.fps)}, ${c.fps}, ${lit(hexToRgb01(c.bg ?? '#000000'))}, ${isMain ? 'MAIN_FOLDER' : 'PRECOMP_FOLDER'});`,
      );
    }
    for (const name of order) this.emitComp(s.comps[name], name === s.main);
    const mb = s.comps[s.main].motionBlur;
    if (mb) {
      for (const name of order) this.out(`motionBlur(COMPS[${jsStr(name)}], ${num(mb.shutterAngle)}, ${num(-mb.shutterAngle / 2)}, ${Math.max(16, mb.samples * 2)});`);
    }
    if (s.audio?.length) {
      const main = s.comps[s.main];
      for (const a of s.audio) this.out(`addAudio(COMPS[${jsStr(s.main)}], ${jsStr(a.file)}, ${jsStr(a.name)}, ${num(a.start / main.fps)}, ${num(a.gainDb ?? 0)}, ${a.muted ? 'false' : 'true'});`);
    }
    this.out(`finish(COMPS[${jsStr(s.main)}]);`);
    this.out('BUILT = true;');
    this.out(POSTLUDE);
    return {jsx: this.lines.join('\n'), manifest: this.manifest};
  }

  emitComp(c: Comp, isMain: boolean) {
    const cv = `COMPS[${jsStr(c.name)}]`;
    this.out(`\n// ---- layers: ${c.name.replace(/[^\x20-\x7e]/g, '?')}`);
    this.out(`var L = {};`);
    if (isMain && c.bg) this.out(`addBackground(${cv}, ${lit(hexToRgb01(c.bg))});`);
    // 1) create bottom -> top (AE puts each new layer on top)
    for (const l of c.layers) this.out(`L[${jsStr(l.name)}] = mkLayer(${cv}, ${this.layerCreateArgs(l)});`);
    // 2) identity transforms, then parenting (no compensation because parents are identity)
    this.out(`for (var nm in L) { if (L.hasOwnProperty(nm)) identity(L[nm]); }`);
    for (const l of c.layers) if (l.parent) this.out(`L[${jsStr(l.name)}].parent = L[${jsStr(l.parent)}];`);
    // 3) content, effects, transforms, timing
    for (const l of c.layers) this.emitLayer(c, l);
    // 4) mattes
    for (const l of c.layers) {
      if (l.matte) this.out(`setMatte(L[${jsStr(l.name)}], L[${jsStr(l.matte.layer)}], ${l.matte.type === 'alphaInverted' ? 'true' : 'false'});`);
    }
    for (const l of c.layers) if (l.matteSource) this.out(`L[${jsStr(l.name)}].enabled = false;`);
    for (const m of c.markers ?? []) this.out(`addMarker(${cv}, ${num(m.t / c.fps)}, ${jsStr(m.label)}, ${num((m.duration ?? 0) / c.fps)});`);
  }

  layerCreateArgs(l: Layer): string {
    switch (l.kind) {
      case 'shape':
        return `"shape", ${jsStr(l.name)}`;
      case 'text':
        return `"text", ${jsStr(l.name)}, ${jsStr(baseText(l.source).replace(/\n/g, '\r'))}`;
      case 'null':
        return `"null", ${jsStr(l.name)}`;
      case 'solid':
        return `"solid", ${jsStr(l.name)}, ${lit(hexToRgb01(l.color))}`;
      case 'precomp':
        return `"precomp", ${jsStr(l.name)}, COMPS[${jsStr(l.comp)}]`;
    }
  }

  emitLayer(c: Comp, l: Layer) {
    const lv = `L[${jsStr(l.name)}]`;
    const base = `${c.name}/${l.name}`;
    const fps = c.fps;
    this.fx = 0;
    if (l.kind === 'shape') this.emitShapeItems(c, l.name, l.items);
    if (l.kind === 'text') this.emitText(c, l);
    for (const sl of l.sliders ?? []) {
      this.fx++;
      this.out(`addSlider(${lv}, ${jsStr(sl.name)}, ${this.spec(sl.value, fps, `${base}/ADBE Effect Parade/${this.fx}/ADBE Slider Control-0001`)});`);
    }
    for (const e of l.effects ?? []) {
      this.fx++;
      this.emitEffect(c, l.name, e);
    }
    const tr = l.transform ?? {};
    if (tr.anchor) this.out(`apply(${lv}.property("ADBE Transform Group").property("ADBE Anchor Point"), {v:${lit(tr.anchor)}});`);
    if (tr.position !== undefined) {
      if (isAnimated(tr.position)) {
        const pos = tr.position;
        const xs = this.spec<number>({keys: pos.keys.map((k) => ({...k, v: k.v[0]}))}, fps, `${base}/ADBE Transform Group/ADBE Position_0`, {noManifest: true});
        const ys = this.spec<number>({keys: pos.keys.map((k) => ({...k, v: k.v[1]}))}, fps, `${base}/ADBE Transform Group/ADBE Position_1`, {noManifest: true});
        this.manifest.push({path: `${base}/ADBE Transform Group/ADBE Position_0`, prop: pos, dim: 0, fps});
        this.manifest.push({path: `${base}/ADBE Transform Group/ADBE Position_1`, prop: pos, dim: 1, fps});
        this.out(`setPositionSeparated(${lv}, ${xs}, ${ys});`);
      } else {
        this.out(`apply(${lv}.property("ADBE Transform Group").property("ADBE Position"), {v:${lit(tr.position)}});`);
      }
    }
    if (tr.scale !== undefined)
      this.out(`apply(${lv}.property("ADBE Transform Group").property("ADBE Scale"), ${this.spec(tr.scale, fps, `${base}/ADBE Transform Group/ADBE Scale`)});`);
    if (tr.rotation !== undefined)
      this.out(`apply(${lv}.property("ADBE Transform Group").property("ADBE Rotate Z"), ${this.spec(tr.rotation, fps, `${base}/ADBE Transform Group/ADBE Rotate Z`)});`);
    if (tr.opacity !== undefined)
      this.out(`apply(${lv}.property("ADBE Transform Group").property("ADBE Opacity"), ${this.spec(tr.opacity, fps, `${base}/ADBE Transform Group/ADBE Opacity`)});`);
    const startTime = l.kind === 'precomp' ? (l.startTime ?? 0) : 0;
    const inF = l.in ?? 0;
    const outF = l.out ?? c.duration;
    this.out(`timing(${lv}, ${num(startTime / fps)}, ${num(inF / fps)}, ${num(outF / fps)});`);
    if (l.label) this.out(`${lv}.label = ${l.label};`);
    if (l.kind === 'precomp' && l.collapse) this.out(`${lv}.collapseTransformation = true;`);
  }

  emitShapeItems(c: Comp, layerName: string, items: ShapeItem[]) {
    const lv = `L[${jsStr(layerName)}]`;
    const fps = c.fps;
    // AE appends groups at the bottom of the list and the top of the list draws on top,
    // so add the DSL's topmost item first.
    const reversed = [...items].reverse();
    reversed.forEach((item, gi) => {
      const gIdx = gi + 1;
      const gPath = `${c.name}/${layerName}/ADBE Root Vectors Group/${gIdx}`;
      this.out(`var g = addGroup(${lv}, ${jsStr(item.name ?? `Shape ${items.length - gi}`)});`);
      const geos = Array.isArray(item.geo) ? item.geo : [item.geo];
      let idx = 0;
      for (const geo of geos) {
        idx++;
        this.emitGeometry(geo, gIdx, idx, lv, `${gPath}/ADBE Vectors Group/${idx}`, fps);
      }
      if (item.trim) {
        idx++;
        const tp = `${gPath}/ADBE Vectors Group/${idx}`;
        const tr = item.trim;
        this.out(
          `addTrim(${lv}, ${gIdx}, ${tr.start !== undefined ? this.spec(tr.start, fps, `${tp}/ADBE Vector Trim Start`) : 'null'}, ${tr.end !== undefined ? this.spec(tr.end, fps, `${tp}/ADBE Vector Trim End`) : 'null'}, ${tr.offset !== undefined ? this.spec(tr.offset, fps, `${tp}/ADBE Vector Trim Offset`) : 'null'});`,
        );
      }
      if (item.stroke) {
        idx++;
        const sp = `${gPath}/ADBE Vectors Group/${idx}`;
        const st = item.stroke;
        const cap = {butt: 1, round: 2, square: 3}[st.cap ?? 'butt'];
        const join = {miter: 1, round: 2, bevel: 3}[st.join ?? 'miter'];
        this.out(
          `addStroke(${lv}, ${gIdx}, ${this.colorSpec(st.color, fps)}, ${this.spec(st.width, fps, `${sp}/ADBE Vector Stroke Width`)}, ${this.spec(st.opacity ?? 100, fps, `${sp}/ADBE Vector Stroke Opacity`)}, ${cap}, ${join}, ${lit(st.dash ?? [])});`,
        );
      }
      if (item.fill) {
        idx++;
        const fp = `${gPath}/ADBE Vectors Group/${idx}`;
        this.out(`addFill(${lv}, ${gIdx}, ${this.colorSpec(item.fill.color, fps)}, ${this.spec(item.fill.opacity ?? 100, fps, `${fp}/ADBE Vector Fill Opacity`)});`);
      }
      const gt = item.transform;
      if (gt) {
        const tp = `${gPath}/ADBE Vector Transform Group`;
        this.out(
          `groupTransform(${lv}, ${gIdx}, ${lit(gt.anchor ?? null)}, ${lit(gt.position ?? null)}, ${gt.scale !== undefined ? this.spec(gt.scale, fps, `${tp}/ADBE Vector Scale`) : 'null'}, ${gt.rotation !== undefined ? this.spec(gt.rotation, fps, `${tp}/ADBE Vector Rotation`) : 'null'}, ${gt.opacity !== undefined ? this.spec(gt.opacity, fps, `${tp}/ADBE Vector Group Opacity`) : 'null'});`,
        );
      }
    });
  }

  colorSpec(p: Prop<string>, fps: number): string {
    if (!isAnimated(p)) return `{v:${lit(hexToRgb01(p))}}`;
    for (const k of p.keys.slice(0, -1)) {
      if ((k.ease ?? 'linear') !== 'hold') throw new Error('Colour keys must use hold easing');
    }
    const rows = p.keys.map((k) => [num(k.t / fps), [...hexToRgb01(k.v), 1], 'H', 'H', [[0, 33.33]], [[0, 33.33]]]);
    return `{k:${lit(rows)}}`;
  }

  emitGeometry(g: Geometry, gIdx: number, idx: number, lv: string, path: string, fps: number) {
    if (g.type === 'rect') {
      this.out(
        `addRect(${lv}, ${gIdx}, ${this.spec(g.size, fps, `${path}/ADBE Vector Rect Size`)}, ${lit(g.center ?? [0, 0])}, ${this.spec(g.roundness ?? 0, fps, `${path}/ADBE Vector Rect Roundness`)});`,
      );
    } else if (g.type === 'ellipse') {
      this.out(`addEllipse(${lv}, ${gIdx}, ${this.spec(g.size, fps, `${path}/ADBE Vector Ellipse Size`)}, ${lit(g.center ?? [0, 0])});`);
    } else {
      const p: PathData = g.path;
      const z: Vec2[] = p.v.map(() => [0, 0]);
      this.out(`addPath(${lv}, ${gIdx}, ${lit(p.v)}, ${lit(p.i ?? z)}, ${lit(p.o ?? z)}, ${p.closed ? 'true' : 'false'});`);
    }
    void idx;
  }

  emitText(c: Comp, l: TextLayer) {
    const lv = `L[${jsStr(l.name)}]`;
    const just = {left: 'L', center: 'C', right: 'R'}[l.justify ?? 'left'];
    const stroke = l.stroke ? `${lit(hexToRgb01(l.stroke.color))}, ${num(l.stroke.width)}` : 'null, 0';
    this.out(
      `setText(${lv}, ${jsStr(l.font.postscript)}, ${num(l.size)}, ${lit(hexToRgb01(l.color))}, ${num(l.tracking ?? 0)}, ${l.leading !== undefined ? num(l.leading) : 'null'}, "${just}", ${l.noFill ? 'false' : 'true'}, ${stroke});`,
    );
    const src = l.source;
    if (src.kind === 'static') return;
    if (src.kind === 'keyed') {
      const rows = src.keys.map((k) => `[${num(k.t / c.fps)},${jsStr(k.v.replace(/\n/g, '\r'))}]`).join(',');
      this.out(`setTextKeys(${lv}, [${rows}]);`);
      return;
    }
    // The number behind the text: a linked controller slider, or the layer's own slider.
    const numberProp = src.kind === 'typeOn' ? src.chars : src.value;
    const ownName = src.kind === 'typeOn' ? 'Characters' : 'Value';
    let n: string;
    if (isLinked(numberProp)) n = `(${linkExpr(numberProp)})`;
    else {
      this.fx++;
      const p = `${c.name}/${l.name}/ADBE Effect Parade/${this.fx}/ADBE Slider Control-0001`;
      this.out(`addSlider(${lv}, "${ownName}", ${this.spec(numberProp, c.fps, p)});`);
      n = `effect("${ownName}")("ADBE Slider Control-0001").value`;
    }
    let expr: string;
    if (src.kind === 'typeOn') expr = `var n = Math.round(${n}); value.substr(0, Math.max(0, n));`;
    else if (src.kind === 'counter')
      expr =
        `var n = Math.round(${n}); var s = String(Math.abs(n)); ` +
        `while (s.length < ${src.pad}) s = "0" + s; ${jsStr(src.prefix ?? '')} + (n < 0 ? "-" : "") + s + ${jsStr(src.suffix ?? '')};`;
    else expr = `var n = Math.round(${n}); var s = String(Math.abs(n)); while (s.length < ${src.pad}) s = "0" + s; s.charAt(${src.index});`;
    this.out(`setTextExpr(${lv}, ${jsStr(expr)});`);
  }

  emitEffect(c: Comp, layerName: string, e: Effect) {
    const lv = `L[${jsStr(layerName)}]`;
    if (e.type === 'dropShadow') {
      this.out(`addDropShadow(${lv}, ${lit(hexToRgb01(e.color))}, ${num(e.opacity)}, ${num(e.direction)}, ${num(e.distance)}, ${num(e.softness)});`);
    } else {
      this.out(`addBlur(${lv}, ${this.spec(e.amount, c.fps, `${c.name}/${layerName}/ADBE Effect Parade/?/ADBE Gaussian Blur 2-0001`, {noManifest: true})});`);
    }
  }
}

/** AE expression for a linked 2D value. */
export function linkVecExpr(p: LinkedVec2): string {
  const {layer, slider, x, y} = p.linkVec;
  const one = (c: LinkedVec2['linkVec']['x']) => linkExpr({link: {layer, slider, ...c}});
  return `[${one(x)}, ${one(y)}]`;
}

/** AE expression (single statement value) for a linked number. */
export function linkExpr(p: Linked): string {
  const l = p.link;
  let e = `thisComp.layer(${jsStr(l.layer)}).effect(${jsStr(l.slider)})("ADBE Slider Control-0001").value * ${num(l.mul ?? 1)} + ${num(l.add ?? 0)}`;
  if (l.min !== undefined) e = `Math.max(${num(l.min)}, ${e})`;
  if (l.max !== undefined) e = `Math.min(${num(l.max)}, ${e})`;
  return e;
}

export function emitJsx(scene: Scene): EmitResult {
  validateScene(scene);
  return new Emitter(scene).emit();
}

/** Reject things the AE side cannot reproduce faithfully. */
export function validateScene(scene: Scene) {
  if (!scene.comps[scene.main]) throw new Error(`Main comp ${scene.main} missing`);
  for (const c of Object.values(scene.comps)) {
    const names = new Set<string>();
    for (const l of c.layers) {
      if (names.has(l.name)) throw new Error(`Duplicate layer name "${l.name}" in comp ${c.name}`);
      names.add(l.name);
    }
    const sliderNames = new Map(c.layers.map((l) => [l.name, new Set((l.sliders ?? []).map((x) => x.name))]));
    const checkLinks = (where: string, v: unknown) => {
      if (Array.isArray(v) || typeof v !== 'object' || v === null) return;
      if (isLinked(v)) {
        if (!sliderNames.get(v.link.layer)?.has(v.link.slider)) throw new Error(`${where}: link ${v.link.layer} > ${v.link.slider} not found in comp ${c.name}`);
        return;
      }
      if (isLinkedVec(v)) {
        if (!sliderNames.get(v.linkVec.layer)?.has(v.linkVec.slider)) throw new Error(`${where}: link ${v.linkVec.layer} > ${v.linkVec.slider} not found in comp ${c.name}`);
        return;
      }
      for (const x of Object.values(v as object)) checkLinks(where, x);
    };
    for (const l of c.layers) {
      checkLinks(`${c.name}/${l.name}`, l);
      if (l.name.includes('/')) throw new Error(`${c.name}/${l.name}: "/" is reserved in layer names (property paths)`);
      if ((l.in ?? 0) >= (l.out ?? c.duration)) throw new Error(`${c.name}/${l.name}: empty time range (in ${l.in ?? 0} >= out ${l.out ?? c.duration})`);
      if (l.parent && !names.has(l.parent)) throw new Error(`${c.name}/${l.name}: parent ${l.parent} not found`);
      if (l.matte && !names.has(l.matte.layer)) throw new Error(`${c.name}/${l.name}: matte ${l.matte.layer} not found`);
      if (l.kind === 'shape') {
        for (const item of l.items) {
          const geos = Array.isArray(item.geo) ? item.geo : [item.geo];
          if (item.trim && geos.some((g) => g.type !== 'path'))
            throw new Error(`${c.name}/${l.name}: Trim Paths only on explicit paths (AE and SVG start rect/ellipse paths at different points)`);
          if (item.trim && item.fill) throw new Error(`${c.name}/${l.name}: Trim Paths with a fill is not supported`);
        }
      }
      for (const p of [l.transform?.position, l.transform?.scale, l.transform?.rotation, l.transform?.opacity]) {
        if (isAnimated(p as Prop<number>)) {
          const keys = (p as Animated<unknown>).keys;
          for (let i = 1; i < keys.length; i++) if (keys[i].t <= keys[i - 1].t) throw new Error(`${c.name}/${l.name}: keys must be strictly increasing in time`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// ES3 runtime that the generated script calls. Kept deliberately small and explicit.
const PRELUDE = String.raw`// Onemarsmedia 360 explainer: builds the full After Effects project.
// HOW TO USE: After Effects > File > Scripts > Run Script File... > pick this file.
// Keep the "audio" and "fonts" folders next to this script. Install the fonts first (double-click them).
// Then File > Save As > Save As... to keep the project. Every layer, shape and keyframe is editable.
// Needs After Effects 2023 (23.0) or newer.
(function () {
if (parseFloat(app.version) < 23) { alert("This script needs After Effects 2023 (23.0) or newer."); return; }
var SCRIPT_DIR = new File($.fileName).parent;
var COMPS = {};
var MISSING_FONTS = [];
var MISSING_AUDIO = [];
var BUILT = false;
var ROOT_FOLDER = null, MAIN_FOLDER = null, PRECOMP_FOLDER = null, AUDIO_FOLDER = null;

var IT = {L: KeyframeInterpolationType.LINEAR, B: KeyframeInterpolationType.BEZIER, H: KeyframeInterpolationType.HOLD};

function fontOk(ps) {
  try {
    if (app.fonts && app.fonts.getFontsByPostScriptName) {
      var f = app.fonts.getFontsByPostScriptName(ps);
      for (var i = 0; i < f.length; i++) if (!f[i].isSubstitute) return true;
      return false;
    }
  } catch (e) {}
  return true;
}
function noteFont(ps) {
  for (var i = 0; i < MISSING_FONTS.length; i++) if (MISSING_FONTS[i] === ps) return;
  MISSING_FONTS.push(ps);
}
function checkFonts(list) {
  for (var i = 0; i < list.length; i++) if (!fontOk(list[i])) noteFont(list[i]);
  return !MISSING_FONTS.length || confirm("These fonts are not installed:\n" + MISSING_FONTS.join("\n") + "\n\nInstall them from the fonts folder, restart After Effects and run the script again.\nBuild anyway with substitute fonts?");
}
function mkComp(name, w, h, dur, fps, bg, folder) {
  var c = app.project.items.addComp(name, w, h, 1, dur, fps);
  c.bgColor = bg;
  c.parentFolder = folder;
  return c;
}
function addBackground(comp, rgb) {
  var s = comp.layers.addSolid(rgb, "Background", comp.width, comp.height, 1);
  s.locked = false;
  return s;
}
function mkLayer(comp, kind, name, extra) {
  var l;
  if (kind === "shape") l = comp.layers.addShape();
  else if (kind === "text") l = comp.layers.addText(extra);
  else if (kind === "null") l = comp.layers.addNull();
  else if (kind === "solid") l = comp.layers.addSolid(extra, name, comp.width, comp.height, 1);
  else if (kind === "precomp") l = comp.layers.add(extra);
  l.name = name;
  return l;
}
function fitVal(prop, v) {
  if (v instanceof Array) {
    var cur = prop.value;
    if (cur instanceof Array && cur.length === 3 && v.length === 2) return [v[0], v[1], cur[2]];
  }
  return v;
}
function easeLen(prop) {
  var t = prop.propertyValueType;
  if (t === PropertyValueType.TwoD_SPATIAL || t === PropertyValueType.ThreeD_SPATIAL) return 1;
  if (t === PropertyValueType.TwoD) return 2;
  if (t === PropertyValueType.ThreeD) return 3;
  return 1;
}
function mkEase(arr, n) {
  var out = [];
  for (var i = 0; i < n; i++) {
    var e = arr[Math.min(i, arr.length - 1)];
    out.push(new KeyframeEase(i < arr.length ? e[0] : 0, e[1]));
  }
  return out;
}
function apply(prop, spec) {
  if (spec === null) return;
  if (spec.x) { prop.expression = spec.x; return; }
  if (spec.k) {
    var ks = spec.k, i, idx, n;
    for (i = 0; i < ks.length; i++) prop.setValueAtTime(ks[i][0], fitVal(prop, ks[i][1]));
    n = easeLen(prop);
    for (i = 0; i < ks.length; i++) {
      idx = prop.nearestKeyIndex(ks[i][0]);
      if (ks[i][2] === "B" || ks[i][3] === "B") prop.setTemporalEaseAtKey(idx, mkEase(ks[i][4], n), mkEase(ks[i][5], n));
      prop.setInterpolationTypeAtKey(idx, IT[ks[i][2]], IT[ks[i][3]]);
    }
  } else {
    prop.setValue(fitVal(prop, spec.v));
  }
}
function tg(l) { return l.property("ADBE Transform Group"); }
function identity(l) {
  tg(l).property("ADBE Anchor Point").setValue(fitVal(tg(l).property("ADBE Anchor Point"), [0, 0]));
  tg(l).property("ADBE Position").setValue(fitVal(tg(l).property("ADBE Position"), [0, 0]));
}
function setPositionSeparated(l, xs, ys) {
  tg(l).property("ADBE Position").dimensionsSeparated = true;
  apply(tg(l).property("ADBE Position_0"), xs);
  apply(tg(l).property("ADBE Position_1"), ys);
}
function timing(l, start, inP, outP) {
  l.startTime = start;
  l.inPoint = inP;
  l.outPoint = outP;
}
function root(l) { return l.property("ADBE Root Vectors Group"); }
function grp(l, gi) { return root(l).property(gi); }
function gcont(l, gi) { return grp(l, gi).property("ADBE Vectors Group"); }
function addGroup(l, name) {
  var g = root(l).addProperty("ADBE Vector Group");
  g.name = name;
  return g;
}
function addRect(l, gi, size, center, round) {
  var r = gcont(l, gi).addProperty("ADBE Vector Shape - Rect");
  var ri = r.propertyIndex;
  apply(gcont(l, gi).property(ri).property("ADBE Vector Rect Size"), size);
  gcont(l, gi).property(ri).property("ADBE Vector Rect Position").setValue(center);
  apply(gcont(l, gi).property(ri).property("ADBE Vector Rect Roundness"), round);
}
function addEllipse(l, gi, size, center) {
  var e = gcont(l, gi).addProperty("ADBE Vector Shape - Ellipse");
  var ei = e.propertyIndex;
  apply(gcont(l, gi).property(ei).property("ADBE Vector Ellipse Size"), size);
  gcont(l, gi).property(ei).property("ADBE Vector Ellipse Position").setValue(center);
}
function addPath(l, gi, verts, ins, outs, closed) {
  var p = gcont(l, gi).addProperty("ADBE Vector Shape - Group");
  var pi = p.propertyIndex;
  var s = new Shape();
  s.vertices = verts;
  s.inTangents = ins;
  s.outTangents = outs;
  s.closed = closed;
  gcont(l, gi).property(pi).property("ADBE Vector Shape").setValue(s);
}
function addTrim(l, gi, start, end, offset) {
  var t = gcont(l, gi).addProperty("ADBE Vector Filter - Trim");
  var ti = t.propertyIndex;
  if (start) apply(gcont(l, gi).property(ti).property("ADBE Vector Trim Start"), start);
  if (end) apply(gcont(l, gi).property(ti).property("ADBE Vector Trim End"), end);
  if (offset) apply(gcont(l, gi).property(ti).property("ADBE Vector Trim Offset"), offset);
}
function addStroke(l, gi, color, width, opacity, cap, join, dash) {
  var s = gcont(l, gi).addProperty("ADBE Vector Graphic - Stroke");
  var si = s.propertyIndex;
  apply(gcont(l, gi).property(si).property("ADBE Vector Stroke Color"), color);
  apply(gcont(l, gi).property(si).property("ADBE Vector Stroke Width"), width);
  apply(gcont(l, gi).property(si).property("ADBE Vector Stroke Opacity"), opacity);
  gcont(l, gi).property(si).property("ADBE Vector Stroke Line Cap").setValue(cap);
  gcont(l, gi).property(si).property("ADBE Vector Stroke Line Join").setValue(join);
  for (var d = 0; d < dash.length; d++) {
    var dashes = gcont(l, gi).property(si).property("ADBE Vector Stroke Dashes");
    var nm = (d % 2 === 0 ? "ADBE Vector Stroke Dash " : "ADBE Vector Stroke Gap ") + (Math.floor(d / 2) + 1);
    dashes.addProperty(nm);
    gcont(l, gi).property(si).property("ADBE Vector Stroke Dashes").property(nm).setValue(dash[d]);
  }
}
function addFill(l, gi, color, opacity) {
  var f = gcont(l, gi).addProperty("ADBE Vector Graphic - Fill");
  var fi = f.propertyIndex;
  apply(gcont(l, gi).property(fi).property("ADBE Vector Fill Color"), color);
  apply(gcont(l, gi).property(fi).property("ADBE Vector Fill Opacity"), opacity);
}
function groupTransform(l, gi, anchor, position, scale, rotation, opacity) {
  var t = grp(l, gi).property("ADBE Vector Transform Group");
  if (anchor) t.property("ADBE Vector Anchor").setValue(anchor);
  if (position) grp(l, gi).property("ADBE Vector Transform Group").property("ADBE Vector Position").setValue(position);
  apply(grp(l, gi).property("ADBE Vector Transform Group").property("ADBE Vector Scale"), scale);
  apply(grp(l, gi).property("ADBE Vector Transform Group").property("ADBE Vector Rotation"), rotation);
  apply(grp(l, gi).property("ADBE Vector Transform Group").property("ADBE Vector Group Opacity"), opacity);
}
function textProp(l) { return l.property("ADBE Text Properties").property("ADBE Text Document"); }
function setText(l, font, size, rgb, tracking, leading, just, fill, strokeRgb, strokeWidth) {
  var td = textProp(l).value;
  var txt = td.text;
  td.resetCharStyle();
  td.resetParagraphStyle();
  td.font = font;
  td.fontSize = size;
  td.fillColor = rgb;
  td.applyFill = fill;
  if (strokeRgb) {
    td.applyStroke = true;
    td.strokeColor = strokeRgb;
    td.strokeWidth = strokeWidth;
    td.strokeOverFill = true;
  } else {
    td.applyStroke = false;
  }
  td.tracking = tracking;
  if (leading !== null) { td.autoLeading = false; td.leading = leading; }
  td.justification = just === "C" ? ParagraphJustification.CENTER_JUSTIFY : (just === "R" ? ParagraphJustification.RIGHT_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY);
  td.text = txt;
  textProp(l).setValue(td);
  if (textProp(l).value.font !== font) noteFont(font);
}
function setTextExpr(l, expr) { textProp(l).expression = expr; }
function setTextKeys(l, keys) {
  for (var i = 0; i < keys.length; i++) {
    var td = textProp(l).value;
    td.text = keys[i][1];
    textProp(l).setValueAtTime(keys[i][0], td);
  }
}
function addSlider(l, name, spec) {
  var fx = l.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
  fx.name = name;
  apply(l.property("ADBE Effect Parade").property(name).property("ADBE Slider Control-0001"), spec);
}
function scaledPct(prop, pct) { return prop.hasMax && prop.maxValue > 100 ? pct / 100 * prop.maxValue : pct; }
function addDropShadow(l, rgb, opacity, direction, distance, softness) {
  var fx = l.property("ADBE Effect Parade").addProperty("ADBE Drop Shadow");
  var fi = fx.propertyIndex;
  var e = function () { return l.property("ADBE Effect Parade").property(fi); };
  e().property("ADBE Drop Shadow-0001").setValue(rgb);
  e().property("ADBE Drop Shadow-0002").setValue(scaledPct(e().property("ADBE Drop Shadow-0002"), opacity));
  e().property("ADBE Drop Shadow-0003").setValue(direction);
  e().property("ADBE Drop Shadow-0004").setValue(distance);
  e().property("ADBE Drop Shadow-0005").setValue(softness);
}
function addBlur(l, spec) {
  var fx = l.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur 2");
  var fi = fx.propertyIndex;
  apply(l.property("ADBE Effect Parade").property(fi).property("ADBE Gaussian Blur 2-0001"), spec);
}
function setMatte(l, matte, inverted) {
  l.setTrackMatte(matte, inverted ? TrackMatteType.ALPHA_INVERTED : TrackMatteType.ALPHA);
}
function addMarker(comp, t, label, dur) {
  var mv = new MarkerValue(label);
  if (dur > 0) mv.duration = dur;
  comp.markerProperty.setValueAtTime(t, mv);
}
function addAudio(comp, file, name, start, gainDb, on) {
  var f = new File(SCRIPT_DIR.fsName + "/audio/" + file);
  if (!f.exists) { MISSING_AUDIO.push(file); return; }
  if (!AUDIO_FOLDER) { AUDIO_FOLDER = app.project.items.addFolder("Audio"); AUDIO_FOLDER.parentFolder = ROOT_FOLDER; }
  var item = app.project.importFile(new ImportOptions(f));
  item.parentFolder = AUDIO_FOLDER;
  var al = comp.layers.add(item);
  al.name = name;
  al.startTime = start;
  if (gainDb !== 0) al.property("ADBE Audio Group").property("ADBE Audio Levels").setValue([gainDb, gainDb]);
  al.audioEnabled = on;
  al.moveToEnd();
}
function motionBlur(comp, angle, phase, samples) {
  comp.motionBlur = true;
  comp.shutterAngle = angle;
  comp.shutterPhase = phase;
  comp.motionBlurSamplesPerFrame = samples;
  for (var i = 1; i <= comp.numLayers; i++) {
    var l = comp.layer(i);
    // layers that jump on hold keys stay sharp (a blurred jump would ghost the previous position)
    if (l.hasVideo && !NOBLUR[comp.name + "/" + l.name]) l.motionBlur = true;
  }
}
function finish(main) {
  main.openInViewer();
}
`;

// Runs after the font check: new project (asked), colour settings for a fresh project, undo group, folders.
const START = String.raw`
var FRESH = false;
if (app.project.numItems > 0 && confirm("Build the Onemarsmedia 360 project into a new, empty project? (recommended)")) {
  if (!app.newProject()) return;
  FRESH = true;
}
app.beginUndoGroup("Build Onemarsmedia 360");
try {
// match the MP4 (8 bpc, sRGB blending), but never change the settings of a project that already has work in it
if (FRESH || app.project.numItems === 0) {
  app.project.bitsPerChannel = 8;
  app.project.linearBlending = false;
}
ROOT_FOLDER = app.project.items.addFolder("Onemarsmedia 360");
MAIN_FOLDER = ROOT_FOLDER;
PRECOMP_FOLDER = app.project.items.addFolder("Precomps");
PRECOMP_FOLDER.parentFolder = ROOT_FOLDER;
`;

const POSTLUDE = String.raw`
} catch (err) {
  if (err.message !== "ABORT") alert("Build stopped: " + err.toString() + (err.line ? " (script line " + err.line + ")" : "") + "\nEdit > Undo removes the partial build.");
}
app.endUndoGroup();
if (BUILT) {
  var msg = "Onemarsmedia 360 project built.";
  if (MISSING_FONTS.length) msg += "\n\nThese fonts were substituted:\n" + MISSING_FONTS.join("\n") + "\nInstall them from the fonts folder, restart After Effects and run the script again in a new project (reopening will not fix the text).";
  if (MISSING_AUDIO.length) msg += "\n\nAudio not found (keep the audio folder next to the script):\n" + MISSING_AUDIO.join("\n");
  alert(msg + "\n\nFile > Save As > Save As... to keep it.");
}
})();
`;
