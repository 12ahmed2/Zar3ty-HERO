/* =====================================================
   articles.js  —  Premium Articles + AI Translation
   ===================================================== */
import { detectLanguage, translate } from './translate.js';

const LANG = localStorage.getItem('lang') || 'en';
let currentUser = null;

/* --- AI TRANSLATION HELPER --- */
async function tr(text) {
  if (!text) return '';
  const src = detectLanguage(text);
  if (src === 'unknown' || src === LANG) return text;
  try { return await translate(text, src, LANG); } 
  catch(e) { return text; /* Fallback to original if Python server fails */ }
}

function injectArticleStyles() {
  if (document.getElementById('articles-dynamic-styles')) return;
  const style = document.createElement('style');
  style.id = 'articles-dynamic-styles';
  style.textContent = `
    h1 { font-size: 2.5rem; font-weight: 800; color: #0f172a; margin-top: 30px; margin-bottom: 10px; }
    .premium-articles-layout { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 380px)); justify-content: flex-start; gap: 24px; margin-top: 20px; padding-bottom: 60px; align-items: start; }
    .premium-article-card { background: #fff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; display: flex; flex-direction: column; overflow: hidden; height: 100%; }
    .premium-article-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.08); }
    .pac-img-top { width: 100%; height: 180px; object-fit: cover; background: #f8fafc; }
    .pac-placeholder-top { width: 100%; height: 180px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 3.5rem; color: #cbd5e1; }
    .pac-content { padding: 20px; flex: 1; display: flex; flex-direction: column; }
    .pac-title { font-weight: 800; font-size: 1.25rem; color: #0f172a; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .pac-meta { font-size: 0.85rem; color: #64748b; margin-bottom: 12px; font-weight: 500; }
    .pac-preview { font-size: 0.95rem; color: #475569; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5; flex: 1; }
    .pac-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 16px; margin-top: 16px; border-top: 1px solid #f1f5f9; }
    .pac-author { display: flex; align-items: center; gap: 8px; padding: 4px 8px 4px 0; border-radius: 20px; transition: background 0.2s; }
    .pac-author:hover { background: #f8fafc; }
    .pac-author img { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 1px solid #e2e8f0; }
    .pac-author-name { font-size: 0.9rem; font-weight: 600; color: #1e293b; }
    .pac-actions { display: flex; align-items: center; gap: 8px; }
    .star-btn { border: none; background: #f1f5f9; color: #64748b; padding: 6px 12px; border-radius: 20px; font-weight: 600; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 6px; font-size: 0.85rem; }
    .star-btn:hover { background: #e2e8f0; color: #f59e0b; }
    .star-btn.starred { background: #fef3c7; color: #d97706; }
    .delete-btn-sm { border: none; background: #fee2e2; color: #ef4444; padding: 6px 10px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; font-size: 0.85rem; }
    .delete-btn-sm:hover { background: #fecaca; }
    
    .custom-modal-overlay { position: fixed !important; top: 0 !important; bottom: 0 !important; left: 0 !important; right: 0 !important; background: rgba(15, 23, 42, 0.7) !important; backdrop-filter: blur(3px) !important; z-index: 999999 !important; align-items: center !important; justify-content: center !important; padding: 16px !important; box-sizing: border-box !important; }
    .custom-modal-close { position: absolute; top: 16px; right: 20px; font-size: 28px; cursor: pointer; color: #94a3b8; line-height: 1; background: none; border: none; padding: 0; transition: color 0.2s; z-index: 10; }
    .custom-modal-close:hover { color: #0f172a; }
    .custom-article-box { background: #fff !important; border-radius: 20px !important; padding: 28px 24px !important; width: 100% !important; max-width: 550px !important; max-height: 90vh !important; overflow-y: auto !important; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25) !important; position: relative !important; margin: auto !important; transform: translateZ(0) !important; }
    .art-title { font-size: 1.6rem; font-weight: 800; color: #0f172a; margin: 0 0 8px; line-height: 1.2; word-break: break-word; padding-right: 24px; }
    .art-meta { color: #64748b; font-size: 0.9rem; margin-bottom: 16px; font-weight: 600; }
    .art-img { width: 100%; border-radius: 12px; margin-bottom: 16px; object-fit: cover; max-height: 250px; background: #f8fafc; }
    .art-body { font-size: 1rem; line-height: 1.6; color: #334155; white-space: pre-wrap; word-break: break-word; }
    .custom-create-box { background: #fff !important; border-radius: 20px !important; padding: 28px 24px !important; width: 100% !important; max-width: 450px !important; max-height: 90vh !important; overflow-y: auto !important; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25) !important; position: relative !important; margin: auto !important; transform: translateZ(0) !important; display: flex !important; flex-direction: column !important; gap: 16px !important; }
    .create-title { font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0; text-align: center; }
    .create-label { display: flex; flex-direction: column; gap: 6px; font-weight: 600; color: #334155; font-size: 0.9rem; }
    .create-label input[type="text"], .create-label textarea { padding: 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 0.95rem; background: #f8fafc; font-family: inherit; resize: none; }
    .create-label textarea { height: 120px; }
    .create-label input:focus, .create-label textarea:focus { outline: none; border-color: #2563eb; background: #fff; }
    .create-submit { background: #2563eb; color: #fff; border: none; padding: 12px; border-radius: 10px; font-weight: 700; font-size: 1rem; cursor: pointer; transition: background 0.2s; width: 100%; margin-top: 8px;}
    .create-submit:hover { background: #1d4ed8; }
    @media(max-width: 600px) { .premium-articles-layout { grid-template-columns: 1fr; justify-content: center; } .custom-article-box, .custom-create-box { padding: 24px 20px !important; } }
  `;
  document.head.appendChild(style);
}

function injectModals() {
  if (!document.getElementById('premium-reading-modal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="premium-reading-modal" class="custom-modal-overlay" style="display:none;">
        <div class="custom-article-box">
          <button id="reading-modal-close" class="custom-modal-close">&times;</button>
          <h1 id="reading-title" class="art-title"></h1>
          <div id="reading-meta" class="art-meta"></div>
          <div id="reading-body"></div>
        </div>
      </div>
    `);
  }

  if (!document.getElementById('premium-create-modal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="premium-create-modal" class="custom-modal-overlay" style="display:none;">
        <div class="custom-create-box">
          <button id="create-modal-close" class="custom-modal-close">&times;</button>
          <h3 class="create-title" data-translate="feed.writeArticle">Write an Article</h3>
          <label class="create-label"><span data-translate="navbar.title">Title</span> <input type="text" id="create-title-inp" data-translate-placeholder="feed.titlePlaceholder"></label>
          <label class="create-label"><span data-translate="feed.comments">Content</span> <textarea id="create-content-inp" data-translate-placeholder="feed.contentPlaceholder"></textarea></label>
          <label class="create-label">Cover Image <input type="file" id="create-image-inp" accept="image/*"></label>
          <button id="create-submit-btn" class="create-submit" data-translate="feed.publish">Publish</button>
        </div>
      </div>
    `);
  }
}

/* -------------------- HELPERS -------------------- */
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

async function api(path, { method = 'GET', json, body, headers = {}, credentials = 'include' } = {}, _retry = false) {
  const opts = { method, credentials, headers: { 'x-client-fingerprint': getFP(), ...headers } };
  if (json !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(json); } 
  else if (body !== undefined) { opts.body = body; }
  
  const res = await fetch(path, opts);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    if (res.status === 401 && !_retry && !path.includes('/api/me')) {
      await fetch('/refresh', { method: 'POST', credentials: 'include', headers: { 'x-client-fingerprint': getFP() } }).catch(() => {});
      return api(path, { method, json, body, headers, credentials }, true);
    }
    throw new Error(data?.error || res.statusText);
  }
  return data;
}

function getAvatarUrl(user) {
  if (!user) return '/static/img/avatar.png';
  const name = user.fullname || user.email || 'User';
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=1877f2&color=fff&size=128`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const isAr = LANG === 'ar';
  if (m < 1) return isAr ? 'الآن' : 'just now';
  if (m < 60) return isAr ? `منذ ${m} دقيقة` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return isAr ? `منذ ${h} ساعة` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return isAr ? `منذ ${d} يوم` : `${d}d ago`;
}

function safe(t = '') {
  return String(t).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function openSafeLogin() {
  const loginBtn = document.querySelector('[data-open-login]');
  if (loginBtn) loginBtn.click();
  else if (window.openLoginDialog) window.openLoginDialog();
  else alert("Please log in.");
}

/* -------------------- MAIN LOGIC -------------------- */
async function loadArticles() {
  const container = document.getElementById('articles-list');
  if (!container) return;

  container.className = 'premium-articles-layout'; 
  container.innerHTML = `<p class="hint" style="grid-column: 1/-1; text-align:center;" data-translate="feed.loading">Loading...</p>`;

  try {
    const articles = await api('/api/articles');
    if (!Array.isArray(articles) || articles.length === 0) {
      container.innerHTML = `<p class="hint" style="grid-column: 1/-1; text-align:center;" data-translate="feed.emptyArticles">No articles yet.</p>`;
      return;
    }

    // AI TRANSLATION LOOP
    const translatedHTML = await Promise.all(articles.map(async a => {
      a.avatar_url = getAvatarUrl(a);
      const isMyArticle = currentUser && String(currentUser.id) === String(a.user_id);
      const deleteBtnHtml = isMyArticle ? `<button class="delete-btn-sm" data-article="${a.id}" data-translate="feed.delete">Delete</button>` : '';
      const starClass = a.user_starred ? 'starred' : '';
      const fallbackImg = `https://placehold.co/600x400/f1f5f9/94a3b8?text=${encodeURIComponent(a.title.substring(0, 10))}`;
      
      const tTitle = await tr(a.title);
      const tContent = await tr(a.content);

      return `
        <div class="premium-article-card" data-article-id="${a.id}">
          ${a.image_url ? `<img src="${safe(a.image_url)}" class="pac-img-top" onerror="this.onerror=null; this.src='${fallbackImg}';">` : '<div class="pac-placeholder-top">📄</div>'}
          <div class="pac-content">
            <div class="pac-title">${safe(tTitle)}</div>
            <div class="pac-meta"><span data-translate="feed.published">Published</span> ${timeAgo(a.created_at)}</div>
            <div class="pac-preview">${safe((tContent||'').slice(0, 150))}...</div>
            <div class="pac-footer">
              <div class="pac-author" onclick="event.stopPropagation(); location.href='${isMyArticle ? '/profile' : `/user/${a.user_id}`}';">
                <img src="${safe(a.avatar_url)}">
                <span class="pac-author-name">${safe(a.fullname || 'Unknown')}</span>
              </div>
              <div class="pac-actions">
                <button class="star-btn ${starClass}" data-star="${a.id}">⭐ <span>${a.stars || 0}</span></button>
                ${deleteBtnHtml}
              </div>
            </div>
          </div>
        </div>
      `;
    }));

    container.innerHTML = translatedHTML.join('');

    const readingModal = document.getElementById('premium-reading-modal');
    const rTitle = document.getElementById('reading-title');
    const rMeta = document.getElementById('reading-meta');
    const rBody = document.getElementById('reading-body');

    container.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.delete-btn-sm');
      if (deleteBtn) {
        e.stopPropagation();
        if(!confirm(LANG === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?')) return;
        const res = await fetch(`/api/articles/${deleteBtn.dataset.article}`, { method: 'DELETE', credentials: 'include' });
        if(res.ok) loadArticles();
        return;
      }

      const starBtn = e.target.closest('.star-btn');
      if (starBtn) {
        e.stopPropagation();
        if (!currentUser) return openSafeLogin();
        starBtn.style.pointerEvents = 'none'; 
        const res = await fetch(`/api/articles/${starBtn.dataset.star}/star`, { method: 'POST', credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.starred) starBtn.classList.add('starred');
          else starBtn.classList.remove('starred');
          starBtn.querySelector('span').textContent = data.stars;
        }
        starBtn.style.pointerEvents = 'auto';
        return;
      }

      const card = e.target.closest('.premium-article-card');
      if (card) {
        const articleId = card.dataset.articleId;
        const article = await api(`/api/articles/${articleId}`).catch(()=>({}));
        
        const tTitle = await tr(article.title);
        const tContent = await tr(article.content);

        rTitle.textContent = tTitle || '';
        rMeta.innerHTML = `<span data-translate="feed.published">Published</span> ${timeAgo(article.created_at)} · <span data-translate="feed.by">By</span> ${safe(article.fullname || 'Unknown')}`;
        
        rBody.innerHTML = '';
        if (article.image_url) {
            const fallbackImg = `https://placehold.co/800x400/f1f5f9/94a3b8?text=${encodeURIComponent(article.title.substring(0, 10))}`;
            rBody.innerHTML += `<img src="${safe(article.image_url)}" class="art-img" onerror="this.onerror=null; this.src='${fallbackImg}';">`;
        }
        
        const textDiv = document.createElement('div');
        textDiv.className = 'art-body';
        textDiv.textContent = tContent || '';
        rBody.appendChild(textDiv);
        
        readingModal.style.display = 'flex';
      }
    });

  } catch (err) {
    container.innerHTML = '<p class="hint" style="grid-column: 1/-1; text-align:center;">Failed to load articles.</p>';
  }
}



/* ================= APPEND TO articles.js ================= */
// Add reading progress bar & smooth scroll fix
document.addEventListener('scroll', () => {
  const modal = document.getElementById('premium-reading-modal');
  if (modal?.style.display === 'flex') {
    const container = document.getElementById('reading-body');
    if (container) {
      const scrollPercent = (container.scrollTop / (container.scrollHeight - container.clientHeight)) * 100;
      if (!document.getElementById('reading-progress')) {
        const bar = document.createElement('div');
        bar.id = 'reading-progress';
        bar.style.cssText = 'position:fixed;top:0;left:0;height:4px;background:#2563eb;z-index:999999;transition:width 0.2s;';
        document.body.prepend(bar);
      }
      document.getElementById('reading-progress').style.width = `${Math.min(scrollPercent, 100)}%`;
    }
  }
});
/* ================= END APPEND ================= */



function setupCreateModal() {
  const btnAdd = document.getElementById('btn-add-article'); 
  const createModal = document.getElementById('premium-create-modal');
  const readingModal = document.getElementById('premium-reading-modal');

  document.getElementById('reading-modal-close').onclick = () => readingModal.style.display = 'none';
  readingModal.onclick = e => { if (e.target === readingModal) readingModal.style.display = 'none'; };

  document.getElementById('create-modal-close').onclick = () => createModal.style.display = 'none';
  createModal.onclick = e => { if (e.target === createModal) createModal.style.display = 'none'; };

  if (btnAdd) {
    btnAdd.addEventListener('click', (e) => {
      e.preventDefault();
      if (!currentUser) return openSafeLogin();
      createModal.style.display = 'flex';
    });
  }

  const btnSubmit = document.getElementById('create-submit-btn');
  const titleInp = document.getElementById('create-title-inp');
  const contentInp = document.getElementById('create-content-inp');
  const imageInp = document.getElementById('create-image-inp');

  if (btnSubmit) {
    btnSubmit.addEventListener('click', async () => {
      const title = titleInp.value.trim();
      const content = contentInp.value.trim();
      if (!title || !content) return alert(LANG === 'ar' ? 'مطلوب' : 'Required');

      btnSubmit.disabled = true;
      const fd = new FormData();
      fd.append('title', title);
      fd.append('content', content);
      if (imageInp.files.length > 0) fd.append('image', imageInp.files[0]); 

      try {
        await api('/api/articles', { method: 'POST', body: fd });
        titleInp.value = ''; contentInp.value = ''; imageInp.value = '';
        createModal.style.display = 'none';
        loadArticles();
      } catch (err) { alert('Failed'); } 
      finally { btnSubmit.disabled = false; }
    });
  }
}

async function boot() {
  // Translate title on page load if needed
  document.querySelector('h1')?.setAttribute('data-translate', 'navbar.articles');
  
  injectArticleStyles(); 
  injectModals(); 
  try { currentUser = await api('/api/me').catch(() => null); } catch (e) {}
  setupCreateModal();
  loadArticles();
}

boot();
window.addEventListener('auth-success', boot);
if (typeof window.pageContentReady === 'function') {
  window.pageContentReady();
}