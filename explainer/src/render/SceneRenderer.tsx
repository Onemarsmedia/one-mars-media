import React from 'react';
import {compLinkCtx, evalColor, evalNumber, evalVec2, type LinkCtx} from '../scene/eval';
import {textAt} from '../scene/text';
import type {Comp, Effect, Geometry, Layer, PathData, Scene, ShapeItem, Stroke, TextLayer, Trim} from '../scene/types';
import {aeTransform, multiply, toSvg, type Mat} from './matrix';

// Renders one frame of a Scene comp as SVG, following After Effects semantics:
//   - layers bottom -> top, visible for in <= t < out
//   - parenting composes transforms but NOT opacity
//   - track mattes use the matte layer's alpha (or inverted alpha)
//   - precomps are clipped to their own frame
// Any change here must be mirrored in ae/emit-jsx.ts (and vice versa).

// SVG ids are document-global and motion blur renders several frames into one page, so every
// SceneFrame gets its own id namespace through context.
const IdContext = React.createContext<{prefix: string; n: number}>({prefix: 'x', n: 0});
function useNextId() {
  const ids = React.useContext(IdContext);
  return (p: string) => `${ids.prefix}${p}${++ids.n}`;
}

export function pathToD(p: PathData): string {
  const n = p.v.length;
  if (n === 0) return '';
  const seg = (a: number, b: number) => {
    const o = p.o?.[a] ?? [0, 0];
    const i = p.i?.[b] ?? [0, 0];
    const va = p.v[a];
    const vb = p.v[b];
    if (o[0] === 0 && o[1] === 0 && i[0] === 0 && i[1] === 0) return `L${vb[0]} ${vb[1]}`;
    return `C${va[0] + o[0]} ${va[1] + o[1]} ${vb[0] + i[0]} ${vb[1] + i[1]} ${vb[0]} ${vb[1]}`;
  };
  let d = `M${p.v[0][0]} ${p.v[0][1]}`;
  for (let k = 0; k < n - 1; k++) d += seg(k, k + 1);
  if (p.closed) d += seg(n - 1, 0) + 'Z';
  return d;
}

function layerMatrix(comp: Comp, layer: Layer, t: number, seen: Set<string> = new Set()): Mat {
  const tr = layer.transform ?? {};
  const local = aeTransform(
    tr.anchor ?? [0, 0],
    evalVec2(tr.position, t, [0, 0]),
    evalVec2(tr.scale, t, [100, 100], compLinkCtx(comp)),
    evalNumber(tr.rotation, t, 0, compLinkCtx(comp)),
  );
  if (!layer.parent) return local;
  if (seen.has(layer.name)) throw new Error(`Parent cycle at ${layer.name}`);
  seen.add(layer.name);
  const parent = comp.layers.find((l) => l.name === layer.parent);
  if (!parent) throw new Error(`Missing parent ${layer.parent} for ${layer.name}`);
  return multiply(layerMatrix(comp, parent, t, seen), local);
}

function geometryElement(g: Geometry, t: number, key: string, paint: React.SVGProps<SVGElement>): React.ReactNode {
  if (g.type === 'rect') {
    const [w, h] = evalVec2(g.size, t, [0, 0]);
    const [cx, cy] = g.center ?? [0, 0];
    const r = Math.min(evalNumber(g.roundness, t, 0), Math.abs(w) / 2, Math.abs(h) / 2);
    return <rect key={key} x={cx - w / 2} y={cy - h / 2} width={Math.abs(w)} height={Math.abs(h)} rx={r} ry={r} {...(paint as React.SVGProps<SVGRectElement>)} />;
  }
  if (g.type === 'ellipse') {
    const [w, h] = evalVec2(g.size, t, [0, 0]);
    const [cx, cy] = g.center ?? [0, 0];
    return <ellipse key={key} cx={cx} cy={cy} rx={Math.abs(w) / 2} ry={Math.abs(h) / 2} {...(paint as React.SVGProps<SVGEllipseElement>)} />;
  }
  return <path key={key} d={pathToD(g.path)} {...(paint as React.SVGProps<SVGPathElement>)} />;
}

function strokePaint(s: Stroke, t: number, trim: Trim | undefined, ctx: LinkCtx): React.SVGProps<SVGElement> | null {
  const paint: React.SVGProps<SVGElement> = {
    fill: 'none',
    stroke: evalColor(s.color, t),
    strokeWidth: evalNumber(s.width, t, 1, ctx),
    strokeOpacity: evalNumber(s.opacity, t, 100, ctx) / 100,
    strokeLinecap: s.cap ?? 'butt',
    strokeLinejoin: s.join ?? 'miter',
  };
  if (trim) {
    const start = evalNumber(trim.start, t, 0, ctx);
    const end = evalNumber(trim.end, t, 100, ctx);
    const offset = (evalNumber(trim.offset, t, 0, ctx) / 360) * 100;
    const lo = Math.min(start, end);
    const visible = Math.abs(end - start);
    if (visible <= 0.001) return null;
    if (visible < 100) {
      paint.pathLength = 100;
      paint.strokeDasharray = `${visible} ${100 - visible}`;
      paint.strokeDashoffset = -(lo + offset);
    }
  } else if (s.dash?.length) {
    paint.strokeDasharray = s.dash.join(' ');
  }
  return paint;
}

function ShapeItems({items, t, ctx}: {items: ShapeItem[]; t: number; ctx: LinkCtx}) {
  return (
    <>
      {items.map((item, idx) => {
        const geos = Array.isArray(item.geo) ? item.geo : [item.geo];
        const gt = item.transform ?? {};
        const m = aeTransform(gt.anchor ?? [0, 0], gt.position ?? [0, 0], evalVec2(gt.scale, t, [100, 100]), evalNumber(gt.rotation, t, 0, ctx));
        const opacity = evalNumber(gt.opacity, t, 100, ctx) / 100;
        const fillPaint: React.SVGProps<SVGElement> | null = item.fill
          ? {fill: evalColor(item.fill.color, t), fillOpacity: evalNumber(item.fill.opacity, t, 100, ctx) / 100, stroke: 'none'}
          : null;
        const sPaint = item.stroke ? strokePaint(item.stroke, t, item.trim, ctx) : null;
        if (opacity <= 0) return null;
        return (
          <g key={idx} transform={toSvg(m)} opacity={opacity < 1 ? opacity : undefined}>
            {fillPaint && geos.map((g, gi) => geometryElement(g, t, `f${gi}`, fillPaint))}
            {sPaint && geos.map((g, gi) => geometryElement(g, t, `s${gi}`, sPaint))}
          </g>
        );
      })}
    </>
  );
}

function TextContent({layer, t, ctx}: {layer: TextLayer; t: number; ctx: LinkCtx}) {
  const value = textAt(layer.source, t, ctx);
  const lines = value.split('\n');
  const anchor = layer.justify === 'center' ? 'middle' : layer.justify === 'right' ? 'end' : 'start';
  return (
    <text
      x={0}
      y={0}
      fill={layer.noFill ? 'none' : layer.color}
      stroke={layer.stroke?.color}
      strokeWidth={layer.stroke?.width}
      fontFamily={`'${layer.font.family}'`}
      fontWeight={layer.font.weight}
      fontStyle={layer.font.style ?? 'normal'}
      fontSize={layer.size}
      letterSpacing={((layer.tracking ?? 0) / 1000) * layer.size}
      textAnchor={anchor}
      style={{whiteSpace: 'pre', fontKerning: 'normal'}}
    >
      {lines.map((ln, i) => (
        <tspan key={i} x={0} dy={i === 0 ? 0 : (layer.leading ?? layer.size * 1.2)}>
          {ln}
        </tspan>
      ))}
    </text>
  );
}

function effectFilter(id: string, effects: Effect[], t: number): React.ReactNode {
  const prims: React.ReactNode[] = [];
  effects.forEach((e, i) => {
    if (e.type === 'dropShadow') {
      const r = (e.direction * Math.PI) / 180;
      prims.push(
        <feDropShadow
          key={i}
          dx={Math.sin(r) * e.distance}
          dy={-Math.cos(r) * e.distance}
          stdDeviation={e.softness / 2}
          floodColor={e.color}
          floodOpacity={e.opacity / 100}
        />,
      );
    } else {
      const amount = evalNumber(e.amount, t, 0);
      if (amount > 0) prims.push(<feGaussianBlur key={i} stdDeviation={amount / 2.4} />);
    }
  });
  if (!prims.length) return null;
  return (
    <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
      {prims}
    </filter>
  );
}

function isVisible(layer: Layer, comp: Comp, t: number): boolean {
  return t >= (layer.in ?? 0) && t < (layer.out ?? comp.duration);
}

function LayerContent({scene, comp, layer, t}: {scene: Scene; comp: Comp; layer: Layer; t: number}): React.ReactNode {
  const ctx = compLinkCtx(comp);
  switch (layer.kind) {
    case 'shape':
      return <ShapeItems items={layer.items} t={t} ctx={ctx} />;
    case 'text':
      return <TextContent layer={layer} t={t} ctx={ctx} />;
    case 'solid':
      return <rect x={0} y={0} width={comp.width} height={comp.height} fill={layer.color} />;
    case 'precomp': {
      const sub = scene.comps[layer.comp];
      if (!sub) throw new Error(`Missing comp ${layer.comp}`);
      const content = <CompContent scene={scene} comp={sub} t={t - (layer.startTime ?? 0)} isPrecomp />;
      if (layer.collapse) return content;
      return <ClippedPrecomp w={sub.width} h={sub.height}>{content}</ClippedPrecomp>;
    }
    case 'null':
      return null;
  }
}

function ClippedPrecomp({w, h, children}: {w: number; h: number; children: React.ReactNode}) {
  const clip = useNextId()('clip');
  return (
    <>
      <clipPath id={clip}>
        <rect x={0} y={0} width={w} height={h} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>{children}</g>
    </>
  );
}

function RenderedLayer({scene, comp, layer, t}: {scene: Scene; comp: Comp; layer: Layer; t: number}) {
  const nextId = useNextId();
  const m = layerMatrix(comp, layer, t);
  const opacity = evalNumber(layer.transform?.opacity, t, 100, compLinkCtx(comp)) / 100;
  const filterId = layer.effects?.length ? nextId('fx') : null;
  const filter = filterId ? effectFilter(filterId, layer.effects!, t) : null;
  return (
    <>
      {filter && <defs>{filter}</defs>}
      <g transform={toSvg(m)} opacity={opacity < 1 ? opacity : undefined} filter={filter ? `url(#${filterId})` : undefined}>
        <LayerContent scene={scene} comp={comp} layer={layer} t={t} />
      </g>
    </>
  );
}

export function CompContent({scene, comp, t, isPrecomp}: {scene: Scene; comp: Comp; t: number; isPrecomp?: boolean}) {
  const nextId = useNextId();
  // AE renders a comp's background colour only for the top-level comp, never inside a precomp.
  return (
    <>
      {comp.bg && !isPrecomp && <rect x={0} y={0} width={comp.width} height={comp.height} fill={comp.bg} />}
      {comp.layers.map((layer) => {
        if (layer.kind === 'null' || layer.matteSource || !isVisible(layer, comp, t)) return null;
        const body = <RenderedLayer scene={scene} comp={comp} layer={layer} t={t} />;
        if (!layer.matte) return <React.Fragment key={layer.name}>{body}</React.Fragment>;
        const matteLayer = comp.layers.find((l) => l.name === layer.matte!.layer);
        if (!matteLayer) throw new Error(`Missing matte ${layer.matte.layer}`);
        const maskId = nextId('m');
        const inverted = layer.matte.type === 'alphaInverted';
        const blackId = nextId('blk');
        const matteVisible = isVisible(matteLayer, comp, t);
        return (
          <React.Fragment key={layer.name}>
            <defs>
              {inverted && (
                <filter id={blackId}>
                  <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
                </filter>
              )}
              <mask
                id={maskId}
                maskUnits="userSpaceOnUse"
                x={-20000}
                y={-20000}
                width={40000}
                height={40000}
                style={{maskType: inverted ? 'luminance' : 'alpha'}}
              >
                {inverted && <rect x={-20000} y={-20000} width={40000} height={40000} fill="#fff" />}
                {matteVisible && (
                  <g filter={inverted ? `url(#${blackId})` : undefined}>
                    <RenderedLayer scene={scene} comp={comp} layer={matteLayer} t={t} />
                  </g>
                )}
              </mask>
            </defs>
            <g mask={`url(#${maskId})`}>{body}</g>
          </React.Fragment>
        );
      })}
    </>
  );
}

export function SceneFrame({scene, compName, t, idPrefix = 'f'}: {scene: Scene; compName?: string; t: number; idPrefix?: string}) {
  const comp = scene.comps[compName ?? scene.main];
  const ids = {prefix: idPrefix, n: 0};
  return (
    <IdContext.Provider value={ids}>
      <svg width={comp.width} height={comp.height} viewBox={`0 0 ${comp.width} ${comp.height}`} xmlns="http://www.w3.org/2000/svg" style={{display: 'block'}}>
        <CompContent scene={scene} comp={comp} t={t} />
      </svg>
    </IdContext.Provider>
  );
}
