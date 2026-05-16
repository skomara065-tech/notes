let stream = null;
let audioCtx = null;
let backendUrl = '';
let isRecordingOffscreen = false;

let recorderA = null;
let recorderB = null;
let chunkDurationMs = 30000;
let overlapMs = 500;
let loopTimeout = null;
let overlapTimeout = null;

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'startOffscreenRecording') {
    backendUrl = request.config.backendUrl;
    let dur = parseInt(request.config.chunkDuration);
    if (dur > 0) chunkDurationMs = dur * 1000;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: request.streamId,
          }
        }
      });

      audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(audioCtx.destination); 

      isRecordingOffscreen = true;
      startRollingLoop();
    } catch (e) {
      console.error('Offscreen recording error:', e);
    }
  } else if (request.action === 'stopOffscreenRecording') {
    isRecordingOffscreen = false;
    clearTimeout(loopTimeout);
    clearTimeout(overlapTimeout);
    
    if (recorderA && recorderA.state !== 'inactive') recorderA.stop();
    if (recorderB && recorderB.state !== 'inactive') recorderB.stop();
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (audioCtx) audioCtx.close();
  }
});

function createRecorder(label) {
  const options = { mimeType: 'audio/webm;codecs=opus' };
  const rec = new MediaRecorder(stream, options);
  let chunks = [];
  rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    if (blob.size > 0 && isRecordingOffscreen) {
      sendAudioToBackend(blob);
    }
  };
  return rec;
}

function startRollingLoop() {
  recorderA = createRecorder('A');
  recorderA.start();
  scheduleNextOverlap(recorderA, 'B');
}

function scheduleNextOverlap(currentRec, nextLabel) {
  loopTimeout = setTimeout(() => {
    if (!isRecordingOffscreen) return;
    
    const nextRec = createRecorder(nextLabel);
    nextRec.start();
    
    if (nextLabel === 'A') recorderA = nextRec;
    else recorderB = nextRec;
    
    overlapTimeout = setTimeout(() => {
      if (!isRecordingOffscreen) return;
      currentRec.stop();
      scheduleNextOverlap(nextRec, nextLabel === 'A' ? 'B' : 'A');
    }, overlapMs);
    
  }, chunkDurationMs - overlapMs);
}

async function sendAudioToBackend(audioBlob) {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'capture.webm');
    
    const response = await fetch(`${backendUrl}/api/process-audio`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    
    const data = await response.json();
    if (data.success && data.summary) {
       chrome.runtime.sendMessage({ action: 'newNotePreview', summary: data.summary });
    }
  } catch (error) {
    console.error('Error sending audio:', error);
  }
}
