/* 팝콘 시네마 — 화면 동작(그리기·입력·저장). 게임 규칙은 전부 Core(core.js)에 있습니다. */
(function () {
  'use strict';
  var C = window.Core;
  var KEY = 'popcorn-cinema-v1';
  var AWAY_AFTER = 120;      // 이만큼(초) 넘게 멈춰 있었으면 '자리 비움'으로 계산
  var COLORS = { easy: '#0b6e61', normal: '#2a62c9', hard: '#e9a400', extreme: '#d6362b', chaos: '#7b3fc2' };
  var COOKIES = {
    easy: '쿠키 영상 · 알바생이 남은 팝콘을 몰래 집어 먹고 있습니다.',
    normal: '쿠키 영상 · 프라이팬 뚜껑이 아직도 혼자 들썩이고 있습니다.',
    hard: '쿠키 영상 · 옥수수밭 너머로 수상한 그림자가… 속편 제작 확정!',
    extreme: '쿠키 영상 · 감독님이 마지막 한 알을 두고 깊은 고민에 빠졌습니다.',
    chaos: '쿠키 영상 · 생쥐가 맨 앞줄에 앉아 기립 박수를 치고 있습니다.'
  };
  var IDS = ['chip', 'chipName', 'chipTime', 'btnSet', 'screen', 'now', 'sceneName', 'sceneLine', 'film', 'nextName', 'nextLeft', 'nextBar',
    'event', 'evIco', 'evName', 'evDesc', 'evBtn', 'evBar', 'countNum', 'pps', 'tapv', 'popper', 'fx', 'buffs', 'bucket', 'golden', 'floats', 'hint',
    'tabGens', 'tabUps', 'tabLog', 'pipUps', 'qty', 'pin', 'panelGens', 'panelUps', 'panelLog', 'gens', 'ups', 'upsEmpty', 'stats', 'stampCount', 'stamps', 'toasts',
    'dlgDiff', 'diffTitle', 'diffSub', 'diffClose', 'tickets',
    'dlgSet', 'setClose', 'optSound', 'optCalm', 'btnExport', 'btnImport', 'saveBox', 'setMsg', 'btnRestart', 'btnWipe',
    'dlgClear', 'clearSub', 'clearClose', 'clearTime', 'clearBest', 'clearLine', 'csTaps', 'csGold', 'csAch', 'btnKeep', 'btnNext',
    'dlgAsk', 'askTitle', 'askText', 'askNo', 'askYes'];
  var el = {};

  var store = blankStore();
  var s = null;                 // 지금 상영 중인 판
  var lastTick = 0, lastSlow = 0, lastRec = 0, rec = null, tapTimes = [];
  var tab = 'gens', pinEls = null, genEls = [], upEls = [], upSig = null, filmEls = [], statEls = null, stampEls = null;
  var shownScene = -1, shownBuffs = '', goldShown = false, hintMsg = '', hintUntil = 0, hitTimer = 0, askCb = null;
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- 작은 도구 (값이 바뀔 때만 화면을 건드립니다) ---------- */
  function put(node, v) { if (node.__v !== v) { node.__v = v; node.textContent = v; } }
  function cls(node, name, on) { on = !!on; var k = '__c' + name; if (node[k] !== on) { node[k] = on; node.classList.toggle(name, on); } }
  function prop(node, name, v) { var k = '__p' + name; if (node[k] !== v) { node[k] = v; node.style.setProperty(name, v); } }
  function hid(node, on) { on = !!on; if (node.__h !== on) { node.__h = on; node.hidden = on; } }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function replay(node, name) { node.classList.remove(name); void node.offsetWidth; node.classList.add(name); }
  function make(tag, className, text) { var n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; }
  function durText(sec) {
    sec = Math.max(1, Math.ceil(sec));
    if (sec < 60) return sec + '초';
    var m = Math.round(sec / 60);
    if (m < 60) return m + '분';
    return Math.floor(m / 60) + '시간' + (m % 60 ? ' ' + (m % 60) + '분' : '');
  }
  function filmTime(mins) { return mins < 60 ? '약 ' + mins + '분' : '약 ' + (mins / 60) + '시간'; }

  /* ---------- 저장 ---------- */
  function blankStore() { return { v: 1, cur: null, runs: {}, best: {}, ach: {}, opts: { sound: true, calm: false }, qty: 1, seenGold: false }; }
  function applyStore(o) {
    var next = blankStore();
    C.DIFF_ORDER.forEach(function (d) {
      if (o.runs && o.runs[d] && C.revive(o.runs[d])) next.runs[d] = o.runs[d];
      if (o.best && typeof o.best[d] === 'number' && o.best[d] > 0 && isFinite(o.best[d])) next.best[d] = o.best[d];
    });
    if (o.ach && typeof o.ach === 'object') C.ACH.forEach(function (a) { if (o.ach[a.id]) next.ach[a.id] = 1; });
    if (o.opts && typeof o.opts === 'object') { next.opts.sound = o.opts.sound !== false; next.opts.calm = !!o.opts.calm; }
    if (o.qty === 10 || o.qty === 'max') next.qty = o.qty;
    next.seenGold = !!o.seenGold;
    if (typeof o.cur === 'string' && next.runs[o.cur]) next.cur = o.cur;
    store = next;
  }
  function loadStore() {
    try {
      var raw = window.localStorage.getItem(KEY);
      var o = raw ? JSON.parse(raw) : null;
      if (o && typeof o === 'object' && o.v === 1) applyStore(o);
    } catch (e) { /* 저장소를 못 쓰는 환경이면 저장 없이 진행 */ }
  }
  function persist() {
    if (s) { s.seen = Date.now(); store.runs[s.diff] = s; store.cur = s.diff; }
    try { window.localStorage.setItem(KEY, JSON.stringify(store)); return true; } catch (e) { return false; }
  }
  function encodeSave() { return window.btoa(unescape(encodeURIComponent(JSON.stringify(store)))); }
  function decodeSave(txt) {
    try {
      var o = JSON.parse(decodeURIComponent(escape(window.atob(txt.replace(/\s+/g, '')))));
      return o && typeof o === 'object' && o.v === 1 ? o : null;
    } catch (e) { return null; }
  }

  /* ---------- 소리 (파일 없이 그 자리에서 합성) ---------- */
  var actx = null, lastPop = 0;
  function tone(freq, at, len, type, vol, slide) {
    if (!store.opts.sound || document.hidden) return;
    try {
      if (!actx) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return; actx = new A(); }
      if (actx.state === 'suspended') actx.resume();
      var t = actx.currentTime + at, o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + len);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + len + 0.03);
    } catch (e) { /* 소리가 안 나도 게임은 계속 */ }
  }
  function notes(list, gap, len, vol) { list.forEach(function (f, i) { tone(f, i * gap, len, 'triangle', vol); }); }
  var sfx = {
    pop: function () { var n = Date.now(); if (n - lastPop < 45) return; lastPop = n; tone(rnd(520, 860), 0, 0.07, 'triangle', 0.1, 180); },
    buy: function () { notes([660, 990], 0.07, 0.12, 0.09); },
    up: function () { notes([523, 784, 1175], 0.07, 0.14, 0.09); },
    scene: function () { notes([523, 659, 784, 1047], 0.09, 0.22, 0.1); },
    gold: function () { tone(1568, 0, 0.1, 'sine', 0.07); tone(2093, 0.09, 0.2, 'sine', 0.07); },
    win: function () { notes([784, 988, 1319], 0.06, 0.18, 0.1); },
    bad: function () { tone(170, 0, 0.26, 'sawtooth', 0.05, 90); },
    no: function () { tone(220, 0, 0.08, 'square', 0.03); },
    clear: function () { notes([523, 659, 784, 1047, 784, 1047, 1319], 0.12, 0.32, 0.1); }
  };

  /* ---------- 알림 ---------- */
  function toast(msg, big, ms) {
    var t = make('div', 'toast' + (big ? ' big' : ''), msg);
    el.toasts.appendChild(t);
    while (el.toasts.childElementCount > 3) el.toasts.removeChild(el.toasts.firstChild);
    setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
    }, ms || 2800);
  }
  function hint(msg, ms) { hintMsg = msg; hintUntil = Date.now() + (ms || 2600); put(el.hint, msg); }

  /* ---------- 대화상자 ---------- */
  function openDlg(d) {
    if (d.hasAttribute('open')) return;
    if (typeof d.showModal === 'function') { try { d.showModal(); return; } catch (e) { /* 아래 방식으로 */ } }
    d.setAttribute('open', '');
  }
  function closeDlg(d) {
    if (!d.hasAttribute('open')) return;
    if (typeof d.close === 'function') { try { d.close(); return; } catch (e) { /* 아래 방식으로 */ } }
    d.removeAttribute('open');
  }
  function ask(title, text, yesLabel, cb) {
    el.askTitle.textContent = title; el.askText.textContent = text; el.askYes.textContent = yesLabel;
    askCb = cb; openDlg(el.dlgAsk);
  }

  /* ---------- 팝콘 튀는 효과 (캔버스) ---------- */
  var fx = { ctx: null, w: 0, h: 0, dpr: 1, parts: [], last: 0, dirty: false };
  var KERNEL = [[-0.5, 0.3, 0.62], [0.5, 0.3, 0.62], [0, -0.42, 0.68]];
  function sizeFx() {
    if (!fx.ctx) return;
    var r = el.popper.getBoundingClientRect();
    fx.dpr = Math.min(window.devicePixelRatio || 1, 2);
    fx.w = r.width; fx.h = r.height;
    el.fx.width = Math.max(1, Math.round(r.width * fx.dpr));
    el.fx.height = Math.max(1, Math.round(r.height * fx.dpr));
  }
  function burst(x, y, n, gold) {
    if (!fx.ctx || store.opts.calm || reduced) return;
    for (var i = 0; i < n; i++) {
      fx.parts.push({ x: x, y: y, vx: rnd(-150, 150), vy: rnd(-430, -230), r: rnd(5, 8.5), a: rnd(0, 6.28), va: rnd(-7, 7), t: 0, life: rnd(0.55, 0.9), gold: gold });
    }
    if (fx.parts.length > 80) fx.parts.splice(0, fx.parts.length - 80);
  }
  function drawFx(now) {
    var c = fx.ctx;
    if (!c) return;
    var dt = Math.min(0.05, Math.max(0, (now - fx.last) / 1000) || 0);
    fx.last = now;
    if (!fx.parts.length) {
      if (fx.dirty) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, el.fx.width, el.fx.height); fx.dirty = false; }
      return;
    }
    c.setTransform(fx.dpr, 0, 0, fx.dpr, 0, 0);
    c.clearRect(0, 0, fx.w, fx.h);
    fx.dirty = true;
    c.strokeStyle = '#1f2340'; c.lineWidth = 3;
    for (var i = fx.parts.length - 1; i >= 0; i--) {
      var p = fx.parts[i], j;
      p.t += dt;
      if (p.t >= p.life) { fx.parts.splice(i, 1); continue; }
      p.vy += 1150 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
      var k = p.t / p.life;
      c.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      c.save(); c.translate(p.x, p.y); c.rotate(p.a);
      c.fillStyle = p.gold ? '#ffc93c' : '#fff6dc';
      for (j = 0; j < 3; j++) { c.beginPath(); c.arc(KERNEL[j][0] * p.r, KERNEL[j][1] * p.r, KERNEL[j][2] * p.r, 0, 6.2832); c.stroke(); }
      for (j = 0; j < 3; j++) { c.beginPath(); c.arc(KERNEL[j][0] * p.r, KERNEL[j][1] * p.r, KERNEL[j][2] * p.r, 0, 6.2832); c.fill(); }
      c.restore();
    }
    c.globalAlpha = 1;
  }
  function floatText(txt, x, y) {
    if (store.opts.calm || reduced) return;
    var f = make('span', 'float', txt);
    f.style.setProperty('--fx', x.toFixed(0) + 'px');
    f.style.setProperty('--fy', y.toFixed(0) + 'px');
    el.floats.appendChild(f);
    while (el.floats.childElementCount > 14) el.floats.removeChild(el.floats.firstChild);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 820);
  }

  /* ---------- 판 시작·이어하기 ---------- */
  function startRun(id, fresh, countAway) {
    if (s) persist();
    var raw = fresh ? null : store.runs[id];
    s = (raw && C.revive(raw)) || C.newState(id);
    if (countAway && raw) {
      var gone = (Date.now() - s.seen) / 1000;
      if (gone > 60) awayGain(gone);
    }
    lastTick = Date.now();
    buildRun();
    persist();
  }
  function buildRun() {
    var D = C.DIFFS[s.diff], n = D.scenes.length, i;
    el.film.textContent = ''; filmEls = [];
    for (i = 0; i < n; i++) { var li = make('li'); el.film.appendChild(li); filmEls.push(li); }
    shownScene = -1; upSig = null; rec = null; lastRec = 0; tapTimes = []; fx.parts.length = 0; hintMsg = '';
    put(el.chipName, D.name); prop(el.chip, '--d', COLORS[s.diff]);
    renderFast(); renderSlow();
  }
  function awayGain(sec) {
    if (C.basePps(s) <= 0) return;
    var r = C.offline(s, sec);
    if (r.gain >= 1) toast('💤 자리 비운 ' + durText(sec) + ' 동안 +' + C.fmt(r.gain) + '알' + (sec > C.OFFLINE_CAP ? ' (최대 1시간분)' : ''), false, 5200);
  }

  /* ---------- 시간 흐름 ---------- */
  function advance() {
    var now = Date.now(), dt = (now - lastTick) / 1000;
    lastTick = now;
    if (!(dt > 0)) return;
    if (dt > AWAY_AFTER) { awayGain(dt); dt = 0.05; }
    var evs = C.tick(s, dt, Math.random);
    for (var i = 0; i < evs.length; i++) handle(evs[i]);
  }
  function handle(e) {
    if (e.t === 'scene') onScene(e);
    else if (e.t === 'gold') {
      sfx.gold();
      if (!store.seenGold) { store.seenGold = true; toast('✨ 황금 팝콘 등장! 사라지기 전에 눌러 보세요', false, 4200); }
    } else if (e.t === 'chaos') onChaos(e.ev);
    else if (e.t === 'chaosEnd') {
      if (e.type === 'mouse' && e.lost >= 1) { toast('🐭 생쥐가 팝콘 ' + C.fmt(e.lost) + '알을 물어 갔어요…'); sfx.bad(); }
      else if (e.type === 'blackout') toast('🔌 전기가 다시 들어왔어요');
    }
  }
  function onScene(e) {
    var info = C.sceneInfo(s, e.scene - 1);
    replay(el.screen, 'flash');
    if (!e.cleared) {
      toast('🎬 「' + info.name + '」 상영 · 생산 2배!', true);
      sfx.scene();
      return;
    }
    var prev = store.best[s.diff], isBest = !prev || s.clearTime < prev;
    if (isBest) store.best[s.diff] = s.clearTime;
    checkAch(); persist(); sfx.clear();
    toast('🍪 쿠키 영상까지 완주!', true);
    var diff = s.diff;
    setTimeout(function () { if (s && s.diff === diff && s.cleared) openClear(isBest); }, 900);
  }
  function onChaos(a) {
    var good = true;
    if (a.type === 'storm') toast('🌪\uFE0F 팝콘 폭풍! ' + a.dur + '초 동안 생산 4배', true);
    else if (a.type === 'sale') toast('🏷\uFE0F 반값 세일! ' + a.dur + '초 동안 시설이 반값', true);
    else if (a.type === 'dice') { good = a.n >= 1; toast('🎲 주사위 상영! ' + a.dur + '초 동안 생산 ×' + a.n + (good ? '' : ' … 꽝!'), a.n >= 3); }
    else if (a.type === 'blackout') { good = false; toast('🔌 정전! 스크린의 [전기 켜기]를 눌러요'); }
    else { good = false; toast('🐭 생쥐 습격! 스크린의 [쫓아내기]를 눌러요'); }
    (good ? sfx.gold : sfx.bad)();
  }
  function checkAch() {
    C.ACH.forEach(function (a) {
      if (!store.ach[a.id] && a.test(s)) { store.ach[a.id] = 1; toast('🏅 도장 획득 · ' + a.name); }
    });
  }

  /* ---------- 그리기 ---------- */
  function renderFast() {
    put(el.countNum, C.fmt(s.pop));
    prop(el.nextBar, '--p', C.sceneProgress(s).toFixed(4));
  }
  function renderSlow() {
    var now = Date.now();
    if (now - lastRec >= 500) {
      lastRec = now;
      tapTimes = tapTimes.filter(function (t) { return now - t < 5000; });
      rec = C.recommend(s, Math.max(tapTimes.length / 5, 0.2));
    }
    renderScreen(); renderTill(); renderPopper(); renderHint(); renderPin();
    if (tab === 'gens') renderGens();
    renderUps();
    if (tab === 'log') renderLog();
  }
  function renderScreen() {
    var D = C.DIFFS[s.diff], n = D.scenes.length, i;
    put(el.chipTime, C.fmtTime(s.cleared ? s.clearTime : s.time));
    if (shownScene !== s.scene) {
      shownScene = s.scene;
      var cur = C.sceneInfo(s, s.scene - 1), nx = C.sceneInfo(s, s.scene);
      if (!cur) { put(el.now, '상영 준비 중 · ' + D.film); put(el.sceneName, '곧 시작합니다'); put(el.sceneLine, '팝콘부터 넉넉히 튀겨 둘까요?'); }
      else {
        put(el.now, (s.scene >= n ? '상영 완료 · ' : '지금 상영 중 · ') + s.scene + '/' + n + ' · 생산 ×' + C.fmt(Math.pow(C.SCENE_MULT, s.scene)));
        put(el.sceneName, cur.name); put(el.sceneLine, cur.line);
      }
      put(el.nextName, nx ? '다음 장면 · ' + nx.name : '영화는 끝났지만 팝콘은 계속 튀겨져요');
      for (i = 0; i < n; i++) { cls(filmEls[i], 'done', i < s.scene); cls(filmEls[i], 'cur', i === s.scene); }
    }
    var goal = C.sceneGoal(s);
    if (isFinite(goal)) {
      var left = Math.max(0, goal - s.total), p = C.pps(s), eta = p > 0 ? left / p : Infinity;
      put(el.nextLeft, C.fmt(Math.ceil(left)) + '알 남음' + (eta < 5940 ? ' · ' + durText(eta) : ''));
    } else put(el.nextLeft, '누적 ' + C.fmt(s.total) + '알');

    var a = s.chaos.active;
    if (!a) { hid(el.event, true); return; }
    var meta = C.CHAOS[a.type], bad = !meta.good || (a.type === 'dice' && a.n < 1), rest = Math.max(0, a.until - s.time);
    hid(el.event, false); cls(el.event, 'bad', bad);
    put(el.evIco, meta.icon); put(el.evName, meta.name);
    put(el.evDesc, (a.type === 'dice' ? '생산 ×' + a.n : meta.desc) + ' · ' + Math.ceil(rest) + '초');
    hid(el.evBtn, !meta.fix); put(el.evBtn, meta.fix || '');
    prop(el.evBar, '--p', (rest / a.dur).toFixed(3));
  }
  function renderTill() {
    var b = C.prodBuff(s), tb = C.tapBuff(s);
    put(el.pps, C.fmt(C.pps(s), true)); cls(el.pps, 'up', b > 1); cls(el.pps, 'down', b < 1);
    put(el.tapv, C.fmt(C.tapValue(s), true)); cls(el.tapv, 'up', tb > 1);
  }
  function renderPopper() {
    var html = '', i;
    for (i = 0; i < s.buffs.length; i++) {
      var bf = s.buffs[i], rest = Math.max(0, Math.ceil(bf.until - s.time));
      html += '<span class="buff' + (bf.k === 'fever' ? ' tap' : '') + '">' + (bf.k === 'fever' ? '👆 탭 ×' : '🔥 생산 ×') + bf.m + ' · ' + rest + '초</span>';
    }
    if (html !== shownBuffs) { shownBuffs = html; el.buffs.innerHTML = html; }

    var on = !!s.gold.active;
    if (on !== goldShown) {
      goldShown = on;
      if (on) { el.golden.style.setProperty('--x', rnd(0, 1).toFixed(3)); el.golden.style.setProperty('--y', rnd(0, 0.55).toFixed(3)); }
      hid(el.golden, !on);
    }
    var p = C.sceneProgress(s), fill = s.total <= 0 ? '0' : s.cleared || p >= 0.66 ? '3' : p >= 0.33 ? '2' : '1';
    if (el.bucket.getAttribute('data-fill') !== fill) el.bucket.setAttribute('data-fill', fill);
  }
  function renderHint() {
    var txt = '';
    if (hintMsg && Date.now() < hintUntil) txt = hintMsg;
    else if (s.taps < 5 && s.gens[0] === 0) txt = '👆 팝콘 통을 톡톡 눌러 팝콘을 튀겨 보세요';
    else if (s.gens[0] === 0 && s.total < 300) {
      var c0 = C.genCost(s, 0, 1);
      txt = s.pop >= c0 ? '🧒 아래 ‘추천’을 눌러 알바생을 고용해 보세요. 알아서 튀겨 줘요' : '알바생 고용까지 ' + C.fmt(Math.ceil(c0 - s.pop)) + '알 남았어요';
    } else if (s.gold.active) txt = '✨ 황금 팝콘이 떴어요! 사라지기 전에 눌러요';
    else if (s.scene === 0) txt = '팝콘이 쌓이면 영화가 시작돼요. ‘추천’만 따라 사도 충분해요';
    put(el.hint, txt);
  }
  /* 가게 맨 위 '추천' 한 줄: 지금 사면 가장 이득인 항목을 한 번에 살 수 있게 */
  function recItem() {
    if (!rec) return null;
    if (rec.kind === 'gen') {
      var g = C.GENS[rec.gen];
      return { name: g.name, icon: g.icon, cost: C.genCost(s, rec.gen, 1), info: '초당 +' + C.fmt(C.genUnit(s, rec.gen), true), own: String(s.gens[rec.gen]) };
    }
    var u = C.upgradesFor(s.diff).byId[rec.id];
    if (!u || s.ups[u.id]) return null;
    return { name: u.name, icon: u.icon, cost: u.cost, info: u.desc, own: '', up: u };
  }
  function renderPin() {
    var it = tab === 'log' ? null : recItem();
    if (!it) { hid(el.pin, true); return; }
    var x = pinEls, need = it.cost - s.pop, p = C.pps(s);
    var when = need <= 0 ? '지금 살 수 있어요!' : p > 0 && need / p < 3600 ? durText(need / p) + ' 뒤 살 수 있어요' : C.fmt(Math.ceil(need)) + '알 더 모으면 돼요';
    hid(el.pin, false); cls(el.pin, 'can', need <= 0);
    put(x.ico, it.icon); put(x.nm, it.name); put(x.sub, when + ' · ' + it.info);
    put(x.price, C.fmt(it.cost)); put(x.own, it.own); cls(x.own, 'zero', it.own === '0');
    prop(x.bar, '--p', Math.min(1, s.pop / it.cost).toFixed(3));
  }

  var ITEM_HTML = '<span class="item-ico" aria-hidden="true"></span><span class="item-main"><span class="item-name"><span class="item-nm"></span>' +
    '<span class="rec" hidden>추천</span></span><span class="item-sub"></span></span><span class="price"></span>';
  function parts(b) {
    return { b: b, ico: b.querySelector('.item-ico'), nm: b.querySelector('.item-nm'), rec: b.querySelector('.rec'), sub: b.querySelector('.item-sub'),
      price: b.querySelector('.price'), own: b.querySelector('.item-own'), bar: b.querySelector('.item-bar') };
  }
  function buildGens() {
    el.pin.innerHTML = ITEM_HTML + '<span class="item-own"></span><i class="item-bar"></i>';
    pinEls = parts(el.pin); pinEls.rec.hidden = false;
    el.gens.textContent = '';
    genEls = C.GENS.map(function (g, i) {
      var li = make('li'), b = make('button', 'item');
      b.type = 'button'; b.setAttribute('data-gen', i);
      b.innerHTML = ITEM_HTML + '<span class="item-own"></span><i class="item-bar"></i>';
      li.appendChild(b); el.gens.appendChild(li);
      var x = parts(b); x.li = li;
      return x;
    });
  }
  function qtyFor(i) { return store.qty === 'max' ? Math.max(1, C.genMax(s, i)) : store.qty; }
  function renderGens() {
    var lockedShown = false;
    for (var i = 0; i < genEls.length; i++) {
      var x = genEls[i], g = C.GENS[i];
      if (C.genUnlocked(s, i)) {
        var n = qtyFor(i), cost = C.genCost(s, i, n);
        hid(x.li, false); cls(x.b, 'locked', false); cls(x.b, 'can', cost <= s.pop);
        put(x.ico, g.icon); put(x.nm, g.name);
        put(x.sub, '초당 +' + C.fmt(C.genUnit(s, i), true) + ' · ' + g.desc);
        put(x.price, (n > 1 ? n + '개 ' : '') + C.fmt(cost));
        put(x.own, String(s.gens[i])); cls(x.own, 'zero', s.gens[i] === 0);
        prop(x.bar, '--p', Math.min(1, s.pop / cost).toFixed(3));
        hid(x.rec, !(rec && rec.kind === 'gen' && rec.gen === i));
      } else if (!lockedShown) {
        lockedShown = true;
        var need = g.cost * C.UNLOCK_RATIO;
        hid(x.li, false); cls(x.b, 'locked', true); cls(x.b, 'can', false);
        put(x.ico, '🔒'); put(x.nm, '？？？'); put(x.sub, '누적 ' + C.fmt(need) + '알을 튀기면 공개돼요');
        put(x.price, '잠김'); put(x.own, ''); cls(x.own, 'zero', true);
        prop(x.bar, '--p', Math.min(1, s.total / need).toFixed(3));
        hid(x.rec, true);
      } else hid(x.li, true);
    }
  }
  function renderUps() {
    var list = C.visibleUpgrades(s), i;
    var sig = s.diff + '|' + list.map(function (u) { return u.id; }).join(',');
    if (sig !== upSig) {
      upSig = sig; el.ups.textContent = ''; upEls = [];
      list.forEach(function (u) {
        var li = make('li'), b = make('button', 'item up');
        b.type = 'button'; b.setAttribute('data-up', u.id);
        b.innerHTML = ITEM_HTML + '<i class="item-bar"></i>';
        var x = parts(b); x.u = u;
        x.ico.textContent = u.icon; x.nm.textContent = u.name; x.sub.textContent = u.desc; x.price.textContent = C.fmt(u.cost);
        li.appendChild(b); el.ups.appendChild(li); upEls.push(x);
      });
      hid(el.upsEmpty, list.length > 0);
    }
    var afford = 0, recUp = rec && rec.kind === 'up' ? rec.id : null, hot = false;
    for (i = 0; i < upEls.length; i++) {
      var x = upEls[i], can = x.u.cost <= s.pop;
      if (can) afford++;
      if (can && x.u.id === recUp) hot = true;
      cls(x.b, 'can', can);
      prop(x.bar, '--p', Math.min(1, s.pop / x.u.cost).toFixed(3));
      hid(x.rec, x.u.id !== recUp);
    }
    hid(el.pipUps, afford === 0); put(el.pipUps, String(afford)); cls(el.pipUps, 'hot', hot);
  }
  function renderLog() {
    var i;
    if (!statEls) {
      statEls = ['상영 시간', '누적 생산', '누른 횟수', '황금 팝콘', '보유 시설', '최고 기록'].map(function (label) {
        var d = make('div'), dd = make('dd');
        d.appendChild(make('dt', '', label)); d.appendChild(dd); el.stats.appendChild(d);
        return dd;
      });
      stampEls = C.ACH.map(function (a) {
        var li = make('li', 'stamp'), box = make('span');
        li.appendChild(make('span', 'stamp-ico', a.icon));
        box.appendChild(make('span', 'stamp-name', a.name)); box.appendChild(make('span', 'stamp-desc', a.desc));
        li.appendChild(box); el.stamps.appendChild(li);
        return li;
      });
    }
    var owned = 0, got = 0, best = store.best[s.diff];
    for (i = 0; i < s.gens.length; i++) owned += s.gens[i];
    put(statEls[0], C.fmtTime(s.time));
    put(statEls[1], C.fmt(s.total) + '알');
    put(statEls[2], C.fmt(s.taps) + '번');
    put(statEls[3], s.gold.caught + '개');
    put(statEls[4], C.fmt(owned) + '개');
    put(statEls[5], best ? C.fmtTime(best) : '아직 없음');
    for (i = 0; i < C.ACH.length; i++) { var has = !!store.ach[C.ACH[i].id]; if (has) got++; cls(stampEls[i], 'got', has); }
    put(el.stampCount, got + '/' + C.ACH.length);
  }

  /* ---------- 입력 ---------- */
  function doTap(x, y) {
    if (!s) return;
    var v = C.tap(s);
    tapTimes.push(Date.now());
    sfx.pop();
    floatText('+' + C.fmt(v, true), x + rnd(-16, 16), y - 30);
    burst(x, y, 3, C.tapBuff(s) > 1);
    el.bucket.classList.add('hit');
    clearTimeout(hitTimer);
    hitTimer = setTimeout(function () { el.bucket.classList.remove('hit'); }, 90);
    renderFast();
  }
  function nope(b, msg) { replay(b, 'nope'); sfx.no(); hint(msg); }
  function setTab(t) {
    tab = t;
    [['gens', el.tabGens, el.panelGens], ['ups', el.tabUps, el.panelUps], ['log', el.tabLog, el.panelLog]].forEach(function (r) {
      r[1].setAttribute('aria-selected', r[0] === t ? 'true' : 'false');
      hid(r[2], r[0] !== t);
    });
    hid(el.qty, t !== 'gens');
    if (s) renderSlow();
  }
  function qtyLabel() { el.qty.textContent = store.qty === 'max' ? '최대' : '×' + store.qty; }

  function openDiff() {
    var first = !s;
    el.diffTitle.textContent = first ? '어떤 영화를 볼까요?' : '영화 고르기';
    el.diffSub.textContent = first ? '팝콘을 튀겨서 영화를 끝까지 상영하면 클리어! 긴 영화일수록 어려워요.' : '영화마다 따로 저장돼요. 언제든 다시 돌아올 수 있어요.';
    el.diffClose.hidden = first;
    el.tickets.textContent = '';
    C.DIFF_ORDER.forEach(function (id) {
      var D = C.DIFFS[id], run = s && s.diff === id ? s : store.runs[id], best = store.best[id], state;
      if (s && s.diff === id) state = '지금 상영 중';
      else if (run && run.total > 0) state = run.cleared ? '완주 ✓' : '이어 보기 ' + Math.min(run.scene | 0, D.scenes.length) + '/' + D.scenes.length;
      else state = '새로 시작';
      var li = make('li'), b = make('button', 'ticket' + (s && s.diff === id ? ' current' : '')), main = make('span', 'ticket-main'), stub = make('span', 'ticket-stub');
      b.type = 'button'; b.setAttribute('data-diff', id); b.style.setProperty('--d', COLORS[id]);
      main.appendChild(make('span', 'ticket-film', D.film + ' · 장면 ' + D.scenes.length + '개'));
      main.appendChild(make('span', 'ticket-name', D.name));
      main.appendChild(make('span', 'ticket-blurb', D.blurb));
      stub.appendChild(make('span', 'ticket-time', filmTime(D.mins)));
      stub.appendChild(make('span', 'ticket-state', state));
      if (best) stub.appendChild(make('span', 'ticket-state', '최고 ' + C.fmtTime(best)));
      b.appendChild(main); b.appendChild(stub); li.appendChild(b); el.tickets.appendChild(li);
    });
    openDlg(el.dlgDiff);
  }
  function pickDiff(id) {
    if (!C.DIFFS[id]) return;
    if (!s || s.diff !== id) {
      startRun(id, false, false);
      toast('🎬 ' + C.DIFFS[id].film + ' 〈' + C.DIFFS[id].name + '〉 상영을 준비합니다');
    }
    closeDlg(el.dlgDiff);
  }
  function nextDiff() {
    var i = C.DIFF_ORDER.indexOf(s.diff);
    return i >= 0 && i < C.DIFF_ORDER.length - 1 ? C.DIFF_ORDER[i + 1] : null;
  }
  function openClear(isBest) {
    var D = C.DIFFS[s.diff], got = 0, nx = nextDiff();
    C.ACH.forEach(function (a) { if (store.ach[a.id]) got++; });
    el.clearSub.textContent = D.film + ' 〈' + D.name + '〉 완주';
    el.clearTime.textContent = C.fmtTime(s.clearTime);
    el.clearBest.hidden = !isBest;
    el.clearLine.textContent = COOKIES[s.diff];
    el.csTaps.textContent = C.fmt(s.taps) + '번';
    el.csGold.textContent = s.gold.caught + '개';
    el.csAch.textContent = got + '/' + C.ACH.length;
    el.btnNext.textContent = nx ? '다음 영화 · ' + C.DIFFS[nx].name : '다른 영화 고르기';
    openDlg(el.dlgClear);
  }

  function bind() {
    el.bucket.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      var r = el.popper.getBoundingClientRect();
      doTap(e.clientX - r.left, e.clientY - r.top);
    });
    // 키보드·보조 기기로 누른 경우(포인터가 아닌 클릭)
    el.bucket.addEventListener('click', function (e) {
      if (e.detail !== 0) return;
      var r = el.popper.getBoundingClientRect(), k = el.bucket.getBoundingClientRect();
      doTap(k.left - r.left + k.width / 2, k.top - r.top + k.height * 0.3);
    });
    el.bucket.addEventListener('keydown', function (e) { if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault(); });
    el.bucket.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    el.golden.addEventListener('click', function () {
      if (!s || !s.gold.active) return;
      var r = C.catchGold(s, Math.random);
      if (!r) return;
      var pr = el.popper.getBoundingClientRect(), gr = el.golden.getBoundingClientRect();
      burst(gr.left - pr.left + gr.width / 2, gr.top - pr.top + gr.height / 2, 12, true);
      sfx.win();
      if (r.k === 'jackpot') toast('✨ 대박! 팝콘 +' + C.fmt(r.gain) + '알', true);
      else if (r.k === 'frenzy') toast('🔥 팝콘 열풍! ' + r.dur + '초 동안 생산 ' + r.m + '배', true);
      else toast('👆 황금 손! ' + r.dur + '초 동안 누르는 힘 ' + r.m + '배', true);
      renderFast(); renderSlow();
    });
    el.evBtn.addEventListener('click', function () {
      if (!s) return;
      var r = C.fixChaos(s, Math.random);
      if (!r) return;
      if (r.type === 'mouse') toast('🐭 생쥐를 쫓아냈어요!' + (r.reward >= 1 ? ' 떨어뜨리고 간 팝콘 +' + C.fmt(r.reward) + '알' : ''));
      else toast('🔌 전기가 다시 들어왔어요');
      sfx.buy(); renderSlow();
    });

    el.pin.addEventListener('click', function () {
      var it = s ? recItem() : null;
      if (!it) return;
      var done = it.up ? C.buyUpgrade(s, it.up.id) : C.buyGen(s, rec.gen, 1);
      if (!done) { nope(el.pin, it.name + ' — ' + C.fmt(Math.ceil(it.cost - s.pop)) + '알 더 필요해요'); return; }
      if (it.up) { sfx.up(); hint('✅ ' + it.up.name + ' — ' + it.up.desc, 3200); } else sfx.buy();
      replay(el.pin, 'bought'); lastRec = 0;
      renderFast(); renderSlow();
    });
    el.gens.addEventListener('click', function (e) {
      var b = e.target.closest('.item');
      if (!b || !s) return;
      var i = +b.getAttribute('data-gen'), g = C.GENS[i];
      if (!C.genUnlocked(s, i)) { nope(b, '누적 ' + C.fmt(g.cost * C.UNLOCK_RATIO) + '알을 튀기면 새 시설이 열려요'); return; }
      var n = store.qty === 'max' ? C.genMax(s, i) : store.qty;
      if (!n || !C.buyGen(s, i, n)) {
        nope(b, g.name + ' — ' + C.fmt(Math.ceil(C.genCost(s, i, store.qty === 'max' ? 1 : store.qty) - s.pop)) + '알 더 필요해요');
        return;
      }
      replay(b, 'bought'); sfx.buy(); lastRec = 0;
      renderFast(); renderSlow();
    });
    el.ups.addEventListener('click', function (e) {
      var b = e.target.closest('.item');
      if (!b || !s) return;
      var u = C.upgradesFor(s.diff).byId[b.getAttribute('data-up')];
      if (!u) return;
      if (!C.buyUpgrade(s, u.id)) { nope(b, u.name + ' — ' + C.fmt(Math.ceil(u.cost - s.pop)) + '알 더 필요해요'); return; }
      sfx.up(); hint('✅ ' + u.name + ' — ' + u.desc, 3200); lastRec = 0;
      renderFast(); renderSlow();
    });

    el.tabGens.addEventListener('click', function () { setTab('gens'); });
    el.tabUps.addEventListener('click', function () { setTab('ups'); });
    el.tabLog.addEventListener('click', function () { setTab('log'); });
    el.qty.addEventListener('click', function () {
      store.qty = store.qty === 1 ? 10 : store.qty === 10 ? 'max' : 1;
      qtyLabel(); if (s) renderSlow();
    });

    el.chip.addEventListener('click', openDiff);
    el.diffClose.addEventListener('click', function () { closeDlg(el.dlgDiff); });
    el.tickets.addEventListener('click', function (e) {
      var b = e.target.closest('.ticket');
      if (b) pickDiff(b.getAttribute('data-diff'));
    });
    el.dlgDiff.addEventListener('cancel', function (e) { if (!s) e.preventDefault(); });
    el.dlgDiff.addEventListener('close', function () { if (!s) setTimeout(openDiff, 0); });

    el.btnSet.addEventListener('click', function () {
      el.optSound.checked = store.opts.sound; el.optCalm.checked = store.opts.calm;
      el.saveBox.value = ''; el.setMsg.textContent = '';
      openDlg(el.dlgSet);
    });
    el.setClose.addEventListener('click', function () { closeDlg(el.dlgSet); });
    el.optSound.addEventListener('change', function () { store.opts.sound = el.optSound.checked; persist(); sfx.buy(); });
    el.optCalm.addEventListener('change', function () {
      store.opts.calm = el.optCalm.checked;
      document.body.classList.toggle('calm', store.opts.calm);
      persist();
    });
    el.btnExport.addEventListener('click', function () {
      persist();
      var code = encodeSave();
      el.saveBox.value = code;
      el.saveBox.focus(); el.saveBox.select();
      var done = function () { el.setMsg.textContent = '✅ 저장 코드를 복사했어요. 다른 기기의 이 상자에 붙여 넣으면 돼요.'; }, manual = function () {
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        if (ok) done(); else el.setMsg.textContent = '위 상자의 코드를 길게 눌러 직접 복사해 주세요.';
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, manual);
      else manual();
    });
    el.btnImport.addEventListener('click', function () {
      var txt = el.saveBox.value.trim();
      if (!txt) { el.setMsg.textContent = '먼저 위 상자에 저장 코드를 붙여 넣어 주세요.'; el.saveBox.focus(); return; }
      var o = decodeSave(txt);
      if (!o) { el.setMsg.textContent = '저장 코드를 읽을 수 없어요. 처음부터 끝까지 복사했는지 확인해 주세요.'; return; }
      ask('이 코드로 불러올까요?', '지금 이 브라우저에 있는 진행 상황은 코드의 내용으로 바뀌어요.', '불러오기', function () {
        applyStore(o); s = null;
        closeDlg(el.dlgSet);
        boot(false);
        persist();
        toast('불러왔어요');
      });
    });
    el.btnRestart.addEventListener('click', function () {
      if (!s) return;
      ask('이 영화를 처음부터 다시 볼까요?', '이 영화에서 모은 팝콘과 시설이 사라져요. 최고 기록과 도장은 그대로 남아요.', '처음부터', function () {
        var id = s.diff;
        startRun(id, true, false);
        closeDlg(el.dlgSet);
        toast('🎬 ' + C.DIFFS[id].film + ' 〈' + C.DIFFS[id].name + '〉 처음부터 다시 시작해요');
      });
    });
    el.btnWipe.addEventListener('click', function () {
      ask('모든 기록을 지울까요?', '모든 영화의 진행 상황, 최고 기록, 도장이 전부 사라지고 되돌릴 수 없어요.', '전부 지우기', function () {
        var opts = store.opts;
        store = blankStore(); store.opts = opts; s = null;
        try { window.localStorage.removeItem(KEY); } catch (e) { /* 무시 */ }
        closeDlg(el.dlgSet);
        boot(false);
      });
    });

    el.clearClose.addEventListener('click', function () { closeDlg(el.dlgClear); });
    el.btnKeep.addEventListener('click', function () { closeDlg(el.dlgClear); });
    el.btnNext.addEventListener('click', function () {
      var nx = s ? nextDiff() : null;
      closeDlg(el.dlgClear);
      if (nx) pickDiff(nx); else openDiff();
    });

    el.askNo.addEventListener('click', function () { askCb = null; closeDlg(el.dlgAsk); });
    el.askYes.addEventListener('click', function () { var cb = askCb; askCb = null; closeDlg(el.dlgAsk); if (cb) cb(); });
    el.dlgAsk.addEventListener('close', function () { askCb = null; });

    // 대화상자 바깥(어두운 부분)을 누르면 닫기
    [el.dlgDiff, el.dlgSet, el.dlgClear, el.dlgAsk].forEach(function (d) {
      d.addEventListener('click', function (e) {
        if (e.target !== d) return;
        if (d === el.dlgDiff && !s) return;
        closeDlg(d);
      });
    });

    window.addEventListener('resize', sizeFx);
    if (window.ResizeObserver) new window.ResizeObserver(sizeFx).observe(el.popper);
    document.addEventListener('visibilitychange', function () { if (document.hidden && s) persist(); });
    window.addEventListener('pagehide', function () { if (s) persist(); });
  }

  /* ---------- 시작 ---------- */
  function boot(countAway) {
    qtyLabel();
    document.body.classList.toggle('calm', store.opts.calm);
    if (store.cur && store.runs[store.cur]) startRun(store.cur, false, countAway);
    else openDiff();
  }
  function frame(now) {
    window.requestAnimationFrame(frame);
    if (s) {
      advance();
      renderFast();
      var t = Date.now();
      if (t - lastSlow >= 150) { lastSlow = t; renderSlow(); }
    }
    drawFx(now);
  }
  function init() {
    IDS.forEach(function (id) { el[id] = document.getElementById(id); });
    loadStore();
    try { fx.ctx = el.fx.getContext ? el.fx.getContext('2d') : null; } catch (e) { fx.ctx = null; }
    sizeFx();
    buildGens();
    bind();
    setTab('gens');
    boot(true);
    window.requestAnimationFrame(frame);
    var beat = 0;
    setInterval(function () {
      if (!s) return;
      if (document.hidden) advance();      // 탭이 뒤에 있어도 팝콘은 계속 튀겨집니다
      checkAch();
      document.title = (s.gold.active ? '✨ ' : '') + C.fmt(s.pop) + '알 · 팝콘 시네마';
      if (++beat % 10 === 0) persist();
    }, 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
