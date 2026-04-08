/* =====================================================
posts.js  —  Social Feed (FIXED for current server.js)
+ Deep AI Translation & Localization
===================================================== */
import { detectLanguage, translate } from './translate.js';

const LANG = localStorage.getItem('lang') || 'en';

const list         = document.getElementById('posts-list');
const modal        = document.getElementById('post-modal');
const viewModal    = document.getElementById('view-post-modal');
const commentsList = document.getElementById('comments-list');
let postsCache    = [];
let currentPostId = null;
let currentUserId = null;
let feedOffset    = 0;
let feedLoading   = false;
let feedHasMore   = true;

/* --- AI TRANSLATION HELPER --- */
async function tr(text) {
  if (!text) return '';
  const src = detectLanguage(text);
  if (src === 'unknown' || src === LANG) return text;
  try { return await translate(text, src, LANG); } 
  catch(e) { return text; }
}

/* ================= AVATAR HELPER (matches server logic) ================= */
function getAvatarUrl(user) {
  if (!user) return '/static/img/avatar.png';
  const name = user.fullname || user.email || user.username || 'User';
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=1877f2&color=fff&size=128`;
}

/* ================= BOOT: get current user & inject UI translations ================= */
(async () => {
  try {
    const me = await fetchJSON('/api/me', { credentials: 'include' });
    if (me?.id) currentUserId = String(me.id);

    // Inject Translations into Hardcoded HTML on boot
    document.querySelector('.header-title')?.setAttribute('data-translate', 'navbar.posts');
    document.querySelector('#btn-add-post')?.setAttribute('data-translate', 'feed.createPost');
    document.querySelector('#post-modal .modal-title')?.setAttribute('data-translate', 'feed.createPost');
    document.querySelector('#post-content')?.setAttribute('data-translate-placeholder', 'feed.postPlaceholder');
    document.querySelector('#post-submit')?.setAttribute('data-translate', 'feed.publish');
    document.querySelector('#post-close')?.setAttribute('data-translate', 'feed.cancel');
    document.querySelector('.comments-header')?.setAttribute('data-translate', 'feed.comments');
    document.querySelector('#comment-text')?.setAttribute('data-translate-placeholder', 'feed.writeComment');
    document.querySelector('#send-comment')?.setAttribute('data-translate', 'feed.send');
    document.querySelector('#close-view-post')?.setAttribute('data-translate', 'feed.cancel');

  } catch (e) { console.warn('Could not fetch current user', e); }
})();

/* ================= SAFE HTML ================= */
function safe(text = '') {
  return String(text).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
  );
}

/* ================= TIME AGO ================= */
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
  if (d < 30) return isAr ? `منذ ${d} يوم` : `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ================= SAFE FETCH ================= */
async function fetchJSON(url, options = {}) {
  try {
    const res = await fetch(url, { credentials: 'include', ...options });
    const text = await res.text();
    if (!text || text.trimStart().startsWith('<')) {
      console.error('❌ Not JSON from:', url);
      return null;
    }
    return JSON.parse(text);
  } catch (err) {
    console.error('Fetch error:', url, err);
    return null;
  }
}

/* ================= LOGIN CHECK ================= */
async function checkLogin() {
  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    if (!res.ok) return { logged_in: false };
    const user = await res.json();
    return { logged_in: true, user };
  } catch (e) {
    return { logged_in: false };
  }
}


/* ================= REACTION EMOJI ================= */
function rEmoji(type) {
  return { love: '❤️', like: '👍', dislike: '👎', angry: '😡' }[type] || '❓';
}

/* ================= ENRICH POST DATA (client-side) ================= */
function enrichPost(p) {
  return {
    ...p,
    avatar_url: getAvatarUrl(p),
    fullname: p.fullname || p.username || 'User',
    images: p.images || [],
    reactions: p.reactions || {},
    comments_count: p.comments_count || 0,
    likes_count: p.likes_count || 0
  };
}

/* ================= RENDER SINGLE POST CARD ================= */
function renderPostCard(p) {
  const post = enrichPost(p);
  const reactions = ['love', 'like', 'dislike', 'angry'].map(r => {
    const count = post.reactions?.[r] || 0;
    return `<button class="reaction-btn" data-post="${post.id}" data-reaction="${r}">${rEmoji(r)} <span>${count}</span></button>`;
  }).join('');
  
  const isOwner = currentUserId && String(post.user_id) === String(currentUserId);
  
  return `
    <div class="post" data-post="${post.id}">
      <div class="post-header">
        <img src="${safe(post.avatar_url)}" class="avatar" onerror="this.src='/static/img/avatar.png'" 
             data-user="${post.user_id}" style="cursor:pointer" title="View profile">
        <div class="post-header-info">
          <div class="username" data-user="${post.user_id}" style="cursor:pointer">${safe(post.fullname)}</div>
          <div class="time">${timeAgo(post.created_at)}</div>
        </div>
        ${isOwner ? `<button class="delete-post-btn" data-post="${post.id}" title="Delete">🗑️</button>` : ''}
      </div>
      <div class="post-content">${safe(post.content)}</div>
      ${post.images?.length ? `
        <div class="post-images">
          ${post.images.filter(Boolean).map(img => 
            `<img src="${safe(img)}" class="post-img" loading="lazy">`
          ).join('')}
        </div>` : ''}
      <div class="post-actions">
        ${reactions}
        <button class="open-comments-btn" data-post="${post.id}">💬 <span class="cc-${post.id}">${post.comments_count}</span></button>
      </div>
    </div>`;
}

/* ================= LOAD POSTS ================= */
window.loadPosts = async function (reset = true) {
  if (reset) {
    feedOffset = 0;
    feedHasMore = true;
    postsCache = [];
    if (list) list.innerHTML = '<p class="loading" data-translate="feed.loading">Loading…</p>';
  }
  if (feedLoading) return;
  feedLoading = true;
  
  // Use legacy /api/posts endpoint which returns full data
  // (feed endpoint in current server.js doesn't include images/reactions)
  let posts = null;
  
  try {
    const data = await fetchJSON('/api/posts');
    if (Array.isArray(data)) {
      posts = data.slice(feedOffset, feedOffset + 10);
      feedHasMore = data.length > feedOffset + 10;
    }
  } catch (e) {
    console.error('Error loading posts:', e);
  }
  
  feedLoading = false;
  
  if (!posts) {
    if (reset && list) list.innerHTML = '<p class="empty-state">⚠️ Could not load posts.</p>';
    return;
  }
  
  if (reset && list) list.innerHTML = '';
  if (posts.length === 0 && reset && list) {
    list.innerHTML = '<p class="empty-state" data-translate="feed.emptyPosts">No posts yet. Be the first! 🌱</p>';
    return;
  }

  // AI TRANSLATION BATCH LOOP
  posts = await Promise.all(posts.map(async p => {
    p.content = await tr(p.content);
    return p;
  }));
  
  feedOffset += posts.length;
  postsCache.push(...posts);
  
  const frag = document.createDocumentFragment();
  posts.forEach(p => {
    const div = document.createElement('div');
    div.innerHTML = renderPostCard(p);
    frag.appendChild(div.firstElementChild);
  });
  if (list) list.appendChild(frag);
  
  const sentinel = document.getElementById('feed-sentinel');
  if (sentinel) sentinel.style.display = feedHasMore ? 'block' : 'none';
};

/* ================= INFINITE SCROLL ================= */
(function setupInfiniteScroll() {
  const sentinel = document.getElementById('feed-sentinel');
  if (!sentinel) return;
  
  if (!window.IntersectionObserver) {
    sentinel.innerHTML = `<button onclick="window.loadPosts(false)" class="btn-load-more">Load more</button>`;
    return;
  }
  
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !feedLoading && feedHasMore) {
      window.loadPosts(false);
    }
  }, { rootMargin: '300px' });
  obs.observe(sentinel);
})();

/* ================= DEEP RECURSIVE TRANSLATE ================= */
async function translateCommentTree(c) {
  c.content = await tr(c.content);
  if (c.replies && c.replies.length > 0) {
    c.replies = await Promise.all(c.replies.map(r => translateCommentTree(r)));
  }
  return c;
}

/* ================= OPEN POST & COMMENTS MODAL ================= */
async function openPost(postId) {
  currentPostId = postId;
  if (viewModal) viewModal.classList.remove('hidden');
  
  const post = enrichPost(postsCache.find(p => String(p.id) === String(postId)) || {});
  
  const reactions = ['love', 'like', 'dislike', 'angry'].map(r => {
    const count = post.reactions?.[r] || 0;
    return `<button class="reaction-btn" data-post="${post.id}" data-reaction="${r}">${rEmoji(r)} <span>${count}</span></button>`;
  }).join('');
  
  const viewPostBody = document.getElementById('view-post-body');
  if (viewPostBody) {
    viewPostBody.innerHTML = `
      <div class="post">
        <div class="post-header">
          <img src="${safe(post.avatar_url)}" class="avatar" onerror="this.src='/static/img/avatar.png'" 
               data-user="${post.user_id}" style="cursor:pointer">
          <div class="post-header-info">
            <div class="username" data-user="${post.user_id}" style="cursor:pointer">${safe(post.fullname)}</div>
            <div class="time">${timeAgo(post.created_at)}</div>
          </div>
        </div>
        <div class="post-content">${safe(post.content)}</div>
        ${post.images?.length ? `
          <div class="post-images">
            ${post.images.filter(Boolean).map(img => 
              `<img src="${safe(img)}" class="post-img">`
            ).join('')}
          </div>` : ''}
        <div class="post-actions">${reactions}</div>
      </div>`;
  }
  
  // Load comments
  const commentsListEl = document.getElementById('comments-list');
  if (commentsListEl) {
    commentsListEl.innerHTML = '<p class="loading" data-translate="feed.loading">Loading comments…</p>';
    const comments = await fetchJSON(`/api/posts/${postId}/comments`);
    
    if (!Array.isArray(comments)) {
      commentsListEl.innerHTML = '<p class="empty-state">⚠️ Failed to load comments</p>';
      return;
    }

    // Apply AI translation to the entire comment tree
    const translatedComments = await Promise.all(comments.map(c => translateCommentTree(c)));
    
    // Enrich comments with avatar
    const enriched = translatedComments.map(c => ({
      ...c,
      avatar_url: getAvatarUrl(c),
      fullname: c.fullname || 'User',
      replies: c.replies || []
    }));
    
    commentsListEl.innerHTML = enriched.length
      ? enriched.map(c => renderComment(c)).join('')
      : '<p class="empty-state">No comments yet. Start the conversation!</p>';
  }
  
  // Wire send-comment button
  const sendBtn = document.getElementById('send-comment');
  const inputEl = document.getElementById('comment-text');
  if (sendBtn) {
    const fresh = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(fresh, sendBtn);
    fresh.addEventListener('click', async () => {
      const text = inputEl?.value?.trim();
      if (!text) return;
      
      const login = await checkLogin();
      if (!login.logged_in) {
        const dlg = document.getElementById('dlg-login');
        if (dlg) dlg.showModal();
        return;
      }
      
      fresh.disabled = true;
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: text, post_id: postId })
      });
      fresh.disabled = false;
      
      if (res.ok) {
        if (inputEl) inputEl.value = '';
        const ccEl = document.querySelector(`.cc-${postId}`);
        if (ccEl) ccEl.textContent = Number(ccEl.textContent) + 1;
        openPost(currentPostId);
      } else {
        alert('Failed to send comment');
      }
    });
  }
}

/* ================= RENDER COMMENT (recursive) ================= */
function renderComment(c, level = 0) {
  const comment = {
    ...c,
    avatar_url: c.avatar_url || getAvatarUrl(c),
    fullname: c.fullname || 'User',
    replies: c.replies || [],
    reactions: c.reactions || {}
  };
  
  const repliesHtml = comment.replies.map(r => renderComment(r, level + 1)).join('');
  
  const reactions = ['like', 'love', 'dislike', 'angry'].map(r => {
    const count = comment.reactions?.[r] || 0;
    return `<button class="comment-reaction-btn" data-comment="${comment.id}" data-reaction="${r}">${rEmoji(r)} <span>${count}</span></button>`;
  }).join(' ');
  
  const isOwner = currentUserId && String(comment.user_id) === String(currentUserId);
  
  return `
    <div class="comment modern-comment" style="margin-left:${level * 16}px" data-level="${level}" data-comment="${comment.id}">
      <div class="comment-header">
        <span class="comment-avatar">
          <img src="${safe(comment.avatar_url)}" alt="avatar" onerror="this.src='/static/img/avatar.png'" 
               data-user="${comment.user_id}" style="cursor:pointer">
        </span>
        <span class="comment-user" data-user="${comment.user_id}" style="cursor:pointer">${safe(comment.fullname)}</span>
        <span class="comment-time">${timeAgo(comment.created_at)}</span>
        ${isOwner ? `<button class="delete-comment-btn" data-comment="${comment.id}" title="Delete">🗑️</button>` : ''}
      </div>
      <div class="comment-body">${safe(comment.content)}</div>
      <div class="comment-actions">
        ${reactions}
        <button class="reply-comment-btn" data-comment="${comment.id}" data-translate="feed.reply">↩ Reply</button>
      </div>
      <div class="comment-replies">${repliesHtml}</div>
      <div class="reply-box" style="display:none;"></div>
    </div>`;
}

/* ================= COMMENTS LIST: delegated events ================= */
if (commentsList) {
  commentsList.addEventListener('click', async e => {
    /* --- react to comment --- */
    const reactionBtn = e.target.closest('.comment-reaction-btn');
    if (reactionBtn) {
      const login = await checkLogin();
      if (!login.logged_in) {
        const dlg = document.getElementById('dlg-login');
        if (dlg) dlg.showModal();
        return;
      }
      const commentId = reactionBtn.dataset.comment;
      const reaction = reactionBtn.dataset.reaction;
      const res = await fetch(`/api/comments/${commentId}/react`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction })
      });
      if (res.ok && currentPostId) openPost(currentPostId);
      return;
    }
    
    /* --- reply to comment --- */
    const replyBtn = e.target.closest('.reply-comment-btn');
    if (replyBtn) {
      const commentId = replyBtn.dataset.comment;
      const commentDiv = replyBtn.closest('.comment');
      const replyBox = commentDiv?.querySelector('.reply-box');
      if (!replyBox) return;
      
      if (replyBox.style.display === 'block') {
        replyBox.style.display = 'none';
        replyBox.innerHTML = '';
        return;
      }
      
      replyBox.style.display = 'block';
      replyBox.innerHTML = `
        <div class="reply-input-row">
          <input class="input-reply" placeholder="Write a reply…" data-translate-placeholder="feed.writeComment" maxlength="1000">
          <button class="btn-primary send-reply-btn" data-translate="feed.send">Send</button>
          <button class="btn-cancel-reply">✕</button>
        </div>`;
      
      replyBox.querySelector('.btn-cancel-reply').onclick = () => {
        replyBox.style.display = 'none';
        replyBox.innerHTML = '';
      };
      
      replyBox.querySelector('.send-reply-btn').onclick = async () => {
        const input = replyBox.querySelector('.input-reply');
        const text = input?.value?.trim();
        if (!text) return;
        
        const login = await checkLogin();
        if (!login.logged_in) {
          const dlg = document.getElementById('dlg-login');
          if (dlg) dlg.showModal();
          return;
        }
        
        const res = await fetch(`/api/comments/${commentId}/reply`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text })
        });
        
        if (res.ok) {
          replyBox.style.display = 'none';
          replyBox.innerHTML = '';
          if (currentPostId) openPost(currentPostId);
        } else {
          alert('Failed to send reply');
        }
      };
      return;
    }
    
    /* --- delete comment --- */
    const deleteCommentBtn = e.target.closest('.delete-comment-btn');
    if (deleteCommentBtn) {
      if (!confirm('Delete this comment?')) return;
      const commentId = deleteCommentBtn.dataset.comment;
      const res = await fetch(`/api/comments/${commentId}`, { 
        method: 'DELETE', credentials: 'include' 
      });
      if (res.ok && currentPostId) openPost(currentPostId);
      else alert('Failed to delete comment');
      return;
    }
    
    /* --- navigate to user profile from comment --- */
    const userEl = e.target.closest('[data-user]');
    if (userEl) {
      location.href = `/user/${userEl.dataset.user}`;
      return;
    }
  });
}

/* ================= POST REACTION HANDLER ================= */
async function handleReaction(postId, reactionBtn) {
  const reaction = reactionBtn.dataset.reaction;

  const res = await fetch(`/api/posts/${postId}/react`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reaction })
  });

  if (!res.ok) return;

  const json = await res.json();
  if (!json.ok) return;

  /*
    EXPECTED SERVER RESPONSE (ideal):
    {
      ok: true,
      reactions: { like: 2, love: 1, ... },
      user_reaction: "like" | null
    }
  */

  const post = postsCache.find(p => String(p.id) === String(postId));
  if (!post) return;

  // Update cache
  post.reactions = json.reactions || post.reactions;

  // Update ALL buttons (feed + modal)
  document.querySelectorAll(`.reaction-btn[data-post="${postId}"]`)
    .forEach(btn => {
      const r = btn.dataset.reaction;
      const count = post.reactions?.[r] || 0;

      const span = btn.querySelector('span');
      if (span) span.textContent = count;

      // highlight active reaction
      btn.classList.toggle('active', json.user_reaction === r);
    });
}

/* ================= FEED: delegated click events ================= */
if (list) {
  list.addEventListener('click', async e => {
    /* Reactions */
    const reactionBtn = e.target.closest('.reaction-btn');
    if (reactionBtn) {
      const login = await checkLogin();
      if (!login.logged_in) {
        const dlg = document.getElementById('dlg-login');
        if (dlg) dlg.showModal();
        return;
      }
      await handleReaction(reactionBtn.dataset.post, reactionBtn);
      return;
    }
    
    /* Open comments */
    const openCommentsBtn = e.target.closest('.open-comments-btn');
    if (openCommentsBtn) { openPost(openCommentsBtn.dataset.post); return; }
    
    /* Delete post */
    const deletePostBtn = e.target.closest('.delete-post-btn');
    if (deletePostBtn) {
      if (!confirm(LANG === 'ar' ? 'حذف هذا المنشور؟' : 'Delete this post?')) return;
      const postId = deletePostBtn.dataset.post;
      const res = await fetch(`/api/posts/${postId}`, { 
        method: 'DELETE', credentials: 'include' 
      });
      if (res.ok) window.loadPosts(true);
      else alert('Failed to delete post');
      return;
    }
    
    /* Navigate to user profile (avatar or name) */
    const userEl = e.target.closest('[data-user]');
    if (userEl && !e.target.closest('.delete-post-btn')) {
      location.href = `/user/${userEl.dataset.user}`;
      return;
    }
    
    /* Open image full-size */
    const img = e.target.closest('.post-img');
    if (img) { window.open(img.src, '_blank'); return; }
  });
}

/* ================= MODAL: reaction buttons ================= */
document.addEventListener('click', async e => {
  const reactionBtn = e.target.closest('.reaction-btn');
  if (!reactionBtn) return;
  const viewPostBody = document.getElementById('view-post-body');
  if (!viewPostBody?.contains(reactionBtn)) return;
  
  const login = await checkLogin();
  if (!login.logged_in) {
    const dlg = document.getElementById('dlg-login');
    if (dlg) dlg.showModal();
    return;
  }
  await handleReaction(reactionBtn.dataset.post, reactionBtn);
});

/* ================= CREATE POST ================= */
const postSubmitBtn = document.getElementById('post-submit');
if (postSubmitBtn) {
  postSubmitBtn.addEventListener('click', async () => {
    const content = document.getElementById('post-content')?.value?.trim();
    const filesEl = document.getElementById('post-images');
    const files = filesEl?.files || [];
    const login = await checkLogin();
    
    if (!login.logged_in) {
      const dlg = document.getElementById('dlg-login');
      if (dlg) dlg.showModal();
      return;
    }
    if (!content && files.length === 0) return alert('Post cannot be empty');
    
    postSubmitBtn.disabled = true;
    postSubmitBtn.textContent = LANG === 'ar' ? 'جاري النشر...' : 'Posting…';
    
    const form = new FormData();
    form.append('content', content || '');
    for (const f of files) form.append('images', f);
    
    const res = await fetch('/api/posts', { 
      method: 'POST', body: form, credentials: 'include' 
    });
    
    postSubmitBtn.disabled = false;
    postSubmitBtn.textContent = LANG === 'ar' ? 'نشر' : 'Post';
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return alert(data.error || 'Failed to create post');
    }
    
    if (document.getElementById('post-content')) document.getElementById('post-content').value = '';
    if (filesEl) filesEl.value = '';
    if (modal) modal.classList.add('hidden');
    window.loadPosts(true);
  });
}

/* ================= MODAL OPEN/CLOSE ================= */
// ✅ AFTER (checks login first, then opens modal)
document.getElementById('btn-add-post')?.addEventListener('click', async () => {
  const login = await checkLogin();
  if (!login.logged_in) {
    const dlg = document.getElementById('dlg-login');
    if (dlg) {
      try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
    }
    return;
  }
  modal?.classList.remove('hidden');
});
document.getElementById('post-close')?.addEventListener('click', () => modal?.classList.add('hidden'));
document.getElementById('close-view-post')?.addEventListener('click', () => viewModal?.classList.add('hidden'));
modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
viewModal?.addEventListener('click', e => { if (e.target === viewModal) viewModal.classList.add('hidden'); });

/* ================= KEYBOARD SHORTCUT ================= */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    modal?.classList.add('hidden');
    viewModal?.classList.add('hidden');
  }
});

/* ================= INIT ================= */
window.loadPosts(true);
