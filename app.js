/* =========================================================
   Conventional Hymns — app logic (no frameworks)
   ========================================================= */
(() => {
  "use strict";

  const BOOK = window.HYMN_BOOK;

  const SPLASH_MS = 2000;   // how long the blue title page stays
  const TURN_MS   = 1100;   // paper turn between pages
  const FLIP_MS   = 800;    // paper turn between hymns (prev / next)
  const PUSH_MS   = 420;    // list -> hymn slide
  const FADE_MS   = 260;    // reduced-motion fallback
  const ORDER = ["splash", "cover", "languages", "songs", "song"];

  const root = document.documentElement;
  root.style.setProperty("--turn-ms", TURN_MS + "ms");
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

  const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#i-${id}"/></svg>`;

  /* ---------- elements ---------- */
  const book = $("#book");
  const pages = Object.fromEntries(ORDER.map((id) => [id, document.getElementById(id)]));
  const scroller = (name) => pages[name].querySelector(".page__scroll");
  const el = {
    coverNext: $("#coverNext"),
    langGrid: $("#langGrid"),
    songsTitle: $("#songsTitle"),
    songsMeta: $("#songsMeta"),
    search: $("#search"),
    clear: $("#searchClear"),
    keypad: $("#keypadToggle"),
    count: $("#resultCount"),
    list: $("#songList"),
    empty: $("#emptyState"),
    songNo: $("#songNo"),
    songLang: $("#songLang"),
    lyrics: $("#lyrics"),
    prev: $("#prevSong"),
    next: $("#nextSong"),
    pos: $("#songPos"),
    fontDown: $("#fontDown"),
    fontUp: $("#fontUp")
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
    scale: store.get("scale", 1),
    numeric: store.get("numeric", false)
  };

  /* =========================================================
     Page transitions
     ========================================================= */
  const ANIM = {
    turn: { ms: TURN_MS, enter: TURN_MS * 0.45, fwd: [["turn-out"], ["turn-under"]], back: [["turn-under", "is-back"], ["turn-in"]] },
    push: { ms: PUSH_MS, enter: PUSH_MS * 0.4,  fwd: [["push-out"], ["push-in"]],    back: [["pop-out"], ["pop-in"]] },
    fade: { ms: FADE_MS, enter: 0,              fwd: [["fade-out"], ["fade-in"]],    back: [["fade-out"], ["fade-in"]] }
  };

  function transition(name, anim, back) {
    const from = pages[state.page];
    const to = pages[name];
    if (from === to) return Promise.resolve();
    if (reduceMotion.matches) anim = "fade";

    const spec = ANIM[anim];
    const [fromCls, toCls] = back ? spec.back : spec.fwd;
    state.busy = true;

    to.inert = false;
    to.style.setProperty("--enter-delay", (back ? 0 : spec.enter) + "ms");
    if (!back) {               // replay entrance animations on forward navigation
      to.classList.remove("is-entering");
      void to.offsetWidth;
      to.classList.add("is-entering");
    }
    from.classList.add(...fromCls);
    to.classList.add(...toCls);

    return wait(spec.ms + 30).then(() => {
      from.classList.remove("is-active", ...fromCls);
      from.inert = true;
      to.classList.remove(...toCls);
      to.classList.add("is-active");
      state.page = name;
      state.busy = false;

      const target = to.querySelector("[data-focus]");
      if (target) target.focus({ preventScroll: true });

      if (state.queued) {
        const q = state.queued;
        state.queued = null;
        applyRoute(q);
      }
    });
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
    state.index = state.songs.map((s) => {
      const lines = [...(s.verses || []), s.chorus || ""].join("\n").split("\n").map((t) => t.trim()).filter(Boolean);
      return { num: String(s.number), title: norm(s.title), lines, linesN: lines.map(norm) };
    });

    el.songsTitle.textContent = lang.native;
    el.songsTitle.lang = lang.code;
    el.list.lang = lang.code;
    el.songsMeta.textContent = `${lang.name} · ${state.songs.length} hymns`;
    el.search.value = "";
    store.set("lang", lang.code);
    markRecent();
    renderList();
    scroller("songs").scrollTop = 0;
  }

  /* =========================================================
     Song list + search
     ========================================================= */
  const firstLine = (s) => ((s.verses && s.verses[0]) || s.chorus || "").split("\n")[0];
  let lastRows = [];

  function search(q) {
    if (!q) return state.songs.map((_, i) => ({ i, line: null }));
    const isNum = /^\d+$/.test(q);
    const rows = [];
    state.index.forEach((ix, i) => {
      let score = -1;
      let line = null;
      if (isNum && ix.num === q) score = 100;
      else if (isNum && ix.num.startsWith(q)) score = 90;
      const t = ix.title.indexOf(q);
      if (t === 0) score = Math.max(score, 70);
      else if (t > 0) score = Math.max(score, 60);
      if (score < 0) {
        const li = ix.linesN.findIndex((l) => l.includes(q));
        if (li >= 0) { score = 30; line = ix.lines[li]; }
      }
      if (score >= 0) rows.push({ i, score, line });
    });
    return rows.sort((a, b) => b.score - a.score || state.songs[a.i].number - state.songs[b.i].number);
  }

  function renderList() {
    const raw = el.search.value.trim();
    const q = norm(raw);
    const rows = search(q);
    lastRows = rows;

    el.clear.hidden = !raw;
    el.list.innerHTML = rows.map((r, k) => {
      const s = state.songs[r.i];
      return `
        <li>
          <button class="song-item" type="button" data-i="${r.i}" style="--i:${Math.min(k, 12)}">
            <span class="song-item__num">${hl(s.number, q)}</span>
            <span class="song-item__text">
              <span class="song-item__title">${hl(s.title, q)}</span>
              <span class="song-item__preview">${hl(r.line || firstLine(s), q)}</span>
            </span>
            ${icon("chevron")}
          </button>
        </li>`;
    }).join("");

    el.empty.hidden = rows.length > 0;
    el.count.textContent = raw
      ? `${rows.length} ${rows.length === 1 ? "result" : "results"} for “${raw}”`
      : `All hymns · ${rows.length}`;
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
  function renderSong(i) {
    const s = state.songs[i];
    if (!s) return;
    const lang = state.langObj;
    state.current = i;

    el.songNo.textContent = `Hymn ${s.number}`;
    el.songLang.textContent = `${lang.native} · ${lang.name}`;

    let body = "";
    (s.verses || []).forEach((v, k) => {
      body += `<div class="stanza"><span class="stanza__n">${k + 1}</span><p class="stanza__text">${esc(v)}</p></div>`;
      if (k === 0 && s.chorus) body += chorusHtml(s.chorus, lang);
    });
    if (!(s.verses || []).length && s.chorus) body += chorusHtml(s.chorus, lang);

    el.lyrics.lang = lang.code;
    el.lyrics.innerHTML = `
      <header class="lyrics__head">
        <p class="hymn-no" lang="en"><span>Hymn</span><strong>${esc(s.number)}</strong></p>
        <h1 class="lyrics__title" tabindex="-1" data-focus>${esc(s.title)}</h1>
        ${s.author ? `<p class="lyrics__author">${esc(s.author)}</p>` : ""}
        <div class="ornament" aria-hidden="true"><span></span><i>✦</i><span></span></div>
      </header>
      ${body}`;

    el.prev.disabled = i <= 0;
    el.next.disabled = i >= state.songs.length - 1;
    el.pos.textContent = `${i + 1} / ${state.songs.length}`;
    scroller("song").scrollTop = 0;
  }

  const chorusHtml = (text, lang) =>
    `<div class="chorus"><span class="chorus__label">${esc(lang.chorus)}</span><p class="chorus__text">${esc(text)}</p></div>`;

  // Prev / next hymn: turn a paper copy of the current page over the new one.
  function changeSong(delta) {
    const i = state.current + delta;
    if (state.busy || state.page !== "song" || i < 0 || i >= state.songs.length) return;
    history.replaceState({ ...history.state, index: i }, "");

    if (reduceMotion.matches) { renderSong(i); return; }

    state.busy = true;
    const real = pages.song;
    const oldTop = scroller("song").scrollTop;
    const ghost = real.cloneNode(true);
    ghost.removeAttribute("id");
    ghost.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    ghost.classList.remove("is-active");
    ghost.style.setProperty("--turn-ms", FLIP_MS + "ms");
    real.style.setProperty("--turn-ms", FLIP_MS + "ms");

    const forward = delta > 0;
    ghost.classList.add(...(forward ? ["turn-out"] : ["turn-under", "is-back"]));
    book.appendChild(ghost);
    ghost.querySelector(".page__scroll").scrollTop = oldTop;

    renderSong(i);
    real.classList.add(forward ? "turn-under" : "turn-in");

    wait(FLIP_MS + 30).then(() => {
      ghost.remove();
      real.classList.remove("turn-under", "turn-in");
      real.style.removeProperty("--turn-ms");
      state.busy = false;
    });
  }

  function applyScale() {
    pages.song.style.setProperty("--scale", state.scale);
    el.fontDown.disabled = state.scale <= 0.8;
    el.fontUp.disabled = state.scale >= 1.6;
  }
  function setScale(d) {
    state.scale = Math.round(Math.min(1.6, Math.max(0.8, state.scale + d)) * 10) / 10;
    store.set("scale", state.scale);
    applyScale();
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

    // Search
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

    // Song list
    el.list.addEventListener("click", (e) => {
      const item = e.target.closest("[data-i]");
      if (item) go({ page: "song", lang: state.lang, index: Number(item.dataset.i) }, "push");
    });

    // Song view
    el.prev.addEventListener("click", () => changeSong(-1));
    el.next.addEventListener("click", () => changeSong(1));
    el.fontDown.addEventListener("click", () => setScale(-0.1));
    el.fontUp.addEventListener("click", () => setScale(0.1));
    onSwipe(scroller("song"), (dir) => changeSong(dir === "left" ? 1 : -1));

    // Sticky header shadow
    ORDER.forEach((name) => {
      const sc = scroller(name);
      const bar = sc && sc.querySelector(".topbar");
      if (!bar) return;
      sc.addEventListener("scroll", () => bar.classList.toggle("is-scrolled", sc.scrollTop > 4), { passive: true });
    });

    // Keyboard (laptop)
    document.addEventListener("keydown", (e) => {
      if (e.target === el.search) {
        if (e.key === "Escape") { el.search.value ? el.clear.click() : el.search.blur(); }
        return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (state.page === "cover" && e.key === "ArrowRight") go({ page: "languages" }, "turn");
      else if (state.page === "songs" && e.key === "/") { e.preventDefault(); el.search.focus(); }
      else if (state.page === "song" && e.key === "ArrowRight") changeSong(1);
      else if (state.page === "song" && e.key === "ArrowLeft") changeSong(-1);
      else if (e.key === "Escape") back();
    });

    // Keep the 3D depth natural on any screen width
    const setPerspective = () => { book.style.perspective = Math.max(1800, window.innerWidth * 2.4) + "px"; };
    window.addEventListener("resize", setPerspective);
    setPerspective();
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

  function init() {
    splitTitle();
    ORDER.forEach((name) => { if (name !== "splash") pages[name].inert = true; });
    renderLanguages();
    applyScale();
    applyKeypad();
    bind();

    history.replaceState({ page: "splash", depth: 0 }, "");
    // SPLASH_MS counts from page open, including the short wait for fonts.
    const fonts = document.fonts ? Promise.race([document.fonts.ready, wait(600)]) : Promise.resolve();
    fonts
      .then(() => {
        pages.splash.classList.add("is-ready");
        return wait(Math.max(0, SPLASH_MS - performance.now()));
      })
      .then(() => {
        history.replaceState({ page: "cover", depth: 0 }, "");
        show({ page: "cover" }, false, "turn");
      });
  }

  init();
})();
