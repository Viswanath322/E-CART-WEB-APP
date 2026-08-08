/* ═══════════════════════════════════════════════════════
   V-CART — FRONTEND SCRIPT
   ═══════════════════════════════════════════════════════ */

/* ── Toast Notifications ──────────────────────────────── */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `v-toast ${type}`;
  toast.innerHTML = `
    <span class="v-toast-icon">${icons[type] || icons.info}</span>
    <span class="v-toast-msg">${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('exit');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ── Navbar scroll effect ─────────────────────────────── */
const navbar = document.getElementById('v-navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

/* ── Show/Hide Password Toggle ────────────────────────── */
function togglePassword(fieldId, iconEl) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  const isPass = field.type === 'password';
  field.type = isPass ? 'text' : 'password';
  iconEl.style.opacity = isPass ? '0.5' : '1';
}

/* ── Cart: Add to Cart ────────────────────────────────── */
function addToCart(productId) {
  const btn = document.getElementById('btn-' + productId);
  if (btn) {
    btn.textContent = 'Adding...';
    btn.disabled = true;
  }

  fetch('/add-to-cart/' + productId)
    .then(r => r.json())
    .then(data => {
      if (data.status) {
        // Update cart count badge
        const badge = document.getElementById('cart-count');
        if (badge && data.cartCount !== undefined) {
          badge.textContent = data.cartCount;
          badge.style.display = 'flex';
        }

        // Animate button
        if (btn) {
          btn.textContent = '✓ Added';
          btn.classList.add('added');
          setTimeout(() => {
            btn.textContent = 'Add to Cart';
            btn.classList.remove('added');
            btn.disabled = false;
          }, 2000);
        }
        showToast('Product added to cart! 🛒', 'success');
      } else {
        showToast('Failed to add product.', 'error');
        if (btn) { btn.textContent = 'Add to Cart'; btn.disabled = false; }
      }
    })
    .catch(() => {
      showToast('Network error. Try again.', 'error');
      if (btn) { btn.textContent = 'Add to Cart'; btn.disabled = false; }
    });
}

/* ── Cart: Change Quantity ────────────────────────────── */
function changeQuantity(cartId, productId, count) {
  const qtyEl = document.getElementById('qty-' + productId);
  const subtotalEl = document.getElementById('subtotal-' + productId);
  const qty = parseInt(qtyEl?.textContent || '1');

  fetch('/change-product-quantity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cart: cartId, product: productId, count, quantity: qty })
  })
    .then(r => r.json())
    .then(data => {
      if (data.blockDecrement) {
        showToast('Minimum quantity is 1. Remove the item to delete it.', 'info');
        return;
      }
      if (qtyEl) qtyEl.textContent = data.newQuantity;
      if (subtotalEl) subtotalEl.textContent = '₹' + data.subtotal;

      // Update both grand totals
      ['grand-total', 'grand-total-2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '₹' + data.total;
      });
    })
    .catch(() => showToast('Failed to update quantity.', 'error'));
}

/* ── Cart: Remove Product ─────────────────────────────── */
function removeProduct(cartId, productId) {
  const row = document.getElementById('row-' + productId);
  if (row) {
    row.style.transition = 'all 0.3s ease';
    row.style.opacity = '0';
    row.style.transform = 'translateX(30px)';
  }

  fetch('/remove-from-cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cartId, productId })
  })
    .then(r => r.json())
    .then(data => {
      if (data.status) {
        setTimeout(() => row?.remove(), 300);
        ['grand-total', 'grand-total-2'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.textContent = '₹' + data.total;
        });
        const badge = document.getElementById('cart-count');
        if (badge && data.cartCount !== undefined) {
          badge.textContent = data.cartCount;
          if (data.cartCount === 0) badge.style.display = 'none';
        }
        showToast('Item removed from cart', 'info');
      } else {
        // Undo visual animation
        if (row) { row.style.opacity = '1'; row.style.transform = 'none'; }
        showToast('Failed to remove item.', 'error');
      }
    })
    .catch(() => {
      if (row) { row.style.opacity = '1'; row.style.transform = 'none'; }
      showToast('Network error.', 'error');
    });
}

/* ── Wishlist ─────────────────────────────────────────── */
function addToWishlist(productId) {
  const btn = document.getElementById('wish-' + productId);

  fetch('/add-to-wishlist/' + productId)
    .then(r => r.json())
    .then(data => {
      if (data.status) {
        if (btn) btn.classList.add('active');
        showToast('Added to wishlist ❤️', 'success');
      } else {
        showToast('Failed to add to wishlist.', 'error');
      }
    })
    .catch(() => showToast('Network error.', 'error'));
}

/* ── Live Search ──────────────────────────────────────── */
const searchBox = document.getElementById('search-box');
const searchDropdown = document.getElementById('search-dropdown');
let searchTimeout;

if (searchBox && searchDropdown) {
  searchBox.addEventListener('input', function () {
    clearTimeout(searchTimeout);
    const q = this.value.trim();

    if (q.length < 2) {
      searchDropdown.classList.remove('active');
      searchDropdown.innerHTML = '';
      return;
    }

    searchTimeout = setTimeout(() => {
      fetch('/api/search?q=' + encodeURIComponent(q))
        .then(r => r.json())
        .then(products => {
          if (products.length === 0) {
            searchDropdown.innerHTML = '<div style="padding:0.75rem 1rem; color:var(--text-muted); font-size:0.875rem;">No results found</div>';
          } else {
            searchDropdown.innerHTML = products.map(p => `
              <a class="v-search-item" href="/product/${p._id}">
                <img src="/productimages/${p._id}.jpg" alt="${p.Name}"
                     onerror="this.style.display='none'">
                <div>
                  <div class="v-search-item-name">${p.Name}</div>
                  <div class="v-search-item-price">₹${p.Price}</div>
                </div>
              </a>
            `).join('');
          }
          searchDropdown.classList.add('active');
        })
        .catch(() => { searchDropdown.classList.remove('active'); });
    }, 300);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!searchBox.contains(e.target) && !searchDropdown.contains(e.target)) {
      searchDropdown.classList.remove('active');
    }
  });
}

/* ── Admin sidebar responsive toggle ─────────────────── */
const sidebarToggle = document.getElementById('sidebar-toggle');
if (sidebarToggle) {
  sidebarToggle.style.display = 'block';
}

/* ── Signup password validation ──────────────────────── */
const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', function(e) {
    const pw = this.querySelector('[name="Password"]')?.value;
    const confirm = this.querySelector('[name="confirm"]')?.value;
    if (pw !== confirm) {
      e.preventDefault();
      showToast('Passwords do not match!', 'error');
    }
  });
}
