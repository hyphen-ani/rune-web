/* ────────────────────────────────────────────────────────────
   Rune docs — routing, sidebar, TOC, search, code blocks
   Pages are <article class="doc" data-slug> in docs.html;
   URLs look like docs.html#/cli-put or docs.html#/cli-put/flags
   ──────────────────────────────────────────────────────────── */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const G = window.gsap && !reduce ? window.gsap : null;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slugify = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  /* ── icons ──────────────────────────────────────────────── */
  const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    book: P('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>'),
    bulb: P('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
    terminal: P('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M7 9l3 3-3 3M12 15h5"/>'),
    server: P('<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>'),
    window: P('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M8 9v11"/>'),
    api: P('<path d="M8 6l-6 6 6 6M16 6l6 6-6 6M14 4l-4 16"/>'),
    java: P('<path d="M7 18c-2 0-3-1.3-3-3 0-1.6 1.2-2.8 2.7-3A4.5 4.5 0 0 1 15.5 9 3.5 3.5 0 0 1 20 12.5c0 2.6-1.9 5.5-5 5.5"/><path d="M10 21l2-3 2 3M12 18v-6"/>'),
    k8s: P('<path d="M12 2l8.5 4.5v9L12 22l-8.5-6.5v-9z"/><circle cx="12" cy="12" r="3"/><path d="M12 5v4M12 15v4M5.5 8.5l3.8 2M14.7 13.5l3.8 2M5.5 15.5l3.8-2M14.7 10.5l3.8-2"/>'),
    help: P('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>'),
    lock: P('<rect x="5" y="10" width="14" height="10" rx="1.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
    key: P('<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/>'),
    shield: P('<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
    folder: P('<path d="M3 6h7l2 2h9v11H3z"/>'),
    inject: P('<path d="M17 3l4 4M19 5l-9 9M8 12l4 4M6 14l-3 7 7-3"/>'),
  };
  const GROUP_ICON = { 'Get started': 'book', 'Concepts': 'bulb', 'CLI reference': 'terminal', 'Server & Web UI': 'server', 'HTTP API': 'api', 'Java SDK': 'java', 'Kubernetes': 'k8s', 'Help': 'help' };
  $$('.card-ico[data-i]').forEach((el) => (el.innerHTML = ICONS[el.dataset.i] || ''));

  /* ── pages ─────────────────────────────────────────────── */
  const articles = $$('article.doc');
  const pages = articles.map((el, i) => ({
    el, i,
    slug: el.dataset.slug,
    title: el.dataset.title.replace(/&amp;/g, '&'),
    group: el.dataset.group.replace(/&amp;/g, '&'),
    desc: el.dataset.desc || '',
  }));
  const bySlug = Object.fromEntries(pages.map((p) => [p.slug, p]));
  const groups = [];
  pages.forEach((p) => { let g = groups.find((x) => x.name === p.group); if (!g) groups.push((g = { name: p.group, pages: [] })); g.pages.push(p); });

  /* enhance each article once: crumb, heading ids + anchors, code blocks */
  pages.forEach((p) => {
    const crumb = document.createElement('p');
    crumb.className = 'doc-crumb';
    crumb.innerHTML = `${esc(p.group)}`;
    p.el.insertBefore(crumb, p.el.firstChild);

    $$('h2, h3', p.el).forEach((h) => {
      if (h.closest('.steps') || h.closest('.rm-mini')) return;
      const base = h.id || slugify(h.textContent);
      h.dataset.hid = base;
      h.id = `${p.slug}--${base}`;
      const a = document.createElement('a');
      a.className = 'anchor'; a.href = `#/${p.slug}/${base}`; a.textContent = '#'; a.setAttribute('aria-label', 'Link to this section');
      h.insertBefore(a, h.firstChild);
    });

    // tables scroll on small screens
    $$('table.ref', p.el).forEach((t) => { const w = document.createElement('div'); w.className = 'table-wrap'; t.replaceWith(w); w.appendChild(t); });

    // code groups
    $$('.code-group', p.el).forEach((grp) => {
      const pres = $$(':scope > pre', grp);
      const cg = document.createElement('div'); cg.className = 'cg';
      const tabs = document.createElement('div'); tabs.className = 'cg-tabs'; tabs.setAttribute('role', 'tablist');
      cg.appendChild(tabs);
      pres.forEach((pre, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = pre.dataset.tab || `Tab ${i + 1}`; b.setAttribute('role', 'tab');
        if (!i) b.classList.add('on');
        tabs.appendChild(b);
        const box = wrapPre(pre); if (!i) box.classList.add('on');
        cg.appendChild(box);
        b.addEventListener('click', () => {
          $$('button', tabs).forEach((x) => x.classList.toggle('on', x === b));
          $$(':scope > .cb', cg).forEach((x, j) => x.classList.toggle('on', j === i));
          if (G) G.fromTo($$(':scope > .cb', cg)[i], { autoAlpha: 0 }, { autoAlpha: 1, duration: .25 });
        });
      });
      const copy = copyBtn(() => $(':scope > .cb.on code', cg).textContent);
      tabs.appendChild(copy);
      grp.replaceWith(cg);
    });
    $$('pre', p.el).forEach((pre) => { if (!pre.closest('.cb')) wrapPre(pre, true); });
  });

  function wrapPre(pre, withHead) {
    const box = document.createElement('div');
    box.className = 'cb' + (pre.classList.contains('out') ? ' out' : '');
    const code = $('code', pre);
    const lang = ((code && code.className.match(/language-(\w+)/)) || [])[1] || '';
    const langLabel = { bash: 'bash', json: 'json', yaml: 'yaml', java: 'java', go: 'go', groovy: 'gradle', markup: 'xml', properties: 'ini', text: '' }[lang] ?? lang;
    pre.classList.remove('out');
    if (pre.parentNode) pre.parentNode.insertBefore(box, pre);
    if (withHead !== false) {
      const head = document.createElement('div'); head.className = 'cb-head';
      head.innerHTML = `<span>${esc(pre.dataset.title || (lang === 'text' ? 'output' : lang || 'code'))}</span><span class="cb-lang">${esc(langLabel)}</span>`;
      head.appendChild(copyBtn(() => code.textContent));
      box.appendChild(head);
    }
    box.appendChild(pre);
    return box;
  }
  function copyBtn(get) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cb-copy'; b.textContent = 'copy';
    b.addEventListener('click', async () => {
      const text = get().replace(/\n$/, '');
      try { await navigator.clipboard.writeText(text); }
      catch { const t = Object.assign(document.createElement('textarea'), { value: text }); t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
      b.textContent = 'copied ✓'; b.classList.add('ok');
      setTimeout(() => { b.textContent = 'copy'; b.classList.remove('ok'); }, 1500);
    });
    return b;
  }
  if (window.Prism) window.Prism.highlightAll();

  /* ── sidebar + tabs ───────────────────────────────────── */
  const nav = $('#dNav');
  nav.innerHTML = groups.map((g) => `
    <div class="n-group">
      <p class="n-group-h"><span class="gi">${ICONS[GROUP_ICON[g.name]] || ''}</span>${esc(g.name)}</p>
      <ul class="n-list">${g.pages.map((p) => `<li><a href="#/${p.slug}" data-slug="${p.slug}">${p.el.dataset.title}${p.slug === 'k8s-preview' ? '<span class="n-tag">soon</span>' : ''}</a></li>`).join('')}</ul>
    </div>`).join('');
  const tabsEl = $('#dTabs');
  tabsEl.innerHTML = groups.map((g) => `<a href="#/${g.pages[0].slug}" data-group="${esc(g.name)}"><span class="ti">${ICONS[GROUP_ICON[g.name]] || ''}</span>${esc(g.name)}</a>`).join('') + '<span class="d-tabs-ink"></span>';
  $$('.ti svg', tabsEl).forEach((s) => { s.setAttribute('width', 15); s.setAttribute('height', 15); });
  $$('.gi svg', nav).forEach((s) => { s.setAttribute('width', 14); s.setAttribute('height', 14); });

  const side = $('#dSide'), scrim = $('#dScrim'), burger = $('#dBurger');
  const setDrawer = (open) => { side.classList.toggle('open', open); scrim.classList.toggle('open', open); burger.setAttribute('aria-expanded', String(open)); };
  burger.addEventListener('click', () => setDrawer(!side.classList.contains('open')));
  scrim.addEventListener('click', () => setDrawer(false));

  /* ── router ────────────────────────────────────────────── */
  let current = null;
  const pager = $('#dPager');
  const tocList = $('#dTocList');
  const editLink = $('#dEdit');

  function parseHash() {
    const m = location.hash.match(/^#\/([^/]+)(?:\/(.+))?$/);
    if (m && bySlug[m[1]]) return { slug: m[1], hid: m[2] ? decodeURIComponent(m[2]) : null };
    // legacy plain anchors like #cli-put
    const plain = location.hash.slice(1);
    if (bySlug[plain]) return { slug: plain, hid: null };
    return { slug: pages[0].slug, hid: null };
  }

  function route() {
    const { slug, hid } = parseHash();
    const page = bySlug[slug];
    const changed = current !== page;
    if (changed) {
      if (current) current.el.classList.remove('is-active');
      page.el.classList.add('is-active');
      current = page;
      document.title = `${page.title} — Rune docs`;
      $$('.n-list a').forEach((a) => a.classList.toggle('on', a.dataset.slug === slug));
      $$('a', tabsEl).forEach((a) => a.classList.toggle('on', a.dataset.group === page.group));
      moveTabInk();
      const activeLink = $(`.n-list a[data-slug="${slug}"]`);
      if (activeLink) {
        const r = activeLink.getBoundingClientRect(), sr = side.getBoundingClientRect();
        if (r.top < sr.top + 40 || r.bottom > sr.bottom - 40) side.scrollTop += r.top - sr.top - sr.height / 3;
      }
      buildPager(page);
      buildToc(page);
      editLink.href = `https://github.com/runelock-io/rune/issues/new?title=${encodeURIComponent('Docs: ' + page.title)}`;
      $$('#dFeedback button').forEach((b) => b.classList.remove('sel'));
      $('#dFeedback span').textContent = 'Was this page helpful?';
      setDrawer(false);
      if (G) {
        const kids = [...page.el.children].slice(0, 14);
        G.fromTo(kids, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .5, stagger: .035, ease: 'power3.out', clearProps: 'transform,opacity,visibility' });
      }
    }
    if (hid) {
      const h = page.el.querySelector(`[data-hid="${CSS.escape(hid)}"]`);
      if (h) { requestAnimationFrame(() => h.scrollIntoView({ behavior: changed || reduce ? 'auto' : 'smooth', block: 'start' })); }
    } else if (changed) {
      window.scrollTo(0, 0);
    }
    requestAnimationFrame(spy);
  }

  function moveTabInk() {
    const ink = $('.d-tabs-ink', tabsEl); const on = $('a.on', tabsEl);
    if (!ink || !on) return;
    ink.style.left = on.offsetLeft + 'px'; ink.style.width = on.offsetWidth + 'px';
  }
  window.addEventListener('resize', moveTabInk);

  function buildPager(page) {
    const prev = pages[page.i - 1], next = pages[page.i + 1];
    pager.innerHTML =
      (prev ? `<a class="prev" href="#/${prev.slug}"><small>← previous</small><b>${prev.el.dataset.title}</b></a>` : '<span></span>') +
      (next ? `<a class="next" href="#/${next.slug}"><small>next →</small><b>${next.el.dataset.title}</b></a>` : '');
  }

  let tocItems = [];
  function buildToc(page) {
    const hs = $$('h2[data-hid], h3[data-hid]', page.el);
    tocList.innerHTML = hs.map((h) => `<li class="${h.tagName === 'H3' ? 'l3' : ''}"><a href="#/${page.slug}/${h.dataset.hid}" data-hid="${h.dataset.hid}">${esc(h.textContent.replace(/^#/, ''))}</a></li>`).join('') + '<span class="toc-ink"></span>';
    tocItems = hs.map((h) => ({ h, a: $(`a[data-hid="${CSS.escape(h.dataset.hid)}"]`, tocList) }));
    $('.d-toc-h').style.display = hs.length ? '' : 'none';
  }
  function spy() {
    if (!tocItems.length) return;
    const y = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head-h')) || 102;
    let active = tocItems[0];
    for (const it of tocItems) { if (it.h.getBoundingClientRect().top - y - 30 <= 0) active = it; }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) active = tocItems[tocItems.length - 1];
    tocItems.forEach((it) => it.a.classList.toggle('on', it === active));
    const ink = $('.toc-ink', tocList);
    if (ink && active) { ink.style.top = active.a.parentElement.offsetTop + 'px'; ink.style.height = active.a.parentElement.offsetHeight + 'px'; }
  }
  let spyRaf = 0;
  window.addEventListener('scroll', () => { if (!spyRaf) spyRaf = requestAnimationFrame(() => { spy(); spyRaf = 0; }); }, { passive: true });
  window.addEventListener('hashchange', route);

  /* feedback */
  $$('#dFeedback button').forEach((b) => b.addEventListener('click', () => {
    $$('#dFeedback button').forEach((x) => x.classList.toggle('sel', x === b));
    $('#dFeedback span').textContent = b.dataset.v === 'yes' ? 'Glad it helped.' : 'Thanks — tell us what was missing ↓';
  }));

  /* ── search ────────────────────────────────────────────── */
  const index = [];
  const textOf = (root) => {
    const out = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest('.cb-head, .cg-tabs, .anchor, .card-ico, .doc-crumb') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    while (w.nextNode()) out.push(w.currentNode.nodeValue);
    return out.join(' ').replace(/\s+/g, ' ').trim();
  };
  pages.forEach((p) => {
    const text = textOf(p.el);
    index.push({ p, hid: null, title: p.title, sub: p.desc, text });
    $$('h2[data-hid], h3[data-hid]', p.el).forEach((h) => {
      let body = ''; let n = h.nextElementSibling;
      while (n && !/^H[23]$/.test(n.tagName) && body.length < 400) { body += ' ' + textOf(n); n = n.nextElementSibling; }
      index.push({ p, hid: h.dataset.hid, title: h.textContent.replace(/^#/, ''), sub: body.replace(/\s+/g, ' ').trim(), text: body });
    });
  });

  const modal = $('#dModal'), q = $('#dQuery'), results = $('#dResults');
  let hits = [], sel = 0;
  const openSearch = () => {
    modal.hidden = false; q.value = ''; render(''); q.focus();
    if (G) G.fromTo('.d-modal-box', { y: -10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .25, ease: 'power2.out' });
  };
  const closeSearch = () => { modal.hidden = true; };
  $('#dSearchBtn').addEventListener('click', openSearch);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeSearch(); });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName))) { e.preventDefault(); modal.hidden ? openSearch() : closeSearch(); }
    if (e.key === 'Escape' && !modal.hidden) closeSearch();
  });

  function score(entry, terms) {
    const t = entry.title.toLowerCase(), s = (entry.sub || '').toLowerCase(), x = entry.text.toLowerCase();
    let sc = 0;
    for (const term of terms) {
      if (t.includes(term)) sc += t.startsWith(term) ? 12 : 8;
      else if (s.includes(term)) sc += 4;
      else if (x.includes(term)) sc += 1;
      else return 0;
    }
    if (!entry.hid) sc += 2;
    return sc;
  }
  const mark = (str, terms) => {
    let out = esc(str);
    terms.forEach((t) => { if (t.length > 1) out = out.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>'); });
    return out;
  };
  function snippet(entry, terms) {
    const src = entry.sub || entry.text;
    const low = src.toLowerCase(); const i = Math.max(0, low.indexOf(terms[0] || '') - 40);
    const cut = src.slice(i, i + 140);
    return (i > 0 ? '…' : '') + cut + (src.length > i + 140 ? '…' : '');
  }
  function render(query) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) {
      hits = ['quickstart', 'cli-put', 'tokens-rbac', 'sdk-spring-boot', 'api-secrets', 'troubleshooting'].map((s) => index.find((e) => e.p.slug === s && !e.hid));
    } else {
      hits = index.map((e) => ({ e, s: score(e, terms) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 12).map((x) => x.e);
    }
    sel = 0;
    results.innerHTML = hits.length ? hits.map((e, i) => `<li class="${i === 0 ? 'sel' : ''}" role="option"><a href="#/${e.p.slug}${e.hid ? '/' + e.hid : ''}"><small>${esc(e.p.group)}${e.hid ? ' · ' + esc(e.p.title) : ''}</small><b>${mark(e.title, terms)}</b><span>${mark(terms.length ? snippet(e, terms) : e.sub, terms)}</span></a></li>`).join('')
      : `<li class="empty">No results for “${esc(query)}”. Try <b>rotate</b>, <b>token</b> or <b>sealed</b>.</li>`;
  }
  q.addEventListener('input', () => render(q.value));
  q.addEventListener('keydown', (e) => {
    const items = $$('li[role="option"]', results);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((li, i) => li.classList.toggle('sel', i === sel));
      items[sel]?.scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter' && items[sel]) { e.preventDefault(); location.hash = $('a', items[sel]).getAttribute('href'); closeSearch(); }
  });
  results.addEventListener('click', (e) => { if (e.target.closest('a')) closeSearch(); });

  /* ── go ───────────────────────────────────────────────── */
  route();
  if (G) {
    G.from('.d-top', { yPercent: -100, duration: .6, ease: 'power3.out' });
    G.from('.n-group', { autoAlpha: 0, x: -12, stagger: .05, duration: .5, ease: 'power3.out', delay: .1, clearProps: 'all' });
    G.from('.d-toc > *', { autoAlpha: 0, x: 12, stagger: .08, duration: .5, ease: 'power3.out', delay: .2, clearProps: 'all' });
  }
  window.addEventListener('load', () => { moveTabInk(); spy(); });
})();
