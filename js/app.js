/**
 * Lou Language App — UI Controller
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM references ────────────────────────────────────────────────────────
  const inputEl   = document.getElementById('input');
  const outputEl  = document.getElementById('output');
  const convertBtn = document.getElementById('btn-convert');
  const clearBtn   = document.getElementById('btn-clear');
  const copyBtn    = document.getElementById('btn-copy');
  const charCount  = document.getElementById('char-count');
  const examplesEl = document.getElementById('examples');
  const syllableDebug = document.getElementById('syllable-debug');

  // ── Example phrases ───────────────────────────────────────────────────────
  const EXAMPLES = [
    { th: 'อยากได้',     lou: 'ลากยูก ไล่ดู้' },
    { th: 'รักนะ',       lou: 'ซักรุก ละนุ' },
    { th: 'ดูดีมาก',     lou: 'ลูดู ลีดู ลากมูก' },
    { th: 'ไม่ชอบ',      lou: 'ไล่มุย ลอบชูบ' },
    { th: 'ไปเที่ยวกัน', lou: 'ไลปู เลี่ยวทู่ว ลันกุน' },
    { th: 'สวัสดี',      lou: 'ลัวสุว ลัสดุส ลีดู' },
    { th: 'ขอบคุณ',      lou: 'ลอบขุบ หลุณขิณ' },
  ];

  // ── Render examples ───────────────────────────────────────────────────────
  EXAMPLES.forEach(ex => {
    const card = document.createElement('button');
    card.className = 'example-card';
    card.innerHTML = `<span class="ex-th">${ex.th}</span><span class="ex-arrow">→</span><span class="ex-lou">${ex.lou}</span>`;
    card.addEventListener('click', () => {
      inputEl.value = ex.th;
      updateCharCount();
      doConvert();
    });
    examplesEl.appendChild(card);
  });

  // ── Character counter ─────────────────────────────────────────────────────
  function updateCharCount() {
    const len = inputEl.value.length;
    charCount.textContent = `${len} ตัวอักษร`;
    charCount.classList.toggle('warn', len > 200);
  }

  // ── Main convert ──────────────────────────────────────────────────────────
  function doConvert() {
    const input = inputEl.value.trim();
    if (!input) {
      showOutput('', false);
      return;
    }

    // Convert
    const lou = LouEngine.convert(input);
    showOutput(lou, true);

    // Debug: show syllable breakdown
    showSyllableBreakdown(input);
  }

  function showOutput(text, active) {
    outputEl.textContent = text || '...ภาษาลูของคุณจะปรากฏที่นี่...';
    outputEl.classList.toggle('has-content', active);
    copyBtn.disabled = !active;
  }

  function showSyllableBreakdown(text) {
    // Tokenise and show
    syllableDebug.innerHTML = '';

    // Only show for Thai words
    const thaiOnly = text.replace(/[^\u0E00-\u0E7F\s]/g, '').trim();
    if (!thaiOnly) return;

    // Split words by space
    const words = thaiOnly.split(/\s+/);
    words.forEach(word => {
      if (!word) return;
      const syls = LouEngine.splitSyllables(word);
      const wordEl = document.createElement('div');
      wordEl.className = 'debug-word';

      const originalEl = document.createElement('span');
      originalEl.className = 'debug-original';
      originalEl.textContent = word;
      wordEl.appendChild(originalEl);

      const arrowEl = document.createElement('span');
      arrowEl.className = 'debug-arrow';
      arrowEl.textContent = '→';
      wordEl.appendChild(arrowEl);

      syls.forEach(syl => {
        const louSyl = LouEngine.convert(syl);
        const chip = document.createElement('span');
        chip.className = 'debug-chip';
        chip.innerHTML = `<small>${syl}</small>${louSyl}`;
        wordEl.appendChild(chip);
      });

      syllableDebug.appendChild(wordEl);
    });
  }

  // ── Copy ─────────────────────────────────────────────────────────────────
  copyBtn.addEventListener('click', async () => {
    const text = outputEl.textContent;
    if (!text || text.startsWith('...')) return;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = '✓ คัดลอกแล้ว!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = 'คัดลอก';
        copyBtn.classList.remove('copied');
      }, 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  });

  // ── Clear ─────────────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
    inputEl.value = '';
    updateCharCount();
    showOutput('', false);
    syllableDebug.innerHTML = '';
  });

  // ── Button ────────────────────────────────────────────────────────────────
  convertBtn.addEventListener('click', doConvert);

  // ── Keyboard shortcut: Ctrl+Enter ─────────────────────────────────────────
  inputEl.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      doConvert();
    }
    updateCharCount();
  });

  inputEl.addEventListener('input', updateCharCount);

  // ── Real-time mode toggle ─────────────────────────────────────────────────
  const realtimeToggle = document.getElementById('realtime-toggle');
  let realtimeEnabled = false;

  realtimeToggle.addEventListener('change', () => {
    realtimeEnabled = realtimeToggle.checked;
    if (realtimeEnabled && inputEl.value.trim()) doConvert();
  });

  inputEl.addEventListener('input', () => {
    if (realtimeEnabled) doConvert();
  });

  // ── Typewriter effect for placeholder ────────────────────────────────────
  const placeholders = [
    'พิมพ์ภาษาไทยที่นี่...',
    'ลองพิมพ์ "รักนะ"...',
    'ลองพิมพ์ "ไปเที่ยว"...',
    'ลองพิมพ์ "ขอบคุณ"...',
  ];
  let phIdx = 0;
  let phCharIdx = 0;
  let phDeleting = false;

  function typePlaceholder() {
    const target = placeholders[phIdx];
    if (!phDeleting) {
      phCharIdx++;
      inputEl.placeholder = target.slice(0, phCharIdx);
      if (phCharIdx >= target.length) {
        phDeleting = true;
        setTimeout(typePlaceholder, 2000);
        return;
      }
    } else {
      phCharIdx--;
      inputEl.placeholder = target.slice(0, phCharIdx);
      if (phCharIdx <= 0) {
        phDeleting = false;
        phIdx = (phIdx + 1) % placeholders.length;
      }
    }
    setTimeout(typePlaceholder, phDeleting ? 40 : 80);
  }

  setTimeout(typePlaceholder, 1000);

  // ── Init ──────────────────────────────────────────────────────────────────
  showOutput('', false);
  updateCharCount();
});