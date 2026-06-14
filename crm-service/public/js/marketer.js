let currentUser = null;
let revenueChart = null;
let campaignChart = null;

document.addEventListener('DOMContentLoaded', () => {
  currentUser = checkAuth('marketer');
  if (!currentUser) return;

  populateSidebarProfile();
  setWelcomeHeading();
  
  // 1. Initial Load of Dashboard KPIs & Charts
  loadDashboardData();

  // 2. Initialize Floating Chatbot
  initFloatingChatbot();

  // 3. Initialize Todo Forms
  initTodoForm();

  // 4. Initialize Timeframe Selectors
  initTimeframeFilter();
});

function setWelcomeHeading() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const headingEl = document.getElementById('welcome-heading');
  if (headingEl && currentUser) {
    const firstName = currentUser.name.split(' ')[0];
    headingEl.textContent = `${greeting}, ${firstName}`;
  }
}

async function loadDashboardData() {
  const select = document.getElementById('analytics-timeframe');
  const timeframe = select ? select.value : '6months';
  const startDateInput = document.getElementById('analytics-start-date');
  const endDateInput = document.getElementById('analytics-end-date');
  
  let url = `/analytics/dashboard?timeframe=${timeframe}`;
  if (timeframe === 'custom' && startDateInput?.value && endDateInput?.value) {
    url += `&startDate=${startDateInput.value}&endDate=${endDateInput.value}`;
  }

  try {
    const data = await apiCall(url);
    
    // Render KPIs safely (prevent NaN)
    if (document.getElementById('kpi-success-rate')) {
      const succ = data.kpis.conversionRate ?? 0;
      document.getElementById('kpi-success-rate').textContent = `${Number(succ).toFixed(1)}%`;
    }
    if (document.getElementById('kpi-revenue-influenced')) {
      const revInfl = data.kpis.revenueInfluenced ?? 0;
      document.getElementById('kpi-revenue-influenced').textContent = formatCurrency(Number(revInfl) || 0);
    }
    if (document.getElementById('kpi-revenue')) {
      const rev = data.kpis.totalRevenue ?? 0;
      document.getElementById('kpi-revenue').textContent = formatCurrency(Number(rev) || 0);
    }
    if (document.getElementById('kpi-campaigns')) {
      const sent = data.kpis.campaignsSent ?? 0;
      document.getElementById('kpi-campaigns').textContent = Number(sent) || 0;
    }
    if (document.getElementById('kpi-customers')) {
      const custs = data.kpis.totalCustomers ?? 0;
      document.getElementById('kpi-customers').textContent = Number(custs) || 0;
    }
    if (document.getElementById('kpi-orders')) {
      const ords = data.kpis.totalOrders ?? 0;
      document.getElementById('kpi-orders').textContent = Number(ords) || 0;
    }
    if (document.getElementById('kpi-aov')) {
      const aovVal = data.kpis.aov ?? 0;
      document.getElementById('kpi-aov').textContent = formatCurrency(Number(aovVal) || 0);
    }

    // AI recommendations tips
    if (data.aiRecommendations) {
      const rec = data.aiRecommendations;
      const revTip = document.getElementById('revenue-ai-recommendation');
      const campTip = document.getElementById('campaigns-ai-recommendation');
      if (revTip) revTip.textContent = rec.timing || 'Best dispatch timing computed';
      if (campTip) campTip.textContent = rec.channel || 'Top channel determined';
    }

    // Load and render widget preferences
    let widgetPrefs = null;
    try {
      widgetPrefs = await apiCall('/auth/preferences');
    } catch (e) {
      console.warn("Preferences load failed, using fallback.", e);
    }

    const container = document.getElementById('widgets-container');
    if (container) {
      const prefs = widgetPrefs?.widgets || [
        { id: 'today-tasks', visible: true, order: 0 },
        { id: 'kpis', visible: true, order: 1 },
        { id: 'recent-activity', visible: true, order: 2 },
        { id: 'quick-actions', visible: true, order: 3 },
        { id: 'ai-assistant-widget', visible: true, order: 4 },
        { id: 'segments-widget', visible: false, order: 5 }
      ];

      // Handle visibility
      prefs.forEach(w => {
        if (w.id === 'ai-assistant-widget') {
          const btn = document.getElementById('floating-ai-btn');
          if (btn) btn.style.display = w.visible ? 'flex' : 'none';
          return;
        }

        let el = document.getElementById(`widget-${w.id}`);
        if (el) {
          el.style.display = w.visible ? '' : 'none';
        }
      });

      // Special handling for side-by-side tasks and activity wrapper
      const tasksPref = prefs.find(w => w.id === 'today-tasks');
      const activityPref = prefs.find(w => w.id === 'recent-activity');
      const wrapper = document.getElementById('widget-tasks-activity');
      if (wrapper) {
        const bothHidden = (!tasksPref || !tasksPref.visible) && (!activityPref || !activityPref.visible);
        wrapper.style.display = bothHidden ? 'none' : 'grid';

        if (tasksPref?.visible && activityPref?.visible) {
          wrapper.style.gridTemplateColumns = '1.2fr 1fr';
        } else {
          wrapper.style.gridTemplateColumns = '1fr';
        }

        const tasksOrder = tasksPref ? tasksPref.order : 0;
        const activityOrder = activityPref ? activityPref.order : 2;
        wrapper.dataset.order = Math.min(tasksOrder, activityOrder);
      }

      // Sort widgets by order
      const elementsToOrder = Array.from(container.children);
      elementsToOrder.forEach(el => {
        if (el.id === 'widget-today-tasks' || el.id === 'widget-recent-activity') return;

        let order = 99;
        const pref = prefs.find(w => `widget-${w.id}` === el.id);
        if (pref) {
          order = pref.order;
        } else if (el.id === 'widget-tasks-activity') {
          order = parseFloat(el.dataset.order) || 0;
        } else if (el.id === 'widget-analytics') {
          order = 0.5; // Statically under KPIs
        }
        el.dataset.order = order;
      });

      elementsToOrder.sort((a, b) => parseFloat(a.dataset.order) - parseFloat(b.dataset.order));
      elementsToOrder.forEach(el => {
        if (el.id !== 'widget-today-tasks' && el.id !== 'widget-recent-activity') {
          container.appendChild(el);
        }
      });

      // If segments widget is visible, load segments
      const segPref = prefs.find(w => w.id === 'segments-widget');
      if (segPref?.visible) {
        loadSegmentsWidget();
      }
    }

    // Render Charts
    renderRevenueChart(data.charts.revenueTrend);
    renderCampaignChart(data.charts.campaignPerformance);

    // Render Recent Activity Stream & Todos
    loadActivityStream();
    loadTodos();

  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

// ─────────────────────────────────────────
// CHART RENDERING (Chart.js)
// ─────────────────────────────────────────
function renderRevenueChart(trendData) {
  const ctx = document.getElementById('chart-revenue-trend');
  if (!ctx) return;

  if (revenueChart) {
    revenueChart.destroy();
  }

  revenueChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trendData.labels || [],
      datasets: [{
        label: 'Revenue ($)',
        data: trendData.data || [],
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79, 70, 229, 0.04)',
        borderWidth: 2,
        fill: true,
        tension: 0.15,
        pointRadius: 3,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0, 0, 0, 0.03)' },
          ticks: { color: '#6B7280', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(0, 0, 0, 0.03)' },
          ticks: { color: '#6B7280', font: { size: 10 } }
        }
      }
    }
  });
}

function renderCampaignChart(perfData) {
  const ctx = document.getElementById('chart-campaign-performance');
  if (!ctx) return;

  if (campaignChart) {
    campaignChart.destroy();
  }

  campaignChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: perfData.labels || [],
      datasets: [
        {
          label: 'Sent',
          data: perfData.sent || [],
          backgroundColor: '#4F46E5',
          borderRadius: 4
        },
        {
          label: 'Converted',
          data: perfData.converted || [],
          backgroundColor: '#10B981',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, font: { size: 10 }, color: '#4B5563' }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#6B7280', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(0, 0, 0, 0.03)' },
          ticks: { color: '#6B7280', font: { size: 10 } }
        }
      }
    }
  });
}

// Timeframe selectors hook
function initTimeframeFilter() {
  const select = document.getElementById('analytics-timeframe');
  const applyBtn = document.getElementById('btn-apply-custom-dates');
  const customContainer = document.getElementById('custom-date-container');

  if (!select) return;

  select.addEventListener('change', () => {
    if (select.value === 'custom') {
      if (customContainer) customContainer.style.display = 'flex';
    } else {
      if (customContainer) customContainer.style.display = 'none';
      loadDashboardData();
    }
  });

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      loadDashboardData();
    });
  }
}

// ─────────────────────────────────────────
// TODOS WORKFLOW (MongoDB Sync)
// ─────────────────────────────────────────
async function loadTodos() {
  const container = document.getElementById('todo-list-container');
  if (!container) return;

  try {
    const todos = await apiCall('/todos');
    
    if (todos.length === 0) {
      container.innerHTML = `<li style="color:var(--text-3); font-size:0.875rem; text-align:center; padding:1rem;">All caught up! No tasks for today.</li>`;
      return;
    }

    container.innerHTML = todos.map(todo => {
      const aiBadge = todo.aiGenerated 
        ? `<span style="font-size:0.65rem; background:rgba(79,70,229,0.1); color:var(--accent); padding:0.15rem 0.35rem; border-radius:4px; font-weight:600; margin-left:0.5rem;">AI</span>`
        : '';
      
      return `
        <li class="todo-item ${todo.completed ? 'completed' : ''}" id="todo-item-${todo._id}">
          <input type="checkbox" id="chk-${todo._id}" ${todo.completed ? 'checked' : ''} onchange="toggleTodo('${todo._id}', this.checked)">
          <label for="chk-${todo._id}" style="flex-grow:1; cursor:pointer;">${todo.title} ${aiBadge}</label>
          <a href="#" onclick="deleteTodo(event, '${todo._id}')" style="font-size: 0.75rem; color: var(--danger); margin-left: 0.5rem;" title="Delete task">Delete</a>
        </li>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load todos:', err);
  }
}

window.toggleTodo = async (id, completed) => {
  const item = document.getElementById(`todo-item-${id}`);
  if (item) {
    if (completed) {
      item.classList.add('completed');
    } else {
      item.classList.remove('completed');
    }
  }

  try {
    await apiCall(`/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ completed })
    });
  } catch (err) {
    console.error('Failed to update todo:', err);
    loadTodos();
  }
};

window.deleteTodo = async (e, id) => {
  e.preventDefault();
  if (!confirm("Are you sure you want to delete this task?")) return;

  try {
    await apiCall(`/todos/${id}`, {
      method: 'DELETE'
    });
    loadTodos();
  } catch (err) {
    console.error('Failed to delete todo:', err);
  }
};

function initTodoForm() {
  const form = document.getElementById('todo-add-form');
  const input = document.getElementById('todo-add-input');
  
  if (!form || !input) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = input.value.trim();
    if (!title) return;

    input.value = '';

    try {
      await apiCall('/todos', {
        method: 'POST',
        body: JSON.stringify({ title })
      });
      loadTodos();
    } catch (err) {
      console.error('Failed to add todo:', err);
    }
  });
}

// ─────────────────────────────────────────
// RECENT ACTIVITY LOG (MongoDB Sync)
// ─────────────────────────────────────────
async function loadActivityStream() {
  const timelineEl = document.getElementById('dashboard-timeline');
  if (!timelineEl) return;

  try {
    const res = await apiCall('/analytics/activity');
    const events = res.data || [];

    if (events.length === 0) {
      timelineEl.innerHTML = `
        <div style="text-align:center; padding:1.5rem 0; color:var(--text-3); font-size:0.875rem;">
          No recent activity logs.
        </div>`;
      return;
    }

    timelineEl.innerHTML = events.map(ev => {
      let icon = '✉';
      let badgeStyle = 'background:rgba(79,70,229,0.08); color:var(--accent)';

      if (ev.type === 'delivery_failed') {
        icon = '⚠';
        badgeStyle = 'background:rgba(239,68,68,0.08); color:var(--danger)';
      } else if (ev.type === 'campaign_opened') {
        icon = '👁';
        badgeStyle = 'background:rgba(59,130,246,0.08); color:var(--info)';
      } else if (ev.type === 'customer_signup') {
        icon = '👤';
        badgeStyle = 'background:rgba(16,185,129,0.08); color:var(--success)';
      } else if (ev.type === 'order_purchase') {
        icon = '🛍';
        badgeStyle = 'background:rgba(16,185,129,0.08); color:var(--success)';
      }

      const dateStr = formatActivityTime(ev.timestamp);

      return `
        <div class="timeline-item" style="display: flex; gap: 1rem; align-items: flex-start; margin-bottom: 1rem;">
          <div class="timeline-dot" style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; ${badgeStyle}; font-size: 0.95rem; font-weight: bold; flex-shrink: 0;">
            ${icon}
          </div>
          <div class="timeline-content" style="flex-grow: 1;">
            <div style="font-weight: 500; font-size: 0.85rem; color: var(--text-1);">${ev.title}</div>
            <div style="font-size: 0.75rem; color: var(--text-3); margin-top: 0.15rem;">${dateStr}</div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load activity stream:', err);
    timelineEl.innerHTML = `
      <div style="text-align:center; padding:1.5rem 0; color:var(--danger); font-size:0.875rem;">
        Failed to load activity log.
      </div>`;
  }
}

function formatActivityTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  
  if (diffMs < 60000) return 'Just now';
  
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ─────────────────────────────────────────
// FLOATING AI CHAT DRAWERS
// ─────────────────────────────────────────
function initFloatingChatbot() {
  const fab = document.getElementById('floating-ai-btn');
  const drawer = document.getElementById('floating-ai-drawer');
  const closeBtn = document.getElementById('close-ai-drawer-btn');
  const form = document.getElementById('floating-chat-form');
  const box = document.getElementById('floating-chat-box');
  const input = document.getElementById('floating-chat-input');
  const sendBtn = document.getElementById('btn-floating-chat-send');

  if (!fab || !drawer || !closeBtn || !form || !box || !input) return;

  // Toggle drawer
  fab.addEventListener('click', () => {
    const isHidden = drawer.style.display === 'none';
    drawer.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) {
      input.focus();
      box.scrollTop = box.scrollHeight;
    }
  });

  closeBtn.addEventListener('click', () => {
    drawer.style.display = 'none';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;

    input.value = '';

    // Append User message
    const userDiv = document.createElement('div');
    userDiv.style.fontSize = '0.825rem';
    userDiv.style.color = 'var(--text-1)';
    userDiv.style.alignSelf = 'flex-end';
    userDiv.style.background = 'var(--bg-elevated)';
    userDiv.style.padding = '0.5rem 0.75rem';
    userDiv.style.borderRadius = '12px 12px 0 12px';
    userDiv.style.maxWidth = '85%';
    userDiv.style.marginLeft = 'auto';
    userDiv.style.marginBottom = '0.5rem';
    userDiv.innerHTML = `<strong>You:</strong> ${msg}`;
    box.appendChild(userDiv);
    box.scrollTop = box.scrollHeight;

    // Typing
    const typingDiv = document.createElement('div');
    typingDiv.style.fontSize = '0.8rem';
    typingDiv.style.color = 'var(--text-3)';
    typingDiv.id = 'floating-typing';
    typingDiv.textContent = 'Xeno AI is thinking...';
    box.appendChild(typingDiv);
    box.scrollTop = box.scrollHeight;

    sendBtn.disabled = true;

    try {
      const response = await apiCall('/ai/copilot', {
        method: 'POST',
        body: JSON.stringify({ message: msg })
      });

      const t = document.getElementById('floating-typing');
      if (t) t.remove();

      // Append AI Message
      const aiDiv = document.createElement('div');
      aiDiv.style.fontSize = '0.825rem';
      aiDiv.style.color = 'var(--text-2)';
      aiDiv.style.background = 'rgba(79, 70, 229, 0.04)';
      aiDiv.style.padding = '0.5rem 0.75rem';
      aiDiv.style.borderRadius = '12px 12px 12px 0';
      aiDiv.style.alignSelf = 'flex-start';
      aiDiv.style.maxWidth = '85%';
      aiDiv.style.marginBottom = '0.5rem';
      
      let replyHtml = `<strong>Xeno AI:</strong> ${response.text.replace(/\n/g, '<br>')}`;

      if (response.suggestedCampaign) {
        const camp = response.suggestedCampaign;
        replyHtml += `
          <div style="background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius-md); padding:0.5rem; margin-top:0.5rem; font-size:0.725rem;">
            <strong>💡 Campaign Idea:</strong> ${camp.name || 'AI Campaign Draft'}<br>
            Segment: ${camp.targetSegment} · Channel: ${camp.channel}<br>
            <button class="btn btn-secondary btn-sm" style="margin-top:0.4rem; padding:0.15rem 0.35rem; font-size:0.675rem;"
              onclick="localStorage.setItem('prefillSegment', '${camp.targetSegment}'); localStorage.setItem('prefillGoal', '${(camp.goal || '').replace(/'/g, "\\'") || ''}'); localStorage.setItem('prefillChannel', '${camp.channel}'); window.location.href='/campaigns';">
              Build Campaign
            </button>
          </div>
        `;
      }

      aiDiv.innerHTML = replyHtml;
      box.appendChild(aiDiv);
      box.scrollTop = box.scrollHeight;

    } catch (err) {
      const t = document.getElementById('floating-typing');
      if (t) t.remove();

      const errDiv = document.createElement('div');
      errDiv.style.fontSize = '0.8rem';
      errDiv.style.color = 'var(--danger)';
      errDiv.style.alignSelf = 'flex-start';
      errDiv.textContent = `Error: ${err.message}`;
      box.appendChild(errDiv);
      box.scrollTop = box.scrollHeight;
    } finally {
      sendBtn.disabled = false;
    }
  });
}

// ─────────────────────────────────────────
// CUSTOMER SEGMENTS WIDGET
// ─────────────────────────────────────────
async function loadSegmentsWidget() {
  const container = document.getElementById('segments-list-grid');
  if (!container) return;

  try {
    const segments = await apiCall('/segments');
    if (segments.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-state-icon">◈</div>
          <div class="empty-state-title">No segments yet</div>
        </div>`;
      return;
    }

    container.innerHTML = segments.map(seg => `
      <div class="card segment-card card-hover" style="cursor:pointer; margin: 0;"
           onclick="viewSegment('${seg.name}', '${(seg.description || '').replace(/'/g, "\\'")}', ${seg.customerCount})">
        <div class="segment-card-header">
          <div class="segment-name" style="font-weight:600; font-size:0.9rem; color:var(--text-1);">${seg.name}</div>
          <div class="segment-count" style="font-weight:700; color:var(--accent);">${seg.customerCount}</div>
        </div>
        <div class="segment-desc" style="font-size:0.78rem; color:var(--text-3); margin-top:0.25rem;">${seg.description || 'No description.'}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load segments widget:', err);
    container.innerHTML = `<p style="color:var(--danger); font-size:0.8rem;">Failed to load segments.</p>`;
  }
}

window.viewSegment = async (name, description, count) => {
  const modal = document.getElementById('segment-modal');
  const titleEl = document.getElementById('modal-segment-title');
  const descEl = document.getElementById('modal-segment-desc');
  const tbody = document.getElementById('modal-users-table-body');

  titleEl.textContent = name;
  descEl.textContent = description;
  modal.style.display = 'flex';

  tbody.innerHTML = `
    <tr>
      <td colspan="4" style="text-align:center; padding:2rem; color:var(--text-3);">
        <div class="loading-state">
          <div class="spinner" style="margin-bottom:0.5rem;"></div>
          <span>Loading users...</span>
        </div>
      </td>
    </tr>`;

  try {
    const customers = await apiCall(`/segments/${encodeURIComponent(name)}/customers`);

    if (customers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; color:var(--text-2); padding:2rem;">
            No customers in this segment currently.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = customers.map(cust => {
      const joined = new Date(cust.createdAt).toLocaleDateString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
      return `
        <tr>
          <td style="font-weight:500; color:var(--text-1);">${cust.name}</td>
          <td style="color:var(--text-2);">${cust.email}</td>
          <td style="color:var(--text-2);">${joined}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="quickTargetCampaign('${cust.email}')">
              Target
            </button>
          </td>
        </tr>`;
    }).join('');
  } catch (err) {
    console.error('Failed to load customers for segment:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; color:var(--danger); padding:2rem;">
          Error: ${err.message}
        </td>
      </tr>`;
  }
};

window.closeSegmentModal = () => {
  document.getElementById('segment-modal').style.display = 'none';
};

window.quickTargetCampaign = (email) => {
  localStorage.setItem('quickTargetRecipient', email);
  window.location.href = '/campaigns';
};
