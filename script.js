/* ================================================================
   ALEV — ateşli portfolyo
   1) Kıvılcım/alev parçacık sistemi (canvas)
   2) Müzik: music/tss.m4a (KAVAK, BAKAN — TSS) → yoksa Web Audio ile ateş uğultusu
   3) Scroll animasyonları, navigasyon, beceri çubukları
   ================================================================ */

/* ---------------- 1) ATEŞ PARÇACIKLARI ---------------- */
const canvas = document.getElementById('fire-canvas');
const ctx = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
addEventListener('resize', resize);
resize();

const COLORS = ['#ffd447', '#ff9a1f', '#ff5a00', '#ff2d00', '#fff2c4'];
const parts = [];
const MAX = reduced ? 60 : 460;

function spawn(x, y, opts = {}) {
  if (parts.length > MAX) parts.splice(0, 40);
  const burst = opts.burst;
  const a = burst ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
  const sp = burst ? 60 + Math.random() * 320 : 20 + Math.random() * 70;
  parts.push({
    x, y,
    vx: Math.cos(a) * sp + (opts.vx || 0),
    vy: Math.sin(a) * sp + (opts.vy || 0),
    life: 0,
    max: burst ? 0.7 + Math.random() * 1.1 : 2.4 + Math.random() * 3.6,
    r: burst ? 1 + Math.random() * 2.2 : 1.2 + Math.random() * 3.2,
    c: COLORS[(Math.random() * COLORS.length) | 0],
    sway: Math.random() * Math.PI * 2,
    swaySpd: 0.6 + Math.random() * 1.8,
    grav: burst ? 240 : -18
  });
}

/* alt kenardan sürekli alev + rastgele yerlerden kıvılcım fışkırması */
let t = 0, last = performance.now(), spawnAcc = 0;
function emitter(dt) {
  // alt kenar koridoru (kare hızından bağımsız, saniyede N adet)
  spawnAcc += (reduced ? 45 : 160) * dt;
  while (spawnAcc >= 1) { spawnAcc -= 1; spawn(Math.random() * W, H + 6, { vy: -30 }); }
  // "her yerden fışkırma": rastgele klasterler
  if (Math.random() < dt * (reduced ? 0.4 : 1.6)) {
    const cx = Math.random() * W, cy = H * (0.25 + Math.random() * 0.7);
    const n = 6 + (Math.random() * 12) | 0;
    for (let i = 0; i < n; i++) spawn(cx, cy, { burst: true });
  }
}

function draw(dt) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life += dt;
    if (p.life >= p.max) { parts.splice(i, 1); continue; }
    p.sway += p.swaySpd * dt;
    p.vy += p.grav * dt;
    p.vx += Math.sin(p.sway) * 26 * dt;
    p.vx *= 0.985; p.vy *= 0.99;
    p.x += p.vx * dt; p.y += p.vy * dt;

    const k = 1 - p.life / p.max;            // ömrün yüzdesi
    const flick = 0.72 + Math.sin(p.life * 22 + p.sway) * 0.28;
    const r = p.r * (0.5 + k * 0.8) * flick;
    const alpha = Math.min(1, k * 1.5) * flick;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.4, r), 0, 6.283);
    ctx.fill();

    // hızlı kıvılcımlarda iz
    if (Math.abs(p.vx) + Math.abs(p.vy) > 140) {
      ctx.globalAlpha = alpha * 0.35;
      ctx.strokeStyle = p.c;
      ctx.lineWidth = Math.max(0.4, r * 0.7);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; t += dt;
  ctx.clearRect(0, 0, W, H);
  emitter(dt);
  draw(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* fare ve tıklama etkileşimi */
let lastMove = 0;
addEventListener('pointermove', e => {
  const now = performance.now();
  if (now - lastMove < 45) return;
  lastMove = now;
  spawn(e.clientX, e.clientY, { burst: true, vy: -40 });
});
addEventListener('pointerdown', e => {
  if (e.target.closest('button, a')) return;
  const n = 26 + (Math.random() * 16) | 0;
  for (let i = 0; i < n; i++) spawn(e.clientX, e.clientY, { burst: true });
});

/* ---------------- 2) MÜZİK ---------------- */
const audio = document.getElementById('bg-music');
const intro = document.getElementById('intro');
const startBtn = document.getElementById('start-btn');
const player = document.getElementById('player');
const playBtn = document.getElementById('play-btn');
const stateTxt = document.getElementById('player-state');
const navMusic = document.getElementById('nav-music');

let mode = 'file';        // 'file' | 'synth'
let playing = false;
let actx = null, synth = null;

/* --- dosya yoksa: Web Audio ile canlı ateş uğultüsü --- */
function buildSynth() {
  actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  const master = actx.createGain();
  master.gain.value = 0;
  master.connect(actx.destination);

  /* gürültü tamponu (ateş uğultusu) */
  const len = actx.sampleRate * 3;
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const d = buf.getChannelData(0);
  let lastV = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    lastV = (lastV + 0.03 * w) / 1.03;
    d[i] = lastV * 3.2;
  }
  const noise = actx.createBufferSource();
  noise.buffer = buf; noise.loop = true;
  const lp = actx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 760; lp.Q.value = 0.7;
  const nGain = actx.createGain(); nGain.gain.value = 0.75;
  noise.connect(lp).connect(nGain).connect(master);

  /* hafif nabız (dip) */
  const osc = actx.createOscillator();
  osc.type = 'sine'; osc.frequency.value = 54;
  const oGain = actx.createGain(); oGain.gain.value = 0.16;
  const lfo = actx.createOscillator();
  lfo.type = 'sine'; lfo.frequency.value = 1.6;
  const lfoGain = actx.createGain(); lfoGain.gain.value = 0.12;
  lfo.connect(lfoGain).connect(oGain.gain);
  osc.connect(oGain).connect(master);

  /* küt küt vuruşlar */
  const beat = () => {
    if (!synth) return;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, actx.currentTime);
    o.frequency.exponentialRampToValueAtTime(44, actx.currentTime + 0.16);
    g.gain.setValueAtTime(0.5, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.32);
    o.connect(g).connect(master);
    o.start(); o.stop(actx.currentTime + 0.34);
    synth.timer = setTimeout(beat, 620 + Math.random() * 90);
  };

  noise.start(); osc.start(); lfo.start();
  return {
    master,
    start() {
      master.gain.cancelScheduledValues(actx.currentTime);
      master.gain.linearRampToValueAtTime(0.5, actx.currentTime + 1.2);
      clearTimeout(synth.timer);
      synth.timer = setTimeout(beat, 100);
    },
    stop() {
      master.gain.cancelScheduledValues(actx.currentTime);
      master.gain.linearRampToValueAtTime(0, actx.currentTime + 0.5);
      clearTimeout(synth.timer);
    },
    timer: null
  };
}

function setUi() {
  player.classList.toggle('playing', playing);
  player.classList.toggle('show', started);
  const icon = playing ? '🔊' : '🔇';
  playBtn.textContent = icon;
  navMusic.textContent = icon;
  stateTxt.textContent = playing
    ? (mode === 'file' ? 'çalıyor · dosya' : 'çalıyor · ateş uğultusu')
    : 'duraklatıldı';
}

let started = false, everPlayed = false;

async function play() {
  if (mode === 'file') {
    try {
      await audio.play();
      playing = true;
    } catch (err) {
      mode = 'synth';           // dosya yok/engellendi → synth'e düş
      startSynth();
    }
  } else {
    startSynth();
  }
  if (playing) everPlayed = true;
  setUi();
}

function startSynth() {
  if (!synth) synth = buildSynth();
  actx.resume();
  synth.start();
  playing = true;
}

function pause() {
  if (mode === 'file') audio.pause();
  else if (synth) synth.stop();
  playing = false;
  setUi();
}

const toggle = () => (playing ? pause() : play());

audio.addEventListener('error', () => { if (mode === 'file') mode = 'synth'; }, true);
audio.addEventListener('ended', () => { playing = false; setUi(); });

function begin() {
  started = true;
  intro.classList.add('hidden');
  play();                       // ses izni burada başlıyor
  setUi();
}
startBtn.addEventListener('click', begin);
playBtn.addEventListener('click', toggle);
navMusic.addEventListener('click', toggle);

/* ses izni ilk denemede gelmezse sonraki etkileşimde tekrar dene
   (kullanıcı bilerek duraklattıysa karışmayız) */
addEventListener('pointerdown', () => {
  if (started && !everPlayed) play();
});

setUi();

/* ---------------- 3) ARAYÜZ ETKİLEŞİMLERİ ---------------- */
document.getElementById('year').textContent = new Date().getFullYear();

/* reveal — IO + yedek olarak scroll/timer tabanlı kontrol (IO hiç tetiklenmezse
   içerik asla görünmez kalmaz) */
function markIn(el) {
  if (el.classList.contains('in')) return;
  el.classList.add('in');
  if (el.classList.contains('skill')) {
    el.querySelector('i').style.width = el.dataset.level + '%';
  }
}
const io = ('IntersectionObserver' in window)
  ? new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { markIn(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.15 })
  : null;

document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.transitionDelay = (i % 6) * 70 + 'ms';
  if (io) io.observe(el);
});

function checkReveals() {
  document.querySelectorAll('.reveal:not(.in)').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * 0.9 && r.bottom > 0) markIn(el);
  });
}
addEventListener('scroll', checkReveals, { passive: true });
addEventListener('resize', checkReveals);
checkReveals();
setInterval(checkReveals, 700);

/* scroll spy (IO'suz, senkron ölçüm — her tarayıcıda çalışır) */
const links = [...document.querySelectorAll('.nav-links a')];
const secs = links.map(a => document.querySelector(a.getAttribute('href')));
function spy() {
  const y = scrollY + 160;
  let idx = -1;
  secs.forEach((s, i) => { if (s && s.offsetTop <= y) idx = i; });
  links.forEach((a, i) => a.classList.toggle('active', i === idx));
}
addEventListener('scroll', spy, { passive: true });
spy();
