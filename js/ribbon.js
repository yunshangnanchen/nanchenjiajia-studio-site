/* ============================================================
   封面花带（STUDIO 页 .cover-x）
   ① 滚到这一屏时，两条斜带分别从左 / 右推进渐变遮罩「化」出来（边缘是渐隐，不是硬切）
   ② 鼠标放到某一条带的封面上，这条带平滑减速停住，移开后重新加速
   ③ 两条带用 JS 跑 marquee（替代原来的 CSS animation），这样才能做加减速阻尼
   ============================================================ */
(function () {
  'use strict';

  var root = document.querySelector('.cover-x');
  if (!root) return;

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DAMP = 0.22;          // 加减速时间常数（秒）：越大越拖沓，越小停得越急

  /* ---------- ⓪ 随机封面：每次加载都重新洗牌 ---------- */
  var COVER_DIR = root.getAttribute('data-covers') || 'assets/covers/';
  var PER_BAND  = parseInt(root.getAttribute('data-per-band'), 10) || 24;
  var COVER_MAX = parseInt(root.getAttribute('data-cover-count'), 10) || 48;  // assets/covers/c01.jpg … c48.jpg

  function shuffled() {
    var a = [];
    for (var i = 1; i <= COVER_MAX; i++) {
      a.push(COVER_DIR + 'c' + (i < 10 ? '0' + i : i) + '.jpg');
    }
    for (var j = a.length - 1; j > 0; j--) {          // Fisher–Yates
      var k = Math.floor(Math.random() * (j + 1));
      var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  }

  function fillBand(track, list) {
    if (!track || !list.length) return;
    var html = '';
    for (var i = 0; i < list.length; i++) {
      html += '<img src="' + list[i] + '" alt="" draggable="false" />';
    }
    track.innerHTML = html + html;   // 复制一份接在后面，marquee 才能无缝循环
  }

  // 所有封面放进同一个池子洗牌，两条带各拿走 PER_BAND 张，互不重复
  function dealCovers() {
    var pool = shuffled();
    var n = 0;
    bands.forEach(function (b) {
      var list = [];
      for (var i = 0; i < PER_BAND; i++) {
        list.push(pool[n % pool.length]);
        n++;
      }
      fillBand(b.track, list);
    });
  }

  var bands = [
    { el: root.querySelector('.cx-band--a'), dir: -1, dur: 78 },  // 向左流，节奏同原 78s
    { el: root.querySelector('.cx-band--b'), dir:  1, dur: 92 }   // 向右流，92s
  ].filter(function (b) { return !!b.el; });
  if (!bands.length) return;

  bands.forEach(function (b) {
    b.track = b.el.querySelector('.cx-track');
    b.half = 0;                         // 半个轨道 = 一个完整循环
    b.base = 0;                         // 常规速度 px/s
    b.speed = 0;                        // 当前速度（带阻尼）
    b.hovered = false;
    b.x = b.dir === 1 ? -0.001 : 0;     // 位移，始终落在 (-half, 0]
  });

  function measure() {
    bands.forEach(function (b) {
      if (!b.track) return;
      var w = b.track.scrollWidth;
      if (!w) return;
      b.half = w / 2;
      b.base = b.half / b.dur;          // px/s，与原来 CSS 的 78s / 92s 一致
      if (b.dir === 1 && b.x >= 0) b.x = -b.half;
      if (b.dir === -1 && b.x > 0) b.x = 0;
    });
  }
  dealCovers();                         // 先铺图，再量宽度
  measure();

  /* ---------- ② 悬浮：平滑停 / 平滑走 ---------- */
  function bandOf(node) {
    if (!node || !node.closest) return null;
    var el = node.closest('.cx-band');
    if (!el) return null;
    for (var i = 0; i < bands.length; i++) if (bands[i].el === el) return bands[i];
    return null;
  }

  root.addEventListener('mouseover', function (e) {
    var b = bandOf(e.target);
    if (!b) return;
    bands.forEach(function (x) { x.hovered = (x === b); });
  });

  root.addEventListener('mouseout', function (e) {
    var b = bandOf(e.target);
    if (!b) return;
    if (bandOf(e.relatedTarget) === b) return;   // 只是在这条带内部换了一张封面
    b.hovered = false;
  });

  /* ---------- ③ 逐帧推进 ---------- */
  function tick(time, deltaMs) {
    var dt = Math.min(deltaMs || 16, 64) / 1000;
    var k = 1 - Math.exp(-dt / DAMP);            // 指数阻尼，停/走都不会硬切

    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      if (!b.half || !b.track) continue;

      var target = (b.hovered || REDUCE) ? 0 : b.base;
      b.speed += (target - b.speed) * k;
      if (b.speed < 0.4) b.speed = 0;   // 尾部速度肉眼不可察，直接归零，避免「一直在爬」

      b.x += b.dir * b.speed * dt;
      if (b.x <= -b.half) b.x += b.half;
      if (b.x > 0) b.x -= b.half;

      b.track.style.transform = 'translate3d(' + b.x.toFixed(2) + 'px,0,0)';
    }
  }

  if (window.gsap && window.gsap.ticker) {
    gsap.ticker.add(tick);
  } else {
    var prev = 0;
    (function raf(t) {
      tick(t, t - prev || 16);
      prev = t;
      requestAnimationFrame(raf);
    })(0);
  }

  /* ---------- ① 入场：渐变遮罩从左 / 右推进 ---------- */
  var played = false;

  function dropMask() {
    bands.forEach(function (b) {
      b.el.style.webkitMaskImage = 'none';
      b.el.style.maskImage = 'none';
    });
  }

  function playIn() {
    if (played) return;
    played = true;

    if (REDUCE || !window.gsap) {
      root.classList.remove('cx-anim');
      dropMask();
      return;
    }

    var tl = gsap.timeline({
      onComplete: function () {
        root.classList.remove('cx-anim');
        dropMask();          // 播完撤掉遮罩，不留常驻合成层
      }
    });

    bands.forEach(function (b, i) {
      // --cx-edge 从 -16（完全推出去）走到 100（完全露出）；
      // A 带 90deg 由左往右、B 带 270deg 由右往左，方向在 CSS 里定好
      tl.fromTo(b.el,
        { '--cx-edge': -16 },
        { '--cx-edge': 100, duration: 1.55, ease: 'power3.inOut' },
        i * 0.14);
    });
  }

  function inView() {
    var r = root.getBoundingClientRect();
    return r.top < window.innerHeight * 0.92 && r.bottom > 0;
  }

  if (!REDUCE) root.classList.add('cx-anim');    // 先藏好（CSS 里按这个 class 剪掉）

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { playIn(); break; }
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
    io.observe(root);
  }

  // 兜底：页面打开时花带已经在视口里（比如刷新在中段），或 IO 没触发
  if (inView()) playIn();
  window.addEventListener('scroll', function () {
    if (!played && inView()) playIn();
  }, { passive: true });

  /* ---------- 尺寸变化 ---------- */
  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(measure, 180);
  });
  window.addEventListener('load', measure);   // 图片解码完再量一次更稳

  // 调试/微调用；shuffle() 可手动重新洗牌（控制台执行 NCJRibbon.shuffle()）
  function shuffle() {
    dealCovers();
    bands.forEach(function (b) { b.x = b.dir === 1 ? -0.001 : 0; });
    measure();
  }

  window.NCJRibbon = { bands: bands, measure: measure, playIn: playIn, tick: tick, shuffle: shuffle };
})();
