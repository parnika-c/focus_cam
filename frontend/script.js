const video = document.getElementById('webcam');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusText = document.getElementById('status');

let stream = null;
let captureInterval = null;

const API_ENDPOINT = 'https://your-api-id.execute-api.region.amazonaws.com/dev/focus'; // replace this

// Start webcam and session
startBtn.onclick = async () => {
  stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

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
    user_id: 'user123', // hardcoded or dynamic
    timestamp: new Date().toISOString(),
    image_base64: base64Image
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
