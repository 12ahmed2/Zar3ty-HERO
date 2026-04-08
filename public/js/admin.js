// public/js/admin.js — Admin dashboard (Fully Updated with Order Details Modal)
const ORDER_STATUS = ['created','paid','processing','shipped','cancelled','cancelled_by_user'];

let PRODUCTS = [];
let COURSES = [];
let selectedUser = null;
let ordersFilter = { q: '', status: '', userId: null };
let editingCourseId = null;

/* ---------------- API helper ---------------- */
function getFP() {
  let v = localStorage.getItem('client_fp');
  if (!v) {
    v = [...crypto.getRandomValues(new Uint8Array(16))]
      .map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('client_fp', v);
  }
  document.cookie = 'fp=' + v + '; Path=/; SameSite=Strict' + (location.protocol === 'https:' ? '; Secure' : '');
  return v;
}

async function api(path, { method = 'GET', json, headers = {}, credentials = 'include' } = {}, _retry = false) {
  const opts = { method, credentials, headers: { 'x-client-fingerprint': getFP(), ...headers } };
  if (json !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(json); }
  const res = await fetch(path, opts);
  const txt = await res.text().catch(() => null);
  let data;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  if (!res.ok) {
    if (res.status === 401 && !_retry) {
      await fetch('/refresh', { method: 'POST', credentials: 'include', headers: { 'x-client-fingerprint': getFP() } }).catch(() => {});
      return api(path, { method, json, headers, credentials }, true);
    }
    const err = new Error(data?.error || res.statusText); err.status = res.status; err.data = data; throw err;
  }
  return data;
}

/* ---------------- Elements ----------------- */
const els = {
  filter: document.querySelector('#filter-users'),
  list: document.querySelector('#list'),
  detail: document.querySelector('#detail'),
  form: document.querySelector('#form-create'),
  msg: document.querySelector('#create-msg'),

  pForm: document.querySelector('#form-product-create'),
  pMsg: document.querySelector('#p-create-msg'),
  pFilter: document.querySelector('#filter-products'),
  pList: document.querySelector('#products-list'),

  pEditModal: document.querySelector('#modal-p-edit'),
  pEditForm: document.querySelector('#form-edit-product'),
  pEditMsg: document.querySelector('#p-edit-msg'),

  cForm: document.querySelector('#form-c-create'),
  cMsg: document.querySelector('#c-create-msg'),
  cFilter: document.querySelector('#filter-courses'),
  cList: document.querySelector('#courses-list'),
  cEditModal: document.querySelector('#modal-c-edit'),
  cEditForm: document.querySelector('#form-edit-course'),
  cEditMsg: document.querySelector('#c-edit-msg'),
  modulesList: document.querySelector('#modules-list'),
};

/* ---------------- Render helpers ----------- */
const fmtMD = ts => ts ? new Date(ts).toLocaleDateString(undefined, { month:'short', day:'2-digit', year:'numeric' }) : '';
const dollars = c => (Number(c||0)/100).toFixed(2);
const centsFromFloat = x => { const n = parseFloat(x); return Number.isFinite(n) ? Math.round(n*100) : 0; };

function userRow(u){
  return `
  <div class="user-card" data-user="${u.id}">
    <div class="user-head">
      <div>
        <button class="link" data-open="${u.id}"><strong>${u.fullname || '(no name)'}</strong></button>
        ${u.is_admin ? '<span class="badge">admin</span>' : ''}
        <div class="muted">${u.email}</div>
      </div>
      <div class="hstack gap">
        <button class="btn sm" data-toggle="${u.id}" data-flag="${u.is_admin ? 0 : 1}">${u.is_admin ? 'Revoke admin' : 'Make admin'}</button>
        <button class="btn danger sm" data-del="${u.id}">Delete</button>
      </div>
    </div>
  </div>`;
}

function orderRow(o){
  const itemsCount = (o.items||[]).length;
  const opts = ORDER_STATUS.map(s => `<option value="${s}" ${s===o.status?'selected':''}>${s}</option>`).join('');
  
  return `
    <tr data-order-row="${o.id}">
      <td style="white-space:nowrap;">${fmtMD(o.created_at)}</td>
      <td style="white-space:nowrap;">$${dollars(o.total_cents)}</td>
      <td style="white-space:nowrap;">
        <select class="order-status" data-order="${o.id}" style="min-width:140px;">${opts}</select>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="color:#64748b;">${itemsCount} item${itemsCount!==1?'s':''}</span>
          <button class="btn ghost sm view-order-details" data-order='${JSON.stringify(o).replace(/'/g, "&apos;")}' style="min-width:auto;padding:4px 8px;">
            👁️ Details
          </button>
        </div>
      </td>
    </tr>
  `;
}

function groupByUser(orders){
  const m = new Map();
  for (const o of orders) {
    const k = o.user_id;
    if (!m.has(k)) m.set(k, { user_id:k, email:o.email, fullname:o.fullname, orders:[] });
    m.get(k).orders.push(o);
  }
  return [...m.values()].sort((a,b)=>String(a.fullname||a.email).localeCompare(String(b.fullname||b.email)));
}

function renderLanding(){
  if (!els.detail) return;
  const who = selectedUser
    ? `<div class="muted">Selected user:</div>
       <div><strong>${selectedUser.fullname||'(no name)'}</strong><div class="muted">${selectedUser.email}</div></div>
       <div class="hstack gap mt-8"><button id="btn-show-user" class="btn">Show this user's orders</button><button id="btn-show-all" class="btn ghost">Show all orders</button></div>`
    : `<div class="muted">Orders are hidden.</div><div class="hstack gap mt-8"><button id="btn-show-all" class="btn">Show all orders</button></div>`;
  els.detail.innerHTML = `<div class="user-card"><h2 class="pane-title">Orders</h2>${who}</div>`;
}

function renderOrdersPane(orders){
  if (!els.detail) return;
  const groups = groupByUser(orders);
  const statusOpts = [''].concat(ORDER_STATUS).map(s=>`<option value="${s}">${s||'any'}</option>`).join('');
  const scope = ordersFilter.userId && selectedUser ? `${selectedUser.fullname||selectedUser.email}` : 'all users';
  
  const groupsHtml = groups.map(g => `
    <details class="group" open>
      <summary class="group-head">
        <div>
          <strong>${g.fullname||'(no name)'}</strong>
          <div class="muted">${g.email}</div>
        </div>
        <span class="pill">${g.orders.length} order${g.orders.length===1?'':'s'}</span>
      </summary>
      <div class="group-body">
        <table class="orders">
          <thead>
            <tr>
              <th style="width:120px;">Date</th>
              <th style="width:100px;">Total</th>
              <th style="width:160px;">Status</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>${g.orders.map(orderRow).join('')}</tbody>
        </table>
      </div>
    </details>
  `).join('');

  els.detail.innerHTML = `
    <div class="user-card">
      <div class="row">
        <h2 class="pane-title">Orders <span class="muted">(${scope})</span></h2>
        <div class="hstack">
          <input id="orders-q" class="input" placeholder="Search user (name/email)" value="${ordersFilter.q}" style="min-width:200px;">
          <select id="orders-status" class="input" style="min-width:120px;">${statusOpts}</select>
          <button id="orders-clear" class="btn ghost sm">Clear</button>
          ${ordersFilter.userId ? `<button id="orders-unfilter" class="btn ghost sm">All users</button>` : ''}
          <button id="orders-close" class="btn sm">Hide</button>
        </div>
      </div>
      <div class="mt-12 vstack gap orders-scroll">${groupsHtml || '<div class="muted">No orders.</div>'}</div>
    </div>`;

  const sel = els.detail.querySelector('#orders-status'); if (sel) sel.value = ordersFilter.status || '';
  
  // Attach event listeners for order details modal
  els.detail.querySelectorAll('.view-order-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const orderData = btn.dataset.order;
      try {
        const order = JSON.parse(orderData.replace(/&apos;/g, "'"));
        showOrderDetails(order);
      } catch(err) {
        console.error('Failed to parse order data:', err);
      }
    });
  });
}

/* ---------------- Order Details Modal ---------------- */
function showOrderDetails(order) {
  // Remove existing modal if any
  const existingModal = document.querySelector('.order-details-modal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.className = 'order-details-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.8);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);';
  
  const itemsHtml = (order.items || []).map(item => `
    <div style="display:flex;justify-content:space-between;padding:10px;background:#f8fafc;border-radius:8px;margin-bottom:8px;">
      <span style="font-weight:600;color:#1e293b;">${item.name || 'Product #' + item.product_id}</span>
      <span style="color:#64748b;">× ${item.qty}</span>
      <span style="font-weight:700;color:#2563eb;">$${((item.price_cents * item.qty) / 100).toFixed(2)}</span>
    </div>
  `).join('');
  
  const shippingAddress = order.shipping_address ? (typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address) : null;
  const billingAddress = order.billing_address ? (typeof order.billing_address === 'string' ? JSON.parse(order.billing_address) : order.billing_address) : null;
  
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);animation:modalSlideIn 0.3s ease;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:24px;border-bottom:2px solid #e2e8f0;position:sticky;top:0;background:#fff;z-index:10;">
        <h3 style="margin:0;font-size:1.5rem;font-weight:800;color:#0f172a;">Order #${order.id}</h3>
        <button class="close-modal" style="background:none;border:none;font-size:2rem;cursor:pointer;color:#64748b;line-height:1;padding:0;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:8px;transition:all 0.2s;">&times;</button>
      </div>
      
      <div style="padding:24px;">
        <!-- Status Badge -->
        <div style="margin-bottom:24px;">
          <span class="badge badge-${order.status}" style="display:inline-block;padding:8px 16px;border-radius:20px;font-size:0.9rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:${getStatusColor(order.status)};color:#fff;">
            ${order.status.replace('_', ' ')}
          </span>
        </div>
        
        <!-- Order Info Grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
          <div style="background:#f8fafc;padding:16px;border-radius:12px;">
            <div style="font-size:0.85rem;color:#64748b;margin-bottom:4px;">Order Date</div>
            <div style="font-weight:700;color:#0f172a;">${new Date(order.created_at).toLocaleString()}</div>
          </div>
          <div style="background:#f8fafc;padding:16px;border-radius:12px;">
            <div style="font-size:0.85rem;color:#64748b;margin-bottom:4px;">Total Amount</div>
            <div style="font-weight:700;color:#2563eb;font-size:1.25rem;">$${(order.total_cents/100).toFixed(2)}</div>
          </div>
        </div>
        
        <!-- Customer Info -->
        <div style="margin-bottom:24px;">
          <h4 style="margin:0 0 12px 0;font-size:1.1rem;font-weight:700;color:#0f172a;">Customer Information</h4>
          <div style="background:#f8fafc;padding:16px;border-radius:12px;">
            ${order.customer_phone ? `<div style="margin-bottom:8px;"><span style="color:#64748b;">Phone:</span> <span style="font-weight:600;color:#1e293b;">${order.customer_phone}</span></div>` : ''}
            ${shippingAddress?.full ? `<div style="margin-bottom:8px;"><span style="color:#64748b;">Shipping Address:</span><div style="font-weight:600;color:#1e293b;margin-top:4px;">${shippingAddress.full}${shippingAddress.city ? ', ' + shippingAddress.city : ''}${shippingAddress.country ? ', ' + shippingAddress.country : ''}</div></div>` : ''}
            ${order.notes || shippingAddress?.notes ? `<div><span style="color:#64748b;">Notes:</span> <div style="font-weight:600;color:#1e293b;margin-top:4px;">${order.notes || shippingAddress.notes}</div></div>` : ''}
          </div>
        </div>
        
        <!-- Order Items -->
        <div style="margin-bottom:24px;">
          <h4 style="margin:0 0 12px 0;font-size:1.1rem;font-weight:700;color:#0f172a;">Order Items</h4>
          <div style="background:#f8fafc;padding:16px;border-radius:12px;">
            ${itemsHtml}
            <div style="border-top:2px solid #e2e8f0;margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:700;font-size:1.1rem;color:#0f172a;">Total</span>
              <span style="font-weight:800;font-size:1.25rem;color:#2563eb;">$${(order.total_cents/100).toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <!-- Billing Address (if different) -->
        ${billingAddress && billingAddress.full !== shippingAddress?.full ? `
        <div style="margin-bottom:24px;">
          <h4 style="margin:0 0 12px 0;font-size:1.1rem;font-weight:700;color:#0f172a;">Billing Address</h4>
          <div style="background:#f8fafc;padding:16px;border-radius:12px;">
            <div style="font-weight:600;color:#1e293b;">${billingAddress.full}${billingAddress.city ? ', ' + billingAddress.city : ''}${billingAddress.country ? ', ' + billingAddress.country : ''}</div>
          </div>
        </div>
        ` : ''}
      </div>
      
      <div style="padding:20px 24px;border-top:2px solid #e2e8f0;display:flex;justify-content:flex-end;gap:12px;position:sticky;bottom:0;background:#fff;">
        <button class="copy-order-id" style="padding:10px 20px;border-radius:8px;border:1px solid #2563eb;background:#fff;color:#2563eb;font-weight:600;cursor:pointer;transition:all 0.2s;">
          Copy Order ID
        </button>
        <button class="close-modal" style="padding:10px 20px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-weight:600;cursor:pointer;transition:all 0.2s;">
          Close
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add animation styles
  if (!document.getElementById('order-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'order-modal-styles';
    style.textContent = `
      @keyframes modalSlideIn {
        from { opacity: 0; transform: translateY(-20px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .badge-created { background: #3b82f6; }
      .badge-paid { background: #10b981; }
      .badge-processing { background: #f59e0b; }
      .badge-shipped { background: #8b5cf6; }
      .badge-cancelled, .badge-cancelled_by_user { background: #ef4444; }
    `;
    document.head.appendChild(style);
  }
  
  // Close modal handlers
  const closeButtons = modal.querySelectorAll('.close-modal');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modal.style.opacity = '0';
      modal.style.transition = 'opacity 0.3s';
      setTimeout(() => modal.remove(), 300);
    });
  });
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.opacity = '0';
      modal.style.transition = 'opacity 0.3s';
      setTimeout(() => modal.remove(), 300);
    }
  });
  
  // Copy Order ID
  const copyBtn = modal.querySelector('.copy-order-id');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`Order #${order.id}`);
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      copyBtn.style.background = '#10b981';
      copyBtn.style.color = '#fff';
      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.style.background = '#fff';
        copyBtn.style.color = '#2563eb';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  });
  
  // Close on Escape key
  const onEsc = (e) => {
    if (e.key === 'Escape') {
      modal.style.opacity = '0';
      modal.style.transition = 'opacity 0.3s';
      setTimeout(() => {
        modal.remove();
        document.removeEventListener('keydown', onEsc);
      }, 300);
    }
  };
  document.addEventListener('keydown', onEsc);
}

function getStatusColor(status) {
  const colors = {
    'created': '#3b82f6',
    'paid': '#10b981',
    'processing': '#f59e0b',
    'shipped': '#8b5cf6',
    'cancelled': '#ef4444',
    'cancelled_by_user': '#ef4444'
  };
  return colors[status] || '#64748b';
}

/* ---------------- Orders API helpers ---------------- */
async function fetchAndShowUserOrders(userId) {
  try {
    const orders = await api(`/api/admin/users/${userId}/orders`);
    const users = await api(`/api/admin/users?q=${userId}`);
    selectedUser = (Array.isArray(users) && users[0]) ? users[0] : { id: userId, fullname: '(user)', email: '' };
    ordersFilter.userId = Number(userId);
    ordersFilter.q = '';
    ordersFilter.status = '';
    renderOrdersPane(orders);
  } catch (err) {
    alert(err.data?.error || 'Failed to load user orders');
  }
}

async function fetchAndShowAllOrders(q = '', status = '') {
  try {
    ordersFilter.userId = null;
    ordersFilter.q = q || '';
    ordersFilter.status = status || '';
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    const url = '/api/admin/orders' + (params.toString() ? ('?' + params.toString()) : '');
    const orders = await api(url);
    selectedUser = null;
    renderOrdersPane(orders);
  } catch (err) {
    alert(err.data?.error || 'Failed to load orders');
  }
}

/* ----------------- Loaders --------------- */
async function loadUsers(){
  try {
    const users = await api('/api/admin/users');
    if (els.list) els.list.innerHTML = (users || []).map(userRow).join('');
  } catch (err) {
    console.error('loadUsers failed', err);
  }
}

async function loadProducts(){
  try {
    PRODUCTS = await api('/api/admin/products');
    renderProducts(PRODUCTS || []);
  } catch (err) { console.error('loadProducts failed', err); }
}

async function loadCourses(){
  try {
    COURSES = await api('/api/admin/courses');
    renderCourses(COURSES || []);
  } catch (err) { console.error('loadCourses failed', err); }
}

/* -------------- Products & Courses render -------------- */
function renderProducts(list){
  if (!els.pList) return;
  if (!list || !list.length) { els.pList.innerHTML = '<div class="muted">No products.</div>'; return; }
  els.pList.innerHTML = list.map(p => `
    <article class="product-card" data-prod="${p.id}">
      <div class="p-head">
        <div class="p-title">
          <button type="button" class="link" data-edit-prod="${p.id}">
            <strong>${p.name}</strong>
          </button>
          <div class="muted">$${dollars(p.price_cents)} ${p.stock==null?'· ∞ stock':`· stock: ${p.stock}`}</div>
        </div>
        <div class="p-actions">
          <button type="button" class="btn sm" data-edit-prod="${p.id}">Edit</button>
          <button type="button" class="btn danger sm" data-del-prod="${p.id}">Delete</button>
        </div>
      </div>
      ${p.description ? `<p class="muted">${p.description}</p>` : ''}
    </article>
  `).join('');
}

function renderCourses(list){
  if (!els.cList) return;
  if (!list || !list.length) { els.cList.innerHTML = '<div class="muted">No courses.</div>'; return; }
  els.cList.innerHTML = list.map(c => `
    <article class="product-card" data-course="${c.id}">
      <div class="p-head">
        <div class="p-title">
          <button type="button" class="link" data-edit-course="${c.id}">
            <strong>${c.title}</strong>
          </button>
          <div class="muted">${Array.isArray(c.modules) ? `${c.modules.length} Modules` : '0 Modules'}</div>
        </div>
        <div class="p-actions">
          <button type="button" class="btn sm" data-edit-course="${c.id}">Edit</button>
          <button type="button" class="btn danger sm" data-del-course="${c.id}">Delete</button>
        </div>
      </div>
      ${c.description ? `<p class="muted">${c.description}</p>` : ''}
    </article>
  `).join('');
}

/* Course module editor (Updated for Questions) */
function renderAnswer(a = {}, modIdx, qIdx, ansIdx) {
  return `
    <div class="hstack gap answer-item" data-ans-idx="${ansIdx}">
      <input type="radio" name="mod-${modIdx}-q-${qIdx}-correct" value="${ansIdx}" ${a.is_correct ? 'checked' : ''}>
      <input class="input" name="mod-${modIdx}-q-${qIdx}-ans-${ansIdx}-text" placeholder="Answer text" value="${a.text || ''}" required>
      <button type="button" class="btn danger sm" data-del-answer>✕</button>
    </div>
  `;
}

function renderQuestion(q = {}, modIdx, qIdx) {
  const answersHtml = (q.answers || []).map((a, ansIdx) => renderAnswer(a, modIdx, qIdx, ansIdx)).join('');
  return `
    <div class="f-item question-item card" data-q-idx="${qIdx}" style="border: 1px solid #ddd; padding: 10px; margin-bottom: 10px;">
      <div class="hstack space-between mb-8">
        <strong>Question ${qIdx + 1}</strong>
        <button type="button" class="btn danger sm" data-del-question>Delete Question</button>
      </div>
      <label class="vstack gap mb-8">
        <span class="lbl">Question Text</span>
        <input class="input" name="mod-${modIdx}-q-${qIdx}-text" value="${q.text || ''}" required>
      </label>
      <div class="vstack gap answers-list">
        <div class="hstack space-between">
          <span class="lbl">Answers (Select correct)</span>
          <button type="button" class="btn sm" data-add-answer="${modIdx}-${qIdx}">Add Answer</button>
        </div>
        ${answersHtml}
      </div>
    </div>
  `;
}

function renderModule(m, modIdx) {
  const videosHtml = (m.videos || []).map((v, vidIdx) => `
    <div class="f-item video-item" data-vid-idx="${vidIdx}">
      <label><span class="lbl">Video title</span>
        <input class="input" name="mod-${modIdx}-vid-${vidIdx}-title" value="${v.title || ''}" required>
      </label>
      <label><span class="lbl">Video URL (YouTube ID)</span>
        <input class="input" name="mod-${modIdx}-vid-${vidIdx}-url" value="${v.url || ''}" required>
      </label>
      <button type="button" class="btn danger sm" data-del-video="${modIdx}-${vidIdx}">Delete</button>
    </div>
  `).join('');

  const questionsHtml = (m.questions || []).map((q, qIdx) => renderQuestion(q, modIdx, qIdx)).join('');

  const el = document.createElement('div');
  el.className = 'module-card';
  el.setAttribute('data-mod-idx', modIdx);
  el.innerHTML = `
    <div class="pane-head">
      <h5 class="pane-title">
        <input class="input" name="mod-${modIdx}-title" placeholder="Module Title" value="${m.title || ''}" required>
      </h5>
      <div class="hstack gap">
        <button type="button" class="btn sm" data-add-video="${modIdx}">Add Video</button>
        <button type="button" class="btn sm" data-add-question="${modIdx}">Add Question</button>
        <button type="button" class="btn danger sm" data-del-module="${modIdx}">Delete</button>
      </div>
    </div>
    <div class="vstack gap videos-list mb-12">
      <h6 class="muted">Videos</h6>
      ${videosHtml}
    </div>
    <div class="vstack gap questions-list" style="background: #f9f9f9; padding: 10px; border-radius: 4px;">
      <h6 class="muted">Quiz Questions</h6>
      ${questionsHtml}
    </div>
  `;
  return el;
}

/* Modal editor */
function openProductModal(p){
  const overlay = els.pEditModal;
  const form    = els.pEditForm;
  if (!overlay || !form) return;
  overlay.style.display = 'flex';
  form.elements.id.value          = p.id;
  form.elements.name.value        = p.name || '';
  form.elements.description.value = p.description || '';
  form.elements.price.value       = dollars(p.price_cents || 0);
  if (form.elements.image) form.elements.image.value = '';
  form.elements.stock.value       = p.stock == null ? '' : p.stock;
}

function openCourseModal(c) {
  const overlay = els.cEditModal;
  const form = els.cEditForm;
  if (!overlay || !form) return;

  editingCourseId = c.id;
  form.elements.id.value = c.id;
  form.elements.title.value = c.title || '';
  form.elements.description.value = c.description || '';
  if (form.elements.image) form.elements.image.value = '';
  form.elements.completed.checked = c.completed_course || false;

  const modules = Array.isArray(c.modules) ? c.modules : [];
  if (els.modulesList) {
    els.modulesList.innerHTML = `<div class="pane-head"><h4 class="pane-title">Modules</h4><button type="button" class="btn sm" data-add-module>Add Module</button></div>`;
    modules.forEach((mod, modIdx) => els.modulesList.appendChild(renderModule(mod, modIdx)));
  }

  overlay.style.display = 'flex';
}

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(el => el.style.display = 'none');
}

/* ---------------- Event bindings ----------------- */
els.form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(els.form);
  const payload = {
    fullname: f.get('fullname'), email: f.get('email'),
    password: f.get('password'), is_admin: !!f.get('is_admin'),
  };
  try {
    await api('/api/admin/users', { method:'POST', json: payload });
    els.form.reset(); if (els.msg) els.msg.textContent = 'User created.'; await loadUsers();
  } catch (err) { if (els.msg) els.msg.textContent = err.data?.error || 'Create failed'; }
});

els.pForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(els.pForm);
  const fd = new FormData();
  fd.append('name', f.get('name'));
  fd.append('description', f.get('description') || '');
  fd.append('price_cents', centsFromFloat(f.get('price')));
  fd.append('stock', f.get('stock') !== '' ? Number(f.get('stock')) : '');
  const file = f.get('image');
  if (file && file.size > 0) fd.append('image', file);

  try {
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      body: fd,
      headers: { 'x-client-fingerprint': getFP() }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Create failed');
    els.pForm.reset(); if (els.pMsg) els.pMsg.textContent = 'Product created.'; await loadProducts();
  } catch (err) { if (els.pMsg) els.pMsg.textContent = err.message || 'Create failed'; }
});

els.cForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(els.cForm);
  const fd = new FormData();
  fd.append('title', f.get('title'));
  fd.append('description', f.get('description') || '');
  const file = f.get('image');
  if (file && file.size > 0) fd.append('image', file);

  try {
    const res = await fetch('/api/admin/courses', {
      method: 'POST',
      body: fd,
      headers: { 'x-client-fingerprint': getFP() }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Create failed');
    els.cForm.reset(); if (els.cMsg) els.cMsg.textContent = 'Course created.'; await loadCourses();
  } catch (err) {
    if (els.cMsg) els.cMsg.textContent = err.message || 'Create failed';
  }
});

/* Course Save logic (Updated for Questions) */
els.cEditForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const courseId = form.elements.id.value;
  const modules = [];

  form.querySelectorAll('.module-card').forEach((modEl, modIdx) => {
    // Collect Videos
    const videos = [];
    modEl.querySelectorAll('.video-item').forEach(vidEl => {
      videos.push({
        title: vidEl.querySelector('input[name*="-title"]').value,
        url: vidEl.querySelector('input[name*="-url"]').value,
      });
    });

    // Collect Questions
    const questions = [];
    modEl.querySelectorAll('.question-item').forEach(qEl => {
      const qText = qEl.querySelector('input[name$="-text"]').value;
      const answers = [];
      const correctRadio = qEl.querySelector('input[type="radio"]:checked');
      const correctIdx = correctRadio ? correctRadio.value : null;

      qEl.querySelectorAll('.answer-item').forEach((ansEl, ansIdx) => {
        answers.push({
          text: ansEl.querySelector('input[name*="-ans-"]').value,
          is_correct: correctIdx !== null && String(ansIdx) === String(correctIdx)
        });
      });

      questions.push({ text: qText, answers: answers });
    });

    modules.push({
      title: modEl.querySelector('input[name*="-title"]').value,
      videos: videos,
      questions: questions
    });
  });

  const fd = new FormData();
  fd.append('title', form.elements.title.value);
  fd.append('description', form.elements.description.value || '');
  fd.append('completed_course', form.elements.completed.checked ? 'true' : 'false');
  fd.append('modules', JSON.stringify(modules));
  const file = form.elements.image.files[0];
  if (file) fd.append('image', file);

  try {
    const res = await fetch(`/api/admin/courses/${courseId}`, {
      method: 'PUT',
      body: fd,
      headers: { 'x-client-fingerprint': getFP() }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Save failed');
    if (els.cEditMsg) els.cEditMsg.textContent = 'Course saved!';
    await loadCourses();
  } catch (err) {
    if (els.cEditMsg) els.cEditMsg.textContent = err.message || 'Save failed';
  }
});

els.pEditForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const id = form.elements.id.value;
  const fd = new FormData();
  fd.append('name', form.elements.name.value);
  fd.append('description', form.elements.description.value || '');
  fd.append('price_cents', centsFromFloat(form.elements.price.value));
  fd.append('stock', form.elements.stock.value !== '' ? Number(form.elements.stock.value) : '');
  const file = form.elements.image.files[0];
  if (file) fd.append('image', file);

  try {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: 'PUT',
      body: fd,
      headers: { 'x-client-fingerprint': getFP() }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Save failed');
    if (els.pEditMsg) els.pEditMsg.textContent = 'Product saved.';
    closeModals();
    await loadProducts();
  } catch (err) {
    if (els.pEditMsg) els.pEditMsg.textContent = err.message || 'Save failed';
  }
});

/* delegated click (Edit/Delete/Course logic) */
document.addEventListener('click', async (e) => {
  const target = e.target;

  const openUser = target.closest('[data-open]');
  if (openUser) {
    const id = Number(openUser.dataset.open);
    if (!Number.isInteger(id)) return;
    await fetchAndShowUserOrders(id);
    return;
  }

  const delUser = target.closest('[data-del]');
  if (delUser) {
    const id = Number(delUser.dataset.del);
    if (!confirm('Delete this user?')) return;
    try { await api(`/api/admin/users/${id}`, { method: 'DELETE' }); await loadUsers(); }
    catch (err) { alert(err.data?.error || 'Delete failed'); }
    return;
  }

  const toggleBtn = target.closest('[data-toggle]');
  if (toggleBtn) {
    const id = Number(toggleBtn.dataset.toggle);
    const flag = !!Number(toggleBtn.dataset.flag);
    try { await api(`/api/admin/users/${id}/admin`, { method: 'PUT', json: { is_admin: flag } }); await loadUsers(); }
    catch (err) { alert(err.data?.error || 'Toggle admin failed'); }
    return;
  }

  const btnShowUser = target.closest('#btn-show-user');
  if (btnShowUser && selectedUser && selectedUser.id) {
    await fetchAndShowUserOrders(selectedUser.id);
    return;
  }

  const btnShowAll = target.closest('#btn-show-all');
  if (btnShowAll) {
    await fetchAndShowAllOrders();
    return;
  }

  const ordersClose = target.closest('#orders-close');
  if (ordersClose) {
    ordersFilter = { q:'', status:'', userId:null };
    selectedUser = null;
    renderLanding();
    return;
  }

  const ordersUnfilter = target.closest('#orders-unfilter');
  if (ordersUnfilter) { await fetchAndShowAllOrders(); return; }

  const ordersClear = target.closest('#orders-clear');
  if (ordersClear) {
    ordersFilter = { q:'', status:'', userId:null };
    selectedUser = null;
    renderLanding();
    return;
  }

  const delProd = target.closest('[data-del-prod]');
  if (delProd) {
    const id = Number(delProd.dataset.delProd);
    if (!confirm('Delete this product?')) return;
    await api(`/api/admin/products/${id}`, { method:'DELETE' });
    await loadProducts();
    return;
  }

  const editProd = target.closest('[data-edit-prod]');
  if (editProd) {
    const id = Number(editProd.dataset.editProd);
    const p  = PRODUCTS.find(x => Number(x.id) === id);
    if (p) openProductModal(p);
    return;
  }

  const delCourse = target.closest('[data-del-course]');
  if (delCourse) {
    const id = Number(delCourse.dataset.delCourse);
    if (!confirm('Delete this course?')) return;
    await api(`/api/admin/courses/${id}`, { method: 'DELETE' });
    await loadCourses();
    return;
  }

  const editCourse = target.closest('[data-edit-course]');
  if (editCourse) {
    const id = Number(editCourse.dataset.editCourse);
    const c = COURSES.find(x => Number(x.id) === id);
    if (c) openCourseModal(c);
    return;
  }

  const addMod = target.closest('[data-add-module]');
  if (addMod) {
    e.preventDefault();
    const modulesContainer = els.modulesList;
    const newModIdx = (modulesContainer?.querySelectorAll('.module-card')?.length) || 0;
    modulesContainer?.appendChild(renderModule({ title: '' }, newModIdx));
    return;
  }

  const delMod = target.closest('[data-del-module]');
  if (delMod) {
    e.preventDefault();
    delMod.closest('.module-card')?.remove();
    return;
  }

  const addVid = target.closest('[data-add-video]');
  if (addVid) {
    e.preventDefault();
    const modIdx = addVid.dataset.addVideo;
    const videosContainer = document.querySelector(`.module-card[data-mod-idx="${modIdx}"] .videos-list`);
    const newVidIdx = videosContainer ? videosContainer.querySelectorAll('.video-item').length : 0;
    if (videosContainer) videosContainer.insertAdjacentHTML('beforeend', `
      <div class="f-item video-item" data-vid-idx="${newVidIdx}">
        <label><span class="lbl">Video title</span>
          <input class="input" name="mod-${modIdx}-vid-${newVidIdx}-title" required>
        </label>
        <label><span class="lbl">Video URL (YouTube ID)</span>
          <input class="input" name="mod-${modIdx}-vid-${newVidIdx}-url" required>
        </label>
        <button type="button" class="btn danger sm" data-del-video="${modIdx}-${newVidIdx}">Delete</button>
      </div>
    `);
    return;
  }

  const delVid = target.closest('[data-del-video]');
  if (delVid) {
    e.preventDefault();
    delVid.closest('.video-item')?.remove();
    return;
  }

  // --- QUESTION HANDLERS ---
  const addQ = target.closest('[data-add-question]');
  if (addQ) {
    e.preventDefault();
    const modIdx = addQ.dataset.addQuestion;
    const qContainer = document.querySelector(`.module-card[data-mod-idx="${modIdx}"] .questions-list`);
    const newQIdx = qContainer ? qContainer.querySelectorAll('.question-item').length : 0;
    if (qContainer) {
      const div = document.createElement('div');
      div.innerHTML = renderQuestion({ answers: [{}, {}] }, modIdx, newQIdx);
      qContainer.appendChild(div.firstElementChild);
    }
    return;
  }

  const delQ = target.closest('[data-del-question]');
  if (delQ) {
    e.preventDefault();
    delQ.closest('.question-item')?.remove();
    return;
  }

  const addAns = target.closest('[data-add-answer]');
  if (addAns) {
    e.preventDefault();
    const [mIdx, qIdx] = addAns.dataset.addAnswer.split('-');
    const ansContainer = addAns.closest('.questions-list').querySelector(`.question-item[data-q-idx="${qIdx}"] .answers-list`);
    const newAnsIdx = ansContainer ? ansContainer.querySelectorAll('.answer-item').length : 0;
    if (ansContainer) {
      ansContainer.insertAdjacentHTML('beforeend', renderAnswer({}, mIdx, qIdx, newAnsIdx));
    }
    return;
  }

  const delAns = target.closest('[data-del-answer]');
  if (delAns) {
    e.preventDefault();
    delAns.closest('.answer-item')?.remove();
    return;
  }

  const closeBtn = target.closest('[data-close-modal]');
  if (closeBtn) { closeModals(); return; }
});

/* handle order status change (delegated) */
document.addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-order]');
  if (!sel) return;
  const orderId = Number(sel.dataset.order);
  const newStatus = String(sel.value);
  if (!ORDER_STATUS.includes(newStatus)) { alert('Invalid status'); return; }
  try {
    await api(`/api/admin/orders/${orderId}/status`, { method: 'PUT', json: { status: newStatus } });
    if (ordersFilter.userId) await fetchAndShowUserOrders(ordersFilter.userId);
    else await fetchAndShowAllOrders(ordersFilter.q, ordersFilter.status);
  } catch (err) {
    alert(err.data?.error || 'Status update failed');
  }
});

/* orders pane inputs */
document.addEventListener('input', (e) => {
  const ip = e.target.closest('#orders-q');
  const st = e.target.closest('#orders-status');
  if (ip) {
    ip.addEventListener('keydown', async (ev) => {
      if (ev.key === 'Enter') {
        await fetchAndShowAllOrders(ip.value.trim(), document.querySelector('#orders-status')?.value || '');
      }
    }, { once: true });
  }
  if (st) {
    fetchAndShowAllOrders(document.querySelector('#orders-q')?.value || '', st.value || '');
  }
});

/* ----------------- Boot ----------------- */
async function boot() {
  await loadUsers();
  await loadProducts();
  await loadCourses();
  closeModals();
  renderLanding();
}

boot().catch(err => {
  console.error("Boot error:", err);
  if (err && err.status === 401) location.href = '/login';
  else alert('An error occurred. See console.');
});