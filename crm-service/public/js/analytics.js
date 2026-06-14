let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  currentUser = checkAuth('marketer');
  if (!currentUser) return;

  populateSidebarProfile();
  localStorage.setItem('visited_analytics', 'true');

  const tfSelect = document.getElementById('timeframe-select');
  if (tfSelect) {
    tfSelect.addEventListener('change', () => {
      const customInputs = document.getElementById('custom-range-inputs');
      if (tfSelect.value === 'custom') {
        customInputs.style.display = 'inline-flex';
      } else {
        customInputs.style.display = 'none';
        loadAnalytics();
      }
    });
  }

  const startDateInput = document.getElementById('start-date-input');
  const endDateInput = document.getElementById('end-date-input');
  [startDateInput, endDateInput].forEach(input => {
    if (input) {
      input.addEventListener('change', () => {
        if (startDateInput.value && endDateInput.value) {
          loadAnalytics();
        }
      });
    }
  });

  loadAnalytics();
});

// Configure Chart.js global defaults for clean light mode typography
Chart.defaults.color = '#4B5563'; // Slate-600
Chart.defaults.font.family = "'Inter', 'Plus Jakarta Sans', sans-serif";
Chart.defaults.font.size = 11;

async function loadAnalytics() {
  const loadingEl = document.getElementById('analytics-loading');
  const contentEl = document.getElementById('analytics-content');
  const btn       = document.getElementById('btn-refresh');

  loadingEl.style.display = 'flex';
  contentEl.style.display = 'none';
  if (btn) btn.disabled = true;

  try {
    const tfSelect = document.getElementById('timeframe-select');
    const tf = tfSelect ? tfSelect.value : '6months';
    let url = `/analytics/dashboard?timeframe=${tf}`;

    if (tf === 'custom') {
      const startVal = document.getElementById('start-date-input').value;
      const endVal = document.getElementById('end-date-input').value;
      if (startVal) url += `&startDate=${startVal}`;
      if (endVal) url += `&endDate=${endVal}`;
    }

    const data = await apiCall(url);

    // KPIs
    document.getElementById('an-customers').textContent = data.kpis.totalCustomers.toLocaleString('en-IN');
    document.getElementById('an-orders').textContent    = data.kpis.totalOrders.toLocaleString('en-IN');
    document.getElementById('an-revenue').textContent   = formatCurrency(data.kpis.totalRevenue);
    document.getElementById('an-aov').textContent       = formatCurrency(data.kpis.aov);

    // Destroy any existing charts first
    destroyCharts();

    // Render charts
    renderRevenueChart(data.charts.revenueTrend);
    renderOrdersChart(data.charts.ordersTrend);
    renderGrowthChart(data.charts.customerGrowth);
    renderSegmentsChart(data.charts.segmentDistribution);
    renderCampaignPerfChart(data.charts.campaignPerformance);

    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

  } catch (err) {
    console.error('Failed to load analytics:', err);
    loadingEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">△</div>
        <div class="empty-state-title">Failed to load analytics</div>
        <div class="empty-state-desc">${err.message}</div>
        <button class="btn btn-secondary btn-sm" onclick="loadAnalytics()" style="margin-top:1rem;">Retry</button>
      </div>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Track chart instances so we can destroy on refresh
const chartInstances = {};

function destroyCharts() {
  Object.values(chartInstances).forEach(c => c && c.destroy());
}

const CHART_COLORS = {
  primary:  '#4F46E5', // Indigo
  info:     '#3B82F6', // Blue
  success:  '#10B981', // Emerald green
  warning:  '#F59E0B', // Amber
  purple:   '#8B5CF6',
  teal:     '#0D9488',
  pink:     '#EC4899',
  rose:     '#F43F5E',
};

const gridColor = '#F3F4F6'; // Soft grey grid lines for light mode

// 1. Revenue Line Chart
function renderRevenueChart(trend) {
  const ctx = document.getElementById('chart-revenue').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0, 'rgba(79, 70, 229, 0.16)');
  grad.addColorStop(1, 'rgba(79, 70, 229, 0)');

  chartInstances.revenue = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trend.labels,
      datasets: [{
        label: 'Revenue (₹)',
        data: trend.data,
        borderColor: CHART_COLORS.primary,
        borderWidth: 2,
        backgroundColor: grad,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: CHART_COLORS.primary,
        pointHoverRadius: 5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0 } },
        y: { grid: { color: gridColor }, border: { dash: [3,3] } }
      }
    }
  });
}

// 2. Orders Bar Chart
function renderOrdersChart(trend) {
  const ctx = document.getElementById('chart-orders').getContext('2d');
  chartInstances.orders = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: trend.labels,
      datasets: [{
        label: 'Orders',
        data: trend.data,
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        hoverBackgroundColor: CHART_COLORS.info,
        borderRadius: 4,
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: gridColor }, border: { dash: [3,3] } }
      }
    }
  });
}

// 3. Growth Line Chart
function renderGrowthChart(growth) {
  const ctx = document.getElementById('chart-growth').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
  grad.addColorStop(1, 'rgba(16, 185, 129, 0)');

  chartInstances.growth = new Chart(ctx, {
    type: 'line',
    data: {
      labels: growth.labels,
      datasets: [{
        label: 'Customers',
        data: growth.data,
        borderColor: CHART_COLORS.success,
        borderWidth: 2,
        backgroundColor: grad,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: CHART_COLORS.success,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: gridColor }, border: { dash: [3,3] } }
      }
    }
  });
}

// 4. Segment Doughnut
function renderSegmentsChart(dist) {
  const ctx = document.getElementById('chart-segments').getContext('2d');
  chartInstances.segments = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: dist.labels,
      datasets: [{
        data: dist.data,
        backgroundColor: Object.values(CHART_COLORS),
        borderWidth: 1.5,
        borderColor: '#FFFFFF', // Light border for segment slices
        hoverOffset: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 10, padding: 10, font: { size: 11 } }
        }
      }
    }
  });
}

// 5. Campaign Performance Horizontal Bar
function renderCampaignPerfChart(perf) {
  const ctx = document.getElementById('chart-campaign-perf').getContext('2d');

  if (!perf.labels || perf.labels.length === 0) {
    const el = document.getElementById('chart-campaign-perf');
    el.parentElement.innerHTML += `
      <div class="empty-state" style="padding:2rem;">
        <div class="empty-state-icon">◎</div>
        <div class="empty-state-title">No campaigns executed yet</div>
        <div class="empty-state-desc">Launch a campaign to see performance data here</div>
      </div>`;
    el.style.display = 'none';
    return;
  }

  chartInstances.campaignPerf = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: perf.labels,
      datasets: [{
        label: 'Conversion Rate (%)',
        data: perf.conversionRates,
        backgroundColor: 'rgba(139, 92, 246, 0.7)',
        hoverBackgroundColor: CHART_COLORS.purple,
        borderRadius: 4,
        barThickness: 18,
        borderWidth: 0,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          max: 100,
          grid: { color: gridColor },
          border: { dash: [3,3] },
          title: { display: true, text: '%', color: '#6B7280' }
        },
        y: { grid: { display: false } }
      }
    }
  });
}
