let isRecording = false;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionIconClick: true }).catch((error) => console.error(error));
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startRecording') {
    handleStartRecording(request.config, sendResponse);
    return true; // Keep channel open for async response
  } else if (request.action === 'stopRecording') {
    handleStopRecording(sendResponse);
    return true; // Keep channel open for async response
  } else if (request.action === 'getStatus') {
    sendResponse({ isRecording });
    return false;
  } else if (request.action === 'captureScreenshot') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true;
  }
});

async function handleStartRecording(config, sendResponse) {
  try {
    await startRecording(config);
    sendResponse({ status: 'started' });
  } catch (e) {
    sendResponse({ status: 'error', message: e.message });
  }
}

async function handleStopRecording(sendResponse) {
  try {
    await stopRecording();
    sendResponse({ status: 'stopped' });
  } catch (e) {
    sendResponse({ status: 'error', message: e.message });
  }
}

async function startRecording(config) {
  if (isRecording) return;
  
  // We need to capture the current active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0) throw new Error("No active tab to capture.");
  const tab = tabs[0];

  // getMediaStreamId gives us a string to use in getUserMedia within the offscreen document
  const streamId = await new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(id);
      }
    });
  });

  // Setup offscreen document
  const hasOffscreen = await chrome.offscreen.hasDocument();
  if (!hasOffscreen) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Recording tab audio for AI summarization'
    });
  }

  // Send message to offscreen document to start recording
  await chrome.runtime.sendMessage({
    action: 'startOffscreenRecording',
    streamId: streamId,
    config: config
  });

  isRecording = true;
  await chrome.storage.local.set({ isRecording: true });
}

async function stopRecording() {
  if (!isRecording) return;
  
  try {
    await chrome.runtime.sendMessage({ action: 'stopOffscreenRecording' });
  } catch (e) {
    console.error("Offscreen doc may be closed", e);
  }
  
  isRecording = false;
  await chrome.storage.local.set({ isRecording: false });
}

