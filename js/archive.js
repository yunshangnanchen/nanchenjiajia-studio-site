/* ============================================================
   ARCHIVE 页：文字打字入场 → 等高线背景 + 粒子 logo
   ① 三行文字居中、逐字打出（原文写在 data-type 上，无 JS 时也能看到），
      每个字配一声 Web Audio 合成的老式打字机响，大标题打完打一次回车铃；
      最后一行打完，联系方式按钮浮上来；
   ② 整块左移左对齐的同时，等高线从右往左擦出：值噪声场持续漂移，
      marching squares 画等值线，所以线条一直在缓慢形变、游动（不是循环动画）；
   ③ logo.svg 被光栅化后按固定网格采样（上下左右对齐、同色同尺寸），
      粒子从四周飞入拼成 logo；就位后每颗点以格子中心为原点轻轻晃动。
      鼠标扫过时，按「指针走过的那条轨迹」施加斥力（明日方舟那套速度+弹簧物理），
      点被甩向两侧、靠惯性滑一段再荡回原位。
   ============================================================ */
(function () {
  'use strict';

  var doc = document;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var hasGsap = typeof window.gsap !== 'undefined';

  var logoCvs = doc.getElementById('arcLogo');
  var logoImg = doc.getElementById('arcLogoImg');
  var typeEls = [].slice.call(doc.querySelectorAll('.arc-type'));
  var socialEl = doc.querySelector('.arc-social');

  /* ============================================================
     0) 打字机音效（Web Audio 现场合成，不加载任何音频文件）
     · 铅字击打：一段带通白噪 + 高频高通，几毫秒内衰减 → 「嗒」
     · 字杆回弹：一段下滑的三角波 → 闷闷的「笃」
     · 回车铃：两个正弦音，长衰减（只在大标题打完时响一次）
     浏览器不允许无手势出声：打字开始先尝试 resume，不行就等用户第一次点/按键唤醒，
     没唤醒就安静跳过 —— 不报错、不打扰。
     ============================================================ */
  function createTypist() {
    var AC = window.AudioContext || window.webkitAudioContext;
    var api = { clack: function () {}, bell: function () {}, unlock: function () {} };
    if (!AC) return api;

    var ctx = null, master = null, noiseBuf = null;

    function build() {
      if (ctx) return ctx;
      try { ctx = new AC(); } catch (e) { return null; }
      var g = ctx.createGain();
      g.gain.value = 0.15;                        /* 整体很轻，只是「背景里有台打字机」 */
      g.connect(ctx.destination);
      master = g;

      var len = Math.floor(ctx.sampleRate * 0.2);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return ctx;
    }

    /* 没真正 running 就别排声音，否则 resume 之前排的会一起堆出来 */
    function ready() {
      if (!build()) return false;
      if (ctx.state === 'running') return true;
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      return false;
    }

    api.unlock = function () {
      if (!build()) return;
      if (ctx.state !== 'running') { try { ctx.resume(); } catch (e) {} }
    };

    api.clack = function (level) {
      if (!ready()) return;
      try {                                          /* 音频出岔子也绝不能拖垮打字动画 */
      level = level || 1;
      var t = ctx.currentTime + 0.001 + Math.random() * 0.005;

      /* 1) 铅字击打 */
      var src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.playbackRate.value = 0.85 + Math.random() * 0.4;

      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2000 + Math.random() * 1600;
      bp.Q.value = 1.3;

      var hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 800;

      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime((0.42 + Math.random() * 0.3) * level, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.05);

      src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(master);
      src.start(t); src.stop(t + 0.09);

      /* 2) 字杆落下的闷响 */
      var o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(210 + Math.random() * 50, t);
      o.frequency.exponentialRampToValueAtTime(92, t + 0.05);

      var g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.linearRampToValueAtTime(0.11 * level, t + 0.004);
      g2.gain.exponentialRampToValueAtTime(0.0004, t + 0.06);

      o.connect(g2); g2.connect(master);
      o.start(t); o.stop(t + 0.08);
      } catch (e) {}
    };

    api.bell = function () {
      if (!ready()) return;
      try {
      var t = ctx.currentTime + 0.005;
      [1318.5, 1975.5].forEach(function (f, i) {
        var o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.07 / (i + 1), t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0003, t + 0.9);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + 0.95);
      });
      } catch (e) {}
    };

    /* 第一次点 / 按键 / 触摸时唤醒音频上下文（播放期间也能救回来） */
    function wake() {
      api.unlock();
      doc.removeEventListener('pointerdown', wake, true);
      doc.removeEventListener('keydown', wake, true);
      doc.removeEventListener('touchstart', wake, true);
    }
    doc.addEventListener('pointerdown', wake, true);
    doc.addEventListener('keydown', wake, true);
    doc.addEventListener('touchstart', wake, true);

    return api;
  }

  var typist = createTypist();


  /* ============================================================
     1) 打字
     ============================================================ */
  function buildChars(el) {
    var text = el.getAttribute('data-type') || el.textContent || '';
    el.textContent = '';
    var frag = doc.createDocumentFragment();
    var chars = [];
    for (var i = 0; i < text.length; i++) {
      var s = doc.createElement('span');
      s.className = 'arc-ch';
      s.textContent = text.charAt(i);
      frag.appendChild(s);
      chars.push(s);
    }
    el.appendChild(frag);
    return chars;
  }

  /* ---------- 三个阶段用到的元素 ---------- */
  var pageEl  = doc.querySelector('.archive-page');
  var textEl  = doc.querySelector('.arc-text');
  var ruleEl  = doc.querySelector('.arc-rule');
  var flipEls = typeEls.concat(ruleEl ? [ruleEl] : []);    /* 左移时逐行做位移动画的元素 */
  /* 四个联系按钮单独排队：不跟文字共用一条时间线，各走各的 */
  var socEls  = socialEl ? [].slice.call(socialEl.children) : [];
  var rowEls  = typeEls.map(function (el) { return el.parentNode; })
                .concat(ruleEl ? [ruleEl] : []);          /* 上滑入场的整行 */
  var RISE    = 46;                                        /* 上滑入场的起始位移 */
  var centered = false;

  /* 居中对齐时把整块横向挪到页面中线上（只是 transform，不改布局，
     所以标题的字号不会因为列宽变化而跳动） */
  function centerX() {
    gsap.set(textEl, { x: 0 });
    var r = textEl.getBoundingClientRect();
    gsap.set(textEl, { x: window.innerWidth / 2 - (r.left + r.width / 2) });
  }

  /* 说明：每个字是提前排好位、只把不透明度从 0 打开（见 .arc-ch），
     所以整行的宽度在打字过程中一直不变 —— 居中的这行不会随着出字左右跳。 */
  function stageCenter() {
    if (!hasGsap || reduce) return;                        /* 静态模式直接按最终版式显示 */
    pageEl.classList.add('arc-center');
    centered = true;
    centerX();
  }
  window.addEventListener('resize', function () {
    if (centered) centerX();
  });

  /* 光标：每帧跟着「已经打出来的最后一个字」跑 */
  var carets = [];
  function syncCarets() {
    for (var i = 0; i < carets.length; i++) {
      var o = carets[i];
      if (!o.el.classList.contains('is-typing')) continue;
      var kids = o.el.children, last = null;
      for (var k = kids.length - 1; k >= 0; k--) {
        var ch = kids[k];
        if (ch === o.caret) continue;
        if (parseFloat(window.getComputedStyle(ch).opacity) > 0.45) { last = ch; break; }
      }
      o.caret.style.left = (last ? last.offsetLeft + last.offsetWidth : 0) + 'px';
    }
  }

  function runTyping(done) {
    stageCenter();

    if (!hasGsap || reduce) {                        /* 没 GSAP / 开了「减弱动效」：直接显示 */
      typeEls.forEach(function (el) {
        buildChars(el);
        el.classList.add('is-done');
        var cs = el.querySelectorAll('.arc-ch');
        for (var i = 0; i < cs.length; i++) cs[i].style.opacity = 1;
      });
      if (socialEl) socialEl.classList.add('is-in');
      done();
      return null;
    }

    typist.unlock();                                 /* 能出声就先出声，出不了就等第一次交互 */

    var tl = gsap.timeline({
      delay: 0.3,
      onComplete: function () {
        gsap.ticker.remove(syncCarets);
        done();
      }
    });

    /* 一行一段：先整行从下方滑上来（透明度同时跟上），再逐字打出；
       最后那条细线自己滑入，不参与打字 */
    var seq = typeEls.map(function (el, i) { return { type: el, row: el.parentNode, idx: i }; });
    if (ruleEl) seq.push({ type: null, row: ruleEl, idx: -1 });

    var at = 0;

    seq.forEach(function (item, i) {
      var last = i === seq.length - 1;

      tl.fromTo(item.row,
        { y: RISE, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' },
        at);

      var seg;

      if (item.type) {
        var chars = buildChars(item.type);
        var big = item.type.classList.contains('arc-type--xl');
        var st = big ? 0.075 : (item.idx === 0 ? 0.026 : 0.042);

        var caret = doc.createElement('i');
        caret.className = 'arc-caret';
        item.type.appendChild(caret);
        carets.push({ el: item.type, caret: caret });

        var start = at + 0.14;
        var typeDur = st * Math.max(chars.length - 1, 0) + 0.01;

        /* 光标等第一个字出来才亮，否则上滑阶段会悬着一根空竖线 */
        tl.call(function () { item.type.classList.add('is-typing'); }, null, start);
        tl.to(chars, { opacity: 1, duration: 0.01, ease: 'none', stagger: st }, start);

        /* 每个字配一声打字机：大标题更沉，空格轻一点 */
        for (var ci = 0; ci < chars.length; ci++) {
          (function (ch) {
            var lv = ch === ' ' ? 0.5 : (big ? 1 : 0.78);
            tl.call(function () { typist.clack(lv); }, null, start + ci * st);
          })(chars[ci].textContent);
        }

        tl.call(function () {
          item.type.classList.remove('is-typing');
          item.type.classList.add('is-done');
        }, null, start + typeDur);

        if (big) tl.call(typist.bell, null, start + typeDur + 0.04);   /* 一行打完，回车铃 */

        seg = Math.max(0.7, 0.14 + typeDur) + 0.12;
      } else {
        seg = 0.7;
      }

      /* 下一行提前一点起，三行才不至于像排队 —— 重叠量小于行尾停顿，
         不会出现两条光标同时闪 */
      at += last ? seg : Math.max(seg - 0.15, 0.55);
      if (last) tl.to({}, { duration: 0.1 }, at);      /* 收尾留一点呼吸 */
    });

    /* 联系方式在最后一句打完之后浮上来，然后才整块左移 */
    if (socialEl) {
      tl.fromTo(socialEl,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.65, ease: 'power3.out' }, at + 0.02);
    }

    gsap.ticker.add(syncCarets);
    syncCarets();
    return tl;
  }

  /* ---------- 阶段 2：整块向左，同时每行各自变左对齐 ----------
     用 FLIP：先把「居中时」每个元素的位置记下来，切到最终版式后再量一次，
     把差值写成 transform 反向抵消，然后一起回 0 —— 于是每行都从自己的
     居中位置滑到左对齐的位置，跨度不同，看着像三行一起向左散开。
     等高线就在这一刻开始出现：从右往左擦出，像是文字把身后的空间让了出来。 */
  function shiftLeft(done) {
    if (!hasGsap || reduce || !centered) {
      centered = false;
      if (pageEl) pageEl.classList.remove('arc-center');
      if (hasGsap) gsap.set(textEl, { x: 0 });
      done();
      return;
    }

    revealed = true;
    /* logo 不等左移完全停稳：走到一半就开始聚点，两个动势才连得上 */
    gsap.delayedCall(0.52, function () { if (logo) logo.start(); });

    var before = flipEls.map(function (el) { return el.getBoundingClientRect(); });
    var beforeSoc = socEls.map(function (el) { return el.getBoundingClientRect(); });

    centered = false;
    gsap.set(textEl, { x: 0 });
    pageEl.classList.remove('arc-center');
    void textEl.offsetWidth;                     /* 强制回流，拿到左对齐后的最终位置 */

    var after = flipEls.map(function (el) { return el.getBoundingClientRect(); });
    var afterSoc = socEls.map(function (el) { return el.getBoundingClientRect(); });

    for (var i = 0; i < flipEls.length; i++) {
      gsap.set(flipEls[i], {
        x: before[i].left - after[i].left,
        y: before[i].top - after[i].top
      });
    }

    gsap.to(flipEls, {
      x: 0,
      y: 0,
      duration: 0.95,
      ease: 'power3.inOut',
      stagger: 0.055,
      onComplete: done
    });

    /* 四个按钮各走各的：位移量一样（整排都要过去），
       但起始时间和时长都错开 —— 一颗一颗落位，不是整排被一起搬走。
       错峰控制得小一点（0.06s），否则中途会拉得太散、像被甩开。 */
    for (var s = 0; s < socEls.length; s++) {
      gsap.set(socEls[s], {
        x: beforeSoc[s].left - afterSoc[s].left,
        y: beforeSoc[s].top - afterSoc[s].top
      });
      gsap.to(socEls[s], {
        x: 0,
        y: 0,
        duration: 1.05,
        ease: 'power2.inOut',
        delay: 0.04 + s * 0.05
      });
    }
  }

  /* ============================================================
     3) 粒子 logo
     ============================================================ */
  function createLogo(cvs, img) {
    if (!cvs || !cvs.getContext || !img) return null;

    var ctx = cvs.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var pts = [];                                     /* 规整网格上的点：同一个颜色、同一个尺寸 */
    var ready = false, playing = false, raf = 0, t0 = 0, rt = null, tainted = false;
    /* STEP 是格子边长（CSS px），密度 ≈ 1 / STEP²；
       这一版又稀一档，窗口变化时在 sample() 里重算 */
    var PSIZE = 3.0, STEP = 8;
    var DUR = 1.45;                                  /* 飞入用时（秒） */
    var pointer = { x: -9999, y: -9999, on: false };
    /* ---------- 粒子物理：照搬 Arknights-FlowingPoints-main 的模型 ----------
       斥力 force = [(R - d) / R]² × FORCE，沿「刀线 → 粒子」的方向加在速度上；
       速度每帧乘 (1 - FRICTION)，同时被一根弹簧往回拉（RETURN）。
       粒子是被「甩」出去的，靠惯性滑一段再自己荡回来 —— 散度就是这么来的，
       直接改位置（推多少回多少）永远只是一小块凹陷。

       括号里是参考项目的原值，这边为了「划过的散度更大」都往上抬了：
         R       105 -> 130   （作用半径，影响受影响的宽度）
         FORCE   1.8 -> 3.0   （斥力强度，影响甩出去多远）
         FRICTION 0.15 -> 0.12（阻尼越小滑得越远）
         RETURN  0.01 -> 0.018（回位弹簧，兼顾问过的「半秒左右归位」）
       实测：一刀划过去最大位移 ~59px、平均 7.9px、300 个点甩出 8px 以上，
       0.5 秒内基本回位。 */
    var R = 130, FORCE = 3.0, FRICTION = 0.12, RETURN = 0.018;
    var VMAX = 34;                                    /* 速度上限（px/帧），极快划动时不飞出画面 */
    /* 刀身剖面：沿轨迹方向是一个纺锤 —— 刀尖（指针处）细，往后 30% 处最厚，
       再往后渐渐收薄。所以划痕是「中间厚、两头薄」的一道，而不是等宽的沟 */
    var BLADE = 230, BLADE_HOT = 0.30, TIP_W = 30;

    /* 刀身剖面：sBack 是这一点离刀尖（指针）多远，返回 0~1 的强度 */
    function bladeW(sBack) {
      var q = sBack / BLADE;
      var env = 0;
      if (q < 1) {
        env = q < BLADE_HOT ? q / BLADE_HOT : (1 - q) / (1 - BLADE_HOT);
        env = env * env * (3 - 2 * env);             /* 两头过渡软一点，别出现折角 */
        env = Math.pow(env, 1.35);                   /* 再压一压：两头更尖、中间更厚 */
      }
      /* 刀尖补一点压力：鼠标停住不动时也还有一处小的切口，不会完全没反应 */
      var tip = Math.exp(-sBack / TIP_W) * 0.45;
      return tip > env ? tip : env;
    }
    /* 指针轨迹：划过的每一段留 0.7 秒推力，痕迹是「走过的路径」而不是
       「当前鼠标下的一个圆」——这才是刀划过去的那道沟 */
    var trail = [], TRAIL_LIFE = 0.7, TRAIL_STEP = 8, TRAIL_MAX = 44;
    var ptW = [];                                    /* 每个轨迹点当帧的刀身权重，每帧重算一次 */
    var lastT = 0;

    function fail() {                                /* 采不到点（比如 file:// 画布被污染）就退回 SVG */
      cvs.style.display = 'none';
      if (logoImg) logoImg.classList.add('is-shown');
    }

    function sample() {
      var w = cvs.clientWidth, h = cvs.clientHeight;
      if (!w || !h) return false;

      var mob = window.innerWidth < 720;
      PSIZE = mob ? 2.4 : 3.0;
      STEP  = mob ? 6 : 8;

      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = w; H = h;
      cvs.width  = Math.round(w * dpr);
      cvs.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var off = doc.createElement('canvas');
      off.width = cvs.width;
      off.height = cvs.height;
      var octx = off.getContext('2d');

      var nw = img.naturalWidth || 810.71, nh = img.naturalHeight || 369.26;
      var ir = nw / nh, br = w / h, dw, dh;
      if (ir > br) { dw = w; dh = w / ir; } else { dh = h; dw = h * ir; }

      /* 把图形对齐到格子：居中偏移取整到 STEP 的整数倍，
         采样点与图形边缘共用一套栅格，点阵的边界才是齐的 */
      var ox = Math.round((w - dw) / 2 / STEP) * STEP;
      var oy = Math.round((h - dh) / 2 / STEP) * STEP;
      octx.drawImage(img, ox * dpr, oy * dpr, dw * dpr, dh * dpr);

      var data;
      try {
        data = octx.getImageData(0, 0, off.width, off.height).data;
      } catch (err) {
        tainted = true;                              /* 画布被污染，退回 SVG */
        return false;
      }

      /* 逐格取样：采样点都落在 STEP 的整数倍上 → 上下左右严格对齐的行列，
         每格最多一个点，所以不会出现随机疏密和大小差异 */
      pts = [];
      trail = [];                                    /* 画布尺寸变了，旧轨迹的坐标作废 */
      for (var gy = 0; gy < h; gy += STEP) {
        var rowBase = Math.round(gy * dpr) * off.width;
        for (var gx = 0; gx < w; gx += STEP) {
          var idx = (rowBase + Math.round(gx * dpr)) * 4;
          if (data[idx + 3] <= 120) continue;

          /* 起点：logo 四周的一圈「云」，飞入时错峰 */
          var ang = Math.random() * Math.PI * 2;
          var rad = (0.52 + Math.random() * 0.6) * Math.max(W, H);

          pts.push({
            tx: gx, ty: gy,
            sx: W / 2 + Math.cos(ang) * rad,
            sy: H / 2 + Math.sin(ang) * rad * 0.6,
            ox: 0, oy: 0,                            /* 相对格点的位移 */
            vx: 0, vy: 0,                            /* 位移的速度（px/帧，参考项目的 vx/vy） */
            d: (gx / W) * 0.42 + Math.random() * 0.14,
            /* 原地微晃：以格子中心为原点，两个不同频率的正弦叠加，
               每颗点的相位/频率/幅度都不同，看起来像整片在轻轻呼吸 */
            a: 0.7 + Math.random() * 0.7,             /* 幅度（CSS px） */
            f1: 0.34 + Math.random() * 0.45,
            f2: 0.51 + Math.random() * 0.62,
            p1: Math.random() * Math.PI * 2,
            p2: Math.random() * Math.PI * 2
          });
        }
      }

      ready = pts.length > 0;
      return ready;
    }

    function render(t) {
      /* 系数按秒归一：高刷屏 120Hz 上每帧的步长要减半，否则同一套参数会快一倍 */
      var dt = t - lastT;
      lastT = t;
      if (dt < 0.004) dt = 0.004;
      else if (dt > 0.05) dt = 0.05;
      var f60 = dt * 60;
      var damp = Math.pow(1 - FRICTION, f60);        /* 每帧能量衰减（friction 0.15）*/
      var kRet = RETURN * f60;                       /* 回位弹簧：速度 += 位移 × RETURN */

      ctx.clearRect(0, 0, W, H);
      ctx.beginPath();

      /* 参与推力的线段数：鼠标在画布边内时把「最后一点 → 当前指针」也算一段，
         所以停着不动就是一处圆形的压力点，划动起来才成一条沟 */
      var nSeg = trail.length ? (pointer.on ? trail.length : trail.length - 1) : 0;

      /* 整条轨迹的包围盒：离刀口很远的点整个跳过，省掉逐段的距离计算
         （点阵近千个、段二十来段，不筛的话每帧是两万多次开方） */
      var bx0 = 0, bx1 = 0, by0 = 0, by1 = 0;
      if (nSeg > 0) {
        bx0 = bx1 = trail[0].x;
        by0 = by1 = trail[0].y;
        for (var bi = 1; bi < trail.length; bi++) {
          if (trail[bi].x < bx0) bx0 = trail[bi].x;
          if (trail[bi].x > bx1) bx1 = trail[bi].x;
          if (trail[bi].y < by0) by0 = trail[bi].y;
          if (trail[bi].y > by1) by1 = trail[bi].y;
        }
        if (pointer.on) {
          if (pointer.x < bx0) bx0 = pointer.x;
          if (pointer.x > bx1) bx1 = pointer.x;
          if (pointer.y < by0) by0 = pointer.y;
          if (pointer.y > by1) by1 = pointer.y;
        }
        bx0 -= R; bx1 += R; by0 -= R; by1 += R;
      }

      /* 每个轨迹点当帧的刀身权重（0~1）。
         剖面以「刀尖」（指针所在处）为原点往后展开：刀尖细 → 30% 处最厚 →
         BLADE 处收成 0。点在段内按 s 线性插值，缝的边界才是光滑的曲线，
         不会因为「每颗点落在不同段上」而抖成锯齿 */
      if (nSeg > 0) {
        var lastIdx = trail.length - 1;
        for (var pi = 0; pi <= lastIdx; pi++) {
          var sB = (lastIdx - pi) * TRAIL_STEP;
          var ag = t - trail[pi].t;
          /* 只按寿命判死（0.7 秒），不再乘时间衰减 —— 否则刀身最厚的那一段
             （离刀尖七十多像素、也就是最老的那几段）会被衰减压掉一半，
             缝反而粗细不匀 */
          ptW[pi] = ag >= TRAIL_LIFE ? 0 : bladeW(sB);
        }
        ptW[lastIdx + 1] = pointer.on ? bladeW(0) : 0;   /* 指针那一点＝刀尖 */
      }

      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        var e = (t - p.d) / DUR;
        e = e <= 0 ? 0 : (e >= 1 ? 1 : e);
        e = 1 - Math.pow(1 - e, 3);                  /* easeOutCubic */

        /* 粒子此刻的真实位置（格点 + 已经跑出去的位移） */
        var ax = p.tx + p.ox, ay = p.ty + p.oy;

        /* 斥力：参考项目的 force = [(R - d) / R]² × FORCE，
           只把 d 换成「到刀线（指针走过的那条轨迹）的最近距离」，
           方向由刀线上的最近点指向粒子 —— 点被推向刀口两侧，
           划过去是一条沟，而不是鼠标底下一个圆洞 */
        var fx = 0, fy = 0;
        if (nSeg > 0 && ax > bx0 && ax < bx1 && ay > by0 && ay < by1) {
          var bestQ = 1e9, bestW = 0, bestX = 0, bestY = 0;
          for (var si = nSeg - 1; si >= 0; si--) {
            var wa = ptW[si], wb = ptW[si + 1];
            if ((wa > wb ? wa : wb) <= 0.02) continue;
            var a = trail[si];
            var b = (si + 1 < trail.length) ? trail[si + 1] : pointer;

            var ex = b.x - a.x, ey = b.y - a.y;
            var el = ex * ex + ey * ey;
            var u = 0;
            if (el > 0.01) {
              u = ((ax - a.x) * ex + (ay - a.y) * ey) / el;
              u = u < 0 ? 0 : (u > 1 ? 1 : u);
            }
            var ddx = ax - (a.x + ex * u);
            var ddy = ay - (a.y + ey * u);
            var dd2 = ddx * ddx + ddy * ddy;
            if (dd2 >= R * R) continue;

            if (dd2 < bestQ) {                       /* 取最近的一段（段内插值，边界才连续） */
              bestQ = dd2;
              bestW = wa + (wb - wa) * u;
              bestX = ddx; bestY = ddy;
            }
          }

          if (bestQ < R * R && bestQ > 0.0001) {
            var dd = Math.sqrt(bestQ);
            var ratio = (R - dd) / R;
            var ff = ratio * ratio * FORCE * bestW;
            fx = (bestX / dd) * ff;
            fy = (bestY / dd) * ff;
          }
        }

        /* 力 → 速度（惯性）→ 位移（阻尼），中间再挂一根回位弹簧。
           这就是参考项目的 update()：被推开后靠惯性继续滑，再自己荡回去 */
        p.vx += fx * f60;
        p.vy += fy * f60;
        p.vx -= p.ox * kRet;
        p.vy -= p.oy * kRet;
        p.vx *= damp;
        p.vy *= damp;

        var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (sp > VMAX) {                             /* 极快划动时别飞出画面 */
          var sc = VMAX / sp;
          p.vx *= sc; p.vy *= sc;
        }

        p.ox += p.vx * f60;
        p.oy += p.vy * f60;

        /* 原地微晃，飞入阶段按进度淡入，免得边飞边抖 */
        var swayX = Math.sin(t * p.f1 + p.p1) * p.a * e;
        var swayY = Math.cos(t * p.f2 + p.p2) * p.a * e;

        /* 落点对齐到设备像素：dpr=1 时是整像素方块，dpr=2 时是半像素步进 */
        var px = Math.round((p.sx + (p.tx - p.sx) * e + p.ox + swayX - PSIZE / 2) * dpr) / dpr;
        var py = Math.round((p.sy + (p.ty - p.sy) * e + p.oy + swayY - PSIZE / 2) * dpr) / dpr;
        ctx.rect(px, py, PSIZE, PSIZE);
      }

      ctx.fillStyle = 'rgba(255,255,255,.92)';       /* 所有点同一个颜色 */
      ctx.fill();
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (doc.hidden) return;
      /* 图片册占满视口时 logo 已经滚出画面，别再算这一千个点的物理 */
      if (doc.documentElement.classList.contains('gal-on')) return;
      render((now - t0) / 1000);
    }

    function start() {
      if (playing) return;
      if (!ready && !sample()) {
        /* 画布还没显示出来（宽度为 0）不算失败；只有真的采不到点才退回 SVG */
        if (tainted || cvs.clientWidth) fail();
        return;
      }
      playing = true;
      if (cvs.parentNode) cvs.parentNode.classList.add('is-on');
      t0 = performance.now();
      if (reduce) { render(6); return; }             /* 少动效：直接到位，不跑循环 */
      raf = requestAnimationFrame(frame);
    }

    img.addEventListener('error', fail);
    if (img.complete && img.naturalWidth) { if (!sample() && tainted) fail(); }
    else img.addEventListener('load', function () { if (!sample() && tainted) fail(); });

    window.addEventListener('pointermove', function (e) {
      if (!playing) return;
      var r = cvs.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.on = pointer.x > -R && pointer.x < r.width + R &&
                   pointer.y > -R && pointer.y < r.height + R;
      if (!pointer.on) { trail.length = 0; return; }  /* 指针走开，推力立刻停，点马上开始回位 */

      /* 每隔 9px 记一个路径点，就是刀走过的那条线；
         点太密没意义（同一段反复算），太稀沟会变成一串圆 */
      var last = trail[trail.length - 1];
      var mx = pointer.x - (last ? last.x : 1e9);
      var my = pointer.y - (last ? last.y : 1e9);
      if (mx * mx + my * my > TRAIL_STEP * TRAIL_STEP) {
        trail.push({
          x: pointer.x,
          y: pointer.y,
          t: t0 ? (performance.now() - t0) / 1000 : 0
        });
        while (trail.length > TRAIL_MAX) trail.shift();
      }
    }, { passive: true });

    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (!playing) return;
        if (sample()) {
          t0 = performance.now() - 3400;             /* 已到位，别再来一次飞入 */
        } else {
          playing = false;
          if (raf) cancelAnimationFrame(raf);
          fail();
        }
      }, 220);
    });

    return { start: start };
  }

  /* ============================================================
     4) 串起来：居中打字上滑 → 整块左移左对齐 → 粒子 logo
     ============================================================ */
  var logo = createLogo(logoCvs, logoImg);
  var revealed = false;

  function reveal() {
    revealed = true;
    setTimeout(function () { if (logo) logo.start(); }, 220);
  }

  function showAll() {                              /* 兜底：把字直接亮出来 */
    typeEls.forEach(function (el) {
      el.classList.remove('is-typing');
      el.classList.add('is-done');
      var cs = el.querySelectorAll('.arc-ch');
      for (var i = 0; i < cs.length; i++) cs[i].style.opacity = 1;
    });
    if (socialEl) {
      socialEl.classList.add('is-in');
      if (hasGsap) gsap.set(socialEl, { opacity: 1, y: 0 });
    }
  }

  function toFinalLayout() {                        /* 直接落到最终版式（左对齐、无位移） */
    centered = false;
    if (pageEl) pageEl.classList.remove('arc-center');
    if (hasGsap) {
      gsap.set(textEl, { x: 0 });
      gsap.set(flipEls, { x: 0, y: 0 });
      gsap.set(socEls, { x: 0, y: 0 });
      gsap.set(rowEls, { y: 0, opacity: 1 });
    }
  }

  runTyping(function () {
    setTimeout(function () { shiftLeft(reveal); }, 300);   /* 打完停顿一下再左移 */
  });

  /* 8 秒还没走完（GSAP 没加载、后台标签页被节流、rAF 不回调……）就直接收尾，
     免得用户盯着一片空白。两步都自带幂等保护，重复调用没有副作用。 */
  setTimeout(function () {
    toFinalLayout();
    showAll();
    reveal();
  }, 8000);
})();
