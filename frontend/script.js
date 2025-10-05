// Updated UI logic for new styled layout
const video = document.getElementById('webcam');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

// New UI elements
const statusBadge = document.getElementById('statusBadge');
const recordingIndicator = document.getElementById('recordingIndicator');
const standbyPlaceholder = document.getElementById('standbyPlaceholder');
const sessionTimeEl = document.getElementById('sessionTime');
const sessionStatusText = document.getElementById('sessionStatusText');
const focusScoreValue = document.getElementById('focusScoreValue');
const focusProgressInner = document.getElementById('focusProgressInner');
const focusFeedbackText = document.getElementById('focusFeedbackText');

let stream = null;
let captureInterval = null;
let sessionTimer = null;
let focusInterval = null;
let sessionSeconds = 0;
let focusScore = 95;
let sessionId = null;

// set a user identifier (replace with real authenticated id in production)
const USER_ID = 'test-user';

const API_ENDPOINT = 'https://pkrk86y6r5.execute-api.us-west-1.amazonaws.com/default/ProcessFocusImage';

function formatTime(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function setRecordingUI(isRecording) {
  if (isRecording) {
    statusBadge.textContent = 'Recording';
    statusBadge.classList.remove('badge-secondary');
    statusBadge.classList.add('badge-default');
    recordingIndicator.style.display = 'flex';
    standbyPlaceholder.style.display = 'none';
    video.style.display = 'block';
    sessionStatusText.textContent = 'Active session';
  } else {
    statusBadge.textContent = 'Standby';
    statusBadge.classList.remove('badge-default');
    statusBadge.classList.add('badge-secondary');
    recordingIndicator.style.display = 'none';
    standbyPlaceholder.style.display = 'flex';
    video.style.display = 'none';
    sessionStatusText.textContent = 'Not recording';
  }
}

function startSessionTimers() {
  // Session time
  sessionTimer = setInterval(() => {
    sessionSeconds += 1;
    sessionTimeEl.textContent = formatTime(sessionSeconds);
  }, 1000);

  // Simulate focus score fluctuations
  focusInterval = setInterval(() => {
    const delta = (Math.random() - 0.5) * 2; // -1..1
    focusScore = Math.max(85, Math.min(100, focusScore + delta));
    const rounded = Math.round(focusScore);
    focusScoreValue.textContent = `${rounded}%`;
    focusProgressInner.style.width = `${rounded}%`;
    let feedback = 'Needs improvement';
    if (rounded >= 90) feedback = 'Excellent focus!';
    else if (rounded >= 75) feedback = 'Good focus';
    focusFeedbackText.textContent = feedback;
  }, 1000);
}

function stopSessionTimers() {
  if (sessionTimer) clearInterval(sessionTimer);
  if (focusInterval) clearInterval(focusInterval);
  sessionTimer = null;
  focusInterval = null;
}

// Start webcam and session
startBtn.onclick = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    // create a session id for this recording session
    sessionId = `${USER_ID}-${Date.now()}`;

    startBtn.disabled = true;
    stopBtn.disabled = false;
    sessionSeconds = 0;
    sessionTimeEl.textContent = '00:00:00';
    setRecordingUI(true);

    startSessionTimers();
    captureInterval = setInterval(captureAndSend, 5000); // every 5 seconds
  } catch (error) {
    console.error('Error accessing camera:', error);
    setRecordingUI(false);
    stopBtn.disabled = true;
    startBtn.disabled = false;
    sessionStatusText.textContent = 'Camera access denied';
  }
};

// Stop session
stopBtn.onclick = () => {
  if (captureInterval) clearInterval(captureInterval);
  captureInterval = null;
  stopSessionTimers();

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (video) video.srcObject = null;

  startBtn.disabled = false;
  stopBtn.disabled = true;
  setRecordingUI(false);
};

// Capture image and send to API
async function captureAndSend() {
  if (!video || !video.srcObject) return;
  // Guard against zero dimensions before metadata loads
  if (!video.videoWidth || !video.videoHeight) return;

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const base64Image = canvas.toDataURL('image/jpeg').split(',')[1]; // strip prefix

  const payload = {
    sessionId: sessionId,
    userId: USER_ID, // optional - kept for records
    timestamp: new Date().toISOString(),
    imageBase64: base64Image
  };

  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      console.error('Error sending image:', await res.text());
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}