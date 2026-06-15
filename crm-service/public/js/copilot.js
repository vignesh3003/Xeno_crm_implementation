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
    showWarningBanner();
  }
}

function showWarningBanner() {
  const container = document.getElementById('chat-messages-box');
  if (!container) return;
  const banner = document.createElement('div');
  banner.className = 'alert alert-warning';
  banner.style.margin = '0.5rem 0';
  banner.style.padding = '0.5rem';
  banner.style.fontSize = '0.85rem';
  banner.textContent = 'CRM context unavailable. Operating with limited data.';
  container.appendChild(banner);
  container.scrollTop = container.scrollHeight;
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
    console.warn('AI Copilot request failed, using client-side fallback:', err);
    showTyping(false);
    
    // Get mock fallback response
    const response = getMockFallbackResponse(message);
    
    let contentHtml = `<p style="line-height:1.6; font-size:0.9rem; color: var(--warning); margin-bottom: 0.5rem;">⚠️ <em>Responding in offline mode:</em></p>`;
    contentHtml += `<p style="line-height:1.6; font-size:0.9rem;">${response.text.replace(/\n/g, '<br>')}</p>`;

    if (response.suggestedCampaign) {
      const camp = response.suggestedCampaign;
      const segCount = currentSegmentsData[camp.targetSegment] || 0;
      const revenueHtml = response.expectedRevenue > 0
        ? `<p style="margin-top:0.5rem; font-size:0.8rem; color:var(--success); font-weight:600;">Expected revenue boost: ${formatCurrency(response.expectedRevenue)}</p>`
        : '';

      contentHtml += `
        <div class="copilot-action-card">
          <div class="copilot-action-title">💡 Campaign Recommendation (Fallback)</div>
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
  } finally {
    if (btn) btn.disabled = false;
  }
}

function getMockFallbackResponse(message) {
  const msg = message.toLowerCase();
  
  if (msg.includes('campaign') || msg.includes('suggest') || msg.includes('create') || msg.includes('launch') || msg.includes('idea')) {
    return {
      text: "I've generated a backup campaign recommendation for you based on offline templates. Since we are operating with limited data, this is a standard high-conversion proposal.",
      expectedRevenue: 1500,
      suggestedCampaign: {
        name: "Dormant Customers Re-engagement",
        targetSegment: "Dormant",
        channel: "email",
        goal: "Offer a 20% discount code to customers who haven't purchased in 60 days"
      }
    };
  }
  
  if (msg.includes('segment') || msg.includes('audience') || msg.includes('customer')) {
    return {
      text: "Here are the standard segments usually available in Xeno CRM: 'Dormant' (inactive users), 'High Spenders' (VIPs), and 'Recent Buyers'. You can target any of these in the Campaign Builder.",
      suggestedCampaign: null
    };
  }
  
  if (msg.includes('help') || msg.includes('what can you do') || msg.includes('features')) {
    return {
      text: "I can help you design marketing campaigns, suggest target segments, write message copy, and estimate campaign performance. Even offline, you can ask me to 'suggest a campaign'!",
      suggestedCampaign: null
    };
  }

  // Default fallback
  return {
    text: `I received your message: "${message}". I am currently running in offline fallback mode with limited data access. Try asking me to "suggest a campaign" to launch a campaign builder draft!`,
    suggestedCampaign: {
      name: "Offline Recovery Campaign",
      targetSegment: "All Customers",
      channel: "email",
      goal: "A fallback campaign draft created while offline."
    },
    expectedRevenue: 500
  };
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
