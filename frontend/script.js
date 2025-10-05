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
let focusScore = 100;
let sessionId = null;
let manualFocusOverride = false;

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
  if (!statusBadge || !recordingIndicator || !standbyPlaceholder || !video || !sessionStatusText) return;
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

// Reflect focus score in UI
function updateFocusUI(score) {
  if (!focusScoreValue || !focusProgressInner || !focusFeedbackText) return;
  const rounded = Math.max(0, Math.min(100, Math.round(typeof score === 'number' ? score : 0)));
  focusScoreValue.textContent = `${rounded}%`;
  focusProgressInner.style.width = `${rounded}%`;
  let feedback = 'Needs improvement';
  if (rounded >= 90) feedback = 'Excellent focus!';
  else if (rounded >= 75) feedback = 'Good focus';
  focusFeedbackText.textContent = feedback;
}

function startSessionTimers() {
  if (sessionTimeEl) {
    sessionTimer = setInterval(() => {
      sessionSeconds += 1;
      sessionTimeEl.textContent = formatTime(sessionSeconds);
    }, 1000);
  }

  if (focusScoreValue && focusProgressInner && focusFeedbackText) {
    // Reflect the current focusScore value (no random simulation)
    focusInterval = setInterval(() => {
      if (manualFocusOverride) return;
      updateFocusUI(focusScore);
    }, 1000);
  }
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
if (startBtn) {
  startBtn.onclick = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (video) video.srcObject = stream;

      // create a session id for this recording session
      sessionId = `${USER_ID}-${Date.now()}`;

      startBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = false;
      sessionSeconds = 0;
      if (sessionTimeEl) sessionTimeEl.textContent = '00:00:00';
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
      if (stopBtn) stopBtn.disabled = true;
      startBtn.disabled = false;
      if (sessionStatusText) sessionStatusText.textContent = 'Camera access denied';
    }
  };
}

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

  const items = Array.isArray(tips) && tips.length
    ? tips.slice(0, 5)
    : ["No tips available yet. Try recording a longer session for more insights."];

  container.innerHTML = `
    <ul>${items.map(tip => `<li>${tip}</li>`).join('')}</ul>
  `;
}

// Stop session -> persist data and navigate to analytics page
if (stopBtn) {
  stopBtn.onclick = () => {
    if (captureInterval) clearInterval(captureInterval);
    captureInterval = null;
    stopSessionTimers();

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (video) video.srcObject = null;

    if (startBtn) startBtn.disabled = false;
    stopBtn.disabled = true;
    setRecordingUI(false);

    // Persist session data for analytics page
    try {
      sessionStorage.setItem('fc_emotionData', JSON.stringify(emotionData));
      sessionStorage.setItem('fc_currentEmotion', currentEmotion);
      if (sessionId) sessionStorage.setItem('fc_sessionId', sessionId);
      sessionStorage.setItem('fc_userId', USER_ID);
      sessionStorage.setItem('fc_sessionSeconds', String(sessionSeconds));
    } catch (e) {
      console.warn('Unable to persist session data:', e);
    }

    // Navigate to analytics page
    window.location.href = 'analytics.html';
  };
}

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
        
        // Update focus score from API if provided
        if (typeof result.focusScore === 'number') {
          focusScore = Math.max(0, Math.min(100, Math.round(result.focusScore)));
          updateFocusUI(focusScore);
        }
        
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
  
  // Modern, clean color palette
  const colors = {
    'CALM': '#10b981',      // emerald
    'HAPPY': '#f59e0b',     // amber
    'CONFUSED': '#6366f1',  // indigo
    'STRESSED': '#f43f5e',  // rose
    'SAD': '#0ea5e9',       // sky
    'ANGRY': '#ef4444',     // red
    'FEAR': '#8b5cf6',      // violet
    'DISGUSTED': '#14b8a6', // teal
    'SURPRISED': '#22d3ee', // cyan
    'UNKNOWN': '#94a3b8'    // slate
  };
  
  let pieHTML = '<div class="pie-chart-container">';
  
  // Create conic gradient for pie chart
  let cumulativeAngle = 0;
  let conicGradient = 'conic-gradient(';
  
  sortedEmotions.forEach(([emotion, count], index) => {
    const angle = (count / total) * 360;
    const color = colors[emotion] || '#94a3b8';
    conicGradient += `${color} ${cumulativeAngle}deg ${cumulativeAngle + angle}deg`;
    if (index < sortedEmotions.length - 1) conicGradient += ', ';
    cumulativeAngle += angle;
  });
  
  conicGradient += ')';
  
  // Donut without center number/label
  pieHTML += `
    <div class="pie-chart" style="background: ${conicGradient}"></div>
  `;
  
  pieHTML += '</div>';
  
  // Legend
  pieHTML += '<div class="pie-legend">';
  pieHTML += '<div class="legend-title">Most Common Emotions:</div>';
  
  sortedEmotions.forEach(([emotion, count]) => {
    const percentage = ((count / total) * 100).toFixed(1);
    const color = colors[emotion] || '#94a3b8';
    const isMostCommon = sortedEmotions.indexOf([emotion, count]) === 0;
    
    pieHTML += `
      <div class="legend-item ${isMostCommon ? 'most-common' : ''}">
        <span class="legend-color" style="background-color: ${color}"></span>
        <span class="legend-text">${emotion}</span>
        <span class="legend-count">${count} (${percentage}%)</span>
      </div>
    `;
  });
  
  pieHTML += '</div>'; // close legend
  
  // Update time (outside legend to span full width)
  pieHTML += `<div class="update-time">Last updated: ${new Date().toLocaleTimeString()}</div>`;
  
  pieHTML += '</div>';
  
  pieChartContainer.innerHTML = pieHTML;
}

// Create/update line chart for emotion trends
function updateEmotionLineChart() {
  const lineChartContainer = document.getElementById('emotionLineChart');
  if (!lineChartContainer) return;

  const maxPoints = 100; // plot up to last 100 points
  const recent = emotionData
    .filter(d => typeof d === 'object' && d && (typeof d.focusScore === 'number' || !isNaN(Number(d.focusScore))))
    .slice(-maxPoints);

  if (recent.length < 2) {
    lineChartContainer.innerHTML = '<p class="muted">Need more data points for trend chart</p>';
    return;
  }

  // Parse timestamps and scores
  let times = recent.map(d => {
    const t = d.timestamp instanceof Date ? d.timestamp.getTime() : Date.parse(d.timestamp);
    return Number.isFinite(t) ? t : NaN;
  });
  const scores = recent.map(d => {
    const v = Number(d.focusScore);
    return Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
  });

  // If no valid timestamps, synthesize at 5s intervals
  const hasValidTime = times.some(Number.isFinite);
  if (!hasValidTime) {
    times = recent.map((_, i) => i * 5000);
  } else {
    for (let i = 0; i < times.length; i++) {
      if (!Number.isFinite(times[i])) times[i] = i > 0 ? times[i - 1] + 5000 : Date.now();
    }
    const t0 = times[0];
    times = times.map(t => t - t0);
  }

  // Build SVG line chart (x=time, y=score)
  const width = 360;
  const height = 200;
  const padding = { left: 44, right: 16, top: 12, bottom: 40 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const timeMax = Math.max(...times);
  const xAt = (t) => padding.left + (timeMax > 0 ? (t / timeMax) * plotW : 0);
  const yAt = (s) => padding.top + (1 - s / 100) * plotH;

  // Points array
  const pts = times.map((t, i) => ({ x: xAt(t), y: yAt(scores[i]) }));

  // Build a smooth Catmull–Rom to Bezier path
  const alpha = 1; // 1 = Catmull-Rom, smaller < 1 gives tighter curves
  let pathD = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i > 0 ? pts[i - 1] : pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i + 2 < pts.length ? pts[i + 2] : p2;

    const c1x = p1.x + (p2.x - p0.x) / 6 * alpha;
    const c1y = p1.y + (p2.y - p0.y) / 6 * alpha;
    const c2x = p2.x - (p3.x - p1.x) / 6 * alpha;
    const c2y = p2.y - (p3.y - p1.y) / 6 * alpha;

    pathD += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }

  // Axis ticks
  const xTicks = 4; // 0%, 33%, 66%, 100%
  const xTickEls = [];
  for (let i = 0; i <= xTicks; i++) {
    const t = (timeMax / xTicks) * i;
    const x = xAt(t);
    const secs = Math.round(t / 1000);
    xTickEls.push(`
      <line x1="${x}" y1="${height - padding.bottom}" x2="${x}" y2="${height - padding.bottom + 4}" stroke="#cbd5e1"/>
      <text x="${x}" y="${height - padding.bottom + 16}" text-anchor="middle" class="chart-label">${secs}s</text>
    `);
  }

  const yTicks = [0, 50, 100];
  const yTickEls = yTicks.map(s => {
    const y = yAt(s);
    return `
      <line x1="${padding.left - 4}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#eef2f7"/>
      <text x="${padding.left - 8}" y="${y + 3}" text-anchor="end" class="chart-label">${s}</text>
    `;
  });

  const chartHTML = `
    <div class="line-chart">
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect x="${padding.left}" y="${padding.top}" width="${plotW}" height="${plotH}" fill="#ffffff" stroke="#e5e7eb" stroke-width="1"/>
        ${yTickEls.join('')}
        ${xTickEls.join('')}
        <path d="${pathD}" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
        <!-- Y axis label rotated -->
        <text x="${padding.left - 28}" y="${padding.top + plotH / 2}" transform="rotate(-90 ${padding.left - 28},${padding.top + plotH / 2})" text-anchor="middle" class="chart-label">Score</text>
        <!-- X axis label below axis -->
        <text x="${padding.left + plotW / 2}" y="${height - 8}" text-anchor="middle" class="chart-label">Time</text>
      </svg>
    </div>
  `;

  lineChartContainer.innerHTML = chartHTML;
}

// Mode toggle: Focus vs Super Focus
document.addEventListener('DOMContentLoaded', () => {
  const focusBtn = document.getElementById('modeFocus');
  const superBtn = document.getElementById('modeSuper');

  if (!focusBtn || !superBtn) return;

  function setMode(isSuper) {
    document.body.classList.toggle('super-focus-mode', !!isSuper);

    // Update active states
    if (isSuper) {
      superBtn.classList.add('active');
      superBtn.setAttribute('aria-selected', 'true');
      focusBtn.classList.remove('active');
      focusBtn.setAttribute('aria-selected', 'false');
    } else {
      focusBtn.classList.add('active');
      focusBtn.setAttribute('aria-selected', 'true');
      superBtn.classList.remove('active');
      superBtn.setAttribute('aria-selected', 'false');
    }
  }

  focusBtn.addEventListener('click', () => setMode(false));
  superBtn.addEventListener('click', () => setMode(true));
});

// Initialize analytics page if present
document.addEventListener('DOMContentLoaded', () => {
  const onAnalytics = !!document.getElementById('emotionPieChart');
  if (!onAnalytics) return;

  try {
    const stored = sessionStorage.getItem('fc_emotionData');
    if (stored) {
      const parsed = JSON.parse(stored);
      // ensure it is an array of objects
      if (Array.isArray(parsed)) {
        emotionData = parsed.map(item => ({ ...item }));
      }
    }
    const storedEmotion = sessionStorage.getItem('fc_currentEmotion');
    if (storedEmotion) currentEmotion = storedEmotion;
    const storedSessionId = sessionStorage.getItem('fc_sessionId');
    const storedUserId = sessionStorage.getItem('fc_userId') || USER_ID;

    // Populate Session Summary stats
    const statDurationEl = document.getElementById('statDuration');
    const statAvgFocusEl = document.getElementById('statAvgFocus');
    const statPerfBadgeEl = document.getElementById('statPerformanceBadge');

    // Duration
    const storedSecondsRaw = sessionStorage.getItem('fc_sessionSeconds');
    const storedSeconds = storedSecondsRaw ? parseInt(storedSecondsRaw, 10) : 0;
    if (statDurationEl) statDurationEl.textContent = formatTime(Number.isFinite(storedSeconds) ? storedSeconds : 0);

    // Use average focusScore value for summary
    if (statAvgFocusEl || statPerfBadgeEl) {
      const focusValues = Array.isArray(emotionData)
        ? emotionData
            .map(d => (typeof d.focusScore === 'number' ? d.focusScore : NaN))
            .filter(v => Number.isFinite(v))
        : [];

      const avg = focusValues.length
        ? Math.round(focusValues.reduce((a, b) => a + b, 0) / focusValues.length)
        : 0;
      if (statAvgFocusEl) statAvgFocusEl.textContent = `${avg}%`;

      if (statPerfBadgeEl) {
        let text = 'Needs Improvement';
        let cls = 'pill-danger';
        if (avg >= 90) { text = 'Excellent'; cls = 'pill-success'; }
        else if (avg >= 75) { text = 'Good'; cls = 'pill-info'; }
        else if (avg >= 60) { text = 'Fair'; cls = 'pill-warn'; }
        statPerfBadgeEl.textContent = text;
        statPerfBadgeEl.className = `pill ${cls}`;
      }
    }

    updateEmotionCharts();

    if (storedUserId && storedSessionId) {
      getSessionAdvice(storedUserId, storedSessionId);
    }
  } catch (e) {
    console.warn('Failed to restore analytics data:', e);
  }
});