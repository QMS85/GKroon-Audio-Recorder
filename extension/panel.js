let ws = null;
let timerInterval = null;
let startTime = 0;
let totalBytesEncoded = 0;
const BYTES_PER_SECOND = 44100 * 2 * 2; 

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const timerDisplay = document.getElementById('timer');
const statusDisplay = document.getElementById('status');

function checkServerStatus() {
  const testWs = new WebSocket('ws://localhost:3000');
  testWs.onopen = () => {
    chrome.runtime.sendMessage({ action: "SERVER_READY" });
    statusDisplay.textContent = "Connected to Node.js server. Ready.";
    testWs.close();
  };
  testWs.onerror = () => {
    chrome.runtime.sendMessage({ action: "SERVER_OFFLINE" });
    statusDisplay.textContent = "🛑 Server offline! Start 'node server.js'";
  };
}

checkServerStatus();

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
  statusDisplay.textContent = "Flushing audio buffers and normalizing file...";

  chrome.runtime.sendMessage({ action: "STOP_CAPTURE" });

  setTimeout(() => {
    if (ws) {
      ws.close();
      ws = null;
    }
  }, 600); // 600ms safety padding flush to capture lagging packets securely
}

startBtn.addEventListener('click', () => {
  statusDisplay.textContent = "Opening stream socket connection...";
  ws = new WebSocket('ws://localhost:3000');

  ws.onopen = () => {
    chrome.runtime.sendMessage({ action: "SERVER_READY" });
    chrome.runtime.sendMessage({ action: "START_CAPTURE" }, (response) => {
      if (response && !response.success) {
        statusDisplay.textContent = "Capture Error: " + response.error;
        if (ws) ws.close();
        return;
      }
      
      startBtn.disabled = true;
      stopBtn.disabled = false;
      startTime = Date.now();
      timerInterval = setInterval(updateLiveMetrics, 250);
    });
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'SEGMENT_ROTATED') {
        startTime = Date.now();
      }
      if (data.type === 'PROCESSING_COMPLETE') {
         statusDisplay.textContent = "✅ Audio Saved to Device!";
         setTimeout(checkServerStatus, 2000);
      }
    } catch (e) { }
  };

  ws.onerror = () => {
    chrome.runtime.sendMessage({ action: "SERVER_OFFLINE" });
    statusDisplay.textContent = "Backend offline! Run node server.js first.";
    handleCleanStopState();
  };
});

stopBtn.addEventListener('click', handleCleanStopState);

// Receives continuous audio updates from our offscreen script frame and relays them to the backend server
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "AUDIO_DATA_RELAY" && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(message.buffer);
  }
});
