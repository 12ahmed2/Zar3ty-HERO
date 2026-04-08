// public/js/profile.js
import {detectLanguage, translate} from './translate.js';

const LANG = document.documentElement.lang || 'en';
let currentUser = null;
let activePostId = null;

/* -------------------- Premium Styles for Posts/Articles -------------------- */
function injectProfileStyles() {
  if (document.getElementById('profile-dynamic-styles')) return;
  const style = document.createElement('style');
  style.id = 'profile-dynamic-styles';
  style.textContent = `
    /* Feed Card Styles */
    .profile-post-card { background: #fff; border-radius: 16px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
    .ppc-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .ppc-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
    .ppc-name { font-weight: 700; color: #1e293b; font-size: 1.05rem; }
    .ppc-time { font-size: 0.85rem; color: #64748b; }
    .ppc-content { margin-bottom: 16px; word-break: break-word; color: #334155; line-height: 1.6; font-size: 1.05rem; }
    .ppc-images img { width: 100%; border-radius: 12px; margin-bottom: 8px; object-fit: cover; max-height: 400px; }
    .ppc-stats { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 12px; padding-top: 12px; border-top: 1px solid #f1f5f9; }
    .reaction-btn, .open-comments-btn { border: none; background: #f1f5f9; padding: 8px 14px; border-radius: 20px; cursor: pointer; font-size: 0.9rem; color: #475569; font-weight: 600; transition: background 0.2s; }
    .reaction-btn:hover, .open-comments-btn:hover { background: #e2e8f0; }
    
    .profile-article-card { display: flex; gap: 16px; margin-bottom: 20px; background: #fff; padding: 20px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); align-items: center; border: 1px solid #e2e8f0; transition: transform 0.2s; cursor: pointer; }
    .profile-article-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
    .pac-img { width: 120px; height: 90px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
    .pac-placeholder { width: 120px; height: 90px; border-radius: 10px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8; flex-shrink: 0; font-size: 28px; }
    .pac-body { flex: 1; min-width: 0; }
    .pac-title { font-weight: 800; font-size: 1.25rem; color: #0f172a; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pac-meta { font-size: 0.85rem; color: #64748b; margin-bottom: 8px; font-weight: 500; }
    .pac-preview { font-size: 0.95rem; color: #475569; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5; }

    /* Modals */
    .custom-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15,23,42,0.7); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; backdrop-filter: blur(6px); }
    .custom-article-box { background: #fff; width: 100%; max-width: 750px; border-radius: 20px; max-height: 90vh; overflow-y: auto; padding: 48px; box-sizing: border-box; position: relative; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
    .custom-comments-box { background: #fff; width: 100%; max-width: 650px; border-radius: 20px; max-height: 90vh; display: flex; flex-direction: column; padding: 32px; box-sizing: border-box; position: relative; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
    .custom-modal-close { position: absolute; top: 20px; right: 24px; font-size: 36px; cursor: pointer; color: #94a3b8; line-height: 1; background: none; border: none; padding: 0; transition: color 0.2s; }
    .custom-modal-close:hover { color: #0f172a; }
    
    .art-title { font-size: 2.5rem; font-weight: 800; color: #0f172a; margin: 0 0 16px; line-height: 1.2; word-break: break-word; }
    .art-meta { color: #64748b; font-size: 1rem; margin-bottom: 32px; font-weight: 500; }
    .art-img { width: 100%; border-radius: 16px; margin-bottom: 32px; object-fit: cover; max-height: 450px; background: #f8fafc; }
    .art-body { font-size: 1.15rem; line-height: 1.8; color: #334155; white-space: pre-wrap; word-break: break-word; font-family: Georgia, serif; }

    .com-title { font-size: 1.75rem; font-weight: 800; margin: 0 0 20px; color: #0f172a; }
    .com-list { flex: 1; overflow-y: auto; padding-right: 8px; margin-bottom: 20px; min-height: 100px; }
    .com-input-area { border-top: 1px solid #e2e8f0; padding-top: 20px; flex-shrink: 0; }
    .com-textarea { width: 100%; padding: 16px; border-radius: 12px; border: 1px solid #cbd5e1; font-family: inherit; resize: none; min-height: 70px; box-sizing: border-box; margin-bottom: 12px; font-size: 1rem; background: #f8fafc; transition: border-color 0.2s; }
    .com-textarea:focus { outline: none; border-color: #2563eb; background: #fff; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .com-btn { width: 100%; padding: 14px; border-radius: 10px; font-weight: 700; cursor: pointer; background: #2563eb; color: #fff; font-size: 1.05rem; }
    .com-btn:hover { background: #1d4ed8; }
    
    @media(max-width: 600px) {
      .custom-article-box { padding: 32px 20px; }
      .art-title { font-size: 2rem; }
      .profile-article-card { flex-direction: column; align-items: stretch; }
      .pac-img, .pac-placeholder { width: 100%; height: 160px; }
    }
  `;
  document.head.appendChild(style);
}

/* -------------------- UI Injector -------------------- */
function setupTabs() {
  const toggle = document.querySelector('.profile-toggle');
  if (toggle && !document.getElementById('btn-show-posts')) {
    toggle.insertAdjacentHTML('beforeend', `
      <button id="btn-show-posts" class="btn ghost" data-translate="mypost">My Posts</button>
      <button id="btn-show-articles" class="btn ghost"  data-translate="myarticle">My Articles</button>
    `);
  }
  const wrap = document.querySelector('.profile-wrap');
  if (wrap && !document.getElementById('posts-section')) {
    wrap.insertAdjacentHTML('beforeend', `
      <section id="posts-section" style="display:none; width: 100%; max-width: 700px; margin: 24px auto 0;">
        <div id="my-posts-list"></div>
      </section>
      <section id="articles-section" style="display:none; width: 100%; max-width: 800px; margin: 24px auto 0;">
        <div id="my-articles-list"></div>
      </section>
    `);
  }

  const tabs = ['profile', 'robot', 'posts', 'articles'];
  tabs.forEach(tab => {
    document.getElementById(`btn-show-${tab}`)?.addEventListener('click', () => {
      tabs.forEach(t => {
        const b = document.getElementById(`btn-show-${t}`);
        const s = document.getElementById(`${t}-section`);
        if (b) {
          if (t === tab) { b.classList.add('active'); b.classList.remove('ghost'); }
          else { b.classList.add('ghost'); b.classList.remove('active'); }
        }
        if (s) s.style.display = (t === tab) ? 'block' : 'none';
      });
      if (tab === 'posts') loadMyPosts();
      if (tab === 'articles') loadMyArticles();
    });
  });
}

/* -------------------- Formatting Helpers -------------------- */
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

function safe(t = '') {
  return String(t).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function rEmoji(type) {
  return { love: '❤️', like: '👍', dislike: '👎', angry: '😡' }[type] || '❓';
}

/* -------------------- Fingerprint + API helper -------------------- */
const FP_KEY = 'client_fp';
function getFP() {
  let v = localStorage.getItem(FP_KEY);
  if (!v) {
    v = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(FP_KEY, v);
  }
  document.cookie = `fp=${v}; Path=/; SameSite=Strict${location.protocol === 'https:' ? '; Secure' : ''}`;
  return v;
}

async function api(path, { method = 'GET', json, headers = {}, credentials = 'include' } = {}, _retry = false) {
  const opts = { method, credentials, headers: { 'x-client-fingerprint': getFP(), ...headers } };
  if (json !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(json);
  }
  const res = await fetch(path, opts);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    if (res.status === 401 && !_retry) {
      await fetch('/refresh', { method: 'POST', credentials: 'include', headers: { 'x-client-fingerprint': getFP() } }).catch(() => {});
      return api(path, { method, json, headers, credentials }, true);
    }
    const err = new Error(data?.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/* ================= AVATAR HELPER ================= */
function getAvatarUrl(user) {
  if (!user) return '/static/img/avatar.png';
  const name = user.fullname || user.email || 'User';
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=1877f2&color=fff&size=128`;
}

/* ----------------------------- Elements --------------------------- */
const els = {
  email: document.getElementById('pf-email'),
  fullname: document.getElementById('pf-fullname'),
  save: document.getElementById('pf-save'),
  msg: document.getElementById('pf-msg'),
  logout: document.getElementById('btn-logout'),
  ordersList: document.getElementById('orders-list'),
  ordersMsg: document.getElementById('orders-msg'),
  profileForm: document.getElementById('form-profile'),
  profileAvatar: document.getElementById('profile-avatar') || document.getElementById('pf-avatar'),
  robotCamUrl: document.getElementById('robot-cam-url'),
  btnShowCamera: document.getElementById('btn-show-camera'),
  btnRobotFullscreen: document.getElementById('btn-robot-fullscreen'),
  robotIframe: document.getElementById('robot-iframe')
};

/* ------------------------ Admin nav helper ------------------------ */
function ensureAdminLink() {
  const nav = document.querySelector('.nav');
  if (!nav || document.querySelector('#nav-admin')) return;
  const a = document.createElement('a');
  a.id = 'nav-admin';
  a.className = 'btn ghost sm';
  a.href = '/admin';
  a.textContent = 'Admin';
  const before = document.querySelector('#btn-logout');
  nav.insertBefore(a, before || nav.firstChild);
}

/* ------------------------------ Me ------------------------------- */
async function loadMe() {
  const me = await api('/api/me').catch(() => null);
  if (!me) { location.href = '/'; return null; }
  currentUser = me;
  
  if (els.email) els.email.value = me.email || '';
  if (els.fullname) els.fullname.value = me.fullname || '';
  if (els.profileAvatar) {
    els.profileAvatar.src = me.avatar_url || getAvatarUrl(me);
    els.profileAvatar.onerror = () => { els.profileAvatar.src = '/static/img/avatar.png'; };
  }
  if (me.is_admin) ensureAdminLink();
  return me;
}

/* ---------------------------- Orders ------------------------------ */
async function loadOrders() {
  let orders = await api('/api/orders').catch(() => []);
  orders = orders.filter(o => o.status !== 'cancelled' && o.status !== 'cancelled_by_user');

  if (!orders.length) {
    if (els.ordersList) els.ordersList.innerHTML = '';
    if (els.ordersMsg) {
      els.ordersMsg.textContent = detectLanguage('No active orders.') === LANG
        ? 'No active orders.'
        : await translate('No active orders.', detectLanguage('No active orders.'), LANG);
    }
    return;
  }

  if (els.ordersMsg) els.ordersMsg.textContent = '';
  if (els.ordersList) {
    const ordersHtml = await Promise.all(orders.map(async o => {
      const total = (o.total_cents / 100).toFixed(2);
      const itemsHtml = await Promise.all((o.items || []).map(async it => {
        const name = detectLanguage(it.name) === LANG ? it.name : await translate(it.name, detectLanguage(it.name), LANG);
        return `<li><strong>${name || ('#' + it.product_id)}</strong> × ${it.qty} · $${(it.price_cents / 100).toFixed(2)}</li>`;
      }));

      const canCancel = o.status === 'created';
      const status = detectLanguage(o.status) === LANG ? o.status : await translate(o.status, detectLanguage(o.status), LANG);
      const when = o.created_at ? new Date(o.created_at).toLocaleString() : '';

      return `
        <article class="card">
          <div class="row">
            <div><strong><strong data-translate="gradients.order"></strong> ${o.id}</strong></div>
            <div class="muted">${when}</div>
          </div>
          <p><strong data-translate="gradients.status"></strong>: <strong>${status}</strong></p>
          <ul>${itemsHtml.join('')}</ul>
          <div class="row">
            <div><strong><strong data-translate="gradients.total"></strong>: $${total}</strong></div>
            <div class="hstack gap">
              ${canCancel ? `<button class="btn sm" data-cancel="${o.id}" data-translate="gradients.cancel"></button>` : ''}
              <button class="btn ghost sm" data-refresh="${o.id}" data-translate="gradients.refresh"></button>
            </div>
          </div>
        </article>`;
    }));
    els.ordersList.innerHTML = ordersHtml.join('');
  }
}

els.ordersList?.addEventListener('click', async (e) => {
  const c = e.target.closest('[data-cancel]');
  const r = e.target.closest('[data-refresh]');
  try {
    if (c) {
      const id = c.getAttribute('data-cancel');
      await api(`/api/orders/${id}/cancel`, { method: 'POST' });
      await loadOrders();
    } else if (r) {
      await loadOrders();
    }
  } catch (err) { alert(err.data?.error || 'Failed'); }
});

els.profileForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.msg && (els.msg.textContent = '');
  try {
    await api('/api/me', { method: 'PUT', json: { fullname: els.fullname?.value || '' } });
    if (els.msg) els.msg.textContent = 'Saved.';
  } catch (e2) {
    if (els.msg) els.msg.textContent = e2.data?.error || 'Update failed';
  }
});

els.logout?.addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  location.href = '/';
});

/* ================= Enrollments ================= */
async function fetchMyEnrollments() {
  const res = await fetch('/api/me/enrollments', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch enrollments');
  return res.json();
}

async function renderMyEnrollments(list) {
  const el = document.getElementById('my-enrollments');
  if (!el) return;

  if (!list.length) {
    el.innerHTML = `<div class="muted">${detectLanguage('You have no enrollments.') === LANG ? 'You have no enrollments.' : await translate('You have no enrollments.', detectLanguage('You have no enrollments.'), LANG)}</div>`;
    return;
  }

  const cardsHtml = await Promise.all(list.map(async item => {
    const title = detectLanguage(item.title || 'Untitled') === LANG ? item.title : await translate(item.title || 'Untitled', detectLanguage(item.title || 'Untitled'), LANG);
    return `
      <div class="enroll-card" data-course-id="${item.course_id}">
        <img src="${item.image_url || 'https://via.placeholder.com/300x180'}" alt="" onerror="this.src='https://via.placeholder.com/300x180'">
        <div class="content">
          <div class="title">${title}</div>
          <div class="muted"><label data-translate="courses.enrolled"></label>: ${new Date(item.enrolled_at).toLocaleString()}</div>
          <div class="actions">
            <a class="btn" href="/course/${item.course_id}" data-translate="gradients.open"></a>
            <button class="btn danger unenroll-btn" data-course-id="${item.course_id}" data-translate="courses.unenroll"></button>
          </div>
        </div>
      </div>
    `;
  }));

  el.innerHTML = cardsHtml.join('');

  el.querySelectorAll('.unenroll-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const courseId = e.currentTarget.dataset.courseId;
      if (!confirm(detectLanguage('Unenroll from this course?') === LANG ? 'Unenroll from this course?' : await translate('Unenroll from this course?', detectLanguage('Unenroll from this course?'), LANG))) return;
      try {
        const res = await fetch(`/api/courses/${courseId}/enroll`, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) throw new Error('Failed');
        const card = document.querySelector(`.enroll-card[data-course-id="${courseId}"]`);
        if (card) card.remove();
        if (!el.querySelectorAll('.enroll-card').length) {
          el.innerHTML = `<div class="muted">You have no enrollments.</div>`;
        }
      } catch (err) { alert('Failed to unenroll.'); }
    });
  });
}

/* ================= Robot Camera ================= */
els.btnShowCamera?.addEventListener('click', () => {
  if (!els.robotCamUrl) return;
  const url = els.robotCamUrl.value.trim();
  if (!url) { alert("Please enter a URL."); return; }
  try {
    new URL(url);
    if (els.robotIframe) els.robotIframe.src = url;
  } catch (_) { alert("Please enter a valid URL"); }
});

els.btnRobotFullscreen?.addEventListener('click', () => {
  if (!els.robotIframe) return;
  if (els.robotIframe.requestFullscreen) els.robotIframe.requestFullscreen();
  else if (els.robotIframe.webkitRequestFullscreen) els.robotIframe.webkitRequestFullscreen();
  else if (els.robotIframe.msRequestFullscreen) els.robotIframe.msRequestFullscreen();
});

/* ================= SOCIAL: MY POSTS ================= */
async function loadMyPosts() {
  const container = document.getElementById('my-posts-list');
  if (!container || !currentUser) return;
  container.innerHTML = '<p class="hint" style="text-align:center; padding: 20px;">Loading posts…</p>';

  try {
    const posts = await api(`/api/users/${currentUser.id}/posts`);
    if (!Array.isArray(posts) || posts.length === 0) {
      container.innerHTML = '<p class="hint" style="text-align:center; padding: 20px;">You haven\'t posted anything yet.</p>';
      return;
    }

    container.innerHTML = posts.map(post => {
      post.avatar_url = post.avatar_url || getAvatarUrl(post);
      const reactionsHtml = ['love', 'like', 'dislike', 'angry'].map(r => {
        const count = post.reactions?.[r] || 0;
        return `<button class="reaction-btn" data-post="${post.id}" data-reaction="${r}">${rEmoji(r)} <span>${count}</span></button>`;
      }).join(' ');

      return `
        <div class="profile-post-card" data-post-id="${post.id}">
          <div class="ppc-header">
            <img src="${safe(post.avatar_url)}" class="ppc-avatar">
            <div>
              <div class="ppc-name">${safe(post.fullname || currentUser.fullname)}</div>
              <div class="ppc-time">${timeAgo(post.created_at)}</div>
            </div>
          </div>
          <div class="ppc-content">${safe(post.content)}</div>
          ${Array.isArray(post.images) && post.images.length ? `<div class="ppc-images">${post.images.filter(Boolean).map(img => `<img src="${safe(img)}" loading="lazy">`).join('')}</div>` : ''}
          <div class="ppc-stats">
            ${reactionsHtml}
            <button class="open-comments-btn" data-post="${post.id}">💬 <span>${post.comments_count || 0}</span></button>
            <button class="delete-post-btn" data-post="${post.id}" style="border:none; background:#fee2e2; color:#ef4444; cursor:pointer; font-size:0.9rem; margin-left:auto; font-weight:700; padding:8px 14px; border-radius: 20px;">🗑️ Delete</button>
          </div>
        </div>
      `;
    }).join('');

    // Handle Post Deletion
    container.querySelectorAll('.delete-post-btn').forEach(btn => {
      btn.onclick = async () => {
        if(!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;
        const res = await fetch(`/api/posts/${btn.dataset.post}`, { method: 'DELETE', credentials: 'include' });
        if(res.ok) loadMyPosts();
        else alert('Failed to delete post.');
      };
    });

    container.querySelectorAll('.reaction-btn').forEach(btn => {
      btn.onclick = async () => {
        const postId = btn.dataset.post;
        const res = await fetch(`/api/posts/${postId}/react`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-client-fingerprint': getFP() }, credentials:'include', body: JSON.stringify({ reaction: btn.dataset.reaction }) });
        if (res.ok) {
          const data = await res.json();
          container.querySelectorAll(`.reaction-btn[data-post="${postId}"]`).forEach(rBtn => {
            rBtn.querySelector('span').textContent = data.reactions[rBtn.dataset.reaction] || 0;
          });
        }
      };
    });

    container.querySelectorAll('.open-comments-btn').forEach(btn => {
      btn.onclick = () => openCommentsModal(btn.dataset.post);
    });

  } catch (err) {
    container.innerHTML = '<p class="hint" style="text-align:center;">Error loading posts.</p>';
  }
}

/* ================= SOCIAL: MY ARTICLES ================= */
async function loadMyArticles() {
  const container = document.getElementById('my-articles-list');
  if (!container || !currentUser) return;
  container.innerHTML = '<p class="hint" style="text-align:center; padding: 20px;">Loading articles…</p>';

  try {
    const articles = await api(`/api/users/${currentUser.id}/articles`);
    if (!Array.isArray(articles) || articles.length === 0) {
      container.innerHTML = '<p class="hint" style="text-align:center; padding: 20px;">You haven\'t written any articles yet.</p>';
      return;
    }

    container.innerHTML = articles.map(a => `
      <article class="profile-article-card" data-article-id="${a.id}">
        ${a.image_url ? `<img src="${safe(a.image_url)}" class="pac-img">` : '<div class="pac-placeholder">📄</div>'}
        <div class="pac-body">
          <div class="pac-title">${safe(a.title)}</div>
          <div class="pac-meta">Published ${timeAgo(a.created_at)} · ⭐ ${a.stars ?? 0}</div>
          <div class="pac-preview">${safe((a.content||'').slice(0,120))}...</div>
        </div>
        <button class="delete-article-btn" data-article="${a.id}" style="border:none; background:#fee2e2; color:#ef4444; padding:10px 16px; border-radius:10px; cursor:pointer; font-weight:700; margin-left:12px; flex-shrink:0;">🗑️ Delete</button>
      </article>
    `).join('');

    // Inject Article Modal HTML dynamically if missing
    if (!document.getElementById('article-modal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="article-modal" class="custom-modal-overlay" style="display:none;">
          <div class="custom-article-box">
            <button id="article-modal-close" class="custom-modal-close">&times;</button>
            <h1 id="modal-article-title" class="art-title"></h1>
            <div id="modal-article-meta" class="art-meta"></div>
            <div id="modal-article-body"></div>
          </div>
        </div>
      `);
    }

    const modal = document.getElementById('article-modal');
    const modalTitle = document.getElementById('modal-article-title');
    const modalMeta = document.getElementById('modal-article-meta');
    const modalBody = document.getElementById('modal-article-body');

    document.querySelectorAll('.profile-article-card').forEach(card => {
      card.onclick = async (e) => {
        if(e.target.classList.contains('delete-article-btn')) return; // Ignore if clicking delete
        
        const article = await api(`/api/articles/${card.dataset.articleId}`).catch(()=>({}));
        modalTitle.textContent = article.title || '';
        modalMeta.textContent = `Published ${timeAgo(article.created_at)} · ⭐ ${article.stars ?? 0}`;
        
        modalBody.innerHTML = '';
        if (article.image_url) modalBody.innerHTML += `<img src="${safe(article.image_url)}" class="art-img">`;
        
        const textDiv = document.createElement('div');
        textDiv.className = 'art-body';
        textDiv.textContent = article.content || '';
        modalBody.appendChild(textDiv);
        modal.style.display = 'flex';
      };
    });

    document.querySelectorAll('.delete-article-btn').forEach(btn => {
      btn.onclick = async () => {
        if(!confirm('Are you sure you want to delete this article?')) return;
        const res = await fetch(`/api/articles/${btn.dataset.article}`, { method: 'DELETE', credentials: 'include' });
        if(res.ok) loadMyArticles();
        else alert('Failed to delete article.');
      };
    });

    document.getElementById('article-modal-close').onclick = () => modal.style.display = 'none';
    modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };

  } catch (err) {
    container.innerHTML = '<p class="hint" style="text-align:center;">Error loading articles.</p>';
  }
}

/* ================= SOCIAL: COMMENTS MODAL ================= */
function renderCommentHtml(c, level = 0) {
  const comment = { ...c, avatar_url: c.avatar_url || getAvatarUrl(c), fullname: c.fullname || 'User', replies: c.replies || [], reactions: c.reactions || {} };
  const repliesHtml = comment.replies.map(r => renderCommentHtml(r, level + 1)).join('');
  
  const reactions = ['like', 'love', 'dislike', 'angry'].map(r => {
    return `<button class="comment-reaction-btn" data-comment="${comment.id}" data-reaction="${r}" style="border:none; background:none; cursor:pointer; font-size:0.9rem; color:#64748b; padding:2px;">${rEmoji(r)} <span>${comment.reactions?.[r] || 0}</span></button>`;
  }).join(' ');

  const marginLeft = window.innerWidth < 500 ? (level * 10) : (level * 24);
  const isMyComment = currentUser && String(currentUser.id) === String(comment.user_id);
  const deleteBtnHtml = isMyComment ? `<button class="delete-comment-btn" data-comment="${comment.id}" style="border:none; background:none; color:#ef4444; cursor:pointer; font-weight:700; font-size:0.9rem; margin-left:auto;">Delete</button>` : '';
  const profileLink = isMyComment ? '#' : `/user/${comment.user_id}`; // Keep them here if it's them

  return `
    <div class="comment" style="margin-left:${marginLeft}px; background:${level > 0 ? '#fff' : '#f8fafc'}; padding:16px; border-radius:16px; margin-bottom:12px; border: 1px solid ${level > 0 ? '#e2e8f0' : 'transparent'};">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <img src="${safe(comment.avatar_url)}" style="width:32px; height:32px; border-radius:50%; cursor:pointer; object-fit:cover;" onclick="if('${profileLink}'!=='#') location.href='${profileLink}'">
        <strong style="color:#0f172a; cursor:pointer; font-size:1rem;" onclick="if('${profileLink}'!=='#') location.href='${profileLink}'">${safe(comment.fullname)}</strong>
        <span style="font-size:0.85rem; color:#94a3b8;">${timeAgo(comment.created_at)}</span>
      </div>
      <div style="font-size:1.05rem; white-space:pre-wrap; word-break: break-word; color:#334155; margin-left: 42px; line-height:1.5;">${safe(comment.content)}</div>
      <div class="comment-actions" style="margin-top:10px; margin-left: 42px; display:flex; gap:8px; align-items:center; flex-wrap: wrap;">
        ${reactions}
        <button class="reply-comment-btn" data-comment="${comment.id}" style="border:none; background:none; color:#64748b; cursor:pointer; font-weight:700; font-size:0.9rem; margin-left:12px;">Reply</button>
        ${deleteBtnHtml}
      </div>
      <div class="reply-box" style="display:none; margin-top:16px; margin-left: 42px;"></div>
      <div class="comment-replies" style="margin-top:16px; border-left: 2px solid #e2e8f0; padding-left: 16px; margin-left: 16px;">${repliesHtml}</div>
    </div>
  `;
}

async function openCommentsModal(postId) {
  activePostId = postId; 
  let modal = document.getElementById('comments-modal');
  
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="comments-modal" class="custom-modal-overlay" style="display:none;">
        <div class="custom-comments-box">
          <button id="comments-modal-close" class="custom-modal-close">&times;</button>
          <h3 class="com-title">Comments</h3>
          <div id="comments-list" class="com-list"></div>
          <div class="com-input-area">
            <textarea id="comment-input" class="com-textarea" placeholder="Write a comment..."></textarea>
            <button id="comment-submit" class="com-btn">Post Comment</button>
          </div>
        </div>
      </div>
    `);
    modal = document.getElementById('comments-modal');

    document.getElementById('comments-modal-close').onclick = () => { modal.style.display='none'; };
    modal.onclick = e => { if (e.target === modal) modal.style.display='none'; };

    const listEl = document.getElementById('comments-list');
    listEl.addEventListener('click', async e => {
      const deleteBtn = e.target.closest('.delete-comment-btn');
      if (deleteBtn) {
        if (!confirm('Are you sure you want to delete this comment?')) return;
        const res = await fetch(`/api/comments/${deleteBtn.dataset.comment}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) refreshCommentsList(); else alert('Failed to delete comment.');
        return;
      }

      const reactionBtn = e.target.closest('.comment-reaction-btn');
      if (reactionBtn) {
        const res = await fetch(`/api/comments/${reactionBtn.dataset.comment}/react`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-client-fingerprint': getFP() }, credentials: 'include', body: JSON.stringify({ reaction: reactionBtn.dataset.reaction }) });
        if (res.ok) refreshCommentsList();
        return;
      }

      const replyBtn = e.target.closest('.reply-comment-btn');
      if (replyBtn) {
        const replyBox = replyBtn.closest('.comment').querySelector('.reply-box');
        if (replyBox.style.display === 'block') { replyBox.style.display = 'none'; replyBox.innerHTML = ''; return; }
        replyBox.style.display = 'block';
        replyBox.innerHTML = `
          <div style="display:flex; gap:10px; align-items:center;">
            <input class="input-reply" placeholder="Write a reply…" style="flex:1; min-width:0; padding:12px; border:1px solid #cbd5e1; border-radius:10px; box-sizing:border-box;">
            <button class="send-reply-btn" style="background:#2563eb; color:white; border:none; padding:12px 20px; border-radius:10px; cursor:pointer; font-weight:700; flex-shrink:0;">Send</button>
          </div>`;
        replyBox.querySelector('.send-reply-btn').onclick = async () => {
          const text = replyBox.querySelector('.input-reply').value.trim();
          if (!text) return;
          const res = await fetch(`/api/comments/${replyBtn.dataset.comment}/reply`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-client-fingerprint': getFP() }, credentials: 'include', body: JSON.stringify({ content: text }) });
          if (res.ok) refreshCommentsList();
        };
        return;
      }
    });
  }

  modal.style.display = 'flex';
  refreshCommentsList();

  const input = modal.querySelector('#comment-input');
  const submit = modal.querySelector('#comment-submit');
  const newSubmit = submit.cloneNode(true);
  submit.parentNode.replaceChild(newSubmit, submit);

  newSubmit.onclick = async () => {
    const val = input.value.trim();
    if (!val) return;
    newSubmit.disabled = true; newSubmit.textContent = 'Posting...';
    const res = await fetch(`/api/comments`, { method: 'POST', body: JSON.stringify({ content: val, post_id: activePostId }), headers: {'Content-Type':'application/json', 'x-client-fingerprint': getFP()}, credentials: 'include' });
    newSubmit.disabled = false; newSubmit.textContent = 'Post Comment';
    if (res.ok) {
      input.value = '';
      await refreshCommentsList();
      const postCard = document.querySelector(`.profile-post-card[data-post-id="${activePostId}"] .open-comments-btn span`);
      if (postCard) postCard.textContent = parseInt(postCard.textContent) + 1;
    }
  };
}

async function refreshCommentsList() {
  if (!activePostId) return;
  const list = document.getElementById('comments-list');
  if (!list) return;
  const currentScroll = list.scrollTop;
  const comments = await api(`/api/posts/${activePostId}/comments`).catch(() => []);
  
  if (comments.length === 0) {
    list.innerHTML = '<p class="hint" style="text-align:center; margin-top:40px;">No comments yet.</p>';
  } else {
    list.innerHTML = comments.map(c => renderCommentHtml(c)).join('');
    list.scrollTop = currentScroll === 0 ? list.scrollHeight : currentScroll;
  }
}

/* ------------------------------ Boot ------------------------------ */
(async function boot() {
  try {
    injectProfileStyles(); // Add premium UI styles dynamically
    setupTabs(); // Inject tab buttons and containers dynamically

    await loadMe();
    await loadOrders();
    try {
      const enrollments = await fetchMyEnrollments();
      renderMyEnrollments(enrollments);
    } catch (err) {
      const el = document.getElementById('my-enrollments');
      if (el) el.innerHTML = `<div class="muted">Failed to load enrollments.</div>`;
    }
  } catch (err) {
    console.error('Boot error:', err);
    if (err?.status === 401) location.href = '/login';
  }
})();







/* ================= APPEND TO posts.js ================= */
// Optimistic Reaction Update (keeps your existing server sync intact)
function applyOptimisticReaction(postId, reaction, btn) {
  const post = postsCache.find(p => String(p.id) === String(postId));
  if (!post) return;
  if (!post.reactions) post.reactions = {};
  
  // Toggle logic client-side immediately
  const current = post.reactions[reaction] || 0;
  const isActive = btn.classList.contains('active');
  post.reactions[reaction] = isActive ? Math.max(0, current - 1) : current + 1;
  
  // Update all matching buttons instantly
  document.querySelectorAll(`.reaction-btn[data-post="${postId}"][data-reaction="${reaction}"]`).forEach(b => {
    const span = b.querySelector('span');
    if (span) span.textContent = post.reactions[reaction];
    b.classList.toggle('active', !isActive);
  });
}

// Wrap your existing handleReaction to add optimistic step
const _originalHandleReaction = handleReaction;
window.handleReaction = async function(postId, reactionBtn) {
  applyOptimisticReaction(postId, reactionBtn.dataset.reaction, reactionBtn);
  try { await _originalHandleReaction(postId, reactionBtn); } catch(e) { /* Revert on failure if needed */ }
};

// Auto-refresh feed silently every 60s (near real-time)
setInterval(() => {
  if (!feedLoading) window.loadPosts(false);
}, 60000);
/* ================= END APPEND ================= */
