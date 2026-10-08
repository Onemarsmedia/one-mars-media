// A recording mock of the subset of the After Effects scripting DOM that ae/emit-jsx.ts uses.
// It runs the generated .jsx in a Node vm and fails loudly on anything real AE would reject:
// unknown match names, wrong value dimensions, setValue on keyed properties, bad key indices,
// ease arrays of the wrong length, influences out of range, parenting across comps, etc.
// It is not After Effects. It catches structural mistakes so the script reaches AE clean.

import vm from 'node:vm';

export const PVT = {
  NO_VALUE: 6412,
  ThreeD_SPATIAL: 6413,
  ThreeD: 6414,
  TwoD_SPATIAL: 6415,
  TwoD: 6416,
  OneD: 6417,
  COLOR: 6418,
  CUSTOM_VALUE: 6419,
  MARKER: 6420,
  LAYER_INDEX: 6421,
  MASK_INDEX: 6422,
  SHAPE: 6423,
  TEXT_DOCUMENT: 6424,
} as const;

export const KIT = {LINEAR: 6612, BEZIER: 6613, HOLD: 6614} as const;

const DIMS: Record<number, number> = {
  [PVT.ThreeD_SPATIAL]: 3,
  [PVT.ThreeD]: 3,
  [PVT.TwoD_SPATIAL]: 2,
  [PVT.TwoD]: 2,
  [PVT.OneD]: 1,
  [PVT.COLOR]: 4,
};

export class MockError extends Error {}
const fail = (msg: string): never => {
  throw new MockError(msg);
};

export class KeyframeEase {
  constructor(
    public speed: number,
    public influence: number,
  ) {
    if (typeof speed !== 'number' || !isFinite(speed)) fail(`KeyframeEase speed must be a finite number, got ${speed}`);
    if (!(influence >= 0.1 && influence <= 100)) fail(`KeyframeEase influence must be 0.1..100, got ${influence}`);
  }
}

export class Shape {
  vertices: number[][] = [];
  inTangents: number[][] = [];
  outTangents: number[][] = [];
  closed = true;
}

/** Fonts installed in the mock AE (null = all). Set by runJsx. */
let INSTALLED: Set<string> | null = null;

export class TextDocument {
  text: string;
  font = 'ArialMT';
  fontSize = 36;
  applyFill = true;
  fillColor: number[] = [1, 1, 1];
  applyStroke = false;
  strokeColor: number[] = [0, 0, 0];
  strokeWidth = 1;
  strokeOverFill = true;
  tracking = 0;
  leading = 0;
  autoLeading = true;
  justification = 7413;
  constructor(text: string) {
    this.text = text;
  }
  resetCharStyle() {}
  resetParagraphStyle() {}
}

export class MarkerValue {
  duration = 0;
  constructor(public comment: string) {}
}

export interface MockKey {
  t: number;
  v: unknown;
  inType: number;
  outType: number;
  inEase: KeyframeEase[] | null;
  outEase: KeyframeEase[] | null;
}

type Node = MockProperty | MockGroup;

/** Groups whose children are addressed by index in recorded paths. */
const INDEXED = new Set(['ADBE Root Vectors Group', 'ADBE Vectors Group', 'ADBE Effect Parade', 'ADBE Vector Stroke Dashes']);

abstract class Base {
  name: string;
  parentProperty: MockGroup | null = null;
  layer!: MockLayer;
  constructor(public matchName: string) {
    this.name = matchName;
  }
  get propertyIndex(): number {
    if (!this.parentProperty) return 0;
    return this.parentProperty.children.indexOf(this as unknown as Node) + 1;
  }
  path(): string {
    const parts: string[] = [];
    let n: Base | null = this;
    while (n && n.parentProperty) {
      const parent: MockGroup = n.parentProperty;
      parts.unshift(INDEXED.has(parent.matchName) ? String(n.propertyIndex) : n.matchName);
      n = parent;
    }
    return `${this.layer.comp.name}/${this.layer.name}/${parts.join('/')}`;
  }
}

export class MockProperty extends Base {
  keys: MockKey[] = [];
  expression = '';
  hasMax = false;
  maxValue = 0;
  constructor(
    matchName: string,
    public propertyValueType: number,
    public value: unknown,
  ) {
    super(matchName);
  }
  get numKeys() {
    return this.keys.length;
  }
  private checkValue(v: unknown) {
    const t = this.propertyValueType;
    const dims = DIMS[t];
    if (t === PVT.SHAPE) {
      if (!(v instanceof Shape)) fail(`${this.path()}: expected Shape`);
      const s = v as Shape;
      if (s.vertices.length !== s.inTangents.length || s.vertices.length !== s.outTangents.length) fail(`${this.path()}: Shape arrays differ in length`);
      return;
    }
    if (t === PVT.TEXT_DOCUMENT) {
      if (!(v instanceof TextDocument) && typeof v !== 'string') fail(`${this.path()}: expected TextDocument`);
      return;
    }
    if (t === PVT.MARKER) {
      if (!(v instanceof MarkerValue)) fail(`${this.path()}: expected MarkerValue`);
      return;
    }
    if (dims === 1) {
      if (typeof v !== 'number' || !isFinite(v)) fail(`${this.path()}: expected a number, got ${JSON.stringify(v)}`);
      return;
    }
    if (!Array.isArray(v)) fail(`${this.path()}: expected array of ${dims}, got ${JSON.stringify(v)}`);
    const arr = v as number[];
    const okLen = t === PVT.COLOR ? arr.length === 3 || arr.length === 4 : arr.length === dims || (dims === 3 && arr.length === 2);
    if (!okLen) fail(`${this.path()}: expected ${dims} values, got ${arr.length}`);
    if (arr.some((x) => typeof x !== 'number' || !isFinite(x))) fail(`${this.path()}: non-numeric value ${JSON.stringify(v)}`);
  }
  private checkSettable() {
    if (this.matchName === 'ADBE Position' && (this as MockProperty & {separated?: boolean}).separated) fail(`${this.path()}: position is separated; set X/Y instead`);
    if (this.matchName.startsWith('ADBE Position_') && !(this.parentProperty!.property('ADBE Position') as MockProperty & {separated?: boolean}).separated)
      fail(`${this.path()}: X/Y position used while dimensions are not separated`);
  }
  /** Real AE hands out copies of TextDocuments; store copies so later edits don't leak into keys.
   *  A font that is not installed is not kept (AE leaves the default font in place). */
  private own(v: unknown) {
    if (!(v instanceof TextDocument)) return v;
    const td = Object.assign(new TextDocument(v.text), v);
    if (INSTALLED && !INSTALLED.has(td.font)) td.font = 'ArialMT';
    return td;
  }
  setValue(v: unknown) {
    this.checkSettable();
    if (this.keys.length) fail(`${this.path()}: setValue on a property that has keyframes`);
    this.checkValue(v);
    this.value = this.own(v);
  }
  setValueAtTime(t: number, v: unknown) {
    this.checkSettable();
    if (typeof t !== 'number' || !isFinite(t)) fail(`${this.path()}: bad key time ${t}`);
    this.checkValue(v);
    v = this.own(v);
    const existing = this.keys.find((k) => Math.abs(k.t - t) < 1e-9);
    if (existing) existing.v = v;
    else {
      this.keys.push({t, v, inType: KIT.LINEAR, outType: KIT.LINEAR, inEase: null, outEase: null});
      this.keys.sort((a, b) => a.t - b.t);
    }
  }
  nearestKeyIndex(t: number): number {
    if (!this.keys.length) fail(`${this.path()}: nearestKeyIndex without keys`);
    let best = 0;
    for (let i = 1; i < this.keys.length; i++) if (Math.abs(this.keys[i].t - t) < Math.abs(this.keys[best].t - t)) best = i;
    return best + 1;
  }
  private key(i: number): MockKey {
    if (!Number.isInteger(i) || i < 1 || i > this.keys.length) fail(`${this.path()}: key index ${i} out of range 1..${this.keys.length}`);
    return this.keys[i - 1];
  }
  setInterpolationTypeAtKey(i: number, inType: number, outType: number = inType) {
    const valid = [KIT.LINEAR, KIT.BEZIER, KIT.HOLD] as number[];
    if (!valid.includes(inType) || !valid.includes(outType)) fail(`${this.path()}: bad interpolation type`);
    const k = this.key(i);
    k.inType = inType;
    k.outType = outType;
  }
  setTemporalEaseAtKey(i: number, inEase: KeyframeEase[], outEase: KeyframeEase[] = inEase) {
    const k = this.key(i);
    const t = this.propertyValueType;
    const need = t === PVT.TwoD_SPATIAL || t === PVT.ThreeD_SPATIAL ? 1 : t === PVT.TwoD ? 2 : t === PVT.ThreeD ? 3 : 1;
    for (const arr of [inEase, outEase]) {
      if (!Array.isArray(arr) || arr.length !== need) fail(`${this.path()}: ease array needs ${need} KeyframeEase, got ${Array.isArray(arr) ? arr.length : typeof arr}`);
      if (arr.some((e) => !(e instanceof KeyframeEase))) fail(`${this.path()}: ease entries must be KeyframeEase`);
    }
    k.inEase = inEase;
    k.outEase = outEase;
    // Real AE switches the key to bezier when an ease is applied.
    k.inType = KIT.BEZIER;
    k.outType = KIT.BEZIER;
  }
  get dimensionsSeparated() {
    return !!(this as MockProperty & {separated?: boolean}).separated;
  }
  set dimensionsSeparated(v: boolean) {
    if (this.matchName !== 'ADBE Position') fail(`${this.path()}: dimensionsSeparated only on layer Position`);
    if (this.keys.length) fail(`${this.path()}: separate dimensions before keying`);
    (this as MockProperty & {separated?: boolean}).separated = v;
  }
}

type Factory = () => Node;
const P = (mn: string, t: number, v: unknown, extra?: Partial<MockProperty>): Factory => () => Object.assign(new MockProperty(mn, t, v), extra ?? {});
const G = (mn: string, children: Factory[], addable?: Record<string, Factory>): Factory => () => new MockGroup(mn, children.map((f) => f()), addable);

const vectorTransform = G('ADBE Vector Transform Group', [
  P('ADBE Vector Anchor', PVT.TwoD_SPATIAL, [0, 0]),
  P('ADBE Vector Position', PVT.TwoD_SPATIAL, [0, 0]),
  P('ADBE Vector Scale', PVT.TwoD, [100, 100]),
  P('ADBE Vector Skew', PVT.OneD, 0),
  P('ADBE Vector Skew Axis', PVT.OneD, 0),
  P('ADBE Vector Rotation', PVT.OneD, 0),
  P('ADBE Vector Group Opacity', PVT.OneD, 100),
]);

const dashAddable: Record<string, Factory> = {};
for (let n = 1; n <= 3; n++) {
  dashAddable[`ADBE Vector Stroke Dash ${n}`] = P(`ADBE Vector Stroke Dash ${n}`, PVT.OneD, 10);
  dashAddable[`ADBE Vector Stroke Gap ${n}`] = P(`ADBE Vector Stroke Gap ${n}`, PVT.OneD, 10);
}
dashAddable['ADBE Vector Stroke Offset'] = P('ADBE Vector Stroke Offset', PVT.OneD, 0);

const VECTOR_ADDABLE: Record<string, Factory> = {};
Object.assign(VECTOR_ADDABLE, {
  'ADBE Vector Group': () => G('ADBE Vector Group', [P('ADBE Vector Blend Mode', PVT.OneD, 1), G('ADBE Vectors Group', [], VECTOR_ADDABLE), vectorTransform])(),
  'ADBE Vector Shape - Rect': G('ADBE Vector Shape - Rect', [
    P('ADBE Vector Shape Direction', PVT.OneD, 1),
    P('ADBE Vector Rect Size', PVT.TwoD, [100, 100]),
    P('ADBE Vector Rect Position', PVT.TwoD_SPATIAL, [0, 0]),
    P('ADBE Vector Rect Roundness', PVT.OneD, 0),
  ]),
  'ADBE Vector Shape - Ellipse': G('ADBE Vector Shape - Ellipse', [
    P('ADBE Vector Shape Direction', PVT.OneD, 1),
    P('ADBE Vector Ellipse Size', PVT.TwoD, [100, 100]),
    P('ADBE Vector Ellipse Position', PVT.TwoD_SPATIAL, [0, 0]),
  ]),
  'ADBE Vector Shape - Group': G('ADBE Vector Shape - Group', [P('ADBE Vector Shape Direction', PVT.OneD, 1), P('ADBE Vector Shape', PVT.SHAPE, new Shape())]),
  'ADBE Vector Graphic - Fill': G('ADBE Vector Graphic - Fill', [
    P('ADBE Vector Blend Mode', PVT.OneD, 1),
    P('ADBE Vector Composite Order', PVT.OneD, 1),
    P('ADBE Vector Fill Rule', PVT.OneD, 1),
    P('ADBE Vector Fill Color', PVT.COLOR, [1, 0, 0, 1]),
    P('ADBE Vector Fill Opacity', PVT.OneD, 100),
  ]),
  'ADBE Vector Graphic - Stroke': G('ADBE Vector Graphic - Stroke', [
    P('ADBE Vector Blend Mode', PVT.OneD, 1),
    P('ADBE Vector Composite Order', PVT.OneD, 1),
    P('ADBE Vector Stroke Color', PVT.COLOR, [1, 1, 1, 1]),
    P('ADBE Vector Stroke Opacity', PVT.OneD, 100),
    P('ADBE Vector Stroke Width', PVT.OneD, 2),
    P('ADBE Vector Stroke Line Cap', PVT.OneD, 1),
    P('ADBE Vector Stroke Line Join', PVT.OneD, 1),
    P('ADBE Vector Stroke Miter Limit', PVT.OneD, 4),
    G('ADBE Vector Stroke Dashes', [], dashAddable),
  ]),
  'ADBE Vector Filter - Trim': G('ADBE Vector Filter - Trim', [
    P('ADBE Vector Trim Start', PVT.OneD, 0),
    P('ADBE Vector Trim End', PVT.OneD, 100),
    P('ADBE Vector Trim Offset', PVT.OneD, 0),
    P('ADBE Vector Trim Type', PVT.OneD, 1),
  ]),
});

const EFFECT_ADDABLE: Record<string, Factory> = {
  'ADBE Slider Control': G('ADBE Slider Control', [P('ADBE Slider Control-0001', PVT.OneD, 0)]),
  'ADBE Drop Shadow': G('ADBE Drop Shadow', [
    P('ADBE Drop Shadow-0001', PVT.COLOR, [0, 0, 0, 1]),
    // AE stores Drop Shadow opacity on a 0..255 scale; the script must read maxValue to convert.
    P('ADBE Drop Shadow-0002', PVT.OneD, 127.5, {hasMax: true, maxValue: 255}),
    P('ADBE Drop Shadow-0003', PVT.OneD, 135),
    P('ADBE Drop Shadow-0004', PVT.OneD, 5),
    P('ADBE Drop Shadow-0005', PVT.OneD, 0),
    P('ADBE Drop Shadow-0006', PVT.OneD, 0),
  ]),
  'ADBE Gaussian Blur 2': G('ADBE Gaussian Blur 2', [
    P('ADBE Gaussian Blur 2-0001', PVT.OneD, 0),
    P('ADBE Gaussian Blur 2-0002', PVT.OneD, 1),
    P('ADBE Gaussian Blur 2-0003', PVT.OneD, 0),
  ]),
};

const layerTransform = (pos: number[]) =>
  G('ADBE Transform Group', [
    P('ADBE Anchor Point', PVT.ThreeD_SPATIAL, [0, 0, 0]),
    P('ADBE Position', PVT.ThreeD_SPATIAL, pos),
    P('ADBE Position_0', PVT.OneD, pos[0]),
    P('ADBE Position_1', PVT.OneD, pos[1]),
    P('ADBE Position_2', PVT.OneD, 0),
    P('ADBE Scale', PVT.ThreeD, [100, 100, 100]),
    P('ADBE Orientation', PVT.ThreeD_SPATIAL, [0, 0, 0]),
    P('ADBE Rotate X', PVT.OneD, 0),
    P('ADBE Rotate Y', PVT.OneD, 0),
    P('ADBE Rotate Z', PVT.OneD, 0),
    P('ADBE Opacity', PVT.OneD, 100),
  ]);

export class MockGroup extends Base {
  children: Node[];
  constructor(
    matchName: string,
    children: Node[],
    private addable?: Record<string, Factory>,
  ) {
    super(matchName);
    this.children = children;
    for (const c of children) c.parentProperty = this;
  }
  get numProperties() {
    return this.children.length;
  }
  property(key: string | number): Node {
    let found: Node | undefined;
    if (typeof key === 'number') found = this.children[key - 1];
    else found = this.children.find((c) => c.matchName === key) ?? this.children.find((c) => c.name === key);
    if (!found) fail(`${this.layer ? this.path() : this.matchName}: no property ${JSON.stringify(key)}`);
    return found!;
  }
  canAddProperty(mn: string) {
    return !!this.addable?.[mn];
  }
  addProperty(mn: string): Node {
    const f = this.addable?.[mn];
    if (!f) fail(`${this.layer ? this.path() : this.matchName}: cannot add ${JSON.stringify(mn)}`);
    const node = f!();
    node.parentProperty = this;
    setLayer(node, this.layer);
    this.children.push(node);
    return node;
  }
}

function setLayer(n: Node, layer: MockLayer) {
  n.layer = layer;
  if (n instanceof MockGroup) for (const c of n.children) setLayer(c, layer);
}

export class MockLayer {
  name = '';
  parentLayer: MockLayer | null = null;
  enabled = true;
  locked = false;
  label = 0;
  startTime = 0;
  private _in = 0;
  private _out: number;
  trackMatte: {layer: MockLayer; type: number} | null = null;
  motionBlur = false;
  private _audio = true;
  get audioEnabled() {
    return this._audio;
  }
  set audioEnabled(v: boolean) {
    if (this.kind !== 'footage') fail(`${this.name}: audioEnabled set on a layer without audio`);
    this._audio = v;
  }
  get hasVideo() {
    return this.kind !== 'footage';
  }
  private _collapse = false;
  get collapseTransformation() {
    return this._collapse;
  }
  set collapseTransformation(v: boolean) {
    if (this.kind !== 'precomp') fail(`${this.name}: collapseTransformation only on precomp layers`);
    this._collapse = v;
  }
  root: MockGroup;
  constructor(
    public comp: MockComp,
    public kind: 'shape' | 'text' | 'null' | 'solid' | 'precomp' | 'footage',
    public source: unknown = null,
  ) {
    this._out = comp.duration;
    const kids: Factory[] = [layerTransform([comp.width / 2, comp.height / 2, 0]), G('ADBE Effect Parade', [], EFFECT_ADDABLE)];
    if (kind === 'shape') kids.push(G('ADBE Root Vectors Group', [], VECTOR_ADDABLE));
    if (kind === 'text') kids.push(G('ADBE Text Properties', [P('ADBE Text Document', PVT.TEXT_DOCUMENT, new TextDocument(String(source)))]));
    if (kind === 'footage') kids.push(G('ADBE Audio Group', [P('ADBE Audio Levels', PVT.TwoD, [0, 0])]));
    this.root = G('ADBE Layer', kids)() as MockGroup;
    setLayer(this.root, this);
    if (kind === 'null' || kind === 'solid' || kind === 'precomp') {
      const w = kind === 'null' ? 100 : kind === 'precomp' ? (source as MockComp).width : comp.width;
      const h = kind === 'null' ? 100 : kind === 'precomp' ? (source as MockComp).height : comp.height;
      (this.root.property('ADBE Transform Group') as MockGroup).children.forEach((c) => {
        if (c.matchName === 'ADBE Anchor Point') (c as MockProperty).value = [w / 2, h / 2, 0];
      });
    }
  }
  property(key: string | number) {
    return this.root.property(key);
  }
  get transform() {
    return this.root.property('ADBE Transform Group');
  }
  get parent() {
    return this.parentLayer;
  }
  set parent(p: MockLayer | null) {
    if (p && p.comp !== this.comp) fail(`${this.name}: parent must be in the same comp`);
    if (p === this) fail(`${this.name}: cannot parent to itself`);
    this.parentLayer = p;
  }
  get inPoint() {
    return this._in;
  }
  set inPoint(v: number) {
    this._in = v;
  }
  get outPoint() {
    return this._out;
  }
  set outPoint(v: number) {
    if (v <= this._in) fail(`${this.name}: outPoint ${v} must be after inPoint ${this._in}`);
    if (this.kind === 'precomp') {
      const src = this.source as MockComp;
      if (v > this.startTime + src.duration + 1e-6) fail(`${this.name}: outPoint beyond precomp source duration`);
    }
    this._out = v;
  }
  setTrackMatte(layer: MockLayer, type: number) {
    if (layer.comp !== this.comp) fail(`${this.name}: matte must be in the same comp`);
    if (layer === this) fail(`${this.name}: cannot matte itself`);
    if (![1, 2].includes(type)) fail(`${this.name}: bad TrackMatteType ${type}`);
    this.trackMatte = {layer, type};
  }
  moveToEnd() {
    const arr = this.comp.layerList;
    arr.splice(arr.indexOf(this), 1);
    arr.push(this);
  }
}

class LayerCollection {
  constructor(private comp: MockComp) {}
  private push(l: MockLayer) {
    this.comp.layerList.unshift(l); // new layers go on top (index 1)
    return l;
  }
  addShape() {
    return this.push(new MockLayer(this.comp, 'shape'));
  }
  addText(text: string) {
    if (typeof text !== 'string') fail('addText expects a string');
    return this.push(new MockLayer(this.comp, 'text', text));
  }
  addNull() {
    return this.push(new MockLayer(this.comp, 'null'));
  }
  addSolid(color: number[], name: string, w: number, h: number, par: number) {
    if (!Array.isArray(color) || color.length !== 3) fail('addSolid colour must be [r,g,b]');
    if (!(w > 0 && h > 0 && par > 0)) fail('addSolid size');
    const l = this.push(new MockLayer(this.comp, 'solid', color));
    l.name = name;
    return l;
  }
  add(item: unknown) {
    if (item instanceof MockComp) return this.push(new MockLayer(this.comp, 'precomp', item));
    if (item instanceof MockFootage) return this.push(new MockLayer(this.comp, 'footage', item));
    return fail('layers.add expects a CompItem or FootageItem');
  }
  get length() {
    return this.comp.layerList.length;
  }
}

export class MockFolder {
  parentFolder: MockFolder | null = null;
  constructor(public name: string) {}
}

export class MockFootage {
  parentFolder: MockFolder | null = null;
  constructor(public file: string) {}
}

export class MockComp {
  layerList: MockLayer[] = [];
  layers = new LayerCollection(this);
  bgColor: number[] = [0, 0, 0];
  parentFolder: MockFolder | null = null;
  markerProperty: MockProperty;
  opened = false;
  motionBlur = false;
  private _shutterAngle = 180;
  private _shutterPhase = -90;
  private _mbSamples = 16;
  get shutterAngle() {
    return this._shutterAngle;
  }
  set shutterAngle(v: number) {
    if (!(v >= 0 && v <= 720)) fail(`comp ${this.name}: shutterAngle 0..720`);
    this._shutterAngle = v;
  }
  get shutterPhase() {
    return this._shutterPhase;
  }
  set shutterPhase(v: number) {
    if (!(v >= -360 && v <= 360)) fail(`comp ${this.name}: shutterPhase -360..360`);
    this._shutterPhase = v;
  }
  get motionBlurSamplesPerFrame() {
    return this._mbSamples;
  }
  set motionBlurSamplesPerFrame(v: number) {
    if (!(Number.isInteger(v) && v >= 2 && v <= 64)) fail(`comp ${this.name}: motionBlurSamplesPerFrame 2..64`);
    this._mbSamples = v;
  }
  get numLayers() {
    return this.layerList.length;
  }
  layer(i: number) {
    const l = this.layerList[i - 1];
    if (!l) fail(`comp ${this.name}: no layer ${i}`);
    return l;
  }
  constructor(
    public name: string,
    public width: number,
    public height: number,
    public pixelAspect: number,
    public duration: number,
    public frameRate: number,
  ) {
    if (!(width >= 4 && width <= 30000 && height >= 4 && height <= 30000)) fail(`comp ${name}: bad size`);
    if (!(duration > 0 && duration <= 10800)) fail(`comp ${name}: bad duration`);
    if (!(frameRate >= 1 && frameRate <= 999)) fail(`comp ${name}: bad frame rate`);
    this.markerProperty = new MockProperty('ADBE Marker', PVT.MARKER, null);
    const fake = {comp: this, name: '(markers)'} as unknown as MockLayer;
    this.markerProperty.layer = fake;
  }
  openInViewer() {
    this.opened = true;
  }
}

export interface MockRun {
  comps: MockComp[];
  alerts: string[];
  footage: MockFootage[];
  folders: MockFolder[];
}

export function runJsx(
  jsx: string,
  opts: {scriptPath?: string; existingFiles?: string[]; installedFonts?: string[]; aeVersion?: string; confirm?: boolean} = {},
): MockRun {
  const comps: MockComp[] = [];
  const alerts: string[] = [];
  const footage: MockFootage[] = [];
  const folders: MockFolder[] = [];
  const scriptPath = opts.scriptPath ?? '/package/build-onemarsmedia-360.jsx';
  const existing = new Set(opts.existingFiles ?? []);
  class File {
    fsName: string;
    constructor(public path: string) {
      this.fsName = path;
    }
    get parent() {
      return new File(this.path.replace(/\/[^/]*$/, ''));
    }
    get exists() {
      return existing.has(this.path);
    }
  }
  class ImportOptions {
    constructor(public file: File) {}
  }
  const project = {
    numItems: 0,
    bitsPerChannel: 16,
    linearBlending: true,
    items: {
      addComp(name: string, w: number, h: number, par: number, dur: number, fps: number) {
        const c = new MockComp(name, w, h, par, dur, fps);
        comps.push(c);
        return c;
      },
      addFolder(name: string) {
        const f = new MockFolder(name);
        folders.push(f);
        return f;
      },
    },
    importFile(io: ImportOptions) {
      if (!(io instanceof ImportOptions)) fail('importFile expects ImportOptions');
      if (!io.file.exists) fail(`importFile: missing ${io.file.path}`);
      const f = new MockFootage(io.file.path);
      footage.push(f);
      return f;
    },
  };
  const fonts = new Set(opts.installedFonts ?? []);
  INSTALLED = opts.installedFonts ? new Set([...fonts, 'ArialMT']) : null;
  const sandbox = {
    app: {
      project,
      version: opts.aeVersion ?? '25.2x15',
      newProject() {
        return project;
      },
      beginUndoGroup() {},
      endUndoGroup() {},
      fonts: {getFontsByPostScriptName: (n: string) => (opts.installedFonts === undefined || fonts.has(n) ? [{isSubstitute: false}] : [{isSubstitute: true}])},
    },
    $: {fileName: scriptPath},
    File,
    ImportOptions,
    Shape,
    TextDocument,
    MarkerValue,
    KeyframeEase,
    KeyframeInterpolationType: KIT,
    PropertyValueType: PVT,
    ParagraphJustification: {LEFT_JUSTIFY: 7413, RIGHT_JUSTIFY: 7414, CENTER_JUSTIFY: 7415},
    TrackMatteType: {ALPHA: 1, ALPHA_INVERTED: 2},
    alert: (m: string) => alerts.push(String(m)),
    confirm: (m: string) => {
      alerts.push(`confirm: ${m}`);
      return opts.confirm ?? true;
    },
  };
  vm.runInNewContext(jsx, sandbox, {filename: 'build.jsx'});
  return {comps, alerts, footage, folders};
}

/** Evaluate a recorded AE property at time tSec, the way AE interpolates 1D bezier/linear/hold keys. */
export function evalMockProperty(p: MockProperty, tSec: number, evalSeg: (t0: number, v0: number, t1: number, v1: number, out: KeyframeEase, inn: KeyframeEase, t: number) => number): number[] {
  const toArr = (v: unknown) => (Array.isArray(v) ? (v as number[]) : [v as number]);
  if (!p.keys.length) return toArr(p.value);
  const ks = p.keys;
  // AE snaps keys to the frame grid; the emitted times carry ~1e-9 s of rounding, so compare with a tolerance.
  const EPS = 1e-6;
  if (tSec < ks[0].t + EPS) return toArr(ks[0].v);
  if (tSec >= ks[ks.length - 1].t - EPS) return toArr(ks[ks.length - 1].v);
  let i = 0;
  while (tSec >= ks[i + 1].t - EPS) i++;
  if (tSec <= ks[i].t + EPS) return toArr(ks[i].v);
  const a = ks[i];
  const b = ks[i + 1];
  const va = toArr(a.v);
  const vb = toArr(b.v);
  if (a.outType === KIT.HOLD) return va;
  const x = (tSec - a.t) / (b.t - a.t);
  if (a.outType === KIT.LINEAR && b.inType === KIT.LINEAR) return va.map((v, d) => v + (vb[d] - v) * x);
  return va.map((v, d) => {
    const out = a.outEase![Math.min(d, a.outEase!.length - 1)];
    const inn = b.inEase![Math.min(d, b.inEase!.length - 1)];
    return evalSeg(a.t, v, b.t, vb[d], out, inn, tSec);
  });
}

export function findProperty(run: MockRun, path: string): MockProperty {
  const [compName, layerName, ...rest] = path.split('/');
  const comp = run.comps.find((c) => c.name === compName) ?? fail(`no comp ${compName}`);
  const layer = comp.layerList.find((l) => l.name === layerName) ?? fail(`no layer ${layerName} in ${compName}`);
  let node: Node = layer.root;
  for (const part of rest) {
    const g = node as MockGroup;
    node = INDEXED.has(g.matchName) ? g.property(Number(part)) : g.property(part);
  }
  if (!(node instanceof MockProperty)) fail(`${path} is not a property`);
  return node as MockProperty;
}
