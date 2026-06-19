let audioContext;
let scriptProcessor;
let mediaStream;

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.action === "INIT_STREAM") {
    try {
      // Connect to the tab capture stream using the token ID passed from the service worker
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: message.streamId
          }
        }
      });

      audioContext = new AudioContext({ sampleRate: 44100 });
      const source = audioContext.createMediaStreamSource(mediaStream);
      scriptProcessor = audioContext.createScriptProcessor(4096, 2, 2);

      // Keep tab sound routing audible to local hardware speakers
      source.connect(audioContext.destination);

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

        // Forward the raw, unbroken audio data packets straight to the open panel script
        chrome.runtime.sendMessage({
          action: "AUDIO_DATA_RELAY",
          buffer: interleaved.buffer
        });
      };
    } catch (err) {
      console.error("Offscreen capture failure:", err);
    }
  }
});

// Automatically releases audio hardware resources when the document context drops
window.addEventListener('unload', () => {
  if (scriptProcessor) scriptProcessor.disconnect();
  if (audioContext) audioContext.close();
  if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
});

