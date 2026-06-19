// Automatically open the side panel dashboard when the user clicks the extension toolbar icon
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Relays system capture initialization tasks dynamically across isolated execution spaces
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_CAPTURE") {
    chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
      if (!stream) {
        sendResponse({ success: false, error: "Stream capture denied or inactive." });
        return;
      }

      // Create a globally accessible execution pointer window for our stream track object
      globalThis.capturedStream = stream;

      // Create an audio pipeline routing channel context to pass raw data arrays to the side panel
      const audioContext = new AudioContext({ sampleRate: 44100 });
      const source = audioContext.createMediaStreamSource(stream);
      const scriptProcessor = audioContext.createScriptProcessor(4096, 2, 2);

      // Keep tab sessions audible to your speakers while active
      const outputDestination = audioContext.createMediaStreamDestination();
      source.connect(outputDestination);
      const speakerFallbackNode = new Audio();
      speakerFallbackNode.srcObject = outputDestination.stream;
      speakerFallbackNode.play();

      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      scriptProcessor.onaudioprocess = (e) => {
        const left = e.inputBuffer.getChannelData(0);
        const right = e.inputBuffer.getChannelData(1);

        const interleaved = new Float32Array(left.length * 2);
        for (let i = 0; i < left.length; i++) {
          interleaved[i * 2] = left[i];
          interleaved[i * 2 + 1] = right[i];
        }

        // Send raw interleaved binary chunks to the open side panel script
        chrome.runtime.sendMessage({
          action: "AUDIO_DATA",
          buffer: interleaved.buffer
        }, { includeTlsChannelId: false }, () => {
          // Suppress errors if panel context drops out unexpectedly
          if (chrome.runtime.lastError) { /* No-Op */ }
        });
      };

      // Store memory cleanup references to invoke safely during termination
      globalThis.stopCaptureSequence = () => {
        scriptProcessor.disconnect();
        audioContext.close();
        stream.getTracks().forEach(track => track.stop());
      };

      sendResponse({ success: true });
    });
    return true; // Keep asynchronous channel connection maps open
  }

  if (request.action === "STOP_CAPTURE") {
    if (globalThis.stopCaptureSequence) {
      globalThis.stopCaptureSequence();
    }
    sendResponse({ success: true });
  }
});
