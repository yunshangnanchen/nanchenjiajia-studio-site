/* ============================================================
   全站漂浮粒子：白色微光点从下往上缓缓浮起
   —— 固定在窗口上（不随页面滚动），黑底处最清晰，不拦截点击
   主页 index.html 与 github.html 共用本文件
   ============================================================ */
(function () {
  const cvs = document.getElementById('bgParticles');
  if (!cvs || !cvs.getContext) return;

  const ctx = cvs.getContext('2d');
  let W = 0, H = 0, dpr = 1, dots = [], raf = null;

  // —— 可调参数 ——
  const DENSITY = 11000;   // 越小粒子越密（每颗平均占多少 CSS 像素）
  const MIN_N   = 60;      // 最少粒子数
  const MAX_N   = 190;     // 最多粒子数
  const SPEED   = 0.34;    // 上浮速度倍率（越大越快）

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cvs.width  = Math.floor(window.innerWidth  * dpr);
    H = cvs.height = Math.floor(window.innerHeight * dpr);
  }

  function makeDot(atBottom) {
    return {
      x: Math.random() * W,
      // 首次播种时铺满整屏；补充的粒子从屏幕下方进场
      y: atBottom ? H + Math.random() * 60 * dpr : Math.random() * H,
      r: (Math.random() * 1.7 + 0.8) * dpr,
      vx: (Math.random() - 0.5) * 0.14 * dpr,          // 极轻微的横向漂移
      vy: -(Math.random() * 0.30 + 0.10) * dpr * SPEED,// 恒定向上
      a: Math.random() * 0.40 + 0.12,                  // 基础亮度
      pa: Math.random() * Math.PI * 2,                 // 呼吸相位
      ps: Math.random() * 0.012 + 0.004                // 呼吸速度
    };
  }

  function seed() {
    const n = Math.max(MIN_N, Math.min(MAX_N, Math.round(W * H / (DENSITY * dpr))));
    dots = [];
    for (let i = 0; i < n; i++) dots.push(makeDot(false));
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < dots.length; i++) {
      const p = dots[i];
      p.x += p.vx;
      p.y += p.vy;
      p.pa += p.ps;

      // 飘出上边界 → 从底部重新进场；左右越界 → 从另一侧绕回
      if (p.y < -12 * dpr) { dots[i] = makeDot(true); continue; }
      if (p.x < -12 * dpr) p.x = W + 12 * dpr;
      if (p.x >  W + 12 * dpr) p.x = -12 * dpr;

      ctx.globalAlpha = Math.max(0.03, p.a + Math.sin(p.pa) * 0.12);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  }

  function start() { if (!raf) tick(); }
  function stop()  { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  resize();
  seed();
  start();

  window.addEventListener('resize', function () { resize(); seed(); });
  // 标签页切到后台时停掉，省电
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
})();
