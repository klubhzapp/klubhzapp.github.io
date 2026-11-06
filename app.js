(function () {
  const D = window.CBB;
  const app = document.getElementById('app');
  const T = new Map(D.teams.map((t) => [t.team_id, t]));
  const PLAY = D.play_stars;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f1 = (v) => (v == null ? '–' : (+v).toFixed(1));
  const f2 = (v) => (v == null ? '–' : (+v).toFixed(2));
  const pc = (v, d = 1) => (v == null ? '–' : (100 * v).toFixed(d));
  const sg = (v, d = 1) => (v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(+v).toFixed(d));
  const line = (v) => (v == null ? '–' : v === 0 ? 'PK' : (v > 0 ? '+' : '−') + Math.abs(v));
  const am = (v) => (v == null ? '–' : (v > 0 ? '+' : '−') + Math.abs(Math.round(v)));
  const logo = (id, cls = '') => `<img class="logo ${cls}" loading="lazy" src="https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png" alt="" onerror="this.style.visibility='hidden'">`;
  const nm = (id, fallback) => esc(T.get(id)?.team ?? fallback ?? '');
  const rkSpan = (r) => (r == null ? '' : `<span class="r${r <= 25 ? ' top' : ''}">${r}</span>`);
  const timeOf = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
  const dayOf = (ds, long) => { const d = new Date(+ds.slice(0, 4), +ds.slice(4, 6) - 1, +ds.slice(6, 8)); return d.toLocaleDateString([], long ? { weekday: 'long', month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' }); };
  const isoDay = (s) => dayOf(String(s).replace(/-/g, ''));

  function sortTable(tbl, rows, render, key, dir) {
    const draw = () => {
      const r = [...rows].sort((a, b) => { const x = a[key], y = b[key]; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * dir; });
      tbl.tBodies[0].innerHTML = r.map(render).join('');
      tbl.querySelectorAll('th.s').forEach((th) => { th.classList.toggle('asc', th.dataset.k === key && dir === 1); th.classList.toggle('desc', th.dataset.k === key && dir === -1); });
    };
    tbl.querySelectorAll('th.s').forEach((th) => (th.onclick = () => { if (key === th.dataset.k) dir = -dir; else { key = th.dataset.k; dir = th.dataset.d ? +th.dataset.d : -1; } draw(); }));
    draw();
  }

  // ================================================================ BOARD
  const S = { date: null, mk: 'all', plays: false, sort: 'time', open: new Set() };
  const MK = { spread: 'Spread', total: 'Total', ml: 'Moneyline' };
  const GRADE = { 5: 'A', 4: 'B', 3: 'C' };
  const grade = (stars) => GRADE[Math.min(stars, 5)] || null;
  const GTIP = { A: "A: one of the day's best plays", 'B+': 'B+: 8%+ expected return', B: 'B: 6.5-8% expected return', 'C+': 'C+: 5.75-6.5% expected return', C: 'C: 4.75-5.75% expected return', 'C-': 'C-: 4-4.75% expected return' };
  const potd = (p) => (p && p.potd ? '<i class="potd" title="Play of the Day: the model\'s strongest play, only when it\'s a monster">POTD</i>' : '');
  const gOf = (p) => p.grade || grade(p.stars);
  const badge = (g, sm) => (g ? `<i class="gr ${g[0]}${sm ? ' sm' : ''}" title="${GTIP[g] || g}">${g}</i>` : '');
  const plays = (g) => g.picks.filter((p) => p.stars >= PLAY && (S.mk === 'all' || p.market === S.mk)).sort((a, b) => b.ev - a.ev);
  const hit = (g, mk, side) => { const p = plays(g).find((x) => x.market === mk && x.side === side); return p ? 'hit' + (p.result ? ' r' + p.result : '') : ''; };
  const betLabel = (g, p) => p.market === 'total' ? `${p.side === 'over' ? 'Over' : 'Under'} ${p.line}` :
    `${esc((p.side === 'home' ? T.get(g.home_id)?.team : T.get(g.away_id)?.team) ?? (p.side === 'home' ? g.home : g.away))} ${p.market === 'ml' ? am(p.odds) : line(p.line)}`;

  const isFinal = (g) => g.state === 'post' && g.home_score != null && g.away_score != null;
  const isLive = (g) => g.state === 'in' && g.home_score != null && g.away_score != null;
  const gradeP = (p, hs, as_) => { const mar = hs - as_, tot = hs + as_; const v = p.market === 'spread' ? (p.side === 'home' ? mar + p.line : -mar + p.line) : p.market === 'total' ? (p.side === 'over' ? tot - p.line : p.line - tot) : (p.side === 'home' ? mar : -mar); return v > 0 ? 'W' : v < 0 ? 'L' : 'P'; };
  const liveChip = (p, g) => { if (p.market === 'total') return `<span class="lc P">Live · ${+g.home_score + +g.away_score} pts so far</span>`; const r = gradeP(p, +g.home_score, +g.away_score); return `<span class="lc ${r}">${r === 'W' ? 'Winning' : r === 'L' ? 'Losing' : 'Even'} now</span>`; };
  const resChip = (p) => (p.result ? `<span class="rc ${p.result}">${p.result === 'W' ? 'Won' : p.result === 'L' ? 'Lost' : 'Push'}</span>` : '');
  function marketCard(g, mk) {
    const p = g.picks.find((x) => x.market === mk);
    if (!p) return `<div class="dcard"><div class="dh"><span>${MK[mk]}</span></div><div class="dp na">No line</div></div>`;
    const gr = p.stars >= PLAY ? badge(gOf(p)) + potd(p) : `<span class="tag">${p.stars > 0 ? 'Lean' : 'Pass'}</span>`;
    const home = p.side === 'home';
    const mdl = mk === 'spread' ? line(+(home ? g.model_spread : -g.model_spread).toFixed(1)) : mk === 'total' ? f1(g.model_total) : pc(p.sim) + '%';
    const mkt = mk === 'spread' ? line(p.line) : mk === 'total' ? p.line : g.mkt_home_win != null ? pc(home ? g.mkt_home_win : 1 - g.mkt_home_win) + '%' : '–';
    return `<div class="dcard${p.stars >= PLAY ? ' is-play' : ''}${p.result && p.stars >= PLAY ? ' res' + p.result : ''}"><div class="dh"><span>${MK[mk]}${p.result && p.stars >= PLAY ? ' · ' + (p.result === 'W' ? 'Won' : p.result === 'L' ? 'Lost' : 'Push') : ''}</span>${gr}</div>
      <div class="dp">${betLabel(g, p)}${mk !== 'ml' ? ` <small>${am(p.odds)}</small>` : ''}</div>
      <dl><dt>${mk === 'ml' ? 'Model win %' : 'Model'}</dt><dd>${mdl}</dd><dt>${mk === 'ml' ? 'Market win %' : 'Market'}</dt><dd>${mkt}</dd>
      <dt title="Points between model and line (ML: win-prob edge vs no-vig market)">Edge</dt><dd>${mk === 'ml' ? sg(p.edge) + '%' : f1(p.edge) + ' pts'}</dd>
      <dt title="Calibrated win probability from real DraftKings results; pushes excluded">Confidence</dt><dd class="hl">${pc(p.conf)}%</dd>
      <dt title="Share of 10,000 simulations the side wins">Sim win</dt><dd>${pc(p.sim)}%</dd>
      <dt title="Expected return per $1 at this price">EV</dt><dd class="${p.ev > 0 ? 'pos' : 'neg'}">${sg(100 * p.ev)}%</dd>
</dl></div>`;
    }

  // ================================================================ ME (profile, tails, favorites) — data lives in store.js
  const ME = { prof: null, bets: [] };
  async function loadMe() { ME.prof = await KStore.getProfile(); ME.bets = await KStore.listBets(); paintMe(); }
  const tailed = (g, p) => ME.bets.find((b) => b.type !== 'parlay' && b.event_id === g.event_id && b.market === p.market && b.side === p.side);
  const canTail = (g) => (g.state || 'pre') === 'pre' && !isFinal(g);
  const tailBtn = (g, p, icon) => {
    const s = inSlip(g.event_id, p.market, p.side), t = tailed(g, p);
    if (!canTail(g)) return t ? `<span class="tail lock placed${icon ? ' ic' : ''}" title="On your profile">${icon ? '✓' : '✓ Placed'}</span>` : '';
    return `<button class="tail${icon ? ' ic' : ''}${s ? ' on' : ''}" data-sl="${g.event_id}|${p.market}|${p.side}" title="${s ? 'In your bet slip. Tap to remove' : 'Add to bet slip'}">${icon ? (s ? '✓' : '+') : s ? '✓ In slip' : '+ Add to slip'}</button>`;
  };
  const isFav = (id) => (ME.prof?.fav_teams || []).includes(+id);
  const initials = (n) => (n || 'You').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const avatar = (pr, cls) => pr && pr.avatar ? `<img class="av ${cls || ''}" src="${pr.avatar}" alt="">` : `<span class="av ini ${cls || ''}">${esc(initials(pr && pr.name))}</span>`;
  function paintMe() { const el = document.getElementById('meBtn'); if (el) el.innerHTML = avatar(ME.prof, 'sm'); }
  const clvOf = (b, cs, ct) => b.line == null ? null : b.market === 'spread' && cs != null ? +(b.line - (b.side === 'home' ? cs : -cs)).toFixed(1) : b.market === 'total' && ct != null ? +(b.side === 'over' ? ct - b.line : b.line - ct).toFixed(1) : null;
  async function settleBets() {
    const byId = new Map(D.games.map((g) => [g.event_id, g])), finals = new Map(), need = new Set();
    for (const g of D.games) if (isFinal(g)) finals.set(g.event_id, [g.away_score, g.home_score]);
    const legsOf = (b) => (b.type === 'parlay' ? b.legs || [] : [b]);
    for (const b of ME.bets) if (!b.result) for (const l of legsOf(b)) if (!l.result && !finals.has(l.event_id) && !byId.has(l.event_id)) need.add(l.date);
    for (const ds of need) {  // games that rolled off the board: finals from ESPN's scoreboard
      try {
        const js = await (await fetch(`${ESPN}?dates=${ds}&groups=50&limit=500`, { cache: 'no-store' })).json();
        for (const ev of js.events || []) { const comp = (ev.competitions || [])[0] || {}; if (((comp.status || {}).type || {}).state !== 'post') continue;
          const sd = (k) => +((comp.competitors || []).find((x) => x.homeAway === k) || {}).score; finals.set(String(ev.id), [sd('away'), sd('home')]); }
      } catch (e) { /* next time */ }
    }
    const profit = (stake, r, d) => (stake ? +(r === 'W' ? stake * (d - 1) : r === 'L' ? -stake : 0).toFixed(2) : null);
    for (const b of ME.bets) {
      const patch = {};
      if (b.type === 'parlay') {
        if (b.result) continue;
        let ch = false;
        const legs = (b.legs || []).map((l) => { if (!l.result && finals.has(l.event_id)) { const [a, h] = finals.get(l.event_id); ch = true; return { ...l, result: gradeP(l, h, a), final: [a, h] }; } return l; });
        if (ch) patch.legs = legs;
        if (legs.length && legs.every((l) => l.result)) {
          const won = legs.filter((l) => l.result === 'W'), r = legs.some((l) => l.result === 'L') ? 'L' : won.length ? 'W' : 'P';
          const d = won.reduce((a, l) => a * decO(l.odds), 1);  // pushed legs drop out of the price
          Object.assign(patch, { result: r, profit: profit(b.stake, r, d), graded_odds: r === 'W' ? toAm(d) : null, graded_at: new Date().toISOString() });
        }
      } else {
        if (!b.result && finals.has(b.event_id)) { const [a, h] = finals.get(b.event_id), r = gradeP(b, h, a); Object.assign(patch, { result: r, final: [a, h], profit: profit(b.stake, r, decO(b.odds)), graded_at: new Date().toISOString() }); }
        const g = byId.get(b.event_id);
        if (g && b.clv == null && (g.close_spread != null || g.close_total != null)) { const v = clvOf(b, g.close_spread, g.close_total); if (v != null) patch.clv = v; }
      }
      if (Object.keys(patch).length) await KStore.updateBet(b.id, patch);
    }
  }
  document.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-sl]'), f = e.target.closest('[data-fav]');
    if (!s && !f) return;
    e.preventDefault(); e.stopPropagation();
    if (f) { await KStore.toggleFavorite(f.dataset.fav); return; }
    const [eid, mk, side] = s.dataset.sl.split('|'); toggleSel(eid, mk, side);
  }, true);

  // ================================================================ BET SLIP (bottom-right; singles or parlay)
  const SL = { open: false, mode: 'single', sel: [], stakes: {}, pstake: '', note: '' };
  const decO = (o) => (o > 0 ? 1 + o / 100 : 1 + 100 / -o);
  const toAm = (d) => (d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)));
  const unesc = (s) => String(s ?? '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const txt = (s) => esc(unesc(s));
  const money = (v) => (v == null || isNaN(v) ? '–' : '$' + (+v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  const pm = (v) => (v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(v)));
  const inSlip = (eid, mk, side) => SL.sel.some((x) => x.event_id === eid && x.market === mk && x.side === side);
  function selFor(g, mk, side) {
    const pk = g.picks.find((x) => x.market === mk && x.side === side);
    const ln = mk === 'spread' ? (side === 'home' ? g.spread : -g.spread) : mk === 'total' ? g.total : null;
    const od = mk === 'ml' ? (side === 'home' ? g.home_ml : g.away_ml) : pk && pk.line === ln ? pk.odds : (g[mk === 'spread' ? side + '_spread_odds' : side + '_odds'] ?? -110);
    const leg = { event_id: g.event_id, date: g.date, start: g.start, market: mk, side, line: ln, odds: od, home_id: g.home_id, away_id: g.away_id, home: g.home, away: g.away,
      grade: pk && pk.stars >= PLAY ? gOf(pk) : null, potd: !!(pk && pk.potd), conf: pk ? pk.conf : null, model: !!(pk && pk.stars >= PLAY) };
    leg.pick = betLabel(g, leg);
    return leg;
  }
  async function saveSlip() { await KStore.saveSlip({ mode: SL.mode, sel: SL.sel, stakes: SL.stakes, pstake: SL.pstake }); }
  function toggleSel(eid, mk, side) {
    const g = D.games.find((x) => x.event_id === eid); if (!g || !canTail(g)) return;
    const i = SL.sel.findIndex((x) => x.event_id === eid && x.market === mk && x.side === side);
    if (i >= 0) SL.sel.splice(i, 1);
    else { SL.sel = SL.sel.filter((x) => !(x.event_id === eid && x.market === mk)); SL.sel.push(selFor(g, mk, side)); SL.open = true; }
    if (SL.sel.length < 2) SL.mode = 'single';
    SL.note = ''; saveSlip(); renderSlip(); rerenderSoft();
  }
  function rerenderSoft() {
    if (basePage === 'board') { const y = window.scrollY; viewBoard(); window.scrollTo(0, y); }
    const gm = document.getElementById('gm'), [page, arg] = (location.hash.slice(1) || 'board').split('/');
    if (!gm.hidden && page === 'game') { const s = gm.querySelector('.gbody')?.scrollTop; viewGame(arg); const b = gm.querySelector('.gbody'); if (b && s) b.scrollTop = s; }
  }
  const slipStarted = (x) => { const g = D.games.find((y) => y.event_id === x.event_id); return g ? !canTail(g) : x.start && new Date(x.start) < new Date(); };
  function renderSlip() {
    let el = document.getElementById('slip');
    if (!el) { el = document.createElement('div'); el.id = 'slip'; document.body.appendChild(el); }
    const n = SL.sel.length;
    if (!n && !SL.note) { el.innerHTML = ''; el.className = ''; return; }
    const par = SL.mode === 'parlay' && n >= 2, pd = SL.sel.reduce((a, x) => a * decO(x.odds), 1), pOdds = n >= 2 ? toAm(pd) : null;
    const stakeOf = (k) => { const v = parseFloat(par ? SL.pstake : SL.stakes[k]); return isNaN(v) || v <= 0 ? null : v; };
    const key = (x) => `${x.event_id}|${x.market}|${x.side}`;
    const started = SL.sel.filter(slipStarted), sameGame = par && new Set(SL.sel.map((x) => x.event_id)).size < n;
    const totStake = par ? stakeOf('p') || 0 : SL.sel.reduce((a, x) => a + (stakeOf(key(x)) || 0), 0);
    const totPay = par ? (stakeOf('p') || 0) * pd : SL.sel.reduce((a, x) => a + (stakeOf(key(x)) || 0) * decO(x.odds), 0);
    if (!SL.open) {
      el.className = 'slp min';
      el.innerHTML = `<button class="slpill" id="slopen">${SL.note ? esc(SL.note) : `<b>Bet slip</b><em class="cn">${n}</em>${n >= 2 && par ? `<span>${am(pOdds)}</span>` : ''}`}<i><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 7.5l3-3 3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></i></button>`;
      el.querySelector('#slopen').onclick = () => { SL.open = true; SL.note = ''; renderSlip(); };
      return;
    }
    const legRow = (x) => { const k = key(x), st = stakeOf(k), gm = `${nm(x.away_id, x.away)} at ${nm(x.home_id, x.home)}`;
      return `<div class="sli${slipStarted(x) ? ' dead' : ''}"><div class="slr"><div class="slx">${x.grade ? badge(x.grade, 1) : ''}<div><b>${txt(x.pick)}</b><span>${MK[x.market]} · ${esc(gm)}${slipStarted(x) ? ' · <em>started</em>' : ''}</span></div></div><em class="slo">${am(x.odds)}</em><button class="slrm" data-rmsel="${k}" title="Remove">×</button></div>
        ${!par ? `<div class="slst"><label>$<input data-st="${k}" value="${SL.stakes[k] ?? ''}" inputmode="decimal" placeholder="Stake"></label><span>To win <b>${st ? money(st * (decO(x.odds) - 1)) : '$0.00'}</b></span></div>` : ''}</div>`; };
    el.className = 'slp';
    el.innerHTML = `<div class="slh"><b>Bet slip</b><em class="cn">${n}</em><button class="lnk" id="slclr">Clear</button><button class="slc" id="slmin" title="Collapse"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
      ${n >= 2 ? `<div class="slm"><div class="seg" id="slmode"><button data-v="single" class="${!par ? 'on' : ''}">Singles</button><button data-v="parlay" class="${par ? 'on' : ''}">Parlay <span>${am(pOdds)}</span></button></div></div>` : ''}
      <div class="sll">${SL.sel.map(legRow).join('')}</div>
      ${par ? `<div class="slpar"><div><b>${n}-leg parlay</b><span>${am(pOdds)}${sameGame ? ' · same-game legs: most books only allow these as a same-game parlay' : ''}</span></div><div class="slst"><label>$<input data-st="p" value="${SL.pstake ?? ''}" inputmode="decimal" placeholder="Stake"></label><span>To win <b>${money((stakeOf('p') || 0) * (pd - 1))}</b></span></div></div>` : ''}
      <div class="slq">${[10, 25, 50, 100].map((v) => `<button data-q="${v}">$${v}</button>`).join('')}</div>
      <div class="slf"><div><span>Total stake</span><b>${money(totStake)}</b></div><div><span>Payout</span><b>${money(totPay)}</b></div></div>
      ${started.length ? `<div class="slw">${started.length === 1 ? 'One game has' : started.length + ' games have'} started. Remove ${started.length === 1 ? 'it' : 'them'} to place.</div>` : ''}
      <button class="slgo" id="slgo"${started.length ? ' disabled' : ''}>${par ? `Place parlay${stakeOf('p') ? ' · ' + money(stakeOf('p')) : ''}` : `Place ${n === 1 ? 'bet' : n + ' bets'}${totStake ? ' · ' + money(totStake) : ''}`}</button>
      <div class="slnote">Tracked on your profile. Stake is optional.</div>`;
    el.querySelector('#slmin').onclick = () => { SL.open = false; renderSlip(); };
    el.querySelector('#slclr').onclick = () => { SL.sel = []; SL.stakes = {}; SL.pstake = ''; SL.mode = 'single'; saveSlip(); renderSlip(); rerenderSoft(); };
    el.querySelectorAll('#slmode button').forEach((b) => (b.onclick = () => { SL.mode = b.dataset.v; saveSlip(); renderSlip(); }));
    el.querySelectorAll('[data-rmsel]').forEach((b) => (b.onclick = () => { const [eid, mk, side] = b.dataset.rmsel.split('|'); toggleSel(eid, mk, side); }));
    el.querySelectorAll('[data-st]').forEach((inp) => (inp.oninput = () => {
      const v = inp.value.replace(/[^0-9.]/g, ''); if (inp.dataset.st === 'p') SL.pstake = v; else SL.stakes[inp.dataset.st] = v;
      saveSlip(); const pos = inp.selectionStart, k = inp.dataset.st; renderSlip(); const n2 = document.querySelector(`#slip [data-st="${k}"]`); if (n2) { n2.focus(); n2.setSelectionRange(pos, pos); }
    }));
    el.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { const v = b.dataset.q; if (par) SL.pstake = v; else SL.sel.forEach((x) => (SL.stakes[key(x)] = v)); saveSlip(); renderSlip(); }));
    el.querySelector('#slgo').onclick = async () => {
      if (started.length) return;
      const now = new Date().toISOString();
      if (par) {
        const st = stakeOf('p'), first = SL.sel.slice().sort((a, b) => String(a.start).localeCompare(String(b.start)))[0];
        await KStore.addBet({ type: 'parlay', legs: SL.sel.map((x) => ({ ...x, result: null })), odds: pOdds, dec: +pd.toFixed(4), stake: st, to_win: st ? +(st * (pd - 1)).toFixed(2) : null, pick: `${n}-leg parlay`, date: first.date, start: first.start, event_id: null, placed_at: now });
        SL.note = `${n}-leg parlay placed`;
      } else {
        for (const x of SL.sel) { const st = stakeOf(key(x)); await KStore.addBet({ ...x, type: 'single', stake: st, to_win: st ? +(st * (decO(x.odds) - 1)).toFixed(2) : null, model_line: x.line, model_odds: x.odds, placed_at: now }); }
        SL.note = n === 1 ? 'Bet placed' : `${n} bets placed`;
      }
      SL.sel = []; SL.stakes = {}; SL.pstake = ''; SL.mode = 'single'; SL.open = false; saveSlip(); renderSlip(); rerenderSoft();
      setTimeout(() => { if (SL.note) { SL.note = ''; renderSlip(); } }, 4000);
    };
  }

  function gameRow(g) {
    const fin = isFinal(g), lv = isLive(g), sc = fin || lv;
    const pa = 1 - g.sim_home_win, aw = sc ? g.away_score > g.home_score : g.proj_away > g.proj_home;
    const t = (id) => T.get(id);
    const teamLine = (id, fallback) => `<div class="tl">${logo(id)}<span class="rk">${t(id)?.rank ?? ''}</span><a class="tn" href="#team/${id}">${nm(id, fallback)}</a>${isFav(id) ? '<i class="fav" title="Following">★</i>' : ''}<span class="rec">${t(id) && t(id).w + t(id).l ? t(id).w + '-' + t(id).l : ''}</span></div>`;
    const sp = g.spread, tot = g.total;
    const status = lv || fin ? '' : g.neutral ? '<small>Neutral</small>' : '';
    const cell = (v, hitOn, sub, mk, side) => (v == null ? '<div class="ln na">–</div>' : `<div class="ln ${hitOn || ''}${mk && inSlip(g.event_id, mk, side) ? ' insl' : ''}${mk && canTail(g) ? ' clk' : ''}"${mk && canTail(g) ? ` data-sl="${g.event_id}|${mk}|${side}" title="Add to bet slip"` : ''}>${v}${sub ? `<small>${sub}</small>` : ''}</div>`);
    const pl = plays(g);
    const bet = pl.length ? pl.slice(0, 2).map((p) => `<div class="pk${p.result ? ' g' + p.result : ''}">${badge(gOf(p))}<div><b>${betLabel(g, p)}</b><span>${potd(p)}${p.result ? resChip(p) : lv ? liveChip(p, g) : `${pc(p.conf)}% · ${p.market === 'ml' ? sg(p.edge) + '% edge' : sg(p.edge) + ' pts'}`}</span></div>${tailBtn(g, p, 1)}</div>`).join('')
      : `<span>${fin ? 'No play' : 'No play'}</span>`;
    const pcl = (v) => (v == null ? '–' : Math.min(99, Math.max(1, Math.round(100 * v))) + '%');
    const fair = (v) => (v == null || Math.abs(v) > 5000 ? '–' : am(v));
    const card = (mk) => marketCard(g, mk);
    const abbr = (id, fb) => esc((T.get(id)?.team ?? fb ?? '').split(' ').map((w) => w[0]).join('').length <= 1 ? (T.get(id)?.team ?? fb ?? '').slice(0, 4).toUpperCase() : (T.get(id)?.team ?? fb ?? '').split(/[ -]/).map((w) => w[0]).join('').toUpperCase());
    const rng = (m) => (m > 0 ? `${abbr(g.home_id, g.home)} +${m}` : m < 0 ? `${abbr(g.away_id, g.away)} +${-m}` : 'even');
    return `<div class="g${S.open.has(g.event_id) ? ' open' : ''}" data-id="${g.event_id}">
      <div class="c time">${fin ? '<b class="fin">Final</b>' : lv ? `<b class="lvt">${esc(g.detail || 'Live')}</b>` : timeOf(g.start)}${status}</div>
      <div class="c">${teamLine(g.away_id, g.away)}${teamLine(g.home_id, g.home)}</div>
      <div class="c">${sc
        ? `<div class="proj ${aw ? 'w' : 'l'}" title="Projected ${Math.round(g.proj_away)}">${g.away_score}<small>${Math.round(g.proj_away)}</small></div><div class="proj ${aw ? 'l' : 'w'}" title="Projected ${Math.round(g.proj_home)}">${g.home_score}<small>${Math.round(g.proj_home)}</small></div>`
        : `<div class="proj ${aw ? 'w' : 'l'}" title="${pc(pa, 0)}% to win">${Math.round(g.proj_away)}</div><div class="proj ${aw ? 'l' : 'w'}" title="${pc(g.sim_home_win, 0)}% to win">${Math.round(g.proj_home)}</div>`}</div>
      <div class="c">${cell(sp == null ? null : line(-sp), hit(g, 'spread', 'away'), '', 'spread', 'away')}${cell(sp == null ? null : line(sp), hit(g, 'spread', 'home'), '', 'spread', 'home')}</div>
      <div class="c">${cell(tot == null ? null : 'O ' + tot, hit(g, 'total', 'over'), '', 'total', 'over')}${cell(tot == null ? null : 'U ' + tot, hit(g, 'total', 'under'), '', 'total', 'under')}</div>
      <div class="c">${cell(g.away_ml == null ? null : am(g.away_ml), hit(g, 'ml', 'away'), '', 'ml', 'away')}${cell(g.home_ml == null ? null : am(g.home_ml), hit(g, 'ml', 'home'), '', 'ml', 'home')}</div>
      <div class="c"><div class="mdl" title="Model spread (away)">${line(+(-g.model_spread).toFixed(1))}</div><div class="mdl" title="Model total">${f1(g.model_total)}</div></div>
      <div class="c bet${pl.length ? '' : ' none'}">${bet}</div>
      <div class="det"><div class="dgrid">
        ${card('spread')}${card('total')}${card('ml')}
        <div class="dcard"><div class="dh"><span>Game</span><a class="open" href="#game/${g.event_id}">View game →</a></div>
          <div class="wl"><span><b>${nm(g.away_id, g.away)}</b> ${pcl(pa)}</span><span>${pcl(g.sim_home_win)} <b>${nm(g.home_id, g.home)}</b></span></div>
          <div class="wb"><i style="width:${(100 * pa).toFixed(1)}%"></i><i style="width:${(100 * g.sim_home_win).toFixed(1)}%"></i></div>
          <dl>${fin ? `<dt>Final</dt><dd>${g.away_score}–${g.home_score}</dd>` : ''}<dt>Projected</dt><dd>${Math.round(g.proj_away)}–${Math.round(g.proj_home)}</dd>
            ${fin ? `<dt title="Actual margin minus projected margin (home)">Margin miss</dt><dd>${sg((g.home_score - g.away_score) - (g.proj_home - g.proj_away))}</dd><dt>Total miss</dt><dd>${sg((g.home_score + g.away_score) - (g.proj_home + g.proj_away))}</dd>` : ''}
            <dt title="80% of simulations land in this range">Margin range</dt><dd>${rng(g.p10_margin)} → ${rng(g.p90_margin)}</dd>
            <dt title="80% of simulations land in this range">Total range</dt><dd>${g.p10_total}–${g.p90_total}</dd>
            <dt>Pace</dt><dd>${f1(g.poss)} poss</dd>
            <dt>Fair ML</dt><dd>${fair(g.fair_away_ml)} / ${fair(g.fair_home_ml)}</dd>
            ${g.spread_open != null && g.spread != null && g.spread_open !== g.spread ? `<dt>Spread move</dt><dd>${line(g.spread_open)} → ${line(g.spread)}</dd>` : ''}
            ${g.total_open != null && g.total != null && g.total_open !== g.total ? `<dt>Total move</dt><dd>${g.total_open} → ${g.total}</dd>` : ''}</dl>
        </div>
      </div></div>
    </div>`;
  }

  function viewBoard() {
    const dates = [...new Set(D.games.map((g) => g.date))].sort();
    if (!dates.includes(S.date)) S.date = dates.includes(D.today) ? D.today : dates[0];
    let gs = D.games.filter((g) => g.date === S.date);
    const nPlays = gs.reduce((a, g) => a + plays(g).length, 0);
    if (S.plays) gs = gs.filter((g) => plays(g).length);
    gs.sort(S.sort === 'edge' ? (a, b) => Math.max(-1, ...plays(b).map((p) => p.ev)) - Math.max(-1, ...plays(a).map((p) => p.ev)) : (a, b) => (a.start || '').localeCompare(b.start || ''));
    const today = new Date(D.generated);
    const rel = (ds) => { const base = D.today || String(D.generated || '').slice(0, 10).replace(/-/g, ''); const toD = (x) => new Date(+x.slice(0, 4), +x.slice(4, 6) - 1, +x.slice(6, 8)); const k = base ? Math.round((toD(ds) - toD(base)) / 864e5) : NaN; return k === 0 ? 'Today' : k === 1 ? 'Tomorrow' : k === -1 ? 'Yesterday' : dayOf(ds); };
    const dayGames = (d) => D.games.filter((g) => g.date === d);
    const allDay = dayGames(S.date);
    const gradeCount = (L) => allDay.reduce((a, g) => a + g.picks.filter((p) => p.stars >= PLAY && (gOf(p) || '')[0] === L && (S.mk === 'all' || p.market === S.mk)).length, 0);
    const upd = new Date(D.generated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    app.innerHTML = `
      <section class="hero">
        <div><div class="eyebrow">Men's college basketball</div><h1>${S.date ? dayOf(S.date, true) : 'Board'}</h1>
          <div class="meta">Last updated at ${LV.at ? LV.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : upd}</div></div>
        <div class="kpis">
          <div><span>Games</span><b>${allDay.length}</b></div>
          <div><span>Plays</span><b>${nPlays}</b></div>
          ${(() => { const any = allDay.some((g) => plays(g).some((p) => p.result)); if (!any) return ''; const graded = allDay.flatMap((g) => plays(g).filter((p) => p.result && gOf(p) === 'A')); if (!graded.length) return '<div><span title="Grade A plays only">A record</span><b>–</b></div>'; const w = graded.filter((p) => p.result === 'W').length, l = graded.filter((p) => p.result === 'L').length, u = graded.reduce((a, p) => a + p.profit, 0);
            return `<div><span title="Grade A plays only">A record</span><b>${w}-${l}</b></div>`; })()}
          <div><span>By grade</span><b class="gl">${['A', 'B', 'C'].map((L) => `<em>${badge(L, 1)}${gradeCount(L)}</em>`).join('')}</b></div>
        </div>
      </section>
      <div class="board">
        <div class="bar">
          <div class="seg" id="days">${dates.map((d) => `<button data-v="${d}" class="${d === S.date ? 'on' : ''}" title="${dayOf(d)} · ${dayGames(d).length} games">${rel(d)}</button>`).join('')}</div>
          <div class="ctl">
            <div class="seg" id="mk">${[['all', 'All'], ['spread', 'Spread'], ['total', 'Total'], ['ml', 'Moneyline']].map(([k, l]) => `<button data-v="${k}" class="${S.mk === k ? 'on' : ''}">${l}</button>`).join('')}</div>
            <label class="sw"><input type="checkbox" id="pl" ${S.plays ? 'checked' : ''}><i></i>Plays only</label>
            <div class="seg" id="so">${[['time', 'Tip time'], ['edge', 'Best edge']].map(([k, l]) => `<button data-v="${k}" class="${S.sort === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          </div>
        </div>
        <div class="bh"><div>Time</div><div>Matchup</div><div title="Projected score">Proj</div><div>Spread</div><div>Total</div><div>Money</div><div title="Model spread (away team) and total">Model</div><div style="text-align:left;padding-left:18px">Bet</div></div>
        ${gs.map(gameRow).join('') || '<div class="empty">No games match.</div>'}
      </div>`;
    app.querySelectorAll('#days button').forEach((b) => (b.onclick = () => { S.date = b.dataset.v; viewBoard(); }));
    app.querySelectorAll('#mk button').forEach((b) => (b.onclick = () => { S.mk = b.dataset.v; viewBoard(); }));
    app.querySelector('#pl').onchange = (e) => { S.plays = e.target.checked; viewBoard(); };
    app.querySelectorAll('#so button').forEach((b) => (b.onclick = () => { S.sort = b.dataset.v; viewBoard(); }));
    app.querySelectorAll('.g').forEach((row) => row.addEventListener('click', (e) => {
      if (e.target.closest('a') || e.target.closest('.det')) return;
      row.classList.toggle('open'); row.classList.contains('open') ? S.open.add(row.dataset.id) : S.open.delete(row.dataset.id);
    }));
  }

  // ================================================================ RATINGS
  const VIEWS = {
    eff: { label: 'Efficiency', cols: [
      ['adj_em', 'Net', 'Adjusted efficiency margin: points per 100 possessions better than an average D1 team', -1, (t) => `<span class="em">${sg(t.adj_em, 2)}</span>`],
      ['adj_o', 'Off', 'Adjusted offensive efficiency (points scored per 100 possessions)', -1, (t) => f1(t.adj_o) + rkSpan(t.r_adj_o)],
      ['adj_d', 'Def', 'Adjusted defensive efficiency (points allowed per 100 possessions)', 1, (t) => f1(t.adj_d) + rkSpan(t.r_adj_d)],
      ['adj_t', 'Tempo', 'Adjusted possessions per 40 minutes', -1, (t) => f1(t.adj_t) + rkSpan(t.r_adj_t)],
      ['luck', 'Luck', 'Wins above what the ratings expected, per game', -1, (t) => sg(t.luck, 3) + rkSpan(t.r_luck)],
      ['sos', 'SOS', 'Average opponent Net rating', -1, (t) => sg(t.sos, 2) + rkSpan(t.r_sos)],
      ['ncsos', 'NC SOS', 'Non-conference strength of schedule', -1, (t) => sg(t.ncsos, 2) + rkSpan(t.r_ncsos)],
      ['proj_w', 'Proj', 'Projected final record from current ratings', -1, (t) => `${Math.round(t.proj_w)}-${Math.round(t.proj_l)}`],
    ] },
    off: { label: 'Offense', cols: [
      ['adj_o', 'Adj Off', 'Adjusted offensive efficiency', -1, (t) => f1(t.adj_o) + rkSpan(t.r_adj_o)],
      ['o_efg', 'eFG%', 'Effective field goal %: FG% with threes worth 1.5', -1, (t) => pc(t.o_efg) + rkSpan(t.r_o_efg)],
      ['o_to', 'TO%', 'Turnovers per possession', 1, (t) => pc(t.o_to) + rkSpan(t.r_o_to)],
      ['o_or', 'OR%', 'Offensive rebound rate', -1, (t) => pc(t.o_or) + rkSpan(t.r_o_or)],
      ['o_ftr', 'FT Rate', 'Free throw attempts per field goal attempt', -1, (t) => pc(t.o_ftr) + rkSpan(t.r_o_ftr)],
      ['o_3p', '3P%', '', -1, (t) => pc(t.o_3p) + rkSpan(t.r_o_3p)],
      ['o_2p', '2P%', '', -1, (t) => pc(t.o_2p) + rkSpan(t.r_o_2p)],
      ['o_ft', 'FT%', '', -1, (t) => pc(t.o_ft) + rkSpan(t.r_o_ft)],
      ['o_3pa', '3PA%', 'Share of shots from three', -1, (t) => pc(t.o_3pa) + rkSpan(t.r_o_3pa)],
    ] },
    def: { label: 'Defense', cols: [
      ['adj_d', 'Adj Def', 'Adjusted defensive efficiency', 1, (t) => f1(t.adj_d) + rkSpan(t.r_adj_d)],
      ['d_efg', 'eFG%', 'Opponent effective FG%', 1, (t) => pc(t.d_efg) + rkSpan(t.r_d_efg)],
      ['d_to', 'TO%', 'Turnovers forced per possession', -1, (t) => pc(t.d_to) + rkSpan(t.r_d_to)],
      ['d_or', 'OR%', 'Opponent offensive rebound rate', 1, (t) => pc(t.d_or) + rkSpan(t.r_d_or)],
      ['d_ftr', 'FT Rate', 'Opponent FTA per FGA', 1, (t) => pc(t.d_ftr) + rkSpan(t.r_d_ftr)],
      ['d_3p', '3P%', 'Opponent 3P%', 1, (t) => pc(t.d_3p) + rkSpan(t.r_d_3p)],
      ['d_2p', '2P%', 'Opponent 2P%', 1, (t) => pc(t.d_2p) + rkSpan(t.r_d_2p)],
      ['blk', 'Blk%', 'Blocks per opponent 2PA', -1, (t) => pc(t.blk) + rkSpan(t.r_blk)],
      ['stl', 'Stl%', 'Steals per opponent possession', -1, (t) => pc(t.stl) + rkSpan(t.r_stl)],
    ] },
  };
  const R = { v: 'eff', conf: '' };
  function viewRatings(v) {
    if (v && VIEWS[v]) R.v = v;
    const V = VIEWS[R.v];
    const confs = [...new Set(D.teams.map((t) => t.conf).filter(Boolean))].sort();
    app.innerHTML = `
      <section class="hero"><div><div class="eyebrow">Men's college basketball</div><h1>Ratings</h1><div class="meta">Last updated at ${new Date(D.generated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div></div></section>
      <div class="board rb"><div class="bar">
        <div class="seg" id="rv">${Object.entries(VIEWS).map(([k, x]) => `<button data-v="${k}" class="${k === R.v ? 'on' : ''}">${x.label}</button>`).join('')}</div>
        <div class="dd" id="cf"><button class="dd-btn">${R.conf ? esc(R.conf) : 'All conferences'}<svg viewBox="0 0 12 12"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <div class="dd-menu" hidden><button data-v="" class="${!R.conf ? 'on' : ''}">All conferences</button>${confs.map((c) => `<button data-v="${esc(c)}" class="${c === R.conf ? 'on' : ''}">${esc(c)}</button>`).join('')}</div></div>
      </div>
      <div class="tbl in"><table id="rt"><thead><tr>
        <th class="s" data-k="rank" data-d="1">Rk</th><th class="l s" data-k="team" data-d="1">Team</th><th class="l s" data-k="conf" data-d="1">Conf</th><th class="s" data-k="w">W-L</th>
        ${R.v === 'eff' ? '<th class="s" data-k="trend" title="Rank change over the last 7 days">7d</th>' : ''}
        ${V.cols.map(([k, l, tip, d]) => `<th class="s" data-k="${k}" data-d="${d}" ${tip ? `title="${esc(tip)}"` : ''}>${l}</th>`).join('')}
      </tr></thead><tbody></tbody></table></div></div>`;
    app.querySelectorAll('#rv button').forEach((b) => (b.onclick = () => (location.hash = 'ratings/' + b.dataset.v)));
    const dd = app.querySelector('#cf'), menu = dd.querySelector('.dd-menu');
    dd.querySelector('.dd-btn').onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
    menu.querySelectorAll('button').forEach((b) => (b.onclick = () => { R.conf = b.dataset.v; viewRatings(); }));
    document.addEventListener('click', () => { menu.hidden = true; }, { once: true });
    const rows = D.teams.filter((t) => !R.conf || t.conf === R.conf);
    sortTable(app.querySelector('#rt'), rows, (t) => `<tr><td>${t.rank}</td><td class="l"><div class="team">${logo(t.team_id, 'sm')}<a href="#team/${t.team_id}">${esc(t.team)}</a></div></td>
      <td class="l" style="color:var(--mute)">${esc(t.conf)}</td><td>${t.w}-${t.l}</td>
      ${R.v === 'eff' ? `<td class="${t.trend > 0 ? 'up' : t.trend < 0 ? 'dn' : 'z'}">${t.trend ? (t.trend > 0 ? '+' : '−') + Math.abs(t.trend) : '–'}</td>` : ''}
      ${V.cols.map((c) => `<td>${c[4](t)}</td>`).join('')}</tr>`, 'rank', 1);
  }

  // ================================================================ TEAM
  const mean = (k) => { const v = D.teams.map((t) => t[k]).filter((x) => x != null); return v.reduce((a, b) => a + b, 0) / v.length; };
  function trend(pts) {
    if (!pts || pts.length < 2) return '<div class="cap">Builds up as the nightly runs add history.</div>';
    const W = 300, H = 70, ys = pts.map((p) => p[1]), lo = Math.min(...ys), hi = Math.max(...ys), span = Math.max(hi - lo, 5);
    const X = (i) => 4 + (i / (pts.length - 1)) * (W - 8), Y = (r) => 6 + ((r - lo) / span) * (H - 12);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
      <div class="cap">#${ys[0]} → #${ys[ys.length - 1]} over ${pts.length} days · best #${lo}</div>`;
  }
  function openModal(wide) {
    const gm = document.getElementById('gm'), body = gm.querySelector('.gmbox');
    if (gm.hidden) { gm.hidden = false; document.body.classList.add('noscroll'); }
    body.classList.toggle('wide', !!wide); body.classList.toggle('game', !wide);
    gm.scrollTop = 0;
    return body;
  }
  function viewTeam(id) {
    const t = T.get(+id);
    const body = openModal(true);
    if (!t) { body.innerHTML = '<div class="empty">Team not found.</div>'; return; }
    const lg = [...(D.logs[t.team_id] || [])].sort((a, b) => a.date.localeCompare(b.date));
    const pj = [...(D.proj[t.team_id] || [])].sort((a, b) => a.date.localeCompare(b.date)).map((g) => (g.pts === g.opts ? { ...g, pts: g.pts + (g.p >= 0.5 ? 1 : 0), opts: g.opts + (g.p >= 0.5 ? 0 : 1) } : g));
    const gsAvg = lg.length ? lg.reduce((a, g) => a + g.gs, 0) / lg.length : 0;
    const row = (lbl, o, d, avgK, f = pc) => `<tr><td class="l">${lbl}</td><td>${f(t[o])}${rkSpan(t['r_' + o])}</td><td>${d ? f(t[d]) + rkSpan(t['r_' + d]) : ''}</td><td style="color:var(--mute)">${f(mean(avgK || o))}</td></tr>`;
    const opp = (o) => (T.get(o) ? `<div class="team">${logo(o, 'sm')}<span class="r" style="min-width:20px;text-align:right;margin:0">${T.get(o).rank}</span><a href="#team/${o}">${esc(T.get(o).team)}</a></div>` : '<span style="color:var(--mute)">Non-D1</span>');
    body.innerHTML = `<button class="gx" type="button" aria-label="Close" onclick="window.__closeModal()">×</button>
      <div class="th">${logo(t.team_id, 'lg')}
        <div><h1>${esc(t.team)}<button class="favb${isFav(t.team_id) ? ' on' : ''}" data-fav="${t.team_id}">${isFav(t.team_id) ? '★ Following' : '☆ Follow'}</button></h1><div class="sub">${esc(t.conf)} · <b>${t.w}-${t.l}</b> (${t.cw}-${t.cl} conf) · projected ${Math.round(t.proj_w)}-${Math.round(t.proj_l)}</div></div>
        <div class="stats">
          <div><div class="k">Rank</div><div class="v">${t.rank}</div></div>
          <div><div class="k">Net</div><div class="v">${sg(t.adj_em, 1)}</div></div>
          <div><div class="k">Offense</div><div class="v">${f1(t.adj_o)}<small>${t.r_adj_o}</small></div></div>
          <div><div class="k">Defense</div><div class="v">${f1(t.adj_d)}<small>${t.r_adj_d}</small></div></div>
          <div><div class="k">Tempo</div><div class="v">${f1(t.adj_t)}<small>${t.r_adj_t}</small></div></div>
        </div></div>
      <div class="cols">
        <div><h2>Scouting report</h2><div class="box"><table><thead><tr><th class="l">Category</th><th>Offense</th><th>Defense</th><th>D1 avg</th></tr></thead><tbody>
          ${row('Adjusted efficiency', 'adj_o', 'adj_d', 'adj_o', f1)}${row('Raw efficiency', 'raw_o', 'raw_d', 'raw_o', f1)}
          ${row('Effective FG%', 'o_efg', 'd_efg')}${row('Turnover %', 'o_to', 'd_to')}${row('Off. rebound %', 'o_or', 'd_or')}${row('FT rate', 'o_ftr', 'd_ftr')}
          ${row('3P%', 'o_3p', 'd_3p')}${row('2P%', 'o_2p', 'd_2p')}${row('3PA share', 'o_3pa', 'd_3pa')}${row('FT%', 'o_ft', null)}
          ${row('Block %', 'blk', null)}${row('Steal %', 'stl', null)}
        </tbody></table></div></div>
        <div><h2>Schedule strength</h2><div class="box"><table><tbody>
          <tr><td class="l">Overall</td><td>${sg(t.sos, 2)}${rkSpan(t.r_sos)}</td></tr>
          <tr><td class="l">Opponent offense</td><td>${f1(t.sos_o)}${rkSpan(t.r_sos_o)}</td></tr>
          <tr><td class="l">Opponent defense</td><td>${f1(t.sos_d)}${rkSpan(t.r_sos_d)}</td></tr>
          <tr><td class="l">Non-conference</td><td>${sg(t.ncsos, 2)}${rkSpan(t.r_ncsos)}</td></tr>
          <tr><td class="l" title="Wins above what the ratings expected, per game">Luck</td><td>${sg(t.luck, 3)}${rkSpan(t.r_luck)}</td></tr></tbody></table>
          <h3>Rank trend</h3><div class="trend">${trend(D.history[t.team_id])}</div></div></div>
      </div>
      <h2>Players</h2>${(D.players || {})[t.team_id]?.length ? `<div class="tbl" style="max-height:none"><table id="pt"><thead><tr><th class="l s" data-k="no" data-d="1">#</th><th class="l s" data-k="name" data-d="1">Player</th><th class="l">Pos</th><th class="s" data-k="gp">GP</th><th class="s" data-k="gs">GS</th><th class="s" data-k="min">Min</th><th class="s" data-k="pts">Pts</th><th class="s" data-k="reb">Reb</th><th class="s" data-k="ast">Ast</th><th class="s" data-k="stl">Stl</th><th class="s" data-k="blk">Blk</th><th class="s" data-k="to">TO</th><th class="s" data-k="fg">FG%</th><th class="s" data-k="tp">3P%</th><th class="s" data-k="ft">FT%</th></tr></thead><tbody></tbody></table></div>` : '<div class="box pad mut">No games played yet this season.</div>'}<div style="height:10px"></div>
      <h2>Schedule</h2><div class="tbl" style="max-height:none"><table><thead><tr><th class="l">Date</th><th class="l">Opponent</th><th class="l">Site</th><th class="l">Result</th><th title="Possessions">Poss</th><th title="Points per 100 possessions">Off</th><th title="Points allowed per 100 possessions">Def</th><th title="Efficiency margin adjusted for opponent and venue. Green = better than this team's average game">Game score</th><th>Win %</th></tr></thead><tbody>
        ${lg.map((g) => `<tr><td class="l">${isoDay(g.date)}</td><td class="l">${opp(g.opp)}</td><td class="l">${g.loc === 'H' ? 'Home' : g.loc === 'A' ? 'Away' : 'Neutral'}${g.conf ? ' · conf' : ''}</td>
          <td class="l"><span class="${g.res}">${g.res}</span> ${g.pts}-${g.opts}</td><td>${f1(g.poss)}</td><td>${f1(g.oe)}</td><td>${f1(g.de)}</td><td class="${g.gs >= gsAvg ? 'pos' : 'neg'}">${sg(g.gs)}</td><td></td></tr>`).join('')}
        ${pj.map((g) => `<tr class="fut"><td class="l">${isoDay(g.date)}</td><td class="l">${opp(g.opp)}</td><td class="l">${g.loc === 'H' ? 'Home' : g.loc === 'A' ? 'Away' : 'Neutral'}${g.conf ? ' · conf' : ''}</td>
          <td class="l">${g.p >= 0.5 ? 'W' : 'L'} ${g.pts}-${g.opts} <span style="color:var(--mute)">proj</span></td><td></td><td></td><td></td><td></td><td>${pc(g.p, 0)}%</td></tr>`).join('')}
      </tbody></table></div>`;
    const ptb = body.querySelector('#pt');
    if (ptb) sortTable(ptb, D.players[t.team_id].map((r) => ({ ...r, no: r.no != null && r.no !== '' ? +r.no : null })), (r) => `<tr><td class="l mut">${r.no ?? ''}</td><td class="l"><b>${esc(r.name)}</b></td><td class="l mut">${esc(r.pos || '')}</td><td>${r.gp}</td><td>${r.gs}</td><td>${f1(r.min)}</td><td><b>${f1(r.pts)}</b></td><td>${f1(r.reb)}</td><td>${f1(r.ast)}</td><td>${f1(r.stl)}</td><td>${f1(r.blk)}</td><td>${f1(r.to)}</td><td>${r.fg != null ? f1(r.fg) : '–'}</td><td>${r.tp != null ? f1(r.tp) : '–'}</td><td>${r.ft != null ? f1(r.ft) : '–'}</td></tr>`, 'min', -1);
  }

  // ================================================================ RESULTS
  // ================================================================ GAME PAGE (gamecast)
  const GT = { tab: 'bet' };
  function viewGame(id, tab) {
    if (tab) GT.tab = tab;
    clearTimeout(GC.timer);
    const g = D.games.find((x) => x.event_id === id);
    const body = openModal(false);
    if (!g) { body.innerHTML = '<div class="empty">This game isn\'t on the board anymore. The board keeps yesterday, today and tomorrow.</div>'; return; }
    const A = T.get(g.away_id) || {}, H = T.get(g.home_id) || {};
    const fin = isFinal(g), live = g.state === 'in';
    const lw = live && GC.id === id && GC.data ? ((GC.data.winprobability || []).slice(-1)[0] || {}).homeWinPercentage : null;  // live ESPN number during games
    const ph = lw != null ? lw : g.sim_home_win, pa = 1 - ph;
    const an = nm(g.away_id, g.away), hn = nm(g.home_id, g.home), aa = abbrOf(g.away_id, g.away), ha = abbrOf(g.home_id, g.home);
    const team = (id, t, name, right) => `<a class="gct${right ? ' rt' : ''}" href="#team/${id}">${logo(id, 'xl')}<span><b>${name}</b><small>${t.rank ? '#' + t.rank + ' · ' : ''}${t.w != null && t.w + t.l ? t.w + '-' + t.l + ' · ' : ''}${esc(t.conf ?? '')}</small></span></a>`;
    const score = (v, p, win) => `<div class="gcs${win ? '' : ' lo'}">${v}<small>${fin ? 'proj ' + Math.round(p) : live ? '' : 'proj'}</small></div>`;
    const awayWin = fin || live ? g.away_score > g.home_score : g.proj_away > g.proj_home;
    const center = fin ? '<b>Final</b>' : live ? `<b class="live">${esc(g.detail || 'Live')}</b>` : `<b>${timeOf(g.start)}</b>`;

    // ---- Bet tab: one table, three markets
    const row = (mk) => {
      const p = g.picks.find((x) => x.market === mk);
      if (!p) return `<tr><td class="l">${MK[mk]}</td><td class="l" colspan="5" style="color:var(--mute)">No line posted</td></tr>`;
      const play = p.stars >= PLAY;
      const mkt = mk === 'spread' ? `${p.side === 'home' ? ha : aa} ${line(p.line)}` : mk === 'total' ? `${p.side === 'over' ? 'O' : 'U'} ${p.line}` : `${p.side === 'home' ? ha : aa} ${am(p.odds)}`;
      const mdl = mk === 'spread' ? `${p.side === 'home' ? ha : aa} ${line(+(p.side === 'home' ? g.model_spread : -g.model_spread).toFixed(1))}` : mk === 'total' ? f1(g.model_total) : `${pc(p.sim, 0)}%`;
      const edge = mk === 'ml' ? sg(p.edge) + '%' : f1(p.edge);
      const status = play ? `<span class="st">${potd(p)}${badge(gOf(p), 1)}${p.result ? resChip(p) : ''}</span>` : `<span class="pass">${p.stars > 0 ? 'Lean' : 'Pass'}</span>`;
      return `<tr class="${play ? 'is-play' : ''}"><td class="l mk">${MK[mk]}</td><td class="l"><b>${mkt}</b>${mk !== 'ml' ? ` <span class="px">${am(p.odds)}</span>` : ''}</td><td>${mdl}</td><td>${edge}</td><td>${pc(p.conf)}%</td><td class="end">${status}${tailBtn(g, p)}</td></tr>`;
    };
    const rng = (m) => (Math.abs(m) < 0.5 ? 'even' : (m > 0 ? ha : aa) + ' by ' + Math.abs(m));
    const notes = [
      `80% of sims: ${rng(g.p10_margin)} to ${rng(g.p90_margin)}, total ${g.p10_total}–${g.p90_total}`,
      `Pace ${f1(g.poss)} possessions`,
      g.spread_open != null && g.spread != null && g.spread_open !== g.spread ? `Spread moved ${ha} ${line(g.spread_open)} → ${line(g.spread)}` : '',
      g.total_open != null && g.total != null && g.total_open !== g.total ? `Total moved ${g.total_open} → ${g.total}` : '',
    ].filter(Boolean);
    const betTab = `<table class="gtab"><thead><tr><th class="l">Market</th><th class="l">Line</th><th>Model</th><th title="Points between model and line (ML: win-prob edge)">Edge</th><th title="Calibrated win probability for the side">Win prob</th><th class="end"></th></tr></thead>
      <tbody>${row('spread')}${row('total')}${row('ml')}</tbody></table><div class="gnotes">${notes.map((n) => `<span>${n}</span>`).join('')}</div>`;

    // ---- Matchup tab: one comparison table
    const cmp = (lbl, k, fmt, lowGood, rk = true) => {
      const va = A[k], vb = H[k];
      if (va == null && vb == null) return '';
      const aBetter = va != null && vb != null && (lowGood ? va < vb : va > vb), bBetter = va != null && vb != null && va !== vb && !aBetter;
      return `<tr><td class="${aBetter ? 'b' : ''}">${fmt(va)}${rk ? rkSpan(A['r_' + k]) : ''}</td><td class="c">${lbl}</td><td class="l ${bBetter ? 'b' : ''}">${fmt(vb)}${rk ? rkSpan(H['r_' + k]) : ''}</td></tr>`;
    };
    const grp = (t) => `<tr class="grp2"><td colspan="3">${t}</td></tr>`;
    const matchTab = `<table class="gtab cmp"><thead><tr><th>${an}</th><th class="c"></th><th class="l">${hn}</th></tr></thead><tbody>
      ${grp('Ratings')}${cmp('Rank', 'rank', (v) => (v == null ? '–' : v), true, false)}${cmp('Net rating', 'adj_em', (v) => sg(v, 1), false)}${cmp('Offense', 'adj_o', f1, false)}${cmp('Defense', 'adj_d', f1, true)}${cmp('Tempo', 'adj_t', f1, false)}${cmp('Schedule strength', 'sos', (v) => sg(v, 1), false)}
      ${grp('Offense')}${cmp('Effective FG%', 'o_efg', pc, false)}${cmp('Turnover %', 'o_to', pc, true)}${cmp('Off. rebound %', 'o_or', pc, false)}${cmp('FT rate', 'o_ftr', pc, false)}${cmp('3-point %', 'o_3p', pc, false)}
      ${grp('Defense')}${cmp('Opp. eFG%', 'd_efg', pc, true)}${cmp('Forced TO %', 'd_to', pc, false)}${cmp('Opp. off. rebound %', 'd_or', pc, true)}${cmp('Opp. FT rate', 'd_ftr', pc, true)}${cmp('Opp. 3-point %', 'd_3p', pc, true)}
    </tbody></table>`;

    // ---- Form tab: last 5 for each team, side by side
    const form = (tid) => {
      const lg = (D.logs[tid] || []).slice(-5).reverse();
      return lg.length ? lg.map((x) => `<div class="fr"><span class="fd">${isoDay(x.date).replace(/^\w+,?\s*/, '')}</span><span class="fo">${logo(x.opp, 'sm')}${x.loc === 'A' ? '@ ' : x.loc === 'N' ? 'vs ' : ''}${nm(x.opp, 'Non-D1')}</span><span class="fs"><span class="${x.res}">${x.res}</span> ${x.pts}-${x.opts}</span></div>`).join('') : '<div class="fr none">No games yet this season</div>';
    };
    const formTab = `<div class="form2"><div><div class="fh">${logo(g.away_id, 'sm')}${an}</div>${form(g.away_id)}</div><div><div class="fh">${logo(g.home_id, 'sm')}${hn}</div>${form(g.home_id)}</div></div>`;

    const keepK = id + '|' + GT.tab, same = body.dataset.k === keepK;
    const ct0 = body.querySelector('#ct'), hadFocus = ct0 && document.activeElement === ct0, sel = ct0 ? [ct0.selectionStart, ct0.selectionEnd] : null;
    const cl0 = body.querySelector('#cl'), chatAtBottom = !cl0 || cl0.scrollHeight - cl0.scrollTop - cl0.clientHeight < 40, chatTop = cl0 ? cl0.scrollTop : 0;
    const sB = same ? body.querySelector('.gbody')?.scrollTop : 0, sC = same ? body.querySelector('.cscr')?.scrollTop : 0;
    body.innerHTML = `
      <button class="gx" id="gx" aria-label="Close">×</button>
      <section class="gc">
        ${team(g.away_id, A, an, false)}
        <div class="gcm">${score(fin || live ? g.away_score : Math.round(g.proj_away), g.proj_away, awayWin)}<div class="gcc">${center}<span>${dayOf(g.date)}${g.neutral ? ' · Neutral' : ''}</span></div>${score(fin || live ? g.home_score : Math.round(g.proj_home), g.proj_home, !awayWin)}</div>
        ${team(g.home_id, H, hn, true)}
      </section>
      <div class="gwp"><span>${aa} ${pc(pa, 0)}%</span><div class="wb"><i style="width:${(100 * pa).toFixed(1)}%"></i><i style="width:${(100 * ph).toFixed(1)}%"></i></div><span>${pc(ph, 0)}% ${ha}</span></div>
      <div class="gpanel">
        <div class="gbar"><div class="seg" id="gt">${[['bet', 'Bet'], ...(fin || live ? [['cast', 'Gamecast'], ['stats', 'Game stats'], ['boxA', GC.id === id && GC.ab ? GC.ab[0] : aa], ['boxH', GC.id === id && GC.ab ? GC.ab[1] : ha]] : []), ['chat', `Chat${(CH.list[id] || []).length ? ` <em class="cn">${CH.list[id].length}</em>` : ''}`], ['matchup', 'Matchup'], ['form', 'Form']].map(([k, l]) => `<button data-v="${k}" class="${GT.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="gbody${GT.tab === 'cast' && (fin || live) ? ' gcast' : ''}${GT.tab === 'chat' ? ' gchat' : ''}">${GT.tab === 'chat' ? chatTab(g, aa, ha) : GT.tab === 'cast' && (fin || live) ? castTab(g) : ['stats', 'boxA', 'boxH'].includes(GT.tab) && (fin || live) ? boxTab(g, GT.tab) : GT.tab === 'matchup' ? matchTab : GT.tab === 'form' ? formTab : betTab}</div>
      </div>`;
    body.querySelectorAll('#gt button').forEach((b) => (b.onclick = () => viewGame(id, b.dataset.v)));
    body.querySelector('#gx').onclick = closeGame;
    body.dataset.k = keepK;
    if (sB) { const e = body.querySelector('.gbody'); if (e) e.scrollTop = sB; }
    if (sC) { const e = body.querySelector('.cscr'); if (e) e.scrollTop = sC; }
    const more = body.querySelector('#gcmore'); if (more) more.onclick = () => { GC.all = true; viewGame(id); };
    if (GT.tab === 'chat') wireChat(body, g, aa, ha, { hadFocus, sel, chatAtBottom: same ? chatAtBottom : true, chatTop });
    body.querySelectorAll('#gch button').forEach((b) => (b.onclick = () => { GC.half = b.dataset.v === 'all' ? null : +b.dataset.v; viewGame(id); }));
    const ESP = ['cast', 'stats', 'boxA', 'boxH'];
    if (!ESP.includes(GT.tab) && (fin || live) && GC.id !== id && !GC.busy) {  // prefetch so tab labels use ESPN's team codes
      loadCast(id).then(() => { const gm = document.getElementById('gm'); if (!gm.hidden && location.hash.endsWith(id) && GC.ab) { const s = gm.scrollTop; viewGame(id); gm.scrollTop = s; } });
    }
    if (ESP.includes(GT.tab) && (fin || live)) {
      const again = () => { const gm = document.getElementById('gm'); if (gm.hidden || !ESP.includes(GT.tab) || !location.hash.endsWith(id)) return; const s = gm.scrollTop; viewGame(id); gm.scrollTop = s; };
      if (GC.id !== id || !GC.data) { if (!GC.busy) loadCast(id).then(again); else GC.timer = setTimeout(again, 1500); }
      else if (live) GC.timer = setTimeout(() => loadCast(id).then(again), 15e3);
    }
  }
  // ================================================================ PROFILE
  const PF = { tab: 'bets' };
  function viewProfile() {
    const pr = ME.prof || {}, bets = ME.bets.slice();
    const open = bets.filter((b) => !b.result).sort((a, b) => String(a.start || a.date).localeCompare(String(b.start || b.date)));
    const done = bets.filter((b) => b.result);
    const w = done.filter((b) => b.result === 'W').length, l = done.filter((b) => b.result === 'L').length, pu = done.filter((b) => b.result === 'P').length;
    const cl = done.map((b) => b.clv).filter((v) => v != null), clv = cl.length ? cl.reduce((a, v) => a + v, 0) / cl.length : null;
    const staked = done.filter((b) => b.stake), net = staked.length ? staked.reduce((a, b) => a + (b.profit || 0), 0) : null, risk = staked.reduce((a, b) => a + b.stake, 0);
    const openRisk = open.reduce((a, b) => a + (b.stake || 0), 0);
    const since = pr.created_at ? new Date(pr.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    // model record over the same days you've been tailing (A, B+, B, same as Results)
    const first = bets.length ? bets.map((b) => b.date).sort()[0] : null, counts = D.count_grades || ['A', 'B+', 'B'];
    const mp = ((D.perf || {}).plays || []).filter((r) => first && r.date >= first && counts.includes(r.grade || grade(r.stars)));
    const mw = mp.filter((r) => r.result === 'W').length, ml = mp.filter((r) => r.result === 'L').length;
    const rec = (a, b, c2) => `${a}-${b}${c2 ? '-' + c2 : ''}`;
    const g0 = (eid) => D.games.find((x) => x.event_id === eid);
    const status = (b) => { const g = g0(b.event_id); if (g && isLive(g)) return `<span class="lvt">${esc(g.detail || 'Live')}</span> ${liveChip(b, g)}`; if (g && g.state === 'pre' || !g) return `<span class="mut">${b.start ? dayOf(b.date) + ' · ' + timeOf(b.start) : dayOf(b.date)}</span>`; return '<span class="mut">Grading…</span>'; };
    const legSum = (b) => { const L = b.legs || [], w = L.filter((l) => l.result === 'W').length, lo = L.filter((l) => l.result === 'L').length, pe = L.filter((l) => !l.result).length;
      return `<span class="lsum"><span>${[w && w + ' won', lo && lo + ' lost', pe && pe + ' pending'].filter(Boolean).join(' · ')}</span></span>`; };
    const legRows = (b, cols) => {
      if (b.type !== 'parlay') return '';
      const st = (l) => (l.result ? `<span class="lst ${l.result}">${l.result === 'W' ? 'Won' : l.result === 'L' ? 'Lost' : 'Push'}</span>` : '<span class="lst O">Pending</span>');
      const lg = (l) => `<span class="lgs2"><span>${logo(l.away_id, 'sm')}</span><span>${logo(l.home_id, 'sm')}</span></span>`;
      return (b.legs || []).map((l, i, a) => `<tr class="leg${i === a.length - 1 ? ' last' : ''}"><td class="l"><div class="lpk"><b>${txt(l.pick)}</b><span>${am(l.odds)}</span></div></td><td class="l" colspan="${cols - 3}"><div class="team mut">${lg(l)}<span>${nm(l.away_id, l.away)} at ${nm(l.home_id, l.home)}</span>${l.final ? `<span class="lfin">${l.final[0]}-${l.final[1]}</span>` : ''}</div></td><td></td><td class="end">${st(l)}</td></tr>`).join('');
    };
    const game = (b) => b.type === 'parlay'
      ? legSum(b)
      : `<div class="team mut">${logo(b.away_id, 'sm')}${logo(b.home_id, 'sm')}<span>${nm(b.away_id, b.away)} at ${nm(b.home_id, b.home)}</span></div>`;
    const stk = (b) => (b.stake ? `<b>${money(b.stake)}</b><small>to win ${money(b.to_win)}</small>` : '<span class="mut">–</span>');
    const pickCell = (b) => `<div class="team">${b.type === 'parlay' ? '<span class="ptag">Parlay</span>' : badge(b.grade, 1)}<b>${txt(b.type === 'parlay' ? `${(b.legs || []).length}-leg parlay` : b.pick)}</b>${b.type === 'parlay' ? `<span class="mut">${am(b.odds)}</span>` : ''}</div>`;
    const resC = (b) => `<span class="rc ${b.result}">${b.result === 'W' ? 'Won' : b.result === 'L' ? 'Lost' : 'Push'}</span>`;
    const editable = (b) => b.market !== 'ml' ? `<input class="pin" data-edit="${b.id}|line" value="${b.line ?? ''}" inputmode="decimal" title="The line you actually got">` : '';
    const legsLeft = (b) => (b.legs || []).filter((l) => !l.result).length;
    const openRows = open.map((b) => { const par = b.type === 'parlay', g = !par && g0(b.event_id), pre = par ? (b.legs || []).every((l) => { const x = g0(l.event_id); return !x || canTail(x); }) && (b.legs || []).every((l) => !l.start || new Date(l.start) > new Date()) : !g || canTail(g);
      return `<tr><td class="l">${pickCell(b)}</td><td class="l">${game(b)}</td>
        <td>${par ? am(b.odds) : `${pre ? editable(b) : b.line ?? ''}${pre ? `<input class="pin od" data-edit="${b.id}|odds" value="${b.odds ?? ''}" inputmode="numeric" title="The odds you actually got">` : am(b.odds)}`}</td><td class="stk">${stk(b)}</td><td class="l">${par ? `<span class="mut">${legsLeft(b)} of ${(b.legs || []).length} legs left</span>` : status(b)}</td>
        <td class="end">${pre ? `<button class="lnk" data-rm="${b.id}">Remove</button>` : ''}${par ? '' : `<a class="vw" href="#game/${b.event_id}">View</a>`}</td></tr>${legRows(b, 6)}`; }).join('');
    const days = [...new Set(done.map((b) => b.date))].sort().reverse();
    const hist = days.map((d) => { const x = done.filter((b) => b.date === d), dw = x.filter((b) => b.result === 'W').length, dl = x.filter((b) => b.result === 'L').length, dp = x.filter((b) => b.result === 'P').length;
      return `<tr class="dayh"><td class="l" colspan="7"><div class="dayr"><b>${dayOf(d, true)}</b><span>${rec(dw, dl, dp)}</span>${(() => { const s = x.filter((b) => b.stake); if (!s.length) return ''; const v = s.reduce((a, b) => a + (b.profit || 0), 0); return `<em class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${pm(v)}</em>`; })()}</div></td></tr>` + x.map((b) => `<tr><td class="l">${pickCell(b)}</td><td class="l">${game(b)}</td>
        <td>${am(b.graded_odds || b.odds)}</td><td>${b.final ? b.final[0] + '-' + b.final[1] : ''}</td><td class="${b.clv > 0 ? 'pos' : b.clv < 0 ? 'neg' : ''}">${b.clv != null ? sg(b.clv, 1) : '–'}</td><td class="${b.profit > 0 ? 'pos' : b.profit < 0 ? 'neg' : ''}">${b.profit != null ? pm(b.profit) : '–'}</td><td class="end">${resC(b)}${b.type === 'parlay' ? '' : `<a class="vw" href="#game/${b.event_id}">View</a>`}</td></tr>${legRows(b, 7)}`).join(''); }).join('');
    const byG = ['A', 'B+', 'B', 'C+', 'C', 'C-'].map((G) => { const x = done.filter((b) => b.type !== 'parlay' && b.grade === G); if (!x.length) return ''; return `<span class="gch">${badge(G, 1)}${rec(x.filter((b) => b.result === 'W').length, x.filter((b) => b.result === 'L').length)}</span>`; }).join('');
    const favs = (pr.fav_teams || []).map((t) => T.get(+t)).filter(Boolean).sort((a, b) => a.rank - b.rank);
    const tabs = [['bets', `Bets${open.length ? ` <em class="cn">${open.length}</em>` : ''}`], ['teams', 'Following'], ['settings', 'Settings']];
    const body = PF.tab === 'teams'
      ? (favs.length ? `<div class="favs">${favs.map((t) => { const nx = D.games.filter((g) => (g.home_id === t.team_id || g.away_id === t.team_id) && !isFinal(g)).sort((a, b) => String(a.start).localeCompare(String(b.start)))[0];
          return `<div class="fvc"><a href="#team/${t.team_id}" class="fvt">${logo(t.team_id, 'lg')}<div><b>${esc(t.team)}</b><span>#${t.rank} · ${t.w}-${t.l} · ${esc(t.conf)}</span></div></a>
            ${nx ? `<a class="fvn" href="#game/${nx.event_id}">${isLive(nx) ? `<span class="lvt">${esc(nx.detail || 'Live')}</span>` : `Next: ${dayOf(nx.date)} ${timeOf(nx.start)}`} · ${nx.home_id === t.team_id ? 'vs' : 'at'} ${nm(nx.home_id === t.team_id ? nx.away_id : nx.home_id, nx.home_id === t.team_id ? nx.away : nx.home)}</a>` : '<span class="fvn mut">No game on the board</span>'}
            <button class="lnk" data-fav="${t.team_id}">Unfollow</button></div>`; }).join('')}</div>`
          : '<div class="empty">You aren\'t following any teams yet. Open a team and tap ☆ Follow.</div>')
      : PF.tab === 'settings'
      ? `<div class="pset"><div class="psr"><div><b>Name</b><span>Shown on your profile and in game chats</span></div><input id="pname" class="pfi" maxlength="30" value="${esc(pr.name || '')}" placeholder="Your name"></div>
          <div class="psr"><div><b>Photo</b><span>Square works best</span></div><div class="psb"><label class="btn2">Upload<input type="file" id="pphoto" accept="image/*" hidden></label>${pr.avatar ? '<button class="btn2" id="prmph">Remove</button>' : ''}</div></div>
          ${KStore.mode === 'remote' ? `<div class="psr"><div><b>Account</b><span>Signed in with Google as ${esc((KStore.account() || {}).email || '')}</span></div><div class="psb"><button class="btn2" id="pout">Sign out</button></div></div>
          <div class="psr"><div><b>Your data</b><span>Download a copy of your profile and bets.</span></div><div class="psb"><button class="btn2" id="pexp">Download</button></div></div>`
          : `<div class="psr"><div><b>Backup</b><span>Your profile, bets and chats are saved in this browser. Download a copy to be safe.</span></div><div class="psb"><button class="btn2" id="pexp">Download backup</button><label class="btn2">Restore<input type="file" id="pimp" accept="application/json" hidden></label></div></div>`}</div>`
      : `${open.length ? `<div class="psec">Open</div><table class="led"><thead><tr><th class="l">Bet</th><th class="l">Game</th><th title="Edit to match the line and odds you actually got">Your line</th><th>Stake</th><th class="l">Status</th><th></th></tr></thead><tbody>${openRows}</tbody></table>` : ''}
         ${hist ? `<div class="psec">History</div><table class="led"><thead><tr><th class="l">Bet</th><th class="l">Game</th><th>Odds</th><th>Final</th><th title="Closing line value: points the line moved your way after you placed it">CLV</th><th title="Profit or loss on bets with a stake">P/L</th><th></th></tr></thead><tbody>${hist}</tbody></table>` : ''}
         ${!bets.length ? '<div class="empty">No bets yet. Tap any line on the board, or the <b>+</b> on a model play, to build a slip. Placed bets show up here.</div>' : ''}`;
    app.innerHTML = `
      <section class="hero"><div class="phero"><label class="phav" title="Change photo">${avatar(pr, 'xl')}<input type="file" id="pphoto2" accept="image/*" hidden></label>
          <div><div class="eyebrow">Profile</div><h1>${esc(pr.name || 'Your profile')}</h1><div class="meta">${since ? 'Tracking since ' + since : ''}${KStore.mode === 'remote' ? '<button class="lnk pout" id="pout2">Sign out</button>' : ''}${byG ? `<span class="gchs">${byG}</span>` : ''}</div></div></div>
        <div class="kpis"><div><span>Record</span><b>${done.length ? rec(w, l, pu) : '–'}</b></div><div><span>Win %</span><b>${w + l ? f1(100 * w / (w + l)) + '%' : '–'}</b></div>
          <div><span title="Profit or loss on bets placed with a stake${risk ? ' · ROI ' + sg(100 * net / risk) + '%' : ''}">Net</span><b class="${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}">${net != null ? pm(net) : '–'}</b></div>
          <div><span title="Closing line value: average points the line moved your way after you placed it. Positive means you're beating the market">CLV</span><b class="${clv > 0 ? 'pos' : clv < 0 ? 'neg' : ''}">${clv != null ? sg(clv, 1) : '–'}</b></div>
          <div><span title="Model's A, B+ and B record over the same days">Model</span><b>${mp.length ? rec(mw, ml) : '–'}</b></div></div></section>
      <div class="board"><div class="bar"><div class="seg" id="pt">${tabs.map(([k, l]) => `<button data-v="${k}" class="${PF.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div></div><div class="pbody">${body}</div></div>`;
    app.querySelectorAll('#pt button').forEach((b) => (b.onclick = () => { PF.tab = b.dataset.v; viewProfile(); }));
    app.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => KStore.removeBet(b.dataset.rm)));
    app.querySelectorAll('[data-edit]').forEach((inp) => (inp.onchange = () => { const [bid, k] = inp.dataset.edit.split('|'), v = parseFloat(inp.value), b = ME.bets.find((x) => x.id === bid); if (b && !isNaN(v)) KStore.updateBet(bid, { [k]: v, pick: relabel({ ...b, [k]: v }) }); }));
    const nmI = app.querySelector('#pname'); if (nmI) nmI.onchange = () => KStore.saveProfile({ name: nmI.value.trim() });
    const photo = (inp) => inp && (inp.onchange = () => { const f = inp.files[0]; if (!f) return; const img = new Image(); img.onload = () => { const s = 160, cv = document.createElement('canvas'); cv.width = cv.height = s; const k = Math.min(img.width, img.height); cv.getContext('2d').drawImage(img, (img.width - k) / 2, (img.height - k) / 2, k, k, 0, 0, s, s); KStore.saveProfile({ avatar: cv.toDataURL('image/jpeg', 0.85) }); URL.revokeObjectURL(img.src); }; img.src = URL.createObjectURL(f); });
    photo(app.querySelector('#pphoto')); photo(app.querySelector('#pphoto2'));
    app.querySelectorAll('#pout, #pout2').forEach((b) => (b.onclick = async () => { b.disabled = true; b.textContent = 'Signing out…'; await KStore.signOut(); }));
    const rmph = app.querySelector('#prmph'); if (rmph) rmph.onclick = () => KStore.saveProfile({ avatar: null });
    const ex = app.querySelector('#pexp'); if (ex) ex.onclick = async () => { const blob = new Blob([JSON.stringify(await KStore.exportAll(), null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `klubhz-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); };
    const im = app.querySelector('#pimp'); if (im) im.onchange = async () => { try { await KStore.importAll(JSON.parse(await im.files[0].text())); } catch (e) { im.value = ''; im.closest('.psr').querySelector('span').textContent = 'That file isn\'t a Klubhz backup.'; } };
  }
  const relabel = (b) => b.market === 'total' ? `${b.side === 'over' ? 'Over' : 'Under'} ${b.line}` : `${nm(b.side === 'home' ? b.home_id : b.away_id, b.side === 'home' ? b.home : b.away)} ${b.market === 'ml' ? am(b.odds) : line(b.line)}`;

  // ================================================================ CHAT (per game; store.js keeps the messages)
  const CH = { list: {}, draft: {}, loading: {} };
  const REACTS = ['🔥', '😂', '💀', '👀', '🙏'];
  async function loadChat(id) { if (CH.loading[id]) return; CH.loading[id] = true; CH.list[id] = await KStore.listMessages(id); CH.loading[id] = false; }
  const stampOf = (g) => (isLive(g) ? (g.detail || 'Live') : isFinal(g) ? 'Final' : 'Pregame');
  function betCard(b, g) {
    const who = b.tailed ? 'Tailed' : 'Model play', odds = b.odds != null ? am(b.odds) : '', cf = b.conf != null ? pc(b.conf) + '% conf' : '';
    return `<div class="bvA"><div class="bvh"><span>${who}</span>${badge(b.grade, 1)}</div><div class="bp"><b>${txt(b.pick)}</b><em>${odds}</em></div>
      <div class="bf"><span class="lgs"><span>${logo(g.away_id, 'sm')}</span><span>${logo(g.home_id, 'sm')}</span></span><span>${nm(g.away_id, g.away)} at ${nm(g.home_id, g.home)}</span><i>${cf}</i></div></div>`;
  }
  function chatTab(g, aa, ha) {
    const id = g.event_id, list = CH.list[id];
    if (!list) { loadChat(id).then(() => { if (GT.tab === 'chat' && location.hash.endsWith(id)) viewGame(id); }); return '<div class="empty">Loading chat…</div>'; }
    const me = ME.prof || {};
    const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const day = (iso) => new Date(iso).toDateString();
    let prev = null;
    const rows = list.map((m) => {
      const grouped = prev && prev.user_id === m.user_id && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60e3 && day(prev.created_at) === day(m.created_at);
      const sep = !prev || day(prev.created_at) !== day(m.created_at) ? `<div class="cday"><span>${new Date(m.created_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span></div>` : '';
      prev = m;
      const who = m.user_id === me.id ? { name: me.name || 'You', avatar: me.avatar } : m;
      const bet = m.bet ? betCard(m.bet, g) : '';
      const rx = Object.entries(m.reactions || {}).filter(([, u]) => u.length).map(([e, u]) => `<button class="rx${u.includes(me.id) ? ' on' : ''}" data-rx="${m.id}|${e}">${e} <b>${u.length}</b></button>`).join('');
      return `${sep}<div class="cm${grouped ? ' grp' : ''}" data-id="${m.id}">
        <div class="cav">${grouped ? '' : avatar(who)}</div>
        <div class="cbd">${grouped ? '' : `<div class="cmh"><b>${esc(who.name || 'You')}</b><span>${time(m.created_at)}</span>${m.stamp ? `<em>${esc(m.stamp)}</em>` : ''}${m.score ? `<em>${esc(m.score)}</em>` : ''}</div>`}
          ${m.text ? `<div class="ctx">${esc(m.text).replace(/\n/g, '<br>')}</div>` : ''}${bet}${rx ? `<div class="rxs">${rx}</div>` : ''}</div>
        <div class="cact">${REACTS.map((e) => `<button data-rx="${m.id}|${e}" title="React">${e}</button>`).join('')}${m.user_id === me.id ? `<button class="del" data-del="${m.id}" title="Delete">✕</button>` : ''}</div></div>`;
    }).join('');
    const myBets = ME.bets.filter((b) => b.event_id === id), modelPlays = g.picks.filter((p) => p.stars >= PLAY && !myBets.some((b) => b.market === p.market && b.side === p.side));
    const share = [...myBets.map((b) => ({ k: 'b:' + b.id, label: b.pick, sub: 'Your tail', grade: b.grade })), ...modelPlays.map((p) => ({ k: 'p:' + p.market + '|' + p.side, label: betLabel(g, p), sub: 'Model play', grade: gOf(p) }))];
    return `<div class="chat">
      <div class="cl" id="cl">${rows || `<div class="cempty"><b>No messages yet</b><span>Start the thread for ${nm(g.away_id, g.away)} at ${nm(g.home_id, g.home)}. Messages are stamped with the game clock.</span></div>`}</div>
      <div class="cshare" id="csh" hidden>${share.length ? share.map((s) => `<button data-share="${s.k}">${badge(s.grade, 1)}<b>${esc(s.label)}</b><span>${s.sub}</span></button>`).join('') : '<span class="mut">No plays on this game yet. Tail one from the Bet tab.</span>'}</div>
      <form class="ccmp" id="cfm"><div class="cin">${avatar(me, 'sm')}<textarea id="ct" rows="1" maxlength="500" placeholder="Message #${aa.toLowerCase()}-${ha.toLowerCase()}"></textarea>
        <button type="button" class="cb" id="cshb" title="Share a bet">🎟️</button><button type="submit" class="cs" id="csend" disabled>Send</button></div>
        <div class="chint">${esc(stampOf(g))}${isLive(g) || isFinal(g) ? ` · ${aa} ${g.away_score}-${g.home_score} ${ha}` : ''} · Enter to send, Shift+Enter for a new line</div></form>
    </div>`;
  }
  function wireChat(body, g, aa, ha, st) {
    const id = g.event_id, ta = body.querySelector('#ct'), cl = body.querySelector('#cl'), send = body.querySelector('#csend'), sh = body.querySelector('#csh');
    if (CH.watching !== id) { if (CH.off) CH.off(); CH.off = KStore.watchChat(id); CH.watching = id; }
    if (!ta) return;
    const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; send.disabled = !ta.value.trim(); };
    ta.value = CH.draft[id] || ''; fit();
    if (st.hadFocus) { ta.focus(); if (st.sel) ta.setSelectionRange(st.sel[0], st.sel[1]); }
    cl.scrollTop = st.chatAtBottom ? cl.scrollHeight : st.chatTop;
    ta.oninput = () => { CH.draft[id] = ta.value; fit(); };
    const post = async (extra) => {
      const text = ta.value.trim(); if (!text && !extra) return;
      CH.draft[id] = ''; ta.value = '';
      try { await KStore.postMessage(id, { text, stamp: stampOf(g), score: isLive(g) || isFinal(g) ? `${aa} ${g.away_score}-${g.home_score} ${ha}` : null, ...(extra || {}) }); } catch (e) { CH.draft[id] = text; viewGame(id); return; }
      CH.list[id] = await KStore.listMessages(id);
      viewGame(id); const t2 = document.getElementById('ct'); if (t2) t2.focus();
      const c2 = document.getElementById('cl'); if (c2) c2.scrollTop = c2.scrollHeight;
    };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); post(); } };
    body.querySelector('#cfm').onsubmit = (e) => { e.preventDefault(); post(); };
    body.querySelector('#cshb').onclick = () => { sh.hidden = !sh.hidden; };
    sh.querySelectorAll('[data-share]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.share; let bet;
      if (k.startsWith('b:')) { const x = ME.bets.find((y) => y.id === k.slice(2)); if (x) bet = { pick: x.pick, grade: x.grade, odds: x.odds, conf: x.conf, tailed: true }; }
      else { const [mk, side] = k.slice(2).split('|'), p = g.picks.find((y) => y.market === mk && y.side === side); if (p) bet = { pick: betLabel(g, p), grade: gOf(p), odds: p.odds, conf: p.conf, tailed: false }; }
      sh.hidden = true; if (bet) post({ bet });
    }));
    body.querySelectorAll('[data-rx]').forEach((b) => (b.onclick = async () => { const [mid, e] = b.dataset.rx.split('|'); await KStore.react(id, mid, e); CH.list[id] = await KStore.listMessages(id); viewGame(id); }));
    body.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => { await KStore.deleteMessage(id, b.dataset.del); CH.list[id] = await KStore.listMessages(id); viewGame(id); }));
  }

  // ================================================================ GAMECAST (ESPN play-by-play, from the browser)
  const GC = { id: null, data: null, err: false, timer: null, all: false, busy: false };
  const SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary';
  async function loadCast(id) {
    GC.busy = true;
    try { const r = await fetch(`${SUMMARY}?event=${id}`, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); const js = await r.json(); if (GC.id !== id) { GC.all = false; GC.half = null; } GC.id = id; GC.data = js; GC.err = false;
      const bt = ((js.boxscore || {}).teams || []); const g0 = D.games.find((x) => x.event_id === id);
      const abOf = (tid) => (bt.find((x) => String(x.team.id) === String(tid)) || {}).team?.abbreviation;
      GC.ab = g0 && abOf(g0.away_id) && abOf(g0.home_id) ? [esc(abOf(g0.away_id)), esc(abOf(g0.home_id))] : null; }
    catch (e) { if (GC.id !== id) { GC.id = id; GC.data = null; } GC.err = true; }
    GC.busy = false;
  }
  const lum = (hex) => { const h = (hex || '').replace('#', ''); if (h.length !== 6) return 1; const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const hexRGB = (h) => { h = (h || '').replace('#', ''); return h.length === 6 ? [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16)) : null; };
  const cdist = (a, b) => { const x = hexRGB(a), y = hexRGB(b); return x && y ? Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) : 0; };
  function castCols(g) {
    // home dots = home primary color, always. Away = its primary, else its alternate, else a contrasting fallback.
    const bt = ((GC.id === g.event_id && GC.data && GC.data.boxscore) || {}).teams || [];
    const tm = (tid) => (bt.find((x) => String(x.team.id) === String(tid)) || {}).team || {};
    const cands = (tid, fb) => [tm(tid).color, tm(tid).alternateColor, fb].filter(Boolean).map((x) => '#' + String(x).replace('#', '')).filter((x) => hexRGB(x) && lum(x) < 0.85);
    const A = cands(g.away_id, T.get(g.away_id)?.color), H = cands(g.home_id, T.get(g.home_id)?.color);
    const h = H[0] || '#0d0f12';
    let a = A.find((x) => cdist(x, h) >= 110);
    if (!a) { const pal = ['#0d0f12', '#c92a2a', '#1971c2', '#2b8a3e', '#6741d9', '#e8590c', '#5b6472']; a = pal.reduce((b, x) => (cdist(x, h) > cdist(b, h) ? x : b), pal[0]); }
    return { a, h };
  }
  const pretty = (s) => String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2');
  function boxTab(g, which) {
    const js = GC.id === g.event_id ? GC.data : null, C = castCols(g);
    if (!js) return `<div class="empty">${GC.err ? "Couldn't reach ESPN for the box score. It'll retry in a few seconds." : 'Loading box score…'}</div>`;
    const P = (js.boxscore || {}).players || [];
    if (!P.length) return '<div class="empty">The box score starts at tip-off.</div>';
    const order = [String(g.away_id), String(g.home_id)];
    const teams = P.slice().sort((a, b) => order.indexOf(String(a.team.id)) - order.indexOf(String(b.team.id)));
    const want = ['MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'OREB', 'AST', 'STL', 'BLK', 'TO', 'PF'];
    const one = (tm) => {
      const st = (tm.statistics || [])[0] || {}, lab = st.labels || st.names || [], idx = want.map((w) => lab.indexOf(w));
      const cells = (arr, bold) => idx.map((k, n) => `<td${want[n] === 'PTS' ? ' class="pts"' : ''}>${k >= 0 && arr && arr[k] != null && arr[k] !== '' ? esc(arr[k]) : '–'}</td>`).join('');
      const ath = st.athletes || [];
      const rows = (list) => list.map((a) => `<tr><td class="l"><span class="bn">${esc(a.athlete.shortName || a.athlete.displayName)}</span><small>${esc((a.athlete.position || {}).abbreviation || '')}${a.athlete.jersey ? ' · #' + esc(a.athlete.jersey) : ''}</small></td>${a.didNotPlay || !(a.stats || []).length ? `<td colspan="${want.length}" class="l mut">${a.didNotPlay ? 'Did not play' : '–'}</td>` : cells(a.stats)}</tr>`).join('');
      const played = ath.filter((a) => !a.didNotPlay), dnp = ath.filter((a) => a.didNotPlay);
      const starters = played.filter((a) => a.starter), bench = played.filter((a) => !a.starter);
      return `<div class="bxt"><div class="bxh">${logo(+tm.team.id, 'sm')}<b>${esc(tm.team.displayName || tm.team.shortDisplayName || '')}</b></div>
        <div class="bxs"><table><thead><tr><th class="l">Starters</th>${want.map((w) => `<th>${w}</th>`).join('')}</tr></thead><tbody>${rows(starters)}</tbody>
        <thead><tr><th class="l">Bench</th>${want.map((w) => `<th>${w}</th>`).join('')}</tr></thead><tbody>${rows(bench)}${dnp.length ? `<tr class="dnp"><td class="l" colspan="${want.length + 1}">Did not play: ${dnp.map((a) => esc(a.athlete.shortName || a.athlete.displayName)).join(', ')}</td></tr>` : ''}</tbody>
        ${st.totals ? `<tfoot><tr><td class="l"><b>Team</b></td>${cells(st.totals)}</tr></tfoot>` : ''}</table></div></div>`;
    };
    const ab = (tid, fb) => esc((teams.find((x) => String(x.team.id) === String(tid)) || {}).team?.abbreviation || '') || abbrOf(tid, fb);
    // team stats head-to-head (ESPN boxscore.teams)
    const TS = (js.boxscore || {}).teams || [];
    const tAway = TS.find((x) => String(x.team.id) === String(g.away_id)), tHome = TS.find((x) => String(x.team.id) === String(g.home_id));
    let cmp = '';
    if (tAway && tHome) {
      const v = (t, n) => ((t.statistics || []).find((s) => s.name === n) || {}).displayValue;
      const ROWS = [['Field goals', 'fieldGoalsMade-fieldGoalsAttempted', 'fieldGoalPct', 1], ['3-pointers', 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', 'threePointFieldGoalPct', 1], ['Free throws', 'freeThrowsMade-freeThrowsAttempted', 'freeThrowPct', 1],
        ['Rebounds', 'totalRebounds', null, 1], ['Offensive rebounds', 'offensiveRebounds', null, 1], ['Assists', 'assists', null, 1], ['Turnovers', 'totalTurnovers', null, -1], ['Steals', 'steals', null, 1], ['Blocks', 'blocks', null, 1],
        ['Points in the paint', 'pointsInPaint', null, 1], ['Points off turnovers', 'turnoverPoints', null, 1], ['Fast break points', 'fastBreakPoints', null, 1], ['Largest lead', 'largestLead', null, 1], ['Fouls', 'fouls', null, -1]];
      const rowsH = ROWS.map(([lab, k, pk, dir]) => {
        const av = v(tAway, k), hv = v(tHome, k); if (av == null && hv == null) return '';
        const an = pk ? parseFloat(v(tAway, pk)) : parseFloat(av), hn = pk ? parseFloat(v(tHome, pk)) : parseFloat(hv);
        const tot = (an || 0) + (hn || 0), aw = tot ? (an || 0) / tot : 0.5;
        const better = an === hn || isNaN(an) || isNaN(hn) ? 0 : (an > hn ? 1 : -1) * dir;
        const show = (x, pct) => `${esc(x ?? '–')}${pct != null ? `<small>${esc(pct)}%</small>` : ''}`;
        return `<div class="tsr"><b class="${better > 0 ? 'on' : ''}">${show(av, pk ? v(tAway, pk) : null)}</b><div class="tsm"><span>${lab}</span><div class="tsb"><i style="width:${(aw * 100).toFixed(1)}%;background:${C.a}"></i><i style="width:${((1 - aw) * 100).toFixed(1)}%;background:${C.h}"></i></div></div><b class="${better < 0 ? 'on' : ''}">${show(hv, pk ? v(tHome, pk) : null)}</b></div>`;
      }).join('');
      cmp = `<div class="tsx"><div class="tsh">${logo(g.away_id, 'sm')}<span>${ab(g.away_id, g.away)}</span><em>Team stats</em><span>${ab(g.home_id, g.home)}</span>${logo(g.home_id, 'sm')}</div>${rowsH}</div>`;
    }
    const pickT = (side) => teams.find((x) => String(x.team.id) === String(side === 'home' ? g.home_id : g.away_id));
    const view = which === 'stats' ? (cmp || '<div class="empty">Team stats show up once the game starts.</div>') : pickT(which === 'boxH' ? 'home' : 'away') ? one(pickT(which === 'boxH' ? 'home' : 'away')) : '<div class="empty">No box score for this team yet.</div>';
    return `<div class="box2">${view}</div>`;
  }
  function floorSVG(seed) {
    let s = (+seed || 7) % 2147483647; const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
    const tones = ['#e7cb9b', '#e1c28e', '#ebd2a6', '#dcbb86', '#e4c694', '#d8b57f'];
    let out = '', H = 12.5;
    for (let y = 0; y < 500; y += H) { let x = -rnd() * 200; while (x < 940) { const w = 90 + rnd() * 220; out += `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${H}" fill="${tones[Math.floor(rnd() * tones.length)]}"/><line x1="${(x + w).toFixed(1)}" y1="${y}" x2="${(x + w).toFixed(1)}" y2="${y + H}" class="sm"/>`; x += w; } out += `<line x1="0" y1="${y + H}" x2="940" y2="${y + H}" class="sm"/>`; }
    return out;
  }
  // ================================================================ PLAY CARDS (fun feed)
  function buildCards(js, g, plays, AB) {
    const hid = String(g.home_id), aid = String(g.away_id), ab = (t) => (t === hid ? AB[1] : AB[0]);
    const ath = new Map();
    for (const tm of (js.boxscore || {}).players || []) for (const a of ((tm.statistics || [])[0] || {}).athletes || []) ath.set(String(a.athlete.id), { short: a.athlete.shortName || a.athlete.displayName || '', name: a.athlete.displayName || '', head: (a.athlete.headshot || {}).href, team: String(tm.team.id) });
    const S = new Map(), st = (id) => { if (!S.has(id)) S.set(id, { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0 }); return S.get(id); };
    const TM = { [hid]: { miss: 0, miss3: 0, make: 0, three: null, run: 0 }, [aid]: { miss: 0, miss3: 0, make: 0, three: null, run: 0 } };
    const pidOf = (p, k) => String((((p.participants || [])[k] || {}).athlete || {}).id || '');
    const tidOf = (p) => String((p.team || {}).id || '');
    const typ = (p) => String((p.type || {}).text || '');
    const el = (p) => { const per = (p.period || {}).number || 1, [m, s] = String((p.clock || {}).displayValue || '0:00').split(':').map(Number), left = (m || 0) * 60 + (s || 0); return per <= 2 ? (per - 1) * 1200 + 1200 - left : 2400 + (per - 3) * 300 + 300 - left; };
    const who = (id, p) => (ath.get(id) || {}).short || (String(p.text || '').match(/^(.+?) (makes|misses|turnover|bad pass|Offensive|Defensive|Steal|Block)/) || [])[1] || '';
    const wpBy = new Map((js.winprobability || []).map((w) => [String(w.playId), w.homeWinPercentage]));
    let wpPrev = (js.winprobability || [])[0]?.homeWinPercentage ?? null, sa = 0, sh = 0;
    const cards = [];
    let last = null;
    for (const p of plays) {
      const t = typ(p), tid = tidOf(p), opp = tid === hid ? aid : hid, p0 = pidOf(p, 0), p1 = pidOf(p, 1);
      const wpNow = wpBy.get(String(p.id)), dWP = wpNow != null && wpPrev != null ? wpNow - wpPrev : 0; if (wpNow != null) wpPrev = wpNow;
      const before = [sa, sh]; if (p.awayScore != null) { sa = +p.awayScore; sh = +p.homeScore; }
      const isFT = /free throw/i.test(p.text || '') || /freethrow/i.test(t);
      const mk = (o) => ({ p, team: tid, swing: tid === hid ? dWP : -dWP, wp: wpPrev, tags: [], lines: [], score: [sa, sh], ...o });
      const leadTag = (c) => { const [a0, h0] = before, me0 = tid === hid ? h0 - a0 : a0 - h0, me1 = tid === hid ? sh - sa : sa - sh; if (me0 <= 0 && me1 > 0) c.tags.push(['🔀', 'Takes the lead']); else if (me0 < 0 && me1 === 0) c.tags.push(['🤝', 'Ties it up']); };
      const scored = (pts) => { if (!TM[tid]) return; TM[tid].run += pts; TM[opp].run = 0; return TM[tid].run; };
      if (p.shootingPlay && !isFT && tid && TM[tid]) {
        const made = !!p.scoringPlay, three = /three point/i.test(p.text || ''), d = (String(p.text || '').match(/(\d+)-foot/) || [])[1];
        const kind = /dunk/i.test(p.text || '') ? 'dunk' : /layup/i.test(p.text || '') ? 'layup' : /tip/i.test(p.text || '') ? 'tip-in' : /hook/i.test(p.text || '') ? 'hook' : 'jumper';
        const corner = three && p.coordinate && p.coordinate.y < 9 && (p.coordinate.x < 4.5 || p.coordinate.x > 45.5);
        let title = three ? `${d ? d + "' " : ''}${corner ? 'corner ' : ''}three` : kind === 'jumper' ? `${d ? d + "' " : ''}jumper` : kind;
        title = made ? title[0].toUpperCase() + title.slice(1) : 'Missed ' + title;
        const s = st(p0); s.fga++; if (three) s.tpa++; if (made) { s.fgm++; if (three) s.tpm++; s.pts += p.scoreValue || (three ? 3 : 2); }
        const c = mk({ kind: 'shot', made, three, title, id: p0, emoji: made ? (kind === 'dunk' ? '💥' : three ? '🔥' : '🪣') : '🧱' });
        c.lines.push([who(p0, p), made ? (three ? `${s.pts} pt${s.pts === 1 ? '' : 's'} · ${s.tpm} three${s.tpm === 1 ? '' : 's'}` : `${s.pts} pt${s.pts === 1 ? '' : 's'}`) : three ? `${s.tpm}/${s.tpa} 3PT` : `${s.fgm}/${s.fga} FG`]);
        if (made && p1) { const a = st(p1); a.ast++; c.lines.push([who(p1, p), `${a.ast} ast`]); }
        const T0 = TM[tid];
        if (made) {
          T0.make++; T0.miss = 0; if (three) T0.miss3 = 0;
          const run = scored(p.scoreValue || (three ? 3 : 2));
          if (three && T0.three != null && el(p) - T0.three >= 300) { const gap = el(p) - T0.three; c.tags.push(['💧', `First ${ab(tid)} three in ${Math.floor(gap / 60)}:${String(gap % 60).padStart(2, '0')}`]); }
          if (three) T0.three = el(p);
          if (T0.make >= 3) c.tags.push(['📈', `${T0.make}-straight made FG`]);
          if (run >= 8) c.tags.push(['🏃', `${ab(tid)} ${run}-0 run`]);
          leadTag(c);
        } else {
          T0.miss++; T0.make = 0; if (three) T0.miss3++;
          if (T0.miss >= 3) c.tags.push(['📉', `${T0.miss}-straight missed FG`]);
          if (three && T0.miss3 >= 3) c.tags.push(['🧊', `${T0.miss3}-straight missed threes`]);
        }
        cards.push(c); last = c; continue;
      }
      if (isFT && tid && TM[tid]) {
        const made = !!p.scoringPlay, s = st(p0); s.fta++; if (made) { s.ftm++; s.pts += 1; scored(1); }
        if (last && last.kind === 'ft' && last.id === p0 && !last.closed) { last.att++; last.mk += made ? 1 : 0; last.swing += tid === hid ? dWP : -dWP; last.wp = wpPrev; last.score = [sa, sh]; last.p = p; last.s = s; }
        else { last = mk({ kind: 'ft', id: p0, att: 1, mk: made ? 1 : 0, s }); cards.push(last); }
        if (made) leadTag(last);
        continue;
      }
      if (/rebound/i.test(t)) {
        if (p0) { const r = st(p0); r.reb++;
          if (last && (last.kind === 'shot' && !last.made || last.kind === 'ft') && !last.reb) { last.reb = true; last.lines.push([who(p0, p), `${r.reb} reb`]); if (/offensive/i.test(t) && tid === last.team) last.tags.push(['🔄', 'Offensive rebound']); last.closed = true; } }
        continue;
      }
      if (/block/i.test(t)) { if (p0) { const b = st(p0); b.blk++; if (last && last.kind === 'shot' && !last.made) { last.tags.unshift(['🚫', `Blocked by ${who(p0, p)} (${b.blk} blk)`]); last.emoji = '🚫'; } } continue; }
      if (/turnover/i.test(t) && tid && TM[tid]) {
        const det = (String(p.text || '').match(/(bad pass|traveling|offensive foul|shot clock|lost ball|out of bounds|double dribble|3 second|5 second|10 second|charge)/i) || [])[1];
        last = mk({ kind: 'to', id: p0, title: det ? 'Turnover · ' + det.toLowerCase() : 'Turnover', emoji: '🙈' }); last.lines.push([who(p0, p) || ab(tid), '']); cards.push(last); continue;
      }
      if (/steal/i.test(t)) { if (p0) { const x = st(p0); x.stl++; if (last && last.kind === 'to') { last.lines.push([who(p0, p), `${x.stl} stl`]); last.tags.push(['🖐️', 'Steal']); } } continue; }
      if (last && last.kind === 'ft' && !/free throw/i.test(p.text || '')) last.closed = true;
    }
    for (const c of cards) if (c.kind === 'ft') { c.title = `Free throws ${c.mk}/${c.att}`; c.emoji = c.mk === c.att ? '🪣' : c.mk === 0 ? '🧱' : '🎯'; c.lines.unshift([who(c.id, c.p), `${c.s.pts} pt${c.s.pts === 1 ? '' : 's'} · ${c.s.ftm}/${c.s.fta} FT`]); }
    return { cards, ath };
  }
  function cardHTML(c, g, ath, AB, C) {
    const a = ath.get(c.id) || {}, nmS = (c.lines[0] || [])[0] || '', ini = nmS.split(/[ .]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    const per = (c.p.period || {}).number || 1, perL = per <= 2 ? 'H' + per : 'OT' + (per - 2 > 1 ? per - 2 : '');
    const clk = (c.p.clock || {}).displayValue || '', [m, s] = clk.split(':').map(Number), hot = (m || 0) === 0 && s != null;
    const ago = c.p.wallclock ? Math.round((Date.now() - new Date(c.p.wallclock)) / 60000) : null;
    const agoT = ago != null && ago >= 0 && ago < 180 ? ` · ${ago < 1 ? 'now' : ago < 60 ? ago + 'm' : Math.floor(ago / 60) + 'h'}` : '';
    const fav = c.wp == null ? null : c.wp >= 0.5 ? [g.home_id, c.wp] : [g.away_id, 1 - c.wp], fin0 = null;
    const sw = fav ? `<span class="pwp">${logo(fav[0], 'sm')}<b>${isFinal(g) && c === fin0 ? Math.round(100 * fav[1]) : Math.min(99, Math.round(100 * fav[1]))}%</b> to win</span>` : '';
    const right = `<div class="psc"><span class="${c.team === String(g.away_id) ? 'on' : ''}">${c.score[0]}</span><i>-</i><span class="${c.team === String(g.home_id) ? 'on' : ''}">${c.score[1]}</span></div>`;
    return `<div class="pc ${c.kind}${c.made ? ' mk' : ''}">
      <div class="pav"><span class="ini">${esc(ini)}</span>${a.head ? `<img src="${a.head}" alt="" onerror="this.remove()">` : ''}<span class="tlg">${logo(+c.team, 'sm')}</span><i class="em">${c.emoji || ''}</i></div>
      <div class="pbd"><div class="phd"><span>${perL} <em class="${hot ? 'hot' : ''}">${esc(clk)}</em>${agoT}</span></div>
        <div class="ptl">${esc(c.title)}</div>
        ${c.lines.map(([n, v], i) => `<div class="pln${i ? ' sub' : ''}">${esc(n)}${v ? ` <span>· ${esc(v)}</span>` : ''}</div>`).join('')}
        ${c.tags.length ? `<div class="ptg">${c.tags.map(([ic, tx]) => `<span><i>${ic}</i>${esc(tx)}</span>`).join('')}</div>` : ''}</div>
      <div class="prt">${right}${sw}</div></div>`;
  }
  function castTab(g) {
    const js = GC.id === g.event_id ? GC.data : null;
    if (!js) return `<div class="empty">${GC.err ? "Couldn't reach ESPN for play-by-play. It'll retry in a few seconds." : 'Loading plays…'}</div>`;
    const all = (js.plays || []).filter((p) => !/substitution/i.test((p.type || {}).text || ''));
    if (!all.length) return isLive(g) || isFinal(g) || new Date(g.start) < new Date()
      ? `<div class="empty">ESPN isn't sending play-by-play for this game, so there's no Gamecast for it. The score up top still updates when ESPN does.</div>`
      : `<div class="empty">Play-by-play starts at tip-off${g.start ? ' (' + timeOf(g.start) + ')' : ''}.</div>`;
    const hid = String(g.home_id), C = castCols(g), AB = GC.ab || [abbrOf(g.away_id, g.away), abbrOf(g.home_id, g.home)];
    const per = (p) => (p.period || {}).number || 1;
    const plays = GC.half === 1 ? all.filter((p) => per(p) === 1) : GC.half === 2 ? all.filter((p) => per(p) >= 2) : all;
    const isFT = (p) => /free throw/i.test(p.text || '') || /free throw/i.test((p.type || {}).text || '');
    const shots = plays.filter((p) => p.shootingPlay && p.coordinate && !isFT(p) && p.coordinate.x >= -2 && p.coordinate.x <= 52 && p.coordinate.y >= -4 && p.coordinate.y <= 60 && !((p.coordinate.x === 0 || p.coordinate.x === 50) && p.coordinate.y === 0));
    const last = shots[shots.length - 1];
    const isHome = (p) => String((p.team || {}).id) === hid;
    // shooting line per team (from the same shots, plus free throws)
    const line3 = (home) => { const s = shots.filter((p) => isHome(p) === home), m = s.filter((p) => p.scoringPlay).length;
      const t = s.filter((p) => /three point/i.test(p.text || '')), tm = t.filter((p) => p.scoringPlay).length;
      return `${m}-${s.length} FG${s.length ? ` <em>${Math.round(100 * m / s.length)}%</em>` : ''} · ${tm}-${t.length} 3PT`; };
    // court: 94 x 50 ft at 10px/ft. Away shoots at the left basket, home at the right.
    const pos = (p) => { const home = isHome(p); let x = Math.min(49.2, Math.max(0.8, p.coordinate.x)), y = Math.max(p.coordinate.y, 0.8);
      if (y < 3 && x > 18 && x < 32) { y = 5.25 + (y - 1.5) * 0.6; x = 25 + (x - 25) * 0.6; }
      return home ? [940 - y * 10, 500 - x * 10, C.h] : [y * 10, x * 10, C.a]; };
    const end = (m) => { const f = (x) => (m ? 940 - x : x), sw = m ? 0 : 1, lx = m ? 750 : 0;
      const hashes = [70, 80, 110, 140].map((d) => `<line x1="${f(d)}" y1="190" x2="${f(d)}" y2="182"/><line x1="${f(d)}" y1="310" x2="${f(d)}" y2="318"/>`).join('');
      return `<rect x="${lx}" y="190" width="190" height="120" class="lane"/>${hashes}
        <path d="M${f(190)} 190 A60 60 0 0 ${sw} ${f(190)} 310"/><path d="M${f(190)} 190 A60 60 0 0 ${1 - sw} ${f(190)} 310" class="dash"/>
        <path d="M${f(52.5)} 210 A40 40 0 0 ${sw} ${f(52.5)} 290"/>
        <path d="M${f(0)} 34 L${f(101.5)} 34 A221.5 221.5 0 0 ${sw} ${f(101.5)} 466 L${f(0)} 466"/>
        <line x1="${f(40)}" y1="220" x2="${f(40)}" y2="280" class="bb"/><line x1="${f(40)}" y1="250" x2="${f(45)}" y2="250" class="bb2"/><circle cx="${f(52.5)}" cy="250" r="7.5" class="rim"/>`; };
    const dots = shots.map((p) => { const [x, y, col] = pos(p); return p.scoringPlay ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="${col}" stroke="#fff" stroke-width="2.2" filter="url(#ds)"><title>${esc(p.text)}</title></circle>` : `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="#fffaf0" stroke="${col}" stroke-width="2.8" opacity=".9"/><title>${esc(p.text)}</title></g>`; }).join('');
    const lastRing = last && GC.half !== 1 ? (() => { const [x, y, col] = pos(last); return `<circle cx="${x}" cy="${y}" r="17" fill="none" stroke="${col}" stroke-width="2.5" class="pulse"/>`; })() : '';
    // home-branded court: apron in home color, school + mascot on the baselines, arena on top, big logo at center
    const bt = ((js.boxscore || {}).teams || []), hT = (bt.find((x) => String(x.team.id) === hid) || {}).team || {};
    const hx = (x) => (x ? '#' + String(x).replace('#', '') : null);
    let apron = hx(hT.color) || T.get(g.home_id)?.color || '#1d2026'; if (!hexRGB(apron) || lum(apron) > 0.72) apron = '#1d2026';
    const alt = hx(hT.alternateColor), txt = alt && hexRGB(alt) && cdist(alt, apron) > 150 && lum(alt) > lum(apron) ? alt : '#ffffff';
    const lineC = '#ffffff';
    const school = esc((hT.location || T.get(g.home_id)?.team || g.home || '').toUpperCase()), mascot = esc((hT.name || '').toUpperCase());
    const venue = esc((((js.gameInfo || {}).venue || {}).fullName || '').toUpperCase());
    const hLogo = `https://a.espncdn.com/i/teamlogos/ncaa/500/${g.home_id}.png`;
    const fs = (s) => Math.max(18, Math.min(34, Math.floor(470 / Math.max(6, s.length * 0.62))));
    const court = `<svg class="court" viewBox="-64 -44 1068 588" style="--lc:${lineC};--ap:${apron}"><defs>
        <linearGradient id="wd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecd8b1"/><stop offset="1" stop-color="#dec49a"/></linearGradient>
        <pattern id="pl" width="94" height="22" patternUnits="userSpaceOnUse"><rect width="94" height="22" fill="none"/><line x1="0" y1="21.5" x2="94" y2="21.5" stroke="#a9834d" stroke-opacity=".16"/><line x1="61" y1="0" x2="61" y2="21" stroke="#a9834d" stroke-opacity=".09"/></pattern>
        <filter id="ds" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1" stdDeviation="1.3" flood-opacity=".4"/></filter></defs>
      <rect x="-64" y="-44" width="1068" height="588" rx="12" fill="${apron}"/>
      <defs><radialGradient id="sh" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></radialGradient>
        <linearGradient id="tt" x1="0" x2="1"><stop offset="0" stop-color="${apron}" stop-opacity="0"/><stop offset=".55" stop-color="${apron}" stop-opacity=".08"/><stop offset="1" stop-color="${apron}" stop-opacity=".6"/></linearGradient>
        <clipPath id="fc"><rect x="0" y="0" width="940" height="500"/></clipPath></defs>
      <g class="planks" clip-path="url(#fc)">${floorSVG(g.home_id)}</g><rect x="0" y="0" width="940" height="500" fill="url(#tt)"/><rect x="0" y="0" width="940" height="500" fill="url(#sh)"/>
      <text x="-32" y="250" class="apr" fill="${txt}" font-size="${fs(school)}" transform="rotate(-90 -32 250)">${school}</text>
      <text x="972" y="250" class="apr" fill="${txt}" font-size="${fs(mascot || school)}" transform="rotate(90 972 250)">${mascot || school}</text>
      ${venue ? `<text x="470" y="-17" class="apv" fill="${txt}">${venue}</text>` : ''}
      <g class="ln">${end(false)}${end(true)}<line x1="470" y1="0" x2="470" y2="500"/><circle cx="470" cy="250" r="60"/><rect x="0" y="0" width="940" height="500"/></g>
      <image href="${hLogo}" x="385" y="165" width="170" height="170" opacity=".95"/>${dots}${lastRing}</svg>`;
    const half = (k, l) => `<button data-v="${k}" class="${(GC.half || 'all') === k ? 'on' : ''}">${l}</button>`;
    const head = `<div class="chd"><div class="cht">${logo(g.away_id, 'sm')}<b style="color:${C.a}">${AB[0]}</b><span>${line3(false)}</span></div>
      <div class="seg sm" id="gch">${half('all', 'All')}${half(1, '1st half')}${half(2, '2nd half')}</div>
      <div class="cht rt"><span>${line3(true)}</span><b style="color:${C.h}">${AB[1]}</b>${logo(g.home_id, 'sm')}</div></div>`;
    const key = `<div class="ckey"><span><i style="background:${C.a}"></i>${AB[0]}</span><span><i style="background:${C.h}"></i>${AB[1]}</span><span><i class="mk"></i>Made</span><span><i class="ms"></i>Missed</span><span><i class="lt"></i>Latest shot</span></div>`;
    // win probability: home above the 50% line, away below
    const W0 = js.winprobability || [], idIdx = new Map(all.map((p, i) => [String(p.id), i]));
    const wp = W0.map((w) => w.homeWinPercentage).filter((v) => v != null);
    let wpSvg = '';
    if (wp.length > 1) {
      const W = 940, H = 110, X = (i) => (i / (wp.length - 1)) * W, Y = (v) => 6 + (1 - v) * (H - 12), mid = Y(0.5);
      const pts = wp.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
      const area = `M0,${mid} L${pts.join(' L')} L${W},${mid} Z`;
      const firstH2 = (js.plays || []).findIndex((p) => ((p.period || {}).number || 1) >= 2);
      const byId = W0.some((w) => idIdx.has(String(w.playId)));
      const h2 = firstH2 <= 0 ? -1 : byId ? W0.findIndex((w) => (idIdx.get(String(w.playId)) ?? -1) >= all.findIndex((p) => per(p) >= 2)) : Math.round(firstH2 / Math.max(1, (js.plays || []).length - 1) * (wp.length - 1));
      const cur = wp[wp.length - 1], lead = cur >= 0.5 ? [AB[1], cur, C.h] : [AB[0], 1 - cur, C.a];
      wpSvg = `<div class="wpl"><div class="wph"><span>Win probability</span><b style="color:${lead[2]}">${lead[0]} ${pc(lead[1], 0)}%</b></div>
        <div class="wpw"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><clipPath id="wpt"><rect x="0" y="0" width="${W}" height="${mid}"/></clipPath><clipPath id="wpb"><rect x="0" y="${mid}" width="${W}" height="${H - mid}"/></clipPath></defs>
          <path d="${area}" fill="${C.h}" opacity=".16" clip-path="url(#wpt)"/><path d="${area}" fill="${C.a}" opacity=".16" clip-path="url(#wpb)"/>
          <line x1="0" x2="${W}" y1="${mid}" y2="${mid}" class="mid"/>${h2 > 0 ? `<line x1="${X(h2)}" x2="${X(h2)}" y1="0" y2="${H}" class="hv"/>` : ''}
          <path d="M${pts.join(' L')}" fill="none" stroke="var(--ink)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
          <i class="wdot" style="left:100%;top:${(Y(cur) / H * 100).toFixed(1)}%"></i>
          <div class="wpa"><span style="color:${C.h}">${AB[1]}</span>${h2 > 0 ? `<span class="hvl" style="left:${(X(h2) / W * 100).toFixed(1)}%">Half</span>` : ''}<span style="color:${C.a}">${AB[0]}</span></div></div></div>`;
    }
    // feed: one card per shot / free-throw trip / turnover, newest first
    const built = buildCards(js, g, all, AB);
    const inHalf = (cd) => !GC.half || (GC.half === 1 ? ((cd.p.period || {}).number || 1) === 1 : ((cd.p.period || {}).number || 1) >= 2);
    const feed = built.cards.filter(inHalf).reverse(), shown = GC.all ? feed : feed.slice(0, 25);
    return `<div class="cast"><div class="cpin">${head}${court}${key}</div>
      <div class="cscr"><div class="feed"><div class="fhd"><span>Play-by-play</span></div>${shown.map((cd) => cardHTML(cd, g, built.ath, AB, C)).join('')}
      ${!GC.all && feed.length > shown.length ? `<button class="more" id="gcmore">Show all ${feed.length} plays</button>` : ''}</div></div></div>`;
  }
  const abbrOf = (id, fb) => { const n = T.get(id)?.team ?? fb ?? ''; const w = n.split(/[ -]/).filter(Boolean); return esc(w.length > 1 ? w.map((x) => x[0]).join('').toUpperCase() : n.slice(0, 4).toUpperCase()); };

  // ================================================================ RESULTS
  function unitsChart(daily) {
    if (!daily.length) return '';
    const W = 1100, H = 200, P = 34, pts = [{ date: '', cum: 0 }, ...daily];
    const vals = pts.map((d) => d.cum), lo = Math.min(0, ...vals), hi = Math.max(0, ...vals), span = Math.max(hi - lo, 2);
    const X = (i) => P + (i / (pts.length - 1)) * (W - 2 * P), Y = (v) => 14 + ((hi - v) / span) * (H - 44);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.cum).toFixed(1)}`).join('');
    const last = vals[vals.length - 1], col = last >= 0 ? 'var(--pick)' : 'var(--neg)';
    const area = `${d}L${X(pts.length - 1).toFixed(1)},${Y(0).toFixed(1)}L${X(0).toFixed(1)},${Y(0).toFixed(1)}Z`;
    const labels = daily.map((p, i) => (daily.length <= 12 || i % Math.ceil(daily.length / 12) === 0 ? `<text x="${X(i + 1)}" y="${H - 8}" text-anchor="middle">${dayOf(p.date).replace(/^\w+,?\s*/, '')}</text>` : '')).join('');
    return `<svg class="uc" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${area}" fill="${col}" opacity=".08"/>
      <line x1="${P}" x2="${W - P}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line)"/><text x="${P - 6}" y="${Y(0) + 4}" text-anchor="end">0u</text>
      <path d="${d}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      ${pts.slice(1).map((p, i) => `<circle cx="${X(i + 1)}" cy="${Y(p.cum)}" r="3.2" fill="#fff" stroke="${col}" stroke-width="2"><title>${dayOf(p.date)}: ${sg(p.units, 2)}u (total ${sg(p.cum, 2)}u)</title></circle>`).join('')}${labels}</svg>`;
  }
  const RS = { g: 'all', mk: 'all' };
  const GORD = ['A', 'B+', 'B', 'C+', 'C', 'C-'];
  function rSum(rows) {
    const w = rows.filter((r) => r.result === 'W').length, l = rows.filter((r) => r.result === 'L').length, pu = rows.filter((r) => r.result === 'P').length;
    const u = rows.reduce((a, r) => a + (r.profit || 0), 0);
    const cl = rows.map((r) => r.clv).filter((v) => v != null && !isNaN(v));
    return { n: rows.length, w, l, p: pu, u, roi: rows.length ? 100 * u / rows.length : null, wp: w + l ? 100 * w / (w + l) : null, clv: cl.length ? cl.reduce((a, v) => a + v, 0) / cl.length : null };
  }
  function viewResults() {
    const start = D.track_start || '20261104', counts = D.count_grades || ['A', 'B+', 'B'];
    const base = ((D.perf || {}).plays || []).map((r) => ({ ...r, grade: r.grade || grade(r.stars) }));
    const have = new Set(base.map((r) => r.event_id + r.market + r.side));
    const extra = D.games.filter(isFinal).flatMap((g) => g.picks.filter((p) => p.stars >= PLAY && p.result && !have.has(g.event_id + p.market + p.side)).map((p) => ({
      date: g.date, event_id: g.event_id, away: g.away, home: g.home, away_id: g.away_id, home_id: g.home_id, away_score: g.away_score, home_score: g.home_score,
      market: p.market, side: p.side, line: p.line, odds: p.odds, stars: p.stars, grade: gOf(p), potd: !!p.potd, conf: p.conf, result: p.result, profit: 0, clv: p.clv })));
    const all = base.concat(extra).filter((r) => r.date >= start && counts.includes(r.grade));
    const recS = (s) => `${s.w}-${s.l}${s.p ? '-' + s.p : ''}`;
    const uCls = (u) => (u > 0 ? 'pos' : u < 0 ? 'neg' : '');
    const pick = (r) => r.market === 'total' ? `${r.side === 'over' ? 'Over' : 'Under'} ${r.line}` : `${nm(r.side === 'home' ? r.home_id : r.away_id, r.side === 'home' ? r.home : r.away)} ${r.market === 'ml' ? am(r.odds) : line(r.line)}`;
    const rows = all.filter((r) => (RS.g === 'all' || (RS.g === 'potd' ? r.potd : (r.grade || '')[0] === RS.g)) && (RS.mk === 'all' || r.market === RS.mk));
    const s = rSum(rows);
    const days = [...new Set(rows.map((r) => r.date))].sort().reverse();
    const first = all.length ? all.map((r) => r.date).sort()[0] : null;
    const seg = (id, cur, opts) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${v === cur ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const list = !rows.length ? `<div class="empty">${all.length ? 'No graded plays match these filters.' : `Tracking starts ${dayOf(D.track_start || '20261104')}. A, B+ and B plays show up here once their games finish.`}</div>` :
      `<table class="led"><thead><tr><th class="l">Bet</th><th class="l">Game</th><th>Price</th><th title="What the model expected this bet to win">Conf</th><th>Final</th><th>Result</th><th></th></tr></thead><tbody>
      ${days.map((d) => { const x = rows.filter((r) => r.date === d), t = rSum(x);
        return `<tr class="dayh"><td class="l" colspan="7"><div class="dayr"><b>${dayOf(d, true)}</b><span>${recS(t)}</span></div></td></tr>` +
          x.sort((a, b) => ((b.potd ? 1 : 0) - (a.potd ? 1 : 0)) || (GORD.indexOf(a.grade) - GORD.indexOf(b.grade)) || (b.conf - a.conf)).map((r) => `<tr><td class="l"><div class="team">${badge(r.grade, 1)}<b>${pick(r)}</b>${potd(r)}</div></td>
            <td class="l"><div class="team mut">${logo(r.away_id, 'sm')}${logo(r.home_id, 'sm')}<span>${nm(r.away_id, r.away)} at ${nm(r.home_id, r.home)}</span></div></td>
            <td>${am(r.odds)}</td><td>${pc(r.conf)}%</td><td>${r.away_score}-${r.home_score}</td><td>${resChip(r)}</td><td class="end"><a class="vw" href="#game/${r.event_id}">View</a></td></tr>`).join(''); }).join('')}
      </tbody></table>`;
    app.innerHTML = `
      <section class="hero"><div><div class="eyebrow">Tracking</div><h1>Results</h1><div class="meta">A, B+ and B plays · since ${dayOf(first || D.track_start || '20261104')}</div></div>
        <div class="kpis"><div><span>Record</span><b>${s.n ? recS(s) : '–'}</b></div><div><span>Win %</span><b>${s.wp != null ? f1(s.wp) + '%' : '–'}</b></div><div><span title="Closing line value: average points the line moved toward our bet after we'd have placed it. Positive = beating the market">CLV</span><b class="${uCls(s.clv)}">${s.clv != null ? sg(s.clv, 1) : '–'}</b></div></div></section>
      <div class="board"><div class="bar">${seg('rg', RS.g, [['all', 'All'], ['potd', 'POTD'], ['A', 'A'], ['B', 'B']])}${seg('rm', RS.mk, [['all', 'All'], ['spread', 'Spread'], ['total', 'Total'], ['ml', 'Moneyline']])}</div>${list}</div>`;
    app.querySelectorAll('#rg button').forEach((b) => (b.onclick = () => { RS.g = b.dataset.v; viewResults(); }));
    app.querySelectorAll('#rm button').forEach((b) => (b.onclick = () => { RS.mk = b.dataset.v; viewResults(); }));
  }


  // ================================================================ search modal
  const modal = document.getElementById('sm'), sq = document.getElementById('sq'), sr = document.getElementById('sr');
  let hits = [], sel = 0;
  const openSearch = () => { modal.hidden = false; sq.value = ''; render(); setTimeout(() => sq.focus(), 0); };
  const closeSearch = () => { modal.hidden = true; };
  const go = (h) => { closeSearch(); location.hash = h; };
  function render() {
    const q = sq.value.trim().toLowerCase();
    const teamHits = (q ? D.teams.filter((t) => t.team.toLowerCase().includes(q)) : D.teams.slice(0, 8))
      .sort((a, b) => (a.team.toLowerCase().startsWith(q) ? 0 : 1) - (b.team.toLowerCase().startsWith(q) ? 0 : 1) || a.rank - b.rank).slice(0, 8);
    const gameHits = q ? D.games.filter((g) => (nm(g.home_id, g.home) + ' ' + nm(g.away_id, g.away)).toLowerCase().includes(q)).sort((a, b) => (b.date === D.today) - (a.date === D.today) || a.date.localeCompare(b.date)).slice(0, 5) : [];
    hits = [...gameHits.map((g) => ({ h: 'game/' + g.event_id, g })), ...teamHits.map((t) => ({ h: 'team/' + t.team_id, t }))];
    sel = Math.min(sel, Math.max(hits.length - 1, 0));
    let i = 0;
    const row = (x) => {
      const k = i++;
      if (x.g) {
        const g = x.g, fin = g.state === 'post' && g.home_score != null;
        return `<a href="#${x.h}" data-i="${k}" class="${k === sel ? 'sel' : ''}"><span class="ml">${logo(g.away_id, 'sm')}${logo(g.home_id, 'sm')}</span><span class="mt"><b>${nm(g.away_id, g.away)} at ${nm(g.home_id, g.home)}</b><small>${dayOf(g.date)} · ${fin ? `Final ${g.away_score}-${g.home_score}` : timeOf(g.start)}</small></span><span class="mk">Game</span></a>`;
      }
      const t = x.t;
      return `<a href="#${x.h}" data-i="${k}" class="${k === sel ? 'sel' : ''}"><span class="ml">${logo(t.team_id, 'sm')}</span><span class="mt"><b>${esc(t.team)}</b><small>${esc(t.conf)} · ${t.w}-${t.l} · Net ${sg(t.adj_em, 1)}</small></span><span class="mk">#${t.rank}</span></a>`;
    };
    const gp = hits.filter((x) => x.g), tp = hits.filter((x) => x.t);
    sr.innerHTML = (gp.length ? `<div class="mh">Games</div>${gp.map(row).join('')}` : '') + (tp.length ? `<div class="mh">${q ? 'Teams' : 'Top teams'}</div>${tp.map(row).join('')}` : '') || '<div class="mempty">No matches</div>';
    sr.querySelectorAll('a').forEach((a) => { a.onmouseenter = () => { sel = +a.dataset.i; sr.querySelectorAll('a').forEach((x) => x.classList.toggle('sel', x === a)); }; a.onclick = (e) => { e.preventDefault(); go(a.getAttribute('href').slice(1)); }; });
  }
  sq.oninput = () => { sel = 0; render(); };
  sq.onkeydown = (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, hits.length - 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && hits[sel]) go(hits[sel].h);
    else if (e.key === 'Escape') closeSearch();
  };
  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeSearch(); });
  document.getElementById('findBtn').onclick = openSearch;
  document.addEventListener('keydown', (e) => {
    if (!modal.hidden) return;
    if ((e.key === '/' && !e.metaKey && !e.ctrlKey) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); openSearch(); }
  });

  // ================================================================ LIVE SCORES
  // Scores and game status come straight from ESPN's public scoreboard each time the page
  // loads (and every 30s while games are on). Picks and grades still come from the hourly run.
  const LV = { at: null, timer: null };
  const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard';
  async function pullLive() {
    clearTimeout(LV.timer);
    const byId = new Map(D.games.map((g) => [String(g.event_id), g]));
    const dates = [...new Set(D.games.map((g) => g.date))];
    let changed = false, ok = false;
    await Promise.all(dates.map(async (ds) => {
      try {
        const r = await fetch(`${ESPN}?dates=${ds}&groups=50&limit=500`, { cache: 'no-store' });
        if (!r.ok) return;
        const js = await r.json(); ok = true;
        for (const ev of js.events || []) {
          const g = byId.get(String(ev.id)); if (!g) continue;
          const comp = (ev.competitions || [])[0] || {}, st = (comp.status || {}).type || {};
          const side = (k) => (comp.competitors || []).find((x) => x.homeAway === k) || {};
          const hs = side('home').score, as_ = side('away').score;
          const state = st.state, detail = st.shortDetail;
          if (g.final) continue;  // already graded by the model run
          if (state && (state !== g.state || detail !== g.detail || (hs != null && +hs !== g.home_score) || (as_ != null && +as_ !== g.away_score))) changed = true;
          if (state) g.state = state;
          g.detail = detail;
          if (state !== 'pre' && hs != null && as_ != null && hs !== '' && as_ !== '') { g.home_score = +hs; g.away_score = +as_; }
          if (state === 'post' && g.home_score != null) for (const p of g.picks) if (!p.result) p.result = gradeP(p, g.home_score, g.away_score);
        }
      } catch (e) { /* offline or blocked: keep the hourly snapshot */ }
    }));
    if (ok) { LV.at = new Date(); settleBets(); renderSlip(); }
    if (changed || ok) rerender();
    const now = Date.now();
    const busy = D.games.some((g) => g.state === 'in' || (g.state === 'pre' && g.start && Math.abs(new Date(g.start) - now) < 30 * 60e3));
    LV.timer = setTimeout(pullLive, busy ? 30e3 : 5 * 60e3);
  }
  function rerender() {
    const h = location.hash.slice(1) || 'board', [page, arg] = h.split('/');
    const gm = document.getElementById('gm');
    if (basePage === 'board') { const y = window.scrollY; viewBoard(); window.scrollTo(0, y); }
    else if (basePage === 'results') { const y = window.scrollY; viewResults(); window.scrollTo(0, y); }
    else if (basePage === 'profile' && !app.contains(document.activeElement)) { const y = window.scrollY; viewProfile(); window.scrollTo(0, y); }
    if (!gm.hidden && page === 'game') { const s = gm.scrollTop; viewGame(arg); gm.scrollTop = s; }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pullLive(); });

  let basePage = null;
  function closeGame() {
    const gm = document.getElementById('gm');
    if (gm.hidden) return;
    gm.hidden = true; document.body.classList.remove('noscroll'); clearTimeout(GC.timer);
    if (CH.off) { CH.off(); CH.off = null; CH.watching = null; }
    location.hash = basePage || 'board';
  }
  window.__closeModal = closeGame;
  document.getElementById('gm').addEventListener('mousedown', (e) => { if (e.target.id === 'gm') closeGame(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.getElementById('gm').hidden) closeGame(); });
  function route() {
    const h = location.hash.slice(1) || 'board';
    const [page, arg] = h.split('/');
    const p = page === 'picks' ? 'board' : page === 'perf' ? 'results' : page === 'ff' ? 'ratings' : page;
    if (p === 'game' || p === 'team') {
      if (!basePage) {
        basePage = p === 'team' ? 'ratings' : 'board';
        document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === basePage));
        p === 'team' ? viewRatings() : viewBoard();
      }
      p === 'team' ? viewTeam(arg) : viewGame(arg, (D.games.find((x) => x.event_id === arg) || {}).state === 'in' ? 'cast' : 'bet');
      return;
    }
    const gm = document.getElementById('gm'); gm.hidden = true; document.body.classList.remove('noscroll');
    if (h === basePage && app.childElementCount) return;  // closing the game view: page is already there
    basePage = h;
    document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === p));
    window.scrollTo(0, 0);
    if (p === 'ratings') viewRatings(page === 'ff' ? (arg === 'def' ? 'def' : 'off') : arg);
    else if (p === 'results') viewResults();
    else if (p === 'profile') { viewProfile(); settleBets(); }
    else viewBoard();
    document.getElementById('meBtn')?.classList.toggle('on', p === 'profile');
  }
  const hdr = document.querySelector('.hdr');
  const onScroll = () => hdr.classList.toggle('sc', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  window.addEventListener('hashchange', route);
  KStore.on(async (what) => {
    if (what === 'slip') return;
    ME.prof = await KStore.getProfile(); ME.bets = await KStore.listBets(); paintMe();
    const gm = document.getElementById('gm'), [page, arg] = (location.hash.slice(1) || 'board').split('/');
    if (what === 'chat' && arg) CH.list[arg] = await KStore.listMessages(arg);
    if (basePage === 'profile' && !(document.activeElement && document.activeElement.matches('.pin, .pfi'))) { const y = window.scrollY; viewProfile(); window.scrollTo(0, y); }
    else if (basePage === 'board') { const y = window.scrollY; viewBoard(); window.scrollTo(0, y); }
    if (!gm.hidden && (page === 'game' || page === 'team')) { const s = gm.scrollTop; page === 'game' ? viewGame(arg) : viewTeam(arg); gm.scrollTop = s; }
  });
  loadMe().then(async () => { const s = await KStore.getSlip(); Object.assign(SL, { mode: s.mode || 'single', sel: s.sel || [], stakes: s.stakes || {}, pstake: s.pstake || '' }); route(); renderSlip(); pullLive(); settleBets(); });
})();
