// Styleframes for "Action taker" v2 (9:16). node design/action-v2/gen.mjs -> frames/*.png
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium} = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright/index.js');

const here = path.dirname(new URL(import.meta.url).pathname);
const fonts = path.resolve(here, '../../public/fonts');
const RED = '#FF4A1C', INK = '#121110', PAPER = '#F1ECE2', MUTE = '#9A9286', CARD = '#1D1B19';
const LABELS = ['PLAN', 'RECCE', 'CREW', 'SHOOT', 'BTS', 'DIRECT', 'EDIT', 'MOTION', 'SOUND', 'HERO', 'SOCIAL', 'DELIVER'];
const TW = 222, TH = 214, G = 12, X0 = 78, Y0 = 880;
const tiles = path.resolve(here, 'tiles');
const img = (i) => `background-image:url(file://${tiles}/${LABELS[i]}.jpg)`;
// stacking order: bottom row first, left to right
const slot = (i) => {const r = 2 - Math.floor(i / 4), c = i % 4; return [X0 + c * (TW + G), Y0 + r * (TH + G)];};

const tile = (i, {state = 'on', dim = 1, focus = false} = {}) => {
  const [x, y] = slot(i);
  if (state === 'empty') return `<div class="slot" style="left:${x}px;top:${y}px"></div>`;
  return `<div class="tile ${focus ? 'focus' : ''}" style="left:${x}px;top:${y}px;opacity:${dim};${img(i)}"><div class="tl">${LABELS[i]}</div></div>`;
};
const falling = (i, lift) => {
  const [x, y] = slot(i);
  const ghosts = [0.1, 0.18, 0.3].map((o, k) => `<div class="tile ghost" style="left:${x}px;top:${y - lift - (3 - k) * 22}px;opacity:${o};${img(i)}"></div>`).join('');
  return ghosts + `<div class="tile" style="left:${x}px;top:${y - lift}px;transform:rotate(4deg);${img(i)}"><div class="tl">${LABELS[i]}</div></div>`;
};
const counter = (deg, ring) => {
  const r = 92, c = 2 * Math.PI * r;
  return `<svg class="ring" width="240" height="240" viewBox="0 0 240 240"><circle cx="120" cy="120" r="${r}" fill="none" stroke="${PAPER}" stroke-opacity=".1" stroke-width="4"/>
    <circle cx="120" cy="120" r="${r}" fill="none" stroke="${RED}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${c * ring} ${c}" transform="rotate(-90 120 120)"/></svg>
    <div class="deg">${deg}<span>°</span></div>`;
};
const editor = ({dim = 1, version = 'v47', stamp = false, bar = 0}) => `
  <div class="win" style="opacity:${dim}">
    <div class="bar"><span>Launch_film_FINAL_${version}.prproj</span><span class="pill">${version}</span></div>
    <div class="viewer"><div class="frameblk"></div><div class="nudge">← 1 px</div><div class="nudge r">→ 1 px</div></div>
    <div class="tlrow"><div class="clip" style="width:180px"></div><div class="clip" style="width:240px"></div><div class="clip red" style="width:90px"></div><div class="clip" style="width:200px"></div></div>
    <div class="status">${bar ? `Exporting… <b>${bar}%</b>` : 'Tweaking the kerning. Again.'}</div>
    ${bar ? `<div class="exp"><div style="width:${bar}%"></div></div>` : ''}
  </div>
  ${stamp ? '<div class="stamp">EXPORT CANCELLED</div>' : ''}`;

const shell = (top, bottom, caption, extra = '') => `
  <div class="ab">
    <div class="grid"></div>
    ${top}
    <div class="split"><div class="tip"></div></div>
    <div class="lab" style="top:800px;color:${RED}">THE ACTION TAKER</div>
    ${bottom}
    ${extra}
    ${caption ? `<div class="capband"></div><div class="cap">${caption}</div>` : ''}
    <div class="wm"><div>Directed &amp; produced by Marek Mars</div><div>Onemarsmedia Limited · onemarsmedia.com</div></div>
  </div>`;
const topLab = `<div class="lab" style="top:150px">THE PERFECTIONIST</div>`;

const frames = {
  '1-hook': shell(topLab + editor({}), Array.from({length: 12}, (_, i) => tile(i, {state: 'empty'})).join('') + counter(0, 0), 'Some people polish<br>version forty-seven.'),
  '2-ship': shell(topLab + editor({dim: 0.45, bar: 99, stamp: true}), [0, 1, 2].map((i) => tile(i)).join('') + falling(3, 260) + Array.from({length: 8}, (_, i) => tile(i + 4, {state: 'empty'})).join('') + counter(90, 0.25), 'Some people ship.'),
  '3-build': shell(topLab + editor({dim: 0.3, version: 'v48', bar: 0}),
    [0, 1, 2, 3, 4, 5, 6].map((i) => tile(i, {dim: 0.35})).join('') + tile(7, {focus: true}) + falling(8, 36) + [9, 10, 11].map((i) => tile(i, {state: 'empty'})).join('') + counter(240, 0.667) +
    `<div class="callout"><div class="cl"></div><div class="cdot"></div><div class="ct">Animated in-house.</div></div>`,
    'Cut it. Animate it.'),
  '4-proof': shell(`<div class="proof"><div class="n13">13</div><div class="yrs">years of UK production</div><div class="bl">FOR BRANDS LIKE</div><div class="br">Vogue Arabia <i></i> Adidas <i></i> ASOS</div></div>`,
    Array.from({length: 12}, (_, i) => tile(i)).join('') + counter(360, 1), ''),
  '5-end': shell(`<div class="end"><div class="wmk">Onemarsmedia</div><div class="ul"></div><div class="tag">Stop polishing. Start shipping.</div><div class="sub">360 PRODUCTION STUDIO · LONDON</div></div>`,
    Array.from({length: 12}, (_, i) => tile(i, {dim: 0.3})).join('') + counter(360, 1), '', '<div class="url">onemarsmedia.com</div>'),
};

const css = `
@font-face{font-family:SG;font-weight:600;src:url(file://${fonts}/SchibstedGrotesk-w600-s100.ttf)}
@font-face{font-family:SG;font-weight:700;src:url(file://${fonts}/SchibstedGrotesk-w700-s100.ttf)}
@font-face{font-family:SG;font-weight:800;src:url(file://${fonts}/SchibstedGrotesk-w800-s100.ttf)}
@font-face{font-family:Anton;src:url(file://${fonts}/Anton-w400-s100.ttf)}
*{box-sizing:border-box;margin:0}
body{background:#000}
.ab{position:relative;width:1080px;height:1920px;background:${INK};overflow:hidden;font-family:SG;color:${PAPER}}
.grid{position:absolute;inset:0;background-image:radial-gradient(${PAPER} 1.5px,transparent 1.6px);background-size:48px 48px;opacity:.09}
.lab{position:absolute;left:80px;font-weight:800;font-size:22px;letter-spacing:4px;color:${MUTE}}
.split{position:absolute;left:0;right:0;top:770px;height:4px;background:${RED};border-radius:2px}
.tip{position:absolute;right:-6px;top:-14px;width:32px;height:32px;border-radius:50%;background:${RED};opacity:.25;box-shadow:0 0 30px ${RED}}
.win{position:absolute;left:80px;top:196px;width:920px;height:540px;background:${CARD};border-radius:22px;border:1.5px solid rgba(241,236,226,.12);box-shadow:0 30px 60px rgba(0,0,0,.5)}
.win .bar{display:flex;justify-content:space-between;align-items:center;height:72px;padding:0 30px;border-bottom:1.5px solid rgba(241,236,226,.1);font-weight:700;font-size:22px}
.pill{background:${RED};color:#fff;border-radius:16px;padding:6px 16px;font-weight:800;font-size:20px}
.viewer{position:absolute;left:30px;top:96px;width:860px;height:250px;background:#0B0A09;border-radius:12px}
.frameblk{position:absolute;left:320px;top:45px;width:220px;height:160px;border:3px solid ${PAPER};border-radius:6px;transform:translateX(3px)}
.nudge{position:absolute;left:150px;top:110px;font-weight:800;font-size:22px;color:${RED}}
.nudge.r{left:580px}
.tlrow{position:absolute;left:30px;top:368px;display:flex;gap:8px}
.clip{height:44px;border-radius:6px;background:#2D2A26}
.clip.red{background:${RED}}
.status{position:absolute;left:30px;top:446px;font-weight:600;font-size:24px;color:${MUTE}}
.status b{color:${PAPER}}
.exp{position:absolute;left:30px;right:30px;top:492px;height:12px;border-radius:6px;background:rgba(241,236,226,.1)}
.exp div{height:100%;border-radius:6px;background:${RED}}
.stamp{position:absolute;left:150px;top:400px;padding:18px 34px;border:5px solid ${RED};color:${RED};font-weight:800;font-size:58px;letter-spacing:3px;transform:rotate(-7deg);background:rgba(18,17,16,.85);border-radius:10px}
.slot{position:absolute;width:${TW}px;height:${TH}px;border:2px dashed rgba(241,236,226,.12);border-radius:12px}
.tile{position:absolute;width:${TW}px;height:${TH}px;border-radius:12px;overflow:hidden;background-color:#2A2622;background-size:cover;background-position:center;box-shadow:0 14px 28px rgba(0,0,0,.55)}
.tile.ghost{box-shadow:none;filter:blur(3px)}
.tile.focus{transform:scale(1.08);outline:3px solid ${RED};z-index:3;box-shadow:0 24px 50px rgba(0,0,0,.7)}
.grain{position:absolute;inset:0;opacity:.35;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='.9' numOctaves='2'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='.5'/></svg>")}
.tl{position:absolute;left:10px;top:10px;font-weight:800;font-size:14px;letter-spacing:2px;background:rgba(18,17,16,.78);padding:5px 9px 4px;border-radius:6px}
.ph{position:absolute;right:12px;bottom:10px;font-weight:700;font-size:11px;letter-spacing:1.5px;color:${MUTE}}
.play{position:absolute;left:50%;top:50%;width:0;height:0;margin:-14px 0 0 -8px;border-left:24px solid rgba(241,236,226,.35);border-top:14px solid transparent;border-bottom:14px solid transparent}
.ring{position:absolute;right:58px;top:900px;display:none}
.deg{position:absolute;right:80px;top:820px;font-family:Anton;font-size:96px;line-height:1;color:${PAPER};transform:translateY(-38px)}
.deg span{color:${RED}}
.callout{position:absolute;left:0;top:0}
.cl{position:absolute;left:${slot(7)[0] + TW / 2}px;top:${slot(7)[1] - 120}px;width:3px;height:112px;background:${RED}}
.cdot{position:absolute;left:${slot(7)[0] + TW / 2 - 6}px;top:${slot(7)[1] - 132}px;width:15px;height:15px;border-radius:50%;background:${RED}}
.ct{position:absolute;left:${slot(7)[0] + TW / 2 - 230}px;top:${slot(7)[1] - 186}px;font-weight:700;font-size:34px}
.proof{position:absolute;left:90px;top:150px}
.n13{font-family:Anton;font-size:380px;line-height:.9}
.yrs{font-weight:700;font-size:48px;margin-top:16px}
.bl{font-weight:800;font-size:20px;letter-spacing:3px;color:${MUTE};margin-top:60px}
.br{font-weight:700;font-size:50px;margin-top:14px}
.br i{display:inline-block;width:11px;height:11px;border-radius:50%;background:${RED};margin:0 18px;vertical-align:middle}
.end{position:absolute;left:0;right:0;top:330px;text-align:center}
.wmk{font-weight:800;font-size:124px;letter-spacing:-2.5px}
.ul{width:880px;height:4px;background:${RED};border-radius:2px;margin:6px auto 0}
.tag{font-weight:700;font-size:52px;margin-top:70px}
.sub{font-weight:800;font-size:22px;letter-spacing:4px;color:${MUTE};margin-top:26px}
.url{position:absolute;left:0;right:0;top:1645px;text-align:center;font-weight:600;font-size:34px;color:${MUTE}}
.capband{position:absolute;left:0;right:0;top:1585px;height:150px;background:rgba(18,17,16,.6)}
.cap{position:absolute;left:0;right:0;top:1612px;text-align:center;font-weight:800;font-size:50px;line-height:60px}
.wm{position:absolute;left:0;right:0;bottom:0;height:150px;background:rgba(18,17,16,.78);text-align:center;font-weight:600;font-size:26px;line-height:38px;padding-top:42px;opacity:.85}
`;
const out = path.join(here, 'frames');
fs.mkdirSync(out, {recursive: true});
const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'}).catch(() => chromium.launch());
const page = await browser.newPage({viewport: {width: 1080, height: 1920}});
for (const [name, body] of Object.entries(frames)) {
  const file = path.join(out, `${name}.html`);
  fs.writeFileSync(file, `<html><head><style>${css}</style></head><body>${body}</body></html>`);
  await page.goto(`file://${file}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path: path.join(out, `${name}.png`)});
  fs.unlinkSync(file);
}
await browser.close();
console.log('ok');
