document.addEventListener('DOMContentLoaded', () => {
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const backendUrlInput = document.getElementById('backendUrl');
  const notionApiKeyInput = document.getElementById('notionApiKey');
  const notionPageIdInput = document.getElementById('notionPageId');
  const statusText = document.getElementById('statusText');

  // Load saved config and status
  chrome.storage.local.get(['backendUrl', 'notionApiKey', 'notionPageId', 'isRecording'], (data) => {
    if (data.backendUrl) backendUrlInput.value = data.backendUrl;
    if (data.notionApiKey) notionApiKeyInput.value = data.notionApiKey;
    if (data.notionPageId) notionPageIdInput.value = data.notionPageId;
    
    updateUI(data.isRecording || false);
  });

  // Start button
  btnStart.addEventListener('click', () => {
    const config = {
      backendUrl: backendUrlInput.value.trim(),
      notionApiKey: notionApiKeyInput.value.trim(),
      notionPageId: notionPageIdInput.value.trim()
    };

    if (!config.backendUrl || !config.notionApiKey || !config.notionPageId) {
      alert("Please fill in all configuration fields.");
      return;
    }

    // Save config
    chrome.storage.local.set(config);

    btnStart.disabled = true;
    chrome.runtime.sendMessage({ action: 'startRecording', config }, (response) => {
      if (response && response.status === 'started') {
        updateUI(true);
      } else {
        btnStart.disabled = false;
        alert("Error: " + (response && response.message ? response.message : "Could not start."));
      }
    });
  });

  // Stop button
  btnStop.addEventListener('click', () => {
    btnStop.disabled = true;
    statusText.innerHTML = "Processing audio...";
    
    chrome.runtime.sendMessage({ action: 'stopRecording' }, (response) => {
      btnStop.disabled = false;
      updateUI(false);
      statusText.innerHTML = "Processing and saving to Notion...";
    });
  });

  function updateUI(isRecording) {
    if (isRecording) {
      btnStart.style.display = 'none';
      btnStop.style.display = 'block';
      statusText.innerHTML = '<div class="pulse"></div>Recording tab audio...';
      backendUrlInput.disabled = true;
      notionApiKeyInput.disabled = true;
      notionPageIdInput.disabled = true;
    } else {
      btnStart.style.display = 'block';
      btnStop.style.display = 'none';
      statusText.innerHTML = 'Idle. Click start to begin.';
      backendUrlInput.disabled = false;
      notionApiKeyInput.disabled = false;
      notionPageIdInput.disabled = false;
    }
  }
});
