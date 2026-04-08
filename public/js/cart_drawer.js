// public/js/cart_drawer.js — Injects a premium, standalone Cart Drawer

(function injectCartDrawer() {
  // Prevent double-inject
  if (document.querySelector('#cart-drawer')) return;

  /* ================= INJECT PREMIUM CART STYLES ================= */
  const style = document.createElement('style');
  style.id = 'cart-dynamic-styles';
  style.textContent = `
    /* Drawer Container */
    .custom-cart-drawer {
      position: fixed;
      top: 0;
      right: -450px; /* Hidden off-screen by default */
      width: 400px;
      max-width: 90vw;
      height: 100vh;
      background: #ffffff;
      box-shadow: -12px 0 40px rgba(15, 23, 42, 0.15);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      transition: right 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
      font-family: system-ui, -apple-system, sans-serif;
    }
    .custom-cart-drawer.open {
      right: 0;
    }

    /* RTL (Arabic) Support */
    html[dir="rtl"] .custom-cart-drawer {
      right: auto;
      left: -450px;
      box-shadow: 12px 0 40px rgba(15, 23, 42, 0.15);
      transition: left 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    html[dir="rtl"] .custom-cart-drawer.open {
      left: 0;
      right: auto;
    }

    /* Background Scrim */
    .cart-scrim {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(4px);
      z-index: 999998;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    .cart-scrim.show {
      opacity: 1;
      pointer-events: auto;
    }

    /* Header */
    .cart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .cart-header h2 {
      margin: 0;
      font-size: 1.4rem;
      font-weight: 800;
      color: #0f172a;
    }
    .close-cart-btn {
      background: #e2e8f0;
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      color: #475569;
      cursor: pointer;
      transition: background 0.2s, color 0.2s, transform 0.2s;
    }
    .close-cart-btn:hover {
      background: #fee2e2;
      color: #ef4444;
      transform: scale(1.05);
    }

    /* Body / Item List */
    .cart-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background: #ffffff;
    }

    /* Footer / Checkout */
    .cart-footer {
      padding: 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .cart-total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 1.25rem;
      font-weight: 800;
      color: #0f172a;
    }
    .checkout-btn {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 16px;
      border-radius: 12px;
      font-size: 1.1rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      text-align: center;
      width: 100%;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
    }
    .checkout-btn:hover {
      background: #1d4ed8;
      transform: translateY(-2px);
    }

    /* Dynamically Rendered Cart Items */
    .cart-item {
      display: flex;
      gap: 16px;
      align-items: center;
      padding: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .cart-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.06);
    }
    .cart-item img {
      width: 72px;
      height: 72px;
      border-radius: 10px;
      object-fit: cover;
      background: #e2e8f0;
      flex-shrink: 0;
    }
    .cart-item .grow {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .cart-item strong {
      font-size: 1.05rem;
      color: #0f172a;
      line-height: 1.2;
    }
    .cart-item .muted {
      font-size: 0.95rem;
      color: #64748b;
      font-weight: 600;
    }
    
    /* Quantity Adjusters */
    .cart-item .qty {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 6px;
    }
    .cart-item .qty button {
      background: #e2e8f0;
      border: none;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      font-weight: bold;
      color: #334155;
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cart-item .qty button:hover {
      background: #cbd5e1;
    }
    .cart-item .qty span {
      font-weight: 700;
      color: #0f172a;
      min-width: 20px;
      text-align: center;
    }
    
    /* Trash Button */
    .cart-item .btn-remove {
      background: #fee2e2;
      color: #ef4444;
      border: none;
      border-radius: 10px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.2s, transform 0.2s;
      font-size: 1.2rem;
      flex-shrink: 0;
    }
    .cart-item .btn-remove:hover {
      background: #fecaca;
      transform: scale(1.05);
    }

    /* Empty Cart State */
    .cart-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      color: #94a3b8;
      gap: 16px;
      text-align: center;
      margin: auto;
      font-size: 1.15rem;
      font-weight: 600;
    }
  `;
  document.head.appendChild(style);

  /* ================= INJECT HTML ================= */
  const cartHTML = `
    <div id="scrim" class="cart-scrim" hidden></div>
    
    <aside id="cart-drawer" class="custom-cart-drawer drawer" aria-hidden="true"> 
      <div class="cart-header"> 
        <h2 data-translate="index.cart.yourCart">Your cart</h2> 
        <button id="btn-close-cart" class="close-cart-btn" aria-label="Close cart">✖</button> 
      </div> 
      
      <div id="cart-items" class="cart-body cart-list" role="list" aria-live="polite"></div> 
      
      <div class="cart-footer drawer-footer"> 
        <div class="cart-total-row total"> 
          <span data-translate="index.cart.total">Total</span> 
          <strong id="cart-total">$0.00</strong> 
        </div> 
        <button id="btn-checkout" class="checkout-btn btn wide" data-translate="index.cart.checkout">Checkout</button> 
      </div> 
    </aside>
  `;

  // Put it at the end of <body>
  document.body.insertAdjacentHTML('beforeend', cartHTML);

  /* ================= FALLBACK CLOSING LOGIC ================= */
  // Ensures the X button and Scrim background always close the cart safely
  setTimeout(() => {
    const drawer = document.getElementById('cart-drawer');
    const scrim = document.getElementById('scrim');
    const closeBtn = document.getElementById('btn-close-cart');

    function closeCart() {
      if(drawer) drawer.classList.remove('open');
      if(scrim) scrim.classList.remove('show');
    }

    if (closeBtn) closeBtn.addEventListener('click', closeCart);
    if (scrim) scrim.addEventListener('click', closeCart);
  }, 100);

})();