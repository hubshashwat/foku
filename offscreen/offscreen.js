// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'playNotification') {
        playAudio(message.source);
        sendResponse({ success: true });
        return true;
    }
});

async function playAudio(source) {
    try {
        // Use Web Audio API to generate a sound (No external file needed)
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Create an oscillator (sound source)
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        // Connect nodes: Oscillator -> Gain -> Output
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Sound configuration: "Ding" sound
        oscillator.type = 'sine'; // Smooth tone
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.exponentialRampToValueAtTime(1046.5, audioContext.currentTime + 0.1); // Slide up to C6

        // Volume envelope (Fade out)
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);

        // Play
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.8);

        // Log success
        setTimeout(() => {
            chrome.runtime.sendMessage({ action: 'log', data: 'Offscreen: Audio playing successfully (Generated)' });
        }, 800);

    } catch (error) {
        // Log error
        chrome.runtime.sendMessage({ action: 'log', data: 'Offscreen: Audio failed - ' + error.message });
    }
}
