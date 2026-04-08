// /static/js/checkout.js
import { detectLanguage, translate } from './translate.js';
const LANG = localStorage.getItem('lang') || 'en';

async function loadCheckoutData() {
  const me = await fetch('/api/me', { credentials: 'include' }).then(r => r.ok ? r.json() : null);
  if (!me) return location.href = '/login';
  
  // Pre-fill
  document.getElementById('chk-name').value = me.fullname || '';
  document.getElementById('chk-email').value = me.email || '';
  
  // Load cart
  const items = await fetch('/api/cart', { credentials: 'include' }).then(r => r.json()).catch(() => []);
  const container = document.getElementById('checkout-items');
  const totalEl = document.getElementById('checkout-total');
  
  let total = 0;
  container.innerHTML = items.map(it => {
    total += (Number(it.price_cents) || 0) * (Number(it.qty) || 1);
    return `<div style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span>${it.name} x${it.qty}</span>
      <span>$${(it.price_cents * it.qty / 100).toFixed(2)}</span>
    </div>`;
  }).join('');
  totalEl.textContent = `$${(total / 100).toFixed(2)}`;
}

document.getElementById('checkout-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = LANG === 'ar' ? 'جاري المعالجة...' : 'Processing...';
  
  const payload = {
    address: {
      full: document.getElementById('chk-address').value,
      city: document.getElementById('chk-city').value
    },
    phone: document.getElementById('chk-phone').value,
    notes: document.getElementById('chk-notes').value
  };
  
  try {
    const res = await fetch('/api/checkout/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    location.href = `/order/success?id=${data.order_id}`; // You can add a success page
  } catch (err) {
    alert(err.message);
    btn.disabled = false;
    btn.textContent = LANG === 'ar' ? 'إتمام الطلب' : 'Place Order';
  }
});

loadCheckoutData();


/* ================================================================
   🚀 IMPROVEMENTS & ENHANCEMENTS (APPENDED BELOW - ZERO DELETIONS)
   ================================================================ */

/* 1. TRANSLATION CACHE & HELPER FOR UI ELEMENTS */
const UI_TRANSLATIONS = {
  en: {
    processing: 'Processing...',
    place_order: 'Place Order',
    required: 'This field is required',
    invalid_email: 'Please enter a valid email',
    invalid_phone: 'Please enter a valid phone number',
    address_required: 'Address is required',
    city_required: 'City is required',
    order_success: 'Order placed successfully!',
    order_failed: 'Order failed',
    empty_cart: 'Your cart is empty',
    loading: 'Loading...',
    checkout_title: 'Secure Checkout',
    your_cart: 'Your Cart',
    total: 'Total',
    fullname: 'Full Name',
    email: 'Email',
    phone: 'Phone',
    address: 'Shipping Address',
    city: 'City',
    notes: 'Order Notes (Optional)',
    cancel: 'Cancel',
    back_to_cart: 'Back to Cart'
  },
  ar: {
    processing: 'جاري المعالجة...',
    place_order: 'إتمام الطلب',
    required: 'هذا الحقل مطلوب',
    invalid_email: 'يرجى إدخال بريد إلكتروني صحيح',
    invalid_phone: 'يرجى إدخال رقم هاتف صحيح',
    address_required: 'العنوان مطلوب',
    city_required: 'المدينة مطلوبة',
    order_success: 'تم تقديم الطلب بنجاح!',
    order_failed: 'فشل في تقديم الطلب',
    empty_cart: 'عربة التسوق فارغة',
    loading: 'جاري التحميل...',
    checkout_title: 'الدفع الآمن',
    your_cart: 'عربة التسوق',
    total: 'الإجمالي',
    fullname: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    phone: 'رقم الهاتف',
    address: 'عنوان الشحن',
    city: 'المدينة',
    notes: 'ملاحظات الطلب (اختياري)',
    cancel: 'إلغاء',
    back_to_cart: 'العودة للعربة'
  }
};

function t(key) {
  return UI_TRANSLATIONS[LANG]?.[key] || UI_TRANSLATIONS.en[key] || key;
}

/* 2. FORM VALIDATION HELPERS */
function validateForm() {
  const errors = [];
  
  const name = document.getElementById('chk-name')?.value?.trim();
  const email = document.getElementById('chk-email')?.value?.trim();
  const phone = document.getElementById('chk-phone')?.value?.trim();
  const address = document.getElementById('chk-address')?.value?.trim();
  const city = document.getElementById('chk-city')?.value?.trim();
  
  if (!name) errors.push({ field: 'chk-name', message: t('required') });
  if (!email) {
    errors.push({ field: 'chk-email', message: t('required') });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'chk-email', message: t('invalid_email') });
  }
  if (!phone) {
    errors.push({ field: 'chk-phone', message: t('required') });
  } else if (!/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(phone.replace(/[\s\-\.\(\)]/g, ''))) {
    errors.push({ field: 'chk-phone', message: t('invalid_phone') });
  }
  if (!address) errors.push({ field: 'chk-address', message: t('address_required') });
  if (!city) errors.push({ field: 'chk-city', message: t('city_required') });
  
  return errors;
}

function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  
  // Remove existing error
  const existingError = field.parentElement?.querySelector('.field-error');
  if (existingError) existingError.remove();
  
  // Add error styling
  field.style.borderColor = '#ef4444';
  field.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.1)';
  
  // Add error message
  const errorEl = document.createElement('div');
  errorEl.className = 'field-error';
  errorEl.style.cssText = `color:#ef4444;font-size:0.85rem;margin-top:4px;font-weight:500;${LANG === 'ar' ? 'text-align:right' : ''}`;
  errorEl.textContent = message;
  field.parentElement?.appendChild(errorEl);
  
  // Clear error on input
  field.addEventListener('input', () => {
    field.style.borderColor = '';
    field.style.boxShadow = '';
    errorEl.remove();
  }, { once: true });
}

function clearAllErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  document.querySelectorAll('#checkout-form input, #checkout-form textarea').forEach(field => {
    field.style.borderColor = '';
    field.style.boxShadow = '';
  });
}

/* 3. TOAST NOTIFICATION SYSTEM */
function showToast(message, type = 'info', duration = 3000) {
  // Remove existing toasts
  document.querySelectorAll('.checkout-toast').forEach(t => t.remove());
  
  const toast = document.createElement('div');
  toast.className = `checkout-toast`;
  toast.style.cssText = `
    position:fixed;top:20px;${LANG === 'ar' ? 'left' : 'right'}:20px;
    background:${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
    color:#fff;padding:14px 20px;border-radius:12px;
    box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:10000;
    font-weight:600;font-size:0.95rem;max-width:320px;
    animation:slideInToast 0.3s ease;
    ${LANG === 'ar' ? 'direction:rtl;text-align:right' : ''}
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Auto-remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Add toast animation if not present
if (!document.getElementById('checkout-toast-styles')) {
  const style = document.createElement('style');
  style.id = 'checkout-toast-styles';
  style.textContent = `@keyframes slideInToast{from{transform:translateX(${LANG === 'ar' ? '-' : ''}100%);opacity:0}to{transform:translateX(0);opacity:1}}`;
  document.head.appendChild(style);
}

/* 4. ENHANCED CART RENDERING WITH TRANSLATION */
async function renderCartItems() {
  const container = document.getElementById('checkout-items');
  const totalEl = document.getElementById('checkout-total');
  if (!container) return;
  
  container.innerHTML = `<div style="text-align:center;padding:20px;color:#64748b;">${t('loading')}</div>`;
  
  try {
    const items = await fetch('/api/cart', { credentials: 'include' }).then(r => r.json()).catch(() => []);
    
    if (!items.length) {
      container.innerHTML = `<div style="text-align:center;padding:20px;color:#64748b;">${t('empty_cart')}</div>`;
      if (totalEl) totalEl.textContent = '$0.00';
      return;
    }
    
    let total = 0;
    const itemsHtml = await Promise.all(items.map(async it => {
      const itemTotal = (Number(it.price_cents) || 0) * (Number(it.qty) || 1);
      total += itemTotal;
      
      // Translate item name if needed
      const itemName = detectLanguage(it.name) === LANG 
        ? it.name 
        : await translate(it.name, detectLanguage(it.name), LANG).catch(() => it.name);
      
      return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;color:#0f172a;font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(itemName)}</div>
          <div style="font-size:0.85rem;color:#64748b;margin-top:2px;">Qty: ${it.qty}</div>
        </div>
        <div style="font-weight:700;color:#0f172a;font-size:1rem;">$${(itemTotal / 100).toFixed(2)}</div>
      </div>`;
    }));
    
    container.innerHTML = itemsHtml.join('');
    if (totalEl) totalEl.textContent = `$${(total / 100).toFixed(2)}`;
    
    // Update total in Arabic format if needed
    if (LANG === 'ar' && totalEl) {
      totalEl.dir = 'ltr'; // Keep numbers LTR for currency
    }
    
  } catch (err) {
    console.error('Failed to load cart:', err);
    container.innerHTML = `<div style="text-align:center;padding:20px;color:#ef4444;">Failed to load cart items</div>`;
  }
}

/* 5. HTML ESCAPE HELPER */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* 6. ENHANCED FORM SUBMIT WITH BETTER UX */
const _origSubmitHandler = document.getElementById('checkout-form')?.addEventListener;
if (document.getElementById('checkout-form')) {
  // Remove existing listener and re-add with enhanced version
  const form = document.getElementById('checkout-form');
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);
  
  newForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();
    
    // Validate form
    const errors = validateForm();
    if (errors.length) {
      errors.forEach(err => showFieldError(err.field, err.message));
      // Focus first error field
      const firstError = document.getElementById(errors[0].field);
      if (firstError) firstError.focus();
      return;
    }
    
    const btn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = btn?.textContent;
    
    if (btn) {
      btn.disabled = true;
      btn.textContent = t('processing');
      btn.style.opacity = '0.8';
    }
    
    // Show loading state on cart items
    const cartContainer = document.getElementById('checkout-items');
    if (cartContainer) {
      cartContainer.style.opacity = '0.6';
      cartContainer.style.pointerEvents = 'none';
    }
    
    const payload = {
      address: {
        full: document.getElementById('chk-address')?.value?.trim(),
        city: document.getElementById('chk-city')?.value?.trim(),
        // Add more fields if your form has them
        country: document.getElementById('chk-country')?.value?.trim() || '',
        postal_code: document.getElementById('chk-postal')?.value?.trim() || ''
      },
      phone: document.getElementById('chk-phone')?.value?.trim(),
      notes: document.getElementById('chk-notes')?.value?.trim() || '',
      // Add billing address if different
      billing_same: document.getElementById('chk-billing-same')?.checked !== false
    };
    
    try {
      const res = await fetch('/api/checkout/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || data.detail || t('order_failed'));
      }
      
      // Success!
      showToast(t('order_success'), 'success', 4000);
      
      // Clear cart badge if function exists
      if (typeof window.updateCartBadge === 'function') {
        await window.updateCartBadge().catch(() => {});
      }
      
      // Redirect to success page with order ID
      const orderId = data.order_id || data.id;
      if (orderId) {
        // Add a small delay for toast to be visible
        setTimeout(() => {
          location.href = `/order/success?id=${orderId}`;
        }, 1500);
      } else {
        // Fallback redirect
        setTimeout(() => {
          location.href = '/profile?tab=orders';
        }, 1500);
      }
      
    } catch (err) {
      console.error('Checkout error:', err);
      showToast(err.message || t('order_failed'), 'error', 5000);
      
      // Re-enable form
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalBtnText || t('place_order');
        btn.style.opacity = '1';
      }
      if (cartContainer) {
        cartContainer.style.opacity = '1';
        cartContainer.style.pointerEvents = 'auto';
      }
    }
  });
}

/* 7. AUTO-TRANSLATE UI ON LOAD */
async function translateCheckoutUI() {
  // Translate all elements with data-translate attribute
  document.querySelectorAll('[data-translate]').forEach(el => {
    const key = el.getAttribute('data-translate');
    const val = key.split('.').reduce((o, k) => o?.[k], UI_TRANSLATIONS[LANG]);
    if (val) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = val;
      } else {
        el.textContent = val;
      }
    }
  });
  
  // Translate placeholders
  document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
    const key = el.getAttribute('data-translate-placeholder');
    const val = key.split('.').reduce((o, k) => o?.[k], UI_TRANSLATIONS[LANG]);
    if (val) el.placeholder = val;
  });
  
  // Set direction for Arabic
  if (LANG === 'ar') {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
    
    // Adjust form layout for RTL
    const form = document.getElementById('checkout-form');
    if (form) {
      form.style.direction = 'rtl';
      form.style.textAlign = 'right';
    }
    
    // Adjust cart items alignment
    const cartItems = document.querySelectorAll('#checkout-items > div');
    cartItems.forEach(item => {
      item.style.flexDirection = 'row-reverse';
    });
  }
}

/* 8. LISTEN FOR LANGUAGE CHANGES */
window.addEventListener('storage', (e) => {
  if (e.key === 'lang') {
    LANG = e.newValue || 'en';
    translateCheckoutUI();
    renderCartItems(); // Re-render cart with new language
  }
});

/* 9. ENHANCED BOOT WITH BETTER ERROR HANDLING */
const _origLoadCheckoutData = loadCheckoutData;
window.loadCheckoutData = async function() {
  try {
    // Show loading state
    const container = document.getElementById('checkout-items');
    if (container) {
      container.innerHTML = `<div style="text-align:center;padding:20px;color:#64748b;">${t('loading')}</div>`;
    }
    
    const me = await fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);
    
    if (!me) {
      showToast('Please log in to checkout', 'error');
      setTimeout(() => location.href = '/login', 1500);
      return;
    }
    
    // Pre-fill with better UX
    const nameField = document.getElementById('chk-name');
    const emailField = document.getElementById('chk-email');
    
    if (nameField && me.fullname) {
      nameField.value = me.fullname;
      // Add subtle animation for pre-filled fields
      nameField.style.backgroundColor = '#f0fdf4';
      setTimeout(() => { nameField.style.backgroundColor = ''; }, 1000);
    }
    
    if (emailField && me.email) {
      emailField.value = me.email;
      emailField.style.backgroundColor = '#f0fdf4';
      setTimeout(() => { emailField.style.backgroundColor = ''; }, 1000);
      emailField.readOnly = true; // Email shouldn't be changed at checkout
      emailField.style.cursor = 'not-allowed';
      emailField.style.opacity = '0.7';
    }
    
    // Load and render cart
    await renderCartItems();
    
    // Translate UI after data loads
    await translateCheckoutUI();
    
  } catch (err) {
    console.error('Failed to load checkout data:', err);
    showToast('Failed to load checkout. Please try again.', 'error');
  }
};

/* 10. ADD DYNAMIC CSS FOR BETTER STYLING */
function injectCheckoutStyles() {
  if (document.getElementById('checkout-dynamic-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'checkout-dynamic-styles';
  style.textContent = `
    /* Form field focus states */
    #checkout-form input:focus,
    #checkout-form textarea:focus {
      outline: none;
      border-color: #2563eb !important;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1) !important;
      background: #fff !important;
    }
    
    /* Error state styling */
    #checkout-form input.error,
    #checkout-form textarea.error {
      border-color: #ef4444 !important;
      box-shadow: 0 0 0 3px rgba(239,68,68,0.1) !important;
    }
    
    /* Button loading state */
    #checkout-form button:disabled {
      opacity: 0.7 !important;
      cursor: not-allowed !important;
      transform: none !important;
    }
    
    /* RTL adjustments */
    html[dir="rtl"] #checkout-form {
      text-align: right;
    }
    
    html[dir="rtl"] .field-error {
      text-align: right !important;
    }
    
    /* Responsive improvements */
    @media (max-width: 768px) {
      #checkout-items > div {
        flex-direction: ${LANG === 'ar' ? 'row' : 'column'} !important;
        align-items: ${LANG === 'ar' ? 'center' : 'flex-start'} !important;
        text-align: ${LANG === 'ar' ? 'right' : 'left'} !important;
      }
    }
    
    /* Smooth transitions */
    #checkout-form input,
    #checkout-form textarea,
    #checkout-form button {
      transition: all 0.2s ease;
    }
  `;
  document.head.appendChild(style);
}

/* 11. INIT ON DOM READY */
document.addEventListener('DOMContentLoaded', () => {
  injectCheckoutStyles();
  
  // Add data-translate attributes to form elements if not present
  const form = document.getElementById('checkout-form');
  if (form) {
    const labels = form.querySelectorAll('label');
    labels.forEach(label => {
      const text = label.textContent?.trim();
      if (text && !label.getAttribute('data-translate')) {
        // Map common labels to translation keys
        const keyMap = {
          'Full Name': 'checkout.fullname',
          'Email': 'checkout.email',
          'Phone': 'checkout.phone',
          'Shipping Address': 'checkout.address',
          'City': 'checkout.city',
          'Order Notes': 'checkout.notes',
          'الاسم الكامل': 'checkout.fullname',
          'البريد الإلكتروني': 'checkout.email',
          'رقم الهاتف': 'checkout.phone',
          'عنوان الشحن': 'checkout.address',
          'المدينة': 'checkout.city',
          'ملاحظات الطلب': 'checkout.notes'
        };
        if (keyMap[text]) {
          label.setAttribute('data-translate', keyMap[text]);
        }
      }
    });
  }
  
  // Initial load
  window.loadCheckoutData();
});

/* 12. EXPORT FOR EXTERNAL USE */
window.checkout = {
  renderCartItems,
  validateForm,
  showToast,
  translateCheckoutUI,
  t
};