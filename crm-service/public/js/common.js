// API utility helpers
const API_URL = '/api';

const getAuthToken = () => localStorage.getItem('token');

const getUserInfo = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

const setAuthData = (token, user) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

const clearAuthData = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// Custom fetch wrapper with JWT auth headers
const apiCall = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    clearAuthData();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    console.error("Invalid JSON:", text);
    throw new Error('Invalid JSON response from server');
  }

  if (!response.ok) throw new Error(data.message || data.error || 'API request failed');

  // Automatically unpack standardized { success: true, data: ... } envelopes
  if (data && data.success === true && data.data !== undefined) {
    return data.data;
  }

  return data;
};

// Check auth; optionally enforce role
const checkAuth = (requiredRole) => {
  const user = getUserInfo();
  if (!user || !getAuthToken()) {
    window.location.href = '/login';
    return null;
  }

  if (requiredRole && user.role !== requiredRole) {
    window.location.href = user.role === 'marketer' ? '/marketer' : '/customer';
    return null;
  }

  return user;
};

// Populate sidebar user info
const populateSidebarProfile = () => {
  const user = getUserInfo();
  if (!user) return;

  const nameEl   = document.getElementById('sidebar-user-name');
  const roleEl   = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-user-avatar');

  if (nameEl)   nameEl.textContent   = user.name;
  if (roleEl)   roleEl.textContent   = user.role;
  if (avatarEl) avatarEl.textContent = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  // Logout
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearAuthData();
      window.location.href = '/login';
    });
  }
};

// Format currency (INR)
const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
}).format(amount);
