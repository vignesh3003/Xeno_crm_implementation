let currentUser  = null;
let currentCart  = null;
let appliedCoupon = '';
let productsCache = [];

document.addEventListener('DOMContentLoaded', () => {
  currentUser = checkAuth('customer');
  if (!currentUser) return;

  populateSidebarProfile();
  loadProfileInfo();
  loadProducts();
  loadCart();
  loadOrders();
  loadOffers();
  checkNotifications();
  loadInbox();
});

// ─── Section switcher (uses .active class now) ───
window.showSection = (sectionId) => {
  // Hide all sections
  document.querySelectorAll('.content-section').forEach(sec => {
    sec.classList.remove('active');
  });
  // Show target
  const target = document.getElementById(`section-${sectionId}`);
  if (target) target.classList.add('active');

  // Update sidebar active
  document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
  const menuItem = document.getElementById(`menu-${sectionId}`);
  if (menuItem) menuItem.classList.add('active');

  // Reload data on switch
  if (sectionId === 'cart')   loadCart();
  if (sectionId === 'orders') loadOrders();
  if (sectionId === 'inbox')  {
    loadInbox().then(() => {
      // Automatically mark displayed unread inbox campaigns as opened
      const unread = inboxCampaigns.filter(c => c.status === 'Sent' || c.status === 'Delivered');
      unread.forEach(async (c) => {
        try {
          await apiCall(`/campaigns/communication/${c._id}/open`, { method: 'POST' });
        } catch(e){}
      });
      if (unread.length > 0) {
        setTimeout(loadInbox, 1500);
      }
    });
  }
};

// ─── Profile ───
const loadProfileInfo = () => {
  const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('profile-name').textContent   = currentUser.name;
  document.getElementById('profile-email').textContent  = currentUser.email;
  document.getElementById('profile-id').textContent     = currentUser._id || 'Seed User';
  document.getElementById('profile-role').textContent   = 'Customer Account';
  document.getElementById('profile-avatar').textContent = initials;
};

// ─── Products ───
async function loadProducts() {
  const container = document.getElementById('products-list-container');
  try {
    const products = await apiCall('/products');
    productsCache  = products;

    if (products.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-state-icon">◎</div>
          <div class="empty-state-title">No products available</div>
          <div class="empty-state-desc">The store is empty. Run the seed script to populate products.</div>
        </div>`;
      return;
    }

    container.innerHTML = products.map(product => `
      <div class="product-card">
        <div class="product-img">${getProductEmoji(product.category)}</div>
        <div class="product-info">
          <span class="product-category">${product.category}</span>
          <h3 class="product-name">${product.name}</h3>
          <p class="product-desc">${product.description || 'Premium store item.'}</p>
          <div class="product-footer">
            <span class="product-price">₹${product.price.toLocaleString('en-IN')}</span>
            <button class="btn btn-primary btn-sm" onclick="addProductToCart('${product._id}')">Add to cart</button>
          </div>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-icon">△</div>
        <div class="empty-state-title">Error loading products</div>
        <div class="empty-state-desc">${err.message}</div>
      </div>`;
  }
}

// ─── Cart ───
async function loadCart() {
  const cartList        = document.getElementById('cart-items-list');
  const summarySubtotal = document.getElementById('summary-subtotal');
  const summaryDiscount = document.getElementById('summary-discount');
  const summaryTotal    = document.getElementById('summary-total');
  const badgeCount      = document.getElementById('cart-badge-count');

  try {
    const cart = await apiCall('/cart');
    currentCart = cart;

    let totalQuantity = 0;
    let subtotal      = 0;

    if (!cart || !cart.items || cart.items.length === 0) {
      cartList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">◎</div>
          <div class="empty-state-title">Your cart is empty</div>
          <div class="empty-state-desc">Browse the Products tab and add items to get started</div>
        </div>`;
      summarySubtotal.textContent = '₹0';
      summaryDiscount.textContent = '−₹0';
      summaryTotal.textContent    = '₹0';
      badgeCount.style.display    = 'none';
      return;
    }

    cartList.innerHTML = cart.items.map(item => {
      const product   = item.product;
      const lineTotal = product.price * item.quantity;
      subtotal        += lineTotal;
      totalQuantity   += item.quantity;

      return `
        <div class="cart-item-row">
          <div class="cart-item-details">
            <div class="cart-item-name">${product.name}</div>
            <div class="cart-item-price">₹${product.price.toLocaleString('en-IN')} each</div>
          </div>
          <div class="cart-item-actions">
            <button class="btn btn-secondary btn-sm" onclick="updateCartQuantity('${product._id}', ${item.quantity - 1})">−</button>
            <span style="font-weight:600; min-width:24px; text-align:center;">${item.quantity}</span>
            <button class="btn btn-secondary btn-sm" onclick="updateCartQuantity('${product._id}', ${item.quantity + 1})">+</button>
            <span style="font-weight:600; min-width:70px; text-align:right; font-size:0.875rem;">₹${lineTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>`;
    }).join('');

    // Badge
    if (totalQuantity > 0) {
      badgeCount.textContent    = totalQuantity;
      badgeCount.style.display  = 'inline-flex';
    } else {
      badgeCount.style.display = 'none';
    }

    // Coupon discount
    let discount = 0;
    if (appliedCoupon === 'DISCOUNT10')  discount = Math.floor(subtotal * 0.10);
    if (appliedCoupon === 'FESTIVAL20')  discount = Math.floor(subtotal * 0.20);

    summarySubtotal.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
    summaryDiscount.textContent = `−₹${discount.toLocaleString('en-IN')}`;
    summaryTotal.textContent    = `₹${(subtotal - discount).toLocaleString('en-IN')}`;

  } catch (err) {
    console.error(err);
    cartList.innerHTML = `
      <p style="color:var(--danger); text-align:center; padding:1.5rem;">Error loading cart: ${err.message}</p>`;
  }
}

// ─── Add to cart ───
window.addProductToCart = async (productId) => {
  try {
    await apiCall('/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity: 1 })
    });
    await loadCart();
    // Show a subtle toast instead of alert
    showToast('Added to cart!');
  } catch (err) {
    alert('Failed to add product: ' + err.message);
  }
};

// ─── Update quantity ───
window.updateCartQuantity = async (productId, quantity) => {
  try {
    await apiCall('/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity })
    });
    await loadCart();
  } catch (err) {
    alert('Failed to update quantity: ' + err.message);
  }
};

// ─── Apply promo code ───
window.applyPromoCode = () => {
  const code     = document.getElementById('coupon-code').value.trim().toUpperCase();
  const statusEl = document.getElementById('coupon-status');

  if (code === 'DISCOUNT10' || code === 'FESTIVAL20') {
    appliedCoupon = code;
    const pct = code === 'DISCOUNT10' ? '10%' : '20%';
    statusEl.textContent = `✓ Code "${code}" applied — ${pct} off`;
    statusEl.style.color = 'var(--success)';
    loadCart();
  } else if (code === '') {
    appliedCoupon = '';
    statusEl.textContent = '';
    loadCart();
  } else {
    appliedCoupon = '';
    statusEl.textContent = 'Invalid promo code';
    statusEl.style.color = 'var(--danger)';
    loadCart();
  }
};

// ─── Checkout ───
window.handleCheckout = async () => {
  const notification = document.getElementById('checkout-notification');
  const btn = document.querySelector('[onclick="handleCheckout()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

  try {
    const order = await apiCall('/orders', {
      method: 'POST',
      body: JSON.stringify({ couponCode: appliedCoupon })
    });

    notification.textContent    = `Order placed successfully! ID: ${order._id}`;
    notification.className      = 'alert alert-success';
    notification.style.display  = 'block';

    // Reset coupon
    appliedCoupon = '';
    document.getElementById('coupon-code').value = '';
    document.getElementById('coupon-status').textContent = '';

    await loadCart();
    await loadOrders();

    setTimeout(() => { notification.style.display = 'none'; }, 6000);

  } catch (err) {
    notification.textContent   = 'Checkout failed: ' + err.message;
    notification.className     = 'alert alert-danger';
    notification.style.display = 'block';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Checkout'; }
  }
};

// ─── Order History ───
async function loadOrders() {
  const tbody = document.getElementById('orders-table-body');
  try {
    const orders = await apiCall('/orders');

    if (orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; color:var(--text-2); padding:2rem;">
            No orders placed yet.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = orders.map(order => {
      const itemsList = order.items.map(item => {
        const name = item.product ? item.product.name : 'Unknown';
        return `${name} ×${item.quantity}`;
      }).join(', ');

      const date = new Date(order.purchaseDate).toLocaleDateString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric'
      });

      return `
        <tr>
          <td><code style="font-size:0.75rem;">${order._id.slice(-8)}…</code></td>
          <td style="color:var(--text-2);">${date}</td>
          <td style="max-width:200px; font-size:0.82rem; color:var(--text-2);">${itemsList}</td>
          <td style="color:var(--success);">₹${(order.discountApplied || 0).toLocaleString('en-IN')}</td>
          <td style="font-weight:600;">₹${order.totalAmount.toLocaleString('en-IN')}</td>
          <td>
            ${order.isFestivalPeriod
              ? '<span class="badge badge-warning">Festival</span>'
              : '<span style="font-size:0.78rem; color:var(--text-3);">No</span>'}
          </td>
        </tr>`;
    }).join('');

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; color:var(--danger); padding:1.5rem;">
          Error: ${err.message}
        </td>
      </tr>`;
  }
}

// ─── Category emoji ───
function getProductEmoji(category) {
  const map = {
    'Electronics': '⚡',
    'Apparel':     '👕',
    'Home':        '⌂',
    'Accessories': '◈',
    'Sports':      '◎',
    'Beauty':      '✦',
    'Books':       '△',
    'Toys':        '◇',
  };
  return map[category] || '◈';
}

// ─── Minimal toast notification ───
function showToast(msg) {
  // Remove existing toast
  const existing = document.getElementById('toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast-notification';
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '1.5rem',
    right: '1.5rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-1)',
    padding: '0.625rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.82rem',
    fontFamily: 'var(--font-sans)',
    boxShadow: 'var(--shadow-md)',
    zIndex: '9999',
    animation: 'fadeIn 0.2s ease',
  });

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// ─── Offers / Targeted Campaigns ───
async function loadOffers() {
  const container = document.getElementById('offers-for-you-container');
  const list = document.getElementById('offers-list');
  if (!container || !list) return;

  try {
    const campaigns = await apiCall('/campaigns/customer');
    if (!campaigns || campaigns.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';

    list.innerHTML = campaigns.map(camp => {
      // Find promo code in the message copy (e.g. DISCOUNT10, FESTIVAL20, etc.)
      const match = camp.messageTemplate.match(/[A-Z0-9]{5,15}/g);
      let couponCode = '';
      if (match) {
        couponCode = match.find(c => c.includes('DISCOUNT') || c.includes('FESTIVAL') || c.includes('WELCOME') || c.includes('VIP') || c.includes('BACK'));
        if (!couponCode) couponCode = match[0];
      }

      const copyBtnHtml = couponCode ? `
        <button class="btn btn-primary btn-sm" onclick="copyPromoCode('${couponCode}')" style="margin-left:auto; font-size:0.75rem; padding:0.25rem 0.6rem; flex-shrink:0;">
          Use Code: ${couponCode}
        </button>
      ` : '';

      return `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:0.875rem 1.25rem; border:1px dashed var(--accent); background:rgba(79, 70, 229, 0.03); border-radius:var(--radius-md);">
          <div style="display:flex; align-items:center; gap:0.75rem; flex-grow:1;">
            <div style="font-size:1.5rem; flex-shrink:0;">🎁</div>
            <div>
              <div style="font-weight:600; color:var(--text-1); font-size:0.9rem;">${camp.name}</div>
              <div style="font-size:0.8rem; color:var(--text-2); margin-top:0.15rem;">${camp.messageTemplate}</div>
            </div>
          </div>
          ${copyBtnHtml}
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load targeted offers:', err);
    container.style.display = 'none';
  }
}

window.copyPromoCode = (code) => {
  const input = document.getElementById('coupon-code');
  if (input) {
    input.value = code;
    showSection('cart');
    applyPromoCode();
    showToast(`Code "${code}" applied to cart!`);
  }
};

let inboxCampaigns = [];

async function checkNotifications() {
  try {
    const notification = await apiCall('/campaigns/notifications/unseen');
    if (notification && notification.campaignId) {
      const modal = document.getElementById('campaign-announcement-modal');
      const titleEl = document.getElementById('announcement-title');
      const msgEl = document.getElementById('announcement-message');
      const closeBtn = document.getElementById('btn-close-announcement');
      
      if (modal && titleEl && msgEl && closeBtn) {
        titleEl.textContent = notification.campaignId.name || 'Special Offer!';
        msgEl.textContent = notification.campaignId.messageTemplate || 'You have a new offer!';
        modal.style.display = 'flex';
        
        // Track open state
        apiCall(`/campaigns/communication/${notification.campaignId._id}/open`, {
          method: 'POST'
        }).catch(err => console.warn('Failed to track open:', err));

        closeBtn.onclick = async () => {
          modal.style.display = 'none';
          try {
            await apiCall(`/campaigns/notifications/${notification._id}/seen`, {
              method: 'PUT'
            });
            loadInbox();
          } catch (err) {
            console.error('Failed to mark seen:', err);
          }
        };
      }
    }
  } catch (err) {
    console.warn('Failed to check campaign notifications:', err);
  }
}

async function loadInbox() {
  const list = document.getElementById('inbox-messages-list');
  const badge = document.getElementById('inbox-badge-count');
  if (!list) return;

  try {
    const campaigns = await apiCall('/campaigns/customer');
    inboxCampaigns = campaigns || [];

    // Update unread badge count (where status is Sent or Delivered)
    const unreadCount = inboxCampaigns.filter(c => c.status === 'Sent' || c.status === 'Delivered').length;
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }

    if (inboxCampaigns.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✉</div>
          <div class="empty-state-title">Your inbox is clean</div>
          <div class="empty-state-desc">You will receive special campaign offers and discount vouchers here.</div>
        </div>`;
      return;
    }

    list.innerHTML = inboxCampaigns.map(camp => {
      let statusBadgeClass = 'badge-warning';
      let statusText = 'Sent';
      
      if (camp.status === 'Delivered') {
        statusBadgeClass = 'badge-info';
        statusText = 'Delivered';
      } else if (camp.status === 'Opened') {
        statusBadgeClass = 'badge-accent';
        statusText = 'Opened';
      } else if (camp.status === 'Clicked') {
        statusBadgeClass = 'badge-success';
        statusText = 'Clicked';
      } else if (camp.status === 'Converted') {
        statusBadgeClass = 'badge-success';
        statusText = 'Converted';
      }

      // Check for discount promo codes to use directly
      const match = camp.messageTemplate.match(/[A-Z0-9]{5,15}/g);
      let couponCode = '';
      if (match) {
        couponCode = match.find(c => c.includes('DISCOUNT') || c.includes('FESTIVAL') || c.includes('WELCOME') || c.includes('VIP') || c.includes('BACK'));
        if (!couponCode) couponCode = match[0];
      }

      const actionBtnHtml = couponCode ? `
        <button class="btn btn-secondary btn-sm" onclick="copyPromoCode('${couponCode}')" style="margin-top:0.5rem; font-size:0.75rem;">
          Apply Code: ${couponCode}
        </button>
      ` : '';

      const dateStr = new Date(camp.sentAt).toLocaleDateString('en-IN', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      return `
        <div style="padding:1.25rem; border-bottom:1px solid var(--border); display:flex; flex-direction:column; gap:0.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:600; color:var(--text-1); font-size:0.95rem;">${camp.name}</div>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <span class="badge ${statusBadgeClass}" style="font-size:0.7rem; padding:0.2rem 0.5rem;">${statusText}</span>
              <span style="font-size:0.75rem; color:var(--text-3);">${dateStr}</span>
            </div>
          </div>
          <div style="font-size:0.85rem; color:var(--text-2); line-height:1.5;">${camp.messageTemplate}</div>
          ${actionBtnHtml}
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load inbox campaigns:', err);
    list.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--danger);">Failed to load inbox: ${err.message}</div>`;
  }
}
