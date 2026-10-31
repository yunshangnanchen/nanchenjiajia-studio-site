/* ============================================================
   ARCHIVE 页 · 图片册
   三排横向长条，贯穿整幅页面宽度；统一高度、宽度按各自比例自然拼接。
   滚动时上、下两排向左走，中间一排向右走 —— 反向才有「错位滑过」的层次。
   进度直接绑在滚动位置上（不做惯性补间）：页面停，图就停。
   ============================================================ */
(function () {
  'use strict';

  var doc = document;
  var sec = doc.getElementById('arcGallery');
  if (!sec) return;

  var stage   = sec.querySelector('.arc-gal-stage');
  var rowsEl  = sec.querySelector('.arc-gal-rows');
  var countEl = doc.getElementById('arcGalCount');
  var data    = window.GALLERY || [];
  if (!stage || !rowsEl || !data.length) return;

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var hasST  = !!(window.gsap && window.ScrollTrigger);

  /* 纵向每滚 1px，横条走动 RATE 个像素。
     2.2 大约是「一格滚轮，图就滑过大半张」的手感，快了会糊、慢了看不出在动。 */
  var RATE = 2.2;

  var rows = [].slice.call(rowsEl.querySelectorAll('.arc-gal-row')).map(function (el) {
    return {
      track: el.querySelector('.arc-gal-track'),
      dir: parseFloat(el.getAttribute('data-dir')) || -1,
      unit: 1
    };
  });

  /* ---------- 1) 拼条：轮流塞进「当前最短的一排」 ----------
     206 张宽窄不一，纯按 i%3 分会有一排比另一排长一成，
     三排就跑出不同速度、上下排慢慢错位；按累计宽度挑最短的一排，
     三排总长差不到一张图，走起来是齐的。 */
  var frags = rows.map(function () { return doc.createDocumentFragment(); });
  var sums  = rows.map(function () { return 0; });

  data.forEach(function (item) {
    var ar = (item.w && item.h) ? item.w / item.h : 1.4;

    var k = 0;
    for (var j = 1; j < sums.length; j++) if (sums[j] < sums[k]) k = j;
    sums[k] += ar;

    var fig = doc.createElement('figure');
    fig.className = 'arc-gal-item';
    fig.style.setProperty('--ar', ar.toFixed(4));   /* 高度统一，宽度 = 行高 × 比例 */

    var img = doc.createElement('img');
    img.alt = item.t || '';
    img.title = item.t || '';
    img.decoding = 'async';
    img.loading = 'lazy';           /* 原生懒加载兜底：即使手动 data-src 逻辑被绕过，浏览器也尽量延后 */
    img.draggable = false;
    img.setAttribute('data-src', item.s);           /* 进视口附近才真正开始下载 */

    fig.appendChild(img);
    frags[k].appendChild(fig);
  });

  rows.forEach(function (row, i) { row.track.appendChild(frags[i]); });

  /* ---------- 1b) 复制一份首尾相接 ----------
     相册只有一屏高，可滚的距离远小于条带全长；不循环的话要么图滑不完，
     要么得把页面撑成五屏（之前的做法）。复制一份之后位移取模就能一直滑，
     克隆的 img 用的是同一个 URL，浏览器走缓存，不会重复下载。 */
  rows.forEach(function (row) {
    var kids = [].slice.call(row.track.children);
    var frag = doc.createDocumentFragment();
    kids.forEach(function (el) { frag.appendChild(el.cloneNode(true)); });
    row.track.appendChild(frag);
  });

  /* ---------- 2) 懒加载：长条有上万像素宽，不能一次性拉 200 张原图 ---------- */
  var figs = [].slice.call(rowsEl.querySelectorAll('.arc-gal-item'));

  function loadOne(fig) {
    var img = fig.firstChild;
    if (!img) return;
    var src = img.getAttribute('data-src');
    if (!src) return;
    img.removeAttribute('data-src');

    function show() { fig.classList.add('is-in'); }

    img.src = src;

    /* 原图动辄两三千像素宽，load 事件只代表字节到齐，真正解码是异步的。
       直接淡入会在画布上停一两帧空白（尤其横向滚得快的时候）。
       先 decode() 拿到一帧再显示，滑过去看到的就是成图。 */
    if (img.decode) img.decode().then(show, show);
    else img.addEventListener('load', show, { once: true });
  }

  if (countEl) countEl.textContent = String(data.length);

  /* ---------- 3) 量长度 ----------
     页面高度不再被这里撑长：相册就是正常的一屏，滚轮走多少全看文档本身。
     unit = 一份内容 + 一个间隔的宽度，位移对 unit 取模就是一次无缝循环。 */
  function measure() {
    sec.style.height = '';              /* 兼容早先把高度写在行内的旧缓存 */

    rows.forEach(function (row) {
      var kids = row.track.children;
      var half = kids.length >> 1;
      var unit = kids[half] ? kids[half].offsetLeft - kids[0].offsetLeft : 0;
      row.unit = Math.max(1, unit);
    });
  }

  /* ---------- 4) 位移：走的距离 = 这一屏已经滚过的像素 × RATE，再对 unit 取模接回开头 ---------- */
  function apply(px) {
    var d = Math.max(0, px) * RATE;

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var m = d % row.unit;                            /* 0 ≤ m < unit，永远不露边 */
      var x = row.dir < 0 ? -m : -row.unit + m;        /* 负数排向左，正数排从第二份滑回第一份 */
      row.track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
    }
  }

  measure();

  var st = null;

  if (hasST && !reduce) {
    gsap.registerPlugin(ScrollTrigger);

    /* 进度不用 0→1，用的是「已经滚过多少像素」：
       相册顶边刚冒出视口时算起（top bottom），一直算到文档滚到底为止。
       没有 pin、没有额外撑出来的滚动长度，页面该多长还是多长。 */
    st = ScrollTrigger.create({
      trigger: sec,
      start: 'top bottom',
      end: 'max',
      onUpdate: function (self) { apply(self.scroll() - self.start); },
      onRefresh: function (self) { apply(self.scroll() - self.start); }
    });

    apply(st ? st.scroll() - st.start : 0);
  } else {
    /* 没有 GSAP / 系统要求减少动效：三排平铺，改成可以自己横向拖 */
    stage.style.position = 'relative';
    rowsEl.classList.add('is-static');
    figs.forEach(loadOne);
  }

  /* ---------- 4b) 相册铺满视口时通知 archive.js 停算粒子 / 等高线 ---------- */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      var e = es[0];
      /* 高度就是一屏，覆盖到八成基本等于整块贴在视口里了 */
      doc.documentElement.classList.toggle('gal-on', e.intersectionRatio > 0.8);
    }, { threshold: [0, 0.8, 1] }).observe(sec);
  }

  /* ---------- 5) 懒加载观察 ---------- */
  if ('IntersectionObserver' in window) {
    /* 纵向留 150%、横向留 600px：条带是用 transform 拖着走的，
       横向不预热的话，快速滚动时新进画面的格子还在下载原图 */
    var io = new IntersectionObserver(function (es) {
      for (var i = 0; i < es.length; i++) {
        if (!es[i].isIntersecting) continue;
        loadOne(es[i].target);
        io.unobserve(es[i].target);
      }
    }, { rootMargin: '150% 600px 150% 600px' });

    figs.forEach(function (f) { io.observe(f); });
  } else {
    figs.forEach(loadOne);
  }

  /* ---------- 6) 尺寸变了重新量（换窗口宽度 / 移动端地址栏收起） ---------- */
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      measure();
      if (st) { st.refresh(); apply(st.progress); }
    }, 200);
  });

  /* 字体、滚动条出现后版面可能差几像素，加载完再量一次 */
  window.addEventListener('load', function () {
    measure();
    if (st) { st.refresh(); apply(st.progress); }
  });
})();
