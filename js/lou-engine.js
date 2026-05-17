/**
 * Lou Language Engine v18 — clean rewrite
 *
 * PREFIX = leadVow + pfxCons + [cluster ถ้าเป็น semivowel ว/ย] + สระ + tone + finalCons
 *          (ตัดแค่ stop/nasal cluster ออก, เก็บ semivowel cluster ว/ย)
 *
 * SUFFIX = initial + cluster + สระใหม่ + tone + normFinal
 *   - อ initial + cluster → ห + cluster  (อยาก→หยูก, ออก→อ no cluster→อูก)
 *   - trailVow อ → อยู่ใน prefix แต่ไม่ใน suffix  (ลอง prefix=ซอง, suffix=ลูง)
 *
 * หล/ล: HIGH_CLASS + อ + ป → หล, อื่น → ล
 * ส/ซ:  ห+ร/ล cluster → ส, ร/ล initial → ซ
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

  const HIGH_CLASS   = 'ขฃฉฐถผฝศษสห';
  const SEMIVOWELS   = 'วย'; // clusters that are vowel components

  const FINAL_MAP = {
    'ข':'ก','ค':'ก','ฆ':'ก',
    'ต':'ด','ถ':'ด','ท':'ด','ธ':'ด','ฎ':'ด','ฏ':'ด',
    'พ':'บ','ภ':'บ','ผ':'บ','ฝ':'บ','ป':'บ',
  };
  const normFinal = c => FINAL_MAP[c] || c;

  const isCons    = c => CONS.includes(c);
  const isLeadVow = c => LEAD_VOW.includes(c);
  const isAboveVow= c => ABOVE_VOW.includes(c) || c === SARA_AM;
  const isBelowVow= c => BELOW_VOW.includes(c);
  const isTone    = c => TONE.includes(c);
  const isThai    = c => { const p = c.codePointAt(0); return p >= 0x0E00 && p <= 0x0E7F; };
  const isSemivowel = c => SEMIVOWELS.includes(c);

  // needs หล: HIGH class, อ, or ป
  const needsHL   = init => HIGH_CLASS.includes(init) || init === O_CONS || init === 'ป';
  const getPfxL   = init => needsHL(init) ? 'หล' : 'ล';
  const getPfxRL  = (init, clus) =>
    (init === 'ห' && (clus === 'ร' || clus === 'ล')) ? 'ส' : 'ซ';

  // ── Analyser ───────────────────────────────────────────────────────────────
  function analyse(syl) {
    const ch = [...syl]; let i = 0;
    const r = { leadVow:'', initial:'', cluster:'', aboveVow:'', belowVow:'',
                tone:'', trailVow:'', finalCons:'', silent:'' };

    if (i < ch.length && isLeadVow(ch[i])) r.leadVow = ch[i++];

    // ใ/ไ special
    if ((r.leadVow === 'ใ' || r.leadVow === 'ไ') && i < ch.length && isCons(ch[i])) {
      const c1 = ch[i], c2 = ch[i+1];
      if (c2 && isCons(c2) && !isTone(c2) && c2 !== SILENT) {
        r.initial = c1; i++;
        r.finalCons = ch[i++];
      } else {
        r.finalCons = c1; i++;
      }
      while (i < ch.length && isTone(ch[i]))  r.tone   += ch[i++];
      while (i < ch.length && ch[i]===SILENT) r.silent += ch[i++];
      return r;
    }

    if (i < ch.length && isCons(ch[i])) r.initial = ch[i++];

    // cluster: second cons followed by vowel mark, tone, or is last/second-to-last cons
    // ยกเว้น: อ ไม่เป็น cluster — อ เป็น vowel body (trailVow)
    if (i < ch.length && isCons(ch[i]) && ch[i] !== O_CONS) {
      const nxt = ch[i+1];
      const afterIsVowelMark = nxt && (isAboveVow(nxt)||isBelowVow(nxt)||isTone(nxt)||
                                        nxt===SARA_AA||nxt===SARA_A||nxt===SARA_AM);
      const afterIsFinalCons = nxt && isCons(nxt) && (!ch[i+2] || isTone(ch[i+2]) || ch[i+2]===SILENT);
      const isLast = !nxt || isTone(nxt) || nxt===SILENT;
      if (!isLast && (afterIsVowelMark || afterIsFinalCons || isSemivowel(ch[i]))) {
        r.cluster = ch[i++];
      }
    }

    while (i < ch.length && isAboveVow(ch[i]))  r.aboveVow += ch[i++];
    while (i < ch.length && isBelowVow(ch[i]))  r.belowVow += ch[i++];
    while (i < ch.length && isTone(ch[i]))       r.tone     += ch[i++];

    // อ as vowel body (trailVow)
    if (i < ch.length && ch[i] === O_CONS) {
      const prevHasSaraUe = r.aboveVow.includes('\u0E37');
      const noVowelYet = !r.aboveVow && !r.belowVow;
      if (prevHasSaraUe || noVowelYet) r.trailVow += ch[i++];
    }
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
    // semivowel cluster เป็น vowel = long
    if (!a.aboveVow && !a.belowVow && !a.trailVow && !a.leadVow && isSemivowel(a.cluster)) return true;
    if (a.leadVow === 'เ') return a.trailVow !== SARA_A;
    if (a.leadVow === 'แ' || a.leadVow === 'โ') return true;
    if (a.leadVow === 'ใ' || a.leadVow === 'ไ') return a.tone !== MAI_EK;
    if (!a.aboveVow && !a.belowVow && !a.trailVow && !a.leadVow && a.finalCons) return false;
    return true;
  }

  const hasU  = a => a.belowVow === 'ุ' || a.belowVow === 'ู';
  const hasRL = a => a.initial === 'ร' || a.initial === 'ล'
                  || (a.initial === 'ห' && (a.cluster === 'ร' || a.cluster === 'ล'));

  function render(a, ov={}) {
    const o = {...a, ...ov};
    return o.leadVow + o.initial + o.cluster
         + o.aboveVow + o.belowVow + o.tone
         + o.trailVow + o.finalCons + o.silent;
  }

  // PREFIX: ตัด stop/nasal cluster ออก แต่เก็บ semivowel cluster (ว ย)
  // normalize finalCons ด้วย
  function mkPrefix(a, pfxCons) {
    const keepClus = isSemivowel(a.cluster) && !a.aboveVow && !a.belowVow && !a.trailVow;
    return render(a, {
      initial: pfxCons,
      cluster: keepClus ? a.cluster : '',
      finalCons: a.aboveVow === SARA_AM ? 'ม' : normFinal(a.finalCons),
      silent:''
    });
  }

  // SUFFIX initial part:
  //   อ + semivowel cluster → ห + cluster (อยาก→หย, but ออก→อ no cluster)
  //   ห + ร/ล cluster → keep both (หรือ→หร, หลับ→หล, หมู→หม, หวาน→หว)
  //   otherwise → initial + cluster (ครับ→คร, สวย→ส only)
  function getSuffixStr(a, newVowel, finalStr) {
    let init;
    if (a.initial === O_CONS && a.cluster) {
      init = 'ห' + a.cluster; // อ+cluster → ห+cluster (อยาก→หยูก)
    } else if (a.initial === O_CONS) {
      init = 'อ'; // ออก → อ
    } else if (isSemivowel(a.cluster) && !a.aboveVow && !a.belowVow && !a.trailVow) {
      // semivowel เป็นสระ ไม่ติดใน suffix (สวย suffix=สูย ไม่ใช่ สวูย)
      init = a.initial;
    } else {
      // cluster ติดใน suffix: ครับ→คร, หลับ→หล, หรือ→หร, หวาน→หว, หมู→หม
      init = a.initial + a.cluster;
    }
    return init + newVowel + a.tone + finalStr;
  }

  function mkSuffix(a, long) {
    const vowel = long ? 'ู' : 'ุ';
    const fin   = a.aboveVow === SARA_AM ? 'ม' : normFinal(a.finalCons);
    return getSuffixStr(a, vowel, fin);
  }

  function mkSuffixU(a, isLongU) {
    const vow = isLongU ? '\u0E35' : '\u0E34';
    return getSuffixStr(a, vow, normFinal(a.finalCons));
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
      const pfx = a.leadVow + 'ล' + a.tone;
      const vowel = long ? 'ู' : 'ุ';
      if (!a.initial) {
        return pfx + ' ' + a.finalCons + vowel + a.tone + (a.tone === MAI_EK ? 'ย' : '');
      }
      return pfx + ' ' + a.initial + a.finalCons + vowel + a.tone;
    }

    // ำ special
    if (a.aboveVow === SARA_AM) {
      const pfxCons = _hasRL ? getPfxRL(a.initial, a.cluster) : getPfxL(a.initial);
      return pfxCons + '\u0E31' + a.tone + 'ม' + ' ' + a.initial + 'ุ' + a.tone + 'ม';
    }

    // Rule 4
    if (_hasRL && _hasU) {
      const isLongU = a.belowVow === 'ู' && a.tone !== MAI_EK;
      return mkPrefix(a, getPfxRL(a.initial, a.cluster)) + ' ' + mkSuffixU(a, isLongU);
    }

    // Rule 3
    if (_hasU && !_hasRL) {
      const isLongU = a.belowVow === 'ู' && a.tone !== MAI_EK;
      return mkPrefix(a, getPfxL(a.initial)) + ' ' + mkSuffixU(a, isLongU);
    }

    // Rule 2
    if (_hasRL) return mkPrefix(a, getPfxRL(a.initial, a.cluster)) + ' ' + mkSuffix(a, long);

    // Rule 1
    return mkPrefix(a, getPfxL(a.initial)) + ' ' + mkSuffix(a, long);
  }

  function convertSyllables(syllables) {
    return syllables.map(s => ([...s].some(isThai) ? transformSyllable(s) : s)).join(' ');
  }
  function convertRaw(text) {
    return [...text.split(/([^\u0E00-\u0E7F]+)/u)]
      .filter(Boolean)
      .map(p => [...p].some(isThai) ? transformSyllable(p) : p)
      .join('');
  }

  return { convertSyllables, convertRaw, transformSyllable, analyse };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = LouEngine;