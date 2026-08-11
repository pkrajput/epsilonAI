/* GitTRACE — the autonomous company, as a click-through story window.
   Vision demo: a whole company from the top. Boxes are departments, dots are
   agents living in them, the big island is the humans — work routes to either
   through one central ledger. A finished task arrives with a single pull and
   the department that changed lights up amber. Just vision, for now.

   Six steps (Next / Back, arrow keys):
     0  company at a glance
     1  work moves on edges
     2  humans too — same ledger
     3  every decision recorded (rust rings open the ledger)
     4  a task finishes — one pull (terminal)
     5  live: the changed department glows; RSI on market signals

   Exposes window.GitTraceCodegraphStory = { init() }. No external libraries. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var VB = [0, 0, 2000, 1120];

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* noop */ }

  /* ── scene data: one company, top view ── */

  var FILES = [
    { id: 'humans', name: 'Humans', cls: 'humans', box: [140, 90, 580, 420],
      // the crowd: a few named, the rest anonymous dots
      named: ['maya \u00b7 design', 'omar \u00b7 legal', 'li \u00b7 finance', 'ana \u00b7 sales', 'joe \u00b7 qa', 'zoe \u00b7 data'],
      anon: 28, detail: 'd-humans' },
    { id: 'eng', name: 'Engineering', cls: 'dept', box: [980, 180, 330, 270],
      syms: [
        { n: 'lead', x: 1060, y: 262 },
        { n: 'planner', x: 1175, y: 244 },
        { n: 'builder', x: 1265, y: 268 },
        { n: 'reviewer', x: 1075, y: 336 },
        { n: 'shipper', x: 1190, y: 328, d: 'd-ship' },
        { n: 'tester', x: 1272, y: 342 },
        { n: 'docs', x: 1122, y: 398 },
        { n: 'oncall', x: 1238, y: 402 }
      ],
      links: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [3, 7], [4, 5]] },
    { id: 'orch', name: 'Orchestration', cls: 'dept', box: [1450, 170, 320, 230],
      syms: [
        { n: 'dispatch', x: 1542, y: 262, d: 'd-dispatch' },
        { n: 'roadmap', x: 1668, y: 246 },
        { n: 'metrics', x: 1562, y: 334 },
        { n: 'status', x: 1682, y: 332 }
      ],
      links: [[0, 1], [0, 2], [0, 3]] },
    { id: 'growth', name: 'Growth', cls: 'dept', box: [1020, 660, 360, 210],
      syms: [
        { n: 'campaigns', x: 1142, y: 756, d: 'd-signals', big: true },
        { n: 'ab-tests', x: 1288, y: 798 }
      ],
      links: [[0, 1]] },
    { id: 'support', name: 'Support', cls: 'dept', box: [1500, 560, 340, 330],
      syms: [
        { n: 'triage', x: 1586, y: 650 },
        { n: 'inbox', x: 1722, y: 636 },
        { n: 'refunds', x: 1788, y: 706 },
        { n: 'faq', x: 1582, y: 730 },
        { n: 'escalate', x: 1700, y: 762 },
        { n: 'sla', x: 1592, y: 822 },
        { n: 'csat', x: 1712, y: 846 },
        { n: 'macros', x: 1792, y: 786, d: 'd-tone' }
      ],
      links: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 7], [5, 6], [2, 5]] },
    { id: 'ledger', name: 'Ledger', cls: 'hub', box: [700, 700, 210, 140],
      syms: [{ n: '', x: 805, y: 778 }], links: [] },
    { id: 'mkt', name: 'Marketing', cls: 'dept', box: [190, 730, 400, 290],
      syms: [
        { n: 'brand', x: 262, y: 806 },
        { n: 'seo', x: 402, y: 792 },
        { n: 'social', x: 522, y: 812 },
        { n: 'newsletter', x: 306, y: 886 },
        { n: 'site', x: 476, y: 878 },
        { n: 'blog', x: 262, y: 962 },
        { n: 'press', x: 408, y: 952 },
        { n: 'events', x: 528, y: 946 }
      ],
      links: [[0, 1], [0, 3], [1, 2], [3, 5], [4, 2], [5, 6], [6, 7], [4, 7]] }
  ];

  // Work flows on edges. `lit` = the step at which the edge turns green.
  var EDGES = [
    { id: 'e-ledger-orch', d: 'M 910 755 C 1120 750 1330 420 1450 315', lit: 1 },
    { id: 'e-orch-eng', d: 'M 1450 268 C 1400 262 1360 260 1312 264', lit: 1 },
    { id: 'e-orch-support', d: 'M 1618 400 C 1630 455 1645 505 1656 558', lit: 1 },
    { id: 'e-orch-growth', d: 'M 1470 400 C 1440 500 1415 590 1384 686', lit: 1 },
    { id: 'e-growth-eng', d: 'M 1158 660 C 1150 590 1140 522 1133 454', lit: 1 },
    { id: 'e-growth-support', d: 'M 1380 758 C 1425 752 1455 746 1498 742', lit: 1 },
    { id: 'e-eng-humans', d: 'M 980 300 C 895 300 805 300 724 300', lit: 2 }
  ];

  // Camera keyframes (viewBox rects), one per step.
  var CAMS = [
    [0, 0, 2000, 1120],
    [860, 120, 1080, 800],
    [60, 30, 1340, 780],
    [900, 560, 700, 440],
    [420, 220, 1560, 900],
    [300, 120, 1700, 980]
  ];

  var CAPTIONS = [
    { t: 'Company at a glance.',
      x: 'Boxes are departments. Every dot is an agent, the red ones are live while others store their state plus state of the company.' },
    { t: 'Work moves on edges.',
      x: 'Every hand-off is on the map.' },
    { t: 'Humans too.',
      x: 'One central ledger assigns work to agents or people.' },
    { t: 'Every decision, recorded.',
      x: 'Click a rust ring to read why.' },
    { t: 'A task just finished.',
      x: 'One pull. That\u2019s the whole update.' },
    { t: 'Live, and learning.',
      x: 'Growth lights up. Market signals feed RSI on one objective.' }
  ];

  // Central ledger entries — every decision keeps its why.
  var DETAILS = {
    'd-signals': {
      step: 'task#7', verdict: 'revised', title: 'Core algorithm updated',
      reason: 'Agent A finished updating the core algorithm. The old version stays on the record:',
      code: '// v1: the old scoring pass\nfunction score(signal) {\n  return signal.weight * BASE_RATE;\n}' },
    'd-ship': {
      step: 'task#10 ship-once', verdict: 'survived', title: 'Ship exactly once',
      reason: 'A failed deploy rolls back clean. Success ships once, never twice.' },
    'd-tone': {
      step: 'task#9 one-voice', verdict: 'survived', title: 'One voice',
      reason: 'Reply macros share one tone guide, so every answer sounds like the company.' },
    'd-dispatch': {
      step: 'task#15 human-edit-1', verdict: 'survived', title: 'Hand-verified',
      reason: 'A person verified the dispatch path and left a note on the record.' },
    'd-humans': {
      step: 'ledger \u00b7 humans', verdict: 'survived', title: 'Humans in the loop',
      reason: 'Work routes to people through the same ledger. Same memory, same record.' }
  };

  var REVIEW = {
    author: 'agent-a \u00b7 growth :: campaigns',
    title: 'Refresh pricing stats every 5s',
    reason: 'Landing-page stats were stale. The shorter refresh follows the live market.',
    diff: [
      ['del', '-    }, REFRESH_EVERY_MS);'],
      ['ins', '+    }, 5000);']
    ]
  };

  var PULL_LINES = [
    { note: 'agent A \u00b7 task done' },
    { blank: true },
    { type: 'tracer pull --repo company' },
    { ok: '\u2713 Pulled v18. Live.' },
    { out: '  + code \u00b7 decisions \u00b7 ledger' }
  ];

  /* ── tiny helpers ── */

  function mk(tag, attrs, parent) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  // deterministic rng so the crowd looks the same on every load
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── scene construction ── */

  function buildCrowdSymbols(file) {
    // jittered grid inside the box, below the title strip
    var b = file.box, rng = mulberry32(11);
    var cols = 7, rows = 5, slots = [];
    var x0 = b[0] + 55, y0 = b[1] + 78;
    var dx = (b[2] - 110) / (cols - 1), dy = (b[3] - 118) / (rows - 1);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        slots.push([
          x0 + c * dx + (rng() - 0.5) * 26,
          y0 + r * dy + (rng() - 0.5) * 22
        ]);
      }
    }
    // named people get spread-out grid slots so their labels never collide
    var namedSlots = [4, 8, 19, 14, 24, 29];
    var syms = [];
    file.named.forEach(function (n, k) {
      var s = slots[namedSlots[k]];
      syms.push({ n: n, x: s[0], y: s[1] });
    });
    var rest = slots.filter(function (_, i) { return namedSlots.indexOf(i) === -1; });
    for (var i = rest.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)), tmp = rest[i];
      rest[i] = rest[j]; rest[j] = tmp;
    }
    for (var a = 0; a < file.anon; a++) {
      syms.push({ n: '', x: rest[a][0], y: rest[a][1] });
    }
    // mesh: connect each dot to its nearest neighbour, plus a few extra pairs
    var links = [], seen = {};
    syms.forEach(function (s, si) {
      var best = -1, bd = Infinity;
      syms.forEach(function (o, oi) {
        if (oi === si) return;
        var d2 = (s.x - o.x) * (s.x - o.x) + (s.y - o.y) * (s.y - o.y);
        if (d2 < bd) { bd = d2; best = oi; }
      });
      var key = Math.min(si, best) + '-' + Math.max(si, best);
      if (!seen[key]) { seen[key] = 1; links.push([si, best]); }
    });
    for (var e = 0; e < 14; e++) {
      var p = Math.floor(rng() * syms.length), q = Math.floor(rng() * syms.length);
      if (p === q) continue;
      var k2 = Math.min(p, q) + '-' + Math.max(p, q);
      if (!seen[k2]) { seen[k2] = 1; links.push([p, q]); }
    }
    file.syms = syms;
    file.links = links;
  }

  function build(S) {
    var svg = mk('svg', {
      viewBox: VB.join(' '),
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      'aria-label': 'A company from the top: department boxes full of live agents, a humans box connected through the same central ledger, decision records on rust rings, and an amber glow on the department a pulled task just changed.'
    }, null);
    S.svg = svg;
    S.mount.appendChild(svg);

    var defs = mk('defs', {}, svg);
    ['gray', 'green', 'amber'].forEach(function (c) {
      var m = mk('marker', {
        id: 'cgs-arrow-' + c, viewBox: '0 0 10 10', refX: 8, refY: 5,
        markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse'
      }, defs);
      mk('path', {
        d: 'M 0 1 L 9 5 L 0 9 z',
        fill: c === 'green' ? '#3d6b35' : c === 'amber' ? '#ca8a04' : '#c8c29e'
      }, m);
    });

    var boxLayer = mk('g', {}, svg);
    var meshLayer = mk('g', {}, svg);
    var edgeLayer = mk('g', {}, svg);
    var symLayer = mk('g', {}, svg);

    S.els = [];   // [{el, at}] reveal thresholds (pseudo-progress 0..1)
    S.edgeEls = [];
    S.fileEls = {};
    S.symEls = {};

    var at = 0.012;
    FILES.forEach(function (f) {
      if (f.named) buildCrowdSymbols(f);

      var g = mk('g', { 'class': 'cgs-file cgs-el ' + f.cls }, boxLayer);
      mk('rect', {
        'class': 'box', x: f.box[0], y: f.box[1],
        width: f.box[2], height: f.box[3], rx: 16
      }, g);
      var t = mk('text', {
        'class': 'fname', x: f.box[0] + f.box[2] / 2, y: f.box[1] + 30
      }, g);
      t.textContent = f.name;
      if (f.detail) {
        g.classList.add('cgs-openfile');
        g.addEventListener('click', function () { S.openLedger(f.detail); });
      }
      S.fileEls[f.id] = g;
      S.els.push({ el: g, at: at }); at += 0.005;

      // intra-department mesh
      var mg = mk('g', { 'class': 'cgs-el' }, meshLayer);
      (f.links || []).forEach(function (pair) {
        var a = f.syms[pair[0]], b = f.syms[pair[1]];
        mk('line', { 'class': 'cgs-mesh', x1: a.x, y1: a.y, x2: b.x, y2: b.y }, mg);
      });
      S.els.push({ el: mg, at: at + 0.03 });

      // agents / people
      (f.syms || []).forEach(function (s, si) {
        var sg = mk('g', {
          'class': 'cgs-sym cgs-el' +
            (s.n ? '' : ' anon') + (f.cls === 'humans' ? ' human' : '') + (s.d ? ' decision' : '')
        }, symLayer);
        var r = s.big ? 9 : s.n ? 7 : 5.5;
        mk('circle', { 'class': 'halo', cx: s.x, cy: s.y, r: r + 9 }, sg);
        var dot = mk('circle', { 'class': 'dot', cx: s.x, cy: s.y, r: r }, sg);
        if (s.n) {
          var lt = mk('text', { x: s.x, y: s.y + 24 }, sg);
          lt.textContent = s.n;
        }
        if (s.d) sg.addEventListener('click', function () { S.openLedger(s.d); });
        // alive: a gentle desynchronised pulse on the dot itself.
        // Opacity only, so 60+ animated elements stay cheap to paint.
        if (!reduced) {
          dot.classList.add('cgs-breathe');
          dot.style.animationDuration = (3.6 + ((s.x * 7 + s.y * 13) % 100) / 45).toFixed(2) + 's';
          dot.style.animationDelay = (-((s.x * 3 + s.y * 5) % 100) / 25).toFixed(2) + 's';
        }
        S.symEls[f.id + '/' + (s.n || si)] = sg;
        S.els.push({ el: sg, at: at + 0.035 + (si % 6) * 0.004 });
      });
      at += 0.004;
    });

    EDGES.forEach(function (e, i) {
      var p = mk('path', {
        'class': 'cgs-edge cgs-el', d: e.d,
        'marker-end': 'url(#cgs-arrow-gray)'
      }, edgeLayer);
      S.edgeEls.push({ el: p, lit: e.lit });
      S.els.push({ el: p, at: 0.07 + i * 0.005 });
    });

    // pill on the agent cluster (step 1)
    var agentPill = mk('g', { 'class': 'cgs-pill cgs-el' }, boxLayer);
    mk('rect', { x: 1085, y: 468, width: 170, height: 32 }, agentPill);
    var vt = mk('text', { x: 1170, y: 489 }, agentPill);
    vt.textContent = 'agents at work';
    S.els.push({ el: agentPill, at: 0.17 });

    // pill under the humans box (step 2)
    var pill = mk('g', { 'class': 'cgs-pill cgs-el' }, boxLayer);
    mk('rect', { x: 250, y: 534, width: 360, height: 32 }, pill);
    var pt = mk('text', { x: 430, y: 555 }, pill);
    pt.textContent = 'humans \u00b7 same ledger, same memory';
    S.els.push({ el: pill, at: 0.345 });
  }

  /* ── drawer (ledger + review modes) ── */

  function wireDrawer(S) {
    var d = S.dom;

    S.openLedger = function (id) {
      var it = DETAILS[id];
      if (!it) return;
      d.dStep.textContent = it.step;
      d.dVerdict.textContent = it.verdict;
      d.dVerdict.className = 'd-verdict ' + it.verdict;
      d.dTitle.textContent = it.title;
      d.dReason.textContent = it.reason;
      if (it.code) { d.dCode.textContent = it.code; d.dCode.hidden = false; }
      else d.dCode.hidden = true;
      d.dDiff.hidden = true;
      d.dActions.hidden = true;
      d.detail.classList.remove('cgs-review');
      d.detail.classList.add('open');
      S.reviewOpen = false;
    };

    S.openReview = function () {
      d.dStep.textContent = REVIEW.author;
      d.dVerdict.textContent = 'pending review';
      d.dVerdict.className = 'd-verdict pending';
      d.dTitle.textContent = REVIEW.title;
      d.dReason.textContent = REVIEW.reason;
      d.dCode.hidden = true;
      d.dDiff.innerHTML = '';
      REVIEW.diff.forEach(function (line) {
        var s = document.createElement('span');
        s.className = line[0];
        s.textContent = line[1];
        d.dDiff.appendChild(s);
      });
      d.dDiff.hidden = false;
      d.dActions.hidden = false;
      d.detail.classList.add('cgs-review', 'open');
      S.reviewOpen = true;
    };

    S.closeDrawer = function () {
      d.detail.classList.remove('open');
      S.reviewOpen = false;
    };

    d.dClose.addEventListener('click', S.closeDrawer);
    d.dAccept.addEventListener('click', function () {
      S.clearGlow();
      S.closeDrawer();
      S.termLine({ ok: '\u2713 accepted. The glow is clear.' });
    });
    d.dReject.addEventListener('click', function () {
      S.closeDrawer();
      S.termLine({ out: 'rejected. The verdict rides on your next push.' });
    });
  }

  /* ── the pull terminal ── */

  function wireTerminal(S) {
    var body = S.dom.termBody;

    S.termLine = function (l) {
      var s = document.createElement('span');
      s.className = 'cgs-t-line ' +
        (l.note ? 'cgs-t-note' : l.type != null ? 'cgs-t-in' : l.ok ? 'cgs-t-ok' : 'cgs-t-out');
      if (l.type != null) {
        var p = document.createElement('span');
        p.className = 'p';
        p.textContent = '$ ';
        s.appendChild(p);
        var b = document.createElement('span');
        s.appendChild(b);
        body.appendChild(s);
        return b;
      }
      s.textContent = l.note || l.ok || l.out || '\u00a0';
      body.appendChild(s);
      return s;
    };

    S.pullGen = 0;

    S.startPull = function () {
      if (S.pullStarted) return;
      S.pullStarted = true;
      var gen = ++S.pullGen;
      if (reduced) {
        PULL_LINES.forEach(function (l) {
          if (l.blank) return S.termLine({ out: '' });
          var el = S.termLine(l);
          if (l.type != null) el.textContent = l.type;
        });
        S.pullDone = true;
        S.applyGlow();
        return;
      }
      var li = 0;
      (function nextLine() {
        if (gen !== S.pullGen) return;
        if (li >= PULL_LINES.length) {
          S.pullDone = true;
          S.applyGlow();
          return;
        }
        var l = PULL_LINES[li++];
        if (l.blank) { S.termLine({ out: '' }); return setTimeout(nextLine, 120); }
        if (l.type != null) {
          var b = S.termLine(l);
          b.parentNode.classList.add('cgs-t-cursor');
          var c = 0;
          (function typeChar() {
            if (gen !== S.pullGen) return;
            b.textContent = l.type.slice(0, ++c);
            if (c < l.type.length) return setTimeout(typeChar, 30 + Math.random() * 34);
            setTimeout(function () {
              if (gen !== S.pullGen) return;
              b.parentNode.classList.remove('cgs-t-cursor');
              nextLine();
            }, 460);
          })();
          return;
        }
        S.termLine(l);
        // the glow lands the moment the pull confirms, not after the tail lines
        if (l.ok) S.applyGlow();
        setTimeout(nextLine, l.ok ? 420 : 220);
      })();
    };

    // Stepping back before the pull re-arms the whole sequence,
    // so the story replays on every pass.
    S.resetPull = function () {
      if (!S.pullStarted) return;
      S.pullGen++;
      S.pullStarted = false;
      S.pullDone = false;
      S.glowCleared = false;
      S.reviewOpened = false;
      body.innerHTML = '';
      if (S.glowOn) S.clearGlowVisual();
      if (S.reviewOpen) S.closeDrawer();
    };
  }

  /* ── glow (the pulled change landing, in the site's amber) ── */

  function wireGlow(S) {
    var sym = S.symEls['growth/campaigns'];
    sym.addEventListener('click', function () {
      if (S.glowOn) S.openReview();
    });

    S.applyGlow = function () {
      if (S.glowOn || S.glowCleared) return;
      S.glowOn = true;
      S.fileEls.growth.classList.add('glow');
      sym.classList.add('glow', 'cgs-openreview');
      // the payoff drawer opens on its own on wide screens
      if (!S.reviewOpened && window.innerWidth > 760) {
        S.reviewOpened = true;
        setTimeout(function () { if (S.glowOn) S.openReview(); }, reduced ? 0 : 800);
      }
    };
    S.clearGlowVisual = function () {
      S.glowOn = false;
      S.fileEls.growth.classList.remove('glow');
      sym.classList.remove('glow', 'cgs-openreview');
    };
    S.clearGlow = function () {
      S.clearGlowVisual();
      S.glowCleared = true; // stays clear until the story is re-armed
    };
  }

  /* ── the stepper (Next / Back / arrow keys) ── */

  function wireStepper(S) {
    var d = S.dom;
    var target = CAMS[0].slice();
    var current = CAMS[0].slice();
    var beat = -1;
    var running = false;

    // The camera loop only runs while the frame is actually moving.
    // A permanent rAF loop repaints the whole SVG forever and can
    // freeze the page on large screens.
    function frame() {
      var done = true;
      for (var i = 0; i < 4; i++) {
        current[i] += (target[i] - current[i]) * 0.09;
        if (Math.abs(target[i] - current[i]) > 0.4) done = false;
        else current[i] = target[i];
      }
      S.svg.setAttribute('viewBox', current.map(function (v) { return v.toFixed(1); }).join(' '));
      if (done) { running = false; return; }
      requestAnimationFrame(frame);
    }
    function kick() {
      if (reduced) {
        current = target.slice();
        S.svg.setAttribute('viewBox', current.join(' '));
        return;
      }
      if (!running) { running = true; requestAnimationFrame(frame); }
    }

    S.go = function (n) {
      n = Math.max(0, Math.min(CAMS.length - 1, n));
      if (n === beat) return;
      var prev = beat;
      beat = n;
      target = CAMS[n].slice();
      kick();

      // reveals: everything the story has shown so far stays visible
      var pseudo = (n + 1) / CAMS.length - 0.01;
      var wait = 0;
      S.els.forEach(function (it) {
        var should = pseudo >= it.at;
        if (should && !it.el.classList.contains('on')) {
          if (reduced || prev !== -1) it.el.classList.add('on');
          else setTimeout(function () { it.el.classList.add('on'); }, wait = Math.min(wait + 12, 640));
        } else if (!should) {
          it.el.classList.remove('on');
        }
      });

      S.edgeEls.forEach(function (e) {
        var on = beat >= e.lit;
        if (on !== e.on) {
          e.on = on;
          e.el.classList.toggle('lit', on);
          e.el.setAttribute('marker-end', 'url(#cgs-arrow-' + (on ? 'green' : 'gray') + ')');
        }
      });

      d.term.classList.toggle('show', beat >= 4);
      if (beat >= 4) {
        S.startPull();
        // Stepping around after the pull finished always shows the payoff,
        // even if an earlier Accept cleared it.
        if (S.pullDone && !S.glowOn) {
          S.glowCleared = false;
          S.applyGlow();
        }
      } else {
        S.resetPull();
      }

      // caption swap
      d.caption.style.opacity = 0;
      setTimeout(function () {
        d.capIdx.textContent = (beat + 1) + ' / ' + CAPTIONS.length;
        d.capTitle.textContent = CAPTIONS[beat].t;
        d.capText.textContent = CAPTIONS[beat].x;
        d.caption.style.opacity = 1;
      }, reduced ? 0 : 180);

      // the ledger drawer opens on the "recorded" step, closes after —
      // unless the review drawer took over.
      if (beat === 3) S.openLedger('d-signals');
      else if (prev === 3 && !S.reviewOpen) S.closeDrawer();

      d.btnBack.disabled = beat === 0;
      d.btnNext.disabled = beat === CAMS.length - 1;
    };

    d.btnNext.addEventListener('click', function () { S.go(beat + 1); });
    d.btnBack.addEventListener('click', function () { S.go(beat - 1); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') S.go(beat + 1);
      else if (e.key === 'ArrowLeft') S.go(beat - 1);
    });

    S.svg.setAttribute('viewBox', current.join(' '));
    S.go(0);
  }

  /* ── public API ── */

  window.GitTraceCodegraphStory = {
    init: function () {
      var ids = {
        mount: 'cgs-mount',
        caption: 'cgs-caption', capIdx: 'cgs-cap-idx', capTitle: 'cgs-cap-title', capText: 'cgs-cap-text',
        detail: 'cgs-detail', dClose: 'cgs-d-close', dStep: 'cgs-d-step', dVerdict: 'cgs-d-verdict',
        dTitle: 'cgs-d-title', dReason: 'cgs-d-reason', dCode: 'cgs-d-code',
        dDiff: 'cgs-d-diff', dActions: 'cgs-d-actions', dAccept: 'cgs-d-accept', dReject: 'cgs-d-reject',
        term: 'cgs-term', termBody: 'cgs-term-body',
        btnBack: 'cgs-back', btnNext: 'cgs-next'
      };
      var dom = {};
      for (var k in ids) {
        dom[k] = document.getElementById(ids[k]);
        if (!dom[k]) return; // markup missing: fail silent, page still works
      }
      var S = { dom: dom, mount: dom.mount, pullStarted: false, pullDone: false, glowOn: false, glowCleared: false, reviewOpen: false };
      build(S);
      wireDrawer(S);
      wireTerminal(S);
      wireGlow(S);
      wireStepper(S);
    }
  };
})();
