/* ============================================================
   GitHub 页面：个人资料 + 贡献表 + 项目列表
   —— 两位成员，左侧竖条切换；所有内容集中在 PEOPLE 里改数字文字即可
   ============================================================ */
(function () {
  /* ============================================================
     ↓↓↓  要改的东西都在这里  ↓↓↓
     ============================================================ */
  const PEOPLE = [
    {
      name:  'NanchenJiaJia',
      login: 'yunshangnanchen',
      url:   'https://github.com/yunshangnanchen',
      // 头像：GitHub 用户名 + .png 就是官方头像；想换本地图片就写 'assets/avatar.jpg'
      avatar: 'assets/avatar-yunshangnanchen.jpg',
      bio:   '幻想终将实现',
      total: 428,                       // 贡献表上方显示的年度贡献数
      seed:  20261030,                  // 本地占位贡献图的随机种子（换人换图案）
      repos: [
        { name: 'lightpress', desc: '轻压 · 面向网站素材的 Windows 桌面批量图片压缩工具：拖入文件夹即可整批输出 AVIF / WebP，逐张二分搜索最低编码质量。', lang: 'Python', stars: 0 }
      ]
    },
    {
      name:  'YUNSHANG · FENG',
      login: 'canfengplaeir',
      url:   'https://github.com/canfengplaeir',
      avatar: 'assets/avatar-canfengplaeir.jpg',
      bio:   'LET ME THINK',
      total: 0,
      seed:  20261031,
      repos: [
        { name: 'astrbot_plugin_humanlike', desc: '一个 AstrBot 插件：让机器人在群聊中按心流和 AI 判断决定是否发言，而不是每条消息都回复。', lang: 'Python', stars: 3 },
        { name: 'netmux', desc: 'Linux 多网口带宽聚合工具：Rust + GPUI，支持负载均衡、故障转移与 TUN 聚合。', lang: 'Rust', stars: 0 }
      ]
    }
  ];

  /* ---------- 贡献图设置 ---------- */
  const CHART = {
    // 直接引用 2016rshah/githubchart-api 的在线服务：https://ghchart.rshah.org
    // true = 用真实贡献图；false = 只用下面本地生成的占位图
    useRemote: true,
    base:  'https://ghchart.rshah.org',
    // 基色 hex（不带 #）。服务会把这作为最深一级，生成 5 级绿色色阶；
    // CSS 再对 .gh-chart 套 invert + hue-rotate(140) + saturate，把"浅灰空格"
    // 翻转成深灰黑、贡献格翻成由暗到亮的绿，即 GitHub 深色主题同款配色
    color: '216e39',
    // 远程图拿不到（没网 / 服务挂了）时，自动回退到本地占位图
    fallback: true
  };

  /* ---------- 本地占位图设置（远程图失败时的后备） ---------- */
  const CONTRIB = {
    weeks: 53,          // 显示多少周（GitHub 是 53 周 ≈ 一年）
    // 每个等级的占比（0 = 没贡献，4 = 最多）；加起来不必等于 1，会归一化
    weights: [0.46, 0.20, 0.15, 0.12, 0.07]
  };
  /* ============================================================
     ↑↑↑  要改的东西到这里结束  ↑↑↑
     ============================================================ */

  const $ = function (id) { return document.getElementById(id); };

  /* ============================================================
     1. 个人资料
     ============================================================ */
  function renderProfile(person) {
    const av = $('ghAvatar');
    if (av) {
      av.src = person.avatar;
      av.style.display = '';
      // 头像加载失败（比如没联网）时换成首字母占位，避免出现破图
      av.addEventListener('error', function () {
        av.style.display = 'none';
        const box = document.createElement('div');
        box.className = 'gh-avatar gh-avatar-fallback';
        box.textContent = (person.name || '?').trim().charAt(0).toUpperCase();
        if (av.parentNode) av.parentNode.insertBefore(box, av);
      }, { once: true });
    }
    if ($('ghName'))  $('ghName').textContent  = person.name;
    if ($('ghLogin')) $('ghLogin').textContent = '@' + person.login;
    if ($('ghBio'))   $('ghBio').textContent   = person.bio;
    const link = $('ghLink');
    if (link) link.href = person.url;
  }

  /* ============================================================
     2. 贡献表（53 周 × 7 天，黑白灰阶）
     ============================================================ */
  // 固定种子的伪随机：保证每次刷新图案一致，看起来更像真实数据
  let _s = 0;
  function rnd() {
    _s = (_s * 1664525 + 1013904223) >>> 0;
    return _s / 4294967296;
  }

  function pickLevel() {
    const r = rnd();
    let acc = 0;
    for (let i = 0; i < CONTRIB.weights.length; i++) {
      acc += CONTRIB.weights[i];
      if (r < acc) return i;
    }
    return 0;
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // 星期标签只在第 1/3/5 行显示（周一 / 周三 / 周五），和 GitHub 一致
  const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  function renderGraph(person) {
    const host = $('ghGraph');
    if (!host) return;
    host.innerHTML = '';                 // 切换时清掉上一人的图

    _s = person.seed >>> 0;              // 每人独立随机种子

    // 最后一列 = 本周（周日起算），往前推 weeks-1 周
    const now = new Date();
    const first = new Date(now);
    first.setDate(now.getDate() - now.getDay() - (CONTRIB.weeks - 1) * 7);
    first.setHours(0, 0, 0, 0);

    const W = CONTRIB.weeks;

    /* --- 月份行 --- */
    const colMonths = [];
    for (let w = 0; w < W; w++) {
      const d = new Date(first);
      d.setDate(first.getDate() + w * 7);
      colMonths.push(d.getMonth());
    }

    const months = document.createElement('div');
    months.className = 'gh-months';
    let lastMonth = -1;
    let lastLabelW = -99;
    for (let w = 0; w < W; w++) {
      const m = colMonths[w];
      const isStub = (w === 0) && (colMonths[1] !== m);
      let text = '';
      if (m !== lastMonth && !isStub && w - lastLabelW >= 3 && w < W - 1) {
        text = MONTHS[m];
        lastLabelW = w;
      }
      lastMonth = m;
      const span = document.createElement('span');
      span.textContent = text;
      months.appendChild(span);
    }

    /* --- 星期列 + 格子 --- */
    const body = document.createElement('div');
    body.className = 'gh-body';

    const days = document.createElement('div');
    days.className = 'gh-days';
    for (let d = 0; d < 7; d++) {
      const s = document.createElement('span');
      s.textContent = DAY_LABELS[d];
      days.appendChild(s);
    }

    const cells = document.createElement('div');
    cells.className = 'gh-cells';
    const oneDay = 86400000;
    for (let w = 0; w < W; w++) {
      const col = document.createElement('div');
      col.className = 'gh-col';
      for (let d = 0; d < 7; d++) {
        const date = new Date(first.getTime() + (w * 7 + d) * oneDay);
        const lv = pickLevel();
        const c = document.createElement('i');
        c.className = 'lv' + lv;
        c.title = date.toISOString().slice(0, 10) + ' · ' + lv + ' contributions';
        col.appendChild(c);
      }
      cells.appendChild(col);
    }

    body.appendChild(days);
    body.appendChild(cells);

    host.appendChild(months);
    host.appendChild(body);

    if ($('ghTotal')) $('ghTotal').textContent = person.total;
  }

  /* ============================================================
     3. 项目列表
     ============================================================ */
  function renderRepos(person) {
    const host = $('ghRepos');
    if (!host) return;
    host.innerHTML = '';

    person.repos.forEach(function (r) {
      const card = document.createElement('a');
      card.className = 'gh-repo';
      card.href = person.url + '/' + r.name;
      card.target = '_blank';
      card.rel = 'noopener';

      const name = document.createElement('div');
      name.className = 'gh-repo-name';
      name.textContent = r.name;

      const desc = document.createElement('p');
      desc.className = 'gh-repo-desc';
      desc.textContent = r.desc;

      const meta = document.createElement('div');
      meta.className = 'gh-repo-meta';
      if (r.lang) {
        const dot = document.createElement('i');
        dot.className = 'gh-dot';
        meta.appendChild(dot);
        const l = document.createElement('span');
        l.textContent = r.lang;
        meta.appendChild(l);
      }
      if (r.stars != null) {
        const st = document.createElement('span');
        st.className = 'gh-stars';
        st.textContent = '★ ' + r.stars;
        meta.appendChild(st);
      }

      card.appendChild(name);
      card.appendChild(desc);
      card.appendChild(meta);
      host.appendChild(card);
    });
  }

  /* ============================================================
     4. 远程真实贡献图（ghchart.rshah.org / 2016rshah/githubchart-api）
     ============================================================ */
  function renderChart(person) {
    const img = $('ghChartImg');
    const host = $('ghGraph');
    if (!img || !CHART.useRemote) return;

    // 有基色走 /:color/:username，没有就走 /:username
    const url = CHART.color
      ? CHART.base + '/' + CHART.color + '/' + person.login
      : CHART.base + '/' + person.login;

    img.style.display = 'none';          // 先隐藏，等加载成功再显示

    img.onload = function () {
      img.style.display = 'block';       // 成功：显示远程图
      if (host) host.hidden = true;      // 隐藏本地占位图
      alignGraphToBio();
    };

    if (CHART.fallback) {
      img.onerror = function () {
        img.style.display = 'none';      // 失败：继续用本地占位图
        if (host) host.hidden = false;
        alignGraphToBio();
      };
    }

    img.src = url;
  }

  /* ============================================================
     5. 宽屏对齐：贡献表底边 ≈ 简介文字底边（竖屏不管）
     ============================================================ */
  const WIDE = window.matchMedia('(min-width: 721px)');

  function alignGraphToBio() {
    const top  = document.querySelector('.gh-top');
    const bio  = $('ghBio');
    const wrap = document.querySelector('.gh-graph-wrap');
    if (!top || !bio || !wrap) return;

    if (!WIDE.matches) {
      wrap.style.marginTop = '';
      return;
    }

    wrap.style.marginTop = '0px';
    const base       = top.offsetTop;
    const bioBottom  = bio.offsetTop + bio.offsetHeight - base;
    const wrapTop    = wrap.offsetTop - base;
    const shift      = bioBottom - wrap.offsetHeight - wrapTop;
    wrap.style.marginTop = Math.max(0, Math.round(shift)) + 'px';

    if (/[?&]debug/.test(location.search)) {
      var wTop = wrap.offsetTop - base;
      document.documentElement.setAttribute('data-align',
        'bioBottom=' + bioBottom + ' wrapTop=' + wTop +
        ' wrapH=' + wrap.offsetHeight + ' wrapBottom=' + (wTop + wrap.offsetHeight));
    }
  }

  let alignTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(alignTimer);
    alignTimer = setTimeout(alignGraphToBio, 120);
  });

  /* ============================================================
     6. 两位成员切换：左侧竖条
     ============================================================ */
  let currentIdx = 0;
  let autoAdvance = true;      // 自动轮播开关：用户手动点过切换条后置 false，不再自动切
  let progressTween = null;    // 当前进度条 tween 引用，手动切换时先杀掉

  const switchEl = $('ghSwitch');
  if (switchEl) {
    PEOPLE.forEach(function (p, i) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gs-bar';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', 'false');
      b.setAttribute('aria-label', '切换至 ' + p.name);
      // 轨道（灰）+ 进度填充（白），进度由 runProgress 驱动
      const track = document.createElement('span');
      track.className = 'gs-track';
      const fill = document.createElement('span');
      fill.className = 'gs-fill';
      b.appendChild(track);
      b.appendChild(fill);
      b.addEventListener('click', function () { switchTo(i, true); });
      switchEl.appendChild(b);
    });
  }
  function updateSwitch() {
    if (!switchEl) return;
    Array.prototype.forEach.call(switchEl.children, function (b, i) {
      const on = i === currentIdx;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  /* 切换条进度：当前激活条的填充从 0 跑满，跑满自动切下一位 */
  const WIDE_MQ = window.matchMedia('(min-width: 721px)');
  // 横屏↔竖屏旋转时重新跑进度条（竖条 scaleY ↔ 横条 scaleX 方向切换）
  if (WIDE_MQ.addEventListener) {
    WIDE_MQ.addEventListener('change', function () { runProgress(); });
  } else if (WIDE_MQ.addListener) {
    WIDE_MQ.addListener(function () { runProgress(); });
  }
  function runProgress() {
    if (!switchEl) return;
    const bar = switchEl.children[currentIdx];
    const fill = bar ? bar.querySelector('.gs-fill') : null;
    if (!fill) return;

    // 先杀掉上一段还没跑完的进度条，避免叠加
    if (progressTween) { progressTween.kill(); progressTween = null; }

    // 方向：横屏竖条 scaleY（顶→底），竖屏横条 scaleX（左→右）
    const vertical = WIDE_MQ.matches;
    if (window.gsap) {
      gsap.killTweensOf(fill);
      gsap.set(fill, { transformOrigin: vertical ? 'center top' : 'left center' });
      progressTween = gsap.fromTo(fill,
        vertical ? { scaleY: 0 } : { scaleX: 0 },
        {
          ...(vertical ? { scaleY: 1 } : { scaleX: 1 }),
          duration: 3.5,
          ease: 'none',
          onComplete: function () {
            progressTween = null;
            // 只有仍处于自动轮播时才切下一位；用户手动切过后就停住
            if (autoAdvance) switchTo((currentIdx + 1) % PEOPLE.length, false);
          }
        });
    } else {
      // 无 GSAP 兜底：CSS 过渡或直接定时切换
      setTimeout(function () {
        if (autoAdvance) switchTo((currentIdx + 1) % PEOPLE.length, false);
      }, 3500);
    }
  }

  function switchTo(i, fromUser) {
    if (i === currentIdx) {
      // 点的是当前人：也停住自动轮播
      if (fromUser) autoAdvance = false;
      return;
    }
    if (fromUser) autoAdvance = false;   // 用户手动切换后，停止自动轮播
    currentIdx = i;
    animateSwitch();
    runProgress();
  }
  function renderCurrent() {
    const person = PEOPLE[currentIdx];
    renderProfile(person);
    renderGraph(person);
    renderRepos(person);
    renderChart(person);
    updateSwitch();
    alignGraphToBio();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(alignGraphToBio);
    }
  }

  /* ---------- 切换过渡：旧内容淡出 → 换数据 → 新内容淡入 ---------- */
  function animateSwitch() {
    if (!window.gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      renderCurrent();
      return;
    }
    const qs = function (s) { return document.querySelector(s); };
    const avatar = qs('.gh-avatar');
    const texts  = [qs('.gh-name'), qs('.gh-login'), qs('.gh-bio'), qs('.gh-link')].filter(Boolean);
    const wrap   = qs('.gh-graph-wrap');
    const repos  = gsap.utils.toArray('.gh-repo');

    // 旧内容去重（avatar/wrap 各一次，texts 一次，repos 一次）
    const oldEls = [avatar, wrap].concat(texts).concat(repos).filter(function (el, idx, arr) {
      return !!el && arr.indexOf(el) === idx;
    });

    gsap.to(oldEls, {
      y: -12, autoAlpha: 0, duration: 0.2, ease: 'power2.in',
      onComplete: function () {
        renderCurrent();   // 换掉数据（重建项目卡片 / 贡献图 / 头像）

        // 新内容淡入
        const nAvatar = qs('.gh-avatar');
        const nTexts  = [qs('.gh-name'), qs('.gh-login'), qs('.gh-bio'), qs('.gh-link')].filter(Boolean);
        const nWrap   = qs('.gh-graph-wrap');
        const nRepos  = gsap.utils.toArray('.gh-repo');

        gsap.set([nAvatar, nWrap].filter(Boolean), { y: 12, autoAlpha: 0 });
        gsap.set(nTexts, { y: 12, autoAlpha: 0 });
        if (nRepos.length) gsap.set(nRepos, { y: 16, autoAlpha: 0 });

        gsap.to([nAvatar, nWrap].filter(Boolean), {
          y: 0, autoAlpha: 1, duration: 0.45, ease: 'power2.out',
          stagger: 0.06, clearProps: 'transform'
        });
        gsap.to(nTexts, {
          y: 0, autoAlpha: 1, duration: 0.45, ease: 'power2.out',
          stagger: 0.06, clearProps: 'transform'
        });
        if (nRepos.length) {
          gsap.to(nRepos, {
            y: 0, autoAlpha: 1, duration: 0.45, ease: 'power2.out',
            stagger: 0.08, clearProps: 'transform'
          });
        }
      }
    });
  }

  renderCurrent();
  runProgress();   // 初始就启动第一个人的进度条，跑满自动切下一位
})();
