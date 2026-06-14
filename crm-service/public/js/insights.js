let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  currentUser = checkAuth('marketer');
  if (!currentUser) return;

  populateSidebarProfile();
  loadInsights();
});

async function loadInsights() {
  const loadingEl   = document.getElementById('insights-loading');
  const containerEl = document.getElementById('insights-container');
  const btn         = document.getElementById('btn-refresh-insights');

  loadingEl.style.display   = 'flex';
  containerEl.style.display = 'none';
  if (btn) btn.disabled = true;

  try {
    const insights = await apiCall('/ai/insights');

    if (!insights || insights.length === 0) {
      loadingEl.style.display = 'none';
      containerEl.style.display = 'flex';
      containerEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✦</div>
          <div class="empty-state-title">No insights available</div>
          <div class="empty-state-desc">Make sure segments have members to generate insights</div>
        </div>`;
      return;
    }

    containerEl.innerHTML = insights.map(insight => {
      const convProb = insight.conversionProbability || 10;
      let convBadgeClass = 'badge-warning';
      if (convProb >= 25) convBadgeClass = 'badge-success';
      else if (convProb >= 15) convBadgeClass = 'badge-info';

      const channelIcon = getChannelIcon(insight.channel);
      const obsList = Array.isArray(insight.observations)
        ? insight.observations.map(o => `<li>${o}</li>`).join('')
        : '<li>Regular shopping patterns observed.</li>';

      return `
        <div class="insight-card">
          <div class="insight-main">
            <div class="insight-segment-name">${insight.segmentName}</div>
            <div class="insight-summary">${insight.summary || ''}</div>

            <div class="insight-section-label">Key observations</div>
            <ul class="observations-list">${obsList}</ul>

            <div class="insight-section-label" style="margin-top:1.25rem;">Marketing opportunity</div>
            <div class="insight-opportunity">${insight.opportunity || '—'}</div>
          </div>

          <div class="insight-sidebar">
            <div class="insight-stat">
              <span class="insight-stat-label">Channel</span>
              <span class="insight-stat-value">${channelIcon} ${insight.channel || 'Email'}</span>
            </div>
            <div class="insight-stat">
              <span class="insight-stat-label">Est. Conversion</span>
              <span class="insight-stat-value">
                <span class="badge ${convBadgeClass}" style="font-size:0.85rem; padding:0.3rem 0.75rem;">${convProb}%</span>
              </span>
            </div>

            <div class="insight-action-box">
              <div class="insight-action-label">Recommended action</div>
              <div class="insight-action-text">${insight.action || '—'}</div>
              <button class="btn btn-primary btn-full btn-sm"
                onclick="prefillCampaign('${insight.segmentName}', '${(insight.action || '').replace(/'/g, "\\'")}', '${insight.channel}')">
                Build campaign
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    loadingEl.style.display   = 'none';
    containerEl.style.display = 'flex';

  } catch (err) {
    console.error(err);
    loadingEl.style.display = 'none';
    containerEl.style.display = 'flex';
    containerEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">△</div>
        <div class="empty-state-title">Failed to load insights</div>
        <div class="empty-state-desc">${err.message}</div>
        <button class="btn btn-secondary btn-sm" onclick="loadInsights()" style="margin-top:1rem;">Retry</button>
      </div>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

window.prefillCampaign = (segment, goal, channel) => {
  localStorage.setItem('prefillSegment', segment);
  localStorage.setItem('prefillGoal', goal);
  localStorage.setItem('prefillChannel', channel);
  window.location.href = '/campaigns';
};

function getChannelIcon(channel) {
  switch (channel) {
    case 'WhatsApp': return '💬';
    case 'Email':    return '✉';
    case 'SMS':      return '📱';
    default:         return '✉';
  }
}
