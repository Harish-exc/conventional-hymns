/* =========================================================
   Conventional Hymns — app logic (no frameworks)
   ========================================================= */
(() => {
  "use strict";

  const BOOK = window.HYMN_BOOK;

  const SPLASH_MS = 5000;   // how long the blue title page stays
  const TURN_MS   = 1150;   // paper turn between pages
  const FLIP_MS   = 850;    // paper turn between hymns (prev / next)
  const PUSH_MS   = 420;    // list -> hymn slide
  const FADE_MS   = 260;    // reduced-motion fallback
  const STRIPS    = 12;     // the turning page is drawn as this many bending strips
  const ORDER = ["splash", "cover", "languages", "songs", "song"];

  const root = document.documentElement;
  root.style.setProperty("--push-ms", PUSH_MS + "ms");
  root.style.setProperty("--fade-ms", FADE_MS + "ms");

  /* ---------- helpers ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem("ch:" + key);
        return v === null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("ch:" + key, JSON.stringify(value)); } catch { /* private mode */ }
    }
  };

  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

  // Native digits (Devanagari, Bengali, Odia, Telugu) -> ASCII, so "୧୨" finds hymn 12.
  const DIGIT_BASES = [0x0966, 0x09e6, 0x0b66, 0x0c66];
  const norm = (s) =>
    String(s).normalize("NFC").toLowerCase().replace(/[०-९০-৯୦-୯౦-౯]/g, (ch) => {
      const c = ch.charCodeAt(0);
      for (const b of DIGIT_BASES) if (c >= b && c <= b + 9) return String(c - b);
      return ch;
    });

  function hl(text, q) {
    const t = String(text).normalize("NFC");
    if (!q) return esc(t);
    const at = norm(t).indexOf(q);
    if (at < 0) return esc(t);
    return esc(t.slice(0, at)) + "<mark>" + esc(t.slice(at, at + q.length)) + "</mark>" + esc(t.slice(at + q.length));
  }

  const icon = (id, cls = "") => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;

  function stripIds(node) {
    node.removeAttribute("id");
    node.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    node.setAttribute("aria-hidden", "true");
    node.inert = true;
    return node;
  }

  /* ---------- elements ---------- */
  const book = $("#book");
  const pages = Object.fromEntries(ORDER.map((id) => [id, document.getElementById(id)]));
  const scroller = (name) => pages[name].querySelector(".page__scroll");
  const el = {
    paper: $(".paper"),
    coverNext: $("#coverNext"),
    langGrid: $("#langGrid"),
    songsTitle: $("#songsTitle"),
    songsMeta: $("#songsMeta"),
    search: $("#search"),
    clear: $("#searchClear"),
    keypad: $("#keypadToggle"),
    favCount: $("#favCount"),
    count: $("#resultCount"),
    list: $("#songList"),
    empty: $("#emptyState"),
    emptyIcon: $("#emptyIcon"),
    emptyTitle: $("#emptyTitle"),
    emptyText: $("#emptyText"),
    songNo: $("#songNo"),
    songLang: $("#songLang"),
    lyrics: $("#lyrics"),
    favBtn: $("#favBtn"),
    shareBtn: $("#shareBtn"),
    prev: $("#prevSong"),
    next: $("#nextSong"),
    pos: $("#songPos"),
    fontVal: $("#fontVal"),
    resume: $("#resume"),
    sheet: $("#sheet"),
    sheetPanel: $(".sheet__panel"),
    sheetPron: $("#sheetPron"),
    readRow: $("#readRow"),
    fsRow: $("#fsRow"),
    fsToggle: $("#fsToggle"),
    toast: $("#toast")
  };

  /* ---------- state ---------- */
  const state = {
    page: "splash",
    busy: false,
    queued: null,
    lang: null,
    langObj: null,
    songs: [],
    index: [],
    current: -1,
    filter: "all",
    scale: store.get("scale", 1),
    numeric: store.get("numeric", false),
    pron: store.get("pron", "off"),
    favs: store.get("favs", {}),
    recent: store.get("recent", {}),
    last: store.get("last", null),
    wakeLock: null
  };

  /* ---------- pronunciation ---------- */
  const PRON_TARGETS = [
    { id: "roman", label: "English letters", lang: "en" },
    { id: "te",    label: "తెలుగు",          lang: "te" },
    { id: "or",    label: "ଓଡ଼ିଆ",           lang: "or" },
    { id: "dev",   label: "हिन्दी · मराठी",   lang: "hi" },
    { id: "bn",    label: "বাংলা",           lang: "bn" }
  ];

  // The chosen reading script for a language, or null to show the songs as written.
  function pronTarget(lang = state.lang) {
    const own = Pronounce.scriptOfLang(lang);
    if (!own || state.pron === "off" || state.pron === own) return null;
    return PRON_TARGETS.find((p) => p.id === state.pron) || null;
  }
  const pron = (text, target, lang = state.lang) => Pronounce.transliterate(text, lang, target.id);
  // Text as the reader wants to see it: only the pronunciation when one is chosen.
  const shown = (text, lang = state.lang) => {
    const t = pronTarget(lang);
    return t ? pron(text, t, lang) : String(text);
  };
  const chorusLabel = (t) => (BOOK.languages.find((l) => l.code === (t ? t.lang : state.lang)) || state.langObj).chorus;

  /* =========================================================
     Paper turn — the page bends as it turns
     ========================================================= */
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  // Copies `source` into STRIPS vertical strips chained in 3D, each hinged on the previous one.
  function buildFlipper(source) {
    const W = book.clientWidth;
    const w = W / STRIPS;
    const top = (source.querySelector(".page__scroll") || {}).scrollTop || 0;
    const backBg = getComputedStyle(source).getPropertyValue("--page-back").trim() || "#f3efe4";

    const flip = document.createElement("div");
    flip.className = "flip";
    const strips = [];
    let parent = flip;

    for (let i = 0; i < STRIPS; i++) {
      const seg = document.createElement("div");
      seg.className = "flip__seg";
      seg.style.left = (i ? w : 0) + "px";
      seg.style.width = w + "px";

      // Front: a full-width copy of the page, clipped to this strip (0.5px overlap hides seams).
      const face = document.createElement("div");
      face.className = "flip__face";
      face.style.left = -i * w + "px";
      face.style.width = W + "px";
      face.style.clipPath = `inset(0 ${Math.max(0, W - (i + 1) * w - 0.5)}px 0 ${Math.max(0, i * w - 0.5)}px)`;
      const copy = stripIds(source.cloneNode(true));
      copy.classList.remove("is-under", "is-turning");
      const shadeF = document.createElement("div");
      shadeF.className = "flip__shade";
      shadeF.style.left = i * w + "px";
      shadeF.style.width = w + "px";
      face.append(copy, shadeF);

      // Back: the plain reverse side of the paper.
      const backFace = document.createElement("div");
      backFace.className = "flip__back";
      backFace.style.width = w + 0.6 + "px";
      backFace.style.background = backBg;
      backFace.style.backgroundSize = `${W}px 100%`;
      backFace.style.backgroundPosition = `${-(STRIPS - 1 - i) * w}px 0`;
      const shadeB = document.createElement("div");
      shadeB.className = "flip__shade";
      shadeB.style.left = "0";
      shadeB.style.width = "100%";
      backFace.appendChild(shadeB);

      seg.append(face, backFace);
      parent.appendChild(seg);
      strips.push({ seg, shadeF, shadeB, copy });
      parent = seg;
    }

    book.appendChild(flip);
    strips.forEach((s) => {
      const sc = s.copy.querySelector(".page__scroll");
      if (sc) sc.scrollTop = top;
    });
    return { flip, strips };
  }

  // Turns `source` away over `under` (or back onto it when reverse). The copy is made
  // straight away, so the caller may hide or change `source` right after calling.
  function paperTurn(source, under, reverse, ms) {
    const { flip, strips } = buildFlipper(source);
    const shadow = document.createElement("div");
    shadow.className = "flip-shadow";
    under.appendChild(shadow);

    // Bend grows toward the free edge, so the edge leads and the paper curls.
    const weights = strips.map((_, i) => (i === 0 ? 0 : Math.pow(i / (STRIPS - 1), 2)));
    const total = weights.reduce((a, b) => a + b, 0);
    const shadeFront = (deg) => 0.6 * (1 - Math.max(Math.cos((deg * Math.PI) / 180), 0));
    const shadeBack = (deg) => 0.45 * (1 - Math.max(-Math.cos((deg * Math.PI) / 180), 0));
    const rgba = (o) => `rgba(8,12,28,${o.toFixed(3)})`;

    return new Promise((resolve) => {
      const t0 = performance.now();
      const frame = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        const q = reverse ? 1 - p : p;
        const hinge = -180 * easeInOut(q);
        const bend = -100 * Math.sin(Math.PI * Math.pow(q, 0.7));

        // Angle of each strip in space, then shade by how far it faces away from the light.
        const abs = [];
        let a = 0;
        strips.forEach((s, i) => {
          const local = i === 0 ? hinge : (bend * weights[i]) / total;
          a += local;
          abs.push(a);
          s.seg.style.transform = `rotateY(${local.toFixed(3)}deg)`;
        });
        let reach = 0;
        strips.forEach((s, i) => {
          const l = (abs[Math.max(0, i - 1)] + abs[i]) / 2;
          const r = (abs[i] + abs[Math.min(STRIPS - 1, i + 1)]) / 2;
          s.shadeF.style.background = `linear-gradient(90deg,${rgba(shadeFront(l))},${rgba(shadeFront(r))})`;
          s.shadeB.style.background = `linear-gradient(270deg,${rgba(shadeBack(l))},${rgba(shadeBack(r))})`;
          reach += Math.max(0, Math.cos((abs[i] * Math.PI) / 180)) / STRIPS;
        });
        shadow.style.setProperty("--x", (reach * 100).toFixed(1));
        shadow.style.opacity = (Math.sin(Math.PI * q) * 0.95).toFixed(3);

        if (p < 1) requestAnimationFrame(frame);
        else {
          flip.remove();
          shadow.remove();
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }

  /* =========================================================
     Page transitions
     ========================================================= */
  const ANIM = {
    push: { ms: PUSH_MS, enter: PUSH_MS * 0.4, fwd: [["push-out"], ["push-in"]], back: [["pop-out"], ["pop-in"]] },
    fade: { ms: FADE_MS, enter: 0,             fwd: [["fade-out"], ["fade-in"]], back: [["fade-out"], ["fade-in"]] }
  };

  function transition(name, anim, back) {
    const from = pages[state.page];
    const to = pages[name];
    if (from === to) return Promise.resolve();
    if (reduceMotion.matches) anim = "fade";

    state.busy = true;
    to.inert = false;
    to.style.setProperty("--enter-delay", (back ? 0 : anim === "turn" ? TURN_MS * 0.5 : ANIM[anim].enter) + "ms");
    if (!back) {               // replay entrance animations on forward navigation
      to.classList.remove("is-entering");
      void to.offsetWidth;
      to.classList.add("is-entering");
    }
    if (name === "cover") fitCover();
    if (name === "languages") renderResume();

    if (anim === "turn") {
      // Forward: the current page turns away. Back: the previous page turns back over it.
      const source = back ? to : from;
      const under = back ? from : to;
      under.classList.add("is-under");
      const done = paperTurn(source, under, back, TURN_MS);
      source.classList.add("is-turning");
      return done.then(() => {
        source.classList.remove("is-turning");
        under.classList.remove("is-under");
        settle(from, to, name);
      });
    }

    const spec = ANIM[anim];
    const [fromCls, toCls] = back ? spec.back : spec.fwd;
    from.classList.add(...fromCls);
    to.classList.add(...toCls);
    return wait(spec.ms + 30).then(() => {
      from.classList.remove(...fromCls);
      to.classList.remove(...toCls);
      settle(from, to, name);
    });
  }

  function settle(from, to, name) {
    from.classList.remove("is-active");
    from.inert = true;
    to.classList.add("is-active");
    state.page = name;
    state.busy = false;
    keepAwake(name === "song");

    const target = to.querySelector("[data-focus]");
    if (target) target.focus({ preventScroll: true });

    if (state.queued) {
      const q = state.queued;
      state.queued = null;
      applyRoute(q);
    }
  }

  /* =========================================================
     Routing (works with the phone's back button)
     ========================================================= */
  const depth = () => (history.state && history.state.depth) || 0;
  const animFor = (a, b) => ((a === "songs" && b === "song") || (a === "song" && b === "songs") ? "push" : "turn");

  function show(route, back, anim) {
    if (route.lang && route.lang !== state.lang) setLanguage(route.lang);
    if (route.page === "song") renderSong(route.index);
    return transition(route.page, anim || animFor(state.page, route.page), back);
  }

  function go(route, anim) {
    if (state.busy) return;
    history.pushState({ ...route, depth: depth() + 1 }, "");
    show(route, false, anim);
  }

  function goBack(fallback) {
    if (state.busy) return;
    if (depth() > 0) {
      history.back();
    } else {
      history.replaceState({ ...fallback, depth: 0 }, "");
      show(fallback, true);
    }
  }

  function applyRoute(route) {
    if (route.page === state.page) {
      if (route.page === "song" && route.index !== state.current) renderSong(route.index);
      return;
    }
    show(route, ORDER.indexOf(route.page) < ORDER.indexOf(state.page));
  }

  window.addEventListener("popstate", (e) => {
    closeSheet();
    const route = e.state || { page: "cover" };
    if (route.page === "splash" || state.page === "splash") return;
    if (state.busy) { state.queued = route; return; }
    applyRoute(route);
  });

  const parentOf = {
    languages: () => ({ page: "cover" }),
    songs: () => ({ page: "languages" }),
    song: () => ({ page: "songs", lang: state.lang })
  };
  const back = () => parentOf[state.page] && goBack(parentOf[state.page]());

  // A shared link looks like  …/conventional-hymns/#/te/12
  function linkedSong() {
    const m = location.hash.match(/^#\/([a-z]{2})\/(\d+)$/);
    if (!m) return null;
    const number = Number(m[2]);
    return (BOOK.songs[m[1]] || []).some((s) => s.number === number) ? { lang: m[1], number } : null;
  }

  /* =========================================================
     Title page — always fits one screen
     ========================================================= */
  function fitCover() {
    const paper = el.paper;
    let lo = 0.5, hi = 1.45;
    for (let k = 0; k < 10; k++) {
      const mid = (lo + hi) / 2;
      paper.style.setProperty("--k", mid.toFixed(3));
      if (paper.scrollHeight <= paper.clientHeight + 1) lo = mid;
      else hi = mid;
    }
    paper.style.setProperty("--k", lo.toFixed(3));
  }

  /* =========================================================
     Languages
     ========================================================= */
  function renderLanguages() {
    el.langGrid.innerHTML = BOOK.languages.map((l, i) => {
      const n = (BOOK.songs[l.code] || []).length;
      return `
        <button class="lang-card" type="button" data-lang="${esc(l.code)}" style="--i:${i + 1}">
          <span class="lang-card__glyph" lang="${esc(l.code)}" aria-hidden="true">${esc(l.glyph)}</span>
          <span class="lang-card__body">
            <span class="lang-card__native" lang="${esc(l.code)}">${esc(l.native)}</span>
            <span class="lang-card__en">${esc(l.name)}</span>
          </span>
          <span class="lang-card__count">${n} ${n === 1 ? "hymn" : "hymns"}</span>
          <span class="lang-card__badge">Recent</span>
          <svg class="ic lang-card__arrow" aria-hidden="true"><use href="#i-chevron"/></svg>
        </button>`;
    }).join("");
    markRecent();
  }

  function markRecent() {
    const last = store.get("lang", null);
    el.langGrid.querySelectorAll(".lang-card").forEach((c) => c.classList.toggle("is-last", c.dataset.lang === last));
  }

  function setLanguage(code) {
    const lang = BOOK.languages.find((l) => l.code === code) || BOOK.languages[0];
    state.lang = lang.code;
    state.langObj = lang;
    state.songs = (BOOK.songs[lang.code] || []).slice().sort((a, b) => a.number - b.number);
    const indic = !!Pronounce.scriptOfLang(lang.code);
    state.index = state.songs.map((s) => {
      const lines = [...(s.verses || []), s.chorus || ""].join("\n").split("\n").map((t) => t.trim()).filter(Boolean);
      const ix = { num: String(s.number), title: norm(s.title), lines, linesN: lines.map(norm) };
      if (indic) {   // English-letter copies so "yesu" finds యేసు
        ix.rTitle = Pronounce.transliterate(s.title, lang.code, "roman");
        ix.rLines = lines.map((l) => Pronounce.transliterate(l, lang.code, "roman"));
        ix.rTitleKey = Pronounce.looseKey(ix.rTitle);
        ix.rLineKeys = ix.rLines.map(Pronounce.looseKey);
      }
      return ix;
    });

    el.songsTitle.textContent = lang.native;
    el.songsTitle.lang = lang.code;
    el.list.lang = lang.code;
    el.songsMeta.textContent = `${lang.name} · ${state.songs.length} hymns`;
    el.search.value = "";
    store.set("lang", lang.code);
    markRecent();
    setFilter("all");
    scroller("songs").scrollTop = 0;
  }

  /* =========================================================
     Favorites
     ========================================================= */
  const favList = () => state.favs[state.lang] || [];
  const isFav = (number) => favList().includes(number);

  function toggleFav() {
    const s = state.songs[state.current];
    if (!s) return;
    const adding = !isFav(s.number);
    const list = favList().filter((n) => n !== s.number);
    if (adding) list.push(s.number);
    state.favs[state.lang] = list;
    store.set("favs", state.favs);
    updateFavUi();
    renderList();
    if (adding) {
      el.favBtn.classList.remove("pop");
      void el.favBtn.offsetWidth;
      el.favBtn.classList.add("pop");
    }
    toast(adding ? "Added to favorites" : "Removed from favorites");
  }

  function updateFavUi() {
    const s = state.songs[state.current];
    const on = !!s && isFav(s.number);
    el.favBtn.classList.toggle("is-fav", on);
    el.favBtn.setAttribute("aria-pressed", String(on));
    el.favBtn.setAttribute("aria-label", on ? "Remove from favorites" : "Add to favorites");
    el.favCount.textContent = favList().length;
  }

  function setFilter(f) {
    state.filter = f;
    pages.songs.querySelectorAll("[data-filter]").forEach((b) => {
      const on = b.dataset.filter === f;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    pages.songs.style.setProperty("--enter-delay", "0ms");
    updateFavUi();
    renderList();
  }

  /* =========================================================
     Song list + search
     ========================================================= */
  const firstLine = (s) => ((s.verses && s.verses[0]) || s.chorus || "").split("\n")[0];
  let lastRows = [];

  function search(q) {
    if (!q) return state.songs.map((_, i) => ({ i, line: null, roman: false }));
    const isNum = /^\d+$/.test(q);
    const qk = /^[a-z][a-z\s'.-]*$/.test(q) ? Pronounce.looseKey(q) : "";
    const rows = [];
    state.index.forEach((ix, i) => {
      let score = -1;
      let line = null;
      let roman = false;
      if (isNum && ix.num === q) score = 100;
      else if (isNum && ix.num.startsWith(q)) score = 90;
      const t = ix.title.indexOf(q);
      if (t === 0) score = Math.max(score, 70);
      else if (t > 0) score = Math.max(score, 60);
      if (score < 0) {
        const li = ix.linesN.findIndex((l) => l.includes(q));
        if (li >= 0) { score = 30; line = ix.lines[li]; }
      }
      if (score < 0 && qk && ix.rTitle) {
        if (ix.rTitleKey.includes(qk)) { score = 40; line = ix.rTitle; roman = true; }
        else {
          const li = ix.rLineKeys.findIndex((l) => l.includes(qk));
          if (li >= 0) { score = 20; line = ix.rLines[li]; roman = true; }
        }
      }
      if (score >= 0) rows.push({ i, score, line, roman });
    });
    return rows.sort((a, b) => b.score - a.score || state.songs[a.i].number - state.songs[b.i].number);
  }

  function renderList() {
    const raw = el.search.value.trim();
    const q = norm(raw);
    let rows = search(q);
    if (state.filter === "fav") rows = rows.filter((r) => isFav(state.songs[r.i].number));
    if (state.filter === "recent") {
      const order = recentList();
      rows = rows.filter((r) => order.includes(state.songs[r.i].number));
      if (!raw) rows.sort((a, b) => order.indexOf(state.songs[a.i].number) - order.indexOf(state.songs[b.i].number));
    }
    lastRows = rows;

    el.clear.hidden = !raw;
    const t = pronTarget();
    el.list.lang = t ? t.lang : state.lang;
    el.list.innerHTML = rows.map((r, k) => {
      const s = state.songs[r.i];
      // Preview: the line that matched the search (in the reading script), else the first line.
      let preview = shown(firstLine(s));
      if (r.line && !r.roman) preview = shown(r.line);
      else if (r.line && (!t || t.id === "roman")) preview = r.line;
      return `
        <li>
          <button class="song-item" type="button" data-i="${r.i}" style="--i:${Math.min(k, 12)}">
            <span class="song-item__num">${hl(s.number, q)}</span>
            <span class="song-item__text">
              <span class="song-item__title">${hl(shown(s.title), q)}</span>
              <span class="song-item__preview">${hl(preview, q)}</span>
            </span>
            ${isFav(s.number) ? icon("heart", "song-item__fav") : ""}
            ${icon("chevron")}
          </button>
        </li>`;
    }).join("");

    const EMPTY = {
      fav: ["heart", "No favorites yet", "Open a hymn and tap the heart to keep it here."],
      recent: ["clock", "Nothing here yet", "Hymns you open will show up here."],
      all: ["search", "No hymns found", "Try another song number or a word from the title."]
    };
    const [emptyIcon, emptyTitle, emptyText] = raw ? EMPTY.all : EMPTY[state.filter];
    el.empty.hidden = rows.length > 0;
    el.emptyIcon.setAttribute("href", "#i-" + emptyIcon);
    el.emptyTitle.textContent = emptyTitle;
    el.emptyText.textContent = emptyText;
    const NAMES = { all: "All hymns", fav: "Favorites", recent: "Recently opened" };
    el.count.textContent = raw
      ? `${rows.length} ${rows.length === 1 ? "result" : "results"} for “${raw}”`
      : `${NAMES[state.filter]} · ${rows.length}`;
  }

  let searchTimer = 0;
  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      pages.songs.style.setProperty("--enter-delay", "0ms");
      renderList();
      scroller("songs").scrollTop = 0;
    }, 70);
  }

  function applyKeypad() {
    el.search.inputMode = state.numeric ? "numeric" : "search";
    el.keypad.textContent = state.numeric ? "ABC" : "123";
    el.keypad.setAttribute("aria-pressed", String(state.numeric));
    el.keypad.setAttribute("aria-label", state.numeric ? "Use letter keyboard" : "Use number keypad");
  }

  /* =========================================================
     Song view
     ========================================================= */
  function renderSong(i, keepScroll) {
    const s = state.songs[i];
    if (!s) return;
    const lang = state.langObj;
    const own = Pronounce.scriptOfLang(lang.code);
    const t = pronTarget();
    state.current = i;
    rememberOpened(s);

    el.songNo.textContent = `Hymn ${s.number}`;
    el.songLang.textContent = `${lang.native} · ${lang.name}`;

    // When a reading script is chosen, only that version is shown — no original lines.
    const text = (v) => esc(t ? pron(v, t) : v);

    let body = "";
    (s.verses || []).forEach((v, k) => {
      body += `<div class="stanza"><span class="stanza__n">${k + 1}</span><p class="stanza__text">${text(v)}</p></div>`;
      if (k === 0 && s.chorus) body += chorusHtml(text(s.chorus), chorusLabel(t));
    });
    if (!(s.verses || []).length && s.chorus) body += chorusHtml(text(s.chorus), chorusLabel(t));

    // Reading choices shown right on the hymn — one tap, no menu.
    const readPill = !own ? "" : `
      <div class="read-in" role="group" aria-label="Read in">
        <span class="read-in__label" lang="en">Read in</span>
        <div class="pron__chips">${pronChips(own, t)}</div>
      </div>`;

    el.lyrics.lang = t ? t.lang : lang.code;
    el.lyrics.innerHTML = `
      <header class="lyrics__head">
        <p class="hymn-no" lang="en"><span>Hymn</span><strong>${esc(s.number)}</strong></p>
        <h1 class="lyrics__title" tabindex="-1" data-focus>${text(s.title)}</h1>
        ${s.author ? `<p class="lyrics__author" lang="en">${esc(s.author)}</p>` : ""}
        <div class="ornament" aria-hidden="true"><span></span><i>✦</i><span></span></div>
        ${readPill}
      </header>
      ${body}`;

    el.prev.disabled = i <= 0;
    el.next.disabled = i >= state.songs.length - 1;
    el.pos.textContent = `${i + 1} / ${state.songs.length}`;
    updateFavUi();
    if (!keepScroll) scroller("song").scrollTop = 0;
  }

  // Original + every other script, the current choice highlighted.
  const pronChips = (own, t) =>
    [{ id: "off", label: "Original", lang: "en" }, ...PRON_TARGETS.filter((p) => p.id !== own)].map((p) => {
      const on = (t ? t.id : "off") === p.id;
      return `<button class="chip${on ? " is-on" : ""}" type="button" data-pron="${p.id}" lang="${p.lang}" aria-pressed="${on}">${esc(p.label)}</button>`;
    }).join("");

  const chorusHtml = (html, label) =>
    `<div class="chorus"><span class="chorus__label">${esc(label)}</span><p class="chorus__text">${html}</p></div>`;

  function setPron(id) {
    state.pron = id;
    store.set("pron", id);
    if (state.current >= 0 && state.lang) {
      renderSong(state.current, true);
      el.lyrics.classList.remove("is-swapping");
      void el.lyrics.offsetWidth;
      el.lyrics.classList.add("is-swapping");
    }
    pages.songs.style.setProperty("--enter-delay", "0ms");
    if (state.lang) renderList();
    renderSheet();
    renderResume();
  }

  /* =========================================================
     Recent hymns & continue reading
     ========================================================= */
  const recentList = () => state.recent[state.lang] || [];

  function rememberOpened(s) {
    state.recent[state.lang] = [s.number, ...recentList().filter((n) => n !== s.number)].slice(0, 15);
    state.last = { lang: state.lang, number: s.number };
    store.set("recent", state.recent);
    store.set("last", state.last);
  }

  function renderResume() {
    const last = state.last;
    const song = last && (BOOK.songs[last.lang] || []).find((s) => s.number === last.number);
    const lang = last && BOOK.languages.find((l) => l.code === last.lang);
    if (!song || !lang) { el.resume.innerHTML = ""; return; }
    const t = pronTarget(lang.code);
    el.resume.innerHTML = `
      <button class="resume" type="button" data-resume>
        <span class="resume__icon">${icon("book")}</span>
        <span class="resume__text">
          <span class="resume__label">Continue singing</span>
          <span class="resume__title" lang="${t ? t.lang : lang.code}">${esc(shown(song.title, lang.code))}</span>
          <span class="resume__meta">Hymn ${song.number} · ${esc(lang.native)} · ${esc(lang.name)}</span>
        </span>
        ${icon("chevron")}
      </button>`;
  }

  function resumeReading() {
    const last = state.last;
    if (!last || state.busy) return;
    if (last.lang !== state.lang) setLanguage(last.lang);
    const index = state.songs.findIndex((s) => s.number === last.number);
    if (index < 0) return;
    history.pushState({ page: "songs", lang: last.lang, depth: depth() + 1 }, "");
    go({ page: "song", lang: last.lang, index }, "turn");
  }

  /* =========================================================
     Reading options sheet
     ========================================================= */
  let sheetReturn = null;

  function renderSheet() {
    const own = Pronounce.scriptOfLang(state.lang);
    el.readRow.hidden = !own;
    if (own) el.sheetPron.innerHTML = pronChips(own, pronTarget());
    el.fontVal.textContent = Math.round(state.scale * 100) + "%";
    el.fsRow.hidden = !document.fullscreenEnabled;
    el.fsToggle.setAttribute("aria-checked", String(!!document.fullscreenElement));
  }

  function openSheet() {
    renderSheet();
    sheetReturn = document.activeElement;
    el.sheet.classList.add("is-open");
    el.sheet.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => el.sheetPanel.focus({ preventScroll: true }));
  }

  function closeSheet() {
    if (!el.sheet.classList.contains("is-open")) return;
    el.sheet.classList.remove("is-open");
    el.sheet.setAttribute("aria-hidden", "true");
    if (sheetReturn && sheetReturn.focus) sheetReturn.focus({ preventScroll: true });
  }

  function toggleFullscreen() {
    const req = document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen();
    if (req && req.catch) req.catch(() => toast("Full screen isn't available here"));
  }

  // Prev / next hymn: the page bends over like a real book page.
  function changeSong(delta) {
    const i = state.current + delta;
    if (state.busy || state.page !== "song" || i < 0 || i >= state.songs.length) return;
    history.replaceState({ ...history.state, index: i }, "");

    if (reduceMotion.matches) { renderSong(i); return; }

    state.busy = true;
    const real = pages.song;
    let done;
    if (delta > 0) {
      done = paperTurn(real, real, false, FLIP_MS);   // a copy of this hymn turns away over the next one
      renderSong(i);
    } else {
      const old = stripIds(real.cloneNode(true));       // keep this hymn underneath…
      old.classList.remove("is-active");
      old.classList.add("is-under");
      book.appendChild(old);
      old.querySelector(".page__scroll").scrollTop = scroller("song").scrollTop;
      renderSong(i);
      done = paperTurn(real, old, true, FLIP_MS);       // …while the previous hymn turns back over it
      real.classList.add("is-turning");
      done = done.then(() => {
        old.remove();
        real.classList.remove("is-turning");
      });
    }
    done.then(() => { state.busy = false; });
  }

  function applyScale() {
    pages.song.style.setProperty("--scale", state.scale);
    document.querySelectorAll("[data-font]").forEach((b) => {
      b.disabled = Number(b.dataset.font) < 0 ? state.scale <= 0.8 : state.scale >= 1.6;
    });
    el.fontVal.textContent = Math.round(state.scale * 100) + "%";
  }
  function setScale(d) {
    state.scale = Math.round(Math.min(1.6, Math.max(0.8, state.scale + d)) * 10) / 10;
    store.set("scale", state.scale);
    applyScale();
  }

  async function shareSong() {
    const s = state.songs[state.current];
    if (!s) return;
    const url = `${location.origin}${location.pathname}#/${state.lang}/${s.number}`;
    const title = `${s.title} — Hymn ${s.number}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} (${state.langObj.name})`, url });
        return;
      }
      await navigator.clipboard.writeText(`${title}\n${url}`);
      toast("Link copied");
    } catch (e) {
      if (!e || e.name !== "AbortError") toast("Couldn't share this hymn");
    }
  }

  // Keep the screen on while a hymn is open, so it doesn't dim mid-song.
  async function keepAwake(on) {
    try {
      if (on && !state.wakeLock && "wakeLock" in navigator && document.visibilityState === "visible") {
        state.wakeLock = await navigator.wakeLock.request("screen");
        state.wakeLock.addEventListener("release", () => { state.wakeLock = null; });
      } else if (!on && state.wakeLock) {
        await state.wakeLock.release();
        state.wakeLock = null;
      }
    } catch { state.wakeLock = null; }
  }

  /* ---------- toast ---------- */
  let toastTimer = 0;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("is-on"), 1900);
  }

  /* =========================================================
     Gestures & events
     ========================================================= */
  function onSwipe(node, cb) {
    let x0 = null, y0 = 0, t0 = 0;
    node.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
    }, { passive: true });
    node.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if (Date.now() - t0 < 700 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) cb(dx < 0 ? "left" : "right");
    }, { passive: true });
  }

  function bind() {
    // Cover
    el.coverNext.addEventListener("click", () => go({ page: "languages" }, "turn"));
    onSwipe(pages.cover, (dir) => dir === "left" && go({ page: "languages" }, "turn"));

    // Back buttons
    document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", back));

    // Languages
    el.langGrid.addEventListener("click", (e) => {
      const card = e.target.closest("[data-lang]");
      if (card) go({ page: "songs", lang: card.dataset.lang }, "turn");
    });

    // Search & filters
    el.search.addEventListener("input", onSearchInput);
    el.search.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && lastRows.length) {
        e.preventDefault();
        el.search.blur();
        go({ page: "song", lang: state.lang, index: lastRows[0].i }, "push");
      }
    });
    el.clear.addEventListener("click", () => {
      el.search.value = "";
      onSearchInput();
      el.search.focus();
    });
    el.keypad.addEventListener("click", () => {
      state.numeric = !state.numeric;
      store.set("numeric", state.numeric);
      applyKeypad();
      el.search.blur();                         // re-focus so the phone swaps keyboards
      requestAnimationFrame(() => el.search.focus());
    });
    pages.songs.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => setFilter(b.dataset.filter)));

    // Song list
    el.list.addEventListener("click", (e) => {
      const item = e.target.closest("[data-i]");
      if (item) go({ page: "song", lang: state.lang, index: Number(item.dataset.i) }, "push");
    });

    // Continue singing
    el.resume.addEventListener("click", (e) => { if (e.target.closest("[data-resume]")) resumeReading(); });

    // Reading options
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-sheet]")) openSheet();
      else if (e.target.closest("[data-close]")) closeSheet();
    });
    el.sheetPron.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-pron]");
      if (chip) setPron(chip.dataset.pron);
    });
    el.fsToggle.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", () =>
      el.fsToggle.setAttribute("aria-checked", String(!!document.fullscreenElement)));

    // Song view
    el.lyrics.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-pron]");
      if (chip) setPron(chip.dataset.pron);
    });
    el.favBtn.addEventListener("click", toggleFav);
    el.shareBtn.addEventListener("click", shareSong);
    el.prev.addEventListener("click", () => changeSong(-1));
    el.next.addEventListener("click", () => changeSong(1));
    document.querySelectorAll("[data-font]").forEach((b) =>
      b.addEventListener("click", () => setScale(Number(b.dataset.font) * 0.1)));
    onSwipe(scroller("song"), (dir) => changeSong(dir === "left" ? 1 : -1));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") keepAwake(state.page === "song");
    });

    // Sticky header shadow
    ORDER.forEach((name) => {
      const sc = scroller(name);
      const bar = sc && sc.querySelector(".topbar");
      if (!bar) return;
      sc.addEventListener("scroll", () => bar.classList.toggle("is-scrolled", sc.scrollTop > 4), { passive: true });
    });

    // Keyboard (laptop)
    document.addEventListener("keydown", (e) => {
      if (el.sheet.classList.contains("is-open")) {
        if (e.key === "Escape") closeSheet();
        return;
      }
      if (e.target === el.search) {
        if (e.key === "Escape") { el.search.value ? el.clear.click() : el.search.blur(); }
        return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (state.page === "cover" && e.key === "ArrowRight") go({ page: "languages" }, "turn");
      else if (state.page === "songs" && e.key === "/") { e.preventDefault(); el.search.focus(); }
      else if (state.page === "song" && e.key === "ArrowRight") changeSong(1);
      else if (state.page === "song" && e.key === "ArrowLeft") changeSong(-1);
      else if (state.page === "song" && e.key.toLowerCase() === "f") toggleFav();
      else if (e.key === "Escape") back();
    });

    // Keep the 3D depth natural on any screen width, and keep the title page fitted.
    let resizeFrame = 0;
    const onResize = () => {
      book.style.perspective = Math.max(1200, window.innerWidth * 1.8) + "px";
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(fitCover);
    };
    window.addEventListener("resize", onResize);
    onResize();
  }

  /* =========================================================
     Start
     ========================================================= */
  // Wrap each letter of the splash title so it can animate in one by one.
  function splitTitle() {
    const title = $(".splash__title");
    title.setAttribute("aria-label", title.textContent.trim());
    let d = 0;
    title.querySelectorAll("span").forEach((word) => {
      word.setAttribute("aria-hidden", "true");
      word.innerHTML = [...word.textContent].map((ch) => `<b class="ch" style="--d:${d++}">${esc(ch)}</b>`).join("");
    });
  }

  function leaveSplashTo(link) {
    history.replaceState({ page: "cover", depth: 0 }, "", location.pathname + location.search);
    if (!link) { show({ page: "cover" }, false, "turn"); return; }
    // Opened from a shared hymn link: go straight to that hymn (back still walks the book).
    setLanguage(link.lang);
    const index = state.songs.findIndex((s) => s.number === link.number);
    history.pushState({ page: "languages", depth: 1 }, "");
    history.pushState({ page: "songs", lang: link.lang, depth: 2 }, "");
    history.pushState({ page: "song", lang: link.lang, index, depth: 3 }, "");
    show({ page: "song", lang: link.lang, index }, false, "turn");
  }

  function init() {
    splitTitle();
    ORDER.forEach((name) => { if (name !== "splash") pages[name].inert = true; });
    renderLanguages();
    renderResume();
    applyScale();
    applyKeypad();
    bind();

    history.replaceState({ page: "splash", depth: 0 }, "");
    const link = linkedSong();

    // SPLASH_MS counts from page open, including the short wait for fonts.
    // Tapping the splash once it is shown skips the rest of the wait.
    let left = false;
    const leaveSplash = () => {
      if (left || state.page !== "splash") return;
      left = true;
      leaveSplashTo(link);
    };
    const fonts = document.fonts ? Promise.race([document.fonts.ready, wait(600)]) : Promise.resolve();
    fonts.then(() => {
      fitCover();
      const remaining = Math.max(0, SPLASH_MS - performance.now());
      pages.splash.style.setProperty("--splash-left", remaining + "ms");
      pages.splash.classList.add("is-ready");
      pages.splash.addEventListener("click", leaveSplash);
      setTimeout(leaveSplash, remaining);
    });
    if (document.fonts) document.fonts.ready.then(fitCover);

    // Works offline and can be installed on the phone's home screen.
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
    }
  }

  init();
})();
