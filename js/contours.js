/* ============================================================
   等高线背景（独立版，供 GitHub 等页面复用）
   —— 值噪声场持续漂移 + marching squares 画等值线，线条缓慢形变、游动
   固定在窗口上（不随页面滚动），不拦截点击，直接完整显示并流动。
   ============================================================ */
(function () {
  'use strict';

  var cvs = document.getElementById('bgContours');
  if (!cvs || !cvs.getContext) return;

  var doc = document;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var ctx = cvs.getContext('2d');
  var W = 0, H = 0, dpr = 1, GS = 16, cols = 0, rows = 0, vals = null;
  var LEVELS = 15;                                 /* 等值线层数 */
  var raf = 0, t0 = 0, lastDraw = 0, rt = null;

  /* marching squares：格子四角编码（a 左上 / b 右上 / c 右下 / d 左下）→ 要连的两条边
     边的编号：0 上(a-b) / 1 右(b-c) / 2 下(d-c) / 3 左(a-d) */
  var TBL = {
    1:  [3, 0],            2:  [0, 1],            3:  [3, 1],            4:  [1, 2],
    5:  [3, 0, 1, 2],      6:  [0, 2],            7:  [3, 2],            8:  [2, 3],
    9:  [0, 2],           10:  [0, 1, 2, 3],     11:  [1, 2],           12:  [3, 1],
    13: [0, 1],           14:  [3, 0]
  };

  /* 值噪声（整数散列 + 平滑插值），三层叠加成 fbm。 */
  function hash(ix, iy, s) {
    var n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n = n ^ (n >>> 16);
    return (n >>> 0) / 4294967295;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function noise(x, y, s) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var u = smooth(x - ix), v = smooth(y - iy);
    var a = hash(ix, iy, s), b = hash(ix + 1, iy, s);
    var c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }
  function fbm(x, y, s) {
    return noise(x, y, s) * 0.56 +
           noise(x * 2.03, y * 2.01, s + 11.3) * 0.27 +
           noise(x * 4.11, y * 4.07, s + 29.7) * 0.17;
  }

  /* 求某条边上的交点，结果放在 EX / EY */
  var EX = 0, EY = 0;
  function edgePoint(e, x0, y0, x1, y1, lvl, a, b, c, d) {
    if (e === 0)      { EX = x0 + (x1 - x0) * (lvl - a) / (b - a);  EY = y0; }
    else if (e === 1) { EX = x1;                                    EY = y0 + (y1 - y0) * (lvl - b) / (c - b); }
    else if (e === 2) { EX = x0 + (x1 - x0) * (lvl - d) / (c - d);  EY = y1; }
    else              { EX = x0;                                    EY = y0 + (y1 - y0) * (lvl - a) / (d - a); }
  }

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    W = cvs.clientWidth || window.innerWidth;
    H = cvs.clientHeight || window.innerHeight;
    cvs.width  = Math.round(W * dpr);
    cvs.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    GS = W < 640 ? 22 : 16;
    cols = Math.ceil(W / GS) + 2;
    rows = Math.ceil(H / GS) + 2;
    vals = new Float32Array(cols * rows);
  }

  function draw(t) {
    var drift = t * 0.055;                          /* 整体流速 */
    var r, c, v, min = 1e9, max = -1e9;

    ctx.clearRect(0, 0, W, H);

    for (r = 0; r < rows; r++) {
      var y = r * GS, base = r * cols;
      for (c = 0; c < cols; c++) {
        var x = c * GS;
        v = fbm(x * 0.0021 + drift,        y * 0.0021 - drift * 0.55, 7.1) * 0.62 +
            fbm(x * 0.0011 - drift * 0.62, y * 0.0011 + drift * 0.42, 23.4) * 0.38;
        vals[base + c] = v;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }

    var span = (max - min) || 1;

    for (var li = 1; li < LEVELS; li++) {
      var lvl = min + span * (li / LEVELS);
      ctx.beginPath();

      for (r = 0; r < rows - 1; r++) {
        var y0 = r * GS, y1 = y0 + GS;
        var ra = r * cols, rb = (r + 1) * cols;
        for (c = 0; c < cols - 1; c++) {
          var a = vals[ra + c], b = vals[ra + c + 1];
          var cc = vals[rb + c + 1], d = vals[rb + c];
          var mask = (a > lvl ? 1 : 0) | (b > lvl ? 2 : 0) | (cc > lvl ? 4 : 0) | (d > lvl ? 8 : 0);
          if (mask === 0 || mask === 15) continue;

          var x0 = c * GS, x1 = x0 + GS;
          var pairs = TBL[mask];
          for (var k = 0; k < pairs.length; k += 2) {
            edgePoint(pairs[k], x0, y0, x1, y1, lvl, a, b, cc, d);
            var ax = EX, ay = EY;
            edgePoint(pairs[k + 1], x0, y0, x1, y1, lvl, a, b, cc, d);
            ctx.moveTo(ax, ay);
            ctx.lineTo(EX, EY);
          }
        }
      }

      ctx.strokeStyle = (li % 5 === 0) ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.085)';
      ctx.stroke();
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (doc.hidden) return;
    if (now - lastDraw < 30) return;               /* 限到 ~30fps，省电 */
    lastDraw = now;
    draw((now - t0) / 1000);
  }

  function start() {
    size();
    cvs.classList.add('is-on');
    t0 = performance.now();
    if (reduce) { draw(4.2); return; }             /* 少动效：只画一帧静态 */
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      size();
      if (reduce) draw(4.2);
    }, 180);
  });

  start();
})();
