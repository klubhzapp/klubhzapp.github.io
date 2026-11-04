/* Starts Klubhz. On the Mac (no Supabase keys in config.js): loads the board file and the app.
   Online: Google sign-in first, then downloads the latest board from Supabase and starts the app. */
(function () {
  const C = window.KLUBHZ || {};
  const ver = (document.currentScript && (document.currentScript.src.split('?v=')[1] || '')) || '';
  const q = (f) => f + (ver ? '?v=' + ver : '');
  const load = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Could not load ' + src)); document.body.appendChild(s); });
  if (!C.supabaseUrl || !C.supabaseAnonKey) { load(q('data.js')).then(() => load(q('app.js'))); return; }

  const app = document.getElementById('app'), mark = (document.querySelector('.mark .mk') || {}).outerHTML || '';
  const gate = (html) => { document.body.classList.add('gate'); app.innerHTML = `<div class="gatebox">${html}</div>`; };
  const G = '<svg viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>';
  gate(`<div class="gmark">${mark}</div><div class="gwait">Loading…</div>`);

  load('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js').then(async () => {
    const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
    const { data: { session } } = await sb.auth.getSession();
    if (location.search.includes('code=') || location.hash.includes('access_token')) history.replaceState(null, '', location.pathname + (location.hash.includes('access_token') ? '' : location.hash));
    if (!session) {
      gate(`<div class="gmark">${mark}</div><h1>Klubhz</h1><p>College basketball, priced every hour.</p>
        <button class="gbtn" id="gsign">${G}<span>Continue with Google</span></button><div class="gerr" id="gerr"></div>`);
      document.getElementById('gsign').onclick = async () => {
        const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
        if (error) document.getElementById('gerr').textContent = "Couldn't start Google sign-in. Try again.";
      };
      return;
    }
    KStore.use(KStore.remote(sb, session));
    const { data, error } = await sb.storage.from('board').download('data.json');
    if (error || !data) {
      gate(`<div class="gmark">${mark}</div><h1>Board unavailable</h1><p>The latest board couldn't be loaded. It refreshes every hour.</p><button class="gbtn alt" onclick="location.reload()">Try again</button><button class="lnk" id="gout">Sign out</button>`);
      document.getElementById('gout').onclick = async () => { await sb.auth.signOut(); location.reload(); };
      return;
    }
    window.CBB = JSON.parse(await data.text());
    document.body.classList.remove('gate');
    await load(q('app.js'));
    sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.replace(location.pathname); });
  }).catch(() => gate(`<div class="gmark">${mark}</div><h1>Can't connect</h1><p>Check your connection and try again.</p><button class="gbtn alt" onclick="location.reload()">Try again</button>`));
})();
