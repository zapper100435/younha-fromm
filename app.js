(() => {
  'use strict';
  const A = window.ARCHIVE;
  const $ = (s, el = document) => el.querySelector(s);
  const main = $('#main');
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 호스팅할 때는 config.js의 MEDIA_BASE(R2 주소)에서 원본을 읽는다
  const BASE = window.MEDIA_BASE || A.base || '../file/';
  const fileUrl = p => BASE + p.split('/').map(encodeURIComponent).join('/');
  const thumbUrl = p => 'thumbs/' + encodeURIComponent(p.split('/').pop().replace(/\.\w+$/, '.jpg'));
  const fmt = n => n.toLocaleString('ko-KR');
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  const ym = d => d.slice(0, 7);
  const ymLabel = k => `${k.slice(0, 4)}년 ${+k.slice(5, 7)}월`;
  const dayLabel = d => {
    const dt = new Date(d + 'T00:00:00');
    return `${d.slice(0, 4)}년 ${+d.slice(5, 7)}월 ${+d.slice(8, 10)}일 ${WEEK[dt.getDay()]}요일`;
  };
  const initial = A.artist.slice(-1);
  // 새로고침해도 주소에 적힌 메시지 위치로 가도록, 브라우저가 예전 스크롤을 되살리지 않게 한다
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // ---------- 보기 단위 ----------
  // 주소 형식: #/<화면>/<단위>/<키>/<이동할 곳>   단위: all | y | m | d
  const SCOPES = [['all', '전체'], ['y', '연도별'], ['m', '월별'], ['d', '일별']];
  const KEYLEN = { y: 4, m: 7, d: 10 };
  const keyOf = (date, scope) => scope === 'all' ? '-' : date.slice(0, KEYLEN[scope]);
  const inScope = (date, scope, key) => scope === 'all' || date.startsWith(key);
  const scopeLabel = (scope, key) => scope === 'all' ? '전체' : scope === 'y' ? `${key}년` : scope === 'm' ? ymLabel(key) : dayLabel(key);

  // ---------- 색인 ----------
  const dayIdxOf = {};
  A.days.forEach((d, i) => { dayIdxOf[d.d] = i; });
  A.media.forEach((m, i) => { m.i = i; });
  const msgOfMedia = {};
  A.days.forEach((d, di) => d.m.forEach((m, mi) => (m.f || []).forEach(i => { msgOfMedia[i] = `${di}-${mi}`; })));
  const galleryIds = A.media.filter(m => m.k !== 'audio').map(m => m.i);
  const voiceIds = A.media.filter(m => m.k === 'audio').map(m => m.i);
  const totalMsgs = A.days.reduce((s, d) => s + d.m.length, 0);
  const counts = { img: 0, video: 0, audio: 0 };
  A.media.forEach(m => counts[m.k]++);

  $('#brandMark').textContent = A.artist;
  $('#brandName').textContent = `${A.artist} 프롬`;
  document.title = `${A.artist} 프롬 아카이브`;

  // ---------- 테마 ----------
  const root = document.documentElement;
  try { const t = localStorage.getItem('theme'); if (t) root.dataset.theme = t; } catch (e) {}
  $('#themeBtn').onclick = () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
  };

  // ---------- 사이드바 ----------
  // entries: [{date, n}] 날짜순. jump(mk): 그 달로 가는 주소
  function renderSidebar(entries, jump, activeMonth) {
    const per = new Map();
    for (const e of entries) per.set(ym(e.date), (per.get(ym(e.date)) || 0) + e.n);
    let html = '', year = '';
    for (const [mk, n] of per) {
      const y = mk.slice(0, 4);
      if (y !== year) { html += `<h3>${y}</h3>`; year = y; }
      html += `<a href="${jump(mk)}" class="${mk === activeMonth ? 'active' : ''}">${+mk.slice(5)}월<span>${fmt(n)}</span></a>`;
    }
    $('#sidebar').innerHTML = html;
    const a = $('#sidebar a.active');
    if (a) a.scrollIntoView({ block: 'nearest' });
  }
  $('#menuBtn').onclick = () => document.body.classList.toggle('drawer');
  $('#scrim').onclick = () => document.body.classList.remove('drawer');
  $('#sidebar').addEventListener('click', e => { if (e.target.closest('a')) document.body.classList.remove('drawer'); });

  // 단위 고르기 + 기간 고르기 + 이전/다음
  function toolbar(view, scope, key, dates) {
    const cur = key === '-' ? '' : key;
    const pick = s => {
      if (s === 'all') return '-';
      if (cur.length >= KEYLEN[s]) return cur.slice(0, KEYLEN[s]);
      const d = dates.find(x => x.startsWith(cur)) || dates[0];
      return d.slice(0, KEYLEN[s]);
    };
    const seg = `<div class="seg">${SCOPES.map(([s, l]) =>
      `<a class="${s === scope ? 'on' : ''}" href="#/${view}/${s}/${pick(s)}">${l}</a>`).join('')}</div>`;
    if (scope === 'all') return `<div class="toolbar">${seg}</div>`;
    const keys = [...new Set(dates.map(d => keyOf(d, scope)))];
    const pos = keys.indexOf(key);
    const prev = keys[pos - 1], next = keys[pos + 1];
    let picker;
    if (scope === 'd') {
      picker = `<input type="date" class="picker" data-pick value="${key}" min="${keys[0]}" max="${keys[keys.length - 1]}">`;
    } else {
      picker = `<select class="picker" data-pick>${keys.map(k =>
        `<option value="${k}" ${k === key ? 'selected' : ''}>${scope === 'y' ? k + '년' : ymLabel(k)}</option>`).join('')}</select>`;
    }
    return `<div class="toolbar">${seg}
      <div class="stepper">
        <a class="pill" href="#/${view}/${scope}/${prev || ''}" aria-disabled="${!prev}" aria-label="이전">‹</a>
        ${picker}
        <a class="pill" href="#/${view}/${scope}/${next || ''}" aria-disabled="${!next}" aria-label="다음">›</a>
      </div></div>`;
  }
  // 날짜 칸에서 기록이 없는 날을 고르면 그다음 기록이 있는 날로 간다
  main.addEventListener('change', e => {
    const el = e.target.closest('[data-pick]');
    if (!el || !el.value) return;
    const [, view, scope] = location.hash.split('/');
    let v = el.value;
    if (scope === 'd') {
      const dates = viewDates(view);
      v = dates.find(d => d >= v) || dates[dates.length - 1];
    }
    location.hash = `#/${view}/${scope}/${v}`;
  });
  function viewDates(view) {
    if (view === 'gallery') return [...new Set(galleryIds.map(i => A.media[i].day))];
    if (view === 'voice') return [...new Set(voiceIds.map(i => A.media[i].day))];
    return A.days.map(d => d.d);
  }

  // ---------- 메시지 렌더링 ----------
  const linkify = s => esc(s).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);

  function mediaHtml(ids) {
    const vis = ids.filter(i => A.media[i].k === 'img');
    const out = [];
    if (vis.length) {
      out.push(`<div class="media-grid ${vis.length === 1 ? 'single' : ''}">` + vis.map(i =>
        `<button class="shot" data-m="${i}"><img loading="lazy" src="${thumbUrl(A.media[i].p)}" data-full="${fileUrl(A.media[i].p)}"${vis.length === 1 && A.media[i].w ? ` width="${A.media[i].w}" height="${A.media[i].h}" style="aspect-ratio:${A.media[i].w}/${A.media[i].h}"` : ''} alt="사진"></button>`
      ).join('') + '</div>');
    }
    for (const i of ids) {
      const m = A.media[i];
      if (m.k === 'video') out.push(`<div class="vid"><video controls preload="none" data-src="${fileUrl(m.p)}"></video></div>`);
      if (m.k === 'audio') out.push(`<div class="voice"><audio controls preload="none" src="${fileUrl(m.p)}"></audio><span class="dur">${m.l || ''}</span></div>`);
    }
    return out.join('');
  }

  function msgHtml(m, id, prev) {
    const cont = prev && prev.t === m.t;
    let body = '';
    if (m.f) body = mediaHtml(m.f);
    else if (m.miss) body = `<div class="missing">${m.l ? '음성·영상' : '사진'}${m.l ? ' ' + m.l : ''} · 백업되지 않은 미디어</div>`;
    else if (m.e) body = '<div class="emoji-chip">이모티콘</div>';
    if (m.x || m.q) {
      const q = m.q ? `<div class="quote"><b>팬 메시지</b>${esc(m.q)}</div>` : '';
      body = `<div class="bubble">${q}${m.x ? linkify(m.x) : ''}</div>` + body;
    }
    return `<div class="msg ${cont ? 'cont' : ''}" id="m${id}">
      <div class="avatar ${cont ? 'ghost' : ''}">${initial}</div>
      <div class="col">${cont ? '' : `<div class="name">${A.artist}</div>`}
        <div class="row"><div class="col" style="max-width:100%">${body}</div><time>${m.t}</time></div></div></div>`;
  }

  function dayHtml(di) {
    const d = A.days[di];
    return `<section class="day" data-day="${di}"><div class="day-sep" id="d${di}">${dayLabel(d.d)}</div>` +
      d.m.map((m, mi) => msgHtml(m, `${di}-${mi}`, d.m[mi - 1])).join('') + '</section>';
  }

  // 영상은 화면 가까이 왔을 때만 불러온다
  const videoIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    const v = e.target;
    v.preload = 'metadata';
    v.src = v.dataset.src + '#t=0.5';
    videoIO.unobserve(v);
  }), { rootMargin: '600px' });
  const watchVideos = el => el.querySelectorAll('video[data-src]:not([src])').forEach(v => videoIO.observe(v));

  // ---------- 화면: 홈 ----------
  function viewHome() {
    renderSidebar(A.days.map(d => ({ date: d.d, n: d.m.length })), mk => `#/chat/m/${mk}`, null);
    const first = A.days[0].d, last = A.days[A.days.length - 1].d;
    const today = new Date();
    const md = String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const onThisDay = A.days.filter(d => d.d.slice(5) === md);
    // 한글이 많은 글 순서 (코드 목록 같은 글은 빠지도록)
    const hangul = s => (s.match(/[가-힣]/g) || []).length;
    const longest = A.days.map(d => ({ d, best: d.m.filter(m => m.x).sort((a, b) => hangul(b.x) - hangul(a.x))[0] }))
      .filter(o => o.best).sort((a, b) => hangul(b.best.x) - hangul(a.best.x)).slice(0, 6);
    const lastDay = A.days.length - 1;

    const card = (d, m) => {
      const mi = d.m.indexOf(m);
      const imgs = d.m.flatMap(x => x.f || []).filter(i => A.media[i].k === 'img').slice(0, 4);
      return `<a class="card" href="#/chat/all/-/${dayIdxOf[d.d]}-${mi}">
        <div class="when">${dayLabel(d.d)}</div>
        <div class="what">${m && m.x ? esc(m.x) : `메시지 ${d.m.length}개`}</div>
        ${imgs.length ? `<div class="thumbs">${imgs.map(i => `<img loading="lazy" src="${thumbUrl(A.media[i].p)}" alt="">`).join('')}</div>` : ''}
      </a>`;
    };

    main.innerHTML = `<div class="page">
      <section class="hero">
        <div>
          <h1>${A.artist} 프롬</h1>
          <div class="period">${dayLabel(first)} — ${dayLabel(last)}</div>
        </div>
        <div class="stats">
          <div class="stat"><b>${fmt(A.days.length)}</b><small>대화한 날</small></div>
          <div class="stat"><b>${fmt(totalMsgs)}</b><small>메시지</small></div>
          <div class="stat"><b>${fmt(counts.img)}</b><small>사진</small></div>
          <div class="stat"><b>${fmt(counts.video)}</b><small>영상</small></div>
          <div class="stat"><b>${fmt(counts.audio)}</b><small>음성</small></div>
        </div>
        <div class="pager">
          <a class="pill on" href="#/chat/all/-/0">처음부터 읽기</a>
          <a class="pill" href="#/chat/all/-/${lastDay}-${A.days[lastDay].m.length - 1}">마지막 메시지</a>
          <button class="pill" id="randomDay">아무 날이나</button>
        </div>
      </section>

      ${onThisDay.length ? `<h2 class="section-title">오늘, 지난 해에는 <small>${+md.slice(0, 2)}월 ${+md.slice(3)}일</small></h2>
        <div class="cards">${onThisDay.map(d => card(d, d.m.find(m => m.x) || d.m[0])).join('')}</div>` : ''}

      <h2 class="section-title">매일의 기록 <small>칸을 누르면 그날 대화를 볼 수 있어요</small></h2>
      <div id="heat"></div>

      <h2 class="section-title">긴 편지들</h2>
      <div class="cards">${longest.map(o => card(o.d, o.best)).join('')}</div>
    </div>`;

    $('#randomDay').onclick = () => {
      location.hash = `#/chat/d/${A.days[Math.floor(Math.random() * A.days.length)].d}`;
    };
    renderHeat($('#heat'));
    window.scrollTo(0, 0);
  }

  function renderHeat(el) {
    const per = {};
    A.days.forEach(d => { per[d.d] = d.m.length; });
    const vals = Object.values(per).sort((a, b) => a - b);
    const q = p => vals[Math.floor(vals.length * p)];
    const cut = [q(.25), q(.5), q(.75), q(.92)];
    const level = n => !n ? 0 : n <= cut[0] ? 1 : n <= cut[1] ? 2 : n <= cut[2] ? 3 : 4;
    const years = [...new Set(A.days.map(d => d.d.slice(0, 4)))];
    let html = '';
    for (const y of years) {
      const start = new Date(`${y}-01-01T00:00:00`);
      let cells = '';
      for (let i = 0; i < start.getDay(); i++) cells += '<i></i>';
      for (let dt = new Date(start); dt.getFullYear() === +y; dt.setDate(dt.getDate() + 1)) {
        const key = `${y}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        const n = per[key] || 0;
        cells += n
          ? `<a href="#/chat/d/${key}" data-l="${level(n)}" title="${key} · 메시지 ${n}개"></a>`
          : `<a class="empty" title="${key}"></a>`;
      }
      html += `<div class="heat-year"><h4><a href="#/chat/y/${y}">${y}</a></h4><div class="heat-scroll"><div class="heat">${cells}</div></div></div>`;
    }
    html += `<div class="legend">적음 ${[0, 1, 2, 3, 4].map(l => `<i style="background:var(--heat-${l})"></i>`).join('')} 많음</div>`;
    el.innerHTML = html;
  }

  // ---------- 화면: 대화 ----------
  // 메시지가 많아서 보이는 근처의 날짜만 그리고, 스크롤하면 위·아래로 이어 붙인다
  const CHUNK = 250;
  let stream = null;

  function viewChat(scope, key, target) {
    const dates = viewDates('chat');
    if (scope !== 'all' && !dates.some(d => d.startsWith(key))) { scope = 'all'; key = '-'; }
    const list = A.days.map((d, i) => i).filter(i => inScope(A.days[i].d, scope, key));
    const msgs = list.reduce((s, i) => s + A.days[i].m.length, 0);
    const media = list.reduce((s, i) => s + A.days[i].m.reduce((t, m) => t + (m.f ? m.f.length : 0), 0), 0);
    const tDay = target ? +target.split('-')[0] : null;
    let start = Math.max(0, list.indexOf(tDay));

    const jump = mk => {
      const di = dayIdxOf[dates.find(d => d.startsWith(mk))];
      if (scope === 'all' || (scope === 'y' && mk.startsWith(key))) return `#/chat/${scope}/${key}/${di}`;
      if (scope === 'd') return `#/chat/d/${A.days[di].d}`;
      return `#/chat/${scope === 'y' ? 'y' : 'm'}/${scope === 'y' ? mk.slice(0, 4) : mk}`;
    };
    const activeMonth = tDay != null ? ym(A.days[tDay].d) : scope === 'm' || scope === 'd' ? key.slice(0, 7) : null;
    renderSidebar(A.days.map(d => ({ date: d.d, n: d.m.length })), jump, activeMonth);

    const lastDi = list[list.length - 1];
    main.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>${scope === 'all' ? '전체 대화' : scopeLabel(scope, key)}</h1>
        <p>메시지 ${fmt(msgs)}개 · 미디어 ${fmt(media)}개</p></div>${toolbar('chat', scope, key, dates)}</div>
      ${list.length > 3 ? `<div class="jumps"><a class="pill" href="#/chat/${scope}/${key}/${list[0]}">맨 처음</a>
        <a class="pill" href="#/chat/${scope}/${key}/${lastDi}-${A.days[lastDi].m.length - 1}">맨 끝</a></div>` : ''}
      <div class="loading" id="topMore" hidden>이전 대화 불러오는 중…</div>
      <div class="chat" id="chat"></div>
      <div class="loading" id="botMore" hidden>다음 대화 불러오는 중…</div>
    </div>`;

    stream = { list, lo: start, hi: start, chat: $('#chat') };
    let n = 0;
    while (stream.hi < list.length && n < CHUNK) n += addDay('end');
    bindMedia(() => [...main.querySelectorAll('.shot')].map(b => +b.dataset.m));
    if (target) {
      const el = document.getElementById('m' + target) || document.getElementById('d' + tDay);
      if (el) {
        el.scrollIntoView({ block: target.includes('-') ? 'center' : 'start' });
        if (target.includes('-')) el.classList.add('flash');
      }
    } else {
      window.scrollTo(0, 0);
    }
    updateMore();
    setTimeout(fill, 0);
  }

  function addDay(where) {
    const s = stream;
    const di = where === 'end' ? s.list[s.hi++] : s.list[--s.lo];
    if (where === 'end') {
      s.chat.insertAdjacentHTML('beforeend', dayHtml(di));
    } else {
      // 보고 있던 위치가 밀리지 않게 맞춘다 (브라우저가 이미 맞췄으면 차이가 0)
      const anchor = s.chat.firstElementChild;
      const before = anchor ? anchor.getBoundingClientRect().top : 0;
      s.chat.insertAdjacentHTML('afterbegin', dayHtml(di));
      const diff = anchor ? anchor.getBoundingClientRect().top - before : 0;
      if (diff) window.scrollBy(0, diff);
    }
    watchVideos(s.chat);
    return A.days[di].m.length;
  }
  function updateMore() {
    if (!stream) return;
    $('#topMore').hidden = stream.lo === 0;
    $('#botMore').hidden = stream.hi === stream.list.length;
  }
  function fill() {
    if (!stream || !document.body.contains(stream.chat)) { stream = null; return; }
    const r = stream.chat.getBoundingClientRect();
    const margin = innerHeight * 2;
    let n = 0;
    if (r.bottom < innerHeight + margin) while (stream.hi < stream.list.length && n < CHUNK) n += addDay('end');
    n = 0;
    if (r.top > -margin) while (stream.lo > 0 && n < CHUNK) n += addDay('start');
    updateMore();
  }
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking || !stream) return;
    ticking = true;
    setTimeout(() => { ticking = false; fill(); }, 60);
  }, { passive: true });

  // ---------- 화면: 사진·영상 / 음성 공통 ----------
  // 전체·연도별은 달별로, 월별·일별은 날짜별로 묶는다
  function groupIds(ids, scope) {
    const groups = new Map();
    for (const i of ids) {
      const d = A.media[i].day;
      const g = scope === 'all' || scope === 'y' ? ym(d) : d;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(i);
    }
    return groups;
  }
  const groupTitle = g => g.length === 7 ? ymLabel(g) : dayLabel(g);
  const groupChatLink = g => g.length === 7 ? `#/chat/m/${g}` : `#/chat/d/${g}`;
  function mediaSidebar(view, ids, scope, key) {
    const jump = mk => {
      if (scope === 'all' || (scope === 'y' && mk.startsWith(key))) return `#/${view}/${scope}/${key}/${mk}`;
      if (scope === 'y') return `#/${view}/y/${mk.slice(0, 4)}/${mk}`;
      if (scope === 'm') return `#/${view}/m/${mk}`;
      return `#/${view}/d/${ids.map(i => A.media[i].day).find(d => d.startsWith(mk))}`;
    };
    renderSidebar(ids.map(i => ({ date: A.media[i].day, n: 1 })), jump, scope === 'm' || scope === 'd' ? key.slice(0, 7) : null);
  }
  // 정렬: 오래된 순(asc) / 최신 순(desc). 고른 값은 이 브라우저에 기억한다
  let mediaOrder = 'asc';
  try { if (localStorage.getItem('order') === 'desc') mediaOrder = 'desc'; } catch (e) {}
  const ordered = ids => mediaOrder === 'desc' ? ids.slice().reverse() : ids;
  const sortHtml = () => `<div class="seg sort">${[['asc', '오래된 순'], ['desc', '최신 순']].map(([v, l]) =>
    `<a href="javascript:" class="${mediaOrder === v ? 'on' : ''}" data-order="${v}">${l}</a>`).join('')}</div>`;
  function bindSort(rerender) {
    main.querySelectorAll('[data-order]').forEach(b => b.onclick = e => {
      e.preventDefault();
      mediaOrder = b.dataset.order;
      try { localStorage.setItem('order', mediaOrder); } catch (err) {}
      rerender();
    });
  }
  function scrollToGroup(target) {
    const el = target && document.getElementById('g' + target);
    if (el) el.scrollIntoView({ block: 'start' }); else window.scrollTo(0, 0);
  }

  // ---------- 화면: 사진·영상 ----------
  let galleryKind = 'all';
  function viewGallery(scope, key, target) {
    const dates = viewDates('gallery');
    if (scope !== 'all' && !dates.some(d => d.startsWith(key))) { scope = 'all'; key = '-'; }
    mediaSidebar('gallery', galleryIds, scope, key);
    const ids = ordered(galleryIds.filter(i => inScope(A.media[i].day, scope, key) && (galleryKind === 'all' || A.media[i].k === galleryKind)));
    const tile = i => {
      const m = A.media[i];
      if (m.k === 'video') return `<button class="tile" data-m="${i}"><video preload="none" muted data-src="${fileUrl(m.p)}"></video><span class="badge">▶ ${m.l || ''}</span></button>`;
      return `<button class="tile" data-m="${i}"><img loading="lazy" src="${thumbUrl(m.p)}" data-full="${fileUrl(m.p)}" alt=""></button>`;
    };
    const groups = groupIds(ids, scope);
    main.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>${scope === 'all' ? '전체 사진·영상' : scopeLabel(scope, key)}</h1><p>사진·영상 ${fmt(ids.length)}개</p></div>
        ${toolbar('gallery', scope, key, dates)}</div>
      <div class="filters" style="margin-bottom:20px">
        ${[['all', '사진+영상'], ['img', '사진만'], ['video', '영상만']].map(([v, l]) => `<button class="pill ${galleryKind === v ? 'on' : ''}" data-kind="${v}">${l}</button>`).join('')}
        ${sortHtml()}
      </div>
      ${[...groups].map(([g, gi]) => `<section class="month-block" id="g${g}"><h2>${groupTitle(g)} <small>${gi.length}개 · <a href="${groupChatLink(g)}">대화 보기</a></small></h2>
        <div class="grid">${gi.map(tile).join('')}</div></section>`).join('') || '<div class="empty-state">해당하는 미디어가 없어요</div>'}
    </div>`;
    main.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { galleryKind = b.dataset.kind; viewGallery(scope, key); });
    bindSort(() => viewGallery(scope, key));
    watchVideos(main);
    bindMedia(() => ids);
    scrollToGroup(target);
  }

  // ---------- 화면: 음성 ----------
  function viewVoice(scope, key, target) {
    const dates = viewDates('voice');
    if (scope !== 'all' && !dates.some(d => d.startsWith(key))) { scope = 'all'; key = '-'; }
    mediaSidebar('voice', voiceIds, scope, key);
    const ids = ordered(voiceIds.filter(i => inScope(A.media[i].day, scope, key)));
    const groups = groupIds(ids, scope);
    main.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>${scope === 'all' ? '전체 음성' : scopeLabel(scope, key)}</h1><p>음성 메시지 ${ids.length}개</p></div>
        ${toolbar('voice', scope, key, dates)}</div>
      <div class="filters" style="margin-bottom:20px">${sortHtml()}</div>
      ${[...groups].map(([g, gi]) => `<section class="month-block" id="g${g}"><h2>${groupTitle(g)} <small>${gi.length}개</small></h2>
        <div class="voice-list">${gi.map(i => {
          const m = A.media[i];
          return `<div class="voice-item"><div class="when"><b>${+m.day.slice(5, 7)}월 ${+m.day.slice(8)}일</b>${m.t} · ${m.l || ''}</div>
            <audio controls preload="none" src="${fileUrl(m.p)}"></audio><a href="#/chat/all/-/${msgOfMedia[i]}">대화 보기 ›</a></div>`;
        }).join('')}</div></section>`).join('') || '<div class="empty-state">해당하는 음성이 없어요</div>'}
    </div>`;
    bindSort(() => viewVoice(scope, key));
    scrollToGroup(target);
  }

  // ---------- 화면: 검색 ----------
  function viewSearch(q) {
    renderSidebar(A.days.map(d => ({ date: d.d, n: d.m.length })), mk => `#/chat/m/${mk}`, null);
    $('#searchInput').value = q;
    const needle = q.trim().toLowerCase();
    const hits = [];
    let total = 0;
    if (needle) {
      A.days.forEach((d, di) => d.m.forEach((m, mi) => {
        const hay = ((m.q || '') + '\n' + (m.x || '')).toLowerCase();
        if (hay.includes(needle)) { total++; if (hits.length < 400) hits.push([di, mi]); }
      }));
    }
    const re = needle ? new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi') : null;
    const hl = s => esc(s).replace(re, x => `<mark>${x}</mark>`);
    const snippet = s => {
      const p = s.toLowerCase().indexOf(needle);
      if (p < 0 || s.length < 220) return hl(s);
      const a = Math.max(0, p - 80);
      return (a ? '…' : '') + hl(s.slice(a, a + 220)) + '…';
    };
    main.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>“${esc(q)}”</h1><p>${needle ? `${fmt(total)}개 찾음${total > hits.length ? ` · 앞의 ${hits.length}개만 보여요` : ''}` : '검색어를 입력하세요'}</p></div></div>
      <div class="results">${hits.map(([di, mi]) => {
        const d = A.days[di], m = d.m[mi];
        return `<a class="result" href="#/chat/all/-/${di}-${mi}">
          <div class="meta"><b>${A.artist}</b><span>${dayLabel(d.d)} ${m.t}</span></div>
          ${m.q && m.q.toLowerCase().includes(needle) ? `<div class="quote" style="margin:6px 0 0"><b>팬 메시지</b>${snippet(m.q)}</div>` : ''}
          ${m.x ? `<div class="text">${snippet(m.x)}</div>` : ''}</a>`;
      }).join('') || (needle ? '<div class="empty-state">찾는 메시지가 없어요</div>' : '')}</div>
    </div>`;
    window.scrollTo(0, 0);
  }
  $('#searchForm').onsubmit = e => {
    e.preventDefault();
    const q = $('#searchInput').value.trim();
    if (q) location.hash = '#/search/' + encodeURIComponent(q);
  };

  // ---------- 라이트박스 ----------
  const lb = $('#lightbox');
  let lbList = [], lbPos = 0, listFn = () => [];
  function bindMedia(fn) { listFn = fn; }
  main.addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    lbList = listFn();
    lbPos = Math.max(0, lbList.indexOf(+b.dataset.m));
    showLb();
  });
  // 미리보기가 아직 없으면 원본을 보여 준다
  main.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.dataset.full && img.src !== img.dataset.full) img.src = img.dataset.full;
  }, true);
  function showLb() {
    const m = A.media[lbList[lbPos]];
    const stage = $('#lbStage');
    stage.innerHTML = m.k === 'video'
      ? `<video controls autoplay src="${fileUrl(m.p)}"></video>`
      : `<img src="${fileUrl(m.p)}" alt="">`;
    $('#lbCaption').innerHTML = `${dayLabel(m.day)} ${m.t} · ${lbPos + 1} / ${lbList.length}
      <a href="${fileUrl(m.p)}" target="_blank">원본 열기</a>`;
    $('#lbPrev').style.visibility = lbPos > 0 ? '' : 'hidden';
    $('#lbNext').style.visibility = lbPos < lbList.length - 1 ? '' : 'hidden';
    lb.hidden = false;
  }
  function closeLb() { lb.hidden = true; $('#lbStage').innerHTML = ''; }
  $('#lbClose').onclick = closeLb;
  $('#lbPrev').onclick = () => { if (lbPos > 0) { lbPos--; showLb(); } };
  $('#lbNext').onclick = () => { if (lbPos < lbList.length - 1) { lbPos++; showLb(); } };
  lb.addEventListener('click', e => { if (e.target === lb || e.target.id === 'lbStage') closeLb(); });
  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') $('#lbPrev').click();
    if (e.key === 'ArrowRight') $('#lbNext').click();
  });

  // ---------- 라우팅 ----------
  function route() {
    closeLb();
    stream = null;
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const view = parts[0] || 'home';
    document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    const scope = KEYLEN[parts[1]] ? parts[1] : 'all';
    const key = scope === 'all' ? '-' : parts[2] || '';
    const target = parts[3] || null;
    if (view === 'chat') viewChat(scope, key, target);
    else if (view === 'gallery') viewGallery(scope, key, target);
    else if (view === 'voice') viewVoice(scope, key, target);
    else if (view === 'search') viewSearch(decodeURIComponent(parts.slice(1).join('/')));
    else viewHome();
  }
  window.addEventListener('hashchange', route);
  route();
})();
