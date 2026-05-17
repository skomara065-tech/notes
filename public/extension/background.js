let isRecording = false;
let recordingTabId = null;
let recordingWindowId = null;

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id }).catch(console.error);
});

// Track sidepanel port for forwarding messages
let sidePanelPort = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    sidePanelPort = port;
    port.onDisconnect.addListener(() => {
      sidePanelPort = null;
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Forward newNotePreview from offscreen to sidepanel
  if (request.action === 'newNotePreview') {
    if (sidePanelPort) {
      sidePanelPort.postMessage(request);
    }
    return false;
  }

  if (request.action === 'startRecording') {
    handleStartRecording(request.config)
      .then(() => sendResponse({ status: 'started' }))
      .catch(e => sendResponse({ status: 'error', message: e.message }));
    return true;
  }

  if (request.action === 'stopRecording') {
    handleStopRecording()
      .then(() => sendResponse({ status: 'stopped' }))
      .catch(e => sendResponse({ status: 'error', message: e.message }));
    return true;
  }

  if (request.action === 'getStatus') {
    sendResponse({ isRecording });
    return false;
  }

  if (request.action === 'captureScreenshot') {
    handleScreenshot(sendResponse);
    return true;
  }
});

// Screenshot fix: inject a content script to draw the video frame to a canvas
// instead of using captureVisibleTab which conflicts with tabCapture stream
async function handleScreenshot(sendResponse) {
  try {
    if (!recordingTabId) {
      sendResponse({ error: 'No active recording tab found.' });
      return;
    }

    // Inject content script to capture video frame as base64
    const results = await chrome.scripting.executeScript({
      target: { tabId: recordingTabId },
      func: captureVideoFrame,
    });

    const dataUrl = results?.[0]?.result;

    if (dataUrl) {
      sendResponse({ dataUrl });
    } else {
      // Fallback: try captureVisibleTab on a different window
      chrome.tabs.captureVisibleTab(
        recordingWindowId,
        { format: 'png' },
        (url) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ dataUrl: url });
          }
        }
      );
    }
  } catch (e) {
    sendResponse({ error: e.message });
  }
}

// This function runs IN the tab page context via executeScript
function captureVideoFrame() {
  try {
    // Find the video element (works for YouTube and Udemy)
    const video = document.querySelector('video');
    if (!video) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch (e) {
    return null;
  }
}

function getStreamId(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(id);
      }
    });
  });
}

async function handleStartRecording(config) {
  if (isRecording) return;

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0) {
    throw new Error('No active tab found.');
  }

  const tab = tabs[0];
  recordingTabId = tab.id;
  recordingWindowId = tab.windowId;

  const streamId = await getStreamId(tab.id);

  let hasDoc = false;
  try {
    hasDoc = await chrome.offscreen.hasDocument();
  } catch (e) {
    hasDoc = false;
  }

  if (!hasDoc) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Recording tab audio for AI summarization'
    });
  }

  await chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'startRecording',
    streamId: streamId,
    backendUrl: config.backendUrl
  });

  isRecording = true;
  chrome.storage.local.set({ isRecording: true });
}

async function handleStopRecording() {
  if (!isRecording) return;

  try {
    await chrome.runtime.sendMessage({ target: 'offscreen', action: 'stopRecording' });
  } catch (e) {
    console.warn('Offscreen doc already closed:', e.message);
  }

  isRecording = false;
  recordingTabId = null;
  recordingWindowId = null;
  chrome.storage.local.set({ isRecording: false });
}
