/**
 * Pyodide Bridge
 * ใช้ Pure Python TCC tokenizer — ไม่พึ่ง pythainlp (C extension ไม่ work ใน Pyodide)
 */

const PyodideBridge = (() => {

  let pyodide   = null;
  let ready     = false;
  let initError = null;

  const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js';

  // ── Pure Python TCC syllable tokenizer ──────────────────────────────────────
  // ไม่ใช้ pythainlp เลย — เขียน TCC rules ล้วนๆ
  const PYTHON_CODE = `
import json, re

CONS  = 'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ'
LEAD  = 'เแโใไ'
ABOVE = '\u0e34\u0e35\u0e36\u0e37\u0e31\u0e47\u0e4c'
BELOW = '\u0e38\u0e39'
TONE  = '\u0e48\u0e49\u0e4a\u0e4b'
SARA_AA  = '\u0e32'
SARA_A   = '\u0e30'
SILENT   = '\u0e4c'

def is_cons(c):  return c in CONS
def is_lead(c):  return c in LEAD
def is_above(c): return c in ABOVE
def is_below(c): return c in BELOW
def is_tone(c):  return c in TONE

def tcc_tokenize(text):
    if not text:
        return []
    chars = list(text)
    n = len(chars)
    syllables = []
    i = 0
    while i < n:
        syl = ''
        # 1. leading vowel
        if i < n and is_lead(chars[i]):
            syl += chars[i]; i += 1
        # 2. initial consonant
        if i < n and is_cons(chars[i]):
            syl += chars[i]; i += 1
        elif not syl:
            syllables.append(chars[i]); i += 1
            continue
        # 3. cluster consonant (ร ล ว)
        if i < n and chars[i] in 'รลว' and is_cons(chars[i]):
            peek = chars[i+1] if i+1 < n else ''
            if is_above(peek) or is_below(peek) or is_tone(peek) or peek in (SARA_AA, SARA_A):
                syl += chars[i]; i += 1
        # 4. above vowels
        while i < n and is_above(chars[i]):
            syl += chars[i]; i += 1
        # 5. below vowels
        while i < n and is_below(chars[i]):
            syl += chars[i]; i += 1
        # 6. tone mark
        while i < n and is_tone(chars[i]):
            syl += chars[i]; i += 1
        # 7. trailing vowels (า ะ)
        while i < n and chars[i] in (SARA_AA, SARA_A):
            syl += chars[i]; i += 1
        # 8. final consonant
        if i < n and is_cons(chars[i]):
            nxt  = chars[i+1] if i+1 < n else ''
            nxt2 = chars[i+2] if i+2 < n else ''
            if (not nxt
                or is_tone(nxt) or nxt == SILENT
                or is_lead(nxt)
                or (is_cons(nxt) and not (is_above(nxt2) or is_below(nxt2)))):
                syl += chars[i]; i += 1
        # 9. silent marker ์
        while i < n and chars[i] == SILENT:
            syl += chars[i]; i += 1
        # 10. trailing tone (edge cases)
        while i < n and is_tone(chars[i]):
            syl += chars[i]; i += 1
        if syl:
            syllables.append(syl)
    return syllables

def tokenize_syllables(text):
    result = []
    for seg in re.split(r'([\u0E00-\u0E7F]+)', text):
        if not seg:
            continue
        if re.match(r'[\u0E00-\u0E7F]', seg):
            syls = tcc_tokenize(seg)
            # Post-process: merge stray single consonants back into previous syllable
            # TCC often splits final consonants: ขอบ→['ขอ','บ'], เที่ยว→['เที่ย','ว']
            merged = []
            for s in syls:
                # single Thai consonant (no vowel markers) = stray final cons
                is_single_cons = (
                    len(s) == 1 and
                    re.match(r'[\u0E01-\u0E2E\u0E30-\u0E4E]', s) and
                    merged
                )
                if is_single_cons:
                    merged[-1] = merged[-1] + s
                else:
                    merged.append(s)
            result.extend(merged)
        else:
            result.append(seg)
    return json.dumps(result, ensure_ascii=False)

print("TCC tokenizer ready")
`;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload  = resolve;
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }

  async function init(onProgress = () => {}) {
    if (ready)     return true;
    if (initError) throw initError;

    try {
      onProgress('กำลังโหลด Pyodide…', 5);
      await loadScript(PYODIDE_CDN);

      onProgress('เริ่มต้น Python runtime…', 25);
      pyodide = await window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/',
      });

      onProgress('โหลด TCC tokenizer…', 70);
      await pyodide.runPythonAsync(PYTHON_CODE);

      onProgress('พร้อมใช้งาน!', 100);
      ready = true;
      return true;

    } catch (err) {
      initError = err;
      console.error('[PyodideBridge] init failed:', err);
      throw err;
    }
  }

  async function tokenize(text) {
    if (!ready) throw new Error('Pyodide not ready');
    const escaped = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const jsonStr = await pyodide.runPythonAsync(`tokenize_syllables('${escaped}')`);
    return JSON.parse(jsonStr);
  }

  function isReady()  { return ready; }
  function getError() { return initError; }

  return { init, tokenize, isReady, getError };
})();