const video = document.getElementById('webcam');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusText = document.getElementById('status');

let stream = null;
let captureInterval = null;
let sessionId = null;

// set a user identifier (replace with real authenticated id in production)
const USER_ID = 'test-user';

const API_ENDPOINT = 'https://pkrk86y6r5.execute-api.us-west-1.amazonaws.com/default/ProcessFocusImage';

// Start webcam and session
startBtn.onclick = async () => {
  stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

  // create a session id for this recording session
  sessionId = `${USER_ID}-${Date.now()}`;

  startBtn.disabled = true;
  stopBtn.disabled = false;
  statusText.textContent = 'Status: Recording...';

  captureInterval = setInterval(captureAndSend, 5000); // every 5 seconds
};

// Stop session
stopBtn.onclick = () => {
  clearInterval(captureInterval);
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusText.textContent = 'Status: Not recording';
};

// Capture image and send to API
async function captureAndSend() {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const base64Image = canvas.toDataURL('image/jpeg').split(',')[1]; // strip prefix

  const payload = {
    sessionId: sessionId,
    user_id: USER_ID,
    timestamp: new Date().toISOString(),
    imageBase64: base64Image
  };

  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      console.log('Image sent successfully');
    } else {
      console.error('Error sending image:', await res.text());
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
