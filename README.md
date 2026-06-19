# GKroon-Audio-Recorder

## 🎧 Professional Tab Audio Recorder & Normalizer Server

A high-fidelity browser side-panel tool and server system for capturing, auto-segmenting, and volume-normalizing internal web browser audio from any third-party website into production-ready **16-bit, 44.1 kHz, Lossless Stereo WAV** files.

## ✨ Core System Features
* **Persistent Side Panel UI:** Runs inside Chrome's Side Panel, staying visible on screen even when clicking webpage content, changing tabs, or pressing player buttons.
* **True Third-Party Capturing:** Uses `chrome.tabCapture` to grab raw audio directly from the browser's mixing engine, keeping out microphone and room noise.
* **Lossless Audio Quality:** Encodes to standard 16-bit PCM at a 44.1 kHz sample rate in a true Stereo layout.
* **Zero-Loss Auto-Segmentation:** Automatically segments recordings at the **250 MB boundary line** without dropping any samples during the file-splitting process.
* **Automated Peak Volume Normalization:** Uses an internal FFmpeg module subprocess to evaluate peak audio level thresholds and maximize volume output for clean acoustics.

---

## 🛠️ Complete Installation Guide

### 1. Configure the Backend Node.js Server
Ensure you have [Node.js](https://nodejs.org) installed. Open your VS Code Terminal, change to the project directory, and run:

```bash
# Move into the project directory
cd tab-audio-recorder

# Install dependencies (ws, node-wav, ffmpeg-static)
npm install

# Start the background socket receiver server
node server.js
```
The console will log: `🚀 Node.js Audio receiver listening on ws://localhost:3000`

### 2. Install the Chrome Browser Extension
1. Open Google Chrome and go to `chrome://extensions/`.
2. Toggle the **Developer mode** switch in the upper-right corner to **ON**.
3. Click the **Load unpacked** button in the upper-left corner.
4. Select the `extension/` folder inside the `tab-audio-recorder/` project directory.
5. Pin the extension tool to your extensions toolbar for quick access.

---

## 🚀 Recording Steps

1. Open any tab in Chrome and load your audio track (e.g., YouTube, Spotify).
2. Click the extension toolbar icon. **The Chrome Side Panel will open on the side of your screen.**
3. Click **Start Recording Tab**. The timer display and data size limits will update live in real time.
4. Interact with your webpage normally (click play, change video runtime settings). The recording will continue uninterrupted.
5. Click **Stop & Normalize** when finished. The processed `.wav` files will appear inside your local server directory.

---

## Author:  
Jonathan Peters 

## ⚖️ License
This project is open-source software licensed under the terms of the [MIT License](https://opensource.org).
