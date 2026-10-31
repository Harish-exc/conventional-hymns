/* =========================================================
   Conventional Hymns — pronunciation
   ---------------------------------------------------------
   Rewrites Telugu, Odia, Hindi/Marathi (Devanagari) and Bangla
   lyrics in English letters or in another Indian script, so a
   song can be sung by someone who cannot read its script.
   These scripts share one letter layout in Unicode (same order,
   different blocks), so each letter maps by its position.
   ========================================================= */
(() => {
  "use strict";

  const BASE = { dev: 0x0900, bn: 0x0980, or: 0x0b00, te: 0x0c00 };
  const SCRIPT_OF_LANG = { hi: "dev", mr: "dev", bn: "bn", or: "or", te: "te" };
  // Languages that do not pronounce the final "a" of a word (prem, not prema).
  const SCHWA_DROP = new Set(["hi", "mr", "bn"]);

  const chr = (cp) => String.fromCharCode(cp);

  function scriptOf(cp) {
    if (cp >= 0x0900 && cp <= 0x097f) return "dev";
    if (cp >= 0x0980 && cp <= 0x09ff) return "bn";
    if (cp >= 0x0b00 && cp <= 0x0b7f) return "or";
    if (cp >= 0x0c00 && cp <= 0x0c7f) return "te";
    return null;
  }

  /* ---------- 1. text -> letters (script-independent) ----------
     C consonant {r, nukta}, V vowel, M vowel sign, H virama,
     N nasal/visarga, D digit, P anything else (spaces, punctuation) */
  function tokenize(text) {
    const toks = [];
    for (const ch of String(text).normalize("NFC")) {
      const cp = ch.codePointAt(0);
      const s = scriptOf(cp);
      if (!s) { toks.push({ t: "P", ch }); continue; }

      const r = cp - BASE[s];
      const prev = toks[toks.length - 1];

      if (r === 0x64 || r === 0x65) toks.push({ t: "P", ch, danda: true });
      else if (r >= 0x66 && r <= 0x6f) toks.push({ t: "D", n: r - 0x66 });
      else if (r >= 0x01 && r <= 0x03) toks.push({ t: "N", r });
      else if (r >= 0x05 && r <= 0x14) toks.push({ t: "V", r });
      else if (r >= 0x15 && r <= 0x39) {
        let cr = r;
        if (cr === 0x29) cr = 0x28;        // ऩ -> न
        else if (cr === 0x31) cr = 0x30;   // ఱ / ऱ -> ర / र
        else if (cr === 0x34) cr = 0x33;   // ఴ / ऴ -> ళ / ळ
        const tok = { t: "C", r: cr, nukta: false };
        // Bangla য and Odia ଯ sound like "j", except as the second half of a conjunct.
        if ((s === "bn" || s === "or") && r === 0x2f) {
          tok.r = prev && prev.t === "H" ? 0x2f : 0x1c;
          tok.ya = true;
        }
        toks.push(tok);
      }
      else if (r >= 0x58 && r <= 0x5f) {   // precomposed nukta letters (क़ ड़ ড় ୟ …)
        const map = s === "dev"
          ? { 0x58: 0x15, 0x59: 0x16, 0x5a: 0x17, 0x5b: 0x1c, 0x5c: 0x21, 0x5d: 0x22, 0x5e: 0x2b, 0x5f: 0x2f }
          : { 0x5c: 0x21, 0x5d: 0x22, 0x5f: 0x2f };
        if (map[r] !== undefined) toks.push({ t: "C", r: map[r], nukta: map[r] !== 0x2f });
      }
      else if (s === "or" && r === 0x71) toks.push({ t: "C", r: 0x35, nukta: false });      // ୱ
      else if (s === "bn" && r === 0x4e) toks.push({ t: "C", r: 0x24, nukta: false }, { t: "H" }); // ৎ
      else if (r === 0x3c) {                                                                 // nukta
        if (prev && prev.t === "C") {
          if (prev.ya) { prev.r = 0x2f; prev.ya = false; }   // য় = "y"
          else prev.nukta = true;
        }
      }
      else if (r >= 0x3e && r <= 0x4c) toks.push({ t: "M", r });
      else if (r === 0x4d) toks.push({ t: "H" });
      // length marks, avagraha and rare signs are skipped
    }
    return toks;
  }

  const isWordEnd = (tk) => !tk || tk.t === "P" || tk.t === "D";
  const isLetter = (tk) => !!tk && tk.t !== "P" && tk.t !== "D";

  /* ---------- 2a. letters -> another Indian script ---------- */
  function toScript(toks, target, srcLang) {
    const B = BASE[target];
    const markFinal = (target === "te" || target === "or") && SCHWA_DROP.has(srcLang);
    let out = "";

    toks.forEach((tk, i) => {
      const prev = toks[i - 1];
      const next = toks[i + 1];
      switch (tk.t) {
        case "P": out += tk.ch; break;
        case "D": out += chr(B + 0x66 + tk.n); break;
        case "N": out += chr(B + tk.r); break;
        case "H": out += chr(B + 0x4d); break;
        case "V": {
          let r = tk.r;
          if (r === 0x0d || (r === 0x0e && target !== "te")) r = 0x0f;   // only Telugu has short e / o
          if (r === 0x11 || (r === 0x12 && target !== "te")) r = 0x13;
          out += chr(B + r);
          break;
        }
        case "M": {
          let r = tk.r;
          if (r === 0x45 || (r === 0x46 && target !== "te")) r = 0x47;
          if (r === 0x49 || (r === 0x4a && target !== "te")) r = 0x4b;
          out += chr(B + r);
          break;
        }
        case "C": {
          out += consonant(tk, target, prev && prev.t === "H");
          // Hindi/Marathi/Bangla drop a word's final "a"; Telugu and Odia readers need a virama to see that.
          if (markFinal && isWordEnd(next) && isLetter(prev)) out += chr(B + 0x4d);
          break;
        }
      }
    });
    return out;
  }

  function consonant(tk, target, inConjunct) {
    const B = BASE[target];
    let r = tk.r;
    if (r === 0x2f && target === "or") return chr(0x0b5f);                            // ୟ
    if (r === 0x2f && target === "bn" && !inConjunct) return chr(0x09af) + chr(0x09bc); // য়
    if (r === 0x35 && target === "or") return chr(0x0b71);                            // ୱ
    if (r === 0x35 && target === "bn") r = 0x2c;                                      // ব
    if (r === 0x33 && target === "bn") r = 0x32;                                      // ল
    let s = chr(B + r);
    if (tk.nukta && target !== "te") s += chr(B + 0x3c);
    return s;
  }

  /* ---------- 2b. letters -> English letters ---------- */
  const CONS = {
    0x15: "k", 0x16: "kh", 0x17: "g", 0x18: "gh", 0x19: "ng",
    0x1a: "ch", 0x1b: "chh", 0x1c: "j", 0x1d: "jh", 0x1e: "ny",
    0x1f: "t", 0x20: "th", 0x21: "d", 0x22: "dh", 0x23: "n",
    0x24: "t", 0x25: "th", 0x26: "d", 0x27: "dh", 0x28: "n",
    0x2a: "p", 0x2b: "ph", 0x2c: "b", 0x2d: "bh", 0x2e: "m",
    0x2f: "y", 0x30: "r", 0x32: "l", 0x33: "l", 0x35: "v",
    0x36: "sh", 0x37: "sh", 0x38: "s", 0x39: "h"
  };
  const NUKTA = { 0x15: "q", 0x16: "kh", 0x17: "gh", 0x1c: "z", 0x21: "r", 0x22: "rh", 0x2b: "f" };
  const VOWEL = {
    0x05: "a", 0x06: "aa", 0x07: "i", 0x08: "ee", 0x09: "u", 0x0a: "oo", 0x0b: "ri", 0x0c: "li",
    0x0d: "e", 0x0e: "e", 0x0f: "e", 0x10: "ai", 0x11: "o", 0x12: "o", 0x13: "o", 0x14: "au"
  };
  const SIGN = {
    0x3e: "aa", 0x3f: "i", 0x40: "ee", 0x41: "u", 0x42: "oo", 0x43: "ri", 0x44: "ree",
    0x45: "e", 0x46: "e", 0x47: "e", 0x48: "ai", 0x49: "o", 0x4a: "o", 0x4b: "o", 0x4c: "au"
  };
  // How each language actually sounds a few letters.
  const LANG_SOUNDS = {
    te: { cons: { 0x24: "th" }, vowel: { 0x0b: "ru" }, sign: { 0x43: "ru" } },
    or: { cons: { 0x36: "s", 0x37: "s", 0x35: "w" }, vowel: { 0x0b: "ru" }, sign: { 0x43: "ru" } },
    bn: { cons: { 0x38: "sh", 0x35: "b" }, vowel: { 0x05: "o", 0x06: "a", 0x10: "oi", 0x14: "ou" }, sign: { 0x3e: "a", 0x48: "oi", 0x4c: "ou" } }
  };

  function toRoman(toks, lang) {
    const sounds = LANG_SOUNDS[lang] || { cons: {}, vowel: {}, sign: {} };
    const drop = SCHWA_DROP.has(lang);
    const inherent = lang === "bn" ? "o" : "a";
    let out = "";

    toks.forEach((tk, i) => {
      const prev = toks[i - 1];
      const next = toks[i + 1];
      switch (tk.t) {
        case "P": out += tk.danda ? "." : tk.ch; break;
        case "D": out += tk.n; break;
        case "V": out += sounds.vowel[tk.r] || VOWEL[tk.r] || ""; break;
        case "M": out += sounds.sign[tk.r] || SIGN[tk.r] || ""; break;
        case "H": break;
        case "N":
          if (tk.r === 0x03) out += "h";
          else if (tk.r === 0x01) out += "n";
          else if (next && next.t === "C" && next.r >= 0x2a && next.r <= 0x2e) out += "m";
          else if (lang === "bn") out += "ng";
          else if (isWordEnd(next) && (lang === "te" || lang === "or")) out += "m";
          else out += "n";
          break;
        case "C": {
          const after = toks[i + 2];
          // ङ्क / ञ्च are said "nk" / "nch", not "ngk" / "nych"
          if ((tk.r === 0x19 || tk.r === 0x1e) && next && next.t === "H" && after && after.t === "C") out += "n";
          else out += (tk.nukta && NUKTA[tk.r]) || sounds.cons[tk.r] || CONS[tk.r] || "";
          if (next && (next.t === "M" || next.t === "H")) break;
          if (drop && isWordEnd(next) && isLetter(prev)) break;
          out += inherent;
          break;
        }
      }
    });

    out = out.replace(/\s+\./g, ".");
    return out.replace(/[a-z]/, (c) => c.toUpperCase());
  }

  /* ---------- public API ---------- */
  function transliterate(text, srcLang, target) {
    const src = SCRIPT_OF_LANG[srcLang];
    if (!src || !target || target === src) return String(text);
    return String(text).split("\n").map((line) => {
      const toks = tokenize(line);
      return target === "roman" ? toRoman(toks, srcLang) : toScript(toks, target, srcLang);
    }).join("\n");
  }

  // Loose English-letter key for search: "aaraadhana" and "aradhana" both match.
  const looseKey = (s) => String(s).toLowerCase()
    .replace(/ee/g, "i").replace(/oo/g, "u")
    .replace(/([tdkgpbcj])h/g, "$1")
    .replace(/w/g, "v")
    .replace(/([a-z])\1+/g, "$1");

  globalThis.Pronounce = {
    transliterate,
    looseKey,
    scriptOfLang: (lang) => SCRIPT_OF_LANG[lang] || null
  };
})();
