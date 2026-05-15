/**
 * Lou Language App — UI Controller
 * ใช้ PyodideBridge สำหรับตัดพยางค์, LouEngine สำหรับแปลงกฎภาษาลู
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const inputEl        = document.getElementById('input');
  const outputEl       = document.getElementById('output');
  const convertBtn     = document.getElementById('btn-convert');
  const clearBtn       = document.getElementById('btn-clear');
  const copyBtn        = document.getElementById('btn-copy');
  const charCount      = document.getElementById('char-count');
  const examplesEl     = document.getElementById('examples');
  const syllableDebug  = document.getElementById('syllable-debug');
  const outputCard     = document.getElementById('output-card');

  // Loading overlay elements
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingBar     = document.getElementById('loading-bar');
  const loadingStep    = document.getElementById('loading-step');
  const loadingPct     = document.getElementById('loading-pct');
  const loadingError   = document.getElementById('loading-error');
  const retryBtn       = document.getElementById('btn-retry');
  const fallbackBtn    = document.getElementById('btn-use-fallback');

  // ── Examples ────────────────────────────────────────────────────────────────
  const EXAMPLES = [
    { th: 'อยากได้' },
    { th: 'รักนะ' },
    { th: 'ดูดีมาก' },
    { th: 'ไม่ชอบ' },
    { th: 'ไปเที่ยวกัน' },
    { th: 'สวัสดีครับ' },
    { th: 'ขอบคุณมาก' },
    { th: 'กินข้าวยัง' },
  ];

  EXAMPLES.forEach(ex => {
    const card = document.createElement('button');
    card.className = 'example-card';
    card.textContent = ex.th;
    card.addEventListener('click', () => {
      inputEl.value = ex.th;
      updateCharCount();
      doConvert();
    });
    examplesEl.appendChild(card);
  });

  // ── State ──────────────────────────────────────────────────────────────────
  let useFallback = false;

  // ── Loading UI ─────────────────────────────────────────────────────────────
  function setProgress(step, pct) {
    loadingStep.textContent = step;
    loadingPct.textContent  = `${pct}%`;
    loadingBar.style.width  = `${pct}%`;
  }

  function showLoadingError(err) {
    loadingError.style.display = 'block';
    loadingError.querySelector('.error-msg').textContent =
      err?.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
  }

  function hideLoading() {
    loadingOverlay.classList.add('hidden');
  }

  // ── Init Pyodide ───────────────────────────────────────────────────────────
  async function initPyodide() {
    try {
      await PyodideBridge.init((step, pct) => setProgress(step, pct));
      hideLoading();
      setStatus('พร้อม — ใช้ PyThaiNLP', 'ready');
    } catch (err) {
      console.error('Pyodide init failed:', err);
      showLoadingError(err);
    }
  }

  retryBtn.addEventListener('click', () => {
    loadingError.style.display = 'none';
    setProgress('กำลังลองใหม่…', 0);
    initPyodide();
  });

  fallbackBtn.addEventListener('click', () => {
    useFallback = true;
    hideLoading();
    setStatus('Fallback mode — ตัดพยางค์อาจไม่สมบูรณ์', 'warn');
  });

  // ── Status bar ─────────────────────────────────────────────────────────────
  const statusEl = document.getElementById('engine-status');
  function setStatus(msg, type = 'ready') {
    statusEl.textContent = msg;
    statusEl.className   = `engine-status status-${type}`;
  }

  setStatus('กำลังโหลด PyThaiNLP…', 'loading');
  initPyodide();

  // ── Char counter ────────────────────────────────────────────────────────────
  function updateCharCount() {
    const len = inputEl.value.length;
    charCount.textContent = `${len} / 500`;
    charCount.classList.toggle('warn', len > 400);
  }

  // ── Main convert ────────────────────────────────────────────────────────────
  async function doConvert() {
    const text = inputEl.value.trim();
    if (!text) { showOutput('', false); return; }

    convertBtn.disabled = true;
    convertBtn.textContent = '⏳ กำลังแปลง…';

    try {
      let syllables;

      if (!useFallback && PyodideBridge.isReady()) {
        // ── Full mode: PyThaiNLP tokenizer ──────────────────────────────────
        syllables = await PyodideBridge.tokenize(text);
        showDebug(syllables);
        const lou = LouEngine.convertSyllables(syllables);
        showOutput(lou, true);

      } else {
        // ── Fallback mode ────────────────────────────────────────────────────
        const lou = LouEngine.convertRaw(text);
        showOutput(lou, true);
        showDebug(null);
      }

    } catch (err) {
      console.error('Convert error:', err);
      showOutput('เกิดข้อผิดพลาด: ' + err.message, false);
    } finally {
      convertBtn.disabled = false;
      convertBtn.textContent = '⚡ แปลงเป็นภาษาลู';
      outputCard.classList.add('lit');
    }
  }

  // ── Output display ──────────────────────────────────────────────────────────
  function showOutput(text, active) {
    outputEl.textContent = text || '…ภาษาลูของคุณจะปรากฏที่นี่…';
    outputEl.classList.toggle('has-content', active);
    copyBtn.disabled = !active || !text;
  }

  // ── Syllable debug ──────────────────────────────────────────────────────────
  function showDebug(syllables) {
    syllableDebug.innerHTML = '';
    if (!syllables) {
      syllableDebug.innerHTML = '<span style="color:var(--text-faint);font-size:.8rem">Fallback mode — ไม่มีข้อมูลพยางค์</span>';
      return;
    }

    const thaiSyls = syllables.filter(s => [...s].some(c => {
      const p = c.codePointAt(0); return p >= 0x0E00 && p <= 0x0E7F;
    }));

    thaiSyls.forEach(syl => {
      const lou = LouEngine.transformSyllable(syl);
      const chip = document.createElement('div');
      chip.className = 'debug-chip';
      chip.innerHTML = `<small>${syl}</small><span>${lou}</span>`;
      syllableDebug.appendChild(chip);
    });
  }

  // ── Copy ────────────────────────────────────────────────────────────────────
  copyBtn.addEventListener('click', async () => {
    const text = outputEl.textContent;
    if (!text || text.startsWith('…')) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    copyBtn.textContent = '✓ คัดลอกแล้ว!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.textContent = 'คัดลอก';
      copyBtn.classList.remove('copied');
    }, 2000);
  });

  // ── Clear ───────────────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
    inputEl.value = '';
    updateCharCount();
    showOutput('', false);
    syllableDebug.innerHTML = '';
    outputCard.classList.remove('lit');
  });

  // ── Convert button + keyboard ───────────────────────────────────────────────
  convertBtn.addEventListener('click', doConvert);

  inputEl.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') doConvert();
  });

  inputEl.addEventListener('input', updateCharCount);

  // ── Real-time toggle ────────────────────────────────────────────────────────
  const realtimeToggle = document.getElementById('realtime-toggle');
  let realtimeEnabled  = false;

  realtimeToggle.addEventListener('change', () => {
    realtimeEnabled = realtimeToggle.checked;
    if (realtimeEnabled && inputEl.value.trim()) doConvert();
  });

  inputEl.addEventListener('input', () => {
    if (realtimeEnabled) doConvert();
  });

  // ── Typewriter placeholder ──────────────────────────────────────────────────
  const placeholders = [
    'พิมพ์ภาษาไทยที่นี่…',
    'ลองพิมพ์ "รักนะ"…',
    'ลองพิมพ์ "ไปเที่ยว"…',
    'ลองพิมพ์ "ขอบคุณ"…',
    'ลองพิมพ์ "กินข้าวยัง"…',
  ];
  let phIdx = 0, phChar = 0, phDel = false;

  function tickPlaceholder() {
    const t = placeholders[phIdx];
    if (!phDel) {
      inputEl.placeholder = t.slice(0, ++phChar);
      if (phChar >= t.length) { phDel = true; setTimeout(tickPlaceholder, 1800); return; }
    } else {
      inputEl.placeholder = t.slice(0, --phChar);
      if (phChar <= 0) { phDel = false; phIdx = (phIdx + 1) % placeholders.length; }
    }
    setTimeout(tickPlaceholder, phDel ? 35 : 75);
  }
  setTimeout(tickPlaceholder, 1200);

  // ── Init ────────────────────────────────────────────────────────────────────
  showOutput('', false);
  updateCharCount();
});