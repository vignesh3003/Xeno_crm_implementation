let currentUser  = null;
let currentDraft = null;
let historyPollingInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  currentUser = checkAuth('marketer');
  if (!currentUser) return;

  populateSidebarProfile();
  checkPrefillStates();
  loadCampaignsHistory();

  // Poll every 4s to show live telemetry
  historyPollingInterval = setInterval(loadCampaignsHistory, 4000);
});

window.addEventListener('beforeunload', () => {
  if (historyPollingInterval) clearInterval(historyPollingInterval);
});

// Check localStorage for pre-filled goal from insights / segments
function checkPrefillStates() {
  const prefillGoal           = localStorage.getItem('prefillGoal');
  const quickTargetRecipient  = localStorage.getItem('quickTargetRecipient');

  if (prefillGoal) {
    document.getElementById('campaign-goal-input').value = prefillGoal;
    localStorage.removeItem('prefillGoal');
    setTimeout(generateCampaignDraft, 300);
  }

  if (quickTargetRecipient) {
    document.getElementById('campaign-goal-input').value =
      `Direct outreach targeting customer email ${quickTargetRecipient}`;
    localStorage.removeItem('quickTargetRecipient');
  }

  ['prefillSegment', 'prefillChannel'].forEach(k => localStorage.removeItem(k));
}

// Helper: populate goal textarea from suggestion links
window.populateGoalText = (text) => {
  document.getElementById('campaign-goal-input').value = text;
};

// Switch between tabs
window.switchCampaignTab = (tabId) => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-btn-${tabId}`).classList.add('active');

  const generator = document.getElementById('campaign-tab-generator');
  const history   = document.getElementById('campaign-tab-history');

  if (tabId === 'generator') {
    generator.style.display = 'grid';
    history.style.display   = 'none';
  } else {
    generator.style.display = 'none';
    history.style.display   = 'block';
    loadCampaignsHistory();
  }
};

// Generate AI campaign draft
window.generateCampaignDraft = async () => {
  const goalInput = document.getElementById('campaign-goal-input').value.trim();
  const errorEl   = document.getElementById('ai-generator-error');
  const btn       = document.getElementById('btn-generate-draft');

  if (!goalInput) {
    errorEl.textContent   = 'Please describe your campaign goal.';
    errorEl.style.display = 'block';
    return;
  }

  errorEl.style.display = 'none';
  btn.disabled    = true;
  btn.textContent = 'Generating...';

  try {
    const draft = await apiCall('/ai/generate-campaign', {
      method: 'POST',
      body: JSON.stringify({ goal: goalInput })
    });

    currentDraft = draft;

    document.getElementById('campaign-edit-name').value     = draft.name || 'New Campaign';
    document.getElementById('campaign-edit-segment').value  = draft.targetSegment || 'New Shoppers';
    document.getElementById('campaign-edit-channel').value  = draft.channel || 'Email';
    document.getElementById('campaign-edit-subject').value  = draft.subject || '';
    document.getElementById('campaign-edit-template').value = draft.messageTemplate || '';
    document.getElementById('campaign-edit-cta').value      = draft.callToAction || '';
    document.getElementById('draft-expected-conversion').textContent =
      `Est. conversion: ${draft.expectedConversion || 12}%`;

    // Unlock editor
    const editor = document.getElementById('editor-card');
    editor.style.opacity      = '1';
    editor.style.pointerEvents = 'auto';
    document.getElementById('campaign-edit-name').focus();

  } catch (err) {
    errorEl.textContent   = 'Failed to generate draft: ' + err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Generate draft';
  }
};

// Save and launch campaign
window.saveAndLaunchCampaign = async (e) => {
  e.preventDefault();

  const name            = document.getElementById('campaign-edit-name').value;
  const targetSegment   = document.getElementById('campaign-edit-segment').value;
  const channel         = document.getElementById('campaign-edit-channel').value;
  const subject         = document.getElementById('campaign-edit-subject').value;
  const messageTemplate = document.getElementById('campaign-edit-template').value;
  const callToAction    = document.getElementById('campaign-edit-cta').value;

  const btn = e.submitter || document.querySelector('#campaign-edit-form button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Launching...'; }

  try {
    const campaign = await apiCall('/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        name,
        goal: document.getElementById('campaign-goal-input').value,
        targetSegment,
        objective: currentDraft?.objective || 'Custom objective',
        channel,
        subject,
        messageTemplate,
        callToAction,
        expectedConversion: currentDraft?.expectedConversion || 10
      })
    });

    await apiCall(`/campaigns/${campaign._id}/execute`, { method: 'POST' });

    // Reset form
    document.getElementById('campaign-edit-form').reset();
    document.getElementById('campaign-goal-input').value = '';
    const editor = document.getElementById('editor-card');
    editor.style.opacity      = '0.4';
    editor.style.pointerEvents = 'none';
    document.getElementById('draft-expected-conversion').textContent = 'Est. conversion: —';

    switchCampaignTab('history');

  } catch (err) {
    alert('Failed to launch campaign: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Launch campaign'; }
  }
};

// Load campaign history list
async function loadCampaignsHistory() {
  const container = document.getElementById('campaigns-history-list');
  try {
    const campaigns = await apiCall('/campaigns');

    if (campaigns.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">◎</div>
          <div class="empty-state-title">No campaigns yet</div>
          <div class="empty-state-desc">Use the AI Generator to create and launch your first campaign</div>
        </div>`;
      return;
    }

    // Fetch telemetry in parallel for Sent campaigns
    const results = await Promise.all(campaigns.map(async (camp) => {
      if (camp.status === 'Sent') {
        try {
          const telemetry = await apiCall(`/campaigns/${camp._id}/telemetry`);
          return { camp, telemetry };
        } catch {
          return { camp, telemetry: null };
        }
      }
      return { camp, telemetry: null };
    }));

    container.innerHTML = results.map(({ camp, telemetry }) => {
      const date = new Date(camp.createdAt).toLocaleDateString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      const stats = telemetry || { sent:0, failed:0, delivered:0, opened:0, clicked:0, converted:0 };
      const S = stats.sent;
      const pct = (v) => S > 0 ? Math.round((v / S) * 100) : 0;

      const delPct  = pct(stats.delivered);
      const openPct = pct(stats.opened);
      const clkPct  = pct(stats.clicked);
      const cnvPct  = pct(stats.converted);

      let statusBadge = '';
      if (camp.status === 'Draft') {
        statusBadge = `<span class="badge badge-warning">Draft</span>`;
      } else {
        let status = 'Mixed';
        let badgeClass = 'badge-warning';
        if (stats && stats.sent > 0) {
          const cnvPct = (stats.converted / stats.sent) * 100;
          const failPct = (stats.failed / stats.sent) * 100;
          if (cnvPct >= 15 && failPct < 10) {
            status = 'Success';
            badgeClass = 'badge-success';
          } else if (cnvPct < 5 || failPct >= 20) {
            status = 'Failed';
            badgeClass = 'badge-danger';
          } else {
            status = 'Mixed';
            badgeClass = 'badge-warning';
          }
        }
        statusBadge = `<span class="badge ${badgeClass}" style="cursor:pointer;" onclick="viewExplanation('${camp._id}')" title="Click to view AI Explanation report">${status} ⓘ</span>`;
      }

      const channelBadge = `<span class="badge badge-info">${camp.channel}</span>`;

      const telemetryHtml = camp.status !== 'Draft' ? `
        <div>
          <div class="funnel-stats" style="margin-bottom:0.75rem;">
            <div class="funnel-stat">
              <span class="funnel-stat-label">Sent</span>
              <span class="funnel-stat-value">${S}</span>
            </div>
            <div class="funnel-stat">
              <span class="funnel-stat-label">Delivered</span>
              <span class="funnel-stat-value" style="color:var(--info);">${stats.delivered}</span>
              <span class="funnel-stat-pct">${delPct}%</span>
            </div>
            <div class="funnel-stat">
              <span class="funnel-stat-label">Opened</span>
              <span class="funnel-stat-value" style="color:var(--warning);">${stats.opened}</span>
              <span class="funnel-stat-pct">${openPct}%</span>
            </div>
            <div class="funnel-stat">
              <span class="funnel-stat-label">Clicked</span>
              <span class="funnel-stat-value" style="color:var(--accent);">${stats.clicked}</span>
              <span class="funnel-stat-pct">${clkPct}%</span>
            </div>
            <div class="funnel-stat">
              <span class="funnel-stat-label">Converted</span>
              <span class="funnel-stat-value" style="color:var(--success);">${stats.converted}</span>
              <span class="funnel-stat-pct">${cnvPct}%</span>
            </div>
          </div>
          <div class="funnel-bar">
            <div class="funnel-segment" style="width:${cnvPct}%; background:var(--success);"></div>
            <div class="funnel-segment" style="width:${Math.max(0, clkPct-cnvPct)}%; background:var(--accent);"></div>
            <div class="funnel-segment" style="width:${Math.max(0, openPct-clkPct)}%; background:var(--warning);"></div>
            <div class="funnel-segment" style="width:${Math.max(0, delPct-openPct)}%; background:var(--info);"></div>
          </div>
        </div>
      ` : `
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <span style="font-size:0.82rem; color:var(--text-2);">Campaign is in draft. Execute to begin delivery simulation.</span>
          <button class="btn btn-primary btn-sm" onclick="launchDraftCampaign('${camp._id}')">Launch now</button>
        </div>
      `;

      return `
        <div class="campaign-card">
          <div class="campaign-header">
            <div>
              <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.3rem;">
                <span class="campaign-name">${camp.name}</span>
                ${statusBadge}
                ${channelBadge}
              </div>
              <div class="campaign-meta">
                Segment: <strong>${camp.targetSegment}</strong>
                ${camp.goal ? ` &nbsp;·&nbsp; "${camp.goal}"` : ''}
              </div>
            </div>
            <div style="text-align:right; flex-shrink:0;">
              <span style="font-size:0.75rem; color:var(--text-3);">${date}</span>
            </div>
          </div>

          ${camp.messageTemplate ? `
            <div style="background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--radius-md); padding:0.75rem 1rem; font-size:0.8rem; color:var(--text-2);">
              ${camp.subject ? `<span style="color:var(--text-1); font-weight:500;">"${camp.subject}"</span><br>` : ''}
              ${camp.messageTemplate}
            </div>
          ` : ''}

          ${telemetryHtml}
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error(err);
  }
}

// Launch a draft campaign from history tab
window.launchDraftCampaign = async (campaignId) => {
  try {
    await apiCall(`/campaigns/${campaignId}/execute`, { method: 'POST' });
    loadCampaignsHistory();
  } catch (err) {
    alert('Failed to launch: ' + err.message);
  }
};

// Open AI Performance report modal
window.viewExplanation = async (campaignId) => {
  const modal = document.getElementById('explanation-modal');
  const body = document.getElementById('explanation-modal-body');
  if (!modal || !body) return;

  modal.style.display = 'flex';
  body.innerHTML = `
    <div style="text-align:center; padding:2rem;">
      <div class="spinner" style="margin-bottom:0.5rem;"></div>
      <span style="font-size:0.875rem; color:var(--text-3);">Generating AI Campaign Performance report...</span>
    </div>
  `;

  try {
    const response = await apiCall(`/campaigns/${campaignId}/explanation`);
    const report = response || {};
    
    let recsHtml = '';
    if (report.recommendations && report.recommendations.length > 0) {
      recsHtml = `
        <h4 style="margin-top:1.25rem; margin-bottom:0.5rem; font-size:0.9rem; color:var(--text-1);">AI Recommendations</h4>
        <ul style="list-style:disc; padding-left:1.25rem; font-size:0.85rem; color:var(--text-2); display:flex; flex-direction:column; gap:0.4rem;">
          ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>
      `;
    }

    body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        <div>
          <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-3); font-weight:600; letter-spacing:0.05em;">Campaign Status</span>
          <div style="margin-top:0.25rem;">
            <span class="badge ${report.status === 'Success' ? 'badge-success' : report.status === 'Failed' ? 'badge-danger' : 'badge-warning'}">${report.status || 'Mixed'}</span>
          </div>
        </div>
        <div>
          <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-3); font-weight:600; letter-spacing:0.05em;">Performance Analysis</span>
          <p style="font-size:0.875rem; color:var(--text-2); line-height:1.6; margin-top:0.25rem;">${report.explanation || 'Performance analysis is unavailable.'}</p>
        </div>
        ${recsHtml}
      </div>
    `;

  } catch (err) {
    console.error('Failed to load campaign explanation:', err);
    body.innerHTML = `<p style="color:var(--danger); text-align:center; padding:1.5rem;">Failed to load AI Report: ${err.message}</p>`;
  }
};

window.closeExplanationModal = () => {
  document.getElementById('explanation-modal').style.display = 'none';
};
