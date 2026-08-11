/* GitTRACE — shared memory collaboration graph.
   Exposes window.GitTraceCollabGraph = { init(container), step(n), reset() }.

   One SVG graph, five staged states:
     1  base graph fades in (what the product manager sees)
     2  branches sprout for Agent 1 and Agent 2
     3  Agent 1 waits on auth, the PM grants it (pulse travels over)
     4  Agent 2 records finished work, it lights up as part of the shared graph
     5  Agent 1 pulls Agent 2's work straight from the shared graph

   No external libraries, no network requests. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var VB = '0 0 1000 575';

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* noop */ }

  var S = null; // live instance state

  /* ── small SVG helpers ── */

  function mk(tag, attrs, parent) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  function label(parent, x, y, cls, str) {
    var t = mk('text', { x: x, y: y, 'class': cls }, parent);
    t.textContent = str;
    return t;
  }

  function later(ms, fn) {
    if (!S) return;
    S.timers.push(setTimeout(fn, ms));
  }

  /* ── builders ── */

  function makeNode(id, x, y, r, cls) {
    var g = mk('g', { 'class': 'cg-node ' + cls, transform: 'translate(' + x + ',' + y + ')' }, S.nodesLayer);
    var pop = mk('g', { 'class': 'cg-pop' }, g);
    var body = mk('g', { 'class': 'cg-float' }, pop);
    // desynchronized gentle drift so the graph feels alive
    body.style.animationDuration = (4.4 + Math.random() * 2.2).toFixed(2) + 's';
    body.style.animationDelay = (-Math.random() * 4).toFixed(2) + 's';
    mk('circle', { 'class': 'cg-halo', r: r + 8 }, body);
    mk('circle', { 'class': 'cg-c', r: r }, body);
    S.els[id] = { g: g, pop: pop, body: body };
    return body;
  }

  function makeEdge(id, d, cls) {
    var p = mk('path', { d: d, 'class': 'cg-edge ' + (cls || '') }, S.edgesLayer);
    S.els[id] = { p: p };
    return p;
  }

  /* ── animation primitives ── */

  function showNode(id, opts) {
    opts = opts || {};
    var n = S.els[id];
    function on() { n.g.classList.add('cg-on'); }
    if (opts.instant || reduced) {
      n.pop.style.animation = 'none';
      on();
    } else if (opts.delay) {
      later(opts.delay, on);
    } else {
      on();
    }
  }

  function drawEdge(id, opts) {
    opts = opts || {};
    var p = S.els[id].p;
    p.classList.add('cg-on');
    if (opts.instant || reduced) {
      p.style.strokeDasharray = 'none';
      if (opts.arrow) p.setAttribute('marker-end', 'url(#cg-arrow)');
      return;
    }
    var len = p.getTotalLength();
    var dur = opts.dur || 600;
    var delay = opts.delay || 0;
    p.style.transition = 'none';
    p.style.strokeDasharray = len + ' ' + len;
    p.style.strokeDashoffset = len;
    p.getBoundingClientRect(); // flush so the transition starts from hidden
    p.style.transition = 'stroke-dashoffset ' + dur + 'ms cubic-bezier(.4,0,.2,1) ' + delay + 'ms';
    p.style.strokeDashoffset = '0';
    // the arrowhead only makes sense once the line has arrived
    if (opts.arrow) later(delay + dur - 60, function () { p.setAttribute('marker-end', 'url(#cg-arrow)'); });
  }

  function blip(id) {
    var g = S.els[id].g;
    g.classList.remove('cg-blip');
    void g.getBoundingClientRect().width;
    g.classList.add('cg-blip');
  }

  function showTag(id, opts) {
    opts = opts || {};
    var t = S.els[id].t;
    function on() { t.classList.add('cg-on'); }
    if (opts.instant || reduced || !opts.delay) on(); else later(opts.delay, on);
  }

  // moves a glowing dot along a path, then calls done()
  function runDot(pathEl, dur, done) {
    if (reduced) { if (done) done(); return; }
    var gen = S.gen;
    var dot = mk('circle', { r: 5, 'class': 'cg-dot' }, S.fxLayer);
    var len = pathEl.getTotalLength();
    var t0 = performance.now();
    (function frame(now) {
      if (!S || S.gen !== gen) { dot.remove(); return; }
      var t = Math.min(1, (now - t0) / dur);
      var e = t * t * (3 - 2 * t);
      var pt = pathEl.getPointAtLength(len * e);
      dot.setAttribute('cx', pt.x);
      dot.setAttribute('cy', pt.y);
      if (t < 1) { requestAnimationFrame(frame); return; }
      dot.remove();
      if (done) done();
    })(t0);
  }

  /* ── scene construction ── */

  function build(container) {
    if (S) S.timers.forEach(clearTimeout);
    S = {
      container: container,
      els: {},
      timers: [],
      gen: (S ? S.gen + 1 : 1),
      step: 0,
      built: true
    };
    container.innerHTML = '';

    var root = document.createElement('div');
    root.className = 'cg-root';
    container.appendChild(root);

    var svg = mk('svg', {
      viewBox: VB,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      'aria-label': 'One shared memory graph. The product manager and two agents all read and write the same graph: auth is granted on it, finished work lands in it, and other agents pull from it.'
    }, root);
    S.svg = svg;

    var defs = mk('defs', {}, svg);
    var grad = mk('radialGradient', { id: 'cg-bgGrad', cx: '50%', cy: '48%', r: '55%' }, defs);
    mk('stop', { offset: '0%', 'stop-color': 'rgba(90,138,80,.07)' }, grad);
    mk('stop', { offset: '100%', 'stop-color': 'rgba(90,138,80,0)' }, grad);
    var marker = mk('marker', {
      id: 'cg-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5,
      markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse'
    }, defs);
    mk('path', { d: 'M 0 1 L 9 5 L 0 9 z', fill: '#3d6b35' }, marker);

    mk('ellipse', { cx: 500, cy: 288, rx: 470, ry: 260, fill: 'url(#cg-bgGrad)' }, svg);

    S.edgesLayer = mk('g', {}, svg);
    S.fxLayer = mk('g', {}, svg);
    S.nodesLayer = mk('g', {}, svg);
    S.tagsLayer = mk('g', {}, svg);

    /* edges (drawn hidden, revealed per step) */
    // step 1 — the base graph
    makeEdge('e-pm-hub', 'M 148 285 H 305');
    makeEdge('e-hub-auth', 'M 331 276 Q 390 228 444 172');
    makeEdge('e-hub-pay', 'M 333 288 Q 410 300 483 306');
    makeEdge('e-hub-checkout', 'M 327 297 Q 362 372 421 419');
    makeEdge('e-auth-checkout', 'M 453 171 Q 470 300 434 417');
    makeEdge('e-pay-checkout', 'M 488 318 Q 462 378 437 419');
    makeEdge('e-checkout-decision', 'M 441 430 Q 510 447 578 452');
    // step 2 — branches sprout
    makeEdge('e-auth-agent1', 'M 466 162 Q 580 128 687 147', 'cg-branch');
    makeEdge('e-pay-agent2', 'M 501 314 Q 600 352 688 396', 'cg-branch');
    // step 3 — auth node on Agent 1's branch
    makeEdge('e-agent1-lock', 'M 713 152 Q 782 168 831 199', 'cg-branch');
    // step 4 — recorded work shared into the common graph
    makeEdge('e-agent2-done', 'M 713 405 Q 790 425 846 447', 'cg-branch');
    makeEdge('e-done-hub', 'M 846 462 C 690 570 300 560 312 296', 'cg-green');
    // step 5 — Agent 1 pulls from the shared graph
    makeEdge('e-pull', 'M 864 444 C 985 385 985 195 716 151', 'cg-green');

    // dashed arc for the auth grant travelling from the PM
    S.els['p-pulse'] = { p: mk('path', { d: 'M 140 266 C 210 30 640 -40 840 191', 'class': 'cg-pulsepath' }, S.edgesLayer) };

    /* nodes */
    var b;

    b = makeNode('n-pm', 130, 285, 16, 'cg-person cg-pulse');
    mk('circle', { cx: 0, cy: -4.6, r: 3.4, 'class': 'cg-icon' }, b);
    mk('path', { d: 'M -6.4 7.6 C -6.4 1.6 -3.4 0.4 0 0.4 C 3.4 0.4 6.4 1.6 6.4 7.6', 'class': 'cg-icon' }, b);
    label(b, 0, 38, 'cg-name', 'Product manager');

    b = makeNode('n-hub', 320, 285, 13, 'cg-hub');
    mk('path', { d: 'M -4.5 0 h 3.2 M -1.3 0 l 3 -3.4 M -1.3 0 l 3 3.4', 'class': 'cg-icon' }, b);
    mk('circle', { cx: -5.5, cy: 0, r: 1.6, fill: '#3d5736' }, b);
    mk('circle', { cx: 3.2, cy: -4.4, r: 1.6, fill: '#3d5736' }, b);
    mk('circle', { cx: 3.2, cy: 4.4, r: 1.6, fill: '#3d5736' }, b);
    label(b, 0, -40, 'cg-sub', 'shared memory');
    label(b, 0, -24, 'cg-name', 'main');

    b = makeNode('n-auth', 455, 160, 10, '');
    label(b, 0, -20, 'cg-lab', 'auth.py');

    b = makeNode('n-pay', 495, 308, 10, '');
    label(b, 8, 30, 'cg-lab', 'payments.py');

    b = makeNode('n-checkout', 430, 428, 10, '');
    label(b, -14, 30, 'cg-lab', 'checkout.py');

    b = makeNode('n-decision', 588, 455, 9, 'cg-decision cg-pulse');
    label(b, 22, 30, 'cg-lab', 'capture once');
    label(b, 22, 46, 'cg-sub', 'checkout decision');

    b = makeNode('n-agent1', 700, 148, 13, 'cg-agent');
    mk('rect', { x: -4.8, y: -2.6, width: 9.6, height: 7, rx: 1.6, 'class': 'cg-icon' }, b);
    mk('path', { d: 'M 0 -2.6 V -5.4', 'class': 'cg-icon' }, b);
    mk('circle', { cx: 0, cy: -6.6, r: 1.3, fill: '#5a8a50' }, b);
    mk('circle', { cx: -2.1, cy: 0.9, r: 1, fill: '#5a8a50' }, b);
    mk('circle', { cx: 2.1, cy: 0.9, r: 1, fill: '#5a8a50' }, b);
    label(b, 0, -42, 'cg-name', 'Agent 1');
    label(b, 0, -26, 'cg-sub', 'checkout flow');

    b = makeNode('n-agent2', 700, 402, 13, 'cg-agent');
    mk('rect', { x: -4.8, y: -2.6, width: 9.6, height: 7, rx: 1.6, 'class': 'cg-icon' }, b);
    mk('path', { d: 'M 0 -2.6 V -5.4', 'class': 'cg-icon' }, b);
    mk('circle', { cx: 0, cy: -6.6, r: 1.3, fill: '#5a8a50' }, b);
    mk('circle', { cx: -2.1, cy: 0.9, r: 1, fill: '#5a8a50' }, b);
    mk('circle', { cx: 2.1, cy: 0.9, r: 1, fill: '#5a8a50' }, b);
    label(b, 0, 34, 'cg-name', 'Agent 2');
    label(b, 0, 50, 'cg-sub', 'payment retry');

    b = makeNode('n-lock', 842, 205, 11, 'cg-lock');
    mk('rect', { x: -4.6, y: -0.8, width: 9.2, height: 7, rx: 1.5, 'class': 'cg-lockicon' }, b);
    mk('path', { d: 'M -2.6 -0.8 V -3 a 2.6 2.6 0 0 1 5.2 0 V -0.8', 'class': 'cg-lockicon' }, b);
    var badge = mk('g', { 'class': 'cg-badge', transform: 'translate(9.5,-9.5)' }, b);
    mk('circle', { r: 5.5, fill: '#3d6b35' }, badge);
    mk('path', { d: 'M -2.3 0 L -0.7 1.7 L 2.4 -1.6', fill: 'none', stroke: '#fffef5', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, badge);
    S.els['t-lock'] = { t: label(b, 4, 32, 'cg-lab', 'waiting for auth') };

    b = makeNode('n-done', 858, 452, 11, 'cg-done');
    mk('path', { d: 'M -4.4 0.6 L -1 4 L 4.8 -3.4', fill: 'none', stroke: '#3d6b35', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, b);
    label(b, 4, 34, 'cg-lab', 'retry logic');

    /* floating tags */
    S.els['t-shared'] = { t: label(S.tagsLayer, 566, 552, 'cg-tag', 'recorded straight into main') };
    S.els['t-pull'] = { t: label(S.tagsLayer, 878, 302, 'cg-tag', 'Agent 1 pulls') };
  }

  /* ── the five steps ── */

  // step 1: the base graph the PM sees, fading in piece by piece
  function step1(anim) {
    var inst = { instant: true };
    if (!anim) {
      ['e-pm-hub', 'e-hub-auth', 'e-hub-pay', 'e-hub-checkout', 'e-auth-checkout', 'e-pay-checkout', 'e-checkout-decision']
        .forEach(function (id) { drawEdge(id, inst); });
      ['n-pm', 'n-hub', 'n-auth', 'n-pay', 'n-checkout', 'n-decision']
        .forEach(function (id) { showNode(id, inst); });
      return;
    }
    showNode('n-pm');
    drawEdge('e-pm-hub', { dur: 400, delay: 250 });
    showNode('n-hub', { delay: 550 });
    drawEdge('e-hub-auth', { dur: 420, delay: 800 });
    drawEdge('e-hub-pay', { dur: 420, delay: 900 });
    drawEdge('e-hub-checkout', { dur: 420, delay: 1000 });
    showNode('n-auth', { delay: 1080 });
    showNode('n-pay', { delay: 1180 });
    showNode('n-checkout', { delay: 1280 });
    drawEdge('e-auth-checkout', { dur: 450, delay: 1400 });
    drawEdge('e-pay-checkout', { dur: 380, delay: 1450 });
    drawEdge('e-checkout-decision', { dur: 380, delay: 1550 });
    showNode('n-decision', { delay: 1800 });
  }

  // step 2: two branches sprout, one per agent
  function step2(anim) {
    if (!anim) {
      drawEdge('e-auth-agent1', { instant: true });
      drawEdge('e-pay-agent2', { instant: true });
      showNode('n-agent1', { instant: true });
      showNode('n-agent2', { instant: true });
      return;
    }
    drawEdge('e-auth-agent1', { dur: 550 });
    drawEdge('e-pay-agent2', { dur: 550, delay: 180 });
    showNode('n-agent1', { delay: 430 });
    showNode('n-agent2', { delay: 620 });
  }

  // step 3: Agent 1 needs auth; the grant travels over from the PM
  function step3(anim) {
    var gen = S.gen;
    function grant(withBlip) {
      if (!S || S.gen !== gen) return;
      var lock = S.els['n-lock'];
      lock.g.classList.remove('cg-pulse');
      lock.g.classList.add('cg-granted');
      S.els['t-lock'].t.textContent = 'auth granted';
      if (withBlip) blip('n-lock');
    }
    if (!anim) {
      drawEdge('e-agent1-lock', { instant: true });
      showNode('n-lock', { instant: true });
      grant(false);
      return;
    }
    drawEdge('e-agent1-lock', { dur: 450 });
    later(300, function () {
      if (!S || S.gen !== gen) return;
      showNode('n-lock');
      S.els['n-lock'].g.classList.add('cg-pulse'); // amber "waiting" pulse
    });
    later(1000, function () {
      if (!S || S.gen !== gen) return;
      var pulse = S.els['p-pulse'].p;
      pulse.classList.add('cg-on');
      blip('n-pm');
      runDot(pulse, 1150, function () {
        grant(true);
        later(350, function () { pulse.classList.remove('cg-on'); });
      });
    });
  }

  // step 4: Agent 2's finished work lights up as part of the shared graph
  function step4(anim) {
    var gen = S.gen;
    if (!anim) {
      drawEdge('e-agent2-done', { instant: true });
      showNode('n-done', { instant: true });
      S.els['n-done'].g.classList.add('cg-shine', 'cg-pulse');
      drawEdge('e-done-hub', { instant: true, arrow: true });
      showTag('t-shared', { instant: true });
      return;
    }
    drawEdge('e-agent2-done', { dur: 420 });
    showNode('n-done', { delay: 320 });
    later(950, function () {
      if (!S || S.gen !== gen) return;
      S.els['n-done'].g.classList.add('cg-shine', 'cg-pulse');
      blip('n-done');
      drawEdge('e-done-hub', { dur: 950, arrow: true });
      runDot(S.els['e-done-hub'].p, 950, function () { blip('n-hub'); });
      showTag('t-shared', { delay: 550 });
    });
  }

  // step 5: Agent 1 pulls Agent 2's work; one connected shared graph
  function step5(anim) {
    var gen = S.gen;
    function settle() {
      if (!S || S.gen !== gen) return;
      ['n-pm', 'n-hub', 'n-auth', 'n-pay', 'n-checkout', 'n-decision',
        'n-agent1', 'n-agent2', 'n-lock', 'n-done'].forEach(function (id, i) {
        later(i * 70, function () { if (S && S.gen === gen) blip(id); });
      });
    }
    if (!anim) {
      drawEdge('e-pull', { instant: true, arrow: true });
      showTag('t-pull', { instant: true });
      return;
    }
    drawEdge('e-pull', { dur: 1000, arrow: true });
    showTag('t-pull', { delay: 450 });
    runDot(S.els['e-pull'].p, 1000, function () {
      blip('n-agent1');
      later(250, settle);
    });
  }

  var stepFns = [step1, step2, step3, step4, step5];

  /* ── public API ── */

  window.GitTraceCollabGraph = {
    // Renders the base (empty) state into the container. Safe to call again:
    // a repeat call on the same, already-rendered container is a no-op.
    init: function (container) {
      if (!container) return;
      if (S && S.container === container && S.built && container.firstChild) return;
      build(container);
    },

    // Animates to the state of step n (1..5). Skipped steps fast-forward
    // instantly, only the requested step plays its animation.
    step: function (n) {
      if (!S || !S.built) return;
      n = Math.max(1, Math.min(5, Math.round(Number(n) || 0)));
      if (n <= S.step) return;
      for (var k = S.step + 1; k <= n; k++) stepFns[k - 1](k === n);
      S.step = n;
    },

    // Rebuilds from scratch in the current container (used for replay).
    reset: function () {
      if (S && S.container) build(S.container);
    }
  };
})();
