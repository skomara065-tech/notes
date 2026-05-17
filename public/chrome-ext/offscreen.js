// public/extension/offscreen.js

// Global variables to store setup state
let mediaRecorder;
let audioChunks = [];
let backendUrl = '';

// Listen for connection commands from background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  if (message.action === 'startRecording') {
    backendUrl = message.backendUrl;
    startCapture(message.streamId);
  } else if (message.action === 'stopRecording') {
    stopCapture();
  }
});

// Initialize audio context stream capture
function startCapture(streamId) {
  navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: false
  }).then((stream) => {
    // Audio track tracking initialization
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(audioContext.destination);

    // Setup recorder configuration properties
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      // Execute the async network pipeline
      sendAudioToBackend(audioBlob);
    };

    // Begin data chunk acquisition slice loops
    mediaRecorder.start();
  }).catch((err) => {
    console.error('Failed to capture tab audio:', err);
  });
}

function stopCapture() {
  console.log("🛑 stopCapture() function inside offscreen has been successfully triggered!");
  
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    // This tells us the media recorder successfully halted its recording loop
    console.log("MediaRecorder stopped safely."); 
  } else {
    console.warn("MediaRecorder was either not found or already inactive!");
  }
}

// ⚠️ THE ENTIRE FUNCTION DECLARED EXPLICITLY AS ASYNC ⚠️
async function sendAudioToBackend(audioBlob) {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'capture.webm');
    
    // Updated URL with bypass query parameter to avoid Chrome header block structures
    const response = await fetch(`${backendUrl}/api/process-audio?bypass=true`, {
      method: 'POST',
      body: formData
    });

    // Handle rate limit responses (429) cleanly
    if (response.status === 429) {
      const data = await response.json();
      console.warn('Rate limited:', data.error);
      chrome.runtime.sendMessage({ 
        action: 'newNotePreview', 
        summary: '⏳ Rate limit reached — waiting 60 seconds before processing next chunk...' 
      });
      return;
    }

    // Inspect if the server returned a plain text or unhandled crash description string
    if (!response.ok) {
      let errorText = `Server returned ${response.status}`;
      try {
        const rawBody = await response.text();
        errorText = rawBody; 

        if (rawBody.trim().startsWith('{') || rawBody.trim().startsWith('[')) {
          const errJson = JSON.parse(rawBody);
          if (errJson.error) errorText = errJson.error;
        }
      } catch (e) {
        // Safe execution boundary fallback
      }
       
      console.error("🔴 Server Refused Payload:", errorText);
      chrome.runtime.sendMessage({ 
        action: 'newNotePreview', 
        summary: `❌ Server Error: ${errorText}` 
      });
      return;
    }

    // Process structured notes if response status is OK
    const data = await response.json();
    if (data.success && data.summary) {
      chrome.runtime.sendMessage({ action: 'newNotePreview', summary: data.summary });
    }

  } catch (error) {
    console.error('Error sending audio:', error);
  }
}
