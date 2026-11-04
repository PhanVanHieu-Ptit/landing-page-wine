const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(pointer: fine)');
const clamp = value => Math.max(0, Math.min(1, value));
const smoothStep = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const story = document.querySelector('.wine-journey');
const scenes = [...document.querySelectorAll('.journey-scene')];
const chapterLinks = [...document.querySelectorAll('[data-chapter]')];
const counter = document.querySelector('.journey-count');
const pageProgress = document.querySelector('.track i');
const drifting = [...document.querySelectorAll('[data-drift]')];
const stage = document.querySelector('.bottle-stage');
const spec = document.querySelector('#wine');
const dock = document.querySelector('#bottle-dock');
const lerp = (a, b, t) => a + (b - a) * t;

// Sums of sines with unrelated frequencies never visibly repeat: handheld sway, candle flame.
const wobble = (t, seed) => Math.sin(t + seed) * .5 + Math.sin(t * 1.83 + seed * 2.3) * .3 + Math.sin(t * 3.71 + seed * 5.1) * .2;
const flicker = (t, seed) => clamp(.8 + wobble(t * 2.2, seed) * .16 + Math.max(0, wobble(t * 9, seed + 3)) * .1);

// Airborne specks drifting in front of each photograph: pollen, cellar dust, warm candle haze.
// Nearer specks (larger z) are bigger, brighter and slide further when the camera or pointer moves.
const moteConfigs = [
 { count: 26, rgb: '232,226,255', size: [1, 3.2], alpha: .5, vx: .004, vy: -.003, region: [0, .08, 1, .95] },
 { count: 64, rgb: '255,214,150', size: [1, 3.6], alpha: .75, vx: -.006, vy: .004, region: [.4, 0, 1, .85] },
 { count: 16, rgb: '255,190,120', size: [1, 2.6], alpha: .4, vx: .002, vy: -.007, region: [.42, .3, 1, .98] }
];
function makeMotes(canvas, config) {
 const context = canvas.getContext('2d');
 const sprite = document.createElement('canvas');
 sprite.width = sprite.height = 32;
 const paint = sprite.getContext('2d');
 const glow = paint.createRadialGradient(16, 16, 0, 16, 16, 16);
 glow.addColorStop(0, `rgba(${config.rgb},1)`);
 glow.addColorStop(.35, `rgba(${config.rgb},.4)`);
 glow.addColorStop(1, `rgba(${config.rgb},0)`);
 paint.fillStyle = glow;
 paint.fillRect(0, 0, 32, 32);
 const [x0, y0, x1, y1] = config.region;
 const specks = Array.from({ length: config.count }, () => ({
  x: x0 + Math.random() * (x1 - x0), y: y0 + Math.random() * (y1 - y0),
  z: .25 + Math.random() * .75, phase: Math.random() * 6.28, speed: .5 + Math.random() * 1.2
 }));
 // Specks are soft, so the canvas runs at half resolution: a quarter of the pixels to clear and upload every frame.
 const quality = .5;
 let width = 0, height = 0;
 return {
  resize() { width = canvas.width = Math.round(canvas.clientWidth * quality); height = canvas.height = Math.round(canvas.clientHeight * quality); },
  draw(dt, t, flow, px, py) {
   context.clearRect(0, 0, width, height);
   for (const s of specks) {
    s.x += (config.vx * s.z + Math.sin(t * s.speed + s.phase) * .01) * dt;
    s.y += config.vy * s.z * dt - flow * s.z;
    if (s.x < x0) s.x = x1; else if (s.x > x1) s.x = x0;
    if (s.y < y0) s.y = y1; else if (s.y > y1) s.y = y0;
    const u = (s.x - x0) / (x1 - x0), v = (s.y - y0) / (y1 - y0);
    const edge = clamp(Math.min(u, 1 - u, v, 1 - v) * 9);
    const twinkle = .55 + .45 * Math.sin(t * s.speed * 1.6 + s.phase);
    const size = (config.size[0] + (config.size[1] - config.size[0]) * s.z) * 3 * quality;
    context.globalAlpha = config.alpha * s.z * twinkle * edge;
    context.drawImage(sprite, s.x * width - px * s.z * 28 * quality - size / 2, s.y * height - py * s.z * 18 * quality - size / 2, size, size);
   }
  }
 };
}
const motes = scenes.map((scene, index) => makeMotes(scene.querySelector('.scene-motes'), moteConfigs[index]));

// The bottle turns on its own axis: scroll spins it, the label wraps round the glass and the back label comes into view.
// Each key is [trip progress, spin in degrees, lean in degrees] from the end of the journey down to the allocation row.
// It starts where the journey leaves off (a full turn, upright) and is never hidden: the page scrolls past it, as in the Vesper preview.
const poseKeys = [[0, 360, 0], [.2, 360, 0], [.3, 360, -1], [.55, 550, 6], [.82, 720, -4], [1, 720, 0]];
function pose(q) {
 for (let i = 1; i < poseKeys.length; i++) {
  const [q0, spin0, lean0] = poseKeys[i - 1], [q1, spin1, lean1] = poseKeys[i];
  if (q <= q1) { const t = smoothStep((q - q0) / (q1 - q0)); return [lerp(spin0, spin1, t), lerp(lean0, lean1, t)]; }
 }
 return [720, 0];
}

// The glass, front label, back label and reflections are separate drawings. Wrapping the labels round a cylinder
// slice by slice is what makes a flat illustration read as a bottle turning.
const bottleCanvas = stage.querySelector('canvas');
const paint = bottleCanvas.getContext('2d');
const layers = ['glass', 'label', 'back', 'shine'];
const art = {};
const sources = {};
let artReady = false;
Promise.all(layers.map(name => new Promise((resolve, reject) => {
 const image = new Image();
 image.onload = () => { sources[name] = image; resolve(); };
 image.onerror = reject;
 image.src = `assets/pinot-bottle-${name}.svg`;
}))).then(() => { artReady = true; measureBottle(); stage.classList.add('drawn'); scheduleFrame(); }, () => {});

const SLICES = 30;
const LABEL_HALF = 58 / 150, BODY_RADIUS = 72 / 150;   // as a share of the bottle's width
let bottleSize = 0, seatSize = 150, lastSpin = NaN, pixels = { w: 0, h: 0 };
function measureBottle() {
 bottleSize = stage.offsetHeight;
 seatSize = parseFloat(getComputedStyle(dock, '::after').height) || 150;
 const ratio = Math.min(devicePixelRatio || 1, 2);
 const w = Math.round(stage.offsetWidth * ratio), h = Math.round(bottleSize * ratio);
 if (!artReady || !w || !h) return;
 pixels = { w, h };
 bottleCanvas.width = w; bottleCanvas.height = h;
 // Rasterise each drawing once at the size it is shown; the shaded copies darken label slices near the edge of the glass.
 for (const name of layers) {
  const layer = art[name] = Object.assign(document.createElement('canvas'), { width: w, height: h });
  layer.getContext('2d').drawImage(sources[name], 0, 0, w, h);
 }
 for (const name of ['label', 'back']) {
  const shade = art[name + 'Shade'] = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const context = shade.getContext('2d');
  context.drawImage(art[name], 0, 0);
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = '#060c08';
  context.fillRect(0, 0, w, h);
 }
 lastSpin = NaN;
}
function wrapLabel(name, degrees) {
 const { w, h } = pixels, cx = w / 2, half = LABEL_HALF * w, radius = BODY_RADIUS * w;
 // Normalised so a label facing the viewer sits at its drawn width, as in the static bottle in the allocation row.
 const widen = half / (radius * Math.sin(half / radius));
 const turn = degrees * Math.PI / 180, width = half * 2 / SLICES;
 for (let i = 0; i < SLICES; i++) {
  const u0 = -half + i * width, u1 = u0 + width;
  const a0 = turn + u0 / radius, a1 = turn + u1 / radius, mid = Math.cos((a0 + a1) / 2);
  if (mid <= .02) continue;   // round the far side of the glass
  const x0 = cx + radius * widen * Math.sin(a0), x1 = cx + radius * widen * Math.sin(a1);
  paint.globalAlpha = 1;
  paint.drawImage(art[name], cx + u0, 0, width, h, x0, 0, x1 - x0 + .6, h);
  paint.globalAlpha = clamp((.62 - mid) * 1.1) * .6;
  if (paint.globalAlpha > .01) paint.drawImage(art[name + 'Shade'], cx + u0, 0, width, h, x0, 0, x1 - x0 + .6, h);
 }
 paint.globalAlpha = 1;
}
function drawBottle(degrees) {
 if (!artReady || !pixels.w) return;
 const wrapped = ((degrees % 360) + 360) % 360;
 if (Math.abs(wrapped - lastSpin) < .05) return;
 lastSpin = wrapped;
 paint.globalCompositeOperation = 'source-over';
 paint.clearRect(0, 0, pixels.w, pixels.h);
 paint.drawImage(art.glass, 0, 0);
 paint.globalCompositeOperation = 'source-atop';   // labels only land where there is glass
 wrapLabel('label', wrapped);
 wrapLabel('back', wrapped + 180);
 paint.globalCompositeOperation = 'source-over';
 paint.drawImage(art.shine, 0, 0);
}

// Scroll speed gives the bottle weight: it is swept along and rocks, then settles back.
let lastScroll = scrollY, swing = 0;
function placeBottle(motion, p, intro, dt, t) {
 document.documentElement.classList.toggle('bottle-live', motion);
 if (!motion || !bottleSize) return false;
 const vw = innerWidth, vh = innerHeight;
 const small = vw <= 900;
 const speed = (scrollY - lastScroll) / Math.max(dt, .001);
 lastScroll = scrollY;
 swing += (clamp(Math.abs(speed) / 2200) * Math.sign(speed) - swing) * (1 - Math.exp(-dt * 7));
 const specTop = spec.getBoundingClientRect().top;
 const dockRect = dock.getBoundingClientRect();
 const dockX = dockRect.left + dockRect.width / 2, dockY = dockRect.bottom - seatSize / 2;
 // Past the journey the bottle carries on from the pose the journey left it in.
 const journeyEnd = story.getBoundingClientRect().top + scrollY + story.offsetHeight - vh;
 const to = dockY + scrollY - vh * .6;
 let spin, lean;
 if (p < 1) {
  // The hero leans 19 degrees, as in the Vesper preview, and stands upright while it turns a full circle through the cellar.
  spin = 360 * smoothStep(p / .62);
  lean = lerp(19, 0, smoothStep(p / .5));
 } else {
  [spin, lean] = pose(clamp((scrollY - journeyEnd) / Math.max(1, to - journeyEnd)));
 }
 // Beside the specification it sits in the middle, between the copy and the figures. On a phone or tablet the copy
 // runs the full width, so there it stands small at the right edge through the journey, then ghosts behind the copy.
 // Wider screens keep it centred, nudged right only as far as needed to clear the journey's copy column.
 const after = smoothStep((vh * 1.7 - specTop) / (vh * 1.2));
 let dx = small ? vw * .31 : Math.max(0, vw * .08 + 410 + 100 - vw / 2);
 let dy = small ? vh * .14 : 0;
 // Over the restaurant the table already holds a bottle: this one steps left to stand where it does.
 const supper = smoothStep((p - .6) / .12) * (1 - after);
 dx = lerp(dx, small ? dx : -vw * .06, supper);
 dx *= 1 - after;
 dy = dy * (1 - after) + (1 - intro) * 40;
 let alpha = intro * (small ? lerp(1, .3, after) : 1), scale = 1, calm = 1, docked = false;
 // Approaching the 750ml slot it straightens, shrinks and settles in; the slot's own bottle takes over.
 const land = 1 - smoothStep((dockY - vh * .6) / (vh * .4));
 if (land > 0) {
  alpha = intro * lerp(small ? .3 : 1, 1, land);
  dx = lerp(dx, dockX - vw / 2, land);
  dy = lerp(dy, dockY - vh / 2, land);
  scale = lerp(1, seatSize / bottleSize, land);
  lean *= 1 - land;
  calm = 1 - land;
  docked = land > .999;
 }
 dock.classList.toggle('docked', docked);
 stage.style.visibility = docked ? 'hidden' : 'visible';
 if (docked) return false;
 // Life that fades out as the bottle lands, so it seats exactly on the slot's own bottle.
 const sway = Math.sin(spin * Math.PI / 180) * 3;
 dx += pointer.sx * 18 * calm;
 dy += (Math.sin(t * 1.1) * 5 - swing * 14) * calm;
 lean += (sway + swing * 6 + Math.sin(t * .8) * 1.2 + pointer.sx * 2) * calm;
 drawBottle(spin);
 stage.style.opacity = alpha;
 stage.style.transform = `translate(-50%,-50%) translate3d(${dx}px,${dy}px,0) rotate(${lean}deg) scale(${scale})`;
 stage.style.setProperty('--shadow-x', `${28 - lean * .6}px`);
 stage.style.setProperty('--calm', calm);
 stage.style.setProperty('--glint', `${(50 + Math.sin(spin * Math.PI / 180) * 42)}%`);
 return true;
}

const INTRO_MS = 2400;
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
let shown = null;   // progress the camera has eased to; trails the scroll position like a heavy lens
let running = false;
let last = 0;
let introStart = Infinity;

function frame(now) {
 running = false;
 const dt = Math.min(.05, (now - last) / 1000) || .016;
 last = now;
 const t = now / 1000;
 const viewport = innerHeight;
 const rect = story.getBoundingClientRect();
 const target = clamp(-rect.top / Math.max(1, story.offsetHeight - viewport));
 const motion = !reduced.matches;
 if (shown === null || !motion) shown = target;
 const previous = shown;
 shown += (target - shown) * (1 - Math.exp(-dt * 6));
 if (Math.abs(target - shown) < .0003) shown = target;
 const p = shown;
 const flow = p - previous;
 const introT = motion ? clamp((now - introStart) / INTRO_MS) : 1;
 const intro = 1 - Math.pow(1 - introT, 3);
 pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 3));
 pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 3));
 const sway = { x: wobble(t * .31, 1.7) * .18, y: wobble(t * .27, 4.1) * .12, r: wobble(t * .22, 8.3) * .12 };

 // Incoming photographs dissolve over the fully opaque previous shot.
 // Keeping the backing shot solid avoids a dark flash halfway through a cut.
 const crossOne = smoothStep((p - .28) / .09);
 const crossTwo = smoothStep((p - .65) / .09);
 const crosses = [1, crossOne, crossTwo];
 const weights = [1 - crossOne, crossOne * (1 - crossTwo), crossTwo];
 const copyWeights = [
  (1 - smoothStep((p - .265) / .045)) * intro,
  smoothStep((p - .325) / .045) * (1 - smoothStep((p - .635) / .045)),
  smoothStep((p - .695) / .045)
 ];
 const flickers = [flicker(t, 1.3), flicker(t, 7.9)];
 scenes.forEach((scene, index) => {
  const opacity = index === 0 ? Math.min(1, intro * 2.2) : crosses[index];
  const covered = index < 2 && crosses[index + 1] >= .999;
  scene.style.setProperty('--scene-opacity', opacity);
  const exiting = index < 2 && p > [.29, .5][index];
  scene.style.setProperty('--copy-opacity', copyWeights[index]);
  scene.style.setProperty('--copy-shift', `${motion ? (exiting ? -22 : 34) * (1 - copyWeights[index]) : 0}px`);
  scene.inert = weights[index] < .5;
  // A shot hidden behind the next one costs nothing to keep: skip painting it entirely.
  scene.style.visibility = opacity < .001 || covered ? 'hidden' : 'visible';
  if (opacity < .001 || covered) return;
  const start = [0, .28, .65][index];
  const end = [.37, .74, 1][index];
  const local = smoothStep((p - start) / (end - start));
  // A slow dolly push, handheld sway and a little parallax from the pointer: the photograph behaves like a lens, not a slide.
  const scale = 1.05 + local * .07 + (index === 0 ? (1 - intro) * .08 : 0);
  // Rack focus: shots arrive soft and sharpen, and the one being left behind softens as the next dissolves in.
  const soft = (index === 0 ? 1 - intro : 1 - crosses[index]) * 5 + (index < 2 ? crosses[index + 1] * 4 : 0);
  scene.style.setProperty('--cam-scale', motion ? scale : 1);
  scene.style.setProperty('--cam-x', `${motion ? (local - .5) * [-1.4, 1, -.9][index] + sway.x + pointer.sx * .7 : 0}%`);
  scene.style.setProperty('--cam-y', `${motion ? sway.y - (local - .5) * .6 + pointer.sy * .4 : 0}%`);
  scene.style.setProperty('--cam-r', `${motion ? sway.r : 0}deg`);
  scene.style.setProperty('--cam-blur', `${motion ? Math.round(soft * 4) / 4 : 0}px`);
  if (motion) {
   scene.style.setProperty('--flick-a', flickers[0]);
   scene.style.setProperty('--flick-b', flickers[1]);
   motes[index].draw(dt, t, flow, pointer.sx, pointer.sy);
  }
 });
 const chapter = p < .325 ? 0 : p < .695 ? 1 : 2;
 chapterLinks.forEach((link,index) => {
  link.classList.toggle('active', index === chapter);
  if (index === chapter) link.setAttribute('aria-current','step'); else link.removeAttribute('aria-current');
 });
 counter.textContent = `0${chapter + 1} / 03`;
 story.style.setProperty('--journey-progress', `${p * 100}%`);
 document.body.classList.toggle('in-journey', rect.bottom > viewport * .2);
 pageProgress.style.height = `${scrollY / Math.max(1, document.documentElement.scrollHeight - viewport) * 100}%`;
 drifting.forEach(element => {
  const drift = parseFloat(element.style.getPropertyValue('--drift')) || 0;
  const box = element.getBoundingClientRect();
  const amount = clamp((viewport - box.top + drift) / (viewport + box.height));
  element.style.setProperty('--drift', `${motion ? (amount - .5) * Number(element.dataset.drift) : 0}px`);
 });
 const bottleActive = placeBottle(motion, p, intro, dt, t);
 const onScreen = rect.bottom > 0 && rect.top < viewport;
 if (!document.hidden && (shown !== target || introT < 1 || bottleActive || (motion && onScreen))) scheduleFrame();
}
function scheduleFrame() { if (!running) { running = true; requestAnimationFrame(frame); } }
addEventListener('scroll', scheduleFrame, { passive: true });
addEventListener('resize', () => { motes.forEach(m => m.resize()); measureBottle(); scheduleFrame(); });
addEventListener('load', () => { measureBottle(); scheduleFrame(); });
addEventListener('pointermove', e => {
 if (!finePointer.matches) return;
 pointer.x = e.clientX / innerWidth - .5;
 pointer.y = e.clientY / innerHeight - .5;
}, { passive: true });
document.addEventListener('visibilitychange', scheduleFrame);
reduced.addEventListener('change', () => { measureBottle(); scheduleFrame(); });
document.fonts.ready.then(() => { measureBottle(); scheduleFrame(); });
document.documentElement.classList.add('story-ready');
motes.forEach(m => m.resize());
measureBottle();
// The opening shot pulls into focus once its photograph is ready, so the first frame is never a half-loaded image.
const hero = scenes[0].querySelector('.scene-photo');
const begin = () => { introStart = performance.now() + 250; scheduleFrame(); };
(hero.decode ? hero.decode() : Promise.resolve()).then(begin, begin);
setTimeout(() => { if (introStart === Infinity) begin(); }, 2500);
scheduleFrame();
const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('.menu');
function closeMenu() { menu.classList.remove('open'); document.body.classList.remove('menu-open'); menu.inert = true; menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Open navigation'); }
menuButton.addEventListener('click', () => { const open = !menu.classList.contains('open'); menu.classList.toggle('open', open); document.body.classList.toggle('menu-open', open); menu.inert = !open; menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); });
menu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
const dialog = document.querySelector('#reservation');
const form = dialog.querySelector('form');
function openReservation(format = 'Six-bottle case') {
 closeMenu(); form.hidden = false; form.reset(); dialog.querySelector('.success').hidden = true; dialog.dataset.format = format; dialog.querySelector('.eyebrow').textContent = `THE MMXXI ALLOCATION · ${format.toUpperCase()}`; dialog.showModal(); document.body.classList.add('modal-open');
}
document.querySelectorAll('[data-reserve]').forEach(button => button.addEventListener('click', () => { openReservation(); }));
dialog.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
form.addEventListener('submit', e => { e.preventDefault(); if (!form.reportValidity()) return; form.hidden = true; dialog.querySelector('.success').hidden = false; });

document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => openReservation(button.dataset.format)));
const details = {
 abv: ['13.5% ABV', 'Bright cherry and raspberry, silky tannins and gentle warmth. Serve at fourteen to sixteen degrees in a wide-bowled glass.'],
 oak: ['12 MONTHS', 'Twelve months in mostly seasoned French oak lend subtle spice while preserving the fresh red fruit.'],
 ph: ['3.48 PH', 'Total acidity 6.1 g/L. Fresh acidity keeps the finish lively. Give the wine twenty minutes in the glass before serving.'],
 winemaker: ['ÉLISE MARCHAND', 'Our 2021 Pinot Noir is fermented with native yeast and a portion of whole bunches, then rested for twelve months in French oak. Unfined, unfiltered, bottled by gravity.'],
 pairing: ['AT THE TABLE', 'Roast duck, mushroom risotto or grilled salmon. Serve this Pinot Noir at fourteen to sixteen degrees and allow twenty minutes for the aromas to open.'],
 trade: ['TRADE ENQUIRIES', 'This is an independent design recreation. Trade enquiries are not sent to Nocturne or Scrolltide.'],
 stockists: ['STOCKISTS', 'This is a demonstration site. No real stockist directory is connected.'],
 press: ['PRESS', 'Independent recreation of the Vesper design preview from Scrolltide.']
};
const detailDialog = document.querySelector('#details');
document.querySelectorAll('[data-detail]').forEach(button => button.addEventListener('click', () => {
 const [title, copy] = details[button.dataset.detail];
 detailDialog.querySelector('h2').textContent = title;
 const content = detailDialog.querySelector('.detail-content');
 content.replaceChildren();
 if (button.dataset.detail === 'pairing' || button.dataset.detail === 'winemaker') {
  const image = document.createElement('img'); image.src = button.dataset.detail === 'pairing' ? 'assets/pairing.png' : 'assets/winemaker.png'; image.alt = title; content.append(image);
 }
 const p = document.createElement('p'); p.textContent = copy; content.append(p);
 detailDialog.showModal(); document.body.classList.add('modal-open');
}));
detailDialog.querySelector('.close').addEventListener('click', () => detailDialog.close());
detailDialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
detailDialog.addEventListener('click', e => { if (e.target === detailDialog) { const r = detailDialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) detailDialog.close(); } });
document.querySelector('#newsletter').addEventListener('submit', e => {
 e.preventDefault();
 if (!e.currentTarget.reportValidity()) return;
 document.querySelector('.newsletter-status').textContent = 'Thank you. Demo signup complete — no email has been sent.';
 e.currentTarget.reset();
});

