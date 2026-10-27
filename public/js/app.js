/**
 * Core Application Controller
 * Automated Website Availability Monitoring on AWS
 * Cloud Computing Lab Practical Project
 */

let appState = {
  targets: [],
  settings: {},
  alerts: [],
  evaluations: [],
  activeTab: 'tab-monitor',
  schedulerRunning: false
};

// DOM Ready initialization
document.addEventListener('DOMContentLoaded', () => {
  initTabNavigation();
  initThemeToggle();
  initModalListeners();
  initSlaCalculator();
  fetchInitialData();
  logTerminal('System initialized. Ready for website availability monitoring.', 'info');

  // Select EventBridge as default node in architecture explorer
  if (typeof selectArchNode === 'function') {
    selectArchNode('lambda');
  }
});

// Terminal logging helper
function logTerminal(message, type = 'info') {
  const terminalBody = document.getElementById('terminal-log-body');
  if (!terminalBody) return;

  const now = new Date().toTimeString().split(' ')[0];
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  let typeClass = 'log-info';
  let prefix = '[INFO]';
  if (type === 'success') { typeClass = 'log-success'; prefix = '[OK]'; }
  else if (type === 'warn') { typeClass = 'log-warn'; prefix = '[WARN]'; }
  else if (type === 'error') { typeClass = 'log-error'; prefix = '[ALERT]'; }

  entry.innerHTML = `<span class="log-time">${now}</span> <span class="${typeClass}">${prefix} ${message}</span>`;
  terminalBody.prepend(entry);
}

// ----------------- Data Fetching -----------------
async function fetchInitialData() {
  try {
    const [targetsRes, alertsRes, evalRes] = await Promise.all([
      fetch('/api/targets'),
      fetch('/api/alerts'),
      fetch('/api/frequency-evaluation')
    ]);

    const targetsData = await targetsRes.json();
    const alertsData = await alertsRes.json();
    const evalData = await evalRes.json();

    appState.targets = targetsData.targets || [];
    appState.settings = targetsData.settings || {};
    appState.alerts = alertsData.alerts || [];
    appState.evaluations = evalData.evaluations || [];

    updateKpis(targetsData.summary);
    renderTargetsGrid();
    renderAlertsTable();
    renderEvaluationTable();
    updateStrikeVisualizer();

    if (typeof initEvaluationCharts === 'function' && appState.evaluations.length) {
      initEvaluationCharts(appState.evaluations);
    }

    logTerminal(`Loaded ${appState.targets.length} targets. CloudWatch metrics active.`, 'success');
  } catch (err) {
    console.error('Failed to load initial data:', err);
    logTerminal(`Backend connection error: ${err.message}`, 'error');
  }
}

// ----------------- KPI Cards Update -----------------
function updateKpis(summary) {
  if (!summary) return;
  document.getElementById('kpi-total-sites').innerText = summary.total;
  document.getElementById('kpi-healthy-sites').innerText = summary.up;
  document.getElementById('kpi-down-sites').innerText = summary.down;
  document.getElementById('kpi-avg-latency').innerText = `${summary.avgLatency} ms`;

  const alarmBadge = document.getElementById('header-alarm-indicator');
  if (alarmBadge) {
    if (summary.down > 0) {
      alarmBadge.innerHTML = `<span class="status-badge down"><i class="fas fa-exclamation-triangle"></i> ${summary.down} Alarm Active</span>`;
    } else {
      alarmBadge.innerHTML = `<span class="status-badge up"><i class="fas fa-check-circle"></i> All Systems Healthy</span>`;
    }
  }
}

// ----------------- Render Monitored Targets Grid -----------------
function renderTargetsGrid() {
  const container = document.getElementById('targets-grid-container');
  if (!container) return;

  if (appState.targets.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:3rem; color:var(--text-dim);">No websites monitored yet. Click "Add Website" to begin.</div>`;
    return;
  }

  container.innerHTML = appState.targets.map(t => {
    let statusClass = 'up';
    let statusIcon = 'fa-check-circle';
    if (t.status === 'DOWN') { statusClass = 'down'; statusIcon = 'fa-times-circle'; }
    else if (t.status === 'DEGRADED') { statusClass = 'degraded'; statusIcon = 'fa-exclamation-circle'; }

    return `
      <div class="endpoint-card" id="card-${t.id}">
        <div>
          <div class="endpoint-top">
            <div class="endpoint-info">
              <h3>${t.name}</h3>
              <a href="${t.url}" target="_blank" rel="noopener" class="endpoint-url">
                <i class="fas fa-external-link-alt"></i> ${t.url}
              </a>
            </div>
            <span class="status-badge ${statusClass}">
              <i class="fas ${statusIcon}"></i> ${t.status}
            </span>
          </div>

          <div class="endpoint-metrics">
            <div class="metric-col">
              <div class="metric-label">HTTP Code</div>
              <div class="metric-val" style="color: ${t.statusCode >= 200 && t.statusCode < 400 ? '#34d399' : '#f87171'}">
                ${t.statusCode || 'N/A'}
              </div>
            </div>
            <div class="metric-col">
              <div class="metric-label">Latency</div>
              <div class="metric-val" style="color:#06b6d4;">${t.latencyMs} ms</div>
            </div>
            <div class="metric-col">
              <div class="metric-label">Strikes</div>
              <div class="metric-val" style="color: ${t.consecutiveFailures > 0 ? '#f59e0b' : '#9ca3af'}">
                ${t.consecutiveFailures} / ${appState.settings.consecutiveFailureThreshold || 2}
              </div>
            </div>
          </div>
        </div>

        <div class="endpoint-actions">
          <div style="display:flex; gap:0.4rem;">
            <button class="btn btn-secondary btn-sm" onclick="runCheckForSingleTarget('${t.id}')" title="Run Health Check Now">
              <i class="fas fa-play"></i> Check
            </button>
            <button class="btn btn-danger btn-sm" onclick="openSimulateModal('${t.id}')" title="Simulate Failure Incident">
              <i class="fas fa-bug"></i> Test Failure
            </button>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="deleteTarget('${t.id}')" title="Remove URL">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ----------------- Health Check Actions -----------------
async function runCheckForSingleTarget(targetId) {
  const btn = event?.currentTarget;
  if (btn) btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

  logTerminal(`Triggering immediate health check for target ID: ${targetId}...`, 'info');

  try {
    const res = await fetch('/api/check-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId })
    });
    const data = await res.json();
    logTerminal(`Check complete for ${data.target.name}: HTTP ${data.target.statusCode} in ${data.target.latencyMs}ms. Status: ${data.target.status}`, data.target.status === 'UP' ? 'success' : 'error');
    await fetchInitialData();
  } catch (err) {
    logTerminal(`Check failed: ${err.message}`, 'error');
  } finally {
    if (btn) btn.innerHTML = `<i class="fas fa-play"></i> Check`;
  }
}

async function triggerAllChecks() {
  const triggerBtn = document.getElementById('btn-trigger-all');
  if (triggerBtn) triggerBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Running Checks...`;

  logTerminal(`[EventBridge Trigger] Executing scheduled batch health checks across all endpoints...`, 'info');

  try {
    const res = await fetch('/api/check-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    logTerminal(`Batch checks finished. ${data.results?.length || 0} endpoints verified. CloudWatch metrics pushed.`, 'success');
    await fetchInitialData();
  } catch (err) {
    logTerminal(`Batch check execution error: ${err.message}`, 'error');
  } finally {
    if (triggerBtn) triggerBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Trigger All Checks`;
  }
}

// ----------------- Failure Simulation -----------------
let activeSimulateTargetId = null;

function openSimulateModal(targetId) {
  activeSimulateTargetId = targetId;
  const target = appState.targets.find(t => t.id === targetId);
  if (!target) return;

  document.getElementById('sim-target-name').innerText = target.name;
  document.getElementById('modal-simulate').classList.add('active');
}

async function executeSimulatedFailure(failureType) {
  if (!activeSimulateTargetId) return;

  logTerminal(`Simulating failure mode: ${failureType} on target ${activeSimulateTargetId}...`, 'warn');

  try {
    const res = await fetch('/api/simulate-failure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: activeSimulateTargetId, failureType })
    });
    const data = await res.json();
    closeModals();
    await fetchInitialData();

    if (failureType === 'RECOVER_NORMAL') {
      logTerminal(`Target restored to 200 OK. Alarm cleared and SNS Recovery notification generated.`, 'success');
    } else {
      logTerminal(`Failure applied! Consecutive strikes: ${data.target.consecutiveFailures}. Alarm state: ${data.target.alarmState}`, 'error');
    }
  } catch (err) {
    logTerminal(`Simulation error: ${err.message}`, 'error');
  }
}

// ----------------- Failure Strike State Visualizer -----------------
function updateStrikeVisualizer() {
  const failingTarget = appState.targets.find(t => t.status === 'DOWN' || t.consecutiveFailures > 0) || appState.targets[0];
  if (!failingTarget) return;

  const nodeNormal = document.getElementById('strike-node-normal');
  const nodeStrike1 = document.getElementById('strike-node-s1');
  const nodeAlarm = document.getElementById('strike-node-alarm');
  const strikeText = document.getElementById('strike-explainer-text');

  if (!nodeNormal || !nodeStrike1 || !nodeAlarm) return;

  nodeNormal.classList.remove('active-node');
  nodeStrike1.classList.remove('active-node');
  nodeAlarm.classList.remove('active-node');

  if (failingTarget.consecutiveFailures === 0) {
    nodeNormal.classList.add('active-node');
    if (strikeText) strikeText.innerHTML = `<strong>State: OK</strong> — Target <code>${failingTarget.name}</code> responding with HTTP 200 OK. CloudWatch Metric <code>Availability = 1</code>. No alarms active.`;
  } else if (failingTarget.consecutiveFailures === 1) {
    nodeStrike1.classList.add('active-node');
    if (strikeText) strikeText.innerHTML = `<strong>State: PENDING ALARM (Strike 1)</strong> — First failure detected on <code>${failingTarget.name}</code>. CloudWatch Alarm evaluates <code>DatapointsToAlarm = 2</code>. Alarm suppresses false positive; no SNS alert dispatched yet.`;
  } else {
    nodeAlarm.classList.add('active-node');
    if (strikeText) strikeText.innerHTML = `<strong>State: ALARM BREACH (Strike 2)</strong> — Consecutive failures threshold met (2/2 periods). CloudWatch Alarm entered <code>ALARM</code> state. Amazon SNS Topic triggered, email dispatch confirmed!`;
  }
}

// ----------------- Alerts & SNS Notifications -----------------
function renderAlertsTable() {
  const tbody = document.getElementById('alerts-table-body');
  if (!tbody) return;

  if (appState.alerts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:2rem;">No incident alerts logged yet. Systems operational.</td></tr>`;
    return;
  }

  tbody.innerHTML = appState.alerts.map(a => {
    const isOutage = a.type === 'OUTAGE_CRITICAL';
    const badge = isOutage
      ? `<span class="status-badge down"><i class="fas fa-radiation-alt"></i> OUTAGE</span>`
      : `<span class="status-badge up"><i class="fas fa-check-double"></i> RECOVERED</span>`;

    return `
      <tr>
        <td>${badge}</td>
        <td><strong>${a.targetName}</strong><br><span style="font-size:0.75rem; color:#06b6d4;">${a.url}</span></td>
        <td><span style="font-family:'JetBrains Mono'; font-weight:700; color:${isOutage ? '#f87171' : '#34d399'};">${a.statusCode}</span></td>
        <td>${new Date(a.timestamp).toLocaleString()}</td>
        <td style="max-width:240px; font-size:0.8rem; color:#9ca3af;">${a.message}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="previewSnsEmail('${a.id}')">
            <i class="fas fa-envelope-open-text"></i> View SNS Email
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function previewSnsEmail(alertId) {
  const alert = appState.alerts.find(a => a.id === alertId) || appState.alerts[0];
  if (!alert) return;

  const isOutage = alert.type === 'OUTAGE_CRITICAL';
  const modalSubject = document.getElementById('sns-preview-subject');
  const modalBody = document.getElementById('sns-preview-body');
  const modalTimestamp = document.getElementById('sns-preview-timestamp');

  if (modalSubject) {
    modalSubject.innerText = isOutage
      ? `AWS Incident Alert: CRITICAL - Monitored Website DOWN (${alert.url})`
      : `AWS Incident Alert: RESOLVED - Monitored Website RECOVERED (${alert.url})`;
    modalSubject.style.color = isOutage ? '#dc2626' : '#059669';
  }

  if (modalTimestamp) {
    modalTimestamp.innerText = `Received via Amazon SNS on ${new Date(alert.timestamp).toUTCString()}`;
  }

  if (modalBody) {
    modalBody.innerText = isOutage ? `
============================================================
AWS CLOUD MONITORING: WEBSITE OUTAGE INCIDENT DETECTED
============================================================

You are receiving this notification because the CloudWatch Alarm "WebsiteDownAlarm" 
has transitioned to the ALARM state.

Incident Summary:
-----------------
Target Website:       ${alert.url}
Target Name:          ${alert.targetName}
HTTP Status Code:     ${alert.statusCode}
Round-Trip Latency:   ${alert.latencyMs} ms
Consecutive Failures: ${alert.consecutiveFailures} period(s)
Incident Timestamp:   ${alert.timestamp}

AWS Cloud Pipeline Details:
- Scheduler:          Amazon EventBridge (rate 5m)
- Health Checker:     AWS Lambda (Python 3.12)
- CloudWatch Metric:  WebsiteMonitoring/Availability == 0
- Threshold:          Availability < 1 for 2 consecutive periods
- Notification Topic: ${alert.snsTopicArn}

Recommended Action:
Verify server availability, review Application Load Balancer target group health, 
and check web server logs.
============================================================
` : `
============================================================
AWS CLOUD MONITORING: WEBSITE INCIDENT RESOLVED
============================================================

The CloudWatch Alarm "WebsiteDownAlarm" has returned to the OK state.

Recovery Summary:
-----------------
Target Website:       ${alert.url}
Target Name:          ${alert.targetName}
Current HTTP Code:    200 OK
Round-Trip Latency:   ${alert.latencyMs} ms
Resolved Timestamp:   ${alert.timestamp}

AWS Cloud Pipeline Details:
- Availability metric restored to 1.0 (Healthy)
- Consecutive strikes reset to 0
- Incident status: RESOLVED

Service has returned to normal operational limits.
============================================================
`;
  }

  document.getElementById('modal-sns-preview').classList.add('active');
}

// ----------------- Monitoring Frequency Evaluation Table -----------------
function renderEvaluationTable() {
  const tbody = document.getElementById('eval-table-body');
  if (!tbody || !appState.evaluations.length) return;

  tbody.innerHTML = appState.evaluations.map(e => `
    <tr>
      <td><strong>${e.label}</strong></td>
      <td><span style="font-family:'JetBrains Mono'; font-weight:700; color:#06b6d4;">${e.mttdFormatted}</span></td>
      <td>${e.checksPerMonth.toLocaleString()} checks</td>
      <td><strong style="color:#10b981;">$${e.awsCostMonthlyUsd.toFixed(3)}</strong> / mo</td>
      <td>${e.monthlyBandwidthMb} MB</td>
      <td><span style="font-size:0.75rem; color:${e.riskScore > 50 ? '#f43f5e' : '#10b981'}; font-weight:600;">${e.falsePositiveRisk}</span></td>
      <td><span class="badge-rec">${e.recommendation}</span></td>
    </tr>
  `).join('');
}

// ----------------- SLA Calculator -----------------
function initSlaCalculator() {
  const slider = document.getElementById('sla-slider');
  const valDisplay = document.getElementById('sla-display-val');
  const allowedDowntime = document.getElementById('sla-allowed-downtime');
  const recommendedFreq = document.getElementById('sla-recommended-freq');
  const reasonText = document.getElementById('sla-reason-text');

  if (!slider) return;

  function update() {
    const val = parseFloat(slider.value);
    if (valDisplay) valDisplay.innerText = `${val.toFixed(2)}%`;

    // 30 days = 43,200 minutes
    const totalMinutes = 43200;
    const downtimeMinutes = (1 - val / 100) * totalMinutes;

    let downtimeFormatted = '';
    if (downtimeMinutes < 1) {
      downtimeFormatted = `${(downtimeMinutes * 60).toFixed(0)} seconds / month`;
    } else if (downtimeMinutes < 60) {
      downtimeFormatted = `${downtimeMinutes.toFixed(1)} minutes / month`;
    } else {
      downtimeFormatted = `${(downtimeMinutes / 60).toFixed(1)} hours / month`;
    }

    if (allowedDowntime) allowedDowntime.innerText = downtimeFormatted;

    if (val >= 99.99) {
      if (recommendedFreq) recommendedFreq.innerText = '1 Minute (or 30 Seconds)';
      if (reasonText) reasonText.innerText = 'With only ~4.3 minutes of allowable monthly downtime, any outage undetected for >2 minutes violates the SLA contract. High-frequency checking is mandatory.';
    } else if (val >= 99.9) {
      if (recommendedFreq) recommendedFreq.innerText = '3 Minutes to 5 Minutes';
      if (reasonText) reasonText.innerText = 'Allowable downtime is ~43.2 minutes. A 5-minute check cycle detects outages in ~2.5 minutes on average, leaving ample response time while minimizing AWS Lambda costs.';
    } else if (val >= 99.0) {
      if (recommendedFreq) recommendedFreq.innerText = '10 Minutes to 15 Minutes';
      if (reasonText) reasonText.innerText = 'Allowable downtime is ~7.2 hours. Lower frequency reduces server load and compute invocations with minimal SLA risk.';
    } else {
      if (recommendedFreq) recommendedFreq.innerText = '30 Minutes to 60 Minutes';
      if (reasonText) reasonText.innerText = 'Internal or non-critical documentation servers where uptime is best-effort.';
    }
  }

  slider.addEventListener('input', update);
  update();
}

// ----------------- Add Target & Delete -----------------
async function submitAddTarget() {
  const name = document.getElementById('new-target-name').value.trim();
  const url = document.getElementById('new-target-url').value.trim();

  if (!url) {
    alert('Please enter a valid website URL.');
    return;
  }

  try {
    const res = await fetch('/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url })
    });
    if (res.ok) {
      closeModals();
      document.getElementById('new-target-name').value = '';
      document.getElementById('new-target-url').value = '';
      logTerminal(`Added new target: ${name || url}`, 'success');
      await fetchInitialData();
    }
  } catch (err) {
    alert('Error adding target: ' + err.message);
  }
}

async function deleteTarget(id) {
  if (!confirm('Are you sure you want to remove this monitored website?')) return;
  try {
    await fetch(`/api/targets/${id}`, { method: 'DELETE' });
    logTerminal(`Removed target ${id}`, 'warn');
    await fetchInitialData();
  } catch (err) {
    console.error('Delete error:', err);
  }
}

// ----------------- Tab Navigation -----------------
function initTabNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetPanelId = tab.getAttribute('data-target');
      const targetPanel = document.getElementById(targetPanelId);
      if (targetPanel) targetPanel.classList.add('active');

      // Refresh charts if frequency evaluation tab is opened
      if (targetPanelId === 'tab-evaluation' && appState.evaluations.length) {
        setTimeout(() => {
          if (typeof initEvaluationCharts === 'function') {
            initEvaluationCharts(appState.evaluations);
          }
        }, 100);
      }
    });
  });
}

// ----------------- Theme Toggle -----------------
function initThemeToggle() {
  const toggleBtn = document.getElementById('btn-theme-toggle');
  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    toggleBtn.innerHTML = newTheme === 'light' ? `<i class="fas fa-moon"></i>` : `<i class="fas fa-sun"></i>`;
  });
}

// ----------------- Modal Controls -----------------
function initModalListeners() {
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModals();
    }
  });
}

function openAddTargetModal() {
  document.getElementById('modal-add-target').classList.add('active');
}

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

// ----------------- Local Python Lambda Runner -----------------
async function runLocalLambdaVerification() {
  logTerminal(`Executing aws/lambda_function.py with Python 3 runtime locally...`, 'info');
  try {
    const res = await fetch('/api/run-lambda-locally', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      logTerminal(`Local Lambda execution succeeded! Output:`, 'success');
      console.log('Lambda output:', data.stdout);
      alert('Local Python Lambda executed successfully!\nCheck terminal log for output.');
    } else {
      logTerminal(`Python script exited with code ${data.exitCode}: ${data.stderr}`, 'warn');
      alert(`Python execution output:\n${data.stdout || data.stderr}`);
    }
  } catch (err) {
    logTerminal(`Could not invoke Python: ${err.message}`, 'error');
  }
}
