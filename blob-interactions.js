// Simple interactive blob for #blobCanvas
// Usage: include after the canvas element in the DOM

(() => {
  const canvas = document.getElementById('blobCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Respect reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Device pixel scaling
  function resize() {
    const DPR = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    canvas.width = Math.max(1, Math.floor(w * DPR));
    canvas.height = Math.max(1, Math.floor(h * DPR));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // Blob state
  let blobX = canvas.width / 2;
  let blobY = canvas.height / 2;
  let targetX = blobX;
  let targetY = blobY;
  let baseRadius = Math.min(canvas.width, canvas.height) * 0.18;
  let radius = baseRadius;
  let pulse = 0;
  let pulseStart = 0;
  let colorMode = 0; // 0 => main blue, 1 => alternate

  // convert CSS var color or fallback to hardcoded
  function getCssColor(varName, fallback) {
    try {
      const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      return val || fallback;
    } catch {
      return fallback;
    }
  }
  const blueMedium = getCssColor('--blue-medium', '#1e88e5');
  const blueDark = getCssColor('--blue-dark', '#1565c0');

  // pointer handling
  let isPointerActive = false;

  function setTargetFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
    const clientY = (e.touches ? e.touches[0].clientY : e.clientY);
    targetX = clientX - rect.left;
    targetY = clientY - rect.top;
    isPointerActive = true;
  }

  function clearPointer() {
    isPointerActive = false;
    // return to center slowly if you want:
    const rect = canvas.getBoundingClientRect();
    targetX = rect.width / 2;
    targetY = rect.height / 2;
  }

  // Events
  canvas.style.pointerEvents = 'auto';

  canvas.addEventListener('mousemove', (e) => {
    if (prefersReducedMotion) return;
    setTargetFromEvent(e);
  });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    setTargetFromEvent(e);
  }, { passive: false });

  canvas.addEventListener('mouseleave', () => {
    clearPointer();
  });
  canvas.addEventListener('touchend', () => {
    clearPointer();
  });

  // Click to pulse
  canvas.addEventListener('click', (e) => {
    pulseStart = performance.now();
    pulse = 1;
  });

  // Double click toggles color mode
  canvas.addEventListener('dblclick', () => {
    colorMode = (colorMode + 1) % 2;
  });

  // Keyboard accessibility: space or enter triggers pulse when the canvas has focus
  canvas.setAttribute('tabindex', '0');
  canvas.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      pulseStart = performance.now();
      pulse = 1;
    }
  });

  // Animation loop
  let last = performance.now();
  function update(t) {
    const dt = (t - last) / 1000;
    last = t;

    // adapt base radius if canvas resized
    const rect = canvas.getBoundingClientRect();
    baseRadius = Math.min(rect.width, rect.height) * 0.18;

    // Smoothly move blob toward target
    const ease = prefersReducedMotion ? 0.25 : 0.12;
    blobX += (targetX - blobX) * ease;
    blobY += (targetY - blobY) * ease;

    // radius responds to pointer activity and pulse
    const activeRadius = baseRadius + (isPointerActive ? Math.min(80, Math.hypot(blobX - targetX, blobY - targetY)) : 0);
    radius += (activeRadius - radius) * 0.09;

    // pulse decays
    if (pulse > 0) {
      const elapsed = (t - pulseStart) / 1000;
      pulse = Math.max(0, 1 - elapsed * 1.6); // decay faster
    }

    draw();
    requestAnimationFrame(update);
  }

  function draw() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // compute visual radius with pulse
    const visualRadius = radius * (1 + 0.28 * pulse);

    // gradient center follows blob
    const g = ctx.createRadialGradient(blobX, blobY, Math.max(1, visualRadius * 0.1), blobX, blobY, Math.max(visualRadius, 10));
    if (colorMode === 0) {
      g.addColorStop(0, hexToRgba(blueMedium, 0.95));
      g.addColorStop(0.6, hexToRgba(blueDark, 0.85));
      g.addColorStop(1, hexToRgba(blueDark, 0.18));
    } else {
      // softer alternate (lighter)
      g.addColorStop(0, 'rgba(96,165,250,0.95)');
      g.addColorStop(0.6, 'rgba(59,130,246,0.85)');
      g.addColorStop(1, 'rgba(59,130,246,0.18)');
    }

    // soft shadow/blur effect
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // optional soft outer glow
    ctx.beginPath();
    ctx.fillStyle = g;
    roundBlob(ctx, blobX, blobY, visualRadius);
    ctx.fill();

    // inner highlight ring
    ctx.beginPath();
    ctx.globalAlpha = 0.12;
    const innerGrad = ctx.createRadialGradient(blobX, blobY, visualRadius * 0.2, blobX, blobY, visualRadius);
    innerGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
    innerGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = innerGrad;
    roundBlob(ctx, blobX, blobY, visualRadius);
    ctx.fill();

    ctx.restore();
  }

  // Draw a soft rounded blob using arc + quadratic smoothing (keeps it cheap)
  function roundBlob(ctx, x, y, r) {
    // we draw a circle that will act as a soft blob; more complex blob shapes can use path points
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
  }

  // tiny helper: convert #rrggbb to rgba(r,g,b,a)
  function hexToRgba(hex, alpha = 1) {
    const c = hex.replace('#', '');
    if (c.length === 3) {
      const r = parseInt(c[0] + c[0], 16);
      const g = parseInt(c[1] + c[1], 16);
      const b = parseInt(c[2] + c[2], 16);
      return `rgba(${r},${g},${b},${alpha})`;
    } else if (c.length === 6) {
      const r = parseInt(c.substring(0, 2), 16);
      const g = parseInt(c.substring(2, 4), 16);
      const b = parseInt(c.substring(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return `rgba(30,136,229,${alpha})`;
  }

  // initial center target
  const initRect = canvas.getBoundingClientRect();
  targetX = initRect.width / 2;
  targetY = initRect.height / 2;
  blobX = targetX;
  blobY = targetY;

  // start loop
  requestAnimationFrame(update);
})();
