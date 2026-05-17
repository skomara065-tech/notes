let notes = [];
let pendingScreenshot = null;
let chunkDuration = '15';

// Connect to background for persistent message channel
const port = chrome.runtime.connect({ name: 'sidepanel' });

document.addEventListener('DOMContentLoaded', () => {
  const pageIdInput = document.getElementById('notionPageId');
  const pageIdStatus = document.getElementById('pageIdStatus');
  const backendUrlInput = document.getElementById('backendUrl');
  const notionApiKeyInput = document.getElementById('notionApiKey');
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const btnCapture = document.getElementById('btnCapture');
  const btnSaveAll = document.getElementById('btnSaveAll');
  const notesList = document.getElementById('notesList');
  const tokenArc = document.getElementById('tokenArc');
  const tokenText = document.getElementById('tokenText');

  document.querySelectorAll('.chunk-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.chunk-btn').forEach(b => {
        b.classList.remove('bg-white', 'shadow-sm', 'text-slate-800', 'font-semibold');
        b.classList.add('text-slate-500', 'font-medium');
      });
      e.target.classList.remove('text-slate-500', 'font-medium');
      e.target.classList.add('bg-white', 'shadow-sm', 'text-slate-800', 'font-semibold');
      chunkDuration = e.target.dataset.val;
    });
  });

  chrome.storage.local.get(['backendUrl', 'notionApiKey', 'notionPageId', 'isRecording'], (data) => {
    if (data.backendUrl) backendUrlInput.value = data.backendUrl;
    if (data.notionApiKey) notionApiKeyInput.value = data.notionApiKey;
    if (data.notionPageId) {
      pageIdInput.value = data.notionPageId;
      validatePageId(data.notionPageId);
    }
    updateUI(data.isRecording || false);
  });

  function validatePageId(val) {
    const clean = val.replace(/-/g, '').trim();
    if (clean.length === 32 && /^[a-zA-Z0-9]+$/.test(clean)) {
      pageIdStatus.textContent = '✅';
      return true;
    } else {
      pageIdStatus.textContent = '❌';
      return false;
    }
  }

  pageIdInput.addEventListener('input', (e) => validatePageId(e.target.value));
  pageIdInput.addEventListener('blur', (e) => {
    if (validatePageId(e.target.value)) chrome.storage.local.set({ notionPageId: e.target.value });
  });
  backendUrlInput.addEventListener('change', (e) => chrome.storage.local.set({ backendUrl: e.target.value }));
  notionApiKeyInput.addEventListener('change', (e) => chrome.storage.local.set({ notionApiKey: e.target.value }));

  async function pollTokens() {
    const url = backendUrlInput.value.trim();
    if (!url) return;
    try {
      const res = await fetch(`${url}/api/token-usage`);
      const data = await res.json();
      const pct = Math.round(data.percentRemaining);
      tokenText.textContent = pct;
      tokenArc.setAttribute('stroke-dasharray', `${pct}, 100`);
      tokenArc.className.baseVal = tokenArc.className.baseVal.replace(/text-(green|yellow|red)-500/, pct > 50 ? 'text-green-500' : (pct > 20 ? 'text-yellow-500' : 'text-red-500'));
    } catch(e) {}
  }
  setInterval(pollTokens, 10000);
  setTimeout(pollTokens, 1000);

  btnStart.addEventListener('click', () => {
    const config = {
      backendUrl: backendUrlInput.value.trim(),
      chunkDuration
    };
    if (!config.backendUrl) return alert("Configure Backend URL in Settings.");
    chrome.runtime.sendMessage({ action: 'startRecording', config }, (res) => {
      if (chrome.runtime.lastError) {
        console.error("Start recording error:", chrome.runtime.lastError.message);
        alert("Error starting: " + chrome.runtime.lastError.message);
        return;
      }
      if (res && res.status === 'started') updateUI(true);
      else alert("Error: " + (res && res.message));
    });
  });

  btnStop.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stopRecording' }, () => {
      if (chrome.runtime.lastError) {
        console.error("Stop recording error:", chrome.runtime.lastError.message);
      }
      updateUI(false);
    });
  });

  function updateUI(isRecording) {
    if (isRecording) {
      btnStart.classList.add('hidden');
      btnStop.classList.remove('hidden');
    } else {
      btnStart.classList.remove('hidden');
      btnStop.classList.add('hidden');
    }
  }

  btnCapture.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'captureScreenshot' }, (res) => {
      if (chrome.runtime.lastError) {
        console.error("Screenshot error:", chrome.runtime.lastError.message);
        return;
      }
      if (res && res.dataUrl) {
        pendingScreenshot = res.dataUrl;
        btnCapture.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-50');
      }
    });
  });

  function showToast(message, type = 'warning') {
    const colors = {
      warning: { bg: '#fefce8', border: '#fde047', text: '#854d0e' },
      error:   { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
      success: { bg: '#f0fdf4', border: '#86efac', text: '#166534' }
    };
    const c = colors[type] || colors.warning;
    
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: ${c.bg}; border: 1px solid ${c.border}; color: ${c.text};
      padding: 10px 16px; border-radius: 8px; font-size: 11px; font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 9999;
      animation: slideIn 0.3s ease-out;
      max-width: 300px; text-align: center;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  port.onMessage.addListener((req) => {
    if (req.action === 'newNotePreview') {
      if (req.summary.startsWith('⏳')) {
        showToast(req.summary, 'warning');
      } else {
        addNoteToSidebar(req.summary);
      }
    }
  });

  function addNoteToSidebar(summary) {
    notes.unshift({
      id: Date.now(),
      text: summary,
      screenshot: pendingScreenshot,
      saved: false,
      time: new Date().toLocaleTimeString(),
      animating: true  // flag for typewriter animation
    });
    pendingScreenshot = null;
    btnCapture.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-50');
    renderNotes();
  }

  function typewriterAnimate(element, text, speed = 18) {
    element.textContent = '';
    
    // Add blinking cursor span
    const cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';
    cursor.textContent = '▍';
    element.appendChild(cursor);
    
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        // Insert character before cursor
        element.insertBefore(document.createTextNode(text[i]), cursor);
        i++;
        // Auto scroll to bottom of notes list
        // but if we are unshifting, newest is at the top. Let's scroll to top instead.
        notesList.scrollTop = 0;
      } else {
        clearInterval(interval);
        cursor.remove(); // Remove cursor when done
        element.classList.add('line-clamp-3');
      }
    }, speed);
  }

  function renderNotes() {
    notesList.innerHTML = '';
    notes.forEach((note) => {
      const div = document.createElement('div');
      div.className = 'note-card bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs relative overflow-hidden transition-all';
      
      const header = document.createElement('div');
      header.className = 'flex justify-between items-center mb-2';
      header.innerHTML = `<span class="font-bold text-[10px] text-slate-400 uppercase tracking-widest">${note.time}</span>
        ${note.saved ? '<span class="text-green-600 font-bold flex items-center gap-1.5"><span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Saved</span>' : '<span class="text-slate-400 font-medium">Draft</span>'}`;
      div.appendChild(header);

      if (note.screenshot) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'w-full h-24 rounded bg-slate-100 mb-2 border border-slate-100 overflow-hidden cursor-pointer';
        const img = document.createElement('img');
        img.src = note.screenshot;
        img.className = 'w-full h-full object-cover';
        imgContainer.onclick = () => {
           if(imgContainer.classList.contains('h-24')) {
             imgContainer.classList.remove('h-24');
             img.classList.remove('object-cover');
           } else {
             imgContainer.classList.add('h-24');
             img.classList.add('object-cover');
           }
        };
        imgContainer.appendChild(img);
        div.appendChild(imgContainer);
      }

      const content = document.createElement('div');
      content.className = 'note-text text-slate-700 leading-relaxed font-medium mb-2';

      if (note.animating) {
        // Start typewriter, mark as done after
        note.animating = false;
        typewriterAnimate(content, note.text, 18);
      } else {
        content.textContent = note.text;
        // Apply line clamp only after animation is done
        content.classList.add('line-clamp-3');
      }
      
      div.appendChild(content);

      if (note.text.length > 150) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'text-indigo-600 font-semibold w-full text-center py-1.5 mt-1 bg-indigo-50 rounded hover:bg-indigo-100 transition';
        toggleBtn.innerText = 'Expand';
        toggleBtn.onclick = () => {
          if (content.classList.contains('line-clamp-3')) {
            content.classList.remove('line-clamp-3');
            toggleBtn.innerText = 'Collapse';
          } else {
            content.classList.add('line-clamp-3');
            toggleBtn.innerText = 'Expand';
          }
        };
        div.appendChild(toggleBtn);
      }
      notesList.appendChild(div);
    });
  }

  btnSaveAll.addEventListener('click', async () => {
    const unsaved = notes.filter(n => !n.saved);
    if (!unsaved.length) return alert("No unsaved notes to sync.");
    
    const pageId = pageIdInput.value;
    const apiKey = notionApiKeyInput.value;
    const backend = backendUrlInput.value;
    
    if (!validatePageId(pageId) || !apiKey) return alert("Valid Notion Page ID and API Key required in Settings.");
    
    const originalText = btnSaveAll.innerText;
    btnSaveAll.disabled = true;
    btnSaveAll.innerText = 'Saving...';
    
    try {
      const res = await fetch(`${backend}/api/save-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notionApiKey: apiKey, notionPageId: pageId, notes: unsaved.reverse() }) // oldest first
      });
      if (res.ok) {
        unsaved.forEach(n => n.saved = true);
        renderNotes();
      } else {
        alert("Server error while saving.");
      }
    } catch(e) {
      alert("Network error.");
    } finally {
      btnSaveAll.disabled = false;
      btnSaveAll.innerText = originalText;
    }
  });
});
