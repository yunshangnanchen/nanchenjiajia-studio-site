/* ============================================================
   works.js — STUDIO 页「作品图片墙」
   ① 每次加载把图库洗牌，顺序随机；
   ② 每张图按自己的真实宽高比算高度 → 画面完整显示，正常不裁切；
   ③ 横向作品按比例随机跨两列，形成大小错落（瀑布流，最短列优先落位）；
   ④ 列数随容器宽度在 6 / 5 / 4 / 3 / 2 之间切换，尺寸全部实时算；
   ⑤ 滚到视口内逐块上浮（IntersectionObserver，CSS 负责过渡）。
   ============================================================ */
(function () {
  'use strict';

  var root = document.getElementById('works');
  var grid = document.getElementById('worksGrid');
  if (!root || !grid) return;

  var DIR   = root.getAttribute('data-works') || 'assets/works-thumb/';   /* 缩略图目录 */
  var FULL_DIR = 'assets/works/';                                          /* 原图目录（灯箱大图） */
  var COUNT = parseInt(root.getAttribute('data-work-count'), 10) || 84;
  var EXT   = root.getAttribute('data-ext') || 'jpg';

  /* 作品清单（python tools/works-build.py 生成）：缩略图文件名 + 原图文件名 + 像素尺寸。
     有了它就能在图片下载完成前把位置算准，图还能继续懒加载。
     删图后编号有洞也没关系 —— 清单只列实际存在的文件。 */
  var LIST = (window.NCJ_WORKS && window.NCJ_WORKS.length) ? window.NCJ_WORKS : null;

  /* 跨列策略：横向作品才跨，越宽越该跨 —— 1.55 以上必跨，
     1.15~1.55 之间约三分之一跨，避免整版都是大图。 */
  function wantsBig(r) {
    if (r > 1.55) return true;
    if (r >= 1.15) return Math.random() < 0.34;
    return false;
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /* 取文件名里的序号，用作角标 */
  function labelOf(file, fallback) {
    var m = String(file).match(/(\d+)/);
    return m ? m[1] : pad(fallback);
  }

  /* Fisher–Yates 洗牌：返回 0..n-1 的随机序列 */
  function shuffleArr(n) {
    var a = [], i, j, t;
    for (i = 0; i < n; i++) a.push(i);
    for (i = n - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* 列数与间距随容器宽度走 */
  function colsFor(w) {
    if (w >= 1240) return 6;
    if (w >= 1000) return 5;
    if (w >= 760)  return 4;
    if (w >= 520)  return 3;
    return 2;
  }
  function gapFor(w) { return w >= 900 ? 14 : (w >= 620 ? 11 : 8); }

  /* 每项：{ el, ratio, big }  ratio = 宽 / 高 */
  var items = [];

  /* ---------- 按比例排瀑布流 ---------- */
  function layout() {
    var W = grid.clientWidth;
    if (!W || !items.length) return;

    var N = colsFor(W);
    var G = gapFor(W);
    var colW = (W - G * (N - 1)) / N;
    if (colW < 40) return;

    var bottoms = [], i, c;
    for (i = 0; i < N; i++) bottoms.push(0);

    /* 跨列时允许的最大错位：两列高差超过这个值就不跨，宁可退回单列也不留洞 */
    var TOL = Math.min(colW * 0.34, 68);

    for (i = 0; i < items.length; i++) {
      var it = items[i];
      var span = 1, col = 0, top = 0;

      /* 先定最短列 —— 单列和跨列都从它出发，保证不会有哪一列被落下 */
      var c1 = 0;
      for (c = 1; c < N; c++) if (bottoms[c] < bottoms[c1] - 0.5) c1 = c;

      /* 想跨列的作品：只考虑「最短列 + 它的相邻列」这一对，
         两列高差在容差内才真的跨（跨过去会在矮的那列留一个 ≤TOL 的小口子） */
      if (it.big && N >= 3) {
        var best = -1, bestTop = Infinity, bestSpread = Infinity;
        var starts = [];
        if (c1 > 0) starts.push(c1 - 1);
        if (c1 < N - 1) starts.push(c1);
        for (var s = 0; s < starts.length; s++) {
          var cc = starts[s];
          var t = Math.max(bottoms[cc], bottoms[cc + 1]);
          var sp = Math.abs(bottoms[cc] - bottoms[cc + 1]);
          if (sp > TOL) continue;
          if (t < bestTop - 0.5 || (Math.abs(t - bestTop) <= 0.5 && sp < bestSpread)) {
            best = cc; bestTop = t; bestSpread = sp;
          }
        }
        if (best >= 0) { span = 2; col = best; top = bestTop; }
      }

      if (span === 1) { col = c1; top = bottoms[c1]; }

      var w = span === 1 ? colW : colW * 2 + G;
      var h = w / it.ratio;

      /* 极端长图 / 极宽图限高，多出来的裁掉（比例夸张时才会走到这一步） */
      var maxH = colW * (span === 1 ? 2.05 : 1.6);
      var crop = h > maxH;
      if (crop) h = maxH;
      if (it.el.classList.contains('is-crop') !== crop) it.el.classList.toggle('is-crop', crop);

      it.el.style.width  = w.toFixed(2) + 'px';
      it.el.style.height = h.toFixed(2) + 'px';
      it.el.style.left   = (col * (colW + G)).toFixed(2) + 'px';
      it.el.style.top    = top.toFixed(2) + 'px';

      var bottom = top + h + G;
      if (span === 2) { bottoms[col] = bottom; bottoms[col + 1] = bottom; }
      else bottoms[col] = bottom;
    }

    var maxB = 0;
    for (i = 0; i < N; i++) maxB = Math.max(maxB, bottoms[i]);
    grid.style.height = Math.max(0, maxB - G).toFixed(2) + 'px';
  }

  var lt = null;
  function scheduleLayout() {
    clearTimeout(lt);
    lt = setTimeout(layout, 80);
  }

  /* ---------- 入场 ---------- */
  var io = null;
  var left = 0;

  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
          left = Math.max(0, left - 1);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.02 });
  }

  /* 兜底扫描：少数环境（旧 WebView、部分无头环境）IntersectionObserver
     不一定按预期回调，滚动时再按位置补一次，保证图片不会一直隐形。 */
  function sweep() {
    if (!left) return;
    var els = grid.children;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.classList.contains('is-in')) continue;
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.96 && r.bottom > 0) {
        el.classList.add('is-in');
        if (io) io.unobserve(el);
        left--;
      }
    }
  }
  var st = null;
  function onScroll() {
    clearTimeout(st);
    st = setTimeout(sweep, 60);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- 注入图片 ---------- */
  function build() {
    var total = LIST ? LIST.length : COUNT;
    var order = shuffleArr(total);
    var frag = document.createDocumentFragment();
    items = [];

    for (var i = 0; i < order.length; i++) {
      var rec  = LIST ? LIST[order[i]] : null;
      var file = rec ? rec.f : ('w' + pad(order[i] + 1) + '.' + EXT);
      var full = rec && rec.full ? (FULL_DIR + rec.full) : null;   /* 原图大图路径 */
      var title = rec && rec.t ? rec.t : '';
      var ratio = rec ? (rec.w / rec.h) : 1;
      var label = labelOf(file, order[i] + 1);

      var fig = document.createElement('figure');
      fig.className = 'work';
      fig.style.setProperty('--d', ((i % 12) * 0.045).toFixed(3) + 's');
      if (full) fig.setAttribute('data-full', full);
      if (title) fig.setAttribute('data-title', title);
      fig.tabIndex = 0;

      var img = document.createElement('img');
      img.alt = '作品 ' + label;
      img.decoding = 'async';
      img.loading = 'lazy';            /* 位置已经排好，图片慢慢来 */
      img.src = DIR + file;

      var no = document.createElement('span');
      no.className = 'work-no';
      no.textContent = label;

      fig.appendChild(img);
      fig.appendChild(no);
      frag.appendChild(fig);

      items.push({
        el: fig,
        img: img,
        ratio: ratio,
        known: !!rec,                  /* 清单里有比值就不用等下载 */
        big: false,
        full: full,
        title: title
      });
    }

    grid.innerHTML = '';
    grid.appendChild(frag);

    var cnt = document.getElementById('worksCount');
    if (cnt) cnt.textContent = total;

    /* 有清单就直接排；个别没登记的图下载完再补一次 */
    var ready = false;

    function finish() {
      if (ready) return;
      ready = true;
      for (var k = 0; k < items.length; k++) {
        items[k].big = wantsBig(items[k].ratio);
      }
      layout();
      grid.classList.add('is-js');
      left = items.length;
      for (var m = 0; m < items.length; m++) {
        if (io) io.observe(items[m].el);
        else items[m].el.classList.add('is-in');
      }
      sweep();
      window.NCJWorks.ready = true;
    }

    finish();

    /* 清单缺失的图：等它下载完，按真实比例重排一次 */
    for (var j = 0; j < items.length; j++) {
      (function (it) {
        if (it.known) return;
        it.img.addEventListener('load', function () {
          var nw = it.img.naturalWidth, nh = it.img.naturalHeight;
          if (!nw || !nh || it.known) return;
          it.known = true;
          it.ratio = nw / nh;
          it.big = wantsBig(it.ratio);
          scheduleLayout();
        });
      })(items[j]);
    }
  }

  window.NCJWorks = { rebuild: build, layout: layout, ready: false };

  build();

  /* ============================================================
     灯箱：点击缩略图 → 显示原图大图；滚轮切换；顶部标题；点空白关闭
     ============================================================ */
  var lightbox = null;

  function buildLightbox() {
    if (lightbox) return lightbox;
    var lb = document.createElement('div');
    lb.className = 'work-lb';
    lb.setAttribute('aria-hidden', 'true');

    lb.innerHTML =
      '<div class="work-lb-head">' +
        '<span class="work-lb-title">YUNA ゆうな</span>' +
        '<span class="work-lb-sub">Excellent illustration</span>' +
      '</div>' +
      '<div class="work-lb-stage">' +
        '<img class="work-lb-img" alt="" />' +
      '</div>';

    document.body.appendChild(lb);
    lightbox = lb;
    return lb;
  }

  var lbIdx = -1;       /* 当前灯箱显示的 items 下标 */
  var lbOpen = false;

  function openLightbox(idx) {
    var it = items[idx];
    if (!it || !it.full) return;
    buildLightbox();
    lbIdx = idx;
    showLightboxItem();
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    lbOpen = true;
    document.body.classList.add('lb-on');
  }

  function showLightboxItem() {
    if (!lightbox || lbIdx < 0) return;
    var it = items[lbIdx];
    var img = lightbox.querySelector('.work-lb-img');
    img.src = it.full;
    img.alt = it.title || '作品';
  }

  function closeLightbox() {
    if (!lbOpen) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    lbOpen = false;
    document.body.classList.remove('lb-on');
  }

  function lbNext(delta) {
    if (!lbOpen) return;
    var n = items.length;
    lbIdx = (lbIdx + delta + n) % n;
    showLightboxItem();
  }

  /* 点击缩略图打开灯箱（事件委托到 grid） */
  grid.addEventListener('click', function (e) {
    var fig = e.target.closest('.work');
    if (!fig) return;
    var full = fig.getAttribute('data-full');
    if (!full) return;
    /* 找这个 fig 在 items 里的下标 */
    for (var k = 0; k < items.length; k++) {
      if (items[k].el === fig) { openLightbox(k); break; }
    }
  });

  /* 滚轮切换图片（节流：连续滚动只切一次，等滚轮停稳再响应下一次） */
  var lbWheelLock = false;
  window.addEventListener('wheel', function (e) {
    if (!lbOpen) return;
    e.preventDefault();
    if (lbWheelLock) return;
    lbWheelLock = true;
    var delta = e.deltaY > 0 ? 1 : -1;
    lbNext(delta);
    setTimeout(function () { lbWheelLock = false; }, 260);
  }, { passive: false });

  /* 点击空白（灯箱背景/舞台）关闭 */
  lightbox = buildLightbox();
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox || e.target.classList.contains('work-lb-stage')) {
      closeLightbox();
    }
  });

  /* ESC 关闭 */
  window.addEventListener('keydown', function (e) {
    if (!lbOpen) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') lbNext(1);
    else if (e.key === 'ArrowLeft') lbNext(-1);
  });

  /* ---------- 视口变化：重新排 ---------- */
  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (window.NCJWorks.ready) layout();
      onScroll();
    }, 160);
  });

  /* 容器自身宽度变了也要重排（滚动条出现/消失、字体回流、父级 max-width 变化
     这类情况不一定触发 window.resize，光靠 resize 会留下错位的旧坐标） */
  if ('ResizeObserver' in window) {
    var lastW = 0;
    var ro = new ResizeObserver(function () {
      if (!window.NCJWorks.ready) return;
      var w = grid.clientWidth;
      if (Math.abs(w - lastW) < 0.5) return;
      lastW = w;
      scheduleLayout();
    });
    ro.observe(grid);
  }

  window.addEventListener('load', function () {
    setTimeout(function () {
      if (window.NCJWorks.ready) layout();
      sweep();
    }, 140);
  });
})();
