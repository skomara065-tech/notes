let mediaRecorder = null;
let recordedChunks = [];
let backendUrl = '';
let notionApiKey = '';
let notionPageId = '';

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'startOffscreenRecording') {
    backendUrl = request.config.backendUrl;
    notionApiKey = request.config.notionApiKey;
    notionPageId = request.config.notionPageId;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: request.streamId,
          }
        }
      });

      // To capture the tab audio WITHOUT muting it for the user, we have to play it back via a new Audio Context
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(audioCtx.destination); // Play it back so user still hears it

      const options = { mimeType: 'audio/webm;codecs=opus' };
      mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
        recordedChunks = [];
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        audioCtx.close();
        
        await sendAudioToBackend(audioBlob);
        
        // Close offscreen document to save resources
        window.close();
      };

      mediaRecorder.start();
    } catch (e) {
      console.error('Offscreen recording error:', e);
    }
  } else if (request.action === 'stopOffscreenRecording') {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    } else {
      window.close();
    }
  }
});

async function sendAudioToBackend(audioBlob) {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'capture.webm');
    formData.append('notionApiKey', notionApiKey);
    formData.append('notionPageId', notionPageId);
    
    // Using simple extension-level notification to show progress
    chrome.notifications.create({
      type: 'basic',
      title: 'Upload Started',
      message: 'Processing lecture notes...'
    });

    const response = await fetch(`${backendUrl}/api/process-audio`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    console.log("Success:", data);
  } catch (error) {
    console.error('Error sending audio:', error);
  }
}
