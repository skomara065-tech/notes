let isRecording = false;

chrome.sidePanel.setPanelBehavior({ openPanelOnActionIconClick: true });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startRecording') {
    startRecording(request.config).then(() => sendResponse({ status: 'started' })).catch(e => sendResponse({ status: 'error', message: e.message }));
    return true; // Keep channel open
  } else if (request.action === 'stopRecording') {
    stopRecording().then(() => sendResponse({ status: 'stopped' })).catch(e => sendResponse({ status: 'error', message: e.message }));
    return true;
  } else if (request.action === 'getStatus') {
    sendResponse({ isRecording });
  } else if (request.action === 'captureScreenshot') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      sendResponse({ dataUrl });
    });
    return true;
  }
});

async function startRecording(config) {
  if (isRecording) return;
  
  // We need to capture the current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab to capture.");

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
  if (await chrome.offscreen.hasDocument()) {
    console.log("Offscreen document already exists");
  } else {
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
  chrome.storage.local.set({ isRecording: true });
}

async function stopRecording() {
  if (!isRecording) return;
  
  await chrome.runtime.sendMessage({ action: 'stopOffscreenRecording' });
  
  isRecording = false;
  chrome.storage.local.set({ isRecording: false });
}
