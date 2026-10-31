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
  const SCRIPT_OF_LANG = { hi: "dev", mr: "dev", bn: "bn", or: "or", te: "te", en: "latin" };
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

  /* ---------- 3. English -> an Indian script ----------
     English spelling does not follow its sounds, so each word is first
     looked up in pronounce-en.js (how it is said), then those sounds are
     written in the target script. Unknown words are guessed from spelling. */
  let enDict = null;
  function enLookup(word) {
    if (!enDict) {
      enDict = new Map();
      String(globalThis.EN_SOUNDS || "").split("|").forEach((entry) => {
        const parts = entry.trim().split(/\s+/);
        if (parts.length > 1) enDict.set(parts[0], parts.slice(1));
      });
    }
    return enDict.get(word) || guessSounds(word);
  }

  // Rough spelling-to-sound rules, only for words missing from the dictionary.
  const SPELL = [
    ["tion", "SH AH N"], ["sion", "ZH AH N"], ["ough", "AO"], ["igh", "AY"], ["tch", "CH"],
    ["sh", "SH"], ["ch", "CH"], ["th", "TH"], ["ph", "F"], ["wh", "W"], ["ck", "K"], ["ng", "NG"],
    ["qu", "K W"], ["kn", "N"], ["wr", "R"], ["ee", "IY"], ["ea", "IY"], ["oo", "UW"], ["ou", "AW"],
    ["ow", "OW"], ["ai", "EY"], ["ay", "EY"], ["oa", "OW"], ["oi", "OY"], ["oy", "OY"], ["au", "AO"],
    ["aw", "AO"], ["ar", "AA R"], ["or", "AO R"], ["er", "ER"], ["ir", "ER"], ["ur", "ER"],
    ["a", "AE"], ["e", "EH"], ["i", "IH"], ["o", "AA"], ["u", "AH"], ["y", "IY"], ["b", "B"], ["c", "K"],
    ["d", "D"], ["f", "F"], ["g", "G"], ["h", "HH"], ["j", "JH"], ["k", "K"], ["l", "L"], ["m", "M"],
    ["n", "N"], ["p", "P"], ["q", "K"], ["r", "R"], ["s", "S"], ["t", "T"], ["v", "V"], ["w", "W"],
    ["x", "K S"], ["z", "Z"]
  ];
  const LONG = { a: "EY", e: "IY", i: "AY", o: "OW", u: "UW" };
  function guessSounds(word) {
    let w = word.replace(/'/g, "");
    let magic = null;                         // "made": silent e makes the vowel long
    const m = w.match(/^(.*?)([aeiou])([^aeiou])e$/);
    if (m && w.length > 3) { magic = m.index + m[1].length; w = w.slice(0, -1); }
    const out = [];
    for (let i = 0; i < w.length;) {
      if (i === 0 && w[0] === "y") { out.push("Y"); i++; continue; }
      if (w[i] === "c" && /[eiy]/.test(w[i + 1] || "")) { out.push("S"); i++; continue; }
      if (i === magic) { out.push(LONG[w[i]]); i++; continue; }
      const rule = SPELL.find(([g]) => w.startsWith(g, i));
      if (!rule) { i++; continue; }
      out.push(...rule[1].split(" "));
      i += rule[0].length;
    }
    return out;
  }

  const EN_VOWELS = new Set(["AA", "AE", "AH", "AO", "AW", "AY", "EH", "EY", "IH", "IY", "OW", "UH", "UW"]);
  const EN_CONS = {
    B: 0x2c, CH: 0x1a, D: 0x21, DH: 0x26, F: 0x2b, G: 0x17, HH: 0x39, JH: 0x1c, K: 0x15, L: 0x32,
    M: 0x2e, N: 0x28, P: 0x2a, R: 0x30, S: 0x38, SH: 0x36, T: 0x1f, TH: 0x25, V: 0x35, W: 0x35,
    Y: 0x2f, Z: 0x1c, ZH: 0x1c
  };
  const NASAL_BEFORE = new Set(["K", "G", "CH", "JH", "T", "D", "TH", "DH", "P", "B", "S", "Z", "SH", "F", "V"]);

  // Vowel as [standalone letters, sign after a consonant], in offsets from the script's block.
  // A plain number is a vowel sign/letter; "+n" adds a standalone vowel letter after the sign.
  function enVowel(v, target) {
    const te = target === "te", dev = target === "dev", flat = target === "or" || target === "bn";
    switch (v) {
      case "AA": return [[0x06], [0x3e]];
      case "AE": return dev ? [[0x10], [0x48]] : [[0x06], [0x3e]];
      case "AH": return [[0x05], []];
      case "AO": return dev ? [[0x11], [0x49]] : flat ? [[0x05], []] : [[0x06], [0x3e]];
      case "AW": return te ? [[0x14], [0x4c]] : [[0x06, 0x09], [0x3e, "+9"]];
      case "AY": return te ? [[0x10], [0x48]] : [[0x06, 0x07], [0x3e, "+7"]];
      case "EH": return te ? [[0x0e], [0x46]] : [[0x0f], [0x47]];
      case "EY": return [[0x0f], [0x47]];
      case "IH": return [[0x07], [0x3f]];
      case "IY": return [[0x08], [0x40]];
      case "OW": return te ? [[0x13], [0x4b]] : [[0x13], [0x4b]];
      case "UH": return [[0x09], [0x41]];
      case "UW": return [[0x0a], [0x42]];
    }
    return [[0x05], []];
  }

  function soundsToScript(sounds, target) {
    const B = BASE[target];
    const ph = [];
    const bn = target === "bn";
    sounds.forEach((p) => {                   // ER = "uh" + r, OY = "aw" + y
      if (p === "ER") ph.push("AH", "R");
      else if (p === "OY") ph.push("AO", "Y");
      else if (bn && p === "IY") ph.push("IH");   // Bangla writes English "ee" as a short i (মি, সুইট)
      else if (bn && p === "UW") ph.push("UH");   // and "oo" as a short u (টু)
      else ph.push(p);
    });
    // "ee" running into another vowel is written short i + y: fear = ఫియర్, glorious = ग्लोरियस
    for (let i = 0; i < ph.length - 1; i++) {
      if ((ph[i] === "IY" || ph[i] === "IH") && EN_VOWELS.has(ph[i + 1])) { ph[i] = "IH"; ph.splice(i + 1, 0, "Y"); }
    }
    const finalVirama = target === "te" || target === "or";
    let out = "";
    let open = false;                         // last letter is a consonant still waiting for a vowel
    const close = () => { if (open) out += chr(B + 0x4d); open = false; };
    const letters = (arr) => arr.map((x) => (typeof x === "string" ? chr(B + 0x0 + parseInt(x.slice(1), 16)) : chr(B + x))).join("");

    for (let i = 0; i < ph.length; i++) {
      const p = ph[i];
      const next = ph[i + 1];
      if (EN_VOWELS.has(p)) {
        const [alone, sign] = enVowel(p, target);
        out += open ? letters(sign) : letters(alone);
        open = false;
        continue;
      }
      // Nasal before a consonant is written as anusvara (sound, singing, simply).
      if (!bn && ((p === "N" && NASAL_BEFORE.has(next)) || (p === "M" && (next === "P" || next === "B")))) {
        out += chr(B + 0x02); open = false; continue;
      }
      if (p === "NG") {
        out += chr(B + 0x02); open = false;
        if (!bn && next !== "G" && next !== "K") { out += chr(B + EN_CONS.G); open = true; }   // Bangla ং already says "ng"
        continue;
      }
      // Bangla writes "w" with vowels: after a consonant as "u" (sweet = সুইট), else as ওয়.
      if (p === "W" && target === "bn") {
        if (open) { out += chr(B + 0x41); open = false; ph[i + 1] && EN_VOWELS.has(ph[i + 1]) && (ph[i + 1] = "_" + ph[i + 1]); continue; }
        out += chr(B + 0x13) + chr(B + 0x2f) + chr(B + 0x3c); open = true; continue;
      }
      if (p.startsWith("_")) {                // vowel that must stand alone (after Bangla "u")
        out += letters(enVowel(p.slice(1), target)[0]); open = false; continue;
      }
      const code = EN_CONS[p];
      if (code === undefined) continue;
      if (open) out += chr(B + 0x4d);         // join consonant clusters
      out += consonant({ r: code, nukta: target === "dev" && (p === "F" || p === "Z" || p === "ZH") }, target, open);
      open = true;
    }
    if (finalVirama) close();
    return out;
  }

  function englishToScript(text, target) {
    return String(text).replace(/'?[A-Za-z]+(?:['’][A-Za-z]+)*/g, (w) => {
      const word = w.toLowerCase().replace(/’/g, "'").replace(/^'/, "");
      return soundsToScript(enLookup(word), target);
    });
  }

  /* ---------- public API ---------- */
  function transliterate(text, srcLang, target) {
    const src = SCRIPT_OF_LANG[srcLang];
    if (!src || !target || target === src) return String(text);
    if (src === "latin") return target === "roman" ? String(text) : englishToScript(text, target);
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
