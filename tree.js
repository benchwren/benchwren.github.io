// Hero: a component tree in 3D, drawn on a 2D canvas with a small perspective projection.
// Drag to turn it; pick a branch (on the canvas or with the buttons) to highlight it and
// update the componentBranch query shown under it.
(() => {
  const stage = document.getElementById('tree-stage');
  const canvas = document.getElementById('tree');
  if (!stage || !canvas) return;
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('stage-hint');
  const queryName = document.getElementById('query-name');
  const branchList = document.getElementById('branches');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');

  const SPACE = {
    name: 'SHOP',
    children: [
      {
        name: 'Platform',
        children: [
          { name: 'Auth', children: [{ name: 'SSO' }, { name: 'Sessions' }] },
          {
            name: 'Payments',
            children: [{ name: 'Checkout' }, { name: 'Refunds', children: [{ name: 'Partial refunds' }] }],
          },
        ],
      },
      { name: 'Mobile', children: [{ name: 'iOS' }, { name: 'Android' }] },
      { name: 'Web', children: [{ name: 'Storefront' }, { name: 'Search' }] },
    ],
  };

  // Flatten and lay out: root at the bottom, each level higher and further out,
  // with each subtree given a slice of the circle in proportion to its leaves.
  const nodes = [];
  const LEVEL_HEIGHT = 1;
  const LEVEL_RADIUS = 0.78;
  function leaves(n) {
    return n.children ? n.children.reduce((s, c) => s + leaves(c), 0) : 1;
  }
  function place(n, parent, depth, from, to) {
    const angle = (from + to) / 2;
    const node = {
      name: n.name,
      parent,
      depth,
      children: [],
      x: depth * LEVEL_RADIUS * Math.cos(angle),
      y: depth * LEVEL_HEIGHT,
      z: depth * LEVEL_RADIUS * Math.sin(angle),
    };
    nodes.push(node);
    if (parent) parent.children.push(node);
    let start = from;
    const total = leaves(n);
    for (const c of n.children || []) {
      const span = ((to - from) * leaves(c)) / total;
      place(c, node, depth + 1, start, start + span);
      start += span;
    }
    return node;
  }
  const root = place(SPACE, null, 0, -Math.PI / 2, Math.PI * 1.5);
  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  const midY = (maxDepth * LEVEL_HEIGHT) / 2;
  const subtree = (n) => [n, ...n.children.flatMap(subtree)];
  const byName = new Map(nodes.map((n) => [n.name, n]));

  // View state.
  let yaw = 0.6;
  let pitch = 0.32;
  let velocity = 0;
  let selected = byName.get('Payments');
  let hovered = null;
  let growth = reduceMotion.matches ? 1 : 0;
  let lastInteraction = -Infinity;
  let offsetY = 0;
  let centred = false;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let colors = readColors();

  function readColors() {
    const s = getComputedStyle(document.documentElement);
    const v = (name) => s.getPropertyValue(name).trim();
    return { ink: v('--ink'), muted: v('--muted'), rule: v('--rule'), spruce: v('--spruce'), wren: v('--wren'), paper: v('--paper-raised') };
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    requestDraw();
  }

  function project(p) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = p.x * cy - p.z * sy;
    const z1 = p.x * sy + p.z * cy;
    const y0 = p.y - midY;
    const y1 = y0 * cp - z1 * sp;
    const z2 = y0 * sp + z1 * cp;
    const camera = 13;
    const f = camera / (camera - z2);
    // Leave room on the right for labels, which sit to the right of their node.
    const labelRoom = Math.min(110, width * 0.2);
    const scale = Math.min((width - labelRoom) / (maxDepth * LEVEL_RADIUS * 1.9), height / (maxDepth * LEVEL_HEIGHT * 1.25));
    return { x: width / 2 - labelRoom / 4 + x1 * f * scale, y: height / 2 + offsetY - y1 * f * scale, z: z2, f };
  }

  const ease = (t) => 1 - Math.pow(1 - t, 3);
  // How much of the edge into node n has grown, 0..1.
  function grown(n) {
    if (!n.parent) return 1;
    const t = growth * maxDepth - (n.depth - 1);
    return ease(Math.min(1, Math.max(0, t)));
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const lit = new Set(selected ? subtree(selected) : []);
    let pts = new Map(nodes.map((n) => [n, project(n)]));
    // Keep the tree vertically centred as it turns; ease towards the target so it doesn't jump.
    const ys = [...pts.values()].map((p) => p.y);
    const shift = height / 2 - (Math.min(...ys) + Math.max(...ys)) / 2;
    if (Math.abs(shift) > 0.5) {
      offsetY += centred && !reduceMotion.matches ? shift * 0.12 : shift;
      centred = true;
      pts = new Map(nodes.map((n) => [n, project(n)]));
    }
    const zs = [...pts.values()].map((p) => p.z);
    const zMin = Math.min(...zs), zMax = Math.max(...zs);
    const nearness = (z) => (zMax === zMin ? 1 : (z - zMin) / (zMax - zMin));

    // Edges, back to front, tapering towards the tips.
    const edges = nodes.filter((n) => n.parent).sort((a, b) => pts.get(a).z + pts.get(a.parent).z - (pts.get(b).z + pts.get(b.parent).z));
    ctx.lineCap = 'round';
    for (const n of edges) {
      const g = grown(n);
      if (g <= 0) continue;
      const a = pts.get(n.parent), b = pts.get(n);
      const on = lit.has(n) && lit.has(n.parent);
      ctx.globalAlpha = (on ? 0.55 : 0.28) + (on ? 0.45 : 0.32) * nearness((a.z + b.z) / 2);
      ctx.strokeStyle = on ? colors.wren : colors.muted;
      ctx.lineWidth = Math.max(1.5, (maxDepth - n.depth + 1.6) * 1.7) * ((a.f + b.f) / 2);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + (b.x - a.x) * g, a.y + (b.y - a.y) * g);
      ctx.stroke();
    }

    // Nodes and labels, back to front.
    const order = [...nodes].sort((a, b) => pts.get(a).z - pts.get(b).z);
    const fontSize = Math.max(11, Math.min(15, width / 42));
    for (const n of order) {
      const g = grown(n);
      if (g < 0.98 && n.parent) continue;
      const p = pts.get(n);
      const near = nearness(p.z);
      const isRoot = !n.parent;
      const on = lit.has(n);
      const k = Math.min(1.12, Math.max(0.88, p.f));
      const r = (isRoot ? 9 : 6.5) * k * (n === hovered ? 1.3 : 1);
      ctx.globalAlpha = 0.45 + 0.55 * near;
      ctx.fillStyle = isRoot ? colors.ink : on ? colors.wren : colors.spruce;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      const label = isRoot ? `${n.name} space` : n.name;
      ctx.font = `${on || n === hovered ? 600 : 500} ${fontSize * k}px "Instrument Sans", system-ui, sans-serif`;
      const tw = ctx.measureText(label).width;
      const lx = p.x + r + 8;
      const ly = p.y;
      ctx.globalAlpha = (0.55 + 0.45 * near) * 0.9;
      ctx.fillStyle = colors.paper;
      roundRect(lx - 5, ly - fontSize * k * 0.75, tw + 10, fontSize * k * 1.5, 6);
      ctx.fill();
      ctx.globalAlpha = 0.5 + 0.5 * near;
      ctx.fillStyle = on ? colors.wren : n === hovered ? colors.ink : colors.muted;
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx, ly + 0.5);
      n.hit = { x: p.x, y: p.y, r: Math.max(r + 10, 18), z: p.z, label: { x: lx - 5, y: ly - fontSize * k * 0.75, w: tw + 10, h: fontSize * k * 1.5 } };
    }
    ctx.globalAlpha = 1;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Animation loop: runs while something moves, stops when the tree is still.
  let frame = 0;
  let visible = true;
  let last = 0;
  function moving() {
    if (reduceMotion.matches) return false;
    return growth < 1 || Math.abs(velocity) > 0.00002 || performance.now() - lastInteraction > 2500;
  }
  function tick(now) {
    frame = 0;
    const dt = Math.min(48, now - (last || now));
    last = now;
    if (!reduceMotion.matches) {
      if (growth < 1) growth = Math.min(1, growth + dt / 1700);
      if (!dragging) {
        if (Math.abs(velocity) > 0.00002) {
          yaw += velocity * dt;
          velocity *= Math.pow(0.94, dt / 16);
        } else if (now - lastInteraction > 2500) {
          yaw += 0.00011 * dt;
        }
      }
    }
    draw();
    if (visible && !document.hidden && (moving() || dragging)) frame = requestAnimationFrame(tick);
    else last = 0;
  }
  function requestDraw() {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  // Selection, shared by the canvas and the branch buttons.
  const pickable = nodes.filter((n) => n.parent && n.children.length);
  for (const n of pickable) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = n.name;
    b.addEventListener('click', () => select(n));
    n.button = b;
    li.append(b);
    branchList.append(li);
  }
  function select(n) {
    selected = n;
    queryName.textContent = `"${n.name}"`;
    for (const p of pickable) p.button.setAttribute('aria-pressed', String(p === n));
    requestDraw();
  }
  select(selected);

  function nodeAt(x, y) {
    let best = null;
    for (const n of nodes) {
      const h = n.hit;
      if (!h || !n.parent) continue;
      const inDot = Math.hypot(x - h.x, y - h.y) <= h.r;
      const inLabel = x >= h.label.x && x <= h.label.x + h.label.w && y >= h.label.y && y <= h.label.y + h.label.h;
      if ((inDot || inLabel) && (!best || h.z > best.hit.z)) best = n;
    }
    return best;
  }

  // Pointer: drag to turn, tap a node to pick its branch.
  let dragging = false;
  let start = null;
  let moved = 0;
  stage.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = 0;
    start = { x: e.clientX, y: e.clientY, t: performance.now() };
    velocity = 0;
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('dragging');
    lastInteraction = performance.now();
    requestDraw();
  });
  stage.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    if (dragging && start) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const now = performance.now();
      moved += Math.abs(dx) + Math.abs(dy);
      yaw += dx * 0.009;
      pitch = Math.min(0.85, Math.max(-0.15, pitch + dy * 0.005));
      velocity = (dx * 0.009) / Math.max(8, now - start.t);
      start = { x: e.clientX, y: e.clientY, t: now };
      lastInteraction = now;
      if (moved > 6 && hint) hint.classList.add('gone');
      requestDraw();
      return;
    }
    const n = nodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (n !== hovered) {
      hovered = n;
      stage.classList.toggle('pointing', !!n);
      requestDraw();
    }
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove('dragging');
    if (reduceMotion.matches) velocity = 0;
    if (moved <= 6) {
      const rect = canvas.getBoundingClientRect();
      const n = nodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (n) select(n);
    }
    lastInteraction = performance.now();
    requestDraw();
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('pointerleave', () => {
    if (hovered) {
      hovered = null;
      stage.classList.remove('pointing');
      requestDraw();
    }
  });

  // Keep it cheap: draw only while on screen, and follow theme and size changes.
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) requestDraw();
  }).observe(stage);
  document.addEventListener('visibilitychange', () => !document.hidden && requestDraw());
  new ResizeObserver(resize).observe(canvas);
  darkScheme.addEventListener('change', () => {
    colors = readColors();
    requestDraw();
  });
  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches) growth = 1;
    requestDraw();
  });
  if (document.fonts) document.fonts.ready.then(requestDraw);
  resize();
})();
