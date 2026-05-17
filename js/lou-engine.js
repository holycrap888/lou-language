/**
 * Lou Language Engine v19
 *
 * ไ/ใ phonetic model:
 *   ไ/ใ = leadVow ที่มีเสียง "ัย" (short diphthong)
 *   vowel length: short เสมอ ยกเว้น mai tho (้) → long
 *   ไป = leadVow=ไ, initial=ป, implicitFinal=ย → prefix=ลัย, suffix=ปุย
 *
 * เ-ีย pattern: aboveVow=ี + trailVow=ย (เที่ยว = เ+ท+ี่+ย+ว)
 *
 * PREFIX = leadVow/สระแทน + pfxCons + สระ + tone + normFinal
 *   ไ/ใ prefix สระ = ัย (mai han + ย)
 * SUFFIX = initial + cluster + สระใหม่ + tone + normFinal + implicitFinal
 */

const LouEngine = (() => {

  const CONS       = 'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ';
  const LEAD_VOW   = 'เแโใไ';
  const ABOVE_VOW  = '\u0E34\u0E35\u0E36\u0E37\u0E31\u0E47';
  const BELOW_VOW  = '\u0E38\u0E39';
  const SARA_AM    = '\u0E33';
  const TONE       = '\u0E48\u0E49\u0E4A\u0E4B';
  const MAI_EK     = '\u0E48'; // ่
  const MAI_THO    = '\u0E49'; // ้
  const SILENT     = '\u0E4C';
  const SARA_AA    = '\u0E32'; // า
  const SARA_A     = '\u0E30'; // ะ
  const MAI_HAN    = '\u0E31'; // ั
  const O_CONS     = '\u0E2D'; // อ

  const HIGH_CLASS  = 'ขฃฉฐถผฝศษสห';
  const SEMIVOWELS  = 'วย';

  const FINAL_MAP = {
    'ข':'ก','ค':'ก','ฆ':'ก',
    'ต':'ด','ถ':'ด','ท':'ด','ธ':'ด','ฎ':'ด','ฏ':'ด',
    'พ':'บ','ภ':'บ','ผ':'บ','ฝ':'บ','ป':'บ',
  };
  const normFinal   = c => FINAL_MAP[c] || c;

  const isCons      = c => CONS.includes(c);
  const isLeadVow   = c => LEAD_VOW.includes(c);
  const isAboveVow  = c => ABOVE_VOW.includes(c) || c === SARA_AM;
  const isBelowVow  = c => BELOW_VOW.includes(c);
  const isTone      = c => TONE.includes(c);
  const isSemivowel = c => SEMIVOWELS.includes(c);
  const isThai      = c => { const p = c.codePointAt(0); return p >= 0x0E00 && p <= 0x0E7F; };

  const needsHL  = i => HIGH_CLASS.includes(i) || i === O_CONS || i === 'ป';
  const getPfxL  = i => needsHL(i) ? 'หล' : 'ล';
  const getPfxRL = (i, c) => (i === 'ห' && (c === 'ร' || c === 'ล')) ? 'ส' : 'ซ';

  // ── Analyser ───────────────────────────────────────────────────────────────
  function analyse(syl) {
    const ch = [...syl]; let i = 0;
    const r = { leadVow:'', initial:'', cluster:'', aboveVow:'', belowVow:'',
                tone:'', trailVow:'', finalCons:'', silent:'' };

    if (i < ch.length && isLeadVow(ch[i])) r.leadVow = ch[i++];

    // ไ/ใ: ตาม leadVow คือ initial (ไม่ใช่ finalCons pattern แบบเก่า)
    // ไป = ไ(lead) + ป(initial), implicit final ย
    // ไหน = ไ(lead) + ห(initial) + น(final)
    // ทุกอย่างหลัง ไ/ใ parse ปกติ

    if (i < ch.length && isCons(ch[i])) r.initial = ch[i++];

    // cluster: cons ตาม initial, ไม่รับ อ (อ = trailVow)
    if (i < ch.length && isCons(ch[i]) && ch[i] !== O_CONS) {
      const nxt = ch[i+1];
      const afterVowelMark = nxt && (isAboveVow(nxt)||isBelowVow(nxt)||isTone(nxt)||
                                      nxt===SARA_AA||nxt===SARA_A||nxt===SARA_AM);
      const afterFinalCons = nxt && isCons(nxt) && nxt !== O_CONS &&
                             (!ch[i+2] || isTone(ch[i+2]) || ch[i+2]===SILENT);
      const isLast = !nxt || isTone(nxt) || nxt===SILENT;
      if (!isLast && (afterVowelMark || afterFinalCons || isSemivowel(ch[i]))) {
        r.cluster = ch[i++];
      }
    }

    while (i < ch.length && isAboveVow(ch[i]))  r.aboveVow += ch[i++];
    while (i < ch.length && isBelowVow(ch[i]))  r.belowVow += ch[i++];
    while (i < ch.length && isTone(ch[i]))       r.tone     += ch[i++];

    // trailVow: อ vowel body หรือ ย ใน เ-ีย pattern
    if (i < ch.length && ch[i] === O_CONS) {
      const prevSaraUe = r.aboveVow.includes('\u0E37'); // ื
      const noVowel = !r.aboveVow && !r.belowVow;
      if (prevSaraUe || noVowel) r.trailVow += ch[i++];
    }
    // ย ใน เ-ีย (เที่ยว เขียน เปลี่ยน)
    if (i < ch.length && ch[i] === 'ย' && r.aboveVow.includes('\u0E35') && r.leadVow === 'เ') {
      r.trailVow += ch[i++];
    }
    while (i < ch.length && (ch[i]===SARA_AA||ch[i]===SARA_A)) r.trailVow += ch[i++];

    // final consonant(s): รับได้มากกว่า 1 ตัว (เที่ยว finalCons=ว)
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
    if (a.aboveVow === MAI_HAN)  return false;
    if (a.aboveVow === SARA_AM)  return false;
    if (a.trailVow.includes(SARA_AA)) return true;
    if (a.trailVow.includes(SARA_A))  return false;
    if (a.trailVow === O_CONS || a.trailVow === O_CONS + '') return true;
    if (!a.aboveVow && !a.belowVow && !a.trailVow && !a.leadVow && isSemivowel(a.cluster)) return true;
    if (a.leadVow === 'เ') {
      // เ-ีย = long, เ-็ = short
      if (a.trailVow === 'ย') return true;
      return a.trailVow !== SARA_A && !a.aboveVow.includes('\u0E47');
    }
    if (a.leadVow === 'แ' || a.leadVow === 'โ') return true;
    // ไ/ใ: short เสมอ ยกเว้น mai tho → long
    if (a.leadVow === 'ไ' || a.leadVow === 'ใ') return a.tone === MAI_THO;
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

  // PREFIX สำหรับ ไ/ใ: pfxCons + ัย (ไม่มี tone — tone อยู่ใน suffix)
  function mkPrefixLeadVow(a, pfxCons) {
    if (a.leadVow === 'ไ' || a.leadVow === 'ใ') {
      return pfxCons + MAI_HAN + 'ย'; // ลัย (no tone)
    }
    return render(a, { initial: pfxCons, cluster:'', silent:'' });
  }

  // PREFIX ทั่วไป
  function mkPrefix(a, pfxCons) {
    const keepClus = isSemivowel(a.cluster) && !a.aboveVow && !a.belowVow && !a.trailVow;
    return render(a, {
      initial: pfxCons,
      cluster: keepClus ? a.cluster : '',
      finalCons: normFinal(a.finalCons),
      silent: ''
    });
  }

  function getSuffixInit(a) {
    if (a.initial === O_CONS && a.cluster) return 'ห' + a.cluster;
    if (a.initial === O_CONS) return 'อ';
    if (isSemivowel(a.cluster) && !a.aboveVow && !a.belowVow && !a.trailVow) return a.initial;
    return a.initial + a.cluster;
  }

  // implicit final สำหรับ leadVow บางตัว
  function getImplicitFinal(a) {
    if (a.leadVow === 'ไ' || a.leadVow === 'ใ') return 'ย';
    return '';
  }

  function mkSuffix(a, long) {
    const vowel = long ? 'ู' : 'ุ';
    const fin   = a.aboveVow === SARA_AM ? 'ม' : normFinal(a.finalCons);
    const impl  = !a.finalCons ? getImplicitFinal(a) : '';
    return getSuffixInit(a) + vowel + a.tone + fin + impl;
  }

  function mkSuffixU(a, isLongU) {
    const vow  = isLongU ? '\u0E35' : '\u0E34';
    const fin  = normFinal(a.finalCons);
    const impl = !a.finalCons ? getImplicitFinal(a) : '';
    return getSuffixInit(a) + vow + a.tone + fin + impl;
  }

  function mkPrefixAm(a, pfxCons) {
    return pfxCons + MAI_HAN + a.tone + 'ม';
  }

  // ── Transform ──────────────────────────────────────────────────────────────
  function transformSyllable(syl) {
    if (!syl || !syl.trim()) return syl;
    if (![...syl].some(isThai)) return syl;

    const a      = analyse(syl);
    const long   = isLong(a);
    const _hasU  = hasU(a);
    const _hasRL = hasRL(a);

    // ำ special
    if (a.aboveVow === SARA_AM) {
      const pfxCons = _hasRL ? getPfxRL(a.initial, a.cluster) : getPfxL(a.initial);
      return mkPrefixAm(a, pfxCons) + a.initial + 'ุ' + a.tone + 'ม';
    }

    // Rule 4: ร/ล + อุ/อู
    if (_hasRL && _hasU) {
      const isLongU = a.belowVow === 'ู' && a.tone !== MAI_EK;
      return mkPrefix(a, getPfxRL(a.initial, a.cluster)) + mkSuffixU(a, isLongU);
    }

    // Rule 3: อุ/อู
    if (_hasU && !_hasRL) {
      const isLongU = a.belowVow === 'ู' && a.tone !== MAI_EK;
      return mkPrefix(a, getPfxL(a.initial)) + mkSuffixU(a, isLongU);
    }

    // ไ/ใ: prefix ใช้ ล เสมอ (สระ ไ/ใ กำหนด class เอง)
    if (a.leadVow === 'ไ' || a.leadVow === 'ใ') {
      const pfx = mkPrefixLeadVow(a, 'ล');
      return pfx + mkSuffix(a, long);
    }

    // Rule 2: ร/ล
    if (_hasRL) return mkPrefix(a, getPfxRL(a.initial, a.cluster)) + mkSuffix(a, long);

    // Rule 1
    return mkPrefix(a, getPfxL(a.initial)) + mkSuffix(a, long);
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