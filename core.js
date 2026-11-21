/* 팝콘 시네마 — 게임 규칙(화면과 무관한 순수 로직). 브라우저와 밸런스 시뮬레이터가 같은 코드를 씁니다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCENE_MULT = 2;            // 장면 하나 상영할 때마다 전체 생산 배수
  var TIER_AT = [10, 25, 50, 75, 100, 125];
  var TIER_NAMES = ['버터 코팅', '카라멜 코팅', '치즈 코팅', '초코 코팅', '트러플 코팅', '황금 코팅'];
  var GOLD_LIFE = 12;            // 황금 팝콘이 떠 있는 시간(초)
  var OFFLINE_RATE = 0.25;       // 자리 비운 동안 생산 효율
  var OFFLINE_CAP = 3600;        // 자리 비움 인정 최대 시간(초)
  var UNLOCK_RATIO = 0.4;        // 누적 생산이 가격의 40%가 되면 시설 공개

  var GENS = [
    { id: 'kid',     icon: '🧒', name: '알바생',         desc: '한 알씩 정성껏 튀겨요',           cost: 15,      pps: 0.1 },
    { id: 'pan',     icon: '🍳', name: '프라이팬',       desc: '뚜껑을 꼭 닫고 흔들흔들',         cost: 100,     pps: 1 },
    { id: 'machine', icon: '🍿', name: '팝콘 기계',      desc: '유리창 안에서 펑펑',               cost: 1100,    pps: 8 },
    { id: 'cart',    icon: '🛒', name: '스낵 카트',      desc: '골목마다 고소한 냄새',             cost: 12000,   pps: 47 },
    { id: 'stand',   icon: '🏪', name: '매점',           desc: '콜라도 같이 드릴까요?',            cost: 130000,  pps: 260 },
    { id: 'theater', icon: '🎦', name: '동네 극장',      desc: '좌석 40개, 스크린 하나',           cost: 1.4e6,   pps: 1400 },
    { id: 'plex',    icon: '🏢', name: '멀티플렉스',     desc: '상영관이 열두 개',                 cost: 2e7,     pps: 7800 },
    { id: 'farm',    icon: '🌽', name: '옥수수 농장',    desc: '지평선까지 옥수수밭',              cost: 3.3e8,   pps: 44000 },
    { id: 'factory', icon: '🏭', name: '팝콘 공장',      desc: '컨베이어 벨트가 밤새 돌아요',      cost: 6.6e9,   pps: 4.4e5 },
    { id: 'studio',  icon: '🎬', name: '영화 스튜디오',  desc: '팝콘 먹는 영화를 직접 찍어요',     cost: 1.6e11,  pps: 5.3e6 },
    { id: 'park',    icon: '🎡', name: '팝콘 테마파크',  desc: '팝콘 분수와 버터 롤러코스터',      cost: 4.5e12,  pps: 7.4e7 },
    { id: 'orbit',   icon: '🛰\uFE0F', name: '우주 상영관',    desc: '무중력에서 둥둥 떠다니는 팝콘',    cost: 1.4e14,  pps: 1.2e9 },
    { id: 'galaxy',  icon: '🌌', name: '은하 배급사',    desc: '안드로메다 동시 개봉',             cost: 5e15,    pps: 2.1e10 },
    { id: 'time',    icon: '⏳', name: '시간여행 극장',  desc: '어제의 나에게도 팝콘을 팝니다',    cost: 2e17,    pps: 4.2e11 },
    { id: 'multi',   icon: '🌀', name: '평행우주 상영관', desc: '옆 우주에서도 전석 매진',          cost: 1e20,    pps: 6e13 },
    { id: 'bang',    icon: '💥', name: '빅뱅 팝콘',      desc: '태초의 옥수수 한 알이 펑!',        cost: 2e22,    pps: 6e15 }
  ];

  var SCENES = [
    ['예고편', '불이 꺼지고, 광고가 끝났어요'],
    ['오프닝', '웅장한 음악과 함께 제목이 떠오릅니다'],
    ['주인공 등장', '평범해 보이지만 어딘가 특별한 주인공'],
    ['평화로운 일상', '이 평화가 오래갈 리 없죠'],
    ['수상한 사건', '어라, 방금 뭔가 지나갔는데?'],
    ['모험의 시작', '짐을 싸고 문을 나섭니다'],
    ['든든한 동료', '혼자가 아니라서 다행이에요'],
    ['첫 번째 위기', '팝콘 집던 손이 멈췄습니다'],
    ['숨겨진 비밀', '그 편지에는 놀라운 사실이…'],
    ['추격전', '달려! 더 빨리!'],
    ['배신', '설마 네가 그럴 줄은…'],
    ['절망의 밤', '객석 여기저기서 훌쩍이는 소리'],
    ['다시 일어서기', '아직 끝난 게 아니야'],
    ['대반전', '객석이 술렁입니다. 헉!'],
    ['최후의 결전', '모두가 숨을 죽였습니다'],
    ['감동의 결말', '박수가 터져 나옵니다'],
    ['엔딩 크레딧', '잠깐, 아직 일어나지 마세요'],
    ['쿠키 영상', '끝까지 기다린 보람이 있네요!']
  ];

  /* 난이도 = 영화 길이. sceneGoals(장면별 누적 생산 목표)는 sim.js가 목표 시간에 맞춰 책정한 값입니다. */
  var DIFFS = {
    easy: {
      id: 'easy', name: '이지', film: '단편 영화', mins: 30, blurb: '처음이라면 여기서. 쑥쑥 크는 재미만 골라 담았어요.',
      prod: 3, growth: 1.13, goldMin: 35, goldMax: 55, chaos: false,
      scenes: [0, 1, 4, 14, 16, 17],
      sceneGoals: [5300, 2300000, 190000000, 4200000000, 52000000000, 890000000000]
    },
    normal: {
      id: 'normal', name: '노말', film: 'TV 영화', mins: 60, blurb: '딱 한 시간. 가장 표준적인 팝콘 장사.',
      prod: 2, growth: 1.14, goldMin: 45, goldMax: 75, chaos: false,
      scenes: [0, 1, 2, 4, 9, 14, 15, 16, 17],
      sceneGoals: [2200, 590000, 54000000, 1200000000, 15000000000, 260000000000, 3900000000000, 87000000000000, 3000000000000000]
    },
    hard: {
      id: 'hard', name: '하드', film: '장편 영화', mins: 120, blurb: '가격이 빨리 오릅니다. 무엇을 먼저 살지 고민이 필요해요.',
      prod: 1.5, growth: 1.15, goldMin: 60, goldMax: 90, chaos: false,
      scenes: [0, 1, 2, 4, 5, 7, 9, 13, 14, 15, 16, 17],
      sceneGoals: [1500, 510000, 41000000, 1000000000, 13000000000, 180000000000, 3100000000000, 73000000000000, 1900000000000000, 55000000000000000, 1500000000000000000, 53000000000000000000]
    },
    extreme: {
      id: 'extreme', name: '익스트림', film: '감독판', mins: 180, blurb: '황금 팝콘은 드물고 갈 길은 멉니다. 느긋한 장기전.',
      prod: 1.2, growth: 1.155, goldMin: 75, goldMax: 105, chaos: false,
      scenes: [0, 1, 2, 4, 5, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17],
      sceneGoals: [1000, 290000, 23000000, 600000000, 8600000000, 93000000000, 1300000000000, 24000000000000, 560000000000000, 19000000000000000, 500000000000000000, 18000000000000000000, 230000000000000000000, 1.9e+21, 1.2e+23]
    },
    chaos: {
      id: 'chaos', name: '카오스', film: '무삭제 확장판', mins: 240, blurb: '폭풍, 정전, 생쥐 습격… 무슨 일이 벌어질지 아무도 몰라요.',
      prod: 1, growth: 1.16, goldMin: 75, goldMax: 105, chaos: true,
      scenes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
      sceneGoals: [770, 180000, 17000000, 450000000, 6500000000, 89000000000, 1200000000000, 19000000000000, 380000000000000, 11000000000000000, 470000000000000000, 17000000000000000000, 190000000000000000000, 820000000000000000000, 5e+22, 1.1e+25, 6.3e+25, 3.3000000000000006e+26]
    }
  };
  var DIFF_ORDER = ['easy', 'normal', 'hard', 'extreme', 'chaos'];

  var CHAOS = {
    storm:    { icon: '🌪\uFE0F', name: '팝콘 폭풍',   desc: '생산 ×4',                          dur: 20, good: true },
    sale:     { icon: '🏷\uFE0F', name: '반값 세일',   desc: '시설 가격이 절반',                  dur: 20, good: true },
    dice:     { icon: '🎲', name: '주사위 상영', desc: '생산 ×',                            dur: 20, good: true },
    blackout: { icon: '🔌', name: '정전',        desc: '생산이 5분의 1로 뚝',               dur: 30, good: false, fix: '전기 켜기' },
    mouse:    { icon: '🐭', name: '생쥐 습격',   desc: '쫓아내지 않으면 팝콘 15% 도난',     dur: 12, good: false, fix: '쫓아내기' }
  };
  var CHAOS_KEYS = ['storm', 'sale', 'dice', 'blackout', 'mouse'];
  var DICE = [[0.2, 0.5], [0.55, 2], [0.85, 3], [1, 6]];

  /* ---------- 숫자 표기 (만·억·조…) ---------- */
  var UNITS = ['', '만', '억', '조', '경', '해', '자', '양', '구', '간', '정'];
  function comma(n) {
    var s = String(Math.floor(n));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function fmt(n, small) {
    if (n !== n) return '0';
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n, small);
    if (n < 10000) {
      if (small && n < 100 && Math.abs(n - Math.round(n)) > 1e-9) return (Math.floor(n * 10 + 1e-9) / 10).toFixed(1);
      return comma(n + 1e-9);
    }
    var k = Math.min(Math.floor(Math.log10(n) / 4 + 1e-12), UNITS.length - 1);
    var v = n / Math.pow(10, 4 * k);
    var str;
    if (v < 10) str = (Math.floor(v * 100 + 1e-6) / 100).toFixed(2);
    else if (v < 100) str = (Math.floor(v * 10 + 1e-6) / 10).toFixed(1);
    else str = comma(v + 1e-6);
    return str + UNITS[k];
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var mm = (m < 10 ? '0' : '') + m, ss = (s < 10 ? '0' : '') + s;
    return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
  }
  function round2(x) { // 유효숫자 2자리로 다듬기
    if (x <= 0) return 0;
    var p = Math.pow(10, Math.floor(Math.log10(x)) - 1);
    return Math.round(x / p) * p;
  }

  /* ---------- 업그레이드 목록 ---------- */
  var TAP_UPS = [
    { cost: 100,   name: '버터 바른 손',     mult: 2,  desc: '탭 한 번에 튀기는 양 ×2' },
    { cost: 1500,  name: '재빠른 손목',      mult: 2,  desc: '탭 한 번에 튀기는 양 ×2' },
    { cost: 5e4,   name: '리듬 타는 손가락', pct: 0.01, desc: '탭마다 초당 생산의 1%를 추가로' },
    { cost: 5e6,   name: '양손 튀기기',      pct: 0.01, desc: '탭 보너스 +1% (합계 2%)' },
    { cost: 5e8,   name: '달인의 스냅',      pct: 0.01, desc: '탭 보너스 +1% (합계 3%)' },
    { cost: 5e10,  name: '전설의 엄지',      pct: 0.02, desc: '탭 보너스 +2% (합계 5%)' },
    { cost: 5e12,  name: '번개 손',          pct: 0.02, desc: '탭 보너스 +2% (합계 7%)' },
    { cost: 5e14,  name: '팝콘의 신',        pct: 0.03, desc: '탭 보너스 +3% (합계 10%)' }
  ];
  var upgradeCache = {};
  function upgradesFor(diffId) {
    if (upgradeCache[diffId]) return upgradeCache[diffId];
    var D = DIFFS[diffId], list = [];
    GENS.forEach(function (g, i) {
      TIER_AT.forEach(function (th, k) {
        list.push({
          id: 'g' + i + '_' + k, kind: 'gen', gen: i, tier: k, need: th, icon: g.icon,
          name: g.name + ' · ' + TIER_NAMES[k],
          desc: g.name + ' 생산 ×2',
          cost: round2(0.6 * th * g.cost * Math.pow(D.growth, th))
        });
      });
    });
    TAP_UPS.forEach(function (u, k) {
      list.push({ id: 'tap' + k, kind: 'tap', icon: '👆', name: u.name, desc: u.desc, cost: u.cost, mult: u.mult || 1, pct: u.pct || 0 });
    });
    list.push({ id: 'radar', kind: 'gold', icon: '📡', name: '황금 레이더', desc: '황금 팝콘이 25% 더 자주 등장', cost: 3e5 });
    list.push({ id: 'butter', kind: 'gold', icon: '🧈', name: '황금 버터', desc: '황금 팝콘 효과 2배', cost: 2e9 });
    list.sort(function (a, b) { return a.cost - b.cost; });
    var byId = {};
    list.forEach(function (u) { byId[u.id] = u; });
    list.byId = byId;
    upgradeCache[diffId] = list;
    return list;
  }

  /* ---------- 상태 ---------- */
  function newState(diffId) {
    var s = {
      v: 1, diff: diffId,
      pop: 0, total: 0, taps: 0, tapPop: 0,
      gens: GENS.map(function () { return 0; }),
      ups: {}, scene: 0, time: 0,
      gold: { next: Infinity, active: null, caught: 0, missed: 0 },
      chaos: { next: Infinity, active: null, last: '', seen: 0 },
      buffs: [],
      cleared: false, clearTime: 0,
      seen: Date.now()
    };
    recalc(s);
    return s;
  }
  function recalc(s) {
    var list = upgradesFor(s.diff), d = { gm: GENS.map(function () { return 1; }), tapMult: 1, tapPct: 0, goldFreq: 1, goldPow: 1 };
    for (var id in s.ups) {
      var u = list.byId[id];
      if (!u) continue;
      if (u.kind === 'gen') d.gm[u.gen] *= 2;
      else if (u.kind === 'tap') { d.tapMult *= u.mult; d.tapPct += u.pct; }
      else if (id === 'radar') d.goldFreq = 0.75;
      else if (id === 'butter') d.goldPow = 2;
    }
    Object.defineProperty(s, '_d', { value: d, enumerable: false, writable: true, configurable: true });
    return s;
  }
  function revive(raw) {
    if (!raw || typeof raw !== 'object' || !DIFFS[raw.diff]) return null;
    var s = newState(raw.diff);
    ['pop', 'total', 'taps', 'tapPop', 'scene', 'time', 'clearTime', 'seen'].forEach(function (k) {
      if (typeof raw[k] === 'number' && isFinite(raw[k]) && raw[k] >= 0) s[k] = raw[k];
    });
    if (Array.isArray(raw.gens)) raw.gens.forEach(function (n, i) { if (i < GENS.length && n > 0 && isFinite(n)) s.gens[i] = Math.floor(n); });
    if (raw.ups && typeof raw.ups === 'object') for (var id in raw.ups) if (upgradesFor(s.diff).byId[id]) s.ups[id] = 1;
    s.scene = Math.min(Math.floor(s.scene), DIFFS[s.diff].scenes.length);
    s.cleared = !!raw.cleared || s.scene >= DIFFS[s.diff].scenes.length;
    if (s.cleared && !s.clearTime) s.clearTime = s.time;
    if (raw.gold) { s.gold.caught = raw.gold.caught | 0; s.gold.missed = raw.gold.missed | 0; }
    if (raw.chaos) s.chaos.seen = raw.chaos.seen | 0;
    // 진행 중이던 이벤트·버프는 이어받지 않고 타이머만 새로 겁니다
    if (s.scene >= 1) { s.gold.next = s.time + 20; if (DIFFS[s.diff].chaos) s.chaos.next = s.time + 60; }
    recalc(s);
    return s;
  }

  /* ---------- 계산 ---------- */
  function diffOf(s) { return DIFFS[s.diff]; }
  function sceneMult(s) { return Math.pow(SCENE_MULT, s.scene); }
  function prodBuff(s) {
    var m = 1, i;
    for (i = 0; i < s.buffs.length; i++) if (s.buffs[i].k === 'frenzy') m *= s.buffs[i].m;
    var a = s.chaos.active;
    if (a) { if (a.type === 'storm') m *= 4; else if (a.type === 'dice') m *= a.n; else if (a.type === 'blackout') m *= 0.2; }
    return m;
  }
  function tapBuff(s) {
    var m = 1;
    for (var i = 0; i < s.buffs.length; i++) if (s.buffs[i].k === 'fever') m *= s.buffs[i].m;
    return m;
  }
  function genUnit(s, i) { return GENS[i].pps * s._d.gm[i] * diffOf(s).prod * sceneMult(s); }
  function basePps(s) {
    var sum = 0;
    for (var i = 0; i < GENS.length; i++) if (s.gens[i]) sum += s.gens[i] * GENS[i].pps * s._d.gm[i];
    return sum * diffOf(s).prod * sceneMult(s);
  }
  function pps(s) { return basePps(s) * prodBuff(s); }
  function tapValue(s) {
    return (s._d.tapMult * diffOf(s).prod * sceneMult(s) + s._d.tapPct * basePps(s)) * tapBuff(s);
  }
  function costMult(s) { return s.chaos.active && s.chaos.active.type === 'sale' ? 0.5 : 1; }
  function genCost(s, i, n) {
    var g = diffOf(s).growth;
    n = n || 1;
    return Math.ceil(GENS[i].cost * Math.pow(g, s.gens[i]) * (Math.pow(g, n) - 1) / (g - 1) * costMult(s));
  }
  function genMax(s, i) {
    var g = diffOf(s).growth, first = GENS[i].cost * Math.pow(g, s.gens[i]) * costMult(s);
    var n = Math.floor(Math.log(1 + s.pop * (g - 1) / first) / Math.log(g) + 1e-9);
    while (n > 0 && genCost(s, i, n) > s.pop) n--;
    return Math.max(0, n);
  }
  function genUnlocked(s, i) { return i === 0 || s.gens[i] > 0 || s.total >= GENS[i].cost * UNLOCK_RATIO; }
  function sceneGoal(s) {
    var D = diffOf(s);
    return s.scene < D.scenes.length ? D.sceneGoals[s.scene] : Infinity;
  }
  function scenePrev(s) { return s.scene > 0 ? diffOf(s).sceneGoals[s.scene - 1] : 0; }
  function sceneProgress(s) {
    var goal = sceneGoal(s), prev = scenePrev(s);
    if (!isFinite(goal)) return 1;
    return Math.max(0, Math.min(1, (s.total - prev) / (goal - prev)));
  }
  function sceneInfo(s, idx) {
    var D = diffOf(s);
    if (idx < 0 || idx >= D.scenes.length) return null;
    var sc = SCENES[D.scenes[idx]];
    return { name: sc[0], line: sc[1] };
  }
  function upgradeVisible(s, u) {
    if (s.ups[u.id]) return false;
    if (u.kind === 'gen') return s.gens[u.gen] >= u.need;
    if (u.kind === 'gold') return s.scene >= 1 && s.total >= u.cost * 0.2;
    return s.total >= u.cost * 0.25;
  }
  function visibleUpgrades(s) {
    return upgradesFor(s.diff).filter(function (u) { return upgradeVisible(s, u); });
  }

  /* 추천 구매: (본전 뽑는 시간 + 모으는 데 걸리는 시간)이 가장 짧은 항목.
     너무 먼 목표(HORIZON초 넘게 모아야 하는 것)는 제외해 "기다리기만 하는" 상황을 막습니다. */
  var HORIZON = 90;
  function recommend(s, cps) {
    cps = cps === undefined ? 1 : cps;
    var p = Math.max(basePps(s), 1e-9);
    var tv = tapValue(s) / tapBuff(s);
    var eff = p + cps * tv, best = null, i;
    function consider(cost, gain, item) {
      if (!(gain > 0) || !isFinite(cost)) return;
      var wait = Math.max(0, cost - s.pop) / eff;
      if (wait > HORIZON && best) return;
      var score = cost / gain + wait;
      if (!best || score < best.score || (best.wait > HORIZON && wait <= HORIZON)) { item.score = score; item.cost = cost; item.wait = wait; best = item; }
    }
    for (i = 0; i < GENS.length; i++) {
      if (!genUnlocked(s, i)) continue;
      consider(genCost(s, i, 1), genUnit(s, i) * (1 + s._d.tapPct * cps), { kind: 'gen', gen: i });
    }
    var list = upgradesFor(s.diff);
    for (i = 0; i < list.length; i++) {
      var u = list[i], gain;
      if (!upgradeVisible(s, u)) continue;
      if (u.kind === 'gen') gain = s.gens[u.gen] * genUnit(s, u.gen);
      else if (u.kind === 'tap') gain = Math.max(cps, 0.5) * (u.pct ? u.pct * p : tv * 0.5);
      else gain = p * 0.08;
      consider(u.cost, gain, { kind: 'up', id: u.id });
    }
    return best;
  }

  /* ---------- 행동 ---------- */
  function tap(s) {
    var v = tapValue(s);
    s.pop += v; s.total += v; s.tapPop += v; s.taps++;
    return v;
  }
  function buyGen(s, i, n) {
    if (!genUnlocked(s, i)) return 0;
    if (n === 'max') n = genMax(s, i);
    if (!n || n < 1) return 0;
    var c = genCost(s, i, n);
    if (c > s.pop) return 0;
    s.pop -= c; s.gens[i] += n;
    return n;
  }
  function buyUpgrade(s, id) {
    var u = upgradesFor(s.diff).byId[id];
    if (!u || !upgradeVisible(s, u) || u.cost > s.pop) return false;
    s.pop -= u.cost; s.ups[id] = 1;
    recalc(s);
    return true;
  }
  function rand(rng, a, b) { return a + (b - a) * rng(); }
  function scheduleGold(s, rng) {
    var D = diffOf(s);
    s.gold.next = s.time + rand(rng, D.goldMin, D.goldMax) * s._d.goldFreq;
  }
  /* 누적 생산이 목표를 넘으면 다음 장면이 자동으로 상영되고 생산이 2배가 됩니다 */
  function advanceScenes(s, rng, out) {
    var D = diffOf(s);
    while (s.scene < D.scenes.length && s.total >= D.sceneGoals[s.scene]) {
      s.scene++;
      if (s.scene === 1) {
        s.gold.next = s.time + rand(rng, 12, 20);
        if (D.chaos) s.chaos.next = s.time + rand(rng, 50, 80);
      }
      var cleared = false;
      if (s.scene >= D.scenes.length && !s.cleared) { s.cleared = true; s.clearTime = s.time; cleared = true; }
      out.push({ t: 'scene', scene: s.scene, cleared: cleared });
    }
  }
  function addBuff(s, k, m, dur) {
    for (var i = 0; i < s.buffs.length; i++) if (s.buffs[i].k === k) { s.buffs[i].until = Math.max(s.buffs[i].until, s.time) + dur; return; }
    s.buffs.push({ k: k, m: m, until: s.time + dur, dur: dur });
  }
  function catchGold(s, rng) {
    if (!s.gold.active) return null;
    s.gold.active = null; s.gold.caught++;
    scheduleGold(s, rng);
    var r = rng(), pow = s._d.goldPow;
    if (r < 0.55) {
      var gain = Math.max(basePps(s) * 60, s._d.tapMult * diffOf(s).prod * sceneMult(s) * 40) * pow;
      s.pop += gain; s.total += gain;
      return { k: 'jackpot', gain: gain };
    }
    if (r < 0.85) { addBuff(s, 'frenzy', 3, 30 * pow); return { k: 'frenzy', m: 3, dur: 30 * pow }; }
    addBuff(s, 'fever', 10, 15 * pow);
    return { k: 'fever', m: 10, dur: 15 * pow };
  }
  function startChaos(s, rng) {
    var type;
    do { type = CHAOS_KEYS[Math.floor(rng() * CHAOS_KEYS.length) % CHAOS_KEYS.length]; } while (type === s.chaos.last);
    var a = { type: type, until: s.time + CHAOS[type].dur, dur: CHAOS[type].dur };
    if (type === 'dice') { var r = rng(); a.n = 6; for (var i = 0; i < DICE.length; i++) if (r < DICE[i][0]) { a.n = DICE[i][1]; break; } }
    s.chaos.active = a; s.chaos.last = type; s.chaos.seen++;
    return a;
  }
  function endChaos(s, rng) {
    s.chaos.active = null;
    s.chaos.next = s.time + rand(rng, 90, 150);
  }
  function fixChaos(s, rng) {
    var a = s.chaos.active;
    if (!a || !CHAOS[a.type].fix) return null;
    var res = { type: a.type, reward: 0 };
    if (a.type === 'mouse') { res.reward = basePps(s) * 20; s.pop += res.reward; s.total += res.reward; }
    endChaos(s, rng);
    return res;
  }

  function step(s, dt, rng, out) {
    s.time += dt;
    var gain = pps(s) * dt;
    s.pop += gain; s.total += gain;
    advanceScenes(s, rng, out);
    if (s.buffs.length) s.buffs = s.buffs.filter(function (b) { return b.until > s.time; });
    var g = s.gold;
    if (g.active) {
      if (s.time >= g.active.until) { g.active = null; g.missed++; scheduleGold(s, rng); out.push({ t: 'goldGone' }); }
    } else if (s.time >= g.next) {
      g.active = { until: s.time + GOLD_LIFE };
      out.push({ t: 'gold' });
    }
    var c = s.chaos;
    if (c.active) {
      if (s.time >= c.active.until) {
        var type = c.active.type, lost = 0;
        if (type === 'mouse') { lost = s.pop * 0.15; s.pop -= lost; }
        endChaos(s, rng);
        out.push({ t: 'chaosEnd', type: type, lost: lost });
      }
    } else if (s.time >= c.next) {
      out.push({ t: 'chaos', ev: startChaos(s, rng) });
    }
  }
  /* dt초만큼 진행. 탭이 뒤에 있다가 돌아와 dt가 커져도 1초 단위로 쪼개 계산합니다. */
  function tick(s, dt, rng) {
    var out = [];
    if (!(dt > 0)) return out;
    while (dt > 1) { step(s, 1, rng, out); dt -= 1; }
    step(s, dt, rng, out);
    return out;
  }
  function offline(s, seconds) {
    var sec = Math.min(Math.max(0, seconds), OFFLINE_CAP);
    var gain = basePps(s) * sec * OFFLINE_RATE;
    s.pop += gain; s.total += gain;
    return { gain: gain, sec: sec };
  }

  /* ---------- 도장(업적) ---------- */
  function kinds(s) { var n = 0; for (var i = 0; i < s.gens.length; i++) if (s.gens[i] > 0) n++; return n; }
  function maxOwned(s) { return Math.max.apply(null, s.gens); }
  var ACH = [
    { id: 'tap1',    icon: '🍿', name: '첫 팝콘',        desc: '팝콘을 처음 튀겼어요',         test: function (s) { return s.taps >= 1; } },
    { id: 'tap100',  icon: '👆', name: '손가락 워밍업',  desc: '100번 탭',                     test: function (s) { return s.taps >= 100; } },
    { id: 'tap1k',   icon: '✌\uFE0F', name: '탭 장인',        desc: '1,000번 탭',                   test: function (s) { return s.taps >= 1000; } },
    { id: 'tap5k',   icon: '🔥', name: '불타는 손가락',  desc: '5,000번 탭',                   test: function (s) { return s.taps >= 5000; } },
    { id: 'hire',    icon: '🧒', name: '첫 고용',        desc: '알바생을 처음 고용',           test: function (s) { return s.gens[0] >= 1; } },
    { id: 'own50',   icon: '📦', name: '대량 발주',      desc: '한 시설을 50개 보유',          test: function (s) { return maxOwned(s) >= 50; } },
    { id: 'own100',  icon: '🏗\uFE0F', name: '백 개의 무게',   desc: '한 시설을 100개 보유',         test: function (s) { return maxOwned(s) >= 100; } },
    { id: 'kind5',   icon: '🧺', name: '구색 갖추기',    desc: '시설 5종 보유',                test: function (s) { return kinds(s) >= 5; } },
    { id: 'kind10',  icon: '🗺\uFE0F', name: '팝콘 제국',      desc: '시설 10종 보유',               test: function (s) { return kinds(s) >= 10; } },
    { id: 'kindAll', icon: '👑', name: '전 품목 석권',   desc: '시설 16종 모두 보유',          test: function (s) { return kinds(s) >= GENS.length; } },
    { id: 'up1',     icon: '🧈', name: '첫 코팅',        desc: '업그레이드를 처음 구매',       test: function (s) { return Object.keys(s.ups).length >= 1; } },
    { id: 'up20',    icon: '🧪', name: '레시피 연구가',  desc: '업그레이드 20개 구매',         test: function (s) { return Object.keys(s.ups).length >= 20; } },
    { id: 'scene1',  icon: '🎞\uFE0F', name: '상영 시작',      desc: '첫 장면을 상영',               test: function (s) { return s.scene >= 1; } },
    { id: 'half',    icon: '⏱\uFE0F', name: '인터미션',       desc: '영화의 절반까지 상영',         test: function (s) { return s.scene >= Math.ceil(DIFFS[s.diff].scenes.length / 2); } },
    { id: 'gold1',   icon: '✨', name: '반짝!',          desc: '황금 팝콘을 처음 잡았어요',    test: function (s) { return s.gold.caught >= 1; } },
    { id: 'gold10',  icon: '🌟', name: '황금 사냥꾼',    desc: '황금 팝콘 10개',               test: function (s) { return s.gold.caught >= 10; } },
    { id: 'gold50',  icon: '💫', name: '황금 눈',        desc: '황금 팝콘 50개',               test: function (s) { return s.gold.caught >= 50; } },
    { id: 'man',     icon: '🥉', name: '만 알',          desc: '누적 1만 알 생산',             test: function (s) { return s.total >= 1e4; } },
    { id: 'eok',     icon: '🥈', name: '억 소리 나는',   desc: '누적 1억 알 생산',             test: function (s) { return s.total >= 1e8; } },
    { id: 'jo',      icon: '🥇', name: '조 단위 사업',   desc: '누적 1조 알 생산',             test: function (s) { return s.total >= 1e12; } },
    { id: 'gyeong',  icon: '💎', name: '경이로운 숫자',  desc: '누적 1경 알 생산',             test: function (s) { return s.total >= 1e16; } },
    { id: 'c_easy',    icon: '🎟\uFE0F', name: '단편 완주',        desc: '이지 클리어',     test: function (s) { return s.cleared && s.diff === 'easy'; } },
    { id: 'c_normal',  icon: '🎟\uFE0F', name: 'TV 영화 완주',     desc: '노말 클리어',     test: function (s) { return s.cleared && s.diff === 'normal'; } },
    { id: 'c_hard',    icon: '🎟\uFE0F', name: '장편 완주',        desc: '하드 클리어',     test: function (s) { return s.cleared && s.diff === 'hard'; } },
    { id: 'c_extreme', icon: '🎟\uFE0F', name: '감독판 완주',      desc: '익스트림 클리어', test: function (s) { return s.cleared && s.diff === 'extreme'; } },
    { id: 'c_chaos',   icon: '🎟\uFE0F', name: '무삭제판 완주',    desc: '카오스 클리어',   test: function (s) { return s.cleared && s.diff === 'chaos'; } },
    { id: 'chaos10',   icon: '🌀', name: '혼돈의 단골',      desc: '카오스 이벤트 10번 겪기', test: function (s) { return s.chaos.seen >= 10; } }
  ];

  return {
    SCENE_MULT: SCENE_MULT, TIER_AT: TIER_AT, UNLOCK_RATIO: UNLOCK_RATIO, GOLD_LIFE: GOLD_LIFE, OFFLINE_RATE: OFFLINE_RATE, OFFLINE_CAP: OFFLINE_CAP,
    GENS: GENS, SCENES: SCENES, DIFFS: DIFFS, DIFF_ORDER: DIFF_ORDER, CHAOS: CHAOS, ACH: ACH,
    fmt: fmt, fmtTime: fmtTime, round2: round2,
    upgradesFor: upgradesFor, newState: newState, recalc: recalc, revive: revive,
    basePps: basePps, pps: pps, tapValue: tapValue, prodBuff: prodBuff, tapBuff: tapBuff, genUnit: genUnit,
    genCost: genCost, genMax: genMax, genUnlocked: genUnlocked, costMult: costMult,
    sceneGoal: sceneGoal, scenePrev: scenePrev, sceneProgress: sceneProgress, sceneInfo: sceneInfo, upgradeVisible: upgradeVisible, visibleUpgrades: visibleUpgrades,
    tap: tap, buyGen: buyGen, buyUpgrade: buyUpgrade, recommend: recommend,
    catchGold: catchGold, fixChaos: fixChaos, tick: tick, offline: offline
  };
});
