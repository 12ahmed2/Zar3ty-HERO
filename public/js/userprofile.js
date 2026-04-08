/* ===================================================== 
userProfile.js — Complete Public User Profile Page
===================================================== */
(function () {
  const userId = location.pathname.split('/').pop();
  let currentTab = 'posts';
  let me = null;

  /* =================== HELPERS =================== */
  function getAvatarUrl(user) {
    if (!user) return '/static/img/avatar.png';
    const name = user.fullname || user.email || user.username || 'User';
    const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=1877f2&color=fff&size=128`;
  }

  function safe(t = '') {
    return String(t).replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
    );
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

  function rEmoji(type) {
    return { love: '❤️', like: '👍', dislike: '👎', angry: '😡' }[type] || '❓';
  }

  async function fetchJSON(url, opts = {}) {
    try {
      const r = await fetch(url, { credentials: 'include', ...opts });
      if (!r.ok) return null;
      const text = await r.text();
      if (!text || text.trimStart().startsWith('<')) return null;
      return JSON.parse(text);
    } catch { return null; }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? '';
  }

  function enrichPost(p) {
    return {
      ...p,
      avatar_url: getAvatarUrl(p),
      fullname: p.fullname || p.username || 'User',
      images: p.images || [],
      reactions: p.reactions || {},
      comments_count: p.comments_count || 0
    };
  }

  function enrichArticle(a) {
    return {
      ...a,
      avatar_url: getAvatarUrl(a),
      fullname: a.fullname || 'User'
    };
  }

  /* =================== PROFILE =================== */
  async function loadProfile() {
    const root = document.getElementById('profile-root');
    try {
      const [user, meData] = await Promise.all([
        fetchJSON(`/api/users/${userId}`),
        fetchJSON('/api/me')
      ]);
      me = meData;

      if (!user) {
        if (root) root.innerHTML = '<p class="empty-state">User not found.</p>';
        return;
      }

      const avatarEl = document.getElementById('profile-avatar');
      if (avatarEl) {
        avatarEl.src = user.avatar_url || getAvatarUrl(user);
        avatarEl.onerror = () => { avatarEl.src = '/static/img/avatar.png'; };
      }

      setText('profile-name', user.fullname || 'Unknown User');
      setText('profile-bio', user.bio || '');
      setText('stat-posts', user.posts_count ?? 0);
      setText('stat-articles', user.articles_count ?? 0);
      setText('stat-followers', user.followers_count ?? 0);
      setText('stat-following', user.following_count ?? 0);

      const followBtn = document.getElementById('follow-btn');
      if (followBtn) {
        if (me && String(me.id) === String(userId)) {
          followBtn.style.display = 'none';
        } else {
          followBtn.style.display = 'inline-block';
          if (!me) {
            followBtn.textContent = 'Follow';
            followBtn.onclick = () => window.openLoginDialog();
          } else {
            const status = await fetchJSON(`/api/users/${userId}/follow-status`);
            const isFollowing = status?.following || false;
            followBtn.textContent = isFollowing ? 'Unfollow' : 'Follow';
            followBtn.classList.toggle('following', isFollowing);

            followBtn.onclick = async () => {
              followBtn.disabled = true;
              const res = await fetchJSON(`/api/users/${userId}/follow`, { method: 'POST' });
              followBtn.disabled = false;
              if (res) {
                followBtn.textContent = res.following ? 'Unfollow' : 'Follow';
                followBtn.classList.toggle('following', res.following);
                const el = document.getElementById('stat-followers');
                if (el) el.textContent = Math.max(0, parseInt(el.textContent)||0 + (res.following ? 1 : -1));
              }
            };
          }
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  }

  /* =================== POSTS =================== */
  async function loadPosts() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = '<p class="feed-loading">Loading posts…</p>';

    try {
      const posts = await fetchJSON(`/api/users/${userId}/posts`);
      if (!Array.isArray(posts) || posts.length === 0) {
        container.innerHTML = '<p class="empty-state">No posts yet.</p>';
        return;
      }

      container.innerHTML = posts.map(p => {
        const post = enrichPost(p);
        const reactionsHtml = ['love', 'like', 'dislike', 'angry'].map(r => {
          const count = post.reactions?.[r] || 0;
          return `<button class="reaction-btn" style="border:none; background:#f0f2f5; padding:6px 12px; border-radius:20px; cursor:pointer; font-size:0.9rem;" data-post="${post.id}" data-reaction="${r}">${rEmoji(r)} <span>${count}</span></button>`;
        }).join(' ');

        return `
          <div class="profile-post-card" data-post-id="${post.id}" style="margin-bottom:16px;">
            <div class="ppc-header" style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
              <img src="${safe(post.avatar_url)}" class="ppc-avatar" data-user="${post.user_id}" style="width:40px; height:40px; border-radius:50%; cursor:pointer;">
              <div class="ppc-user-info">
                <div class="ppc-name" data-user="${post.user_id}" style="font-weight:600; cursor:pointer;">${safe(post.fullname)}</div>
                <div class="ppc-time" style="font-size:0.8rem; color:#65676B;">${timeAgo(post.created_at)}</div>
              </div>
            </div>
            <div class="ppc-content" style="margin-bottom:12px; word-break: break-word;">${safe(post.content)}</div>
            ${Array.isArray(post.images) && post.images.length
              ? `<div class="ppc-images" style="margin-bottom:12px;">${post.images.filter(Boolean).map(img => `<img src="${safe(img)}" style="width:100%; border-radius:8px; margin-bottom:4px; object-fit: cover;" loading="lazy">`).join('')}</div>` : ''}
            <div class="ppc-stats" style="display:flex; gap:8px; align-items:center; flex-wrap: wrap;">
              ${reactionsHtml}
              <button class="open-comments-btn" data-post="${post.id}" style="border:none; background:#f0f2f5; padding:6px 12px; border-radius:20px; cursor:pointer; font-size:0.9rem;">💬 <span class="cc-${post.id}">${post.comments_count}</span></button>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('[data-user]').forEach(el => {
        el.onclick = e => {
          e.stopPropagation();
          const uid = el.dataset.user;
          if (uid && String(uid) !== String(userId)) location.href = `/user/${uid}`;
        };
      });

      container.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.onclick = async () => {
          if (!me) return window.openLoginDialog();
          const postId = btn.dataset.post;
          const reaction = btn.dataset.reaction;

          const res = await fetchJSON(`/api/posts/${postId}/react`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reaction })
          });

          if (res && res.reactions) {
            container.querySelectorAll(`.reaction-btn[data-post="${postId}"]`).forEach(rBtn => {
              const rType = rBtn.dataset.reaction;
              rBtn.querySelector('span').textContent = res.reactions[rType] || 0;
            });
          }
        };
      });

      container.querySelectorAll('.open-comments-btn').forEach(btn => {
        btn.onclick = () => openCommentsModal(btn.dataset.post);
      });

    } catch (err) {
      console.error('Error loading posts:', err);
      container.innerHTML = '<p class="empty-state">Error loading posts.</p>';
    }
  }

  /* =================== ARTICLES =================== */
  async function loadArticles() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = '<p class="feed-loading">Loading articles…</p>';

    try {
      const articles = await fetchJSON(`/api/users/${userId}/articles`);
      if (!Array.isArray(articles) || articles.length === 0) {
        container.innerHTML = '<p class="empty-state">No articles yet.</p>';
        return;
      }

      container.innerHTML = articles.map(a => {
        const article = enrichArticle(a);
        return `
          <article class="profile-article-card" data-article-id="${article.id}" style="cursor:pointer; display:flex; gap:16px; margin-bottom:16px; background:#fff; padding:16px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05); align-items: center;">
            ${article.image_url ? `<img src="${safe(article.image_url)}" style="width:100px; height:80px; border-radius:8px; object-fit:cover; flex-shrink: 0;">`
              : '<div style="width:100px; height:80px; border-radius:8px; background:#e9ecef; display:flex; align-items:center; justify-content:center; color:#999; flex-shrink: 0;">📄</div>'}
            <div class="pac-body" style="flex:1; min-width: 0;">
              <div class="pac-title" style="font-weight:700; font-size:1.1rem; color:#1a1a2e; margin-bottom:4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${safe(article.title)}</div>
              <div class="pac-meta" style="font-size:0.8rem; color:#666; margin-bottom:6px;">${timeAgo(article.created_at)} · ⭐ ${article.stars ?? 0}</div>
              <div class="pac-preview" style="font-size:0.9rem; color:#555; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${safe((article.content||'').slice(0,120))}</div>
            </div>
          </article>
        `;
      }).join('');

      const modal = document.getElementById('article-modal');
      const modalContent = modal.querySelector('.article-modal-content');
      const modalTitle = document.getElementById('modal-article-title');
      const modalMeta = document.getElementById('modal-article-meta');
      const modalBody = document.getElementById('modal-article-body');
      const modalClose = document.getElementById('article-modal-close');

      // Fully responsive article modal
      modalContent.style.width = '90%';
      modalContent.style.maxWidth = '700px';
      modalContent.style.boxSizing = 'border-box';
      modalContent.style.padding = window.innerWidth < 600 ? '24px 16px' : '40px 32px';
      
      modalTitle.style.fontSize = window.innerWidth < 600 ? '1.5rem' : '2rem';
      modalTitle.style.marginBottom = '8px';
      modalTitle.style.color = '#111827';
      modalTitle.style.wordBreak = 'break-word';
      
      modalMeta.style.color = '#6b7280';
      modalMeta.style.marginBottom = '24px';
      modalMeta.style.fontSize = '0.95rem';

      document.querySelectorAll('.profile-article-card').forEach(card => {
        card.onclick = async () => {
          const articleId = card.dataset.articleId;
          const article = await fetchJSON(`/api/articles/${articleId}`) || {};
          
          modalTitle.textContent = article.title || '';
          modalMeta.textContent = `Published ${timeAgo(article.created_at)} · ⭐ ${article.stars ?? 0}`;
          
          modalBody.innerHTML = '';
          if (article.image_url) {
            modalBody.innerHTML += `<img src="${safe(article.image_url)}" style="width:100%; max-height:350px; object-fit:cover; border-radius:12px; margin-bottom:24px;">`;
          }
          const textDiv = document.createElement('div');
          textDiv.textContent = article.content || '';
          textDiv.style.whiteSpace = 'pre-wrap'; 
          textDiv.style.lineHeight = '1.8';
          textDiv.style.fontSize = '1.05rem';
          textDiv.style.color = '#374151';
          textDiv.style.wordBreak = 'break-word';
          modalBody.appendChild(textDiv);

          modal.style.display = 'flex';
        };
      });

      modalClose.onclick = () => modal.style.display = 'none';
      window.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };

    } catch (err) {
      console.error('Error loading articles:', err);
    }
  }

  /* =================== COMMENTS SYSTEM =================== */
  function renderCommentHtml(c, level = 0) {
    const comment = { ...c, avatar_url: c.avatar_url || getAvatarUrl(c), fullname: c.fullname || 'User', replies: c.replies || [], reactions: c.reactions || {} };
    const repliesHtml = comment.replies.map(r => renderCommentHtml(r, level + 1)).join('');
    
    const reactions = ['like', 'love', 'dislike', 'angry'].map(r => {
      const count = comment.reactions?.[r] || 0;
      return `<button class="comment-reaction-btn" data-comment="${comment.id}" data-reaction="${r}" style="border:none; background:none; cursor:pointer; font-size:0.85rem; color:#666; padding: 2px;">${rEmoji(r)} <span>${count}</span></button>`;
    }).join(' ');

    const marginLeft = window.innerWidth < 500 ? (level * 10) : (level * 20); // smaller indent on mobile

    return `
      <div class="comment" style="margin-left:${marginLeft}px; background:#f8f9fa; padding:12px; border-radius:8px; margin-bottom:10px; border-left: ${level > 0 ? '3px solid #e2e8f0' : 'none'};">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <img src="${safe(comment.avatar_url)}" style="width:24px; height:24px; border-radius:50%; cursor:pointer;" onclick="location.href='/user/${comment.user_id}'">
          <strong style="color:#1877f2; cursor:pointer; font-size:0.9rem;" onclick="location.href='/user/${comment.user_id}'">${safe(comment.fullname)}</strong>
          <span style="font-size:0.75rem; color:#888;">${timeAgo(comment.created_at)}</span>
        </div>
        <div style="font-size:0.95rem; white-space:pre-wrap; word-break: break-word; color:#111;">${safe(comment.content)}</div>
        <div class="comment-actions" style="margin-top:8px; display:flex; gap:6px; align-items:center; flex-wrap: wrap;">
          ${reactions}
          <button class="reply-comment-btn" data-comment="${comment.id}" style="border:none; background:none; color:#1877f2; cursor:pointer; font-weight:600; font-size:0.85rem; margin-left:4px;">Reply</button>
        </div>
        <div class="reply-box" style="display:none; margin-top:8px;"></div>
        <div class="comment-replies" style="margin-top:10px;">${repliesHtml}</div>
      </div>
    `;
  }

  async function openCommentsModal(postId) {
    let modal = document.getElementById('comments-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'comments-modal';
      modal.className = 'article-modal';
      
      // Fully responsive modal structure
      modal.innerHTML = `
      <div class="article-modal-content" style="width:90%; max-width:600px; padding:20px; box-sizing:border-box; position:relative; max-height:90vh; display:flex; flex-direction:column;">
        <span id="comments-modal-close" class="article-modal-close" style="position:absolute; right:15px; top:15px; cursor:pointer; font-size:1.5rem; line-height:1;">&times;</span>
        <h3 style="margin-bottom:12px; margin-top:0;">Comments</h3>
        
        <div id="comments-list" style="overflow-y: auto; flex: 1; padding-right: 4px; margin-bottom: 12px; min-height: 100px;"></div>
        
        <div style="border-top: 1px solid #eee; padding-top:12px; flex-shrink: 0;">
          <textarea id="comment-input" placeholder="Write a comment..." style="width:100%; padding: 12px; border-radius: 8px; border: 1px solid #ccc; font-family: inherit; resize: none; min-height: 60px; box-sizing:border-box; margin-bottom:8px;"></textarea>
          <button id="comment-submit" class="btn primary" style="width: 100%; padding:10px; border-radius:8px; margin: 0;">Post Comment</button>
        </div>
      </div>`;
      document.body.appendChild(modal);

      document.getElementById('comments-modal-close').onclick = () => { modal.style.display='none'; };
      window.onclick = e => { if (e.target === modal) modal.style.display='none'; };

      const listEl = document.getElementById('comments-list');
      listEl.addEventListener('click', async e => {
        const reactionBtn = e.target.closest('.comment-reaction-btn');
        if (reactionBtn) {
          if (!me) return window.openLoginDialog();
          const commentId = reactionBtn.dataset.comment;
          const reaction = reactionBtn.dataset.reaction;
          const res = await fetchJSON(`/api/comments/${commentId}/react`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reaction })
          });
          if (res) refreshCommentsList(postId);
          return;
        }

        const replyBtn = e.target.closest('.reply-comment-btn');
        if (replyBtn) {
          if (!me) return window.openLoginDialog();
          const commentId = replyBtn.dataset.comment;
          const replyBox = replyBtn.closest('.comment').querySelector('.reply-box');
          
          if (replyBox.style.display === 'block') {
            replyBox.style.display = 'none';
            replyBox.innerHTML = '';
            return;
          }
          
          replyBox.style.display = 'block';
          // Fixed flex wrap for reply box to fit small screens
          replyBox.innerHTML = `
            <div style="display:flex; gap:6px; align-items:center;">
              <input class="input-reply" placeholder="Write a reply…" style="flex:1; min-width:0; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">
              <button class="send-reply-btn" style="background:#1877f2; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; flex-shrink:0;">Send</button>
              <button class="btn-cancel-reply" style="background:#e4e6eb; border:none; padding:8px; border-radius:6px; cursor:pointer; flex-shrink:0;">✕</button>
            </div>`;
          
          replyBox.querySelector('.btn-cancel-reply').onclick = () => { replyBox.style.display = 'none'; };
          
          replyBox.querySelector('.send-reply-btn').onclick = async () => {
            const input = replyBox.querySelector('.input-reply');
            const text = input.value.trim();
            if (!text) return;
            const res = await fetchJSON(`/api/comments/${commentId}/reply`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text })
            });
            if (res) refreshCommentsList(postId);
          };
          return;
        }
      });
    } else {
      modal = document.getElementById('comments-modal');
    }

    modal.style.display = 'flex';
    refreshCommentsList(postId);

    const input = modal.querySelector('#comment-input');
    const submit = modal.querySelector('#comment-submit');
    
    const newSubmit = submit.cloneNode(true);
    submit.parentNode.replaceChild(newSubmit, submit);

    newSubmit.onclick = async () => {
      if (!me) {
        modal.style.display = 'none'; 
        return window.openLoginDialog(); 
      }

      const val = input.value.trim();
      if (!val) return;
      
      newSubmit.disabled = true;
      newSubmit.textContent = 'Posting...';

      const res = await fetchJSON(`/api/comments`, { 
        method: 'POST', body: JSON.stringify({ content: val, post_id: postId }), headers: {'Content-Type':'application/json'} 
      });
      
      newSubmit.disabled = false;
      newSubmit.textContent = 'Post Comment';

      if (res) {
        input.value = '';
        await refreshCommentsList(postId);
        
        const postCard = document.querySelector(`.profile-post-card[data-post-id="${postId}"] .ppc-comment span`);
        if (postCard) postCard.textContent = parseInt(postCard.textContent) + 1;
      }
    };
  }

  async function refreshCommentsList(postId) {
    const list = document.getElementById('comments-list');
    if (!list) return;
    
    const currentScroll = list.scrollTop;
    const comments = await fetchJSON(`/api/posts/${postId}/comments`) || [];
    
    if (comments.length === 0) {
      list.innerHTML = '<p style="color:#888; text-align:center; margin-top:20px;">No comments yet.</p>';
    } else {
      list.innerHTML = comments.map(c => renderCommentHtml(c)).join('');
      if (currentScroll === 0) list.scrollTop = list.scrollHeight;
      else list.scrollTop = currentScroll;
    }
  }

  function initTabs() {
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.profile-tab-btn').forEach(b => {
          b.classList.remove('active'); b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active'); btn.setAttribute('aria-selected', 'true');
        currentTab = btn.dataset.tab;
        if (currentTab === 'posts') loadPosts();
        else loadArticles();
      });
    });
  }

  async function init() {
    await loadProfile();
    initTabs();
    loadPosts();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();