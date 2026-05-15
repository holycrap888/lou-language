/**
 * Lou Language Engine
 * Converts Thai text into "Lou Language" (ภาษาลู)
 * Each syllable becomes 2 syllables based on 4 rules.
 */

const LouEngine = (() => {

  // ─── Thai Unicode helpers ──────────────────────────────────────────────────

  // Consonants
  const CONS = {
    R: 'ร', L: 'ล',
    NEW_L: 'ล', NEW_S: 'ซ', NEW_HL: 'หล',
  };

  // Vowel nucleus patterns (สระ)
  // We operate on Romanised syllable objects, then re-render to Thai script.
  // Approach: work with raw Thai string manipulation.

  // ─── Thai syllable splitter ─────────────────────────────────────────────────

  /**
   * Split Thai text into syllables.
   * Strategy: Use a greedy consonant-cluster + vowel + final-consonant model.
   * We handle Thai Unicode order: initial-cons → vowel marks → final-cons → tone.
   */

  // Thai character class ranges
  const THAI_CONSONANTS = 'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ';
  const THAI_VOWELS_ABOVE = '\u0E34\u0E35\u0E36\u0E37\u0E31\u0E47\u0E48\u0E49\u0E4A\u0E4B\u0E4C'; // ิีึืั็่้๊๋์
  const THAI_VOWELS_BELOW = '\u0E38\u0E39\u0E3A'; // ฺุู
  const THAI_TONES = '\u0E48\u0E49\u0E4A\u0E4B'; // ่้๊๋
  const THAI_LEADING_VOWELS = 'เแโใไ';
  const THAI_TRAILING_VOWELS = 'าๆๅ็ะ';
  const THAI_FINAL_CONS = 'กขคงจชญณนบปพฟมยรลวศสอ';

  function isThaiConsonant(ch) { return THAI_CONSONANTS.includes(ch); }
  function isThaiLeadingVowel(ch) { return THAI_LEADING_VOWELS.includes(ch); }
  function isThaiChar(ch) {
    const cp = ch.codePointAt(0);
    return cp >= 0x0E00 && cp <= 0x0E7F;
  }

  /**
   * Tokenise input into Thai-word tokens and non-Thai tokens (spaces, punctuation, etc.)
   */
  function tokenise(text) {
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      if (isThaiChar(text[i]) || isThaiLeadingVowel(text[i])) {
        let j = i;
        while (j < text.length && (isThaiChar(text[j]))) j++;
        tokens.push({ type: 'thai', value: text.slice(i, j) });
        i = j;
      } else {
        let j = i;
        while (j < text.length && !isThaiChar(text[j])) j++;
        tokens.push({ type: 'other', value: text.slice(i, j) });
        i = j;
      }
    }
    return tokens;
  }

  /**
   * Split a Thai word string into syllable strings.
   * This is the hardest part. We use a rule-based approach:
   *
   * A Thai syllable has this structure:
   *   [leading-vowel] + initial-consonant(s) + [vowel-above/below] + [final-consonant] + [tone]
   *
   * We scan character by character and group them into syllable buckets.
   */
  function splitSyllables(thaiWord) {
    // We'll collect syllables as character arrays
    const syllables = [];
    let i = 0;
    const chars = [...thaiWord]; // Unicode-safe

    while (i < chars.length) {
      let syl = '';

      // 1. Consume leading vowel (เ แ โ ใ ไ)
      if (isThaiLeadingVowel(chars[i])) {
        syl += chars[i++];
      }

      // 2. Consume initial consonant(s) - could be 2 (cluster like กร, พร, etc.)
      if (i < chars.length && isThaiConsonant(chars[i])) {
        syl += chars[i++];
        // Check for consonant cluster (second consonant without vowel between)
        if (
          i < chars.length &&
          isThaiConsonant(chars[i]) &&
          i + 1 < chars.length &&
          !isThaiLeadingVowel(chars[i]) &&
          (chars[i] === 'ร' || chars[i] === 'ล' || chars[i] === 'ว')
        ) {
          // Cluster: e.g. กร, พล, กว
          // Only absorb if next char after is a vowel mark or tone
          const nextNext = chars[i + 1];
          if (nextNext && (
            THAI_VOWELS_ABOVE.includes(nextNext) ||
            THAI_VOWELS_BELOW.includes(nextNext) ||
            THAI_TRAILING_VOWELS.includes(nextNext) ||
            THAI_TONES.includes(nextNext)
          )) {
            syl += chars[i++];
          }
        }
      }

      // 3. Consume vowel marks above/below
      while (
        i < chars.length &&
        (THAI_VOWELS_ABOVE.includes(chars[i]) || THAI_VOWELS_BELOW.includes(chars[i]))
      ) {
        syl += chars[i++];
      }

      // 4. Consume trailing vowel characters (า ะ ๆ etc.)
      while (i < chars.length && THAI_TRAILING_VOWELS.includes(chars[i])) {
        syl += chars[i++];
      }

      // 5. Consume final consonant (if next char is consonant and not followed by a vowel mark)
      if (
        i < chars.length &&
        isThaiConsonant(chars[i]) &&
        (i + 1 >= chars.length ||
          isThaiLeadingVowel(chars[i + 1]) ||
          isThaiConsonant(chars[i + 1]))
      ) {
        // It's a final consonant of this syllable
        syl += chars[i++];
      }

      // 6. Consume tone mark
      while (i < chars.length && THAI_TONES.includes(chars[i])) {
        syl += chars[i++];
      }

      // 7. Consume ์ (silent consonant marker)
      while (i < chars.length && chars[i] === '์') {
        syl += chars[i++];
      }

      if (syl.length > 0) {
        syllables.push(syl);
      } else {
        // Can't parse — just advance
        syllables.push(chars[i++]);
      }
    }

    return syllables;
  }

  // ─── Syllable Analyser ──────────────────────────────────────────────────────

  /**
   * Parse a Thai syllable string into components:
   * { leadingVowel, initial, clusterCons, vowelMarks, trailingVowel, finalCons, tone, silent }
   */
  function analyseSyllable(syl) {
    const chars = [...syl];
    let i = 0;
    const result = {
      leadingVowel: '',   // เ แ โ ใ ไ
      initial: '',        // first consonant
      cluster: '',        // ร ล ว after initial
      vowelAbove: '',     // ิ ี ึ ื ั ็
      vowelBelow: '',     // ุ ู
      trailingVowel: '',  // า ะ ๆ
      finalCons: '',      // final consonant
      tone: '',           // ่ ้ ๊ ๋
      silent: '',         // ์
    };

    if (i < chars.length && isThaiLeadingVowel(chars[i])) {
      result.leadingVowel = chars[i++];
    }
    if (i < chars.length && isThaiConsonant(chars[i])) {
      result.initial = chars[i++];
    }
    if (i < chars.length && (chars[i] === 'ร' || chars[i] === 'ล' || chars[i] === 'ว') && isThaiConsonant(chars[i])) {
      // Could be cluster or final. Peek ahead.
      const peek = chars[i + 1];
      if (peek && (THAI_VOWELS_ABOVE.includes(peek) || THAI_VOWELS_BELOW.includes(peek) || THAI_TRAILING_VOWELS.includes(peek) || THAI_TONES.includes(peek))) {
        result.cluster = chars[i++];
      }
    }
    while (i < chars.length && THAI_VOWELS_ABOVE.includes(chars[i])) {
      result.vowelAbove += chars[i++];
    }
    while (i < chars.length && THAI_VOWELS_BELOW.includes(chars[i])) {
      result.vowelBelow += chars[i++];
    }
    while (i < chars.length && THAI_TRAILING_VOWELS.includes(chars[i])) {
      result.trailingVowel += chars[i++];
    }
    // Tone can appear before final consonant in Thai Unicode
    while (i < chars.length && THAI_TONES.includes(chars[i])) {
      result.tone += chars[i++];
    }
    if (i < chars.length && isThaiConsonant(chars[i])) {
      const next = chars[i + 1];
      if (!next || THAI_TONES.includes(next) || next === '์') {
        result.finalCons = chars[i++];
      }
    }
    while (i < chars.length && THAI_TONES.includes(chars[i])) {
      result.tone += chars[i++];
    }
    while (i < chars.length && chars[i] === '์') {
      result.silent += chars[i++];
    }

    return result;
  }

  // ─── Vowel Length Detection ────────────────────────────────────────────────

  const LONG_VOWEL_ABOVE = '\u0E35\u0E37'; // ี ื
  const LONG_TRAILING = 'า';
  const LONG_LEADING = 'แโ'; // เ is ambiguous — เ + final = long; เ + ะ = short

  function isLongVowel(a) {
    const { leadingVowel, vowelAbove, vowelBelow, trailingVowel, finalCons } = a;

    // สระ อู
    if (vowelBelow === 'ู') return true;
    // สระ อุ
    if (vowelBelow === 'ุ') return false;

    if (LONG_VOWEL_ABOVE.includes(vowelAbove)) return true;
    if (vowelAbove === '\u0E34') return false; // ิ = short
    if (vowelAbove === '\u0E36') return true;  // ึ = long (mid)

    if (trailingVowel === 'า') return true;
    if (trailingVowel === 'ะ') return false;

    if (leadingVowel === 'เ') {
      // เ + ะ = short (เ-ะ), เ + final = long (เ-น เ-ก)
      if (trailingVowel === 'ะ') return false;
      if (finalCons) return true;
      return true; // default เ = long
    }
    if (leadingVowel === 'แ') return true;
    if (leadingVowel === 'โ') return true;
    if (leadingVowel === 'ใ' || leadingVowel === 'ไ') return true;

    // No explicit vowel + no final = implicit short สระอะ
    if (!vowelAbove && !vowelBelow && !trailingVowel && !leadingVowel) {
      return false; // implicit อะ
    }

    return true; // default long
  }

  function isVowelU(a) {
    // สระอุ or อู (without ร/ล initial)
    return a.vowelBelow === 'ุ' || a.vowelBelow === 'ู';
  }

  function isInitialRL(a) {
    return a.initial === 'ร' || a.initial === 'ล';
  }

  // ─── Syllable Renderer ─────────────────────────────────────────────────────

  /**
   * Reconstruct a Thai syllable from an analysis object, with optional overrides.
   */
  function renderSyllable(a, overrides = {}) {
    const o = { ...a, ...overrides };
    let out = '';
    out += o.leadingVowel;
    out += o.initial;
    out += o.cluster;
    out += o.vowelAbove;
    out += o.vowelBelow;
    out += o.trailingVowel;
    out += o.tone;
    out += o.finalCons;
    out += o.silent;
    return out;
  }

  // ─── Lou Conversion Rules ──────────────────────────────────────────────────

  /**
   * Convert one Thai syllable string → Lou Language (2 syllables).
   */
  function convertSyllable(syl) {
    const a = analyseSyllable(syl);
    const long = isLongVowel(a);
    const hasU = isVowelU(a);
    const hasRL = isInitialRL(a);

    // RULE 4: ร/ล + สระ อุ/อู
    if (hasRL && hasU) {
      const isLongU = a.vowelBelow === 'ู';
      // Prefix syllable: ซ + same vowel (อู or อุ) + tone
      const prefixVowelBelow = a.vowelBelow; // ุ or ู
      const prefix = renderSyllable(a, { initial: 'ซ', cluster: '', finalCons: '', silent: '' });

      // Suffix: original initial (ร/ล) + change vowel อู→อี / อุ→อิ
      const newVowelBelow = isLongU ? '\u0E35'.replace(/./u, '') : ''; // We use vowelAbove instead
      // อู → อี (above), อุ → อิ (above)
      const newVowelAbove = isLongU ? '\u0E35' : '\u0E34'; // ี or ิ
      const suffix = renderSyllable(a, { initial: a.initial, vowelBelow: '', vowelAbove: newVowelAbove });

      return prefix + suffix;
    }

    // RULE 3: สระ อุ/อู (no ร/ล)
    if (hasU && !hasRL) {
      const isLongU = a.vowelBelow === 'ู';
      // Prefix: หล + อู or อุ
      const prefix = renderSyllable(a, { initial: 'หล', cluster: '', finalCons: '', silent: '' });
      // Suffix: original initial + อู→อี / อุ→อิ
      const newVowelAbove = isLongU ? '\u0E35' : '\u0E34';
      const suffix = renderSyllable(a, { vowelBelow: '', vowelAbove: newVowelAbove });
      return prefix + suffix;
    }

    // RULE 2: พยัญชนะ ร หรือ ล
    if (hasRL) {
      // Prefix: ซ + same vowel structure
      const prefix = renderSyllable(a, { initial: 'ซ', cluster: '', finalCons: '', silent: '' });
      // Suffix: original + อู (long) or อุ (short) appended via trailing
      const suffixVowelBelow = long ? 'ู' : 'ุ';
      const suffix = renderSyllable(a, { vowelBelow: suffixVowelBelow });
      return prefix + suffix;
    }

    // RULE 1: คำทั่วไป
    {
      // Prefix: ล + same vowel + same tone (no final)
      const prefix = renderSyllable(a, { initial: 'ล', cluster: '', finalCons: '', silent: '' });
      // Suffix: original initial + อู (long) or อุ (short)
      const suffixVowelBelow = long ? 'ู' : 'ุ';
      // Suffix uses original structure but we ADD อู/อุ to it
      // The suffix keeps all vowels of original + appends อู/อุ
      const suffix = renderSyllable(a) + suffixVowelBelow;
      return prefix + suffix;
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Convert a full Thai text string to Lou Language.
   */
  function convert(text) {
    if (!text || !text.trim()) return '';

    const tokens = tokenise(text);
    let result = '';

    for (const token of tokens) {
      if (token.type !== 'thai') {
        result += token.value;
        continue;
      }

      // Split Thai word into syllables
      const syllables = splitSyllables(token.value);
      const louParts = syllables.map(convertSyllable);
      result += louParts.join(' ');
    }

    return result;
  }

  return { convert, splitSyllables, analyseSyllable };
})();

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LouEngine;
}