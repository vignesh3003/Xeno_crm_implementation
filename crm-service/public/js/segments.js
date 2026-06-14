let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  currentUser = checkAuth('marketer');
  if (!currentUser) return;

  populateSidebarProfile();
  loadSegments();
});

async function loadSegments() {
  const container = document.getElementById('segments-list-grid');
  try {
    const segments = await apiCall('/segments');

    if (segments.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-state-icon">◈</div>
          <div class="empty-state-title">No segments yet</div>
          <div class="empty-state-desc">Make sure orders exist in the database to compute segments</div>
        </div>`;
      return;
    }

    container.innerHTML = segments.map(seg => `
      <div class="card segment-card card-hover"
           onclick="viewSegment('${seg.name}', '${(seg.description || '').replace(/'/g, "\\'")}', ${seg.customerCount})"
           id="seg-card-${seg.name.replace(/\s/g,'-')}">
        <div class="segment-card-header">
          <div>
            <div class="segment-name">${seg.name}</div>
          </div>
          <div class="segment-count">${seg.customerCount}</div>
        </div>
        <div class="segment-desc">${seg.description || 'No description available.'}</div>
        <div class="segment-footer">
          <span class="segment-users-label">${seg.customerCount} customer${seg.customerCount !== 1 ? 's' : ''}</span>
          <span style="font-size:0.75rem; color:var(--accent);">View →</span>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-icon">△</div>
        <div class="empty-state-title">Failed to load segments</div>
        <div class="empty-state-desc">${err.message}</div>
      </div>`;
  }
}

window.viewSegment = async (name, description, count) => {
  const detailSec = document.getElementById('segment-details-section');
  const titleEl   = document.getElementById('active-segment-title');
  const descEl    = document.getElementById('active-segment-desc');
  const badgeEl   = document.getElementById('active-segment-badge');
  const tbody     = document.getElementById('segment-users-table-body');

  titleEl.textContent = name;
  descEl.textContent  = description;
  badgeEl.textContent = `${count} customer${count !== 1 ? 's' : ''}`;
  detailSec.style.display = 'block';
  detailSec.scrollIntoView({ behavior: 'smooth', block: 'start' });

  tbody.innerHTML = `
    <tr>
      <td colspan="4" style="text-align:center; padding:2rem;">
        <div class="loading-state" style="padding:1rem;">
          <div class="spinner"></div>
          <span>Loading customers...</span>
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
          <td style="font-weight:500;">${cust.name}</td>
          <td style="color:var(--text-2);">${cust.email}</td>
          <td style="color:var(--text-2);">${joined}</td>
          <td>
            <button class="btn btn-secondary btn-sm"
              onclick="quickTargetCampaign('${cust.email}')">
              Target
            </button>
          </td>
        </tr>`;
    }).join('');

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; color:var(--danger); padding:2rem;">
          Error: ${err.message}
        </td>
      </tr>`;
  }
};

window.quickTargetCampaign = (email) => {
  localStorage.setItem('quickTargetRecipient', email);
  window.location.href = '/campaigns';
};
