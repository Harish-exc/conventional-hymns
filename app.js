/* =========================================================
   Convention Hymns — app logic (no frameworks)
   ========================================================= */
(() => {
  "use strict";

  // ?preview opens the admin panel's unpublished changes (kept in this browser only).
  const BOOK = (() => {
    if (/[?&]preview\b/.test(location.search)) {
      try {
        const draft = JSON.parse(localStorage.getItem("ch-admin:draft"));
        if (draft && Array.isArray(draft.languages) && draft.songs) return draft;
      } catch { /* no draft */ }
    }
    return window.HYMN_BOOK;
  })();
  const SETTINGS = BOOK.settings || {};

  const SPLASH_MS = Math.round(Math.min(15, Math.max(1, Number(SETTINGS.splashSeconds) || 5)) * 1000);   // front page
  const TURN_MS   = 1150;   // paper turn between pages
  const FLIP_MS   = 850;    // paper turn between hymns (prev / next)
  const PUSH_MS   = 420;    // list -> hymn slide
  const FADE_MS   = 260;    // reduced-motion fallback
  const STRIPS    = 12;     // the turning page is drawn as this many bending strips
  const ORDER = ["splash", "intro", "cover", "languages", "songs", "song", "settings"];

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
    coverLang: $("#coverLang"),
    coverTitle: $("#coverTitle"),
    coverVerse: $("#coverVerse"),
    coverFellowship: $("#coverFellowship"),
    coverTag: $("#coverTag"),
    coverBy: $("#coverBy"),
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
    prevNo: $("#prevNo"),
    nextNo: $("#nextNo"),
    progress: $("#songProgress"),
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
    coverLang: store.get("coverLang", "or"),
    pron: store.get("pron", "off"),
    favs: store.get("favs", {}),
    recent: store.get("recent", {}),
    last: store.get("last", null),
    singChanged: false,
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
  // English hymns are already in English letters ("latin"), so "roman" means as written for them.
  const sameScript = (own, id) => id === own || (own === "latin" && id === "roman");
  function pronTarget(lang = state.lang) {
    const own = Pronounce.scriptOfLang(lang);
    if (!own || state.pron === "off" || sameScript(own, state.pron)) return null;
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
  const animFor = (a, b) =>
    (a === "songs" && b === "song") || (a === "song" && b === "songs") || a === "settings" || b === "settings" ? "push" : "turn";

  function show(route, back, anim) {
    // Back from Settings after picking another singing language: show that language's hymns.
    if (state.page === "settings" && state.singChanged && (route.page === "songs" || route.page === "song")) {
      route = { page: "songs", lang: state.lang };
      history.replaceState({ ...route, depth: depth() }, "");
    }
    if (state.page === "settings") state.singChanged = false;
    if (route.lang && route.lang !== state.lang) setLanguage(route.lang);
    if (route.page === "cover") renderCover(state.coverLang);
    if (route.page === "song") renderSong(route.index);
    if (route.page === "settings") renderSettings();
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
    if (sheetOpen()) { hideSheet(); return; }   // Back closes the reading-options panel first
    const route = e.state || { page: "intro" };
    if (route.page === "splash" || state.page === "splash") return;
    if (state.busy) { state.queued = route; return; }
    applyRoute(route);
  });

  const parentOf = {
    cover: () => ({ page: "intro" }),
    languages: () => ({ page: "cover", coverLang: state.coverLang }),
    songs: () => ({ page: "languages" }),
    song: () => ({ page: "songs", lang: state.lang }),
    settings: () => ({ page: "languages" })
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
    paper.classList.remove("is-scrollable");
    let lo = 0.5, hi = 1.45;
    for (let k = 0; k < 10; k++) {
      const mid = (lo + hi) / 2;
      paper.style.setProperty("--k", mid.toFixed(3));
      if (paper.scrollHeight <= paper.clientHeight + 1) lo = mid;
      else hi = mid;
    }
    paper.style.setProperty("--k", lo.toFixed(3));
    paper.classList.toggle("is-scrollable", paper.scrollHeight > paper.clientHeight + 1);
  }

  // Title page text in the chosen language (falls back to the printed Odia page).
  function renderCover(code) {
    const c = BOOK.covers[code] || BOOK.covers.or;
    const lang = BOOK.languages.find((l) => l.code === code) || BOOK.languages[0];
    el.paper.lang = BOOK.covers[code] ? code : "or";
    el.coverLang.textContent = lang.native;
    el.coverLang.lang = lang.code;
    el.coverTitle.textContent = c.title;
    el.coverVerse.innerHTML = c.verse.map((v) => `<p>${esc(v)}</p>`).join("") + `<cite>${esc(c.cite)}</cite>`;
    el.coverFellowship.textContent = c.fellowship;
    el.coverTag.textContent = c.tag;
    el.coverBy.textContent = c.by;
    pages.cover.setAttribute("aria-label", c.title);
    fitCover();
  }

  // Title page Next: on to choosing the language for singing.
  const openHymns = () => go({ page: "languages" }, "turn");

  /* =========================================================
     Select language — only for the title page
     ========================================================= */
  function renderIntro() {
    $("#introGrid").innerHTML = BOOK.languages.map((l, i) => `
      <button class="intro__opt${l.code === state.coverLang ? " is-on" : ""}" type="button" data-cover="${esc(l.code)}" style="--i:${i + 1}">
        <span class="intro__native" lang="${esc(l.code)}">${esc(l.native)}</span>
        <span class="intro__en">${esc(l.name)}</span>
      </button>`).join("");
  }

  // The language picked on page 2 is also how the hymns are read (pronounced):
  // Telugu → Telugu letters, English → English letters, Hindi/Marathi → Devanagari, …
  const PRON_OF_LANG = { te: "te", or: "or", en: "roman", hi: "dev", mr: "dev", bn: "bn" };

  // The singing-language page is worded in the language picked on page 2.
  const UI_TEXT = {
    en: { eyebrow: "Preferred language", title: "Choose your language for singing", languages: "languages", hymn: "hymn", hymns: "hymns",
          reading: "Reading in", section: "Languages", recent: "Recent", cont: "Continue singing", hymnNo: "Hymn" },
    te: { eyebrow: "ఇష్టమైన భాష", title: "పాడటానికి మీ భాషను ఎంచుకోండి", languages: "భాషలు", hymn: "కీర్తన", hymns: "కీర్తనలు",
          reading: "లిపి:", section: "భాషలు", recent: "ఇటీవలి", cont: "పాడటం కొనసాగించండి", hymnNo: "కీర్తన" },
    or: { eyebrow: "ପସନ୍ଦର ଭାଷା", title: "ଗାଇବା ପାଇଁ ଆପଣଙ୍କ ଭାଷା ବାଛନ୍ତୁ", languages: "ଭାଷା", hymn: "ଗୀତ", hymns: "ଗୀତ",
          reading: "ଲିପି:", section: "ଭାଷାସମୂହ", recent: "ସାମ୍ପ୍ରତିକ", cont: "ଗାଇବା ଜାରି ରଖନ୍ତୁ", hymnNo: "ଗୀତ" },
    hi: { eyebrow: "पसंदीदा भाषा", title: "गाने के लिए अपनी भाषा चुनें", languages: "भाषाएँ", hymn: "भजन", hymns: "भजन",
          reading: "लिपि:", section: "भाषाएँ", recent: "हाल का", cont: "गाना जारी रखें", hymnNo: "भजन" },
    mr: { eyebrow: "आवडती भाषा", title: "गाण्यासाठी तुमची भाषा निवडा", languages: "भाषा", hymn: "गीत", hymns: "गीते",
          reading: "लिपी:", section: "भाषा", recent: "अलीकडील", cont: "गाणे सुरू ठेवा", hymnNo: "गीत" },
    bn: { eyebrow: "পছন্দের ভাষা", title: "গান গাওয়ার জন্য আপনার ভাষা বেছে নিন", languages: "ভাষা", hymn: "গান", hymns: "গান",
          reading: "লিপি:", section: "ভাষাসমূহ", recent: "সাম্প্রতিক", cont: "গান চালিয়ে যান", hymnNo: "গান" }
  };
  const ui = () => UI_TEXT[state.coverLang] || UI_TEXT.en;

  // Each language's name as people write it in each script (shown on the language cards).
  const NAMES_IN_SCRIPT = {
    te:  { te: "తెలుగు", or: "ఒడియా", en: "ఇంగ్లీష్", hi: "హిందీ", mr: "మరాఠీ", bn: "బెంగాలీ" },
    or:  { te: "ତେଲୁଗୁ", or: "ଓଡ଼ିଆ", en: "ଇଂରାଜୀ", hi: "ହିନ୍ଦୀ", mr: "ମରାଠୀ", bn: "ବଙ୍ଗଳା" },
    dev: { te: "तेलुगु", or: "ओड़िया", en: "अंग्रेज़ी", hi: "हिन्दी", mr: "मराठी", bn: "बांग्ला" },
    bn:  { te: "তেলুগু", or: "ওড়িয়া", en: "ইংরেজি", hi: "হিন্দি", mr: "মারাঠি", bn: "বাংলা" }
  };

  function chooseCoverLang(code) {
    state.coverLang = code;
    store.set("coverLang", code);
    renderIntro();
    setPron(PRON_OF_LANG[code] || "off");
    go({ page: "cover", coverLang: code }, "turn");
  }

  /* =========================================================
     Languages
     ========================================================= */
  function renderLanguages() {
    const u = ui();
    const uiLang = UI_TEXT[state.coverLang] ? state.coverLang : "en";
    [["#langEyebrow", u.eyebrow], ["#langTitle", u.title], ["#langSection", u.section]].forEach(([sel, text]) => {
      const node = $(sel);
      node.textContent = text;
      node.lang = uiLang;
    });
    el.langGrid.innerHTML = BOOK.languages.map((l, i) => {
      const n = (BOOK.songs[l.code] || []).length;
      // The language's name as it is written in the script chosen on page 2
      const names = NAMES_IN_SCRIPT[state.pron];
      const lang = (PRON_TARGETS.find((p) => p.id === state.pron) || {}).lang;
      const reads = names && names[l.code] && Pronounce.scriptOfLang(l.code) !== state.pron
        ? `<span class="lang-card__pron" lang="${lang}">${esc(names[l.code])}</span>` : "";
      return `
        <button class="lang-card" type="button" data-lang="${esc(l.code)}" style="--i:${i + 1}">
          <span class="lang-card__glyph" lang="${esc(l.code)}" aria-hidden="true">${esc(l.glyph)}</span>
          <span class="lang-card__body">
            <span class="lang-card__native" lang="${esc(l.code)}">${esc(l.native)}</span>
            ${reads}
            <span class="lang-card__en">${esc(l.name)}</span>
          </span>
          <span class="lang-card__count" lang="${uiLang}">${icon("book")}${n} ${n === 1 ? u.hymn : u.hymns}</span>
          <span class="lang-card__badge" lang="${uiLang}">${esc(u.recent)}</span>
          <span class="lang-card__go" aria-hidden="true">${icon("chevron")}</span>
        </button>`;
    }).join("");
    markRecent();

    // "6 languages · 33 hymns" on the header card
    const total = BOOK.languages.reduce((sum, l) => sum + (BOOK.songs[l.code] || []).length, 0);
    const reading = PRON_TARGETS.find((p) => p.id === state.pron);
    $("#heroStats").innerHTML =
      `<span lang="${uiLang}"><b>${BOOK.languages.length}</b> ${esc(u.languages)}</span><span lang="${uiLang}"><b>${total}</b> ${esc(u.hymns)}</span>` +
      (reading ? `<span class="hero__reading" lang="${uiLang}">${esc(u.reading)} <b lang="${reading.lang}">${esc(reading.label)}</b></span>` : "");
  }

  function renderNotice() {
    const box = $("#notice");
    const text = SETTINGS.noticeOn === false ? "" : String(SETTINGS.notice || "").trim();
    box.hidden = !text;
    box.innerHTML = text ? `<span class="notice__icon" aria-hidden="true">${icon("bell")}</span><p class="notice__text">${esc(text)}</p>` : "";
  }

  function markRecent() {
    const last = store.get("lang", null);
    el.langGrid.querySelectorAll(".lang-card").forEach((c) => c.classList.toggle("is-last", c.dataset.lang === last));
  }

  function setLanguage(code) {
    const lang = BOOK.languages.find((l) => l.code === code) || BOOK.languages[0];
    state.lang = lang.code;
    state.langObj = lang;
    state.current = -1;
    state.songs = (BOOK.songs[lang.code] || []).slice().sort((a, b) => a.number - b.number);
    const indic = !!Pronounce.scriptOfLang(lang.code) && lang.code !== "en";
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
    // Header card
    $("#bookGlyph").textContent = lang.glyph;
    $("#bookGlyph").lang = lang.code;
    $("#bookNative").textContent = lang.native;
    $("#bookNative").lang = lang.code;
    $("#bookEnglish").textContent = lang.name;
    $("#bookCount").textContent = state.songs.length;
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
    $("#bookFavs").textContent = favList().length;
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
      pinSearch();
    }, 70);
  }

  // Scroll just far enough that the search bar sits under the top bar,
  // so results start right below it (the header card moves out of the way).
  function pinSearch(onlyDown) {
    const sc = scroller("songs");
    const point = Math.max(0, $("#searchWrap").offsetTop - sc.querySelector(".topbar").offsetHeight);
    if (onlyDown && sc.scrollTop >= point) return;
    sc.scrollTop = point;
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
      ${body}
      <div class="lyrics__end" aria-hidden="true"><span></span><i>✦ ✦ ✦</i><span></span></div>`;

    // Bottom bar: neighbours by number, and how far through the book this hymn is.
    const prev = state.songs[i - 1];
    const next = state.songs[i + 1];
    el.prev.disabled = !prev;
    el.next.disabled = !next;
    el.prevNo.textContent = prev ? `Hymn ${prev.number}` : "—";
    el.nextNo.textContent = next ? `Hymn ${next.number}` : "—";
    el.pos.textContent = `${i + 1} / ${state.songs.length}`;
    el.progress.style.width = ((i + 1) / state.songs.length) * 100 + "%";
    updateFavUi();
    if (!keepScroll) scroller("song").scrollTop = 0;
  }

  // Original + every other script, the current choice highlighted.
  const pronChips = (own, t) =>
    [{ id: "off", label: "Original", lang: "en" }, ...PRON_TARGETS.filter((p) => !sameScript(own, p.id))].map((p) => {
      const on = (t ? t.id : "off") === p.id;
      return `<button class="chip${on ? " is-on" : ""}" type="button" data-pron="${p.id}" lang="${p.lang}" aria-pressed="${on}">${esc(p.label)}</button>`;
    }).join("");

  const chorusHtml = (html, label) =>
    `<div class="chorus"><span class="chorus__label">${esc(label)}</span><p class="chorus__text">${html}</p></div>`;

  function setPron(id) {
    state.pron = id;
    store.set("pron", id);
    if (state.page === "song" && state.current >= 0) {
      renderSong(state.current, true);
      el.lyrics.classList.remove("is-swapping");
      void el.lyrics.offsetWidth;
      el.lyrics.classList.add("is-swapping");
    }
    pages.songs.style.setProperty("--enter-delay", "0ms");
    if (state.lang) renderList();
    renderSheet();
    renderResume();
    renderLanguages();
    if (state.page === "settings") renderSettings();
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
          <span class="resume__label" lang="${UI_TEXT[state.coverLang] ? state.coverLang : "en"}">${esc(ui().cont)}</span>
          <span class="resume__title" lang="${t ? t.lang : lang.code}">${esc(shown(song.title, lang.code))}</span>
          <span class="resume__meta">${esc(ui().hymnNo)} ${song.number} · ${esc(lang.native)} · ${esc(lang.name)}</span>
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
    el.fsRow.hidden = !document.fullscreenEnabled;
    el.fsToggle.setAttribute("aria-checked", String(!!document.fullscreenElement));
  }

  const sheetOpen = () => el.sheet.classList.contains("is-open");

  function openSheet() {
    if (sheetOpen() || state.busy) return;
    renderSheet();
    sheetReturn = document.activeElement;
    el.sheet.classList.add("is-open");
    el.sheet.setAttribute("aria-hidden", "false");
    history.pushState({ ...history.state, sheet: true }, "");
    requestAnimationFrame(() => el.sheetPanel.focus({ preventScroll: true }));
  }

  // Done, the backdrop and Escape step back through history; the popstate handler hides the panel.
  function closeSheet() {
    if (!sheetOpen()) return;
    if (history.state && history.state.sheet) history.back();
    else hideSheet();
  }

  function hideSheet() {
    if (!sheetOpen()) return;
    el.sheet.classList.remove("is-open");
    el.sheet.setAttribute("aria-hidden", "true");
    if (sheetReturn && sheetReturn.focus) sheetReturn.focus({ preventScroll: true });
  }

  function toggleFullscreen() {
    const req = document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen();
    if (req && req.catch) req.catch(() => toast("Full screen isn't available here"));
  }

  /* =========================================================
     Settings
     ========================================================= */
  const openSettings = () => { if (state.page !== "settings") go({ page: "settings" }, "push"); };

  function optButtons(list, current, attr) {
    return list.map((l) => `
      <button class="set-opt${l.code === current ? " is-on" : ""}" type="button" ${attr}="${esc(l.code)}" aria-pressed="${l.code === current}">
        <span class="set-opt__native" lang="${esc(l.code)}">${esc(l.native)}</span>
        <span class="set-opt__en">${esc(l.name)}</span>
      </button>`).join("");
  }

  function renderSettings() {
    const singing = state.lang || store.get("lang", null);
    $("#setAppLang").innerHTML = optButtons(BOOK.languages, state.coverLang, "data-set-app");
    $("#setSingLang").innerHTML = optButtons(BOOK.languages, singing, "data-set-sing");
    const t = state.pron === "off" ? null : PRON_TARGETS.find((p) => p.id === state.pron);
    $("#setRead").innerHTML = [{ id: "off", label: "As written", lang: "en" }, ...PRON_TARGETS].map((p) => {
      const on = (t ? t.id : "off") === p.id;
      return `<button class="chip${on ? " is-on" : ""}" type="button" data-pron="${p.id}" lang="${p.lang}" aria-pressed="${on}">${esc(p.label)}</button>`;
    }).join("");
    $("#setNumeric").setAttribute("aria-checked", String(state.numeric));
    $("#setFsRow").hidden = !document.fullscreenEnabled;
    $("#setFs").setAttribute("aria-checked", String(!!document.fullscreenElement));
    const favs = Object.values(state.favs).reduce((n, l) => n + l.length, 0);
    const recent = Object.values(state.recent).reduce((n, l) => n + l.length, 0);
    $("#setFavN").textContent = favs;
    $("#setRecentN").textContent = recent;
    $("#setClearFavs").disabled = !favs;
    $("#setClearRecent").disabled = !recent;
    const total = BOOK.languages.reduce((sum, l) => sum + (BOOK.songs[l.code] || []).length, 0);
    $("#setAbout").textContent = `${BOOK.languages.length} languages · ${total} hymns`;
    applyScale();
  }

  // The app language does everything the "Select Language" page does, without leaving Settings.
  function setAppLanguage(code) {
    state.coverLang = code;
    store.set("coverLang", code);
    renderIntro();
    renderCover(code);
    setPron(PRON_OF_LANG[code] || "off");
    const lang = BOOK.languages.find((l) => l.code === code);
    toast(`App language: ${lang ? lang.name : code}`);
  }

  function setSingingLanguage(code) {
    if (code !== state.lang) { setLanguage(code); state.singChanged = true; }
    renderSettings();
    renderLanguages();
    toast(`Singing language: ${state.langObj.name}`);
  }

  function clearSaved(kind) {
    const what = kind === "favs" ? "all favorites" : "the recently opened list";
    if (!window.confirm(`Clear ${what}?`)) return;
    state[kind] = {};
    store.set(kind, {});
    if (kind === "recent") { state.last = null; store.set("last", null); renderResume(); }
    if (state.lang) { updateFavUi(); renderList(); }
    renderSettings();
    toast(kind === "favs" ? "Favorites cleared" : "Recent list cleared");
  }

  function resetSettings() {
    if (!window.confirm("Reset language, reading and text size settings?")) return;
    state.scale = 1;
    store.set("scale", 1);
    state.numeric = false;
    store.set("numeric", false);
    applyKeypad();
    setAppLanguage("or");
    toast("Settings reset");
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
    document.querySelectorAll("[data-font-val]").forEach((o) => { o.textContent = Math.round(state.scale * 100) + "%"; });
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
    el.coverNext.addEventListener("click", openHymns);
    onSwipe(pages.cover, (dir) => (dir === "left" ? openHymns() : back()));

    // Back buttons
    document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", back));

    // Languages
    el.langGrid.addEventListener("click", (e) => {
      const card = e.target.closest("[data-lang]");
      if (card) go({ page: "songs", lang: card.dataset.lang }, "turn");
    });

    // Select language (title page only)
    $("#introGrid").addEventListener("click", (e) => {
      const opt = e.target.closest("[data-cover]");
      if (opt) chooseCoverLang(opt.dataset.cover);
    });

    // Search & filters
    el.search.addEventListener("input", onSearchInput);
    el.search.addEventListener("focus", () => setTimeout(() => pinSearch(true), 60));
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
    document.addEventListener("fullscreenchange", () => {
      el.fsToggle.setAttribute("aria-checked", String(!!document.fullscreenElement));
      $("#setFs").setAttribute("aria-checked", String(!!document.fullscreenElement));
    });

    // Settings
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-settings]")) openSettings();
      else if (e.target.closest("[data-sheet-settings]")) {
        // from the reading sheet: replace its history entry with Settings
        hideSheet();
        history.replaceState({ page: "settings", depth: depth() }, "");
        show({ page: "settings" }, false, "push");
      }
    });
    pages.settings.addEventListener("click", (e) => {
      const app = e.target.closest("[data-set-app]");
      const sing = e.target.closest("[data-set-sing]");
      const chip = e.target.closest("[data-pron]");
      if (app) setAppLanguage(app.dataset.setApp);
      else if (sing) setSingingLanguage(sing.dataset.setSing);
      else if (chip) setPron(chip.dataset.pron);
      else if (e.target.closest("#setNumeric")) {
        state.numeric = !state.numeric;
        store.set("numeric", state.numeric);
        applyKeypad();
        renderSettings();
      }
      else if (e.target.closest("#setFs")) toggleFullscreen();
      else if (e.target.closest("#setClearFavs")) clearSaved("favs");
      else if (e.target.closest("#setClearRecent")) clearSaved("recent");
      else if (e.target.closest("#setReset")) resetSettings();
      else if (e.target.closest("#setOpenHymns")) {
        const code = state.lang || store.get("lang", null) || BOOK.languages[0].code;
        go({ page: "songs", lang: code }, "push");
      }
    });

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
    // The song list's search bar gets its shadow once it pins under the top bar.
    const songsScroll = scroller("songs");
    const searchWrap = $("#searchWrap");
    const songsBar = songsScroll.querySelector(".topbar");
    songsScroll.addEventListener("scroll", () => {
      const stuck = searchWrap.getBoundingClientRect().top <= songsBar.getBoundingClientRect().bottom + 1;
      searchWrap.classList.toggle("is-stuck", stuck && songsScroll.scrollTop > 0);
    }, { passive: true });

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
      if (state.page === "cover" && e.key === "ArrowRight") openHymns();
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
    history.replaceState({ page: "intro", depth: 0 }, "", location.pathname + location.search);
    if (!link) { show({ page: "intro" }, false, "turn"); return; }
    // Opened from a shared hymn link: go straight to that hymn (back still walks the book).
    setLanguage(link.lang);
    const index = state.songs.findIndex((s) => s.number === link.number);
    history.pushState({ page: "cover", coverLang: state.coverLang, depth: 1 }, "");
    history.pushState({ page: "languages", depth: 2 }, "");
    history.pushState({ page: "songs", lang: link.lang, depth: 3 }, "");
    history.pushState({ page: "song", lang: link.lang, index, depth: 4 }, "");
    show({ page: "song", lang: link.lang, index }, false, "turn");
  }

  // After a refresh the browser still has this tab's last route in history.state:
  // open that page straight away instead of starting again from the front page.
  function savedRoute() {
    const r = history.state;
    if (!r || !r.page || r.page === "splash" || !pages[r.page]) return null;
    const route = { ...r };
    delete route.sheet;
    const known = (code) => BOOK.languages.some((l) => l.code === code);
    if (route.page === "songs" || route.page === "song") {
      if (!known(route.lang)) return { page: "languages", depth: route.depth || 0 };
      const n = (BOOK.songs[route.lang] || []).length;
      if (route.page === "song" && !(route.index >= 0 && route.index < n)) return { page: "songs", lang: route.lang, depth: route.depth || 0 };
    }
    return route;
  }

  function openAt(route) {
    history.replaceState(route, "");
    pages.splash.classList.remove("is-active");
    pages.splash.inert = true;
    if (route.lang) setLanguage(route.lang);
    if (route.page === "cover") renderCover(state.coverLang);
    if (route.page === "song") renderSong(route.index);
    if (route.page === "settings") renderSettings();
    const to = pages[route.page];
    to.inert = false;
    to.classList.add("is-active");
    state.page = route.page;
    keepAwake(route.page === "song");
    if (route.page === "cover" && document.fonts) document.fonts.ready.then(fitCover);
  }

  function init() {
    splitTitle();
    ORDER.forEach((name) => { if (name !== "splash") pages[name].inert = true; });
    renderIntro();
    renderLanguages();
    renderResume();
    renderNotice();
    applyScale();
    applyKeypad();
    bind();
    if (document.fonts) {
      document.fonts.ready.then(fitCover);
      document.fonts.addEventListener("loadingdone", fitCover);
    }
    registerWorker();

    const saved = savedRoute();
    if (saved) { openAt(saved); return; }

    history.replaceState({ page: "splash", depth: 0 }, "");
    const link = linkedSong();

    // SPLASH_MS counts from page open, including the short wait for fonts.
    // Tapping the splash once it is shown skips the rest of the wait.
    let left = false;
    // The page turn lifts the book's cover away.
    const leaveSplash = () => {
      if (left || state.page !== "splash") return;
      left = true;
      leaveSplashTo(link);
    };
    // Wait (briefly) for the fonts and the emblem, so the entrance animation plays complete.
    const logo = $(".cover3d__emblem img");
    const ready = [document.fonts ? document.fonts.ready : null, logo && logo.decode ? logo.decode().catch(() => {}) : null];
    const fonts = Promise.race([Promise.all(ready), wait(900)]);
    fonts.then(() => {
      fitCover();
      const remaining = Math.max(0, SPLASH_MS - performance.now());
      pages.splash.style.setProperty("--splash-left", remaining + "ms");
      pages.splash.classList.add("is-ready");
      pages.splash.addEventListener("click", leaveSplash);
      document.addEventListener("keydown", (e) => {
        if (state.page === "splash" && (e.key === "Enter" || e.key === " ")) leaveSplash();
      });
      setTimeout(leaveSplash, remaining);
    });
  }

  // Works offline and can be installed on the phone's home screen.
  function registerWorker() {
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
    }
  }

  init();
})();
