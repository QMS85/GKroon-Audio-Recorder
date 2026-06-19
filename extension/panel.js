let ws = null;
let timerInterval = null;
let startTime = 0;
let totalBytesEncoded = 0;
const BYTES_PER_SECOND = 44100 * 2 * 2; // 44100Hz * Stereo (2) * 16-bit (2 bytes)

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const timerDisplay = document.getElementById('timer');
const statusDisplay = document.getElementById('status');

function updateLiveMetrics() {
  const elapsed = Date.now() - startTime;
  const totalSeconds = Math.floor(elapsed / 1000);
  
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  
  timerDisplay.textContent = `${h}:${m}:${s}`;
  
  totalBytesEncoded = totalSeconds * BYTES_PER_SECOND;
  const currentMb = (totalBytesEncoded / (1024 * 1024)).toFixed(1);
  statusDisplay.textContent = `Streaming: ${currentMb} MB / 250 MB`;
}

function handleCleanStopState() {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    if (timerInterval) clearInterval(timerInterval);
    timerDisplay.textContent = "00:00:00";
    statusDisplay.textContent = "Flushing audio buffer and normalizing...";
  
    // 1. Tell background script to stop capturing audio immediately
    chrome.runtime.sendMessage({ action: "STOP_CAPTURE" });
  
    // 2. DELAY CLOSING: Wait 500ms to let the final data packets reach the server
    setTimeout(() => {
      statusDisplay.textContent = "Processing and Normalizing Audio File...";
      if (ws) {
        ws.close();
        ws = null;
      }
      // Check server availability to restore icon state colors
      setTimeout(checkServerStatus, 1500);
    }, 500); 
  }
  

startBtn.addEventListener('click', () => {
  statusDisplay.textContent = "Opening stream socket connection...";
  ws = new WebSocket('ws://localhost:3000');

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'SEGMENT_ROTATED') {
        // Reset the timer for the next 250 MB audio file segment
        startTime = Date.now();
      }
      if (data.type === 'PROCESSING_COMPLETE') {
        statusDisplay.textContent = "✅ Audio Saved to Device!";
        setTimeout(checkServerStatus, 2000);
      }
    } catch (e) { /* Bypass raw stream chunks safely */ }
  };

  ws.onerror = () => {
    statusDisplay.textContent = "Backend offline! Run node server.js first.";
    handleCleanStopState();
  };

  startBtn.disabled = true;
  stopBtn.disabled = false;
  startTime = Date.now();
  timerInterval = setInterval(updateLiveMetrics, 250);
});

stopBtn.addEventListener('click', handleCleanStopState);

// Forward raw live audio array streams from the background service worker to the Node.js WebSocket server
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "AUDIO_DATA" && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(message.buffer);
  }
});

