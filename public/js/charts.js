/**
 * Chart.js Visualizations for Monitoring Frequency Evaluation
 * Cloud Computing Lab Practical Project
 */

let mttdChart = null;
let costChart = null;
let overheadChart = null;

function initEvaluationCharts(evalData) {
  if (!window.Chart) {
    console.warn('Chart.js not loaded');
    return;
  }

  const labels = evalData.map(d => d.label);
  const mttdValues = evalData.map(d => d.mttdSeconds);
  const costValues = evalData.map(d => d.awsCostMonthlyUsd);
  const checkCounts = evalData.map(d => d.checksPerMonth);
  const bandwidthMb = evalData.map(d => d.monthlyBandwidthMb);

  // 1. Mean Time to Detect (MTTD) Chart
  const ctxMttd = document.getElementById('chart-mttd');
  if (ctxMttd) {
    if (mttdChart) mttdChart.destroy();
    mttdChart = new Chart(ctxMttd, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Mean Time to Detect (Seconds)',
          data: mttdValues,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.15)',
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointBackgroundColor: '#06b6d4',
          pointRadius: 5,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af', font: { family: 'Inter' } } },
          tooltip: {
            callbacks: {
              label: (ctx) => `MTTD: ${ctx.raw} sec (${ctx.raw < 60 ? ctx.raw + 's' : (ctx.raw/60).toFixed(1) + ' min'})`
            }
          }
        },
        scales: {
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            ticks: { color: '#9ca3af' },
            title: { display: true, text: 'Detection Latency (Seconds)', color: '#9ca3af' }
          },
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#9ca3af' }
          }
        }
      }
    });
  }

  // 2. AWS Monthly Cost Chart
  const ctxCost = document.getElementById('chart-cost');
  if (ctxCost) {
    if (costChart) costChart.destroy();
    costChart = new Chart(ctxCost, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Estimated AWS Cost ($/month)',
          data: costValues,
          backgroundColor: [
            'rgba(244, 63, 94, 0.8)',
            'rgba(99, 102, 241, 0.8)',
            'rgba(6, 182, 212, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(107, 114, 128, 0.8)',
            'rgba(75, 85, 99, 0.8)'
          ],
          borderRadius: 6,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af', font: { family: 'Inter' } } },
          tooltip: {
            callbacks: {
              label: (ctx) => `Cost: $${ctx.raw.toFixed(3)} / month (CloudWatch + Lambda)`
            }
          }
        },
        scales: {
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            ticks: {
              color: '#9ca3af',
              callback: (val) => `$${val}`
            },
            title: { display: true, text: 'USD / Month', color: '#9ca3af' }
          },
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#9ca3af' }
          }
        }
      }
    });
  }

  // 3. Network Overhead & Invocations Chart
  const ctxOverhead = document.getElementById('chart-overhead');
  if (ctxOverhead) {
    if (overheadChart) overheadChart.destroy();
    overheadChart = new Chart(ctxOverhead, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Monthly Checks / Invocations',
          data: checkCounts,
          backgroundColor: 'rgba(99, 102, 241, 0.65)',
          borderColor: '#6366f1',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af', font: { family: 'Inter' } } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.raw.toLocaleString()} HTTP checks/month`
            }
          }
        },
        scales: {
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            ticks: {
              color: '#9ca3af',
              callback: (val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val
            },
            title: { display: true, text: 'Invocations / Month', color: '#9ca3af' }
          },
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#9ca3af' }
          }
        }
      }
    });
  }
}
