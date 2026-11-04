/* Klubhz data store.
 *
 * Everything user-owned (profile, bets, chat) goes through window.KStore.
 *  - Local mode (the copy on the Mac, no config.js keys): saved in this browser.
 *  - Online mode (config.js has Supabase keys): Google sign-in, data in Supabase
 *    (tables: profiles, bets, messages, reactions — see supabase/schema.sql), chat is live.
 * Same async API either way, so app.js doesn't care which one is active.
 * The in-progress bet slip always stays in the browser.
 */
(function () {
  const NS = 'klubhz.v1.';
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const now = () => new Date().toISOString();
  const read = (k, d) => { try { const v = localStorage.getItem(NS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(NS + k, JSON.stringify(v)); return true; } catch (e) { console.warn('Klubhz: could not save', e); return false; } };
  const subs = new Set();
  const emit = (what, data) => subs.forEach((f) => { try { f(what, data); } catch (e) { console.error(e); } });
  window.addEventListener('storage', (e) => { if (e.key && e.key.startsWith(NS)) emit(e.key.slice(NS.length).split('.')[0], null); });

  // ================================================================ local adapter
  function localProfile() {
    let p = read('profile', null);
    if (!p) { p = { id: uid(), name: '', avatar: null, fav_teams: [], created_at: now() }; write('profile', p); }
    return p;
  }
  const Local = {
    mode: 'local',
    async getProfile() { return localProfile(); },
    async saveProfile(patch) { const p = { ...localProfile(), ...patch, updated_at: now() }; write('profile', p); emit('profile', p); return p; },
    async listBets() { return read('bets', []); },
    async addBet(b) { const bets = read('bets', []); const row = { id: uid(), user_id: localProfile().id, placed_at: now(), result: null, ...b }; bets.push(row); write('bets', bets); emit('bets', row); return row; },
    async updateBet(id, patch) { const bets = read('bets', []), i = bets.findIndex((x) => x.id === id); if (i < 0) return null; bets[i] = { ...bets[i], ...patch }; write('bets', bets); emit('bets', bets[i]); return bets[i]; },
    async removeBet(id) { write('bets', read('bets', []).filter((x) => x.id !== id)); emit('bets', null); },
    async listMessages(eventId) { return read('chat.' + eventId, []); },
    async postMessage(eventId, m) {
      const p = localProfile(), list = read('chat.' + eventId, []);
      const row = { id: uid(), event_id: eventId, user_id: p.id, name: p.name || 'You', avatar: p.avatar, created_at: now(), reactions: {}, ...m };
      list.push(row); write('chat.' + eventId, list.slice(-500)); emit('chat', row); return row;
    },
    async react(eventId, msgId, emoji) {
      const me = localProfile().id, list = read('chat.' + eventId, []), m = list.find((x) => x.id === msgId); if (!m) return;
      const who = new Set((m.reactions || {})[emoji] || []); who.has(me) ? who.delete(me) : who.add(me);
      m.reactions = { ...(m.reactions || {}), [emoji]: [...who] }; if (!m.reactions[emoji].length) delete m.reactions[emoji];
      write('chat.' + eventId, list); emit('chat', m);
    },
    async deleteMessage(eventId, msgId) { write('chat.' + eventId, read('chat.' + eventId, []).filter((x) => x.id !== msgId)); emit('chat', null); },
    watchChat() { return () => {}; },
    me() { return localProfile(); },
    account() { return null; },
    async signOut() {},
  };

  // ================================================================ Supabase adapter
  function Remote(sb, session) {
    const me = session.user;
    let prof = null, bets = null;
    const names = new Map();  // user_id -> {name, avatar}
    const toBet = (r) => ({ ...r.data, id: r.id, user_id: r.user_id, placed_at: r.placed_at });
    async function loadProfile() {
      const { data } = await sb.from('profiles').select('*').eq('id', me.id).maybeSingle();
      prof = data || { id: me.id, name: me.user_metadata?.full_name || '', avatar: me.user_metadata?.avatar_url || null, fav_teams: [], created_at: me.created_at };
      if (!data) await sb.from('profiles').upsert({ id: me.id, name: prof.name, avatar: prof.avatar });
      prof.fav_teams = prof.fav_teams || [];
      return prof;
    }
    async function profilesFor(ids) {
      const need = [...new Set(ids)].filter((x) => x && !names.has(x));
      if (need.length) { const { data } = await sb.from('profiles').select('id,name,avatar').in('id', need); (data || []).forEach((p) => names.set(p.id, p)); }
    }
    const A = {
      mode: 'remote',
      async getProfile() { return prof || loadProfile(); },
      async saveProfile(patch) {
        const p = await A.getProfile(), row = { ...patch, updated_at: now() };
        delete row.id; delete row.created_at;
        const { error } = await sb.from('profiles').update(row).eq('id', me.id);
        if (error) throw error;
        prof = { ...p, ...row }; names.set(me.id, { id: me.id, name: prof.name, avatar: prof.avatar }); emit('profile', prof); return prof;
      },
      async listBets() {
        if (bets) return bets;
        const { data } = await sb.from('bets').select('*').eq('user_id', me.id).order('placed_at');
        bets = (data || []).map(toBet); return bets;
      },
      async addBet(b) {
        const body = { placed_at: now(), result: null, ...b }; delete body.id;
        const { data, error } = await sb.from('bets').insert({ data: body }).select().single();
        if (error) throw error;
        (await A.listBets()).push(toBet(data)); emit('bets', null); return toBet(data);
      },
      async updateBet(id, patch) {
        const list = await A.listBets(), i = list.findIndex((x) => x.id === id); if (i < 0) return null;
        const next = { ...list[i], ...patch }, body = { ...next }; delete body.id; delete body.user_id;
        const { error } = await sb.from('bets').update({ data: body, updated_at: now() }).eq('id', id);
        if (error) throw error;
        list[i] = next; emit('bets', next); return next;
      },
      async removeBet(id) { await sb.from('bets').delete().eq('id', id); bets = (await A.listBets()).filter((x) => x.id !== id); emit('bets', null); },

      async listMessages(eventId) {
        const { data: msgs } = await sb.from('messages').select('*').eq('event_id', eventId).order('created_at').limit(500);
        const { data: rx } = await sb.from('reactions').select('message_id,user_id,emoji').eq('event_id', eventId);
        await profilesFor((msgs || []).map((m) => m.user_id));
        const byMsg = {};
        (rx || []).forEach((r) => { ((byMsg[r.message_id] ||= {})[r.emoji] ||= []).push(r.user_id); });
        return (msgs || []).map((m) => ({ ...m, name: names.get(m.user_id)?.name || 'Member', avatar: names.get(m.user_id)?.avatar || null, reactions: byMsg[m.id] || {} }));
      },
      async postMessage(eventId, m) {
        const { data, error } = await sb.from('messages').insert({ event_id: eventId, text: m.text || null, stamp: m.stamp || null, score: m.score || null, bet: m.bet || null }).select().single();
        if (error) throw error;
        emit('chat', data); return data;
      },
      async react(eventId, msgId, emoji) {
        const { data } = await sb.from('reactions').select('message_id').eq('message_id', msgId).eq('user_id', me.id).eq('emoji', emoji).maybeSingle();
        if (data) await sb.from('reactions').delete().eq('message_id', msgId).eq('user_id', me.id).eq('emoji', emoji);
        else await sb.from('reactions').insert({ message_id: msgId, emoji, event_id: eventId });
        emit('chat', null);
      },
      async deleteMessage(eventId, msgId) { await sb.from('messages').delete().eq('id', msgId); emit('chat', null); },
      watchChat(eventId) {  // live: anyone's new messages / reactions in this game re-render the room
        const ch = sb.channel('chat:' + eventId)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `event_id=eq.${eventId}` }, () => emit('chat', null))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions', filter: `event_id=eq.${eventId}` }, () => emit('chat', null))
          .subscribe();
        return () => sb.removeChannel(ch);
      },
      me() { return prof || { id: me.id }; },
      account() { return { email: me.email }; },
      async signOut() { await sb.auth.signOut(); },
      async exportAll() { return { app: 'klubhz', version: 2, exported_at: now(), profile: await A.getProfile(), bets: await A.listBets() }; },
      async importAll() { throw new Error('Restoring a backup is only for the copy on your Mac.'); },
    };
    return A;
  }

  // ================================================================ public API (delegates to the active adapter)
  let impl = Local;
  const S = {
    on(f) { subs.add(f); return () => subs.delete(f); },
    use(adapter) { impl = adapter; },
    remote: Remote,
    get mode() { return impl.mode; },
    getProfile: (...a) => impl.getProfile(...a),
    saveProfile: (...a) => impl.saveProfile(...a),
    async toggleFavorite(teamId) { const p = await impl.getProfile(), t = +teamId, f = new Set(p.fav_teams || []); f.has(t) ? f.delete(t) : f.add(t); return impl.saveProfile({ fav_teams: [...f] }); },
    listBets: (...a) => impl.listBets(...a),
    addBet: (...a) => impl.addBet(...a),
    updateBet: (...a) => impl.updateBet(...a),
    removeBet: (...a) => impl.removeBet(...a),
    listMessages: (...a) => impl.listMessages(...a),
    postMessage: (...a) => impl.postMessage(...a),
    react: (...a) => impl.react(...a),
    deleteMessage: (...a) => impl.deleteMessage(...a),
    watchChat: (...a) => impl.watchChat(...a),
    me: () => impl.me(),
    account: () => impl.account(),
    signOut: () => impl.signOut(),
    // in-progress bet slip: always this browser
    async getSlip() { return read('slip', { mode: 'single', sel: [], stakes: {}, pstake: '' }); },
    async saveSlip(s) { write('slip', s); emit('slip', s); return s; },
    async exportAll() {
      if (impl.exportAll) return impl.exportAll();
      const out = {};
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(NS)) out[k] = localStorage.getItem(k); }
      return { app: 'klubhz', version: 1, exported_at: now(), data: out };
    },
    async importAll(obj) {
      if (impl.importAll) return impl.importAll(obj);
      if (!obj || obj.app !== 'klubhz' || !obj.data) throw new Error('Not a Klubhz backup file');
      for (const [k, v] of Object.entries(obj.data)) if (k.startsWith(NS)) localStorage.setItem(k, v);
      emit('profile', null); emit('bets', null);
    },
  };
  window.KStore = S;
})();
