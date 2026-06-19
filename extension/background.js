chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "open-audio-recorder",
    title: "🔴 Open GKroon Audio Recorder Panel",
    contexts: ["page"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-gkroon-audio-recorder") {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SERVER_OFFLINE") {
    chrome.action.setIcon({ path: { "16": "icon16_gray.png", "48": "icon48_gray.png" } });
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#868e96" });
    sendResponse({ success: true });
  }

  if (request.action === "SERVER_READY") {
    chrome.action.setIcon({ path: { "16": "icon16.png", "48": "icon48.png" } });
    chrome.action.setBadgeText({ text: "" });
    sendResponse({ success: true });
  }

  if (request.action === "START_CAPTURE") {
    // 1. Capture the target tab's internal mixing stream track
    chrome.tabCapture.getMediaStreamId({ targetTabId: sender.tab ? sender.tab.id : undefined }, async (streamId) => {
      if (!streamId) {
        // Fallback: capture active tab context if target ID is ambiguous
        chrome.tabCapture.capture({ audio: true, video: false }, async (stream) => {
          if (!stream) {
            sendResponse({ success: false, error: "Stream capture denied." });
            return;
          }
          // Pass native tracks directly to our background offscreen engine frame
          await startOffscreenAudioProcessing(streamId);
          sendResponse({ success: true });
        });
        return;
      }
      await startOffscreenAudioProcessing(streamId);
      sendResponse({ success: true });
    });
    return true; 
  }

  if (request.action === "STOP_CAPTURE") {
    stopOffscreenAudioProcessing().then(() => sendResponse({ success: true }));
    return true;
  }
});

async function startOffscreenAudioProcessing(streamId) {
  // Clear any pre-existing offscreen elements to prevent overlap collisions
  await stopOffscreenAudioProcessing();

  // Create an un-killable, hidden window frame dedicated to capturing audio data
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Processes the live tabCapture stream loop without incurring garbage collection.'
  });

  // Wake up the offscreen window and pass it the active stream token handle
  chrome.runtime.sendMessage({ action: "INIT_STREAM", streamId: streamId });
  chrome.action.setBadgeText({ text: "REC" });
  chrome.action.setBadgeBackgroundColor({ color: "#f03e3e" });
}

async function stopOffscreenAudioProcessing() {
  chrome.action.setBadgeText({ text: "" });
  try {
    // Completely dismantle the offscreen element to flush active memory heaps
    await chrome.offscreen.closeDocument();
  } catch (e) { /* Catch exceptions gracefully if document is already shut */ }
}

