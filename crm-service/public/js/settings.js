let currentUser = null;
let currentWidgets = [];

const WIDGET_LABELS = {
  'today-tasks': { name: "Today's Tasks", desc: "Checlist of recommended marketer activities" },
  'kpis': { name: "Key Metrics & KPIs", desc: "Success rate, revenue influenced, total revenue, and campaigns dispatched" },
  'recent-activity': { name: "Recent Activity Timeline", desc: "Live-updating logs of recently executed campaigns" },
  'quick-actions': { name: "Quick Actions", desc: "One-click shortcuts to key creator pages" },
  'ai-assistant-widget': { name: "AI Marketing Assistant", desc: "Conversational copilot widget right on the dashboard" },
  'segments-widget': { name: "Customer Segments", desc: "List of computed database clusters with targeting tools" }
};

document.addEventListener('DOMContentLoaded', () => {
  currentUser = checkAuth('marketer');
  if (!currentUser) return;

  populateSidebarProfile();
  loadPreferences();
});

async function loadPreferences() {
  const container = document.getElementById('widget-settings-list');
  try {
    const prefs = await apiCall('/auth/preferences');
    currentWidgets = prefs.widgets || [];
    renderWidgetList();
  } catch (err) {
    console.error('Failed to load settings:', err);
    container.innerHTML = `<p style="color:var(--danger); text-align:center;">Failed to load preferences: ${err.message}</p>`;
  }
}

function renderWidgetList() {
  const container = document.getElementById('widget-settings-list');
  if (!container) return;

  // Sort by order first
  currentWidgets.sort((a, b) => a.order - b.order);

  container.innerHTML = currentWidgets.map((w, index) => {
    const meta = WIDGET_LABELS[w.id] || { name: w.id, desc: "Dashboard module" };
    const isFirst = index === 0;
    const isLast = index === currentWidgets.length - 1;

    return `
      <div class="widget-item-row" id="row-${w.id}" draggable="true" ondragstart="dragStart(event, ${index})" ondragover="dragOver(event)" ondrop="drop(event, ${index})" style="cursor: move;">
        <div class="widget-drag-info">
          <div class="widget-actions">
            <button class="order-btn" onclick="moveWidget(${index}, -1)" ${isFirst ? 'disabled' : ''} title="Move Up">↑</button>
            <button class="order-btn" onclick="moveWidget(${index}, 1)" ${isLast ? 'disabled' : ''} title="Move Down">↓</button>
          </div>
          <div>
            <div class="widget-name-label">${meta.name}</div>
            <div class="widget-desc-label">${meta.desc}</div>
          </div>
        </div>
        <div>
          <label class="switch">
            <input type="checkbox" id="chk-visible-${w.id}" ${w.visible ? 'checked' : ''} onchange="toggleWidgetVisibility('${w.id}', this.checked)">
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `;
  }).join('');
}

let draggedIndex = null;

window.dragStart = (e, index) => {
  draggedIndex = index;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', index);
};

window.dragOver = (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
};

window.drop = (e, targetIndex) => {
  e.preventDefault();
  if (draggedIndex === null || draggedIndex === targetIndex) return;

  const item = currentWidgets.splice(draggedIndex, 1)[0];
  currentWidgets.splice(targetIndex, 0, item);

  currentWidgets.forEach((w, idx) => {
    w.order = idx;
  });

  renderWidgetList();
  draggedIndex = null;
};

window.moveWidget = (index, direction) => {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= currentWidgets.length) return;

  // Swap elements in currentWidgets array
  const temp = currentWidgets[index];
  currentWidgets[index] = currentWidgets[targetIndex];
  currentWidgets[targetIndex] = temp;

  // Re-index order property
  currentWidgets.forEach((w, idx) => {
    w.order = idx;
  });

  renderWidgetList();
};

window.toggleWidgetVisibility = (id, isChecked) => {
  const widget = currentWidgets.find(w => w.id === id);
  if (widget) {
    widget.visible = isChecked;
  }
};

window.savePreferences = async () => {
  const btn = document.getElementById('btn-save-prefs');
  const notif = document.getElementById('settings-notification');
  
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Saving...";
  }
  if (notif) notif.style.display = 'none';

  try {
    // Re-verify order indexing
    currentWidgets.forEach((w, idx) => {
      w.order = idx;
    });

    await apiCall('/auth/preferences', {
      method: 'PUT',
      body: JSON.stringify({ widgets: currentWidgets })
    });

    if (notif) {
      notif.textContent = "Preferences saved successfully! Head back to the Dashboard to see your updated layout.";
      notif.className = "alert alert-success";
      notif.style.display = "block";
    }

  } catch (err) {
    console.error('Failed to save preferences:', err);
    if (notif) {
      notif.textContent = "Error saving preferences: " + err.message;
      notif.className = "alert alert-danger";
      notif.style.display = "block";
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Save Preferences";
    }
  }
};

window.resetDefaultPrefs = () => {
  currentWidgets = [
    { id: 'today-tasks', visible: true, order: 0 },
    { id: 'kpis', visible: true, order: 1 },
    { id: 'recent-activity', visible: true, order: 2 },
    { id: 'quick-actions', visible: true, order: 3 },
    { id: 'ai-assistant-widget', visible: true, order: 4 },
    { id: 'segments-widget', visible: false, order: 5 }
  ];
  renderWidgetList();
};
