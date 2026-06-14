let currentUser = null;
let currentSegmentsData = {};

document.addEventListener('DOMContentLoaded', () => {
  currentUser = checkAuth('marketer');
  if (!currentUser) return;

  populateSidebarProfile();
  loadCrmContext();

  document.getElementById('copilot-chat-form').addEventListener('submit', handleSendMessage);
});

// Load CRM context (segment sizes) to show inside suggestion cards
async function loadCrmContext() {
  try {
    const data = await apiCall('/analytics/dashboard');

    // Build segments map for campaign suggestions
    const labels = data.charts.segmentDistribution.labels;
    const counts = data.charts.segmentDistribution.data;
    currentSegmentsData = {};
    for (let i = 0; i < labels.length; i++) {
      currentSegmentsData[labels[i]] = counts[i];
    }
  } catch (err) {
    console.error('Failed to load CRM context:', err);
  }
}

// Handle clicking on suggestions pills
window.submitSuggestedPrompt = (pillEl) => {
  const promptText = pillEl.textContent.trim();
  const inputEl = document.getElementById('copilot-message-input');
  if (inputEl) {
    inputEl.value = promptText;
    // Dispatch submit event to form
    const form = document.getElementById('copilot-chat-form');
    if (form) {
      form.dispatchEvent(new Event('submit'));
    }
  }
};

async function handleSendMessage(e) {
  e.preventDefault();

  const inputEl = document.getElementById('copilot-message-input');
  const message = inputEl.value.trim();
  if (!message) return;

  inputEl.value = '';

  // Append user message
  appendMessage('user', message);

  // Show typing indicator
  showTyping(true);

  const btn = document.getElementById('btn-send-copilot');
  if (btn) btn.disabled = true;

  try {
    const response = await apiCall('/ai/copilot', {
      method: 'POST',
      body: JSON.stringify({ message })
    });

    showTyping(false);

    // Build response HTML
    let contentHtml = `<p style="line-height:1.6; font-size:0.9rem;">${response.text.replace(/\n/g, '<br>')}</p>`;

    if (response.suggestedCampaign) {
      const camp = response.suggestedCampaign;
      const segCount = currentSegmentsData[camp.targetSegment] || 0;
      const revenueHtml = response.expectedRevenue > 0
        ? `<p style="margin-top:0.5rem; font-size:0.8rem; color:var(--success); font-weight:600;">Expected revenue boost: ${formatCurrency(response.expectedRevenue)}</p>`
        : '';

      contentHtml += `
        <div class="copilot-action-card">
          <div class="copilot-action-title">💡 Campaign Recommendation</div>
          <div class="copilot-action-meta" style="margin-top:0.4rem;">
            Name: <strong>${camp.name || 'AI Campaign Draft'}</strong><br>
            Segment: <strong>${camp.targetSegment}</strong> (${segCount} customers)<br>
            Channel: <strong>${camp.channel}</strong><br>
            Goal: ${camp.goal || '—'}
          </div>
          ${revenueHtml}
          <button class="btn btn-primary btn-sm btn-full" style="margin-top:0.875rem;"
            onclick="generateCampaignFromCopilot('${camp.targetSegment}', '${(camp.goal || '').replace(/'/g, "\\'")}', '${camp.channel}')">
            Launch Campaign Builder
          </button>
        </div>`;
    }

    appendMessage('ai', contentHtml);

  } catch (err) {
    showTyping(false);
    appendMessage('ai', `<span style="color:var(--danger);">Error: ${err.message}</span>`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function appendMessage(sender, htmlContent) {
  const container = document.getElementById('chat-messages-box');

  const isAi = sender === 'ai';
  const avatarHtml = isAi
    ? `<div class="message-avatar ai-avatar">✦</div>`
    : `<div class="message-avatar user-avatar-chat">${currentUser.name[0].toUpperCase()}</div>`;

  const bubble = document.createElement('div');
  bubble.className = `message-row ${isAi ? '' : 'user'}`;
  bubble.innerHTML = `
    ${avatarHtml}
    <div class="message-content">
      <div class="message-bubble ${isAi ? 'ai' : 'user'}">${htmlContent}</div>
    </div>
  `;

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function showTyping(visible) {
  const typingEl = document.getElementById('copilot-typing');
  if (typingEl) typingEl.style.display = visible ? 'block' : 'none';

  const container = document.getElementById('chat-messages-box');
  if (container) container.scrollTop = container.scrollHeight;
}

window.generateCampaignFromCopilot = (segment, goal, channel) => {
  localStorage.setItem('prefillSegment', segment);
  localStorage.setItem('prefillGoal', goal);
  localStorage.setItem('prefillChannel', channel);
  window.location.href = '/campaigns';
};
