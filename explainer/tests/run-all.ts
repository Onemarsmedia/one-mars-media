// Engine tests: run with `npm test`.
//  1. ease maths: CSS-style bezier == AE (speed, influence) curve
//  2. spring keys: sane, strictly increasing, settle on target
//  3. AE round trip: emitted .jsx parses as ES3, runs clean on the AE mock, and every animated
//     property evaluates to the scene's value at every frame; text expressions match too.
import * as acorn from 'acorn';
import {buildTestScene} from '../src/film/testScene';
import {bezierProgress, bezierToAe, evalAeSegment} from '../src/scene/ease';
import {springKeys} from '../src/scene/builders';
import {compLinkCtx, evalNumber, evalVec2, isAnimated, isLinked} from '../src/scene/eval';
import {textAt} from '../src/scene/text';
import type {Bezier, Num, Prop, Scene, TextLayer, Vec2} from '../src/scene/types';
import {emitJsx} from '../ae/emit-jsx';
import {evalMockProperty, findProperty, runJsx, type MockLayer, type MockProperty, type MockRun} from '../ae/mock/ae-mock';

let failures = 0;
let checks = 0;
function check(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    failures++;
    console.error('  FAIL', msg);
  }
}
function section(name: string, fn: () => void) {
  const before = failures;
  try {
    fn();
  } catch (e) {
    failures++;
    console.error('  FAIL (threw)', (e as Error).stack ?? e);
  }
  console.log(`${failures === before ? 'ok  ' : 'FAIL'} ${name}`);
}

section('ease: bezier and AE speed/influence describe the same curve', () => {
  const beziers: Bezier[] = [
    [0.16, 1, 0.3, 1],
    [0.65, 0, 0.35, 1],
    [0.34, 1.45, 0.64, 1],
    [0.7, 0, 0.84, 0],
    [0.2, 0.9, 0.1, 1],
  ];
  for (const b of beziers) {
    for (const [v0, v1, dt] of [
      [0, 100, 0.5],
      [100, 40, 1.2],
      [-30, 270, 2],
      [5, 5, 1],
    ]) {
      const e = bezierToAe(b, v1 - v0, dt);
      for (let i = 0; i <= 50; i++) {
        const x = i / 50;
        const expected = v0 + (v1 - v0) * bezierProgress(b, x);
        const got = evalAeSegment(0, v0, dt, v1, e.out, e.in, x * dt);
        check(Math.abs(expected - got) < 1e-4, `bezier ${b} v ${v0}->${v1} x=${x}: ${expected} vs ${got}`);
      }
    }
  }
});

section('spring keys settle on target with whole-frame, increasing keys', () => {
  for (const zeta of [0.35, 0.5, 0.7, 1]) {
    for (const freq of [1.5, 2.5, 4]) {
      const ks = springKeys(0, 100, 10, {fps: 30, zeta, freq});
      check(ks[0].t === 10 && ks[0].v === 0, `spring start z=${zeta} f=${freq}`);
      check(ks[ks.length - 1].v === 100, `spring end z=${zeta} f=${freq}`);
      for (let i = 1; i < ks.length; i++) {
        check(ks[i].t > ks[i - 1].t && Number.isInteger(ks[i].t), `spring key times z=${zeta} f=${freq}`);
      }
      if (zeta < 1) check(ks.some((k) => k.v > 100), `spring overshoots z=${zeta} f=${freq}`);
      check(ks.length <= 8, `spring stays editable (${ks.length} keys) z=${zeta} f=${freq}`);
    }
  }
});

const aeAt = (p: MockProperty, tSec: number) => evalMockProperty(p, tSec, (t0, v0, t1, v1, o, i, t) => evalAeSegment(t0, v0, t1, v1, o, i, t));

/** Minimal AE expression environment: effect(name)(matchName).value and thisComp.layer(name).effect(...). */
function exprEnv(run: MockRun, compName: string, layerName: string, tSec: number) {
  const comp = run.comps.find((c) => c.name === compName)!;
  const effectOf = (layer: MockLayer) => (name: string) => (mn: string) => {
    const parade = layer.property('ADBE Effect Parade') as unknown as {children: {name: string; property(k: string): MockProperty}[]};
    const fx = parade.children.find((c) => c.name === name);
    if (!fx) throw new Error(`expression: no effect ${name} on ${layer.name}`);
    return {value: aeAt(fx.property(mn), tSec)[0]};
  };
  const self = comp.layerList.find((l) => l.name === layerName)!;
  return {
    effect: effectOf(self),
    thisComp: {
      layer: (n: string) => {
        const l = comp.layerList.find((x) => x.name === n);
        if (!l) throw new Error(`expression: no layer ${n}`);
        return {effect: effectOf(l)};
      },
    },
  };
}

function evalExpr(expr: string, env: ReturnType<typeof exprEnv>, value: unknown): unknown {
  return new Function('effect', 'thisComp', 'value', `return eval(${JSON.stringify(expr)});`)(env.effect, env.thisComp, value);
}

function roundTrip(scene: Scene, label: string) {
  const {jsx, manifest} = emitJsx(scene);
  // ES3 syntax (ExtendScript)
  try {
    acorn.parse(jsx, {ecmaVersion: 3, sourceType: 'script'});
    check(true, 'es3');
  } catch (e) {
    check(false, `${label}: generated .jsx is not ES3: ${(e as Error).message}`);
    return;
  }
  check(/^[\x00-\x7f]*$/.test(jsx), `${label}: .jsx must be ASCII-only`);
  let run: MockRun;
  try {
    run = runJsx(jsx, {existingFiles: (scene.audio ?? []).map((a) => `/package/audio/${a.file}`)});
  } catch (e) {
    check(false, `${label}: mock AE rejected the script: ${(e as Error).message}`);
    return;
  }
  const errors = run.alerts.filter((a) => a.startsWith('Build stopped'));
  check(errors.length === 0, `${label}: script reported ${errors.join(' | ')}`);
  // Comps and layer stacking
  for (const c of Object.values(scene.comps)) {
    const mc = run.comps.find((m) => m.name === c.name);
    check(!!mc, `${label}: comp ${c.name} created`);
    if (!mc) continue;
    const expectedTopDown = [...c.layers].reverse().map((l) => l.name);
    const got = mc.layerList.filter((l) => l.name !== 'Background').map((l) => l.name);
    check(JSON.stringify(got) === JSON.stringify(expectedTopDown), `${label}: ${c.name} layer order ${got} vs ${expectedTopDown}`);
    for (const l of c.layers) {
      const ml = mc.layerList.find((m) => m.name === l.name)!;
      check((ml.parent?.name ?? undefined) === l.parent, `${label}: ${l.name} parent`);
      if (l.matte) check(ml.trackMatte?.layer.name === l.matte.layer, `${label}: ${l.name} matte`);
      if (l.matteSource) check(ml.enabled === false, `${label}: ${l.name} matte source hidden`);
      check(Math.abs(ml.inPoint - (l.in ?? 0) / c.fps) < 1e-6 && Math.abs(ml.outPoint - (l.out ?? c.duration) / c.fps) < 1e-6, `${label}: ${l.name} in/out`);
    }
  }
  // Every animated property, every frame
  for (const m of manifest) {
    const p = findProperty(run, m.path);
    const comp = Object.values(scene.comps).find((c) => m.path.startsWith(c.name + '/'))!;
    if (isLinked(m.prop)) {
      check(p.expression.length > 0 && p.keys.length === 0, `${label}: ${m.path} should be driven by an expression`);
      const layerName = m.path.split('/')[1];
      for (let f = 0; f <= comp.duration; f++) {
        const got = Number(evalExpr(p.expression, exprEnv(run, comp.name, layerName, f / comp.fps), p.value));
        const want = evalNumber(m.prop as Num, f, 0, compLinkCtx(comp));
        if (Math.abs(got - want) > 2e-3) {
          check(false, `${label}: ${m.path} @${f}: expression ${got} vs scene ${want}`);
          break;
        }
        check(true, '');
      }
      continue;
    }
    for (let f = 0; f <= comp.duration; f++) {
      const got = evalMockProperty(p, f / m.fps, (t0, v0, t1, v1, o, i, t) => evalAeSegment(t0, v0, t1, v1, o, i, t));
      let expected: number[];
      if (m.dim !== undefined) expected = [evalVec2(m.prop as Prop<Vec2>, f, [0, 0])[m.dim]];
      else {
        const isVec = isAnimated(m.prop) && Array.isArray((m.prop as {keys: {v: unknown}[]}).keys[0].v);
        expected = isVec ? evalVec2(m.prop as Prop<Vec2>, f, [0, 0]) : [evalNumber(m.prop as Prop<number>, f, 0)];
      }
      const ok = expected.every((v, d) => Math.abs(v - got[d]) < 2e-3);
      if (!ok) {
        check(false, `${label}: ${m.path} @${f}: expected ${expected} got ${got}`);
        break;
      }
      check(true, '');
    }
  }
  // Text expressions reproduce textAt()
  for (const c of Object.values(scene.comps)) {
    for (const l of c.layers.filter((x): x is TextLayer => x.kind === 'text')) {
      if (l.source.kind === 'static') continue;
      const mc = run.comps.find((x) => x.name === c.name)!;
      const ml = mc.layerList.find((x) => x.name === l.name)!;
      const td = (ml.property('ADBE Text Properties') as unknown as {property(k: string): {expression: string; value: {text: string}}}).property('ADBE Text Document');
      check(td.expression.length > 0, `${label}: ${l.name} has a Source Text expression`);
      for (let f = 0; f <= c.duration; f++) {
        const out = evalExpr(td.expression, exprEnv(run, c.name, l.name, f / c.fps), td.value.text.replace(/\r/g, '\n'));
        const want = textAt(l.source, f, compLinkCtx(c));
        if (out !== want) {
          check(false, `${label}: ${l.name} @${f} expression "${out}" vs "${want}"`);
          break;
        }
        check(true, '');
      }
    }
  }
}

section('AE round trip: test scene', () => roundTrip(buildTestScene(), 'test scene'));

console.log(`\n${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
