/**
 * Lou Language Engine v13
 *
 * PREFIX = leadVow + newInitial + สระเดิม + tone + finalCons  (ไม่มีแค่ cluster กับ silent)
 * SUFFIX = initial + cluster + อู/อุ + tone + finalCons
 *
 * ใ/ไ pattern (ไม่มี initial หรือมี initial):
 *   prefix = leadVow + ล (+ tone ถ้ามี, ไม่มี finalCons ใน prefix)
 *   suffix = finalCons + อู/อุ + tone [+ ย ถ้า mai ek]
 */

const LouEngine = (() => {

  const CONS      = 'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ';
  const LEAD_VOW  = 'เแโใไ';
  const ABOVE_VOW = '\u0E34\u0E35\u0E36\u0E37\u0E31\u0E47';
  const BELOW_VOW = '\u0E38\u0E39';
  const SARA_AM   = '\u0E33';
  const TONE      = '\u0E48\u0E49\u0E4A\u0E4B';
  const MAI_EK    = '\u0E48';
  const SILENT    = '\u0E4C';
  const SARA_AA   = '\u0E32';
  const SARA_A    = '\u0E30';
  const O_CONS    = '\u0E2D';

  const isCons    = c => CONS.includes(c);
  const isLeadVow = c => LEAD_VOW.includes(c);
  const isAboveVow= c => ABOVE_VOW.includes(c) || c === SARA_AM;
  const isBelowVow= c => BELOW_VOW.includes(c);
  const isTone    = c => TONE.includes(c);
  const isThai    = c => { const p = c.codePointAt(0); return p >= 0x0E00 && p <= 0x0E7F; };

  // ── Analyser ───────────────────────────────────────────────────────────────
  function analyse(syl) {
    const ch = [...syl]; let i = 0;
    const r = { leadVow:'', initial:'', cluster:'', aboveVow:'', belowVow:'',
                tone:'', trailVow:'', finalCons:'', silent:'' };

    if (i < ch.length && isLeadVow(ch[i])) r.leadVow = ch[i++];

    // ใ/ไ special: ไป=leadVow+finalCons, ไหน=leadVow+initial+finalCons
    if ((r.leadVow === 'ใ' || r.leadVow === 'ไ') && i < ch.length && isCons(ch[i])) {
      const cons1 = ch[i];
      const nxt   = ch[i+1];
      if (nxt && isCons(nxt)) {
        // ไหน = ห(initial) + น(final)
        r.initial   = cons1; i++;
        r.finalCons = ch[i]; i++;
      } else {
        // ไป ไม่ ใจ = finalCons เดี่ยว
        r.finalCons = cons1; i++;
      }
      while (i < ch.length && isTone(ch[i]))  r.tone   += ch[i++];
      while (i < ch.length && ch[i]===SILENT) r.silent += ch[i++];
      return r;
    }

    if (i < ch.length && isCons(ch[i]))     r.initial = ch[i++];
    if (i < ch.length && isCons(ch[i])) {
      const nxt = ch[i+1];
      if (nxt && (isAboveVow(nxt)||isBelowVow(nxt)||isTone(nxt)||nxt===SARA_AA||nxt===SARA_A))
        r.cluster = ch[i++];
    }
    while (i < ch.length && isAboveVow(ch[i]))  r.aboveVow += ch[i++];
    while (i < ch.length && isBelowVow(ch[i]))  r.belowVow += ch[i++];
    while (i < ch.length && isTone(ch[i]))       r.tone     += ch[i++];
    if (i < ch.length && ch[i] === O_CONS && !r.aboveVow && !r.belowVow && !r.leadVow)
      r.trailVow += ch[i++];
    while (i < ch.length && (ch[i]===SARA_AA||ch[i]===SARA_A)) r.trailVow += ch[i++];
    if (i < ch.length && isCons(ch[i])) {
      const nxt = ch[i+1];
      if (!nxt || isTone(nxt) || nxt===SILENT) r.finalCons = ch[i++];
    }
    while (i < ch.length && isTone(ch[i]))  r.tone   += ch[i++];
    while (i < ch.length && ch[i]===SILENT) r.silent += ch[i++];
    return r;
  }

  // ── Vowel length ───────────────────────────────────────────────────────────
  function isLong(a) {
    if (a.belowVow === 'ู') return true;
    if (a.belowVow === 'ุ') return false;
    if (a.aboveVow === '\u0E35' || a.aboveVow === '\u0E37') return true;
    if (a.aboveVow === '\u0E34') return false;
    if (a.aboveVow === '\u0E36') return false;
    if (a.aboveVow === '\u0E31') return false;
    if (a.aboveVow === SARA_AM)  return false;
    if (a.trailVow.includes(SARA_AA)) return true;
    if (a.trailVow.includes(SARA_A))  return false;
    if (a.trailVow === O_CONS) return true;
    if (a.leadVow === 'เ') return a.trailVow !== SARA_A;
    if (a.leadVow === 'แ' || a.leadVow === 'โ') return true;
    if (a.leadVow === 'ใ' || a.leadVow === 'ไ') return a.tone !== MAI_EK;
    if (!a.aboveVow && !a.belowVow && !a.trailVow && !a.leadVow && a.finalCons) return false;
    return true;
  }

  const hasU  = a => a.belowVow === 'ุ' || a.belowVow === 'ู';
  const hasRL = a => {
    if (a.initial === 'ร' || a.initial === 'ล') return true;
    if (a.initial === 'ห' && (a.cluster === 'ร' || a.cluster === 'ล')) return true;
    return false;
  };

  function render(a, ov={}) {
    const o = {...a, ...ov};
    return o.leadVow + o.initial + o.cluster
         + o.aboveVow + o.belowVow + o.tone
         + o.trailVow + o.finalCons + o.silent;
  }

  // PREFIX: ไม่มี cluster และ silent เท่านั้น (คง finalCons ไว้)
  function mkPrefix(a, newInit) {
    return render(a, { initial: newInit, cluster:'', silent:'' });
  }

  // SUFFIX ทั่วไป
  function mkSuffix(a, long) {
    const vowel = long ? 'ู' : 'ุ';
    let fin = a.finalCons;
    if (a.aboveVow === SARA_AM) fin = 'ม';
    return a.initial + a.cluster + vowel + a.tone + fin;
  }

  // ── Transform ──────────────────────────────────────────────────────────────
  function transformSyllable(syl) {
    if (!syl || !syl.trim()) return syl;
    if (![...syl].some(isThai)) return syl;

    const a      = analyse(syl);
    const long   = isLong(a);
    const _hasU  = hasU(a);
    const _hasRL = hasRL(a);

    // ใ/ไ pattern
    if (a.leadVow === 'ไ' || a.leadVow === 'ใ') {
      // prefix = leadVow + ล + tone (ไม่มี finalCons)
      const pfx = a.leadVow + 'ล' + a.tone;
      const vowel = long ? 'ู' : 'ุ';

      if (!a.initial) {
        // ไป→ปู  ไม่→มุ่ย  ใจ→จู  ไว้→วู้
        const extraFin = (a.tone === MAI_EK) ? 'ย' : '';
        return pfx + ' ' + a.finalCons + vowel + a.tone + extraFin;
      } else {
        // ไหน→ไล หนู  (initial=ห, final=น)
        return pfx + ' ' + a.initial + a.finalCons + vowel + a.tone;
      }
    }

    // Rule 4: ร/ล + อุ/อู
    if (_hasRL && _hasU) {
      // อู+mai_ek = short → อิ
      const isLongU = a.belowVow === 'ู' && a.tone !== MAI_EK;
      const vow = isLongU ? '\u0E35' : '\u0E34';
      return mkPrefix(a, 'ซ') + ' ' + a.initial + a.cluster + vow + a.tone + a.finalCons;
    }

    // Rule 3: อุ/อู ไม่มี ร/ล
    if (_hasU && !_hasRL) {
      const isLongU = a.belowVow === 'ู' && a.tone !== MAI_EK;
      const vow = isLongU ? '\u0E35' : '\u0E34';
      return mkPrefix(a, 'หล') + ' ' + a.initial + a.cluster + vow + a.tone + a.finalCons;
    }

    // Rule 2: ร/ล
    if (_hasRL) return mkPrefix(a, 'ซ') + ' ' + mkSuffix(a, long);

    // Rule 1
    return mkPrefix(a, 'ล') + ' ' + mkSuffix(a, long);
  }

  function convertSyllables(syllables) {
    return syllables.map(s => ([...s].some(isThai) ? transformSyllable(s) : s)).join(' ');
  }

  function convertRaw(text) {
    return [...text.split(/([^\u0E00-\u0E7F]+)/u)]
      .filter(Boolean)
      .map(part => [...part].some(isThai) ? transformSyllable(part) : part)
      .join('');
  }

  return { convertSyllables, convertRaw, transformSyllable, analyse };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = LouEngine;