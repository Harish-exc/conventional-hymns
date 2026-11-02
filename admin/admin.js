/* =========================================================
   Convention Hymns — admin panel
   ---------------------------------------------------------
   The site is static (GitHub Pages), so:
   - sign-in is checked in the browser against admin/admins.json,
     which holds only salted PBKDF2 hashes, never passwords;
   - edits are kept as a draft in this browser, and the app on the same
     device shows them straight away (for checking) until published;
   - publishing writes songs.js and admin/admins.json to the GitHub
     repository using the admin's own GitHub key (token).
   ========================================================= */
(() => {
  "use strict";

  const REPO = (() => {
    const m = location.hostname.match(/^([\w-]+)\.github\.io$/i);
    const seg = location.pathname.split("/").filter(Boolean)[0];
    return m && seg && seg !== "admin" ? { owner: m[1], name: seg } : { owner: "Harish-exc", name: "conventional-hymns" };
  })();
  const BRANCH = "main";
  const API = `https://api.github.com/repos/${REPO.owner}/${REPO.name}`;
  const FILES = { book: "songs.js", admins: "admin/admins.json" };
  const ITERATIONS = 210000;
  const MIN_PASSWORD = 6;
  const ROLES = { admin: "Full admin", editor: "Editor" };
  const TABS = [
    { id: "hymns",     label: "Songs",        icon: "music",   roles: ["admin", "editor"] },
    { id: "cover",     label: "Title page",   icon: "page",    roles: ["admin", "editor"] },
    { id: "languages", label: "Languages",    icon: "globe",   roles: ["admin"] },
    { id: "settings",  label: "App settings", icon: "sliders", roles: ["admin"] },
    { id: "admins",    label: "Admins",       icon: "users",   roles: ["admin"] },
    { id: "publish",   label: "Publish",      icon: "upload",  roles: ["admin", "editor"] }
  ];

  /* ---------- helpers ---------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#a-${id}"/></svg>`;
  const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
  const keyOf = (o) => {               // short fingerprint of a value
    const s = JSON.stringify(o);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
    return s.length + ":" + (h >>> 0).toString(36);
  };

  function bag(storage) {
    return {
      get(k, fallback) {
        try { const v = storage.getItem("ch-admin:" + k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
      },
      set(k, v) { try { storage.setItem("ch-admin:" + k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
      del(k) { try { storage.removeItem("ch-admin:" + k); } catch { /* blocked */ } }
    };
  }
  const local = bag(localStorage);
  const session = bag(sessionStorage);

  /* ---------- state ---------- */
  const state = {
    user: null,
    token: local.get("token", null) || session.get("token", null),   // entered once, kept on this device
    from: "site",
    sha: {},
    live: null, draft: null,
    adminsLive: null, adminsDraft: null,
    tab: session.get("tab", "hymns"),
    hymnLang: session.get("hymnLang", null),
    hymnQuery: "",
    coverLang: session.get("coverLang", null),
    busy: false
  };
  const D = () => state.draft;

  /* ---------- passwords (PBKDF2-SHA256, same as the hash in admins.json) ---------- */
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const unhex = (h) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));

  async function hashPassword(password, saltHex, iterations) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(saltHex), iterations }, key, 256);
    return hex(bits);
  }
  async function checkPassword(user, password) {
    const h = await hashPassword(password, user.salt, user.iterations || ITERATIONS);
    let diff = h.length ^ user.hash.length;
    for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ (user.hash.charCodeAt(i) || 0);
    return diff === 0;
  }
  async function makeUser(username, password, role) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    return { username, role, salt, iterations: ITERATIONS, hash: await hashPassword(password, salt, ITERATIONS), created: new Date().toISOString().slice(0, 10) };
  }

  /* ---------- GitHub ---------- */
  function toB64(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  const fromB64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

  async function gh(path, opts = {}, token = state.token) {
    const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", Authorization: `Bearer ${token}` };
    if (opts.body) headers["Content-Type"] = "application/json";
    const res = await fetch(API + path, { ...opts, cache: "no-store", headers: { ...headers, ...(opts.headers || {}) } });
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).message || msg; } catch { /* not JSON */ }
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return opts.raw ? res.text() : res.json();
  }
  async function ghGet(path) {
    const data = await gh(`/contents/${path}?ref=${BRANCH}`);
    const text = data.encoding === "base64" && data.content
      ? fromB64(data.content)
      : await gh(`/contents/${path}?ref=${BRANCH}`, { raw: true, headers: { Accept: "application/vnd.github.raw" } });   // files over 1 MB
    return { sha: data.sha, text };
  }
  const ghPut = (path, text, sha, message) =>
    gh(`/contents/${path}`, { method: "PUT", body: JSON.stringify({ message, content: toB64(text), sha, branch: BRANCH }) });

  function ghError(e) {
    if (e.status === 401) return "GitHub did not accept the key. It may be wrong or expired — connect again with a new one.";
    if (e.status === 403 || e.status === 404) {
      return "GitHub won't let this key change the hymn book" + (e.message ? ` (GitHub says: “${e.message}”)` : "") +
        ". Make a new key with the steps above — the easiest is a classic key with the “public_repo” box ticked.";
    }
    if (e.status === 409) return "The website changed while you were publishing. Reload this page and publish again.";
    if (e.status === 422) return "GitHub refused the change: " + e.message;
    return "Couldn't reach GitHub (" + (e.message || "network error") + "). Check the internet connection and try again.";
  }

  /* ---------- the hymn book file ---------- */
  function parseBook(text) {
    const w = {};
    new Function("window", "globalThis", text)(w, w);
    const b = w.HYMN_BOOK;
    if (!b || !Array.isArray(b.languages) || typeof b.songs !== "object") throw new Error("songs.js does not contain a hymn book");
    b.covers = b.covers || {};
    b.settings = b.settings || {};
    b.languages.forEach((l) => { if (!b.songs[l.code]) b.songs[l.code] = []; });
    return b;
  }

  const SONGS_HEADER = `/* =========================================================
   Convention Hymns — song data
   ---------------------------------------------------------
   Edited with the admin panel (admin/). It can also be edited by hand.
   Each song:
     {
       "number": 1,                       hymn number in the book
       "title":  "Song title",
       "author": "Optional",
       "verses": ["line 1\\nline 2", ...],  one string per stanza, \\n = new line
       "chorus": "line 1\\nline 2"          optional, shown after stanza 1
     }
   ========================================================= */

`;
  const songsJs = (book) => SONGS_HEADER + "window.HYMN_BOOK = " + JSON.stringify(book, null, 2) + ";\n";
  const adminsJson = (a) => JSON.stringify(a, null, 2) + "\n";

  async function loadData() {
    let book = null, admins = null;
    state.sha = {};
    state.from = "site";
    if (state.token) {
      try {
        const [b, a] = await Promise.all([ghGet(FILES.book), ghGet(FILES.admins)]);
        book = parseBook(b.text);
        admins = JSON.parse(a.text);
        state.sha = { book: b.sha, admins: a.sha };
        state.from = "github";
      } catch (e) {
        if (e.status === 401) { forgetToken(); setTimeout(() => toast("Your GitHub key stopped working — connect again on Publish"), 600); }
      }
    }
    if (!book) {
      const get = (url) => fetch(url + "?t=" + Date.now(), { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(url + " " + r.status);
        return r.text();
      });
      const [bt, at] = await Promise.all([get("../songs.js"), get("admins.json")]);
      book = parseBook(bt);
      admins = JSON.parse(at);
    }
    if (!admins || !Array.isArray(admins.users)) admins = { version: 1, users: [] };
    state.live = book;
    state.adminsLive = admins;

    // Unpublished edits from an earlier visit (this browser only)
    const draft = local.get("draft", null);
    const adminsDraft = local.get("admins-draft", null);
    const baseNow = keyOf([book, admins]);
    const base = local.get("draft-base", baseNow);
    let keep = !!(draft || adminsDraft);
    if (keep && base !== baseNow) {
      keep = window.confirm("You have unpublished edits from before, but the website has changed since.\n\nOK = keep my edits (publishing them replaces the website version)\nCancel = throw my edits away and start from the website");
    }
    state.draft = keep && draft && Array.isArray(draft.languages) ? draft : clone(book);
    state.adminsDraft = keep && adminsDraft && Array.isArray(adminsDraft.users) ? adminsDraft : clone(admins);
    saveDraft();
  }

  // Keep edits in this browser (the app's ?preview reads "draft").
  function saveDraft() {
    const bookChanged = !same(state.draft, state.live);
    const adminsChanged = !same(state.adminsDraft, state.adminsLive);
    if (bookChanged) local.set("draft", state.draft); else local.del("draft");
    if (adminsChanged) local.set("admins-draft", state.adminsDraft); else local.del("admins-draft");
    if (bookChanged || adminsChanged) local.set("draft-base", keyOf([state.live, state.adminsLive]));
    else local.del("draft-base");
    $("#changes").hidden = !(bookChanged || adminsChanged);
    const badge = $("#nav [data-tab='publish'] .nav__badge");
    if (badge) badge.hidden = !(bookChanged || adminsChanged);
  }
  const changed = () => !same(state.draft, state.live) || !same(state.adminsDraft, state.adminsLive);

  /* ---------- sign in ---------- */
  const can = (tab) => !!state.user && (TABS.find((t) => t.id === tab) || { roles: [] }).roles.includes(state.user.role);
  const findUser = (list, name) => list.users.find((u) => u.username.toLowerCase() === String(name).trim().toLowerCase());

  async function onLogin(e) {
    e.preventDefault();
    const form = e.target;
    const err = $("#loginError");
    const lock = session.get("lock", 0);
    if (Date.now() < lock) {
      err.textContent = `Too many tries. Wait ${Math.ceil((lock - Date.now()) / 1000)} seconds.`;
      err.hidden = false;
      return;
    }
    const btn = $("#loginBtn");
    btn.disabled = true;
    err.hidden = true;
    try {
      const user = findUser(state.adminsLive, form.username.value) || findUser(state.adminsDraft, form.username.value);
      const ok = user ? await checkPassword(user, form.password.value) : (await hashPassword(form.password.value, "00".repeat(16), ITERATIONS), false);
      if (!ok) {
        const fails = session.get("fails", 0) + 1;
        session.set("fails", fails);
        if (fails >= 5) { session.set("lock", Date.now() + 30000); session.set("fails", 0); }
        err.textContent = "Wrong username or password.";
        err.hidden = false;
        form.password.select();
        return;
      }
      session.set("fails", 0);
      session.set("user", user.username);
      form.reset();
      enter(user);
    } catch {
      err.textContent = "Sign-in needs a secure (https) page. Open the admin panel from the website address.";
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  }

  function enter(user) {
    state.user = { username: user.username, role: ROLES[user.role] ? user.role : "editor" };
    $("#login").hidden = true;
    $("#app").hidden = false;
    $("#userChip").textContent = `${state.user.username} · ${ROLES[state.user.role]}`;
    if (!can(state.tab)) state.tab = "hymns";
    renderNav();
    render();
    saveDraft();
  }

  function logout() {
    session.del("user");
    state.user = null;
    $("#app").hidden = true;
    $("#login").hidden = false;
    closeModal();
    $("#loginForm").username.focus();
  }

  /* ---------- shell ---------- */
  function renderNav() {
    $("#nav").innerHTML = TABS.filter((t) => can(t.id)).map((t) => `
      <button class="nav__btn${t.id === state.tab ? " is-on" : ""}" type="button" data-act="tab" data-tab="${t.id}" aria-current="${t.id === state.tab ? "page" : "false"}">
        ${icon(t.icon)}${esc(t.label)}${t.id === "publish" ? '<span class="nav__badge" hidden></span>' : ""}
      </button>`).join("");
  }

  function setTab(tab) {
    if (!can(tab)) return;
    state.tab = tab;
    session.set("tab", tab);
    renderNav();
    render();
    saveDraft();
    window.scrollTo(0, 0);
  }

  const VIEWS = {};
  function render() {
    $("#view").innerHTML = VIEWS[state.tab]();
    if (state.tab === "hymns") renderHymnList();
  }

  // After any edit: remember it, refresh the screen, say what happened.
  function commit(message) {
    saveDraft();
    render();
    if (message) toast(message);
  }

  let toastTimer = 0;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-on"), 2600);
  }

  let modalReturn = null;
  function openModal(html) {
    modalReturn = document.activeElement;
    $("#modalPanel").innerHTML = html;
    $("#modal").hidden = false;
    const first = $("#modalPanel input, #modalPanel textarea, #modalPanel select");
    requestAnimationFrame(() => (first || $("#modalPanel")).focus());
  }
  function closeModal() {
    if ($("#modal").hidden) return;
    $("#modal").hidden = true;
    $("#modalPanel").innerHTML = "";
    if (modalReturn && modalReturn.focus && document.contains(modalReturn)) modalReturn.focus();
  }
  function formError(msg) {
    const box = $("#formError");
    box.textContent = msg;
    box.hidden = false;
    box.scrollIntoView({ block: "nearest" });
  }

  const langName = (code) => {
    const l = D().languages.find((x) => x.code === code);
    return l ? l.name : code;
  };
  function langChips(current, act) {
    return `<div class="chips" role="group" aria-label="Language">${D().languages.map((l) => `
      <button class="chip${l.code === current ? " is-on" : ""}" type="button" data-act="${act}" data-code="${esc(l.code)}" aria-pressed="${l.code === current}">
        <span lang="${esc(l.code)}">${esc(l.native)}</span> <small>${esc(l.name)}</small>
      </button>`).join("")}</div>`;
  }
  // A song's words as one text: parts separated by an empty line.
  // Older songs keep stanzas and chorus apart; join them the way the app shows them.
  const lyricsOf = (s) => s.lyrics != null ? s.lyrics
    : [(s.verses || [])[0], s.chorus, ...(s.verses || []).slice(1)].filter((p) => p && p.trim()).join("\n\n");
  const firstLine = (s) => lyricsOf(s).trim().split("\n")[0] || "";
  const songsOf = (code) => (D().songs[code] || []).slice().sort((a, b) => a.number - b.number);

  /* =========================================================
     Hymns
     ========================================================= */
  function ensureLang(key) {
    const langs = D().languages;
    if (!langs.some((l) => l.code === state[key])) state[key] = langs.length ? langs[0].code : null;
    session.set(key, state[key]);
    return state[key];
  }

  VIEWS.hymns = () => {
    const code = ensureLang("hymnLang");
    if (!code) return `<div class="card"><p class="empty">Add a language first (Languages).</p></div>`;
    return `
      <button class="add-big" type="button" data-act="hymn-new">
        <span class="add-big__plus" aria-hidden="true">+</span>
        <span class="add-big__text"><b>Add a song</b><span>Song title and the words — that's all</span></span>
      </button>
      <div class="view-head" style="margin-top:22px"><div><h1>Songs</h1><p>Tap a song to change or delete it.</p></div></div>
      ${langChips(code, "hymn-lang")}
      <div class="toolbar">
        <input class="input" type="search" id="hymnSearch" placeholder="Search by number, title or words" value="${esc(state.hymnQuery)}" aria-label="Search songs">
      </div>
      <p class="muted" id="hymnCount" style="margin:0 0 8px;font-size:13px"></p>
      <div class="card list" id="hymnList"></div>`;
  };

  function renderHymnList() {
    const code = state.hymnLang;
    const list = songsOf(code);
    const q = state.hymnQuery.trim().toLowerCase();
    const rows = q
      ? list.filter((s) => String(s.number) === q || s.title.toLowerCase().includes(q) || lyricsOf(s).toLowerCase().includes(q))
      : list;
    $("#hymnCount").textContent = q ? `${rows.length} of ${plural(list.length, "song")}` : plural(list.length, "song");
    $("#hymnList").innerHTML = rows.map((s) => `
      <button class="row row--tap" type="button" data-act="hymn-edit" data-n="${esc(s.number)}">
        <span class="num">${esc(s.number)}</span>
        <span class="row__main"><b lang="${esc(code)}">${esc(s.title)}</b><span lang="${esc(code)}">${esc(firstLine(s))}</span></span>
        <span class="row__go" aria-hidden="true">Edit ›</span>
      </button>`).join("") || `<p class="empty">${q ? "No songs match your search." : "No songs in this language yet — tap “Add a song”."}</p>`;
  }

  const stanzaBox = (text, i, lang, name = "verse") => `
    <div class="stanza">
      <span class="stanza__n">${i + 1}</span>
      <textarea class="input" rows="4" name="${name}" lang="${esc(lang)}" aria-label="Part ${i + 1}">${esc(text)}</textarea>
      <button type="button" class="x-btn" data-act="stanza-del" aria-label="Remove">×</button>
    </div>`;

  const nextNumber = (code) => Math.max(0, ...(D().songs[code] || []).map((s) => s.number)) + 1;

  function openHymnEditor(number) {
    const code = state.hymnLang;
    const song = number == null ? null : (D().songs[code] || []).find((s) => s.number === number);
    openModal(`
      <h2>${song ? "Change song" : "Add a song"}</h2>
      <form id="hymnForm" data-orig="${song ? esc(song.number) : ""}" data-orig-lang="${esc(code)}" novalidate>
        <div class="grid2">
          <label class="field"><span>Language</span>
            <select class="input" name="lang">${D().languages.map((l) => `<option value="${esc(l.code)}" ${l.code === code ? "selected" : ""}>${esc(l.native)} — ${esc(l.name)}</option>`).join("")}</select></label>
          <label class="field"><span>Song number</span>
            <input class="input" name="number" type="number" min="1" step="1" inputmode="numeric" value="${esc(song ? song.number : nextNumber(code))}"></label>
        </div>
        <label class="field"><span>Song title</span>
          <input class="input input--big" name="title" lang="${esc(code)}" value="${esc(song ? song.title : "")}" placeholder="Title of the song"></label>
        <label class="field"><span>Lyrics <small>— type or paste the whole song: pallavi and every charanam together.
          Leave one empty line between the parts.</small></span>
          <textarea class="input lyrics-box" name="lyrics" rows="14" lang="${esc(code)}" placeholder="Pallavi line 1&#10;Pallavi line 2&#10;&#10;Charanam 1 line 1&#10;Charanam 1 line 2&#10;&#10;Charanam 2 line 1 …">${esc(song ? lyricsOf(song) : "")}</textarea></label>
        <p class="form-error" id="formError" role="alert" hidden></p>
        <div class="modal__acts">
          ${song ? `<button type="button" class="btn btn--danger-ghost" data-act="hymn-del" data-n="${esc(song.number)}">Delete song</button>` : ""}
          <span class="grow"></span>
          <button type="button" class="btn btn--ghost" data-act="modal-close">Cancel</button>
          <button class="btn btn--primary btn--wide" type="submit">Save song</button>
        </div>
      </form>`);
    const form = $("#hymnForm");
    // A new song gets the next free number of the language picked.
    form.lang.addEventListener("change", () => {
      form.title.lang = form.lyrics.lang = form.lang.value;
      if (!song) form.number.value = nextNumber(form.lang.value);
    });
  }

  function saveHymn(form) {
    const code = form.lang.value;
    const origLang = form.dataset.origLang;
    const orig = form.dataset.orig ? Number(form.dataset.orig) : null;
    const list = D().songs[code] || (D().songs[code] = []);
    const number = Number(form.number.value);
    const title = form.title.value.trim();
    // Tidy the words: no spaces at line ends, at most one empty line between parts.
    const lyrics = form.lyrics.value.replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, ""))
      .join("\n").replace(/\n{3,}/g, "\n\n").trim();
    const moved = orig != null && code !== origLang;
    if (!Number.isInteger(number) || number < 1) return formError("Song number must be a whole number, 1 or more.");
    if (list.some((s) => s.number === number && (moved || s.number !== orig))) return formError(`Song ${number} already exists in ${langName(code)}. Use another number.`);
    if (!title) return formError("Please type the song title.");
    if (!lyrics) return formError("Please type the lyrics.");
    const old = orig == null ? null : (D().songs[origLang] || []).find((s) => s.number === orig);
    const song = { number, title };
    if (old && old.author) song.author = old.author;
    song.lyrics = lyrics;
    if (old) D().songs[origLang] = D().songs[origLang].filter((s) => s !== old);
    list.push(song);
    list.sort((a, b) => a.number - b.number);
    state.hymnLang = code;
    session.set("hymnLang", code);
    closeModal();
    commit(orig == null ? `Song ${number} added — open the app to see it` : `Song ${number} saved`);
  }

  function deleteHymn(number) {
    const code = state.hymnLang;
    const s = (D().songs[code] || []).find((x) => x.number === number);
    if (!s || !window.confirm(`Delete song ${number} “${s.title}” from ${langName(code)}?`)) return;
    D().songs[code] = D().songs[code].filter((x) => x.number !== number);
    closeModal();
    commit(`Song ${number} deleted`);
  }

  /* =========================================================
     Title page
     ========================================================= */
  VIEWS.cover = () => {
    const code = ensureLang("coverLang");
    if (!code) return `<div class="card"><p class="empty">Add a language first (Languages).</p></div>`;
    const c = D().covers[code];
    const head = `
      <div class="view-head"><div><h1>Title page</h1><p>The page with the Bible verse, shown after choosing the app language.</p></div></div>
      ${langChips(code, "cover-lang")}`;
    if (!c) {
      return head + `
        <div class="card card--pad">
          <h2>${esc(langName(code))} has no title page of its own</h2>
          <p>The app shows the Odia title page for this language.</p>
          <div class="modal__acts"><button class="btn btn--primary" type="button" data-act="cover-create">Create a ${esc(langName(code))} title page</button></div>
        </div>`;
    }
    const verses = c.verse && c.verse.length ? c.verse : [""];
    return head + `
      <form class="card card--pad" id="coverForm" novalidate>
        <label class="field" style="margin-top:0"><span>Title</span><input class="input" name="title" lang="${esc(code)}" value="${esc(c.title)}"></label>
        <div class="field">
          <span>Verse paragraphs</span>
          <div id="stanzas" data-name="cverse">${verses.map((v, i) => stanzaBox(v, i, code, "cverse")).join("")}</div>
          <div><button type="button" class="btn btn--ghost btn--sm" data-act="stanza-add">+ Add paragraph</button></div>
        </div>
        <label class="field"><span>Bible reference</span><input class="input" name="cite" lang="${esc(code)}" value="${esc(c.cite)}"></label>
        <label class="field"><span>Fellowship line</span><input class="input" name="fellowship" lang="${esc(code)}" value="${esc(c.fellowship)}"></label>
        <label class="field"><span>Tag line</span><input class="input" name="tag" lang="${esc(code)}" value="${esc(c.tag)}"></label>
        <label class="field"><span>Published by</span><input class="input" name="by" lang="${esc(code)}" value="${esc(c.by)}"></label>
        <p class="form-error" id="formError" role="alert" hidden></p>
        <div class="modal__acts">
          ${code !== "or" ? `<button type="button" class="btn btn--danger-ghost" data-act="cover-remove">Remove this title page</button>` : ""}
          <span class="grow"></span>
          <button class="btn btn--primary" type="submit">Save title page</button>
        </div>
      </form>`;
  };

  function saveCover(form) {
    const code = state.coverLang;
    const title = form.title.value.trim();
    const verse = $$("textarea[name='cverse']", form).map((t) => t.value.trim()).filter(Boolean);
    if (!title) return formError("Please enter the title.");
    if (!verse.length) return formError("Please enter at least one verse paragraph.");
    D().covers[code] = {
      title, verse,
      cite: form.cite.value.trim(),
      fellowship: form.fellowship.value.trim(),
      tag: form.tag.value.trim(),
      by: form.by.value.trim()
    };
    commit(`${langName(code)} title page saved`);
  }

  /* =========================================================
     Languages
     ========================================================= */
  VIEWS.languages = () => {
    const b = D();
    return `
      <div class="view-head">
        <div><h1>Languages</h1><p>The order here is the order in the app. The first six have reading-letter support built in.</p></div>
        <button class="btn btn--primary" type="button" data-act="lang-new">+ Add language</button>
      </div>
      <div class="card list">${b.languages.map((l, i) => `
        <div class="row">
          <span class="num" lang="${esc(l.code)}">${esc(l.glyph || l.code)}</span>
          <div class="row__main"><b lang="${esc(l.code)}">${esc(l.native)} <span class="tag">${esc(l.code)}</span></b>
            <span>${esc(l.name)} · ${plural((b.songs[l.code] || []).length, "hymn")} · chorus “<span lang="${esc(l.code)}">${esc(l.chorus)}</span>”</span></div>
          <div class="row__acts">
            <button class="btn btn--ghost btn--sm" type="button" data-act="lang-up" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
            <button class="btn btn--ghost btn--sm" type="button" data-act="lang-down" data-i="${i}" ${i === b.languages.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
            <button class="btn btn--ghost btn--sm" type="button" data-act="lang-edit" data-i="${i}">Edit</button>
            <button class="btn btn--danger-ghost btn--sm" type="button" data-act="lang-del" data-i="${i}" ${b.languages.length < 2 ? "disabled" : ""}>Delete</button>
          </div>
        </div>`).join("")}</div>`;
  };

  function openLangEditor(i) {
    const l = i == null ? { code: "", name: "", native: "", glyph: "", chorus: "Chorus" } : D().languages[i];
    openModal(`
      <h2>${i == null ? "Add language" : `Edit ${esc(l.name)}`}</h2>
      <form id="langForm" data-i="${i == null ? "" : i}" novalidate>
        <div class="grid2">
          <label class="field"><span>Code <small>(2–3 small letters, e.g. ta)</small></span>
            <input class="input" name="code" value="${esc(l.code)}" ${i == null ? "" : "readonly"} autocapitalize="off" spellcheck="false" maxlength="3"></label>
          <label class="field"><span>Name in English</span><input class="input" name="name" value="${esc(l.name)}"></label>
          <label class="field"><span>Name in the language</span><input class="input" name="native" value="${esc(l.native)}"></label>
          <label class="field"><span>Short mark <small>(1–2 letters on the card)</small></span><input class="input" name="glyph" value="${esc(l.glyph)}" maxlength="4"></label>
        </div>
        <label class="field"><span>Word for “Chorus”</span><input class="input" name="chorus" value="${esc(l.chorus)}"></label>
        <p class="form-error" id="formError" role="alert" hidden></p>
        <div class="modal__acts"><span class="grow"></span>
          <button type="button" class="btn btn--ghost" data-act="modal-close">Cancel</button>
          <button class="btn btn--primary" type="submit">Save language</button>
        </div>
      </form>`);
  }

  function saveLang(form) {
    const b = D();
    const i = form.dataset.i === "" ? null : Number(form.dataset.i);
    const l = {
      code: form.code.value.trim().toLowerCase(),
      name: form.name.value.trim(),
      native: form.native.value.trim(),
      glyph: form.glyph.value.trim(),
      chorus: form.chorus.value.trim() || "Chorus"
    };
    if (i == null) {
      if (!/^[a-z]{2,3}$/.test(l.code)) return formError("Code must be 2 or 3 small letters (a–z).");
      if (b.languages.some((x) => x.code === l.code)) return formError(`The code “${l.code}” is already used.`);
    }
    if (!l.name || !l.native) return formError("Please fill in both names.");
    if (!l.glyph) l.glyph = [...l.native][0] || l.code;
    if (i == null) { b.languages.push(l); b.songs[l.code] = []; }
    else b.languages[i] = l;
    closeModal();
    commit(i == null ? `${l.name} added` : `${l.name} saved`);
  }

  function deleteLang(i) {
    const b = D();
    const l = b.languages[i];
    const n = (b.songs[l.code] || []).length;
    if (!window.confirm(`Delete ${l.name}${n ? ` and its ${plural(n, "hymn")}` : ""}? This also removes its title page.`)) return;
    b.languages.splice(i, 1);
    delete b.songs[l.code];
    delete b.covers[l.code];
    commit(`${l.name} deleted`);
  }

  function moveLang(i, d) {
    const list = D().languages;
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    commit();
  }

  /* =========================================================
     App settings
     ========================================================= */
  VIEWS.settings = () => {
    const s = D().settings || {};
    return `
      <div class="view-head"><div><h1>App settings</h1><p>Settings for everyone who uses the app.</p></div></div>
      <form class="card card--pad" id="settingsForm" novalidate>
        <h2>Front page</h2>
        <label class="field"><span>Seconds the front page (book) is shown <small>(1–15)</small></span>
          <input class="input" name="splash" type="number" min="1" max="15" step="1" inputmode="numeric" value="${esc(s.splashSeconds || 5)}" style="max-width:160px"></label>
        <h2 style="margin-top:24px">Notice for singers</h2>
        <p class="muted" style="margin:0;font-size:14px">Shown at the top of the “Choose your language for singing” page — for example the next meeting or convention.</p>
        <label class="field"><span>Notice text</span><textarea class="input" name="notice" rows="3" maxlength="400">${esc(s.notice || "")}</textarea></label>
        <label class="check"><input type="checkbox" name="noticeOn" ${s.noticeOn === false ? "" : "checked"}> Show the notice in the app</label>
        <p class="form-error" id="formError" role="alert" hidden></p>
        <div class="modal__acts"><span class="grow"></span><button class="btn btn--primary" type="submit">Save settings</button></div>
      </form>`;
  };

  function saveSettings(form) {
    const secs = Number(form.splash.value);
    if (!Number.isInteger(secs) || secs < 1 || secs > 15) return formError("Seconds must be a whole number from 1 to 15.");
    const s = D().settings || (D().settings = {});
    s.splashSeconds = secs;
    s.notice = form.notice.value.trim();
    s.noticeOn = form.noticeOn.checked;
    commit("Settings saved");
  }

  /* =========================================================
     Admins
     ========================================================= */
  VIEWS.admins = () => {
    const users = state.adminsDraft.users;
    const pendingNote = same(state.adminsDraft, state.adminsLive) ? "" :
      `<p class="form-ok">Admin changes take effect after you publish. Until then, everyone signs in with the old details.</p>`;
    return `
      <div class="view-head">
        <div><h1>Admins</h1><p>Give other people access. Full admins can change everything; editors can change hymns and title pages.</p></div>
        <button class="btn btn--primary" type="button" data-act="user-new">+ Add admin</button>
      </div>
      ${pendingNote}
      <div class="card list" style="margin-top:12px">${users.map((u, i) => `
        <div class="row">
          <span class="num">${esc(u.username.slice(0, 1).toUpperCase())}</span>
          <div class="row__main"><b>${esc(u.username)} ${u.username === state.user.username ? '<span class="tag tag--gold">you</span>' : ""}</b>
            <span>${esc(ROLES[u.role] || u.role)}${u.created ? " · added " + esc(u.created) : ""}</span></div>
          <div class="row__acts">
            ${u.username === state.user.username
              ? `<button class="btn btn--ghost btn--sm" type="button" data-act="pw-mine">Change my password</button>`
              : `<button class="btn btn--ghost btn--sm" type="button" data-act="user-edit" data-i="${i}">Edit</button>
                 <button class="btn btn--danger-ghost btn--sm" type="button" data-act="user-del" data-i="${i}">Remove</button>`}
          </div>
        </div>`).join("")}</div>`;
  };

  function openUserEditor(i) {
    const u = i == null ? null : state.adminsDraft.users[i];
    openModal(`
      <h2>${u ? `Edit ${esc(u.username)}` : "Add admin"}</h2>
      <p>${u ? "Change the role, or set a new password (leave empty to keep it)." : "They sign in at this admin page with these details."}</p>
      <form id="userForm" data-i="${u ? i : ""}" novalidate>
        <label class="field"><span>Username <small>(letters, numbers, . _ -)</small></span>
          <input class="input" name="username" value="${u ? esc(u.username) : ""}" ${u ? "readonly" : ""} autocapitalize="off" spellcheck="false" autocomplete="off"></label>
        <label class="field"><span>Role</span>
          <select class="input" name="role">
            ${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${(u ? u.role : "admin") === k ? "selected" : ""}>${v}${k === "admin" ? " — all permissions" : " — hymns and title pages"}</option>`).join("")}
          </select></label>
        <div class="grid2">
          <label class="field"><span>${u ? "New password" : "Password"} <small>(at least ${MIN_PASSWORD} characters)</small></span><input class="input" name="password" type="password" autocomplete="new-password"></label>
          <label class="field"><span>Repeat password</span><input class="input" name="password2" type="password" autocomplete="new-password"></label>
        </div>
        <p class="form-error" id="formError" role="alert" hidden></p>
        <div class="modal__acts"><span class="grow"></span>
          <button type="button" class="btn btn--ghost" data-act="modal-close">Cancel</button>
          <button class="btn btn--primary" type="submit">${u ? "Save" : "Add admin"}</button>
        </div>
      </form>`);
  }

  async function saveUser(form) {
    const users = state.adminsDraft.users;
    const i = form.dataset.i === "" ? null : Number(form.dataset.i);
    const username = form.username.value.trim();
    const role = form.role.value;
    const pw = form.password.value;
    if (i == null) {
      if (!/^[a-z0-9._-]{3,32}$/i.test(username)) return formError("Username: 3–32 letters, numbers, dot, dash or underscore.");
      if (findUser(state.adminsDraft, username)) return formError(`“${username}” already exists.`);
    }
    if ((i == null || pw) && pw.length < MIN_PASSWORD) return formError(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (pw !== form.password2.value) return formError("The two passwords are not the same.");
    if (i != null && role !== "admin" && users[i].role === "admin" && users.filter((u) => u.role === "admin").length < 2) {
      return formError("There must always be at least one full admin.");
    }
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    if (i == null) users.push(await makeUser(username, pw, role));
    else {
      const base = pw ? await makeUser(users[i].username, pw, role) : { ...users[i], role };
      users[i] = { ...base, created: users[i].created };
    }
    closeModal();
    commit(i == null ? `${username} added — publish to give access` : `${users[i].username} saved — publish to apply`);
  }

  function removeUser(i) {
    const users = state.adminsDraft.users;
    const u = users[i];
    if (u.username === state.user.username) return;
    if (u.role === "admin" && users.filter((x) => x.role === "admin").length < 2) { toast("There must always be at least one full admin"); return; }
    if (!window.confirm(`Remove ${u.username}? They will no longer be able to sign in once you publish.`)) return;
    users.splice(i, 1);
    commit(`${u.username} removed — publish to apply`);
  }

  function openMyPassword() {
    openModal(`
      <h2>Change my password</h2>
      <p>The new password works after you publish.</p>
      <form id="myPwForm" novalidate>
        <label class="field"><span>Current password</span><input class="input" name="current" type="password" autocomplete="current-password"></label>
        <div class="grid2">
          <label class="field"><span>New password <small>(at least ${MIN_PASSWORD} characters)</small></span><input class="input" name="password" type="password" autocomplete="new-password"></label>
          <label class="field"><span>Repeat new password</span><input class="input" name="password2" type="password" autocomplete="new-password"></label>
        </div>
        <p class="form-error" id="formError" role="alert" hidden></p>
        <div class="modal__acts"><span class="grow"></span>
          <button type="button" class="btn btn--ghost" data-act="modal-close">Cancel</button>
          <button class="btn btn--primary" type="submit">Change password</button>
        </div>
      </form>`);
  }

  async function saveMyPassword(form) {
    const live = findUser(state.adminsLive, state.user.username) || findUser(state.adminsDraft, state.user.username);
    if (!live || !(await checkPassword(live, form.current.value))) return formError("The current password is not right.");
    if (form.password.value.length < MIN_PASSWORD) return formError(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (form.password.value !== form.password2.value) return formError("The two new passwords are not the same.");
    const users = state.adminsDraft.users;
    const i = users.findIndex((u) => u.username === state.user.username);
    const fresh = await makeUser(state.user.username, form.password.value, users[i].role);
    users[i] = { ...fresh, created: users[i].created };
    closeModal();
    commit("Password changed — publish to apply");
  }

  /* =========================================================
     Publish & backup
     ========================================================= */
  function changeList() {
    const L = state.live, N = state.draft, out = [];
    const codes = [...new Set([...L.languages.map((l) => l.code), ...N.languages.map((l) => l.code)])];
    codes.forEach((code) => {
      const a = L.languages.find((l) => l.code === code), b = N.languages.find((l) => l.code === code);
      const name = (b || a).name;
      if (!a) out.push(`New language: ${name}`);
      else if (!b) { out.push(`Language removed: ${name}`); return; }
      else if (!same(a, b)) out.push(`${name}: language details changed`);
      const old = new Map((L.songs[code] || []).map((s) => [s.number, s]));
      const now = new Map((N.songs[code] || []).map((s) => [s.number, s]));
      let add = 0, edit = 0, del = 0;
      now.forEach((s, n) => { if (!old.has(n)) add++; else if (!same(old.get(n), s)) edit++; });
      old.forEach((_, n) => { if (!now.has(n)) del++; });
      const bits = [add && `${add} added`, edit && `${edit} changed`, del && `${del} deleted`].filter(Boolean);
      if (bits.length) out.push(`${name} songs: ${bits.join(", ")}`);
      if (!same(L.covers[code], N.covers[code])) out.push(`${name} title page changed`);
    });
    if (!same(L.languages.map((l) => l.code).filter((c) => N.languages.some((l) => l.code === c)),
              N.languages.map((l) => l.code).filter((c) => L.languages.some((l) => l.code === c)))) out.push("Language order changed");
    if (!same(L.settings || {}, N.settings || {})) out.push("App settings changed");
    if (!same(state.adminsLive, state.adminsDraft)) out.push("Admins or passwords changed");
    return out;
  }

  VIEWS.publish = () => {
    const list = changed() ? changeList() : [];
    return `
      <div class="view-head"><div><h1>Publish</h1><p>Put your changes on the website for everyone.</p></div></div>
      <div class="card card--pad card--note">
        <h2>Just checking? You don't need GitHub</h2>
        <p>Everything you change is saved on this device, and the app on this device shows it straight away —
          <a href="../" target="_blank" rel="noopener">open the app</a> to check. Only other people's phones need publishing.</p>
      </div>

      <div class="card card--pad">
        <h2>1 · GitHub connection</h2>
        ${state.token ? `
          <p>Connected to <b>${esc(REPO.owner)}/${esc(REPO.name)}</b>. The key is saved on this device — you don't need to enter it again.</p>
          <div class="modal__acts"><button class="btn btn--ghost btn--sm" type="button" data-act="gh-disconnect">Disconnect</button></div>` : `
          <p>To show your changes to everyone, this browser needs a GitHub key (“fine-grained token”) that can write to the hymn book. You do this once per device.</p>
          <p style="margin-top:10px"><b>Easiest way</b> (sign in to GitHub as ${esc(REPO.owner)}):</p>
          <ol class="steps">
            <li>Open <a href="https://github.com/settings/tokens/new?scopes=public_repo&description=Hymns%20admin" target="_blank" rel="noopener">GitHub → New classic token</a>.</li>
            <li>Check that the <b>public_repo</b> box is ticked (this link ticks it for you). Pick an expiry, e.g. 90 days.</li>
            <li>Press <b>Generate token</b> at the bottom, copy the key (starts with <b>ghp_</b>) and paste it below.</li>
          </ol>
          <details class="more">
            <summary>Or use a fine-grained key</summary>
            <ol class="steps">
              <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → New fine-grained token</a>. Resource owner: <b>${esc(REPO.owner)}</b>.</li>
              <li>Repository access: <b>Only select repositories → ${esc(REPO.name)}</b>.</li>
              <li>Permissions → <b>Contents</b> → change “Read-only” to <b>Read and write</b> (it starts as Read-only).</li>
              <li><b>Generate token</b>, copy the key (starts with <b>github_pat_</b>) and paste it below.</li>
            </ol>
          </details>
          <form id="ghForm" novalidate>
            <label class="field"><span>GitHub key</span><input class="input" name="token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></label>
            <p class="muted" style="margin:10px 0 0;font-size:13px">You enter it only once — it stays saved on this phone or computer.</p>
            <p class="form-error" id="formError" role="alert" hidden></p>
            <div class="modal__acts"><button class="btn btn--primary" type="submit">Connect</button></div>
          </form>`}
      </div>

      <div class="card card--pad">
        <h2>2 · Your changes</h2>
        ${list.length ? `<ul class="changelist">${list.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p>No unpublished changes.</p>`}
        <form id="publishForm" novalidate>
          <label class="field"><span>Note about this update <small>(optional)</small></span>
            <input class="input" name="message" maxlength="120" placeholder="e.g. Added hymns 13–20 in Telugu"></label>
          <p class="form-error" id="formError2" role="alert" hidden></p>
          <div class="modal__acts">
            <a class="btn btn--ghost" href="../?preview=1" target="_blank" rel="noopener" ${list.length ? "" : 'aria-disabled="true" style="pointer-events:none;opacity:.45"'}>Preview in app</a>
            <span class="grow"></span>
            <button class="btn btn--primary" type="submit" ${list.length && state.token ? "" : "disabled"}>${icon("upload")}Publish to website</button>
          </div>
          ${state.token ? "" : `<p class="muted" style="margin:10px 0 0;font-size:13px">Connect GitHub above to publish.</p>`}
        </form>
      </div>

      <div class="card card--pad">
        <h2>Backup</h2>
        <p>Download everything (hymns, title pages, languages, settings) as one file, or restore from a backup.</p>
        <div class="modal__acts">
          <button class="btn btn--ghost" type="button" data-act="backup">Download backup</button>
          <label class="btn btn--ghost">Restore from file<input type="file" accept=".json,application/json" id="restoreFile" hidden></label>
        </div>
      </div>`;
  };

  async function connect(form) {
    const token = form.token.value.trim();
    if (!/^(github_pat_|ghp_|gho_|ghu_|ghs_)[\w]+$/.test(token)) return formError("That doesn't look like a GitHub key. It starts with “ghp_” or “github_pat_”.");
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      const cur = await gh(`/contents/${FILES.book}?ref=${BRANCH}`, {}, token);
      // Check writing without changing anything: GitHub refuses an update with a wrong
      // version id with 409 when the key may write, and 403/404 when it may not.
      // (It sends the file's own content, so even an unexpected success changes nothing.)
      try {
        await gh(`/contents/${FILES.book}`, { method: "PUT", body: JSON.stringify({
          message: "Check admin key", content: cur.content.replace(/\s/g, ""), sha: "0".repeat(40), branch: BRANCH }) }, token);
      } catch (e) {
        if (e.status !== 409 && e.status !== 422) throw e;
      }
    } catch (e) {
      btn.disabled = false;
      return formError(ghError(e));
    }
    state.token = token;
    local.set("token", token);
    toast("Connected to GitHub");
    // Pick up the exact file versions on GitHub, keeping any edits made so far.
    const draft = state.draft, adminsDraft = state.adminsDraft;
    try {
      const [b, a] = await Promise.all([ghGet(FILES.book), ghGet(FILES.admins)]);
      state.sha = { book: b.sha, admins: a.sha };
      state.from = "github";
      const book = parseBook(b.text), admins = JSON.parse(a.text);
      if (!same(book, state.live) || !same(admins, state.adminsLive)) {
        const keepEdits = changed();
        state.live = book;
        state.adminsLive = admins;
        if (!keepEdits) { state.draft = clone(book); state.adminsDraft = clone(admins); }
        else { state.draft = draft; state.adminsDraft = adminsDraft; }
      }
    } catch { /* keep what we have; publishing re-reads the files */ }
    saveDraft();
    render();
  }

  function forgetToken() {
    state.token = null;
    local.del("token");
    session.del("token");
  }

  // Publish everything changed, in one go. Used by the top bar's Publish (one tap)
  // and by the Publish page.
  async function publishNow(note = "") {
    if (state.busy || !changed()) return;
    if (!state.token) {
      setTab("publish");
      toast("Connect GitHub once — after that Publish works in one tap");
      return;
    }
    const message = (note || "Update hymn book") + ` (admin: ${state.user.username})`;
    state.busy = true;
    setPublishing(true);
    try {
      const bookChanged = !same(state.draft, state.live);
      const adminsChanged = !same(state.adminsDraft, state.adminsLive);
      if (bookChanged) {
        const cur = await ghGet(FILES.book);
        if (!same(parseBook(cur.text), state.live) &&
            !window.confirm("Someone else published hymn changes after you started.\n\nOK = publish yours anyway (their changes are replaced)\nCancel = stop")) throw Object.assign(new Error("stopped"), { stopped: true });
        await ghPut(FILES.book, songsJs(state.draft), cur.sha, message);
        // The website takes a minute to update; until then this device keeps showing the new version.
        local.set("published", { at: Date.now(), book: state.draft });
      }
      if (adminsChanged) {
        const cur = await ghGet(FILES.admins);
        await ghPut(FILES.admins, adminsJson(state.adminsDraft), cur.sha, message);
      }
      state.live = clone(state.draft);
      state.adminsLive = clone(state.adminsDraft);
      state.busy = false;
      saveDraft();
      render();
      toast("Published! Everyone gets it in about a minute");
    } catch (e) {
      state.busy = false;
      if (!e.stopped) {
        if (e.status === 401) { forgetToken(); setTab("publish"); }
        const box = $("#formError2");
        if (box && state.tab === "publish") { box.textContent = ghError(e); box.hidden = false; }
        else window.alert(ghError(e));
      }
    } finally {
      state.busy = false;
      setPublishing(false);
    }
  }

  function setPublishing(on) {
    $$("[data-act='publish-now'], #publishForm [type=submit]").forEach((b) => {
      if (on) {
        b.dataset.label = b.innerHTML;
        b.disabled = true;
        b.innerHTML = "Publishing…";
      } else if (b.dataset.label) {     // only buttons this publish changed (the page may have re-drawn)
        b.innerHTML = b.dataset.label;
        delete b.dataset.label;
        b.disabled = false;
      }
    });
  }

  const publish = (form) => publishNow(form.message.value.trim());

  function backup() {
    const data = { app: "Convention Hymns", exported: new Date().toISOString(), book: state.draft };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `convention-hymns-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function restore(file) {
    try {
      const data = JSON.parse(await file.text());
      const book = data.book || data;
      if (!Array.isArray(book.languages) || typeof book.songs !== "object") throw new Error("bad");
      book.covers = book.covers || {};
      book.settings = book.settings || {};
      book.languages.forEach((l) => { if (!book.songs[l.code]) book.songs[l.code] = []; });
      if (!window.confirm("Replace everything here with the backup? (Nothing goes live until you publish.)")) return;
      state.draft = book;
      commit("Backup loaded — check it, then publish");
    } catch {
      toast("That file is not a Convention Hymns backup");
    }
  }

  function discard() {
    if (!changed() || !window.confirm("Throw away all unpublished changes?")) return;
    state.draft = clone(state.live);
    state.adminsDraft = clone(state.adminsLive);
    commit("Changes discarded");
  }

  /* =========================================================
     Events
     ========================================================= */
  function addStanza() {
    const box = $("#stanzas");
    const n = box.children.length;
    const lang = (box.querySelector("textarea") || {}).lang || "";
    box.insertAdjacentHTML("beforeend", stanzaBox("", n, lang, box.dataset.name));
    box.lastElementChild.querySelector("textarea").focus();
  }
  function removeStanza(btn) {
    const box = $("#stanzas");
    const item = btn.closest(".stanza");
    if (box.children.length === 1) { item.querySelector("textarea").value = ""; return; }
    item.remove();
    [...box.children].forEach((c, i) => { c.querySelector(".stanza__n").textContent = i + 1; });
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]");
    if (!t || t.disabled) return;
    const n = t.dataset.n != null ? Number(t.dataset.n) : null;
    const i = t.dataset.i != null ? Number(t.dataset.i) : null;
    switch (t.dataset.act) {
      case "tab": setTab(t.dataset.tab); break;
      case "logout": logout(); break;
      case "discard": discard(); break;
      case "modal-close": closeModal(); break;
      case "pw-toggle": {
        const input = t.parentElement.querySelector("input");
        input.type = input.type === "password" ? "text" : "password";
        t.setAttribute("aria-label", input.type === "password" ? "Show password" : "Hide password");
        break;
      }
      case "hymn-lang": state.hymnLang = t.dataset.code; state.hymnQuery = ""; session.set("hymnLang", state.hymnLang); render(); break;
      case "hymn-new": openHymnEditor(null); break;
      case "hymn-edit": openHymnEditor(n); break;
      case "hymn-del": deleteHymn(n); break;
      case "stanza-add": addStanza(); break;
      case "stanza-del": removeStanza(t); break;
      case "cover-lang": state.coverLang = t.dataset.code; session.set("coverLang", state.coverLang); render(); break;
      case "cover-create": {
        const src = D().covers.en || D().covers.or || { title: "", verse: [""], cite: "", fellowship: "", tag: "", by: "" };
        D().covers[state.coverLang] = clone(src);
        commit("Title page created from the English one — now translate it");
        break;
      }
      case "cover-remove":
        if (window.confirm(`Remove the ${langName(state.coverLang)} title page? The app will show the Odia one instead.`)) {
          delete D().covers[state.coverLang];
          commit("Title page removed");
        }
        break;
      case "lang-new": openLangEditor(null); break;
      case "lang-edit": openLangEditor(i); break;
      case "lang-del": deleteLang(i); break;
      case "lang-up": moveLang(i, -1); break;
      case "lang-down": moveLang(i, 1); break;
      case "user-new": openUserEditor(null); break;
      case "user-edit": openUserEditor(i); break;
      case "user-del": removeUser(i); break;
      case "pw-mine": openMyPassword(); break;
      case "gh-disconnect":
        if (window.confirm("Disconnect GitHub on this device? You can connect again any time.")) { forgetToken(); render(); toast("Disconnected"); }
        break;
      case "backup": backup(); break;
      case "publish-now": publishNow(); break;
    }
  });

  document.addEventListener("submit", (e) => {
    const f = e.target;
    const handlers = {
      loginForm: onLogin,
      hymnForm: () => saveHymn(f),
      coverForm: () => saveCover(f),
      langForm: () => saveLang(f),
      settingsForm: () => saveSettings(f),
      userForm: () => saveUser(f),
      myPwForm: () => saveMyPassword(f),
      ghForm: () => connect(f),
      publishForm: () => publish(f)
    };
    if (!handlers[f.id]) return;
    e.preventDefault();
    if (f.id === "loginForm") onLogin(e);
    else handlers[f.id]();
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "hymnSearch") { state.hymnQuery = e.target.value; renderHymnList(); }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "restoreFile" && e.target.files[0]) { restore(e.target.files[0]); e.target.value = ""; }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#modal").hidden) closeModal();
  });

  /* ---------- start ---------- */
  async function start() {
    try {
      await loadData();
    } catch (e) {
      document.body.innerHTML = `<main class="login"><div class="login__card"><h1 class="login__title">Can't load the hymn book</h1>
        <p class="muted">${esc(e.message || e)}</p><button class="btn btn--primary btn--block" onclick="location.reload()">Try again</button></div></main>`;
      return;
    }
    const name = session.get("user", null);
    const user = name && (findUser(state.adminsLive, name) || findUser(state.adminsDraft, name));
    if (user) enter(user);
    else {
      $("#login").hidden = false;
      $("#loginForm").username.focus();
    }
  }
  start();
})();
