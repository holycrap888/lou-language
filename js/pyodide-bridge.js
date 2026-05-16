/**
 * Pyodide Bridge
 * โหลด Pyodide + PyThaiNLP และ expose ฟังก์ชัน tokenize ให้ JS ใช้
 *
 * Usage:
 *   await PyodideBridge.init(onProgress)
 *   const syllables = await PyodideBridge.tokenize("สวัสดีครับ")
 *   // → ["สวัส", "ดี", "ครับ"]
 */

const PyodideBridge = (() => {

  let pyodide   = null;
  let ready     = false;
  let initError = null;

  const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js';

  // ── Python code ────────────────────────────────────────────────────────────

  const PYTHON_SETUP = `
import micropip
# tzdata ต้อง install ผ่าน micropip ก่อน pythainlp เสมอ
# เพราะ pythainlp import zoneinfo("Asia/Bangkok") ตอน module load
await micropip.install('tzdata')
await micropip.install('pythainlp')
print("PyThaiNLP installed")
`;

  const PYTHON_TOKENIZE = `
from pythainlp.tokenize import syllable_tokenize
import json, re

# ตรวจสอบ engines ที่ใช้ได้
try:
    from pythainlp.tokenize.core import DEFAULT_SYLLABLE_TOKENIZE_ENGINE
    print("default syllable engine:", DEFAULT_SYLLABLE_TOKENIZE_ENGINE)
except:
    pass

def tokenize_syllables(text):
    result = []
    segments = re.split(r'([\u0E00-\u0E7F]+)', text)
    for seg in segments:
        if not seg:
            continue
        if re.match(r'[\u0E00-\u0E7F]', seg):
            # ใช้ default engine (ไม่ระบุ engine)
            syls = syllable_tokenize(seg)
            result.extend(syls)
        else:
            result.append(seg)
    return json.dumps(result, ensure_ascii=False)

print("tokenize_syllables ready")
`;

  // ── Load Pyodide script dynamically ───────────────────────────────────────

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

  // ── Init ──────────────────────────────────────────────────────────────────

  /**
   * Initialise Pyodide + PyThaiNLP
   * @param {(step: string, pct: number) => void} onProgress
   */
  async function init(onProgress = () => {}) {
    if (ready)     return true;
    if (initError) throw initError;

    try {
      // 1. Load Pyodide JS
      onProgress('กำลังโหลด Pyodide…', 5);
      await loadScript(PYODIDE_CDN);

      // 2. Init Pyodide runtime
      onProgress('เริ่มต้น Python runtime…', 20);
      pyodide = await window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/',
      });

      // 3. Load micropip
      onProgress('โหลด micropip…', 35);
      await pyodide.loadPackage('micropip');

      // 4. Install tzdata + PyThaiNLP via micropip (order matters)
      onProgress('ติดตั้ง PyThaiNLP…', 55);
      await pyodide.runPythonAsync(PYTHON_SETUP);

      // 5. Define tokenizer function
      onProgress('เตรียม tokenizer…', 85);
      await pyodide.runPythonAsync(PYTHON_TOKENIZE);

      onProgress('พร้อมใช้งาน!', 100);
      ready = true;
      return true;

    } catch (err) {
      initError = err;
      console.error('[PyodideBridge] init failed:', err);
      throw err;
    }
  }

  // ── Tokenize ──────────────────────────────────────────────────────────────

  /**
   * ตัดพยางค์ภาษาไทย
   * @param {string} text
   * @returns {Promise<string[]>}
   */
  async function tokenize(text) {
    if (!ready) throw new Error('Pyodide not ready');

    const escaped = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const jsonStr = await pyodide.runPythonAsync(`tokenize_syllables('${escaped}')`);
    return JSON.parse(jsonStr);
  }

  // ── Status ────────────────────────────────────────────────────────────────

  function isReady()    { return ready; }
  function getError()   { return initError; }

  return { init, tokenize, isReady, getError };
})();