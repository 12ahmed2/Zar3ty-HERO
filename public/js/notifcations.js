/* =====================================================
   notifications.js  —  Premium Standalone Module
   (Centered Mobile Modal & Global Toggle Fix)
   ===================================================== */
(function () {

  // 1. INJECT PREMIUM STYLES
  function injectStyles() {
    if (document.getElementById('notif-dynamic-styles')) return;
    const style = document.createElement('style');
    style.id = 'notif-dynamic-styles';
    style.textContent = `
      .custom-notif-panel {
        position: fixed; top: 70px; right: 24px;
        width: 380px; max-width: calc(100vw - 48px); max-height: calc(100vh - 100px);
        background: #ffffff; border-radius: 20px; box-sizing: border-box !important;
        box-shadow: 0 15px 50px -10px rgba(15, 23, 42, 0.2); border: 1px solid #e2e8f0;
        z-index: 999999 !important; display: flex; flex-direction: column;
        transform: translateY(-10px); opacity: 0; pointer-events: none;
        transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s;
      }
      .custom-notif-panel.show { transform: translateY(0); opacity: 1; pointer-events: auto; }

      .notif-header {
        display: flex; justify-content: space-between; align-items: center; box-sizing: border-box !important;
        padding: 20px 24px; border-bottom: 1px solid #f1f5f9; background: #f8fafc; border-radius: 20px 20px 0 0;
      }
      .notif-header h3 { margin: 0; font-size: 1.2rem; font-weight: 800; color: #0f172a; }
      .notif-close {
        background: #e2e8f0; border: none; width: 32px; height: 32px; border-radius: 50%;
        font-size: 1.2rem; color: #475569; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;
      }
      .notif-close:hover { background: #cbd5e1; color: #0f172a; }

      .notif-list-container { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
      
      .notif-item {
        padding: 16px; border-radius: 12px; background: #fff; border: 1px solid #f1f5f9;
        transition: background 0.2s; display: flex; align-items: flex-start; gap: 12px; cursor: pointer; position: relative;
      }
      .notif-item:hover { background: #f8fafc; border-color: #e2e8f0; }
      .notif-item.unread { background: #eff6ff; border-color: #bfdbfe; }
      
      .notif-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid #e2e8f0; flex-shrink: 0; }
      .notif-body { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
      .notif-text { font-size: 0.95rem; color: #334155; line-height: 1.4; word-break: break-word; }
      .notif-actor { font-weight: 700; color: #0f172a; }
      .notif-time { font-size: 0.8rem; color: #94a3b8; font-weight: 600; }
      .notif-dot { width: 10px; height: 10px; background: #3b82f6; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }

      .notif-empty, .notif-loading { padding: 40px 20px; text-align: center; color: #64748b !important; font-weight: 600; font-size: 1rem; }

      .notif-scrim {
        position: fixed; inset: 0; background: rgba(15,23,42,0.6); backdrop-filter: blur(2px);
        z-index: 999998 !important; opacity: 0; pointer-events: none; transition: opacity 0.3s; display: none;
      }

      /* ================= THE MOBILE FIX: DEAD-CENTER MODAL ================= */
      @media (max-width: 768px) {
        .notif-scrim { display: block !important; }
        .notif-scrim.show { opacity: 1 !important; pointer-events: auto !important; }
        
        .custom-notif-panel { 
          top: 0 !important; bottom: 0 !important; right: 0 !important; left: 0 !important; 
          margin: auto !important; /* Centers it perfectly just like Auth modals */
          width: 90% !important; max-width: 400px !important; max-height: 85vh !important;
          border-radius: 20px !important; 
          transform: scale(0.95) !important; /* Replaces buggy slide animation */
          transition: transform 0.2s, opacity 0.2s !important;
        }
        
        .custom-notif-panel.show { 
          transform: scale(1) !important; 
          opacity: 1 !important; 
        }
        
        .notif-header { border-radius: 20px 20px 0 0 !important; padding: 20px !important; }
      }
      
      html[dir="rtl"] .custom-notif-panel { right: auto; left: 24px; }
      @media (max-width: 768px) { html[dir="rtl"] .custom-notif-panel { left: 0; right: 0; margin: auto !important; } }
    `;
    document.head.appendChild(style);
  }

  // 2. INJECT HTML
  function injectHTML() {
    if (document.getElementById('premium-notif-panel')) return;
    const html = `
      <div id="notif-scrim" class="notif-scrim"></div>
      <aside id="premium-notif-panel" class="custom-notif-panel" aria-hidden="true">
        <div class="notif-header">
          <h3 data-translate="index.notifications">Notifications</h3>
          <button id="close-notif-btn" class="notif-close">&times;</button>
        </div>
        <div id="notif-list-container" class="notif-list-container">
          <div class="notif-loading">Loading...</div>
        </div>
      </aside>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  // 3. HELPERS
  function safe(t = '') {
    return String(t).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  async function fetchJSON(url, opts = {}) {
    try {
      const r = await fetch(url, { credentials: 'include', ...opts });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  // 4. DATA LOGIC
  async function updateBadge() {
    const badge = document.getElementById('notif-badge'); 
    if (!badge) return;
    const data = await fetchJSON('/api/notifications/unread-count');
    if (!data) { badge.style.display = 'none'; return; }
    const count = data.count || 0;
    badge.textContent = count > 99 ? '99+' : count || '';
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  async function loadNotifications() {
    const container = document.getElementById('notif-list-container');
    if (!container) return;
    container.innerHTML = '<div class="notif-loading">Loading…</div>';

    const data = await fetchJSON('/api/notifications?limit=30');
    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = '<div class="notif-empty">No notifications yet 🌱</div>';
      return;
    }

    container.innerHTML = data.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" data-notif="${n.id}">
        <img class="notif-avatar" src="${safe(n.actor_avatar || '/static/img/avatar.png')}" onerror="this.src='/static/img/avatar.png'" alt="">
        <div class="notif-body">
          <div class="notif-text">
            <span class="notif-actor">${safe(n.actor_name || 'System')}</span>
            <span class="notif-msg">${safe(n.message || n.content || '')}</span>
          </div>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
        ${!n.is_read ? '<span class="notif-dot"></span>' : ''}
      </div>
    `).join('');

    fetchJSON('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
    const badge = document.getElementById('notif-badge');
    if (badge) badge.style.display = 'none';
  }

  // 5. GLOBAL TOGGLE FUNCTION (Bulletproof Bypass)
  window.toggleNotifications = function() {
    const panel = document.getElementById('premium-notif-panel');
    const scrim = document.getElementById('notif-scrim');
    
    // Auto-close mobile hamburger menu if open
    const navLinks = document.querySelector('.nav-links');
    const hamburger = document.querySelector('.hamburger');
    if (navLinks && navLinks.classList.contains('open')) {
      navLinks.classList.remove('open');
      if (hamburger) hamburger.classList.remove('active');
      document.body.classList.remove('no-scroll');
    }

    if (panel.classList.contains('show')) {
      panel.classList.remove('show');
      if (scrim) scrim.classList.remove('show');
    } else {
      panel.classList.add('show');
      if (scrim) scrim.classList.add('show');
      loadNotifications();
    }
  };

  // 6. WIRING IT TOGETHER
  function init() {
    injectStyles();
    injectHTML();

    const panel = document.getElementById('premium-notif-panel');
    const scrim = document.getElementById('notif-scrim');
    const closeBtn = document.getElementById('close-notif-btn');

    function closePanel() {
      panel.classList.remove('show');
      if (scrim) scrim.classList.remove('show');
    }

    // Attach to existing buttons
    document.querySelectorAll('.notif-btn-icon, #notif-btn, [data-open-notifications], #btn-notifications').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); 
        window.toggleNotifications();
      });
    });

    // Global Click Listener for closing
    document.addEventListener('click', (e) => {
      if (panel.classList.contains('show')) {
        if (e.target.closest('#close-notif-btn') || e.target === scrim) {
          closePanel();
          return;
        }
        if (!panel.contains(e.target) && !e.target.closest('.notif-btn-icon, #notif-btn')) {
          closePanel();
        }
      }
    });

    updateBadge();
    setInterval(updateBadge, 30000); 
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();