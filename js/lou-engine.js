/**
 * Lou Language Engine — Syllable Transformer
 *
 * รับ syllable string (1 พยางค์) จาก PyThaiNLP แล้วแปลงเป็น 2 พยางค์ภาษาลู
 * การตัดพยางค์ทำโดย Python/Pyodide ใน pyodide-bridge.js
 *
 * กฎ:
 *  Rule 1 — ทั่วไป        : ล + [สระ+tone] + original + อู/อุ
 *  Rule 2 — initial ร/ล   : ซ + [สระ+tone] + original + อู/อุ
 *  Rule 3 — สระ อุ/อู      : หล + อุ/อู + original(อุ→อิ, อู→อี)
 *  Rule 4 — ร/ล + อุ/อู   : ซ + อุ/อู + original(อุ→อิ, อู→อี)
 */

const LouEngine = (() => {

  // ── Thai Unicode constants ────────────────────────────────────────────────

  const CONS         = 'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ';
  const LEADING_VOW  = 'เแโใไ';
  const ABOVE_VOW    = '\u0E34\u0E35\u0E36\u0E37\u0E31\u0E47'; // ิีึืั็
  const BELOW_VOW    = '\u0E38\u0E39';  // ุู
  const TONE_MARKS   = '\u0E48\u0E49\u0E4A\u0E4B'; // ่้๊๋
  const SILENT       = '\u0E4C'; // ์
  const SARA_A       = '\u0E30'; // ะ
  const SARA_AA      = '\u0E32'; // า

  const isCons      = c => CONS.includes(c);
  const isLeadVow   = c => LEADING_VOW.includes(c);
  const isAboveVow  = c => ABOVE_VOW.includes(c);
  const isBelowVow  = c => BELOW_VOW.includes(c);
  const isTone      = c => TONE_MARKS.includes(c);
  const isThai      = c => { const p = c.codePointAt(0); return p >= 0x0E00 && p <= 0x0E7F; };

  // ── Syllable analyser ────────────────────────────────────────────────────

  function analyse(syl) {
    const ch = [...syl];
    let i = 0;
    const r = {
      leadVow:'', initial:'', cluster:'',
      aboveVow:'', belowVow:'', tone:'',
      trailVow:'', finalCons:'', silent:'',
    };

    if (i < ch.length && isLeadVow(ch[i]))  r.leadVow  = ch[i++];
    if (i < ch.length && isCons(ch[i]))     r.initial  = ch[i++];

    // cluster: ร ล ว ตามหลัง initial ถ้าตามด้วยสระหรือ tone
    if (i < ch.length && (ch[i]==='ร'||ch[i]==='ล'||ch[i]==='ว') && isCons(ch[i])) {
      const nxt = ch[i+1];
      if (nxt && (isAboveVow(nxt)||isBelowVow(nxt)||isTone(nxt)||nxt===SARA_AA||nxt===SARA_A))
        r.cluster = ch[i++];
    }

    while (i < ch.length && isAboveVow(ch[i]))               r.aboveVow  += ch[i++];
    while (i < ch.length && isBelowVow(ch[i]))               r.belowVow  += ch[i++];
    while (i < ch.length && isTone(ch[i]))                   r.tone      += ch[i++];
    while (i < ch.length && (ch[i]===SARA_AA||ch[i]===SARA_A)) r.trailVow += ch[i++];

    // final consonant — only if not followed by vowel mark
    if (i < ch.length && isCons(ch[i])) {
      const nxt = ch[i+1];
      if (!nxt || isTone(nxt) || nxt===SILENT) r.finalCons = ch[i++];
    }

    while (i < ch.length && isTone(ch[i]))   r.tone   += ch[i++];
    while (i < ch.length && ch[i]===SILENT)  r.silent += ch[i++];

    return r;
  }

  // ── Vowel helpers ────────────────────────────────────────────────────────

  function isLong(a) {
    if (a.belowVow === 'ู') return true;
    if (a.belowVow === 'ุ') return false;
    if (a.aboveVow.includes('\u0E35') || a.aboveVow.includes('\u0E37')) return true;  // ี ื
    if (a.aboveVow.includes('\u0E34')) return false; // ิ
    if (a.aboveVow.includes('\u0E36')) return true;  // ึ
    if (a.trailVow.includes(SARA_AA)) return true;
    if (a.trailVow.includes(SARA_A))  return false;
    if (a.leadVow === 'เ') return !a.trailVow.includes(SARA_A);
    if ('แโใไ'.includes(a.leadVow)) return true;
    return true;
  }

  const hasU  = a => a.belowVow === 'ุ' || a.belowVow === 'ู';
  const hasRL = a => a.initial === 'ร' || a.initial === 'ล';

  // ── Render ───────────────────────────────────────────────────────────────

  function render(a, ov={}) {
    const o = {...a, ...ov};
    return o.leadVow + o.initial + o.cluster
         + o.aboveVow + o.belowVow + o.tone
         + o.trailVow + o.finalCons + o.silent;
  }

  // prefix = same vowel shape, swapped initial, no final/silent
  function mkPrefix(a, newInit) {
    return render(a, { initial: newInit, cluster:'', finalCons:'', silent:'' });
  }

  // ── Transform one syllable → 2 syllables ─────────────────────────────────

  function transformSyllable(syl) {
    if (!syl || !syl.trim()) return syl;
    if (![...syl].some(isThai)) return syl; // non-Thai passthrough

    const a     = analyse(syl);
    const long  = isLong(a);
    const _hasU = hasU(a);
    const _hasRL= hasRL(a);

    // Rule 4: ร/ล + อุ/อู
    if (_hasRL && _hasU) {
      const isLongU = a.belowVow === 'ู';
      const pfx = mkPrefix(a, 'ซ');
      const sfx = render(a, { belowVow:'', aboveVow: isLongU ? '\u0E35' : '\u0E34' });
      return pfx + sfx;
    }

    // Rule 3: อุ/อู (ไม่มี ร/ล)
    if (_hasU && !_hasRL) {
      const isLongU = a.belowVow === 'ู';
      const pfx = mkPrefix(a, 'หล');
      const sfx = render(a, { belowVow:'', aboveVow: isLongU ? '\u0E35' : '\u0E34' });
      return pfx + sfx;
    }

    // Rule 2: initial ร หรือ ล
    if (_hasRL) {
      const pfx = mkPrefix(a, 'ซ');
      const sfx = render(a) + (long ? 'ู' : 'ุ');
      return pfx + sfx;
    }

    // Rule 1: ทั่วไป
    {
      const pfx = mkPrefix(a, 'ล');
      const sfx = render(a) + (long ? 'ู' : 'ุ');
      return pfx + sfx;
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Convert array of syllables (from PyThaiNLP) → Lou Language string
   * @param {string[]} syllables
   * @returns {string}
   */
  function convertSyllables(syllables) {
    return syllables.map(transformSyllable).join(' ');
  }

  /**
   * Fallback when Pyodide not ready — naive single-syllable per word
   */
  function convertRaw(text) {
    return [...text.split(/([^\u0E00-\u0E7F]+)/u)]
      .filter(Boolean)
      .map(part => {
        const hasThai = [...part].some(isThai);
        return hasThai ? transformSyllable(part) : part;
      }).join('');
  }

  return { convertSyllables, convertRaw, transformSyllable, analyse };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = LouEngine;