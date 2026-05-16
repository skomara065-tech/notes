let notes = [];
let pendingScreenshot = null;
let chunkDuration = '15';

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
      if (res && res.status === 'started') updateUI(true);
      else alert("Error: " + (res && res.message));
    });
  });

  btnStop.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stopRecording' }, () => updateUI(false));
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
      if (res && res.dataUrl) {
        pendingScreenshot = res.dataUrl;
        btnCapture.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-50');
      }
    });
  });

  chrome.runtime.onMessage.addListener((req) => {
    if (req.action === 'newNotePreview') {
      notes.unshift({
        id: Date.now(),
        text: req.summary,
        screenshot: pendingScreenshot,
        saved: false,
        time: new Date().toLocaleTimeString()
      });
      pendingScreenshot = null;
      btnCapture.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-50');
      renderNotes();
    }
  });

  function renderNotes() {
    notesList.innerHTML = '';
    notes.forEach((note) => {
      const div = document.createElement('div');
      div.className = 'bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs relative overflow-hidden transition-all';
      
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
      content.className = 'text-slate-700 leading-relaxed line-clamp-3 mb-2 font-medium';
      content.innerText = note.text;
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
