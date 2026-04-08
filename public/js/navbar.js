(function () {
  const PLACEHOLDER_ID = 'navbar-placeholder';
  const API_ME         = '/api/me';
  const LOGOUT_PATH    = '/api/auth/logout';
 
  /* ================= HELPERS ================= */
  function isLoggedInCookie() {
    return document.cookie.includes('access_token=') || document.cookie.includes('token=');
  }
 
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g,
      m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
 
  function getUserInitials(name) {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }
 
  /* ================= OPEN LOGIN DIALOG (global helper) ================= */
  window.openLoginDialog = function () {
    const dlg = document.getElementById('dlg-login');
    if (dlg) {
      try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
      return;
    }
    if (typeof injectAuthDialogs === 'function') {
      injectAuthDialogs();
      const dlg2 = document.getElementById('dlg-login');
      if (dlg2) { try { dlg2.showModal(); } catch (e) { dlg2.setAttribute('open', ''); } }
    }
  };
 
  /* ================= FETCH CURRENT USER ================= */
  async function fetchMe() {
    try {
      const res = await fetch(API_ME, { credentials: 'include', headers: { 'Accept': 'application/json' } });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return isLoggedInCookie() ? { email: 'user' } : null;
    }
  }
 
  /* ================= BUILD NAVBAR ================= */
/* ================= BUILD NAVBAR ================= */
function buildNavbar(me, active = 'home') {
  const nav      = document.createElement('nav');
  nav.className  = 'main-navbar';
  const username = me ? (me.name || me.fullname || me.email || 'Account') : null;
  const userInitials = getUserInitials(username);
  const lang     = localStorage.getItem('lang') || 'en';

  const langSelector = `
    <select id="lang-switcher" class="lang-switcher" aria-label="Language">
      <option value="en"${lang === 'en' ? ' selected' : ''}>EN</option>
      <option value="ar"${lang === 'ar' ? ' selected' : ''}>عربي</option>
    </select>
  `;

  const leftLinks = `
    <a href="/"            class="nav-link${active === 'home'        ? ' active' : ''}" data-translate="navbar.home">Home</a>
    <a href="/#about-us"   class="nav-link${active === 'about-us'    ? ' active' : ''}" data-translate="navbar.aboutUs">About</a>
    <a href="/#products"   class="nav-link${active === 'products'    ? ' active' : ''}" data-translate="navbar.products">Products</a>
    <a href="/courses"     class="nav-link${active === 'courses'     ? ' active' : ''}" data-translate="navbar.courses">Courses</a>
    <a href="/posts"       class="nav-link${active === 'posts'       ? ' active' : ''}" data-translate="navbar.posts">Posts</a>
    <a href="/articles"    class="nav-link${active === 'articles'    ? ' active' : ''}" data-translate="navbar.articles">Articles</a>
    <a href="/bot"         class="nav-link${active === 'bot'         ? ' active' : ''}" data-translate="navbar.bot">Bot</a>
  `;

  // ✅ REMOVED: notifBell variable and its usage

  const rightLinks = me ? `
    <!-- ✅ No notifBell here anymore -->
    <a href="/profile" class="nav-link user-avatar-link${active === 'profile' ? ' active' : ''}">
      <span class="user-avatar-badge">${userInitials}</span>
    </a>
    <button id="btn-open-cart" class="nav-link icon" aria-label="Open cart">
      🛒 <span id="cart-count" class="badge">0</span>
    </button>
    <button id="navbar-logout" class="nav-link logout-btn" type="button" data-translate="navbar.logout">Logout</button>
    ${langSelector}
  ` : `
    <button id="btn-open-cart" class="nav-link icon" aria-label="Open cart">
      🛒 <span id="cart-count" class="badge">0</span>
    </button>
    <button id="navbar-login" class="nav-link login-btn" data-translate="navbar.login">Login</button>
    ${langSelector}
  `;

  nav.innerHTML = `
    <div class="mobile-menu-overlay" id="mobile-menu-overlay"></div>
    <div class="nav-inner">
      <a href="/" class="nav-logo" data-translate="navbar.title">Zar3ty</a>
      <div class="nav-links" id="mobile-nav-links">
        <div class="left-links">${leftLinks}</div>
        <div class="right-links">${rightLinks}</div>
      </div>
      <button class="hamburger" id="navbar-hamburger" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  `;
  return nav;
}
 
  /* ================= MOBILE MENU ================= */
  function setupMobileMenu(navRoot) {
    const hamburger  = navRoot.querySelector('#navbar-hamburger');
    const overlay    = navRoot.querySelector('#mobile-menu-overlay');
    const mobileLinks = navRoot.querySelector('#mobile-nav-links');
 
    function closeMobileMenu() {
      mobileLinks?.classList.remove('open');
      overlay?.classList.remove('active');
      hamburger?.classList.remove('active');
      document.body.classList.remove('no-scroll');
    }
    function openMobileMenu() {
      mobileLinks?.classList.add('open');
      overlay?.classList.add('active');
      hamburger?.classList.add('active');
      document.body.classList.add('no-scroll');
    }
 
    hamburger?.addEventListener('click', () =>
      hamburger.classList.contains('active') ? closeMobileMenu() : openMobileMenu()
    );
    overlay?.addEventListener('click', closeMobileMenu);
    navRoot.querySelectorAll('.nav-links .nav-link').forEach(link =>
      link.addEventListener('click', closeMobileMenu)
    );
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileMenu(); });
    window.addEventListener('resize', () => { if (window.innerWidth > 768) closeMobileMenu(); });
 
    return { openMobileMenu, closeMobileMenu };
  }
 
  /* ================= WIRE NAVBAR EVENTS ================= */
  function wireNavbar(navRoot) {
    const mobileMenu = setupMobileMenu(navRoot);
 
    navRoot.querySelector('#navbar-login')?.addEventListener('click', e => {
      e.preventDefault();
      mobileMenu.closeMobileMenu();
      window.openLoginDialog();
    });
 
    navRoot.querySelector('#navbar-logout')?.addEventListener('click', async e => {
      e.preventDefault();
      mobileMenu.closeMobileMenu();
      try { await fetch(LOGOUT_PATH, { method: 'POST', credentials: 'include' }); } catch {}
      ['access_token', 'token', 'fp', 'guest_cart'].forEach(n =>
        document.cookie = `${n}=; Path=/; Expires=Thu,01 Jan 1970 00:00:00 GMT; SameSite=None`
      );
      window.me = null;
      renderIntoPlaceholder();
      location.href = '/';
    });
 
    navRoot.querySelector('#btn-open-cart')?.addEventListener('click', e => {
      e.preventDefault();
      mobileMenu.closeMobileMenu();
      if (typeof window.openCart === 'function') { window.openCart(); return; }
      const drawer = document.getElementById('cart-drawer');
      if (drawer) drawer.classList.add('open');
      if (typeof window.renderCart === 'function') window.renderCart().catch(() => {});
    });
 
    navRoot.querySelector('#lang-switcher')?.addEventListener('change', async function () {
      const lang = this.value;
      localStorage.setItem('lang', lang);
      document.documentElement.dir  = (lang === 'ar') ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
      if (typeof window.loadLanguage === 'function') await window.loadLanguage(lang);
      location.reload();
    });
 
    // ✅ REMOVED: wireNotifPanel(navRoot);
  }
 
  /* ================= ACTIVE LINK DETECTION ================= */
  function detectActive() {
    const p = location.pathname, h = location.hash;
    if (p.startsWith('/courses'))     return 'courses';
    if (p.startsWith('/profile'))     return 'profile';
    if (p.startsWith('/bot'))         return 'bot';
    if (p.startsWith('/posts'))       return 'posts';
    if (p.startsWith('/articles'))    return 'articles';
    if (h === '#products')            return 'products';
    if (h === '#about-us')            return 'about-us';
    if (p.startsWith('/agritourism')) return 'agritourism';
    return 'home';
  }
 
  /* ================= RENDER INTO PLACEHOLDER ================= */
  async function renderIntoPlaceholder(active) {
    const placeholder = document.getElementById(PLACEHOLDER_ID);
    if (!placeholder) return;
    placeholder.innerHTML = '';
    if (!window.me) window.me = await fetchMe();
    const nav = buildNavbar(window.me, active || detectActive());
    placeholder.appendChild(nav);
    wireNavbar(nav);
    if (typeof window.updateCartBadge === 'function') window.updateCartBadge().catch(() => {});
  }
 
  window.refreshAuthUI = async function () {
    window.me = await fetchMe();
    renderIntoPlaceholder();
    return window.me;
  };
 
  window.addEventListener('hashchange', () => renderIntoPlaceholder());
 
  /* ================= INIT ================= */
  (async function init() {
    const placeholder  = document.getElementById(PLACEHOLDER_ID);
    if (!placeholder) return;
    const currentLang  = localStorage.getItem('lang') || 'en';
    document.documentElement.dir  = (currentLang === 'ar') ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
    await renderIntoPlaceholder();
  })();
 
})();