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

// Emotion tracking data
let emotionData = [];
let currentEmotion = 'UNKNOWN';
let chartUpdateInterval = null;

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
  if (chartUpdateInterval) clearInterval(chartUpdateInterval);
  sessionTimer = null;
  focusInterval = null;
  chartUpdateInterval = null;
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

    // Reset emotion data for new session
    emotionData = [];
    currentEmotion = 'UNKNOWN';
    updateEmotionDisplay();

    startSessionTimers();
    captureInterval = setInterval(captureAndSend, 5000); // every 5 seconds
    
  // Start chart update interval - updates every 5 seconds
  chartUpdateInterval = setInterval(() => {
    console.log('🔄 Auto-updating emotion pie chart...');
    updateEmotionCharts();
  }, 5000);
  } catch (error) {
    console.error('Error accessing camera:', error);
    setRecordingUI(false);
    stopBtn.disabled = true;
    startBtn.disabled = false;
    sessionStatusText.textContent = 'Camera access denied';
  }
};

const ADVICE_API = 'https://kvtfghplhf.execute-api.us-west-1.amazonaws.com/default/GenerateSessionAdvice';

async function getSessionAdvice(userId, sessionId) {
  try {
    const res = await fetch(ADVICE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, sessionId: sessionId })
    });

    if (!res.ok) {
      console.error("Advice fetch failed:", await res.text());
      return;
    }

    const data = await res.json();
    displayTips(data.tips);
  } catch (err) {
    console.error("Error getting advice:", err);
  }
}

function displayTips(tips) {
  const container = document.getElementById("tipsContainer");
  if (!container) return;

  container.innerHTML = `
    <h3>Session Tips</h3>
    <ul>${tips.map(tip => `<li>${tip}</li>`).join('')}</ul>
  `;
}

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

  // // Fetch session summary from your backend
  // const summary = await fetchSummary(USER_ID, sessionId);

  // // Then call your API that wraps Bedrock
  // const advice = await fetchAdviceFromBedrock(summary);

  // // Display the tips in your UI
  // displayAdviceToUser(advice);

  getSessionAdvice(USER_ID, sessionId);
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
    user_id: USER_ID,
    timestamp: new Date().toISOString(),
    imageBase64: base64Image
  };

  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.ok) {
      const result = await res.json();
      console.log('API Response:', result);
      
      // Store emotion data if available
      if (result.ok && result.emotionTop) {
        currentEmotion = result.emotionTop;
        emotionData.push({
          timestamp: new Date(),
          emotion: result.emotionTop,
          rawEmotion: result.emotionRaw,
          focusScore: result.focusScore
        });
        
        // Update emotion display
        updateEmotionDisplay();
        updateEmotionCharts();
      }
    } else {
      console.error('Error sending image:', await res.text());
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

// Update current emotion display
function updateEmotionDisplay() {
  const emotionElement = document.getElementById('currentEmotion');
  if (emotionElement) {
    emotionElement.textContent = currentEmotion;
    emotionElement.className = `emotion-badge emotion-${currentEmotion.toLowerCase()}`;
  }
}

// Update emotion charts
function updateEmotionCharts() {
  if (emotionData.length === 0) return;
  
  // Add visual feedback that chart is updating
  const pieChartContainer = document.getElementById('emotionPieChart');
  if (pieChartContainer) {
    pieChartContainer.style.opacity = '0.7';
    setTimeout(() => {
      pieChartContainer.style.opacity = '1';
    }, 200);
  }
  
  updateEmotionPieChart();
  updateEmotionLineChart();
}

// Create/update pie chart for emotion distribution
function updateEmotionPieChart() {
  const pieChartContainer = document.getElementById('emotionPieChart');
  if (!pieChartContainer) return;
  
  if (emotionData.length === 0) {
    pieChartContainer.innerHTML = '<p class="muted">No emotion data yet. Start recording to see emotions!</p>';
    return;
  }
  
  // Count emotions and sort by frequency (most common first)
  const emotionCounts = {};
  emotionData.forEach(item => {
    emotionCounts[item.emotion] = (emotionCounts[item.emotion] || 0) + 1;
  });
  
  // Sort emotions by count (most common first)
  const sortedEmotions = Object.entries(emotionCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 6); // Show top 6 most common emotions
  
  const total = emotionData.length;
  
  // Create pie chart using CSS conic-gradient
  const colors = {
    'CALM': '#4CAF50',
    'HAPPY': '#FFEB3B',
    'CONFUSED': '#FF9800',
    'STRESSED': '#F44336',
    'SAD': '#2196F3',
    'ANGRY': '#E91E63',
    'FEAR': '#9C27B0',
    'DISGUSTED': '#795548',
    'UNKNOWN': '#607D8B'
  };
  
  let pieHTML = '<div class="pie-chart-container">';
  
  // Create conic gradient for pie chart
  let cumulativeAngle = 0;
  let conicGradient = 'conic-gradient(';
  
  sortedEmotions.forEach(([emotion, count], index) => {
    const percentage = (count / total) * 100;
    const angle = (count / total) * 360;
    const color = colors[emotion] || '#607D8B';
    
    conicGradient += `${color} ${cumulativeAngle}deg ${cumulativeAngle + angle}deg`;
    if (index < sortedEmotions.length - 1) conicGradient += ', ';
    
    cumulativeAngle += angle;
  });
  
  conicGradient += ')';
  
  pieHTML += `
    <div class="pie-chart" style="background: ${conicGradient}"></div>
    <div class="pie-center">
      <div class="pie-center-text">${total}</div>
      <div class="pie-center-label">Total</div>
    </div>
  `;
  
  pieHTML += '</div>';
  
  // Add legend with most common emotions first
  pieHTML += '<div class="pie-legend">';
  pieHTML += '<div class="legend-title">Most Common Emotions:</div>';
  
  sortedEmotions.forEach(([emotion, count]) => {
    const percentage = ((count / total) * 100).toFixed(1);
    const color = colors[emotion] || '#607D8B';
    const isMostCommon = sortedEmotions.indexOf([emotion, count]) === 0;
    
    pieHTML += `
      <div class="legend-item ${isMostCommon ? 'most-common' : ''}">
        <span class="legend-color" style="background-color: ${color}"></span>
        <span class="legend-text">${emotion}</span>
        <span class="legend-count">${count} (${percentage}%)</span>
      </div>
    `;
  });
  
  // Show update timestamp
  pieHTML += `<div class="update-time">Last updated: ${new Date().toLocaleTimeString()}</div>`;
  
  pieHTML += '</div>';
  
  pieChartContainer.innerHTML = pieHTML;
}

// Create/update line chart for emotion trends
function updateEmotionLineChart() {
  const lineChartContainer = document.getElementById('emotionLineChart');
  if (!lineChartContainer) return;
  
  if (emotionData.length < 2) {
    lineChartContainer.innerHTML = '<p class="muted">Need more data points for trend chart</p>';
    return;
  }
  
  // Create simple line chart
  const maxPoints = 20; // Show last 20 points
  const recentData = emotionData.slice(-maxPoints);
  const emotions = ['CALM', 'HAPPY', 'CONFUSED', 'STRESSED', 'SAD', 'ANGRY', 'FEAR', 'DISGUSTED'];
  const colors = {
    'CALM': '#4CAF50',
    'HAPPY': '#FFEB3B', 
    'CONFUSED': '#FF9800',
    'STRESSED': '#F44336',
    'SAD': '#2196F3',
    'ANGRY': '#E91E63',
    'FEAR': '#9C27B0',
    'DISGUSTED': '#795548'
  };
  
  let chartHTML = '<div class="line-chart">';
  
  // Create SVG for line chart
  const width = 300;
  const height = 150;
  const padding = 20;
  
  chartHTML += `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#e0e0e0" stroke-width="0.5"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)"/>
  `;
  
  // Draw emotion lines
  emotions.forEach(emotion => {
    const emotionPoints = recentData.map((item, index) => {
      const x = padding + (index / (recentData.length - 1)) * (width - 2 * padding);
      const y = padding + (emotions.indexOf(item.emotion) / (emotions.length - 1)) * (height - 2 * padding);
      return `${x},${y}`;
    }).filter((point, index) => recentData[index].emotion === emotion);
    
    if (emotionPoints.length > 0) {
      const color = colors[emotion] || '#607D8B';
      chartHTML += `
        <polyline 
          points="${emotionPoints.join(' ')}" 
          fill="none" 
          stroke="${color}" 
          stroke-width="2"
          opacity="0.7"
        />
      `;
    }
  });
  
  // Add time labels
  chartHTML += `
    <text x="10" y="${height - 5}" class="chart-label" style="font-size: 10px;">Time →</text>
    <text x="5" y="15" class="chart-label" style="font-size: 10px;">Emotions</text>
  `;
  
  chartHTML += '</svg>';
  chartHTML += '</div>';
  
  lineChartContainer.innerHTML = chartHTML;
}