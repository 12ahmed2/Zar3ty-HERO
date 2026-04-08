// public/js/login_sign.js — Injects premium login/signup dialogs and wires up auth forms
window.injectAuthDialogs = function () {
// Prevent double-inject
if (document.getElementById('dlg-login') || document.getElementById('dlg-signup')) return;

/* ================= INJECT PREMIUM AUTH STYLES ================= */
const style = document.createElement('style');
style.id = 'auth-dynamic-styles';
style.textContent = `
/* Force hide the modal if it is not explicitly opened */
dialog.custom-auth-modal:not([open]) {
  display: none !important;
}

/* Perfect center alignment */
dialog.custom-auth-modal {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  margin: 0 !important;
  z-index: 999999 !important;
  
  /* Visual Reset */
  border: none !important;
  border-radius: 20px !important;
  padding: 0 !important;
  background: transparent !important;
  max-width: 420px !important;
  width: 90% !important;
  max-height: 95vh !important;
  overflow-y: auto !important;
}

/* Blur Backdrop */
dialog.custom-auth-modal::backdrop {
  background: rgba(15, 23, 42, 0.75) !important;
  backdrop-filter: blur(8px) !important;
}

/* Card Container */
.auth-card {
  background: #fff;
  padding: 40px 32px;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
  margin: 0;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Typography */
.auth-card h3 {
  font-size: 1.8rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
  text-align: center;
}

.auth-sub {
  color: #64748b;
  text-align: center;
  margin: -8px 0 12px 0;
  font-size: 0.95rem;
}

/* Inputs */
.auth-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 600;
  color: #334155;
  font-size: 0.9rem;
}

.auth-label input {
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  font-size: 1rem;
  background: #f8fafc;
  transition: all 0.2s;
  font-family: inherit;
}

.auth-label input:focus {
  outline: none;
  border-color: #2563eb;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
}

/* Buttons */
.auth-submit {
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 14px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
  text-align: center;
  width: 100%;
}

.auth-submit:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37,99,235,0.3);
}

.auth-submit:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.auth-ghost-btn {
  background: transparent;
  color: #64748b;
  border: 1px solid #e2e8f0;
  padding: 12px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  width: 100%;
}

.auth-ghost-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
  border-color: #cbd5e1;
}

/* Utilities */
.auth-error {
  color: #ef4444;
  font-size: 0.9rem;
  text-align: center;
  margin: 0;
  min-height: 1.2em;
  font-weight: 500;
}

.auth-hint {
  text-align: center;
  font-size: 0.95rem;
  color: #64748b;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.auth-link {
  color: #2563eb;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.2s;
}

.auth-link:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

/* Close X */
.auth-close-x {
  position: absolute;
  top: 16px;
  right: 20px;
  background: none;
  border: none;
  font-size: 28px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
  line-height: 1;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.auth-close-x:hover {
  color: #0f172a;
  background: #f1f5f9;
}

/* RTL Support */
html[dir="rtl"] .auth-close-x {
  right: auto;
  left: 20px;
}

/* Responsive */
@media (max-width: 480px) {
  .auth-card {
    padding: 32px 24px;
  }
  
  .auth-card h3 {
    font-size: 1.5rem;
  }
  
  dialog.custom-auth-modal {
    width: 95% !important;
  }
}
`;
document.head.appendChild(style);

/* ================= INJECT HTML ================= */
const html = `
<dialog id="dlg-login" class="custom-auth-modal">
 <form id="form-login" method="dialog" class="auth-card">
   <button type="button" class="auth-close-x" data-close>&times;</button>
   <h3 id="login-title">Welcome back 👋</h3>
   <p class="auth-sub">Log in to your Zar3ty account</p>
   
   <label class="auth-label">
     <span data-translate="auth.login.email">Email</span>
     <input type="email" name="email" required autocomplete="email" placeholder="you@example.com" />
   </label>
   
   <label class="auth-label">
     <span data-translate="auth.login.password">Password</span>
     <input type="password" name="password" required minlength="8" autocomplete="current-password" placeholder="••••••••" />
   </label>
   
   <p id="login-error" class="auth-error" role="alert" aria-live="assertive"></p>
   
   <button class="auth-submit" id="login-submit-btn" type="submit">Log in</button>
   <button class="auth-ghost-btn" type="button" data-close>Cancel</button>
   
   <p class="auth-hint">
     Don't have an account? 
     <a class="auth-link" data-open-signup>Create one</a>
   </p>
 </form>
</dialog>

<dialog id="dlg-signup" class="custom-auth-modal">
 <form id="form-signup" method="dialog" class="auth-card">
   <button type="button" class="auth-close-x" data-close>&times;</button>
   <h3 id="signup-title">Create an account</h3>
   <p class="auth-sub">Join Zar3ty today</p>
   
   <label class="auth-label">
     <span data-translate="auth.signup.fullname">Full Name</span>
     <input type="text" name="fullname" required autocomplete="name" placeholder="John Doe" />
   </label>
   
   <label class="auth-label">
     <span data-translate="auth.login.email">Email</span>
     <input type="email" name="email" required autocomplete="email" placeholder="you@example.com" />
   </label>
   
   <label class="auth-label">
     <span data-translate="auth.login.password">Password</span>
     <input type="password" name="password" required minlength="8" autocomplete="new-password" placeholder="•••••••• (min 8 chars)" />
   </label>
   
   <p id="signup-error" class="auth-error" role="alert" aria-live="assertive"></p>
   
   <button class="auth-submit" id="signup-submit-btn" type="submit">Sign up</button>
   <button class="auth-ghost-btn" type="button" data-close>Cancel</button>
   
   <p class="auth-hint">
     Already have an account? 
     <a class="auth-link" data-open-login>Log in</a>
   </p>
 </form>
</dialog>
`;
document.body.insertAdjacentHTML('beforeend', html);

/* ================= LOGIC & WIRING ================= */
const dlgLogin = document.getElementById('dlg-login');
const dlgSignup = document.getElementById('dlg-signup');

function safeClose(dlg) {
  if (dlg && dlg.open) {
    try { 
      dlg.close(); 
    } catch (e) { 
      dlg.removeAttribute('open'); 
    }
  }
}

// Close on backdrop click
[dlgLogin, dlgSignup].forEach(dlg => {
  if (!dlg) return;
  dlg.addEventListener('click', (e) => {
    const rect = dlg.getBoundingClientRect();
    const isInDialog = (
      rect.top <= e.clientY && 
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && 
      e.clientX <= rect.left + rect.width
    );
    if (!isInDialog) safeClose(dlg);
  });
});

// Switch between login and signup
document.querySelectorAll('[data-open-signup]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    safeClose(dlgLogin);
    try { 
      dlgSignup.showModal(); 
    } catch (err) { 
      dlgSignup.setAttribute('open', ''); 
    }
  });
});

document.querySelectorAll('[data-open-login]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    safeClose(dlgSignup);
    try { 
      dlgLogin.showModal(); 
    } catch (err) { 
      dlgLogin.setAttribute('open', ''); 
    }
  });
});

// Close buttons
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    safeClose(dlgLogin);
    safeClose(dlgSignup);
  });
});

// Auth fetch helper
async function authFetch(path, body) {
  const res = await fetch('/api/auth' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Authentication failed');
  return data;
}

// Login form submit
document.getElementById('form-login')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-submit-btn');
  const fd = new FormData(e.target);
  
  if (errEl) errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Logging in…';
  
  try {
    await authFetch('/login', { 
      email: fd.get('email'), 
      password: fd.get('password') 
    });
    safeClose(dlgLogin);
    fetch('/api/cart/merge', { method: 'POST', credentials: 'include' }).catch(() => {});
    if (typeof window.refreshAuthUI === 'function') await window.refreshAuthUI().catch(() => {});
    location.reload();
  } catch (err) {
    if (errEl) errEl.textContent = err.message || 'Login failed. Check your email and password.';
    btn.disabled = false;
    btn.textContent = 'Log in';
  }
});

// Signup form submit
document.getElementById('form-signup')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('signup-error');
  const btn = document.getElementById('signup-submit-btn');
  const fd = new FormData(e.target);
  
  if (errEl) errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Creating account…';
  
  try {
    await authFetch('/signup', {
      fullname: fd.get('fullname'),
      email: fd.get('email'),
      password: fd.get('password')
    });
    safeClose(dlgSignup);
    fetch('/api/cart/merge', { method: 'POST', credentials: 'include' }).catch(() => {});
    if (typeof window.refreshAuthUI === 'function') await window.refreshAuthUI().catch(() => {});
    location.reload();
  } catch (err) {
    if (errEl) errEl.textContent = err.message || 'Signup failed. Please try again.';
    btn.disabled = false;
    btn.textContent = 'Sign up';
  }
});
};

// Auto-inject
window.injectAuthDialogs();