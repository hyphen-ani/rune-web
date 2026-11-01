/* ────────────────────────────────────────────────────────────
   Rune — site behaviour
   GSAP + ScrollTrigger for motion, a tiny in-memory "vault" shared
   by the interactive CLI and the Web UI preview.
   CLI messages mirror the real rune CLI (github.com/runelock-io/rune).
   ──────────────────────────────────────────────────────────── */
(() => {
  'use strict';

  /* ── EDIT ME ─────────────────────────────────────────────── */
  const CONFIG = {
    version: 'v1.0.0-RC',
    webUiCommand: 'rune-server',          // serves the API + Web UI
    webUiUrl: 'http://localhost:2710',    // constants.DefaultPort = 2710, UI lives at /ui/
  };

  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const G = window.gsap && !reduce ? window.gsap : null;
  if (G && window.ScrollTrigger) G.registerPlugin(window.ScrollTrigger);
  if (!G) root.classList.remove('anim');
  window.__runeReady = true;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rand = (n, set = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789') =>
    Array.from({ length: n }, () => set[(Math.random() * set.length) | 0]).join('');
  const hex = (n) => rand(n, '0123456789abcdef');
  const iso = (d) => d.toISOString().slice(0, 19) + 'Z';
  const hms = (d) => d.toTimeString().slice(0, 8);

  $$('[data-ui-cmd]').forEach((el) => (el.textContent = CONFIG.webUiCommand));
  $$('[data-ui-url]').forEach((el) => (el.textContent = CONFIG.webUiUrl));

  /* ── text scramble ───────────────────────────────────────── */
  const GLYPHS = '0123456789abcdef#%&*+=/<>';
  function scramble(el, target, duration = 700) {
    return new Promise((resolve) => {
      if (reduce) { el.textContent = target; return resolve(); }
      const from = el.textContent;
      const len = Math.max(from.length, target.length);
      const start = performance.now();
      const offs = Array.from({ length: len }, () => Math.random() * 0.6);
      const frame = (now) => {
        const p = Math.min(1, (now - start) / duration);
        let out = '';
        for (let i = 0; i < len; i++) {
          const t = target[i] ?? '';
          if (t === '\n' || t === ' ') { out += t; continue; }
          out += p >= offs[i] + 0.4 * (i / len) ? t : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = out;
        if (p < 1) requestAnimationFrame(frame); else { el.textContent = target; resolve(); }
      };
      requestAnimationFrame(frame);
    });
  }

  /* ── nav ─────────────────────────────────────────────────── */
  const navToggle = $('#navToggle');
  const mobileNav = $('#mobileNav');
  navToggle?.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  $$('a', mobileNav).forEach((a) => a.addEventListener('click', () => {
    mobileNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  }));

  /* ── copy buttons ────────────────────────────────────────── */
  $$('.copy-btn').forEach((btn) => btn.addEventListener('click', async () => {
    const src = document.getElementById(btn.dataset.copyTarget);
    if (!src) return;
    const text = src.textContent.split('\n').filter((l) => !/^\s*(#|<!--)/.test(l)).join('\n').trim();
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    btn.textContent = 'copied ✓'; btn.classList.add('is-copied');
    setTimeout(() => { btn.textContent = 'copy'; btn.classList.remove('is-copied'); }, 1600);
  }));

  /* ── tab groups ──────────────────────────────────────────── */
  function tabGroup(tabSel, panelSel, tabKey, panelKey) {
    const tabs = $$(tabSel);
    tabs.forEach((tab) => tab.addEventListener('click', () => {
      tabs.forEach((t) => { t.classList.toggle('is-active', t === tab); t.setAttribute('aria-selected', String(t === tab)); });
      $$(panelSel).forEach((p) => p.classList.toggle('is-active', p.dataset[panelKey] === tab.dataset[tabKey]));
      const active = $$(panelSel).find((p) => p.dataset[panelKey] === tab.dataset[tabKey]);
      if (G && active) G.fromTo($$('pre', active), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .35, stagger: .08, ease: 'power2.out' });
    }));
  }
  tabGroup('#install .tab', '#install .tab-panel', 'tab', 'panel');
  tabGroup('.sdk-tabs .tab', '.sdk-panel', 'sdk', 'sdkPanel');

  /* ── cursor spotlight on the grid ────────────────────────── */
  const spot = $('.grid-spot');
  if (spot && window.matchMedia('(pointer: fine)').matches && !reduce) {
    let raf = 0, mx = 0, my = 0;
    window.addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      document.body.classList.add('has-pointer');
      if (!raf) raf = requestAnimationFrame(() => {
        spot.style.setProperty('--mx', mx + 'px'); spot.style.setProperty('--my', my + 'px'); raf = 0;
      });
    }, { passive: true });
    document.addEventListener('pointerleave', () => document.body.classList.remove('has-pointer'));
  }

  /* ════════════════════════════════════════════════════════════
     THE (DEMO) VAULT — shared by the CLI and the Web UI
     ════════════════════════════════════════════════════════════ */
  const PERMS = ['read', 'write', 'delete', 'rotate'];
  const ago = (days, h = 0) => new Date(Date.now() - days * 864e5 - h * 36e5);
  const Vault = {
    state: null,
    subs: [],
    on(fn) { this.subs.push(fn); },
    emit(evt) { this.subs.forEach((fn) => fn(this.state, evt)); },
    reset() {
      this.state = {
        sealed: true,
        session: 'root',               // which token the CLI is logged in with
        ns: {
          default: {},
          production: {
            'db-password': [
              { value: 'hunter2', at: ago(30, 3) },
              { value: 'hunter2-but-longer', at: ago(22, 7) },
              { value: 'Xk9#p2Lr7!qVt4Wm', at: ago(11, 2) },
            ],
            'redis-url': [{ value: 'redis://cache.internal:6379/0', at: ago(18) }],
          },
          staging: {
            'api-key': [{ value: 'stg_' + rand(18), at: ago(25) }, { value: 'stg_' + rand(18), at: ago(4) }],
            'smtp-pass': [{ value: rand(14), at: ago(9) }],
          },
        },
        tokens: [
          { id: 'root', name: 'root', value: hex(64), perms: { '*': PERMS }, type: 'root', at: ago(31), revoked: false },
          { id: hex(8), name: 'payments-api', value: hex(64), perms: { production: ['read'] }, type: 'system', at: ago(12), revoked: false },
        ],
        audit: [],
      };
      this.log('root', 'server.start', '—', true, ago(0, 1));
      this.emit({ type: 'reset' });
    },
    hasNs(ns) { return Object.prototype.hasOwnProperty.call(this.state.ns, ns); },
    secret(ns, key) { return this.hasNs(ns) ? this.state.ns[ns][key] : undefined; },
    token(ref) { return this.state.tokens.find((t) => !t.revoked && (t.value === ref || t.name === ref || t.id === ref)); },
    can(tokName, perm, ns) {
      const t = this.token(tokName); if (!t) return false;
      return !!((t.perms['*'] && t.perms['*'].includes(perm)) || (t.perms[ns] && t.perms[ns].includes(perm)));
    },
    isRoot(tokName) { const t = this.token(tokName); return !!(t && t.perms['*']); },
    log(actor, action, target, ok, at = new Date()) {
      this.state.audit.push({ at, actor, action, target, ok });
      if (this.state.audit.length > 200) this.state.audit.shift();
    },
    seal(actor) { this.state.sealed = true; this.log(actor, 'vault.seal', '—', true); this.emit({ type: 'seal' }); },
    unseal(actor) { this.state.sealed = false; this.log(actor, 'vault.unseal', '—', true); this.emit({ type: 'unseal' }); },
    put(actor, ns, key, value) {
      const bucket = this.state.ns[ns];
      (bucket[key] ||= []).push({ value, at: new Date() });
      this.log(actor, 'secret.put', `${ns}/${key}`, true);
      this.emit({ type: 'put', ns, key });
      return bucket[key].length;
    },
    rotate(actor, ns, key) {
      const value = rand(20, 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!#%*');
      this.state.ns[ns][key].push({ value, at: new Date(), rotated: true });
      this.log(actor, 'secret.rotate', `${ns}/${key}`, true);
      this.emit({ type: 'rotate', ns, key });
      return { value, version: this.state.ns[ns][key].length };
    },
    read(actor, ns, key) { this.log(actor, 'secret.get', `${ns}/${key}`, true); this.emit({ type: 'audit' }); },
    del(actor, ns, key) {
      const n = this.state.ns[ns][key].length;
      delete this.state.ns[ns][key];
      this.log(actor, 'secret.delete', `${ns}/${key}`, true);
      this.emit({ type: 'delete', ns, key });
      return n;
    },
    createNs(actor, ns) { this.state.ns[ns] = {}; this.log(actor, 'namespace.create', ns, true); this.emit({ type: 'ns', ns }); },
    deleteNs(actor, ns) { delete this.state.ns[ns]; this.log(actor, 'namespace.delete', ns, true); this.emit({ type: 'ns-del', ns }); },
    createToken(actor, name, perms, type = 'user') {
      const tok = { id: hex(8), name, value: hex(64), perms, type, at: new Date(), revoked: false };
      this.state.tokens.push(tok);
      this.log(actor, 'token.create', name, true);
      this.emit({ type: 'token', name });
      return tok;
    },
    revoke(actor, t) { t.revoked = true; this.log(actor, 'token.revoke', t.name, true); this.emit({ type: 'token' }); },
    deny(actor, action, target) { this.log(actor, action, target, false); this.emit({ type: 'audit' }); },
  };

  /* ════════════════════════════════════════════════════════════
     INTERACTIVE CLI
     ════════════════════════════════════════════════════════════ */
  const out = $('#termOut');
  const form = $('#termForm');
  const input = $('#termInput');
  const promptLabel = $('.t-prompt', form);
  const inspBody = $('#inspBody');
  const inspSeal = $('#inspSeal');
  const inspLog = $('#inspLog');
  let mode = 'cmd';
  let busy = false;
  const history = [];
  let hIdx = 0;

  const PROMPT_HTML = '<span class="t-path">~/api</span> <span class="t-caret">❯</span>';
  const ok = (m) => ['ok', '✔ ' + m];
  const err = (m) => ['err', '✖ ' + m];
  const info = (m) => ['acc', '➜ ' + m];
  const mut = (m) => ['mut', m];

  function print(html, cls = '') {
    const d = document.createElement('div');
    d.className = 'ln ' + cls;
    d.innerHTML = html;
    out.appendChild(d);
    while (out.children.length > 400) out.firstChild.remove();
    out.scrollTop = out.scrollHeight;
    return d;
  }
  async function printAll(lines) {
    for (const l of lines) {
      if (typeof l === 'string') print(l); else print(l[1], l[0]);
      if (!reduce) await sleep(24);
    }
  }

  function tokenize(str) {
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g; const res = []; let m;
    while ((m = re.exec(str))) res.push(m[1] ?? m[2] ?? m[3]);
    return res;
  }
  function parse(args) {
    const flags = { nsList: [] }; const pos = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-n' || a === '--namespace') flags.nsList.push(args[++i] ?? '');
      else if (a.startsWith('--namespace=')) flags.nsList.push(a.split('=')[1]);
      else if (a === '--version' || a === '-v') flags.version = args[++i];
      else if (a === '--name') flags.name = args[++i];
      else if (a.startsWith('--name=')) flags.name = a.split('=')[1];
      else if (a.startsWith('-')) flags[a.replace(/^-+/, '')] = true;
      else pos.push(a);
    }
    flags.ns = flags.nsList[0] || 'default';
    return { flags, pos };
  }

  const mask = (v) => '•'.repeat(Math.min(16, Math.max(8, v.length)));
  const AUTH_FAIL = [err('[AUTHENTICATION FAILED] Please login first using: rune login &lt;token&gt;')];
  const SEALED = [err('vault is sealed'), mut('  run <span class="hl">rune unseal</span> first — secrets stay encrypted until you do.')];
  const nsMissing = (ns) => [err(`namespace '${esc(ns)}' not found`), mut('  try <span class="hl">rune namespace list</span>')];
  const forbidden = (perm, ns) => [err(`[FORBIDDEN] token '${esc(Vault.state.session)}' has no '${perm}' permission on '${esc(ns)}'`), mut('  RBAC working as intended. log in with a token that does: <span class="hl">rune login root</span>')];

  const BANNER = [
    ['acc', ' _ __ _   _ _ __   ___ '],
    ['acc', "| '__| | | | '_ \\ / _ \\"],
    ['acc', '| |  | |_| | | | |  __/'],
    ['acc', '|_|   \\__,_|_| |_|\\___|'],
    '',
    '<span class="hl">rune</span> <span class="mut">· local-first secrets, sealed by default</span>',
    mut(CONFIG.version),
    '',
    mut('USAGE'), '  rune &lt;command&gt; [flags]', '',
    mut('VAULT'),
    '  <span class="acc">put       </span> <span class="mut">store and encrypt a secret</span>',
    '  <span class="acc">get       </span> <span class="mut">retrieve and decrypt a secret</span>',
    '  <span class="acc">list      </span> <span class="mut">list stored keys</span>',
    '  <span class="acc">delete    </span> <span class="mut">delete a secret</span>',
    '  <span class="acc">rotate    </span> <span class="mut">generate a new value for a secret</span>',
    '  <span class="acc">history   </span> <span class="mut">show a secret\'s version history</span>',
    '', mut('ACCESS'),
    '  <span class="acc">unseal    </span> <span class="mut">unseal the vault with your passphrase</span>',
    '  <span class="acc">seal      </span> <span class="mut">seal the vault, clearing the key from memory</span>',
    '  <span class="acc">status    </span> <span class="mut">check whether the vault is sealed</span>',
    '', mut('ORG'),
    '  <span class="acc">namespace </span> <span class="mut">manage namespaces (create, list, delete)</span>',
    '  <span class="acc">login     </span> <span class="mut">authenticate with the rune server</span>',
    '  <span class="acc">token     </span> <span class="mut">manage tokens (create, list, revoke)</span>',
    '',
    mut('  demo data lives in <span class="hl">production</span> and <span class="hl">staging</span>. -n picks the namespace.'),
  ];

  function parsePermFlags(list) {
    const result = {};
    for (const f of list) {
      const [nsRaw, permsRaw] = f.split(/:(.*)/s);
      const ns = (nsRaw || '').trim();
      if (!ns) return { error: [err(`[INVALID]: empty namespace in flag "${esc(f)}"`)] };
      let perms = PERMS;
      if (permsRaw !== undefined) {
        perms = permsRaw.split(',').map((p) => p.trim()).filter(Boolean);
        const bad = perms.find((p) => !PERMS.includes(p));
        if (bad) return { error: [err(`[INVALID]: unknown permission "${esc(bad)}" (valid: read, write, delete, rotate)`)] };
        if (!perms.length) return { error: [err(`[INVALID]: no permissions specified for namespace "${esc(ns)}"`)] };
      }
      if (!Vault.hasNs(ns)) return { error: nsMissing(ns) };
      result[ns] = perms;
    }
    return { perms: result };
  }

  function runRune(args) {
    const sub = args[0];
    const { flags, pos } = parse(args.slice(1));
    const S = Vault.state;
    const me = S.session;
    const ns = flags.ns;

    if (sub === undefined || sub === 'help' || sub === '--help' || sub === '-h') return BANNER;
    if (sub === '--version' || sub === '-v' || sub === 'version') return [`rune ${CONFIG.version}`];
    if (sub === 'status') return [S.sealed ? '🔒 Vault is Sealed' : '🔓 Vault is Unsealed'];
    if (sub === 'ui' || sub === 'server') return serverBanner();

    if (sub === 'unseal') {
      if (pos[0]) { Vault.unseal(me || 'anonymous'); return [ok('Vault Unsealed Successfully'), mut('  (passphrase as an argument? it lands in shell history. the real CLI only prompts.)')]; }
      mode = 'secret';
      input.classList.add('secret');
      input.placeholder = 'type anything — it\'s a demo';
      promptLabel.innerHTML = '<span class="t-path">passphrase</span> <span class="t-caret">›</span>';
      return [mut('Enter passphrase:')];
    }

    if (sub === 'login') {
      const ref = pos[0];
      if (!ref) return [err('accepts 1 arg(s), received 0'), mut('  usage: rune login &lt;token&gt;   (demo also accepts a token name)')];
      const t = Vault.token(ref);
      S.session = t ? t.name : null;
      Vault.emit({ type: 'session' });
      const lines = [ok('Token saved successfully')];
      if (t) lines.push(mut(`  now acting as <span class="hl">${esc(t.name)}</span> · ${permSummary(t)}`));
      else lines.push(mut('  heads up: the server doesn\'t recognise that token. next command will bounce.'));
      return lines;
    }

    // everything below talks to the server with a token
    if (!me || !Vault.token(me)) return AUTH_FAIL;

    if (sub === 'seal') { Vault.seal(me); return [ok('Vault Sealed Successfully'), mut('  key cleared from memory. go touch grass.')]; }

    const vaultOps = ['put', 'get', 'list', 'ls', 'rotate', 'history', 'delete', 'rm', 'namespace', 'ns', 'token'];
    if (vaultOps.includes(sub) && S.sealed) return SEALED;

    const needSecret = (perm, action) => {
      const key = pos[0];
      if (!key) return { e: [err(`accepts 1 arg(s), received 0`), mut(`  usage: rune ${sub} &lt;key&gt; [-n namespace]`)] };
      if (!Vault.hasNs(ns)) return { e: nsMissing(ns) };
      if (!Vault.can(me, perm, ns)) { Vault.deny(me, action, `${ns}/${key}`); return { e: forbidden(perm, ns) }; }
      return { key };
    };

    switch (sub) {
      case 'put': {
        const key = pos[0]; const value = pos.slice(1).join(' ');
        if (!key || !value) return [err('usage: rune put &lt;key&gt; &lt;value&gt; [-n namespace]')];
        if (!Vault.hasNs(ns)) return nsMissing(ns);
        if (!Vault.can(me, 'write', ns)) { Vault.deny(me, 'secret.put', `${ns}/${key}`); return forbidden('write', ns); }
        const v = Vault.put(me, ns, key, value);
        return [ok('Secret stored successfully'), mut(`  ${esc(ns)}/${esc(key)} · v${v}${v > 1 ? ' · previous version kept' : ''}`)];
      }
      case 'get': {
        const r = needSecret('read', 'secret.get'); if (r.e) return r.e;
        const s = Vault.secret(ns, r.key);
        if (!s) return [err(`secret not found: ${esc(ns)}/${esc(r.key)}`)];
        Vault.read(me, ns, r.key);
        if (flags.version) {
          const n = parseInt(flags.version, 10);
          if (!s[n - 1]) return [err(`version ${esc(flags.version)} not found (latest: ${s.length})`)];
          return [['acc', esc(s[n - 1].value)]];
        }
        return [['acc', esc(s[s.length - 1].value)]];
      }
      case 'list': case 'ls': {
        if (!Vault.hasNs(ns)) return nsMissing(ns);
        if (!Vault.can(me, 'read', ns)) { Vault.deny(me, 'secret.list', ns); return forbidden('read', ns); }
        const keys = Object.keys(S.ns[ns]);
        if (!keys.length) return [info('No stored keys found')];
        return ['', 'Stored Secrets:', '', ...keys.map((k) => `  [SECRET] ${esc(k)}`)];
      }
      case 'rotate': {
        const r = needSecret('rotate', 'secret.rotate'); if (r.e) return r.e;
        if (!Vault.secret(ns, r.key)) return [err(`secret not found: ${esc(ns)}/${esc(r.key)}`)];
        const { value } = Vault.rotate(me, ns, r.key);
        const line = '  <span class="mut">' + '─'.repeat(45) + '</span>';
        return ['', '  SECRET ROTATED', line, `  Namespace:   ${esc(ns)}`, `  Key:         ${esc(r.key)}`, `  New Value:   <span class="acc">${esc(value)}</span>`, line, '', ok('Secret rotated successfully')];
      }
      case 'history': {
        const r = needSecret('read', 'secret.history'); if (r.e) return r.e;
        const s = Vault.secret(ns, r.key);
        if (!s) return [err(`secret not found: ${esc(ns)}/${esc(r.key)}`)];
        Vault.read(me, ns, r.key);
        const line = '  <span class="mut">' + '─'.repeat(57) + '</span>';
        return ['', '  SECRET HISTORY', line, mut('  VERSION    CREATED                   ROTATED'), line,
          ...s.map((x, i) => `  ${String(i + 1).padEnd(10)} ${iso(x.at).padEnd(25)} ${i === 0 ? '-' : iso(x.at)}`), line];
      }
      case 'delete': case 'rm': {
        const r = needSecret('delete', 'secret.delete'); if (r.e) return r.e;
        if (!Vault.secret(ns, r.key)) return [err(`secret not found: ${esc(ns)}/${esc(r.key)}`)];
        const n = Vault.del(me, ns, r.key);
        return [ok('Secret deleted'), mut(`  ${n} version${n > 1 ? 's' : ''} removed with it. nothing lingers.`)];
      }
      case 'namespace': case 'ns': {
        const action = pos[0];
        if (!action) return [mut('usage: rune namespace [create|list|delete]')];
        if (action === 'list' || action === 'ls') {
          return ['', 'Namespaces:', '', ...Object.keys(S.ns).map((n) => `[NAMESPACES] ${esc(n)}`)];
        }
        if (!Vault.isRoot(me)) { Vault.deny(me, 'namespace.' + action, pos[1] || '—'); return [err(`[FORBIDDEN] namespace management needs the root token`)]; }
        const name = pos[1];
        if (action === 'create') {
          if (!name || !/^[a-z0-9][a-z0-9-_]*$/i.test(name)) return [err('accepts 1 arg(s): rune namespace create &lt;name&gt;')];
          if (Vault.hasNs(name)) return [err(`namespace already exists: ${esc(name)}`)];
          Vault.createNs(me, name);
          return [ok('[NAMESPACE CREATED] Created namespace')];
        }
        if (action === 'delete') {
          if (name === 'default') return [err('Cannot delete default namespace')];
          if (!Vault.hasNs(name)) return nsMissing(name || '');
          Vault.deleteNs(me, name);
          return [mut(`Are you sure you want to delete namespace '${esc(name)}'? (y/N): y`), ok('Namespace deleted')];
        }
        return [err(`unknown command "${esc(action)}" for "rune namespace"`)];
      }
      case 'token': {
        const action = pos[0];
        if (!action) return [mut('usage: rune token [create|list|revoke]')];
        if (action === 'list' || action === 'ls') {
          const rows = S.tokens.map((t) => `  ${t.id.padEnd(10)} ${esc(t.name).padEnd(14)} ${iso(t.at).padEnd(21)} ${t.type.padEnd(7)} ${t.revoked ? '<span class="err">revoked</span>' : '<span class="ok">active</span>'}`);
          return ['', 'Tokens:', '', mut(`  ${'ID'.padEnd(10)} ${'NAME'.padEnd(14)} ${'CREATED AT'.padEnd(21)} ${'TYPE'.padEnd(7)} STATUS`), mut('  ' + '-'.repeat(64)), ...rows, ''];
        }
        if (!Vault.isRoot(me)) { Vault.deny(me, 'token.' + action, pos[1] || '—'); return [err(`[FORBIDDEN] token management needs the root token`)]; }
        if (action === 'create') {
          const name = pos[1] || flags.name || 'default';
          if (!flags.nsList.length) return [err('[INVALID]: Provide at least one namespace with -n (e.g. -n default:read,write)')];
          const r = parsePermFlags(flags.nsList); if (r.error) return r.error;
          const t = Vault.createToken(me, name, r.perms);
          return [ok('Token created successfully'), '',
            `  ID:          ${t.id}`, `  Name:        ${esc(t.name)}`, `  Created At:  ${iso(t.at)}`, '',
            ...Object.entries(t.perms).map(([n, p]) => `  ${esc(n).padEnd(20)} ${p.join(', ')}`), '',
            `  Token: <span class="acc">${t.value}</span>`, '',
            mut(`  try <span class="hl">rune login ${esc(t.name)}</span> — then try something it isn't allowed to do.`)];
        }
        if (action === 'revoke') {
          const t = Vault.token(pos[1] || '');
          if (!t) return [err('token not found')];
          if (t.type === 'root') return [err('refusing to revoke the root token. we like you too much.')];
          Vault.revoke(me, t);
          return [ok('Token revoked')];
        }
        return [err(`unknown command "${esc(action)}" for "rune token"`)];
      }
      default:
        return [err(`unknown command "${esc(sub)}" for "rune"`), mut('  run <span class="hl">rune help</span> for the (short) list.')];
    }
  }

  function permSummary(t) {
    return Object.entries(t.perms).map(([n, p]) => `${n === '*' ? 'everything' : n}:${p.length === 4 ? 'all' : p.join(',')}`).join(' · ');
  }

  function serverBanner() {
    return ['',
      '  <span class="hl">rune</span>  <span class="mut">local-first secrets vault</span>', '',
      `  <span class="acc">➜</span>  api    <span class="ok">${esc(CONFIG.webUiUrl)}</span>`,
      `  <span class="acc">➜</span>  ui     <a href="#web-ui">${esc(CONFIG.webUiUrl)}/ui/</a>`, '',
      `  <span class="warn">⬡  vault ${Vault.state.sealed ? 'sealed' : 'unsealed'}</span>  —  run <span class="hl">rune unseal</span> or open the web UI`,
      mut('  (in this demo it\'s already running — scroll down, the web ui shares this vault.)')];
  }

  function easterEgg(line, args) {
    const c = args[0];
    if (c === 'vault') return [['err', 'zsh: command not found: vault'], mut('  …which means you\'re in the right place.')];
    if (c === 'sudo') return [['warn', 'nice try. rune doesn\'t need root to keep a secret. (well, a root token. different thing.)']];
    if (c === 'ls') return ['secrets.txt   passwords-FINAL-final.xlsx   .env', mut('kidding. try <span class="hl">rune list -n production</span>')];
    if (c === 'cat' && /\.env/.test(line)) return [['warn', 'cat: .env: retired. it lives in rune now.']];
    if (c === 'git' && args[1] === 'push') return [err('pushing secrets to git? not on our watch.')];
    if (c === 'rm' && /-rf/.test(line)) return [err('absolutely not.')];
    if (c === 'whoami') return [Vault.state.session ? `${esc(Vault.state.session)} <span class="mut">(rune token)</span>` : 'nobody. try rune login root'];
    if (c === 'exit' || c === 'logout') return [mut('there is no exit. only <span class="hl">rune seal</span>.')];
    if (c === 'echo') return [esc(args.slice(1).join(' '))];
    if (c === 'pwd') return ['/Users/you/projects/api'];
    if (c === 'kubectl') return [['warn', 'k8s secret mapping + the auto injector land in the next release. hold that thought.']];
    if (c === 'mvn' || c === 'gradle' || c === './mvnw' || c === './gradlew') return [mut('BUILD SUCCESS'), mut('  ${rune.db-password} resolved by rune-spring-boot-starter. see the java sdk section ↓')];
    if (c === 'history') return history.length ? history.map((h, i) => `${String(i + 1).padStart(4)}  ${esc(h)}`) : [mut('(empty)')];
    if (c === 'curl' && /install\.sh/.test(line)) return [mut('Detected OS: darwin'), mut('Detected ARCH: arm64'), mut('Downloading Rune...'), mut('Installing Rune...'), '', ['ok', 'Rune installed successfully'], mut('  (well, it would be — in a real terminal.)')];
    return null;
  }

  async function execute(raw) {
    const line = raw.trim();

    if (mode === 'secret') {
      print('<span class="t-path">passphrase</span> <span class="t-caret">›</span> ' + (line ? '' : ''), 'cmd');
      mode = 'cmd';
      input.classList.remove('secret');
      input.placeholder = '';
      promptLabel.innerHTML = PROMPT_HTML;
      if (!line) { await printAll([err('empty passphrase. bold strategy.'), mut('  run rune unseal to try again.')]); return; }
      Vault.unseal(Vault.state.session || 'anonymous');
      await printAll([ok('Vault Unsealed Successfully'), mut('  (any passphrase works in the demo. the real one is pickier.)')]);
      logInspector('rune unseal');
      return;
    }

    print(`${PROMPT_HTML} ${esc(line)}`, 'cmd');
    if (!line) return;
    history.push(line); hIdx = history.length;

    const args = tokenize(line);
    let res;
    if (args[0] === 'clear' || args[0] === 'cls') { out.innerHTML = ''; return; }
    if (args[0] === 'help') res = BANNER;
    else if (args[0] === 'rune') res = runRune(args.slice(1));
    else if (args[0] === CONFIG.webUiCommand || args[0] === 'rune-server') res = serverBanner();
    else res = easterEgg(line, args) || [['err', `zsh: command not found: ${esc(args[0])}`], mut('  try <span class="hl">help</span>')];

    await printAll(res);
    logInspector(line);
  }

  function logInspector(line) { inspLog.textContent = '› ' + line; }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const v = input.value; input.value = '';
    busy = true; await execute(v); busy = false;
  });
  input.addEventListener('keydown', (e) => {
    if (mode !== 'cmd') return;
    if (e.key === 'ArrowUp' && history.length) { hIdx = Math.max(0, hIdx - 1); input.value = history[hIdx]; e.preventDefault(); }
    if (e.key === 'ArrowDown') { hIdx = Math.min(history.length, hIdx + 1); input.value = history[hIdx] || ''; e.preventDefault(); }
    if (e.key === 'Tab') {
      e.preventDefault();
      const opts = ['rune status', 'rune unseal', 'rune seal', 'rune put ', 'rune get ', 'rune list', 'rune rotate ', 'rune history ', 'rune delete ', 'rune namespace list', 'rune namespace create ', 'rune token create ', 'rune token list', 'rune token revoke ', 'rune login ', CONFIG.webUiCommand, 'clear', 'help'];
      const m = opts.find((o) => o.startsWith(input.value) && o !== input.value);
      if (m) input.value = m;
    }
    if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
  });
  $('#term').addEventListener('click', (e) => { if (!e.target.closest('a,button') && !window.getSelection().toString()) input.focus({ preventScroll: true }); });

  $$('#chips button').forEach((b) => b.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    if (mode === 'secret') {
      mode = 'cmd'; input.classList.remove('secret'); input.placeholder = ''; promptLabel.innerHTML = PROMPT_HTML;
      print('^C', 'mut');
    }
    const cmd = b.dataset.cmd;
    input.value = '';
    if (!reduce) for (const ch of cmd) { input.value += ch; await sleep(12 + Math.random() * 16); }
    else input.value = cmd;
    await sleep(120);
    input.value = '';
    await execute(cmd);
    if (mode === 'secret') {
      await sleep(350);
      const fake = 'correct-horse-battery';
      if (!reduce) for (let i = 1; i <= fake.length; i++) { input.value = fake.slice(0, i); await sleep(22); }
      input.value = '';
      await execute(fake);
    }
    busy = false;
    if (window.matchMedia('(pointer: fine)').matches) input.focus({ preventScroll: true });
  }));

  $('#termReset').addEventListener('click', () => {
    Vault.reset();
    mode = 'cmd'; input.classList.remove('secret'); promptLabel.innerHTML = PROMPT_HTML;
    out.innerHTML = '';
    boot();
  });

  function boot() {
    print(`<span class="hl">rune ${CONFIG.version}</span> <span class="mut">— interactive demo · simulated · runs in this tab</span>`);
    print(`<span class="t-path">~/api</span> <span class="t-caret">❯</span> rune login <span class="mut">&lt;root-token&gt;</span>`, 'cmd');
    print('<span class="ok">✔ Token saved successfully</span>');
    print('<span class="mut">vault status:</span> <span class="err">sealed</span><span class="mut">. type</span> <span class="hl">help</span><span class="mut">, or click a command below — start with</span> <span class="hl">rune unseal</span>');
    print('');
  }

  /* inspector */
  function renderInspector(S, evt) {
    inspSeal.classList.toggle('open', !S.sealed);
    $('b', inspSeal).textContent = S.sealed ? 'SEALED' : 'UNSEALED';
    inspBody.classList.toggle('sealed', S.sealed);
    const sess = S.session && Vault.token(S.session);
    let html = `<div class="ins-session"><span>session</span><b class="${sess && sess.type === 'root' ? '' : 'scoped'}">${sess ? esc(sess.name) : 'logged out'}</b></div>`;
    html += '<p class="ins-label">audit log · latest</p>';
    html += S.audit.slice(-3).reverse().map((a) => `<div class="ins-aud ${a.ok ? '' : 'no'}"><span>${hms(a.at)}</span><span>${esc(a.actor)}</span><span>${esc(a.action)}</span><span>${a.ok ? 'ok' : 'denied'}</span></div>`).join('');
    html += '<p class="ins-label">namespaces</p>';
    for (const [ns, secrets] of Object.entries(S.ns)) {
      html += `<div class="ins-ns" data-ns="${esc(ns)}"><div class="ns-name">${esc(ns)}</div>`;
      const keys = Object.keys(secrets);
      if (!keys.length) html += '<div class="ins-sec ins-empty">empty</div>';
      for (const k of keys) {
        const n = secrets[k].length;
        html += `<div class="ins-sec" data-key="${esc(ns)}/${esc(k)}"><span>${esc(k)}</span><span class="vers">${'<i></i>'.repeat(Math.min(n, 8))}<span class="vtxt">v${n}</span></span></div>`;
      }
      html += '</div>';
    }
    html += '<p class="ins-label">tokens</p>';
    html += S.tokens.filter((t) => !t.revoked).map((t) => `<div class="ins-tok${t.name === S.session ? ' me' : ''}"><span>${esc(t.name)}<em>${t.type}</em></span><span>${esc(permSummary(t))}</span></div>`).join('');
    inspBody.innerHTML = html;

    if (evt && evt.key) {
      const el = inspBody.querySelector(`[data-key="${CSS.escape(evt.ns + '/' + evt.key)}"]`);
      if (el) {
        el.classList.add('flash');
        const top = el.offsetTop - inspBody.offsetTop;
        if (top < inspBody.scrollTop || top > inspBody.scrollTop + inspBody.clientHeight - 30) inspBody.scrollTop = top - 40;
      }
    }
    if (evt && evt.type === 'ns') inspBody.querySelector(`[data-ns="${CSS.escape(evt.ns)}"]`)?.classList.add('flash');
    if (evt && (evt.type === 'audit' || evt.type === 'token' || evt.type === 'session')) {
      inspBody.querySelector('.ins-aud')?.classList.add('flash');
    }
    if (evt && (evt.type === 'seal' || evt.type === 'unseal') && G) {
      G.fromTo(inspSeal, { scale: 1.25 }, { scale: 1, duration: .5, ease: 'back.out(3)' });
    }
  }
  Vault.on(renderInspector);

  /* ════════════════════════════════════════════════════════════
     WEB UI PREVIEW (same vault, acting as root)
     ════════════════════════════════════════════════════════════ */
  const UI_ACTOR = 'root@web-ui';
  const ui = {
    ns: 'production', view: 'secrets',
    nsNav: $('#uiNs'), head: $('#uiHead'), rows: $('#uiRows'), name: $('#uiNsName'), count: $('#uiCount'), crumb: $('.ui-crumb'),
    sealed: $('#uiSealed'), sealBadge: $('#uiSealBadge'), sealBtn: $('#uiSealBtn'), newBtn: $('#uiNew'),
    toast: $('#uiToast'), tok: $('#uiTokCount'), aud: $('#uiAuditCount'), path: $('#brPath'),
  };
  const ICON = {
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    rot: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  };
  let toastT;
  function toast(msg) {
    ui.toast.textContent = msg;
    clearTimeout(toastT);
    if (G) G.fromTo(ui.toast, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .3, ease: 'power2.out' });
    else ui.toast.style.opacity = 1;
    toastT = setTimeout(() => { if (G) G.to(ui.toast, { autoAlpha: 0, y: 8, duration: .3 }); else ui.toast.style.opacity = 0; }, 2400);
  }

  let lastSealed = null;
  function renderUI(S, evt) {
    if (!Vault.hasNs(ui.ns)) ui.ns = 'production' in S.ns ? 'production' : Object.keys(S.ns)[0];
    if (evt && evt.type === 'put' && evt.ns !== ui.ns) { ui.ns = evt.ns; ui.view = 'secrets'; }   // follow terminal activity

    ui.nsNav.innerHTML = Object.keys(S.ns).map((n) =>
      `<button type="button" class="${ui.view === 'secrets' && n === ui.ns ? 'on' : ''}" data-ns="${esc(n)}">${esc(n)} <em>${S.sealed ? '·' : Object.keys(S.ns[n]).length}</em></button>`).join('');
    $$('.ui-link[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === ui.view));
    ui.tok.textContent = S.sealed ? '·' : S.tokens.filter((t) => !t.revoked).length;
    ui.aud.textContent = S.sealed ? '·' : S.audit.length;

    if (ui.view === 'secrets') {
      const secrets = S.ns[ui.ns]; const keys = Object.keys(secrets);
      ui.crumb.innerHTML = `namespaces / <b>${esc(ui.ns)}</b>`;
      ui.path.textContent = '/ui/';
      ui.count.textContent = S.sealed ? 'sealed' : `${keys.length} secret${keys.length === 1 ? '' : 's'}`;
      ui.newBtn.hidden = false; ui.newBtn.textContent = '+ New secret';
      ui.head.innerHTML = '<div class="ui-tr cols-sec head" role="row"><span role="columnheader">key</span><span role="columnheader">value</span><span role="columnheader">ver</span><span role="columnheader"></span></div>';
      ui.rows.innerHTML = keys.length ? keys.map((k) => {
        const v = secrets[k];
        return `<div class="ui-tr cols-sec" role="row" data-key="${esc(k)}">
          <span class="key" role="cell">${esc(k)}</span>
          <span class="val" role="cell">${S.sealed ? '░░░░░░░░░░░░' : mask(v[v.length - 1].value)}</span>
          <span class="ver" role="cell">v${v.length}</span>
          <span class="acts" role="cell">
            <button type="button" data-act="reveal" title="Reveal" aria-label="Reveal ${esc(k)}">${ICON.eye}</button>
            <button type="button" data-act="rotate" title="Rotate" aria-label="Rotate ${esc(k)}">${ICON.rot}</button>
            <button type="button" data-act="delete" title="Delete" aria-label="Delete ${esc(k)}">${ICON.del}</button>
          </span></div>`;
      }).join('') : '<div class="ui-empty">no secrets in this namespace.<br>suspiciously clean.</div>';
    }

    if (ui.view === 'tokens') {
      const toks = S.tokens.filter((t) => !t.revoked);
      ui.crumb.innerHTML = 'manage / <b>tokens</b>';
      ui.count.textContent = `${toks.length} active token${toks.length === 1 ? '' : 's'}`;
      ui.newBtn.hidden = false; ui.newBtn.textContent = '+ New token';
      ui.head.innerHTML = '<div class="ui-tr cols-tok head" role="row"><span role="columnheader">name · type</span><span role="columnheader">permissions</span><span role="columnheader">created</span></div>';
      ui.rows.innerHTML = toks.map((t) => `<div class="ui-tr cols-tok" role="row" data-tok="${esc(t.name)}">
        <span role="cell"><span class="key">${esc(t.name)}</span><br><span class="dimtxt">${t.type}</span></span>
        <span role="cell">${Object.entries(t.perms).map(([n, p]) => `<span class="perm ns">${n === '*' ? '* all namespaces' : esc(n)}</span>${p.map((x) => `<span class="perm">${x}</span>`).join('')}`).join('<br>')}</span>
        <span role="cell" class="dimtxt">${t.at.toISOString().slice(0, 10)}</span></div>`).join('');
    }

    if (ui.view === 'audit') {
      const rows = S.audit.slice(-12).reverse();
      ui.crumb.innerHTML = 'manage / <b>audit log</b>';
      ui.count.textContent = `${S.audit.length} event${S.audit.length === 1 ? '' : 's'}`;
      ui.newBtn.hidden = true;
      ui.head.innerHTML = '<div class="ui-tr cols-aud head" role="row"><span role="columnheader">time</span><span role="columnheader">actor</span><span role="columnheader">action</span><span role="columnheader">target</span><span role="columnheader">result</span></div>';
      ui.rows.innerHTML = rows.map((a) => `<div class="ui-tr cols-aud" role="row">
        <span role="cell" class="dimtxt">${hms(a.at)}</span><span role="cell">${esc(a.actor)}</span>
        <span role="cell" class="ver">${esc(a.action.split('.')[1] || a.action)}</span><span role="cell" class="key">${esc(a.target)}</span>
        <span role="cell" class="${a.ok ? 'res-ok' : 'res-no'}">${a.ok ? 'ok' : 'deny'}</span></div>`).join('');
    }

    ui.sealBadge.classList.toggle('open', !S.sealed);
    $('b', ui.sealBadge).textContent = S.sealed ? 'SEALED' : 'UNSEALED';
    ui.sealBtn.textContent = S.sealed ? 'Unseal' : 'Seal vault';
    if (lastSealed !== S.sealed) {
      ui.sealed.classList.toggle('hidden', !S.sealed);
      if (G) G.to(ui.sealed, { autoAlpha: S.sealed ? 1 : 0, duration: lastSealed === null ? 0 : .45, ease: 'power2.out' });
      else ui.sealed.style.display = S.sealed ? 'flex' : 'none';
      lastSealed = S.sealed;
    }

    if (evt && evt.key && evt.ns === ui.ns && ui.view === 'secrets') ui.rows.querySelector(`[data-key="${CSS.escape(evt.key)}"]`)?.classList.add('flash');
    if (evt && ui.view === 'audit' && evt.type !== 'reset') ui.rows.firstElementChild?.classList.add('flash');
    if (evt && evt.type === 'token' && evt.name && ui.view === 'tokens') ui.rows.querySelector(`[data-tok="${CSS.escape(evt.name)}"]`)?.classList.add('flash');
  }
  Vault.on(renderUI);

  const swap = () => { if (G) G.from('#uiRows .ui-tr', { autoAlpha: 0, x: -8, stagger: .03, duration: .3 }); };
  ui.nsNav.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-ns]'); if (!b) return;
    ui.ns = b.dataset.ns; ui.view = 'secrets'; renderUI(Vault.state); swap();
  });
  $$('.ui-link[data-view]').forEach((b) => b.addEventListener('click', () => {
    ui.view = b.dataset.view; renderUI(Vault.state); swap();
  }));
  ui.rows.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]'); if (!b || Vault.state.sealed) return;
    const key = b.closest('.ui-tr').dataset.key;
    const s = Vault.secret(ui.ns, key);
    if (b.dataset.act === 'reveal') {
      const val = b.closest('.ui-tr').querySelector('.val');
      Vault.read(UI_ACTOR, ui.ns, key);
      if (!val.offsetParent) { toast(`${key} = ${s[s.length - 1].value}`); return; }
      if (val.classList.contains('shown')) return;
      val.classList.add('shown');
      await scramble(val, s[s.length - 1].value, 600);
      setTimeout(() => { if (val.isConnected) { val.classList.remove('shown'); scramble(val, mask(s[s.length - 1].value), 400); } }, 2600);
    }
    if (b.dataset.act === 'rotate') {
      const { version } = Vault.rotate(UI_ACTOR, ui.ns, key);
      toast(`✔ rotated ${key} · v${version}`);
      tlog(`rune rotate ${key} -n ${ui.ns}`, [ok('Secret rotated successfully')]);
    }
    if (b.dataset.act === 'delete') {
      const n = Vault.del(UI_ACTOR, ui.ns, key);
      toast(`✔ deleted ${key} · ${n} version${n > 1 ? 's' : ''}`);
      tlog(`rune delete ${key} -n ${ui.ns}`, [ok('Secret deleted')]);
    }
  });
  let newCount = 0, tokCount = 0;
  ui.newBtn.addEventListener('click', () => {
    if (Vault.state.sealed) return;
    if (ui.view === 'tokens') {
      const name = ['billing-svc', 'ci-runner', 'analytics-ro', 'cron-rotator'][tokCount++ % 4] + (tokCount > 4 ? '-' + tokCount : '');
      const perms = { production: tokCount % 2 ? ['read'] : ['read', 'rotate'] };
      Vault.createToken(UI_ACTOR, name, perms, tokCount % 2 ? 'system' : 'user');
      toast(`✔ token ${name} created · production:${perms.production.join(',')}`);
      tlog(`rune token create ${name} -n production:${perms.production.join(',')}`, [ok('Token created successfully')]);
      return;
    }
    const key = ['jwt-secret', 'openai-key', 'webhook-signing', 's3-access-key', 'sentry-dsn'][newCount++ % 5] + (newCount > 5 ? '-' + newCount : '');
    Vault.put(UI_ACTOR, ui.ns, key, rand(22));
    toast(`✔ created ${key} · v1`);
    tlog(`rune put ${key} •••••• -n ${ui.ns}`, [ok('Secret stored successfully')]);
  });
  const toggleSeal = () => {
    const was = Vault.state.sealed;
    was ? Vault.unseal(UI_ACTOR) : Vault.seal(UI_ACTOR);
    toast(was ? '✔ vault unsealed' : '✔ vault sealed');
    tlog(was ? 'rune unseal' : 'rune seal', [ok(was ? 'Vault Unsealed Successfully' : 'Vault Sealed Successfully')]);
  };
  ui.sealBtn.addEventListener('click', toggleSeal);
  $('#uiUnseal').addEventListener('click', toggleSeal);

  function tlog(cmd, lines) {
    print(`${PROMPT_HTML} <span class="mut">${esc(cmd)}  # via web ui</span>`, 'cmd');
    lines.forEach((l) => (typeof l === 'string' ? print(l) : print(l[1], l[0])));
    logInspector(cmd + '  (web ui)');
  }

  Vault.reset();
  boot();

  /* ════════════════════════════════════════════════════════════
     HERO SPECIMEN — sealed ⇄ unsealed loop
     ════════════════════════════════════════════════════════════ */
  const cipherEl = $('#specCipher');
  const stateEl = $('#specState');
  const lockSvg = $('.lock-svg');
  const cipherBlock = () => Array.from({ length: 4 }, () => Array.from({ length: 6 }, () => hex(4)).join(' ')).join('\n');
  const PLAIN = 'postgres://app:\n  ••••••••••••••\n@db.internal:5432/core\n-- decrypted · v3 --';
  if (cipherEl) cipherEl.textContent = cipherBlock();

  const ticks = $('.ticks', lockSvg);
  if (ticks) {
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2; const r1 = 58, r2 = i % 3 ? 61 : 64;
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', 60 + Math.cos(a) * r1); l.setAttribute('y1', 60 + Math.sin(a) * r1);
      l.setAttribute('x2', 60 + Math.cos(a) * r2); l.setAttribute('y2', 60 + Math.sin(a) * r2);
      ticks.appendChild(l);
    }
  }

  if (G && cipherEl) {
    let sealed = true;
    setInterval(() => {
      if (!sealed || document.hidden) return;
      const chars = cipherEl.textContent.split('');
      for (let k = 0; k < 6; k++) {
        const i = (Math.random() * chars.length) | 0;
        if (/[0-9a-f]/.test(chars[i])) chars[i] = '0123456789abcdef'[(Math.random() * 16) | 0];
      }
      cipherEl.textContent = chars.join('');
    }, 110);

    G.to('.lock-svg .r1', { rotation: 360, svgOrigin: '60 60', duration: 40, repeat: -1, ease: 'none' });
    G.to('.lock-svg .r2', { rotation: -360, svgOrigin: '60 60', duration: 18, repeat: -1, ease: 'none' });
    G.to('.lock-svg .ticks', { rotation: 360, svgOrigin: '60 60', duration: 90, repeat: -1, ease: 'none' });

    const cycle = async () => {
      await sleep(2600);
      sealed = false;
      stateEl.textContent = 'UNSEALED'; stateEl.classList.add('open');
      G.to('.lock-svg .shackle', { y: -7, duration: .5, ease: 'back.out(3)' });
      G.to('.lock-svg .r2', { stroke: '#17864a', duration: .4 });
      await scramble(cipherEl, PLAIN, 900);
      await sleep(2600);
      stateEl.textContent = 'SEALED'; stateEl.classList.remove('open');
      G.to('.lock-svg .shackle', { y: 0, duration: .35, ease: 'power3.in' });
      G.to('.lock-svg .r2', { stroke: '#cb503d', duration: .4 });
      await scramble(cipherEl, cipherBlock(), 700);
      sealed = true;
      cycle();
    };
    cycle();
  }

  /* ════════════════════════════════════════════════════════════
     TICKER
     ════════════════════════════════════════════════════════════ */
  const track = $('#tickerTrack');
  if (track) {
    track.innerHTML += track.innerHTML;
    $$('span', track).slice(track.children.length / 2).forEach((s) => s.setAttribute('aria-hidden', 'true'));
    if (G) {
      const loop = G.to(track, { xPercent: -50, duration: 70, ease: 'none', repeat: -1 });
      if (window.ScrollTrigger) {
        let settle;
        ScrollTrigger.create({
          onUpdate(self) {
            const v = self.getVelocity();
            const boost = 1 + Math.min(Math.abs(v) / 250, 6);
            G.to(loop, { timeScale: v < 0 ? -boost : boost, duration: .2, overwrite: true });
            clearTimeout(settle);
            settle = setTimeout(() => G.to(loop, { timeScale: v < 0 ? -1 : 1, duration: 1.2, ease: 'power2.out', overwrite: true }), 120);
          },
        });
      }
    }
  }

  /* ════════════════════════════════════════════════════════════
     GSAP — intro + scroll choreography
     ════════════════════════════════════════════════════════════ */
  function splitWords(el) {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            const i = document.createElement('span'); i.textContent = part;
            w.appendChild(i); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
    return $$('.w > span', el);
  }

  if (!G) return;
  const ST = window.ScrollTrigger;

  const hero = $('.hero');
  const heroWords = splitWords($('.hero-title'));
  G.timeline({ defaults: { ease: 'power4.out' } })
    .set('.hero-title', { autoAlpha: 1 })
    .from('.site-header', { yPercent: -100, duration: .7 })
    .from('.hero .cross', { scale: 0, rotation: 90, duration: .6, stagger: .06 }, '<.1')
    .fromTo($$('[data-anim]', hero).filter((e) => e.classList.contains('release-chip')), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .6 }, '<.1')
    .from(heroWords, { yPercent: 115, duration: 1, stagger: .06 }, '<.1')
    .fromTo($$('.hero-copy [data-anim]').filter((e) => !e.classList.contains('release-chip')), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .8, stagger: .08 }, '-=.6')
    .fromTo('.specimen', { autoAlpha: 0, y: 40, rotate: 1.5 }, { autoAlpha: 1, y: 0, rotate: 0, duration: 1.1 }, '-=.9')
    .from('.spec-row', { autoAlpha: 0, x: -10, stagger: .06, duration: .5 }, '-=.6')
    .from('.ticker', { autoAlpha: 0, duration: .6 }, '-=.4');

  if (!ST) { $$('[data-anim],[data-stagger]').forEach((el) => G.set(el, { autoAlpha: 1 })); return; }

  $$('[data-split]').forEach((el) => {
    if (el.closest('.hero')) return;
    const words = splitWords(el);
    G.from(words, { yPercent: 115, duration: .9, ease: 'power4.out', stagger: .045, scrollTrigger: { trigger: el, start: 'top 85%' } });
  });
  $$('.sec-idx').forEach((el) => G.from(el, { autoAlpha: 0, x: -14, duration: .6, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } }));

  $$('[data-anim]').forEach((el) => {
    if (el.closest('.hero')) return;
    const rise = el.dataset.anim === 'rise';
    G.fromTo(el, { autoAlpha: 0, y: rise ? 48 : 18 }, {
      autoAlpha: 1, y: 0, duration: rise ? 1.1 : .8, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });
  ST.batch('[data-stagger]', {
    start: 'top 90%',
    onEnter: (els) => G.fromTo(els, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: .7, ease: 'power3.out', stagger: .07, overwrite: true }),
  });

  $$('.cell .ico').forEach((svg) => {
    const parts = $$('path, rect, circle', svg);
    parts.forEach((p) => { const L = p.getTotalLength?.() || 60; p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
    G.to(parts, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut', stagger: .08, scrollTrigger: { trigger: svg, start: 'top 90%' } });
  });

  // version timeline — scrubbed
  const prog = $('#tlProgress');
  if (prog) {
    const L = prog.getTotalLength();
    const branch = $('#tlBranch');
    const BL = branch.getTotalLength();
    G.set(prog, { strokeDasharray: L, strokeDashoffset: L });
    G.set(branch, { strokeDasharray: `${BL}`, strokeDashoffset: BL });
    const nodes = $$('.tl-node');
    G.set(nodes, { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
    const tl = G.timeline({ scrollTrigger: { trigger: '#timeline', start: 'top 78%', end: 'bottom 40%', scrub: .7 } });
    tl.to(prog, { strokeDashoffset: 0, ease: 'none', duration: 4 }, 0);
    [0.15, 1.05, 2.05, 3.3].forEach((t, i) => tl.to(nodes[i], { autoAlpha: 1, scale: 1, duration: .35, ease: 'back.out(3)' }, t));
    tl.to(branch, { strokeDashoffset: 0, ease: 'none', duration: 1 }, 3.4)
      .to(branch, { strokeDasharray: '5 5', duration: .01 }, 4.4)
      .to(nodes[4], { autoAlpha: 1, scale: 1, duration: .35, ease: 'back.out(3)' }, 4.2);
  }

  // RBAC map
  const map = $('#scopeMap');
  if (map) {
    const svg = $('svg', map);
    const hot = $$('.s-edges path.hot', svg);
    const cold = $$('.s-edges path:not(.hot)', svg);
    hot.forEach((p) => { const L = p.getTotalLength(); G.set(p, { strokeDasharray: L, strokeDashoffset: L }); });
    G.timeline({ scrollTrigger: { trigger: map, start: 'top 75%' } })
      .from($$('.s-node', svg), { autoAlpha: 0, y: 8, stagger: .05, duration: .4, ease: 'power2.out' })
      .from(cold, { autoAlpha: 0, duration: .4 }, '<.2')
      .to(hot, { strokeDashoffset: 0, duration: .9, stagger: .15, ease: 'power2.inOut' }, '-=.2')
      .from('.s-perm text', { autoAlpha: 0, y: 4, duration: .4 }, '-=.4')
      .from('.s-deny text', { autoAlpha: 0, y: 4, stagger: .15, duration: .4 }, '-=.3');

    const NS = 'http://www.w3.org/2000/svg';
    const routes = ['M80 165 H300 C340 165 340 120 380 120 H444', 'M80 165 H300 C340 165 340 210 380 210 H444'].map((d) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'none');
      svg.insertBefore(p, svg.firstChild);
      return p;
    });
    const packet = $('.s-packet', svg);
    const lens = routes.map((r) => r.getTotalLength());
    const proxy = { t: 0, r: 0 };
    const place = () => {
      const pt = routes[proxy.r].getPointAtLength(proxy.t * lens[proxy.r]);
      packet.setAttribute('cx', pt.x); packet.setAttribute('cy', pt.y);
    };
    const travel = G.timeline({ repeat: -1, paused: true, repeatDelay: .4 });
    [0, 1].forEach((r) => {
      travel.set(proxy, { r, t: 0, onComplete: place })
        .fromTo(packet, { autoAlpha: 0 }, { autoAlpha: 1, duration: .15 })
        .to(proxy, { t: 1, duration: 1.6, ease: 'power1.inOut', onUpdate: place })
        .to(packet, { autoAlpha: 0, duration: .2 })
        .fromTo($$('.s-node.leaf.hot rect', svg)[r], { fill: '#f3c9bf' }, { fill: '#fbefec', duration: .8 }, '<');
    });
    ST.create({ trigger: map, start: 'top 80%', end: 'bottom top', onToggle: (s) => (s.isActive ? travel.play() : travel.pause()) });
  }

  // Java SDK flow — a packet walks the startup pipeline
  const flow = $('#sdkFlow');
  if (flow) {
    const nodes = $$('.flow-node', flow);
    const pk = document.createElement('span'); pk.className = 'flow-packet'; flow.appendChild(pk);
    G.from(nodes, { autoAlpha: 0, x: 24, stagger: .1, duration: .6, ease: 'power3.out', scrollTrigger: { trigger: flow, start: 'top 80%' } });
    const yOf = (n) => n.offsetTop + n.offsetHeight / 2 - 4;
    const loop = G.timeline({ repeat: -1, repeatDelay: .8, paused: true });
    nodes.forEach((n, i) => {
      loop.to(pk, { y: () => yOf(n), duration: i ? .7 : .01, ease: 'power2.inOut' })
        .add(() => { nodes.forEach((m, j) => m.classList.toggle('lit', j === i)); });
      loop.to({}, { duration: .55 });
    });
    loop.add(() => nodes.forEach((m) => m.classList.remove('lit')));
    ST.create({ trigger: flow, start: 'top 85%', end: 'bottom top', onToggle: (s) => (s.isActive ? loop.play() : loop.pause()), onRefresh: () => loop.invalidate() });
  }

  $$('.meter i').forEach((m) => G.from(m, { scaleX: 0, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: m, start: 'top 92%' } }));

  G.from('#rmFill', { scaleX: 0, ease: 'none', scrollTrigger: { trigger: '.rm-progress', start: 'top 90%', end: 'top 50%', scrub: .6 } });
  G.from('.rm-marker', { autoAlpha: 0, y: -8, duration: .6, scrollTrigger: { trigger: '.rm-progress', start: 'top 60%' } });
  G.fromTo('.k8s-teaser', { boxShadow: '0 0 0 0 rgba(203,80,61,.0)' }, { boxShadow: '0 0 0 6px rgba(203,80,61,.12)', duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut' });

  G.fromTo('#browser', { rotateX: 8, transformPerspective: 1200, transformOrigin: '50% 100%' }, {
    rotateX: 0, ease: 'none', scrollTrigger: { trigger: '#browser', start: 'top 95%', end: 'top 45%', scrub: .6 },
  });

  G.from('.f-mega span', { yPercent: 100, duration: 1.1, ease: 'power4.out', stagger: .08, scrollTrigger: { trigger: '.f-mega', start: 'top 95%' } });

  ST.create({ start: 40, onToggle: (s) => G.to('.site-header', { boxShadow: s.isActive ? '0 1px 0 rgba(0,0,0,.04), 0 8px 24px -16px rgba(0,0,0,.18)' : 'none', duration: .3 }) });

  window.addEventListener('load', () => ST.refresh());
})();
