// ============================================
// SITE CONFIG — edit once, used everywhere
// ============================================
const SITE_CONFIG = {
    phone: '+234 811 480 8088',
    phoneLink: 'tel:+2348114808088',
    whatsapp: 'https://wa.me/2348158339217',
    email: 'info@ishop.com.ng',
    emailLink: 'mailto:info@ishop.com.ng',
    address: 'Lagos, Nigeria',
};

// ============================================
// PRODUCT CACHE — 5 minute TTL, version-invalidated
// ============================================
const PRODUCT_CACHE_KEY = 'iShopProductsCache';
const PRODUCT_CACHE_VERSION_KEY = 'iShopProductsCacheVersion';
const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;

function getProductCacheVersion() {
    return localStorage.getItem(PRODUCT_CACHE_VERSION_KEY) || '1';
}

function bumpProductCacheVersion() {
    localStorage.setItem(PRODUCT_CACHE_VERSION_KEY, String(Date.now()));
}

function readProductCache() {
    try {
        const raw = localStorage.getItem(PRODUCT_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.data)) return null;
        if (parsed.version !== getProductCacheVersion()) return null;
        if (Date.now() - parsed.savedAt > PRODUCT_CACHE_TTL_MS) return null;
        return parsed.data;
    } catch {
        return null;
    }
}

function writeProductCache(data) {
    try {
        localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify({
            version: getProductCacheVersion(),
            savedAt: Date.now(),
            data,
        }));
    } catch (err) {
        console.warn('Could not write product cache:', err.message);
    }
}

function invalidateProductCache() {
    bumpProductCacheVersion();
    localStorage.removeItem(PRODUCT_CACHE_KEY);
    console.log('🔄 Product cache invalidated');
}

// ============================================
// SKELETON LOADERS
// ============================================
function renderProductSkeletons(containerId, count = 10) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const cards = Array.from({ length: count }).map(() => `
        <div class="skeleton-card">
            <div class="skeleton-block skeleton-image"></div>
            <div class="skeleton-block skeleton-line short"></div>
            <div class="skeleton-block skeleton-line medium"></div>
            <div class="skeleton-block skeleton-line short"></div>
            <div class="skeleton-block skeleton-button"></div>
        </div>
    `).join('');
    container.innerHTML = cards;
}

// ============================================
// SHIPPING CALCULATOR (LGA-based) — uses shipping.js
// ============================================

// Only charge delivery if the cart contains at least one physical item
function cartHasPhysical() {
    return cart.some(item => item.type === 'physical' || item.type === '');
}

// Get the currently selected STATE (default or different shipping)
function getSelectedState() {
    const differentShipping = document.getElementById('differentShipping')?.checked;
    if (differentShipping) {
        return document.getElementById('shipState')?.value || '';
    }
    return document.getElementById('state')?.value || '';
}

// Get the currently selected LGA (default or different shipping)
function getSelectedLga() {
    const differentShipping = document.getElementById('differentShipping')?.checked;
    if (differentShipping) {
        return document.getElementById('shipLga')?.value || '';
    }
    return document.getElementById('lga')?.value || '';
}

// Calculate the delivery fee based on the current form state
function getCurrentDeliveryFee() {
    if (!cartHasPhysical()) return 0;
    const stateSlug = getSelectedState();
    const lgaSlug = getSelectedLga();
    if (!stateSlug) return 0;
    return getShippingFee(stateSlug, lgaSlug);
}

// Populate the state dropdowns from shipping.js
function populateStateDropdowns() {
    const states = getAllStates();
    const stateDropdown = document.getElementById('state');
    const shipStateDropdown = document.getElementById('shipState');
    const optionsHTML = states.map(s => '<option value="' + s.slug + '">' + s.name + '</option>').join('');
    if (stateDropdown) {
        stateDropdown.innerHTML = '<option value="">Select your state</option>' + optionsHTML;
    }
    if (shipStateDropdown) {
        shipStateDropdown.innerHTML = '<option value="">Select recipient\'s state</option>' + optionsHTML;
    }
}

// Update LGA dropdown when a state is selected (default shipping)
function updateLGAs(stateSlug) {
    const lgaDropdown = document.getElementById('lga');
    if (!lgaDropdown) return;
    if (!stateSlug) {
        lgaDropdown.innerHTML = '<option value="">Select state first</option>';
        lgaDropdown.disabled = true;
        return;
    }
    const lgas = getLGAsForState(stateSlug);
    lgaDropdown.innerHTML = '<option value="">Select LGA</option>' +
        lgas.map(l => '<option value="' + l.slug + '">' + l.name + ' (₦' + l.fee.toLocaleString() + ')</option>').join('');
    lgaDropdown.disabled = false;
    onLgaChange();
}

// Update LGA dropdown for "different shipping"
function updateShipLGAs(stateSlug) {
    const lgaDropdown = document.getElementById('shipLga');
    if (!lgaDropdown) return;
    if (!stateSlug) {
        lgaDropdown.innerHTML = '<option value="">Select state first</option>';
        lgaDropdown.disabled = true;
        return;
    }
    const lgas = getLGAsForState(stateSlug);
    lgaDropdown.innerHTML = '<option value="">Select LGA</option>' +
        lgas.map(l => '<option value="' + l.slug + '">' + l.name + ' (₦' + l.fee.toLocaleString() + ')</option>').join('');
    lgaDropdown.disabled = false;
    onLgaChange();
}

// Called whenever an LGA is changed — refreshes the order summary
function onLgaChange() {
    // Reset any DHL-specific selection when LGA changes
    selectedShippingMethod = 'flat';
    dhlQuoteCache = { key: '', quotes: [], loading: false, error: null };
    renderCheckoutSummary();
    // Ask for DHL rates (silent no-op if DHL is disabled server-side)
    fetchDHLQuoteIfNeeded();
}

// ============================================
// DHL SHIPPING — live rate quotes
// ============================================

const DHL_QUOTE_API = 'https://ishop-payments-production.up.railway.app/api/shipping/quote';

// Holds the currently selected shipping method: 'flat' | 'dhl-<productCode>'
let selectedShippingMethod = 'flat';

// Cached DHL quotes for the current checkout context
let dhlQuoteCache = {
    key: '',
    quotes: [],
    loading: false,
    error: null,
};

// Rough weight estimate for a cart (kg). Uses item.weight if present, else a
// per-category default. Physical items only.
function estimateCartWeightKg() {
    const physical = cart.filter(i => (i.type || 'physical') === 'physical');
    let total = 0;

    for (const item of physical) {
        let unitWeight = Number(item.weight);
        if (!unitWeight || unitWeight <= 0) {
            const cat = String(item.category || '').toLowerCase();
            if (cat.includes('electronic')) unitWeight = 0.8;
            else if (cat.includes('fashion')) unitWeight = 0.5;
            else if (cat.includes('beauty')) unitWeight = 0.3;
            else if (cat.includes('home')) unitWeight = 2.5;
            else if (cat.includes('traditional')) unitWeight = 0.6;
            else unitWeight = 0.5;
        }
        total += unitWeight * Number(item.quantity || 1);
    }

    // DHL minimum shipment weight is 0.5 kg
    return Math.max(0.5, Math.round(total * 10) / 10);
}

// Map our LGA slug → a human-readable city name DHL understands
function lgaSlugToCityName(lgaSlug) {
    if (!lgaSlug) return '';
    const stateSlug = getSelectedState();
    const lgas = getLGAsForState(stateSlug) || [];
    const found = lgas.find(l => l.slug === lgaSlug);
    const raw = found ? found.name : lgaSlug.replace(/-/g, ' ');
    // Strip parentheses suffix e.g. "Eti-Osa (VI, Ikoyi, Lekki)" → "Eti-Osa"
    return raw.replace(/\s*\(.*\)\s*$/, '').trim();
}

// Map our state slug → human-readable name
function stateSlugToName(stateSlug) {
    if (!stateSlug) return '';
    const states = getAllStates() || [];
    const found = states.find(s => s.slug === stateSlug);
    if (!found) return stateSlug.replace(/-/g, ' ');
    // Abuja is stored as "Abuja (FCT)" — normalize to "Abuja"
    return found.name.replace(/\s*\(.*\)\s*$/, '').trim();
}

// Only fetch a DHL quote when the inputs that affect it have actually changed
function dhlQuoteCacheKey() {
    const state = getSelectedState();
    const lga = getSelectedLga();
    const weight = estimateCartWeightKg();
    return `${state}|${lga}|${weight}`;
}

// Ask the backend for a DHL quote. Silent no-op if DHL isn't enabled.
async function fetchDHLQuoteIfNeeded() {
    if (!cartHasPhysical()) return;

    const state = getSelectedState();
    const lga = getSelectedLga();
    if (!state || !lga) return;

    const key = dhlQuoteCacheKey();
    if (key === dhlQuoteCache.key && dhlQuoteCache.quotes.length > 0) return;

    dhlQuoteCache = { key, quotes: [], loading: true, error: null };
    renderShippingOptionsUI();

    try {
        const res = await fetch(DHL_QUOTE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destinationCountry: 'NG',
                destinationCity: lgaSlugToCityName(lga) || stateSlugToName(state),
                destinationPostal: '',
                weightKg: estimateCartWeightKg(),
            }),
        });

        const data = await res.json();

        if (data.source !== 'dhl' || !Array.isArray(data.quotes) || data.quotes.length === 0) {
            dhlQuoteCache = { key, quotes: [], loading: false, error: null };
            selectedShippingMethod = 'flat';
            renderShippingOptionsUI();
            return;
        }

        const sorted = data.quotes
            .filter(q => Number(q.totalPrice) > 0)
            .sort((a, b) => Number(a.totalPrice) - Number(b.totalPrice))
            .slice(0, 2);

        dhlQuoteCache = { key, quotes: sorted, loading: false, error: null };
        renderShippingOptionsUI();
    } catch (err) {
        console.warn('DHL quote fetch failed:', err);
        dhlQuoteCache = { key, quotes: [], loading: false, error: err.message };
        renderShippingOptionsUI();
    }
}

// The flat delivery fee for the currently selected state + LGA
function currentFlatDeliveryFee() {
    if (!cartHasPhysical()) return 0;
    return getCurrentDeliveryFee();
}

// The currently active delivery fee — either the flat one or the chosen DHL one
function currentEffectiveDeliveryFee() {
    if (!cartHasPhysical()) return 0;

    if (selectedShippingMethod && selectedShippingMethod.startsWith('dhl-')) {
        const productCode = selectedShippingMethod.replace(/^dhl-/, '');
        const q = dhlQuoteCache.quotes.find(x => x.productCode === productCode);
        if (q) return Number(q.totalPrice);
    }

    return currentFlatDeliveryFee();
}

// ============================================
// DHL SHIPPING OPTIONS — rendered inside checkout summary
// ============================================

function renderShippingOptionsUI() {
    const old = document.getElementById('shippingOptionsBlock');
    if (old) old.remove();

    if (!cartHasPhysical()) return;

    const summary = document.getElementById('orderSummary');
    if (!summary) return;

    const state = getSelectedState();
    const lga = getSelectedLga();

    const showDHL = dhlQuoteCache.quotes.length > 0;

    if (!state || !lga) return;
    if (!showDHL && !dhlQuoteCache.loading) return;

    const fmt = (n) => '₦' + Number(n || 0).toLocaleString();
    const flatFee = currentFlatDeliveryFee();

    let html = `<div class="shipping-options-block" id="shippingOptionsBlock">`;
    html += `<div class="shipping-options-title">Delivery Method</div>`;

    const flatChecked = selectedShippingMethod === 'flat' ? 'checked' : '';
    html += `
        <label class="shipping-option">
            <input type="radio" name="shippingMethod" value="flat" ${flatChecked}
                   onchange="selectShippingMethod('flat')" />
            <div class="shipping-option-body">
                <div class="shipping-option-name">Standard Delivery</div>
                <div class="shipping-option-meta">3–7 business days</div>
            </div>
            <div class="shipping-option-price">${fmt(flatFee)}</div>
        </label>
    `;

    if (dhlQuoteCache.loading) {
        html += `
            <div class="shipping-option shipping-option-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Checking DHL Express rates…</span>
            </div>
        `;
    } else {
        dhlQuoteCache.quotes.forEach(q => {
            const value = `dhl-${q.productCode}`;
            const checked = selectedShippingMethod === value ? 'checked' : '';
            const days = q.deliveryDays
                ? `${q.deliveryDays} business day${q.deliveryDays > 1 ? 's' : ''}`
                : 'Express';
            html += `
                <label class="shipping-option shipping-option-dhl">
                    <input type="radio" name="shippingMethod" value="${value}" ${checked}
                           onchange="selectShippingMethod('${value}')" />
                    <div class="shipping-option-body">
                        <div class="shipping-option-name">
                            DHL Express <span class="shipping-option-tag">Fast</span>
                        </div>
                        <div class="shipping-option-meta">${days}</div>
                    </div>
                    <div class="shipping-option-price">${fmt(q.totalPrice)}</div>
                </label>
            `;
        });
    }

    html += `</div>`;

    summary.insertAdjacentHTML('beforeend', html);
}

function selectShippingMethod(method) {
    selectedShippingMethod = method;
    renderCheckoutSummary();
}

function getHeaderHTML(activePage = '') {
    const isActive = (page) => activePage === page ? 'active' : '';
    return `
    <div class="top-bar">
        <div class="top-bar-content">
            <div class="top-bar-left">
                <a href="${SITE_CONFIG.phoneLink}" class="top-link"><i class="fas fa-phone"></i> ${SITE_CONFIG.phone}</a>
                <span class="divider">|</span>
                <a href="${SITE_CONFIG.emailLink}" class="top-link"><i class="fas fa-envelope"></i> ${SITE_CONFIG.email}</a>
            </div>
            <div class="top-bar-right">
                <span class="top-link top-promo"><i class="fas fa-truck"></i> Free delivery on orders over ₦100,000</span>
            </div>
        </div>
    </div>

    <header>
        <div class="header-content">
            <button class="hamburger-btn" onclick="openMobileDrawer()" aria-label="Open menu">
                <i class="fas fa-bars"></i>
            </button>

            <a href="index.html" class="logo">
                <img src="ishop-logo.png" alt="iShop" class="logo-img" />
                <span class="logo-text">i<span class="logo-accent">Shop</span></span>
            </a>

            <div class="search-bar">
                <div class="search-category-dropdown" onclick="toggleSearchDropdown()">
                    <span id="selectedCategory">All Categories</span>
                    <i class="fas fa-chevron-down" id="searchArrow"></i>
                </div>
                <div class="search-dropdown-menu" id="searchDropdown">
                    <a href="#" onclick="selectCategory('All Categories')">All Categories</a>
                    <a href="#" onclick="selectCategory('Electronics')">📱 Electronics</a>
                    <a href="#" onclick="selectCategory('Fashion')">👗 Fashion</a>
                    <a href="#" onclick="selectCategory('Beauty')">💄 Beauty</a>
                    <a href="#" onclick="selectCategory('Digital')">💻 Digital</a>
                    <a href="#" onclick="selectCategory('Home')">🏠 Home & Kitchen</a>
                    <a href="#" onclick="selectCategory('Traditional')">👘 Traditional Attire</a>
                </div>
                <input type="text" id="mainSearch" placeholder="Search for products, brands and more..." />
                <button onclick="performSearch()"><i class="fas fa-search"></i></button>
            </div>

            <div class="nav-icons">
                <a href="about.html" class="nav-link ${isActive('about')}"><i class="fas fa-info-circle"></i> About</a>
                <a href="contact.html" class="nav-link ${isActive('contact')}"><i class="fas fa-envelope"></i> Contact</a>
<a href="become-a-vendor.html" class="nav-link vendor-nav-highlight ${isActive('become-a-vendor')}"><i class="fas fa-store"></i> Sell on iShop</a>
                <div class="help-dropdown-wrap">
                    <a href="help.html" class="nav-link">
                        <i class="fas fa-question-circle"></i> Help
                        <i class="fas fa-chevron-down" style="font-size:0.7em;margin-left:2px;"></i>
                    </a>
                    <div class="help-dropdown-panel">
                        <a href="help.html#place-order"><i class="fas fa-shopping-bag"></i> Place an order</a>
                        <a href="help.html#payment"><i class="fas fa-credit-card"></i> Payment options</a>
                        <a href="track-order.html"><i class="fas fa-truck"></i> Track an order</a>
                        <a href="help.html#cancel"><i class="fas fa-times-circle"></i> Cancel an order</a>
                        <a href="help.html#returns"><i class="fas fa-undo-alt"></i> Returns & Refunds</a>
                        <div class="help-dropdown-divider"></div>
                        <a href="${SITE_CONFIG.whatsapp}?text=Hello%20iShop%2C%20I%20need%20help" target="_blank" class="help-item-action">
                            <i class="fas fa-comment"></i> Live Chat
                        </a>
                    </div>
                </div>

                <div class="nav-icon-item">
                    <a href="cart.html" class="cart-icon">
                        <i class="fas fa-shopping-cart"></i>
                        <span class="badge" id="cartCount">0</span>
                    </a>
                    <span class="icon-label">Cart</span>
                </div>

                <div class="account-dropdown-wrap" id="accountDropdownWrap">
                    <a href="javascript:void(0)" class="nav-link account-toggle" onclick="toggleAccountDropdown(event)">
                        <i class="fas fa-user-circle"></i>
                        <span>Account</span>
                        <i class="fas fa-chevron-down"></i>
                    </a>
                    <div class="account-dropdown-panel" id="accountDropdownPanel">
                        <div class="account-dropdown-guest" id="accountGuestPanel">
                            <a href="login.html" class="account-primary-btn">
                                <i class="fas fa-sign-in-alt"></i> Sign In
                            </a>
                            <a href="signup.html"><i class="fas fa-user-plus"></i> New Customer? Sign Up</a>
                            <div class="account-dropdown-divider"></div>
                            <a href="wishlist.html"><i class="fas fa-heart"></i> Wishlist</a>
                            <a href="track-order.html"><i class="fas fa-truck"></i> Track Order</a>
                        </div>
                        <div class="account-dropdown-user" id="accountUserPanel" style="display:none;">
                            <div class="account-dropdown-hello" id="accountHelloName">Hello, Friend</div>
                            <a href="profile.html"><i class="fas fa-user"></i> My Account</a>
                            <a href="profile.html#orders" onclick="handleMyOrdersClick(event);"><i class="fas fa-box"></i> My Orders</a>
                            <a href="wishlist.html"><i class="fas fa-heart"></i> Wishlist</a>
                            <a href="admin.html" id="adminPanelLink" style="display:none;color:#d4a017;font-weight:700;">
                                <i class="fas fa-shield-halved"></i> Admin Panel
                            </a>
                            <div class="vendor-account-links" id="vendorAccountLinks" style="display:none;">
                                <div class="account-dropdown-divider"></div>
                                <div class="account-vendor-label">
                                    <i class="fas fa-store"></i> Vendor Tools
                                </div>
                                <a href="vendor-dashboard.html"><i class="fas fa-tachometer-alt"></i> Vendor Dashboard</a>
                                <a href="vendor-orders.html"><i class="fas fa-truck"></i> My Orders</a>
                                <a href="vendor-products.html"><i class="fas fa-boxes"></i> My Products</a>
                                <a href="vendor-earnings.html"><i class="fas fa-wallet"></i> My Earnings</a>
<a href="vendor-product-form.html"><i class="fas fa-plus-circle"></i> Add Product</a>
                            </div>
                            <div class="account-dropdown-divider"></div>
                            <a href="javascript:void(0)" onclick="logoutUser()" class="account-logout">
                                <i class="fas fa-sign-out-alt"></i> Logout
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="mobile-search-row">
            <div class="search-bar">
                <div class="search-category-dropdown" onclick="toggleSearchDropdown()">
                    <span id="selectedCategoryMobile">All Categories</span>
                    <i class="fas fa-chevron-down"></i>
                </div>
                <input type="text" id="mobileSearch" placeholder="Search products, brands and categories..." />
                <button onclick="performMobileSearch()"><i class="fas fa-search"></i></button>
            </div>
        </div>

        <div class="mobile-cat-strip">
            <a href="shop.html" class="cat-chip">All</a>
            <a href="electronics.html" class="cat-chip">📱 Phones</a>
            <a href="electronics.html?subtype=laptops" class="cat-chip">💻 Laptops</a>
            <a href="fashion.html" class="cat-chip">👗 Fashion</a>
            <a href="fashion.html?subtype=shoes" class="cat-chip">👟 Shoes</a>
            <a href="beauty.html" class="cat-chip">💄 Beauty</a>
            <a href="digital-products.html" class="cat-chip">💾 Digital</a>
            <a href="home.html" class="cat-chip">🏠 Home</a>
            <a href="traditional.html" class="cat-chip">👘 Traditional</a>
            <a href="shop.html" class="cat-chip cat-chip-hot">🔥 Hot</a>
            <a href="shop.html" class="cat-chip cat-chip-flash">⚡ Flash</a>
        </div>
    </header>

    <nav class="mega-menu">
        <div class="mega-menu-content">
            <ul class="menu-links">
                <li><a href="index.html" class="${isActive('home')}"><i class="fas fa-home"></i> Home</a></li>
                <li><a href="shop.html" class="${isActive('shop')}"><i class="fas fa-store"></i> All Products</a></li>
                <li class="dropdown-hover">
                    <a href="electronics.html" class="${isActive('electronics')}"><i class="fas fa-mobile-alt"></i> Electronics <i class="fas fa-chevron-down"></i></a>
                    <div class="mega-dropdown">
                        <div class="mega-dropdown-content">
                            <div class="mega-column">
                                <h4>📱 Phones & Tablets</h4>
                                <a href="electronics.html?subtype=smartphones">Smartphones</a>
                                <a href="electronics.html?subtype=tablets">Tablets</a>
                                <a href="electronics.html?subtype=accessories">Accessories</a>
                            </div>
                            <div class="mega-column">
                                <h4>💻 Computing</h4>
                                <a href="electronics.html?subtype=laptops">Laptops</a>
                                <a href="electronics.html?subtype=laptops">MacBooks</a>
                                <a href="electronics.html?subtype=accessories">Keyboards & Mice</a>
                            </div>
                            <div class="mega-column">
                                <h4>🎧 Audio</h4>
                                <a href="electronics.html?subtype=audio">Headphones</a>
                                <a href="electronics.html?subtype=audio">Earbuds</a>
                                <a href="electronics.html?subtype=audio">Speakers</a>
                            </div>
                            <div class="mega-column">
                                <h4>📺 TV</h4>
                                <a href="electronics.html?subtype=tv">Smart TVs</a>
                                <a href="electronics.html?subtype=tv">Projectors</a>
                            </div>
                            <div class="mega-column">
                                <h4>⌚ Wearables</h4>
                                <a href="electronics.html?subtype=wearables">Smartwatches</a>
                                <a href="electronics.html?subtype=wearables">Fitness Trackers</a>
                            </div>
                        </div>
                    </div>
                </li>
                <li class="dropdown-hover">
                    <a href="fashion.html" class="${isActive('fashion')}"><i class="fas fa-tshirt"></i> Fashion <i class="fas fa-chevron-down"></i></a>
                    <div class="mega-dropdown">
                        <div class="mega-dropdown-content">
                            <div class="mega-column">
                                <h4>👩 Women's</h4>
                                <a href="fashion.html?subtype=clothing">Dresses</a>
                                <a href="fashion.html?subtype=clothing">Tops</a>
                                <a href="fashion.html?subtype=traditional">Ankara</a>
                            </div>
                            <div class="mega-column">
                                <h4>👨 Men's</h4>
                                <a href="fashion.html?subtype=clothing">Shirts</a>
                                <a href="fashion.html?subtype=traditional">Agbada</a>
                                <a href="fashion.html?subtype=traditional">Kaftans</a>
                            </div>
                            <div class="mega-column">
                                <h4>👟 Shoes</h4>
                                <a href="fashion.html?subtype=shoes">Sneakers</a>
                                <a href="fashion.html?subtype=shoes">Heels</a>
                                <a href="fashion.html?subtype=shoes">Sandals</a>
                            </div>
                            <div class="mega-column">
                                <h4>👜 Bags</h4>
                                <a href="fashion.html?subtype=bags">Handbags</a>
                                <a href="fashion.html?subtype=bags">Wallets</a>
                                <a href="fashion.html?subtype=jewelry">Jewelry</a>
                            </div>
                        </div>
                    </div>
                </li>
                <li class="dropdown-hover">
                    <a href="beauty.html" class="${isActive('beauty')}"><i class="fas fa-spa"></i> Beauty <i class="fas fa-chevron-down"></i></a>
                    <div class="mega-dropdown">
                        <div class="mega-dropdown-content">
                            <div class="mega-column">
                                <h4>🧴 Skincare</h4>
                                <a href="beauty.html?subtype=skincare">Face Wash</a>
                                <a href="beauty.html?subtype=skincare">Moisturizers</a>
                                <a href="beauty.html?subtype=skincare">Serums</a>
                            </div>
                            <div class="mega-column">
                                <h4>💄 Makeup</h4>
                                <a href="beauty.html?subtype=makeup">Foundation</a>
                                <a href="beauty.html?subtype=makeup">Lipstick</a>
                                <a href="beauty.html?subtype=makeup">Eyeshadow</a>
                            </div>
                            <div class="mega-column">
                                <h4>🌸 Fragrances</h4>
                                <a href="beauty.html?subtype=fragrances">Perfumes</a>
                                <a href="beauty.html?subtype=fragrances">Body Sprays</a>
                            </div>
                            <div class="mega-column">
                                <h4>💇 Hair Care</h4>
                                <a href="beauty.html?subtype=haircare">Shampoo</a>
                                <a href="beauty.html?subtype=haircare">Conditioner</a>
                                <a href="beauty.html?subtype=haircare">Wigs & Weaves</a>
                            </div>
                        </div>
                    </div>
                </li>
                <li class="dropdown-hover">
                    <a href="digital-products.html" class="${isActive('digital')}"><i class="fas fa-download"></i> Digital <i class="fas fa-chevron-down"></i></a>
                    <div class="mega-dropdown">
                        <div class="mega-dropdown-content">
                            <div class="mega-column">
                                <h4>💻 Software</h4>
                                <a href="digital-products.html?type=software">Antivirus</a>
                                <a href="digital-products.html?type=software">Office Suites</a>
                            </div>
                            <div class="mega-column">
                                <h4>📚 E-books</h4>
                                <a href="digital-products.html?type=ebook">Business Books</a>
                                <a href="digital-products.html?type=ebook">Fiction</a>
                            </div>
                            <div class="mega-column">
                                <h4>🎓 Courses</h4>
                                <a href="digital-products.html?type=course">Web Development</a>
                                <a href="digital-products.html?type=course">Digital Marketing</a>
                            </div>
                            <div class="mega-column">
                                <h4>📄 Templates</h4>
                                <a href="digital-products.html?type=template">Resume Templates</a>
                                <a href="digital-products.html?type=template">Social Media Kits</a>
                            </div>
                        </div>
                    </div>
                </li>
                <li class="dropdown-hover">
                    <a href="home.html" class="${isActive('home')}"><i class="fas fa-couch"></i> Home & Kitchen <i class="fas fa-chevron-down"></i></a>
                    <div class="mega-dropdown">
                        <div class="mega-dropdown-content">
                            <div class="mega-column">
                                <h4>🛋️ Furniture</h4>
                                <a href="home.html?subtype=sofas">Sofas</a>
                                <a href="home.html?subtype=beds">Beds</a>
                                <a href="home.html?subtype=tables">Tables & Desks</a>
                            </div>
                            <div class="mega-column">
                                <h4>🍳 Kitchen</h4>
                                <a href="home.html?subtype=cookware">Cookware</a>
                                <a href="home.html?subtype=appliances">Appliances</a>
                                <a href="home.html?subtype=utensils">Utensils</a>
                            </div>
                            <div class="mega-column">
                                <h4>🛏️ Bedding</h4>
                                <a href="home.html?subtype=bedding">Bedsheets</a>
                                <a href="home.html?subtype=bedding">Duvets</a>
                                <a href="home.html?subtype=bedding">Pillows</a>
                            </div>
                            <div class="mega-column">
                                <h4>🎨 Décor</h4>
                                <a href="home.html?subtype=decor">Wall Art</a>
                                <a href="home.html?subtype=decor">Vases</a>
                                <a href="home.html?subtype=decor">Rugs</a>
                            </div>
                            <div class="mega-column">
                                <h4>🧹 Cleaning</h4>
                                <a href="home.html?subtype=cleaning">Vacuum</a>
                                <a href="home.html?subtype=cleaning">Mops</a>
                                <a href="home.html?subtype=cleaning">Storage</a>
                            </div>
                        </div>
                    </div>
                </li>
                <li class="dropdown-hover">
                    <a href="traditional.html" class="${isActive('traditional')}"><i class="fas fa-crown"></i> Traditional Attire <i class="fas fa-chevron-down"></i></a>
                    <div class="mega-dropdown">
                        <div class="mega-dropdown-content">
                            <div class="mega-column">
                                <h4>👘 Women's</h4>
                                <a href="traditional.html?subtype=women">Ankara Dresses</a>
                                <a href="traditional.html?subtype=women">Iro & Buba</a>
                                <a href="traditional.html?subtype=women">Kaftans</a>
                            </div>
                            <div class="mega-column">
                                <h4>👔 Men's</h4>
                                <a href="traditional.html?subtype=men">Agbada</a>
                                <a href="traditional.html?subtype=men">Buba & Sokoto</a>
                                <a href="traditional.html?subtype=men">Kaftans</a>
                            </div>
                            <div class="mega-column">
                                <h4>👑 Accessories</h4>
                                <a href="traditional.html?subtype=accessories">Gele</a>
                                <a href="traditional.html?subtype=accessories">Fila</a>
                                <a href="traditional.html?subtype=accessories">Beads & Jewelry</a>
                            </div>
                            <div class="mega-column">
                                <h4>👟 Footwear</h4>
                                <a href="traditional.html?subtype=footwear">Shoes</a>
                                <a href="traditional.html?subtype=footwear">Sandals</a>
                            </div>
                            <div class="mega-column">
                                <h4>🧵 Fabrics</h4>
                                <a href="traditional.html?subtype=fabrics">Ankara</a>
                                <a href="traditional.html?subtype=fabrics">Lace</a>
                                <a href="traditional.html?subtype=fabrics">Aso-Oke</a>
                            </div>
                        </div>
                    </div>
                </li>
            </ul>

        </div>
    </nav>

    <div class="mobile-drawer-overlay" id="mobileDrawerOverlay" onclick="closeMobileDrawer()"></div>

    <aside class="mobile-drawer" id="mobileDrawer">
        <div class="mobile-drawer-header">
            <img src="ishop-logo.png" alt="iShop" class="drawer-logo" />
            <button class="drawer-close" onclick="closeMobileDrawer()" aria-label="Close menu">
                <i class="fas fa-times"></i>
            </button>
        </div>

        <nav class="mobile-drawer-nav">
            <ul>
                <li><a href="index.html"><i class="fas fa-home"></i> Home</a></li>
                <li><a href="shop.html"><i class="fas fa-store"></i> All Products</a></li>
                <li class="drawer-dropdown">
                    <a href="javascript:void(0)" onclick="toggleDrawerDropdown(this)">
                        <i class="fas fa-mobile-alt"></i> Electronics
                        <i class="fas fa-chevron-down drawer-chevron"></i>
                    </a>
                    <ul class="drawer-submenu">
                        <li><a href="electronics.html?subtype=smartphones">Smartphones</a></li>
                        <li><a href="electronics.html?subtype=tablets">Tablets</a></li>
                        <li><a href="electronics.html?subtype=laptops">Laptops</a></li>
                        <li><a href="electronics.html?subtype=audio">Audio</a></li>
                        <li><a href="electronics.html?subtype=tv">Smart TVs</a></li>
                        <li><a href="electronics.html?subtype=wearables">Smartwatches</a></li>
                    </ul>
                </li>
                <li class="drawer-dropdown">
                    <a href="javascript:void(0)" onclick="toggleDrawerDropdown(this)">
                        <i class="fas fa-tshirt"></i> Fashion
                        <i class="fas fa-chevron-down drawer-chevron"></i>
                    </a>
                    <ul class="drawer-submenu">
                        <li><a href="fashion.html?subtype=clothing">Clothing</a></li>
                        <li><a href="fashion.html?subtype=traditional">Traditional</a></li>
                        <li><a href="fashion.html?subtype=shoes">Shoes</a></li>
                        <li><a href="fashion.html?subtype=bags">Bags</a></li>
                        <li><a href="fashion.html?subtype=jewelry">Jewelry</a></li>
                    </ul>
                </li>
                <li class="drawer-dropdown">
                    <a href="javascript:void(0)" onclick="toggleDrawerDropdown(this)">
                        <i class="fas fa-spa"></i> Beauty
                        <i class="fas fa-chevron-down drawer-chevron"></i>
                    </a>
                    <ul class="drawer-submenu">
                        <li><a href="beauty.html?subtype=skincare">Skincare</a></li>
                        <li><a href="beauty.html?subtype=makeup">Makeup</a></li>
                        <li><a href="beauty.html?subtype=fragrances">Fragrances</a></li>
                        <li><a href="beauty.html?subtype=haircare">Hair Care</a></li>
                    </ul>
                </li>
                <li class="drawer-dropdown">
                    <a href="javascript:void(0)" onclick="toggleDrawerDropdown(this)">
                        <i class="fas fa-download"></i> Digital
                        <i class="fas fa-chevron-down drawer-chevron"></i>
                    </a>
                    <ul class="drawer-submenu">
                        <li><a href="digital-products.html?type=software">Software</a></li>
                        <li><a href="digital-products.html?type=ebook">E-books</a></li>
                        <li><a href="digital-products.html?type=course">Courses</a></li>
                        <li><a href="digital-products.html?type=template">Templates</a></li>
                    </ul>
                </li>
                <li class="drawer-dropdown">
                    <a href="javascript:void(0)" onclick="toggleDrawerDropdown(this)">
                        <i class="fas fa-couch"></i> Home & Kitchen
                        <i class="fas fa-chevron-down drawer-chevron"></i>
                    </a>
                    <ul class="drawer-submenu">
                        <li><a href="home.html?subtype=sofas">Sofas</a></li>
                        <li><a href="home.html?subtype=cookware">Cookware</a></li>
                        <li><a href="home.html?subtype=bedding">Bedding</a></li>
                        <li><a href="home.html?subtype=decor">Décor</a></li>
                        <li><a href="home.html?subtype=cleaning">Cleaning</a></li>
                    </ul>
                </li>
                <li class="drawer-dropdown">
                    <a href="javascript:void(0)" onclick="toggleDrawerDropdown(this)">
                        <i class="fas fa-crown"></i> Traditional Attire
                        <i class="fas fa-chevron-down drawer-chevron"></i>
                    </a>
                    <ul class="drawer-submenu">
                        <li><a href="traditional.html?subtype=women">Women's</a></li>
                        <li><a href="traditional.html?subtype=men">Men's</a></li>
                        <li><a href="traditional.html?subtype=accessories">Accessories</a></li>
                        <li><a href="traditional.html?subtype=footwear">Footwear</a></li>
                        <li><a href="traditional.html?subtype=fabrics">Fabrics</a></li>
                    </ul>
                </li>
                <li><a href="shop.html" class="drawer-hot"><i class="fas fa-fire"></i> Hot Deals</a></li>
                <li><a href="shop.html" class="drawer-flash"><i class="fas fa-bolt"></i> Flash Sale</a></li>
                                <li><a href="become-a-vendor.html" class="drawer-sell-link"><i class="fas fa-store"></i> Sell on iShop</a></li>
                <li class="drawer-vendor-only" id="drawerVendorLinks" style="display:none;">
                    <a href="vendor-dashboard.html" style="color:#d4a017;font-weight:700;">
                        <i class="fas fa-tachometer-alt"></i> Vendor Dashboard
                    </a>
                </li>
                <li class="drawer-vendor-only" id="drawerVendorEarnings" style="display:none;">
    <a href="vendor-earnings.html" style="color:#d4a017;font-weight:700;">
        <i class="fas fa-wallet"></i> My Earnings
    </a>
</li>
<li class="drawer-vendor-only" id="drawerVendorOrders" style="display:none;">
                    <a href="vendor-orders.html" style="color:#d4a017;font-weight:700;">
                        <i class="fas fa-truck"></i> My Orders
                    </a>
                </li>
<li class="drawer-vendor-only" id="drawerVendorProducts" style="display:none;">
                    <a href="vendor-products.html" style="color:#d4a017;font-weight:700;">
                        <i class="fas fa-boxes"></i> My Products
                    </a>
                </li>
<li><a href="about.html"><i class="fas fa-info-circle"></i> About Us</a></li>
                <li><a href="contact.html"><i class="fas fa-envelope"></i> Contact Us</a></li>
                <li><a href="help.html"><i class="fas fa-question-circle"></i> Help Center</a></li>
                <li><a href="wishlist.html"><i class="fas fa-heart"></i> My Wishlist</a></li>
            </ul>
        </nav>

        <div class="mobile-drawer-footer">
            <a href="${SITE_CONFIG.whatsapp}?text=Hello%20iShop%2C%20I%20need%20help" target="_blank" class="drawer-whatsapp-btn">
                <i class="fab fa-whatsapp"></i> Chat on WhatsApp
            </a>
        </div>
    </aside>

    <nav class="mobile-bottom-nav">
        <a href="index.html" class="bottom-nav-item">
            <i class="fas fa-home"></i>
            <span>Home</span>
        </a>
        <a href="javascript:void(0)" onclick="openMobileDrawer()" class="bottom-nav-item">
            <i class="fas fa-th-large"></i>
            <span>Categories</span>
        </a>
        <a href="cart.html" class="bottom-nav-item">
            <i class="fas fa-shopping-cart"></i>
            <span>Cart</span>
            <span class="bottom-nav-badge" id="mobileCartCount">0</span>
        </a>
        <a href="profile.html" class="bottom-nav-item">
            <i class="fas fa-user"></i>
            <span>Account</span>
        </a>
    </nav>
    `;
}

function getFooterHTML() {
    return `
    <footer>
        <div class="footer-content">
            <div class="footer-column">
                <h4>🛍️ iShop</h4>
                <p>Your trusted online store in Nigeria.</p>
                <div class="social-links">
                    <a href="#"><i class="fab fa-facebook-f"></i></a>
                    <a href="#"><i class="fab fa-twitter"></i></a>
                    <a href="#"><i class="fab fa-instagram"></i></a>
                </div>
            </div>
            <div class="footer-column">
                <h4>Quick Links</h4>
                <a href="index.html">Home</a>
                <a href="shop.html">Shop</a>
                <a href="digital-products.html">Digital</a>
                <a href="become-a-vendor.html" style="color:#f9c74f;font-weight:600;">Sell on iShop</a>
                <a href="about.html">About Us</a>
                <a href="contact.html">Contact Us</a>
            </div>
            <div class="footer-column">
                <h4>Legal</h4>
                <a href="privacy.html">Privacy Policy</a>
                <a href="terms.html">Terms of Service</a>
                <a href="refund.html">Refund Policy</a>
            </div>
            <div class="footer-column">
                <h4>Contact Info</h4>
                <p><i class="fas fa-map-marker-alt"></i> ${SITE_CONFIG.address}</p>
                <p><i class="fas fa-phone"></i> ${SITE_CONFIG.phone}</p>
                <p><i class="fas fa-envelope"></i> ${SITE_CONFIG.email}</p>
            </div>
        </div>
        <div class="footer-bottom">
            <p>© 2026 iShop. All rights reserved.</p>
        </div>
    </footer>

    <a href="${SITE_CONFIG.whatsapp}?text=Hello%20iShop%2C%20I%20need%20help%20with%20an%20order"
       target="_blank" class="whatsapp-float" aria-label="Chat on WhatsApp">
        <i class="fab fa-whatsapp"></i>
    </a>
    `;
}

function injectHeaderAndFooter() {
    const page = window.location.pathname.split('/').pop().replace('.html', '') || 'home';
    const headerEl = document.getElementById('site-header');
    const footerEl = document.getElementById('site-footer');

    if (headerEl) headerEl.innerHTML = getHeaderHTML(page);
    if (footerEl) footerEl.innerHTML = getFooterHTML();
}

function openMobileDrawer() {
    const drawer = document.getElementById('mobileDrawer');
    const overlay = document.getElementById('mobileDrawerOverlay');
    if (drawer) drawer.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeMobileDrawer() {
    const drawer = document.getElementById('mobileDrawer');
    const overlay = document.getElementById('mobileDrawerOverlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
}

function toggleDrawerDropdown(linkEl) {
    const parentLi = linkEl.parentElement;
    const isOpen = parentLi.classList.contains('open');
    document.querySelectorAll('.mobile-drawer-nav .drawer-dropdown.open').forEach(el => {
        if (el !== parentLi) el.classList.remove('open');
    });
    parentLi.classList.toggle('open', !isOpen);
}

// ============================================
// iShop API CONFIGURATION
// ============================================
const API_URL = 'https://ishop-cms-production.up.railway.app/api/products?populate[0]=Image&populate[1]=Specifications&pagination[pageSize]=100';
const IMAGE_BASE_URL = 'https://ishop-cms-production.up.railway.app';
const PAYMENT_API = 'https://ishop-payments-production.up.railway.app/api/orders/initialize';
const FREE_DOWNLOAD_API = 'https://ishop-payments-production.up.railway.app/api/free-download';
const PAID_DOWNLOAD_API = 'https://ishop-payments-production.up.railway.app/api/download';
const STRAPI_AUTH_BASE = 'https://ishop-cms-production.up.railway.app';
const ORDERS_API_BASE = 'https://ishop-payments-production.up.railway.app';

// ============================================
// GOOGLE OAUTH CONFIGURATION
// ============================================
const GOOGLE_CLIENT_ID = '1095016186699-sp0adum1qn7urnq8ka87mvjglmhoqu6o.apps.googleusercontent.com';

// ============================================
// FETCH PRODUCTS FROM STRAPI
// ============================================
async function fetchProducts({ force = false, silent = false } = {}) {
    if (!force) {
        const cached = readProductCache();
        if (cached) {
            console.log('⚡ Products loaded from cache:', cached.length);
            fetchProducts({ force: true, silent: true }).catch(() => {});
            return cached;
        }
    }

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const products = data.data || [];
        console.log('✅ Products fetched from Strapi:', products.length);
        writeProductCache(products);
        return products;
    } catch (error) {
        console.error('❌ Error fetching products:', error);
        try {
            const raw = localStorage.getItem(PRODUCT_CACHE_KEY);
            const stale = raw ? JSON.parse(raw).data : null;
            if (stale) {
                console.log('♻️ Using stale cache after network failure');
                return stale;
            }
        } catch {}
        return [];
    }
}

// ============================================
// DESCRIPTION PARSER
// ============================================
function extractDescriptionText(blocks) {
    if (!blocks) return { text: '', bullets: [] };
    if (typeof blocks === 'string') return { text: blocks.trim(), bullets: [] };

    const paragraphs = [];
    const bullets = [];

    function walk(node) {
        if (!node) return;

        if (typeof node === 'string') {
            if (node.trim()) paragraphs.push(node.trim());
            return;
        }

        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }

        if (node.type === 'list-item') {
            const itemText = [];
            function collectText(n) {
                if (!n) return;
                if (typeof n === 'string') { itemText.push(n); return; }
                if (Array.isArray(n)) { n.forEach(collectText); return; }
                if (typeof n.text === 'string' && n.text.trim()) itemText.push(n.text.trim());
                if (n.children) collectText(n.children);
            }
            collectText(node.children || node);
            const joined = itemText.join(' ').trim();
            if (joined) bullets.push(joined);
            return;
        }

        if (typeof node.text === 'string' && node.text.trim()) {
            paragraphs.push(node.text.trim());
        }

        if (node.children) walk(node.children);
    }

    walk(blocks);

    const text = paragraphs.join(' ').trim();
    return { text: text || bullets.join(' ').trim(), bullets };
}

// ============================================
// CLOUDINARY IMAGE OPTIMIZER
// ============================================
function optimizeCloudinaryUrl(url) {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('res.cloudinary.com')) return url;
    if (url.includes('/w_600,') || url.includes('f_auto') || url.includes('q_auto')) return url;

    return url.replace(
        /\/upload\//,
        '/upload/w_600,f_auto,q_auto/'
    );
}

// ============================================
// CONVERT STRAPI PRODUCT TO WEBSITE FORMAT
// ============================================
function convertStrapiProduct(strapiProduct) {
    let imageUrls = ['data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#f8fafc"/><rect x="75" y="70" width="50" height="40" rx="4" fill="#e0e0e0"/><circle cx="88" cy="84" r="5" fill="#f9c74f"/></svg>'];
    if (strapiProduct.Image && strapiProduct.Image.length > 0) {
        imageUrls = strapiProduct.Image
            .filter(img => img && img.url)
            .map(img => {
                const rawUrl = img.url.startsWith('http://') || img.url.startsWith('https://')
                    ? img.url
                    : `${IMAGE_BASE_URL}${img.url}`;
                return optimizeCloudinaryUrl(rawUrl);
            });
        if (imageUrls.length === 0) {
            imageUrls = ['data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#f8fafc"/><rect x="75" y="70" width="50" height="40" rx="4" fill="#e0e0e0"/><circle cx="88" cy="84" r="5" fill="#f9c74f"/></svg>'];
        }
    }
    const imageUrl = imageUrls[0];

    const descResult = extractDescriptionText(strapiProduct.Description);
    let description = descResult.text || 'No description available';
    let features = descResult.bullets.length > 0
        ? descResult.bullets.slice(0, 6)
        : [];

    let specifications = [];
    if (Array.isArray(strapiProduct.Specifications)) {
        specifications = strapiProduct.Specifications
            .filter(s => s && s.spec_name && s.spec_value)
            .map(s => ({ name: s.spec_name, value: s.spec_value }));
    }

    return {
        id: strapiProduct.id,
        documentId: strapiProduct.documentId || String(strapiProduct.id),
        name: strapiProduct.Product_Name || 'Unnamed Product',
        category: (function(raw){if(!raw)return 'uncategorized';var c=String(raw).toLowerCase().trim();if(c.indexOf('electronic')===0)return 'electronics';if(c.indexOf('fashion')===0)return 'fashion';if(c.indexOf('beauty')===0)return 'beauty';if(c.indexOf('digital')===0)return 'digital';if(c.indexOf('home')===0)return 'home';if(c.indexOf('traditional')===0)return 'traditional';return c;})(strapiProduct.Category),
        subType: (strapiProduct.Sub_Type || '').toLowerCase(),
        type: (strapiProduct.Type || 'physical').toLowerCase(),
        price: parseFloat(strapiProduct.Price || 0),
        rating: parseFloat(strapiProduct.Rating || 4.2),
        images: imageUrls,
        image: imageUrl,
        description: description,
        features: features,
        specifications: specifications
    };
}

// ============================================
// SHOPPING CART
// ============================================
let cart = JSON.parse(localStorage.getItem('iShopCart')) || [];

function saveCart() {
    localStorage.setItem('iShopCart', JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const countElement = document.getElementById('cartCount');
    if (countElement) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        countElement.textContent = totalItems;
    }
}

function addToCart(productId) {
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
        saveCart();
        alert(`🛒 Added another "${existingItem.name}" to cart!`);
    } else {
        fetchProductById(productId).then(product => {
            if (product) {
                cart.push({ ...product, quantity: 1 });
                saveCart();
                alert(`🛒 Added "${product.name}" to cart!`);
            }
        });
    }
}

async function fetchProductById(productId) {
    try {
        const listResponse = await fetch(API_URL);
        if (!listResponse.ok) {
            throw new Error(`HTTP error! status: ${listResponse.status}`);
        }
        const listData = await listResponse.json();
        const found = listData.data.find(p => String(p.id) === String(productId));

        if (!found) {
            console.warn(`⚠️ Product id ${productId} not found`);
            return null;
        }

        const response = await fetch(`https://ishop-cms-production.up.railway.app/api/products/${found.documentId}?populate[0]=Image&populate[1]=Specifications`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return convertStrapiProduct(data.data);
    } catch (error) {
        console.error('❌ Error fetching product:', error);
        return null;
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
}

function updateQuantity(productId, change) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;
    item.quantity += change;
    if (item.quantity <= 0) {
        removeFromCart(productId);
        return;
    }
    saveCart();
    renderCart();
}

function clearCart() {
    if (confirm('Clear your entire cart?')) {
        cart = [];
        saveCart();
        renderCart();
    }
}

function getCartTotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

// ============================================
// RENDER PRODUCTS
// ============================================
function renderProducts(containerId, productList, limit = null) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`Container #${containerId} not found`);
        return;
    }

    const items = limit ? productList.slice(0, limit) : productList;

    if (items.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:3rem 1rem;color:#888;grid-column:1/-1;">
                <i class="fas fa-box-open" style="font-size:2.5rem;display:block;margin-bottom:0.5rem;"></i>
                <p>No products found.</p>
            </div>
        `;
        return;
    }

    const wishlistData = JSON.parse(localStorage.getItem('iShopWishlist')) || [];

    container.innerHTML = items.map(product => {
        const isInWishlist = wishlistData.includes(product.id);
        const isFreeDigital = product.type === 'digital' && product.price === 0;
        return `
        <div class="product-card ${product.type === 'digital' ? 'digital-product' : ''}" onclick="goToProduct(${product.id})">
            <button class="wishlist-heart ${isInWishlist ? 'active' : ''}"
                    onclick="event.stopPropagation(); event.preventDefault(); toggleWishlistHeart(${product.id}, this)">
                <i class="fa${isInWishlist ? 's' : 'r'} fa-heart"></i>
            </button>
            ${product.type === 'digital' ? '<span class="digital-badge">💻 Instant Download</span>' : ''}
            <div class="image-container">
                <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect width=%22200%22 height=%22200%22 fill=%22%23f8fafc%22/><rect x=%2275%22 y=%2270%22 width=%2250%22 height=%2240%22 rx=%224%22 fill=%22%23e0e0e0%22/><circle cx=%2288%22 cy=%2284%22 r=%225%22 fill=%22%23f9c74f%22/></svg>'" />
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p class="product-category">${product.category}</p>
                <p class="product-price">${isFreeDigital ? '<span style="color:#4CAF50;font-weight:700;">FREE</span>' : '₦' + product.price.toLocaleString()}</p>
                <div class="product-rating">⭐ ${Number(product.rating).toFixed(1)}</div>
                ${isFreeDigital
                    ? `<button onclick="event.stopPropagation(); downloadFreeProduct('${product.documentId}')" class="btn-add-cart" style="background:#4CAF50;">
                        📥 Download Free
                       </button>`
                    : `<button onclick="event.stopPropagation(); addToCart(${product.id})" class="btn-add-cart">
                        ${product.type === 'digital' ? '📥 Buy & Download' : '🛒 Add to Cart'}
                       </button>`
                }
                <a href="product-detail.html?id=${product.id}" class="btn-view" onclick="event.stopPropagation();">View Details</a>
            </div>
        </div>
        `;
    }).join('');
}

function goToProduct(productId) {
    window.location.href = `product-detail.html?id=${productId}`;
}

function toggleWishlistHeart(productId, btn) {
    let wishlistData = JSON.parse(localStorage.getItem('iShopWishlist')) || [];

    if (wishlistData.includes(productId)) {
        wishlistData = wishlistData.filter(id => id !== productId);
        btn.classList.remove('active');
        btn.querySelector('i').className = 'far fa-heart';
    } else {
        wishlistData.push(productId);
        btn.classList.add('active');
        btn.querySelector('i').className = 'fas fa-heart';
    }

    localStorage.setItem('iShopWishlist', JSON.stringify(wishlistData));
}

// ============================================
// FREE DOWNLOAD HANDLER
// ============================================
async function downloadFreeProduct(documentId) {
    try {
        console.log('📥 Requesting free download for:', documentId);

        const response = await fetch(`${FREE_DOWNLOAD_API}/${documentId}`);
        const data = await response.json();

        if (!response.ok || !data.status || !data.url) {
            throw new Error(data.error || 'Download failed');
        }

        console.log('✅ Signed URL received, starting download');

        const a = document.createElement('a');
        a.href = data.url;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (error) {
        console.error('❌ Free download error:', error);
        alert(`Could not download: ${error.message}`);
    }
}

// ============================================
// RENDER CART
// ============================================
function renderCart() {
    const container = document.getElementById('cartItems');
    const summary = document.getElementById('cartSummary');
    const totalItems = document.getElementById('cartTotalItems');

    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-cart" style="font-size:4rem;color:#ccc;"></i>
                <h3>Your cart is empty</h3>
                <p>Browse our products and add items you love!</p>
                <a href="shop.html" class="btn-primary">Start Shopping</a>
            </div>
        `;
        if (summary) summary.innerHTML = '';
        if (totalItems) totalItems.textContent = '0 items in your cart';
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.name}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect width=%2280%22 height=%2280%22 fill=%22%23f8fafc%22/><rect x=%2230%22 y=%2228%22 width=%2220%22 height=%2216%22 rx=%222%22 fill=%22%23e0e0e0%22/><circle cx=%2235%22 cy=%2233%22 r=%222%22 fill=%22%23f9c74f%22/></svg>'" />
            <div class="cart-item-details">
                <h4>${item.name}</h4>
                <p>₦${item.price.toLocaleString()} each</p>
                ${item.type === 'digital' ? '<span class="digital-tag">📥 Digital Download</span>' : ''}
            </div>
            <div class="cart-item-quantity">
                <button onclick="updateQuantity(${item.id}, -1)">−</button>
                <span>${item.quantity}</span>
                <button onclick="updateQuantity(${item.id}, 1)">+</button>
            </div>
            <div class="cart-item-total">
                ₦${(item.price * item.quantity).toLocaleString()}
            </div>
            <button onclick="removeFromCart(${item.id})" class="btn-remove">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');

    if (summary) {
        const subtotal = getCartTotal();
        const hasPhysical = cart.some(item => item.type === 'physical' || item.type === '');
        const delivery = 0;
        const total = subtotal + delivery;

        summary.innerHTML = `
            <h3>Order Summary</h3>
            <div class="summary-row">
                <span>Subtotal</span>
                <span>₦${subtotal.toLocaleString()}</span>
            </div>
            ${hasPhysical ? `
            <div class="summary-row">
                <span>Delivery</span>
                <span style="color:#888;font-size:0.85rem;">Calculated at checkout</span>
            </div>
            ` : `
            <div class="summary-row">
                <span>Delivery (Digital Only)</span>
                <span style="color:#4CAF50;">Free!</span>
            </div>
            `}
            <div class="summary-row total">
                <span>Total</span>
                <span>₦${total.toLocaleString()}</span>
            </div>
            <a href="checkout.html" class="btn-primary" style="width:100%;text-align:center;display:block;">
                Proceed to Checkout
            </a>
            <button onclick="clearCart()" style="width:100%;margin-top:0.5rem;padding:0.8rem;background:#e74c3c;color:white;border:none;border-radius:8px;cursor:pointer;">
                Clear Cart
            </button>
        `;
    }

    if (totalItems) {
        const count = cart.reduce((sum, item) => sum + item.quantity, 0);
        totalItems.textContent = `${count} item${count > 1 ? 's' : ''} in your cart`;
    }
}

// ============================================
// RENDER HOMEPAGE
// ============================================
// ============================================
// HERO CAROUSEL
// ============================================
let heroCurrentSlide = 0;
let heroInterval = null;
let heroPaused = false;
const HERO_DURATION = 6000;

function initHeroCarousel() {
    const carousel = document.getElementById('heroCarousel');
    if (!carousel) return;

    const slides = carousel.querySelectorAll('.hero-slide');
    const dotsContainer = document.getElementById('heroDots');
    if (!slides.length || !dotsContainer) return;

    dotsContainer.innerHTML = '';
    slides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'hero-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', 'Slide ' + (i + 1));
        dot.onclick = () => goToHeroSlide(i);
        dotsContainer.appendChild(dot);
    });

    carousel.addEventListener('mouseenter', () => { heroPaused = true; });
    carousel.addEventListener('mouseleave', () => { heroPaused = false; });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { heroPaused = true; }
        else { heroPaused = false; }
    });

    setupHeroSwipe(carousel);

    startHeroAuto();

    console.log('🎠 Hero carousel initialized with', slides.length, 'slides');
}

function startHeroAuto() {
    if (heroInterval) clearInterval(heroInterval);
    heroInterval = setInterval(() => {
        if (!heroPaused) nextHeroSlide();
    }, HERO_DURATION);
}

function goToHeroSlide(index) {
    const carousel = document.getElementById('heroCarousel');
    if (!carousel) return;
    const slides = carousel.querySelectorAll('.hero-slide');
    const dots = carousel.querySelectorAll('.hero-dot');
    if (!slides.length) return;

    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;

    slides.forEach((s, i) => s.classList.toggle('active', i === index));
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
    heroCurrentSlide = index;
    startHeroAuto();
}

function nextHeroSlide() {
    goToHeroSlide(heroCurrentSlide + 1);
}

function prevHeroSlide() {
    goToHeroSlide(heroCurrentSlide - 1);
}

function setupHeroSwipe(carousel) {
    let startX = 0;
    let startY = 0;
    carousel.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });

    carousel.addEventListener('touchend', (e) => {
        if (!startX || !startY) return;
        const dx = startX - e.changedTouches[0].clientX;
        const dy = startY - e.changedTouches[0].clientY;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
            if (dx > 0) nextHeroSlide(); else prevHeroSlide();
        }
        startX = 0;
        startY = 0;
    }, { passive: true });
}

function renderFlashSales(products) {
    const container = document.getElementById('flashSalesGrid');
    if (!container) return;

    const pool = products.filter(p => p.image && !p.image.includes('placeholder'));
    const items = shuffleArray([...pool]).slice(0, 8);

    if (items.length === 0) {
        container.innerHTML = '<p style="padding:1rem;color:#888;">No flash deals right now.</p>';
        return;
    }

    function fakeDiscount(id) {
        return 30 + ((Number(id) * 7) % 41);
    }

    function setupFlashScrollHint() {
    const scrollEl = document.getElementById('flashSalesGrid');
    const fadeEl = document.getElementById('flashFadeRight');
    if (!scrollEl || !fadeEl) return;

    function updateFade() {
        const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
        if (maxScroll <= 4) {
            fadeEl.classList.add('hidden');
            return;
        }
        const atEnd = scrollEl.scrollLeft >= maxScroll - 8;
        fadeEl.classList.toggle('hidden', atEnd);
    }

    scrollEl.addEventListener('scroll', updateFade, { passive: true });
    window.addEventListener('resize', updateFade);
    setTimeout(updateFade, 100);
}

    container.innerHTML = items.map(product => {
        const disc = fakeDiscount(product.id);
        const originalPrice = Math.round(product.price / (1 - disc / 100));
        const claimed = 40 + ((Number(product.id) * 13) % 50);

        return `
        <a href="product-detail.html?id=${product.id}" class="flash-card">
            <div class="flash-badge">-${disc}%</div>
            <div class="flash-image">
                <img src="${product.image}" alt="${product.name}" loading="lazy"
                     onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect width=%22200%22 height=%22200%22 fill=%22%23f8fafc%22/><rect x=%2275%22 y=%2270%22 width=%2250%22 height=%2240%22 rx=%224%22 fill=%22%23e0e0e0%22/><circle cx=%2288%22 cy=%2284%22 r=%225%22 fill=%22%23f9c74f%22/></svg>'" />
            </div>
            <div class="flash-info">
                <h4 class="flash-name">${product.name}</h4>
                <div class="flash-prices">
                    <span class="flash-now">₦${product.price.toLocaleString()}</span>
                    <span class="flash-was">₦${originalPrice.toLocaleString()}</span>
                </div>
                <div class="flash-progress">
                    <div class="flash-progress-bar" style="width:${claimed}%"></div>
                </div>
                <span class="flash-claimed">${claimed}% claimed</span>
            </div>
        </a>
        `;
    }).join('');

    setupFlashScrollHint();
}

function startFlashCountdown() {
    const hoursEl = document.getElementById('flashHours');
    const minEl = document.getElementById('flashMinutes');
    const secEl = document.getElementById('flashSeconds');
    if (!hoursEl || !minEl || !secEl) return;

    let h = 14, m = 14, s = 12;
    setInterval(() => {
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) { h = 23; m = 59; s = 59; }
        hoursEl.textContent = String(h).padStart(2, '0');
        minEl.textContent = String(m).padStart(2, '0');
        secEl.textContent = String(s).padStart(2, '0');
    }, 1000);
}

async function renderHomepage() {
    console.log('🏠 Rendering homepage...');

    renderProductSkeletons('flashSalesGrid', 4);
    renderProductSkeletons('featuredProducts', 10);
    renderProductSkeletons('freshElectronics', 10);
    renderProductSkeletons('fashionPicks', 10);
    renderProductSkeletons('homePicks', 10);
    renderProductSkeletons('traditionalPicks', 10);
    renderProductSkeletons('featuredDigitalProducts', 10);

    try {
        const productData = await fetchProducts();
        console.log('📦 Products fetched from Strapi:', productData.length);

        if (productData.length === 0) {
            const featuredEl = document.getElementById('featuredProducts');
            if (featuredEl) {
                featuredEl.innerHTML = `
                    <div style="text-align:center;padding:3rem;color:#888;grid-column:1/-1;">
                        <i class="fas fa-database" style="font-size:2.5rem;display:block;margin-bottom:0.5rem;"></i>
                        <p>No products available. Please add products in Strapi.</p>
                    </div>
                `;
            }
            return;
        }

        const products = productData.map(convertStrapiProduct);
        console.log('🔎 All categories in DB:', products.map(p => p.category));
        console.log('📋 Total products:', products.length);

        renderFlashSales(products);
        startFlashCountdown();

        const excludedFromFeatured = ['ebook', 'course', 'template'];
        const featuredPool = products.filter(p => !excludedFromFeatured.includes(p.subType));
        const featured = getVarietyProducts(featuredPool, 10);
        renderProducts('featuredProducts', featured);

        const electronicsProducts = products.filter(p => p.category === 'electronics');
        const freshElectronics = shuffleArray([...electronicsProducts]).slice(0, 10);
        renderProducts('freshElectronics', freshElectronics);

        const fashionProducts = products.filter(p => p.category === 'fashion');
        const fashionPicks = shuffleArray([...fashionProducts]).slice(0, 10);
        renderProducts('fashionPicks', fashionPicks);

        const digitalProducts = products.filter(p => p.category === 'digital');
        const digitalFeatured = shuffleArray([...digitalProducts]).slice(0, 10);
        renderProducts('featuredDigitalProducts', digitalFeatured);

        const homeProducts = products.filter(p => p.category === 'home');
        const homePicks = shuffleArray([...homeProducts]).slice(0, 10);
        renderProducts('homePicks', homePicks);

        const traditionalProducts = products.filter(p => p.category === 'traditional');
        const traditionalPicks = shuffleArray([...traditionalProducts]).slice(0, 10);
        renderProducts('traditionalPicks', traditionalPicks);

        if (digitalFeatured.length === 0) {
            const digitalEl = document.getElementById('featuredDigitalProducts');
            if (digitalEl) {
                digitalEl.innerHTML = `
                    <div style="text-align:center;padding:3rem 1rem;color:#888;grid-column:1/-1;">
                        <i class="fas fa-download" style="font-size:2.5rem;display:block;margin-bottom:0.75rem;color:#f9c74f;"></i>
                        <h3 style="margin:0 0 0.5rem;color:#0d1b2a;">📥 Digital Downloads Coming Soon</h3>
                        <p style="margin:0;">E-books, software, and templates will be available shortly.</p>
                    </div>
                `;
            }
        }

        const sectionsToCheck = [
            { id: 'freshElectronics', items: freshElectronics },
            { id: 'fashionPicks', items: fashionPicks },
            { id: 'homePicks', items: homePicks },
            { id: 'traditionalPicks', items: traditionalPicks },
        ];

        sectionsToCheck.forEach(({ id, items }) => {
            const el = document.getElementById(id);
            if (el) {
                const section = el.closest('section') || el.parentElement;
                if (section && items.length === 0) {
                    section.style.display = 'none';
                }
            }
        });

        console.log('✅ Homepage rendered successfully!');
    } catch (error) {
        console.error('❌ Error rendering homepage:', error);
    }
}

function getVarietyProducts(products, count = 12) {
    const allShuffled = shuffleArray([...products]);

    const byCategory = {};
    allShuffled.forEach(p => {
        if (!byCategory[p.category]) byCategory[p.category] = [];
        byCategory[p.category].push(p);
    });

    const categories = shuffleArray(Object.keys(byCategory));
    categories.forEach(cat => {
        byCategory[cat] = shuffleArray([...byCategory[cat]]);
    });

    const result = [];
    let index = 0;

    while (result.length < count) {
        let addedThisRound = false;
        for (const cat of categories) {
            if (byCategory[cat][index]) {
                result.push(byCategory[cat][index]);
                addedThisRound = true;
                if (result.length >= count) break;
            }
        }
        if (!addedThisRound) break;
        index++;
    }

    if (result.length < count) {
        const remaining = allShuffled.filter(p => !result.includes(p));
        while (result.length < count && remaining.length > 0) {
            result.push(remaining.pop());
        }
    }

    return result;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ============================================
// RENDER SHOP PAGE
// ============================================
async function renderShopPage(filter = 'all', search = '', subType = '') {
    console.log('🛒 Rendering shop page...', { filter, search, subType });
    renderProductSkeletons('allProductsGrid', 15);

    try {
        const productData = await fetchProducts();
        let products = productData.map(convertStrapiProduct);

        if (filter !== 'all') {
            products = products.filter(p => p.category === filter);
        }
        if (subType) {
            products = products.filter(p => p.subType === subType);
        }
        if (search) {
            products = products.filter(p =>
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.category.toLowerCase().includes(search.toLowerCase())
            );
        }

        renderProducts('allProductsGrid', products);

        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) resultsCount.textContent = products.length;

        console.log('✅ Shop page rendered with', products.length, 'products');
    } catch (error) {
        console.error('❌ Error rendering shop page:', error);
    }
}

// ============================================
// RENDER CATEGORY
// ============================================
async function renderCategory(category, subType = '') {
    const containerMap = {
        digital: 'digitalProductsGrid',
        electronics: 'electronicsProducts',
        fashion: 'fashionProducts',
        beauty: 'beautyProducts',
        home: 'homeProducts',
        traditional: 'traditionalProducts',
    };
    if (containerMap[category]) {
        renderProductSkeletons(containerMap[category], 12);
    }

    try {
        const productData = await fetchProducts();
        let products = productData.map(convertStrapiProduct).filter(p => p.category === category);

        if (subType) {
            products = products.filter(p => p.subType === subType.toLowerCase());
            console.log(`🔎 Filtered by subtype "${subType}": ${products.length} products`);
        }

        const containerId = category === 'digital' ? 'digitalProductsGrid' :
                            category === 'electronics' ? 'electronicsProducts' :
                            category === 'fashion' ? 'fashionProducts' :
                            category === 'beauty' ? 'beautyProducts' :
                            category === 'home' ? 'homeProducts' :
                            category === 'traditional' ? 'traditionalProducts' : null;
        if (containerId) {
            renderProducts(containerId, products);
        }
    } catch (error) {
        console.error('❌ Error rendering category:', error);
    }
}

// ============================================
// RENDER PRODUCT DETAIL
// ============================================
async function renderProductDetail() {
    console.log('📄 Rendering product detail...');

    try {
        const params = new URLSearchParams(window.location.search);
        const productId = params.get('id');
        const container = document.getElementById('productDetail');
        if (!container) return;

        container.innerHTML = `
            <div style="text-align:center;padding:5rem 1rem;">
                <div style="display:inline-block;width:48px;height:48px;border:4px solid #e0e0e0;border-top-color:#f9c74f;border-radius:50%;animation:ishop-spin 0.8s linear infinite;"></div>
                <p style="margin-top:1rem;color:#888;font-size:0.95rem;">Loading product...</p>
            </div>
        `;
        if (!document.getElementById('ishop-spin-style')) {
            const style = document.createElement('style');
            style.id = 'ishop-spin-style';
            style.textContent = '@keyframes ishop-spin { to { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }

        await new Promise(resolve => setTimeout(resolve, 150));

        if (!productId) {
            container.innerHTML = `
                <div style="text-align:center;padding:3rem;">
                    <h2>Product ID missing</h2>
                    <p>Please select a product from the shop.</p>
                    <a href="shop.html" class="btn-primary">Browse Products</a>
                </div>
            `;
            return;
        }

        const productData = await fetchProducts();
        const strapiProduct = productData.find(p => p.id === productId || String(p.id) === String(productId));

        if (!strapiProduct) {
            container.innerHTML = `
                <div style="text-align:center;padding:3rem;">
                    <i class="fas fa-search" style="font-size:3rem;color:#ccc;display:block;margin-bottom:1rem;"></i>
                    <h2>Product Not Found</h2>
                    <p>Sorry, the product you're looking for doesn't exist.</p>
                    <a href="shop.html" class="btn-primary">Browse Products</a>
                </div>
            `;
            return;
        }

        const product = convertStrapiProduct(strapiProduct);

        const fullStars = Math.floor(product.rating);
        const halfStar = product.rating % 1 >= 0.5 ? 1 : 0;
        const emptyStars = 5 - fullStars - halfStar;
        const ratingStars = '⭐'.repeat(fullStars) + (halfStar ? '⭐' : '') + '☆'.repeat(emptyStars);

        const allImages = (product.images && product.images.length > 0) ? product.images : [product.image];
        const isFreeDigital = product.type === 'digital' && product.price === 0;

        let galleryHTML = `
            <div class="product-gallery">
                <div class="gallery-main" id="galleryMain">
                    <img src="${allImages[0]}" alt="${product.name}" id="mainGalleryImage" />
                    ${product.type === 'digital' ? '<span class="digital-badge-large">💻 Instant Download</span>' : ''}
                    ${allImages.length > 1 ? `
                        <button class="gallery-nav gallery-prev" onclick="navigateGallery(-1)">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <button class="gallery-nav gallery-next" onclick="navigateGallery(1)">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                        <div class="gallery-counter">
                            <span id="galleryCurrentIndex">1</span> / ${allImages.length}
                        </div>
                    ` : ''}
                </div>
                <div class="gallery-thumbnails" id="galleryThumbnails">
                    ${allImages.map((img, index) => `
                        <div class="gallery-thumbnail ${index === 0 ? 'active' : ''}"
                             onclick="changeGalleryImage('${img}', ${index})">
                            <img src="${img}" alt="View ${index + 1}" />
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        container.innerHTML = `
            <div class="product-detail-container">
                <div class="breadcrumb">
                    <a href="index.html"><i class="fas fa-home"></i> Home</a>
                    <i class="fas fa-chevron-right"></i>
                    <a href="shop.html">Shop</a>
                    <i class="fas fa-chevron-right"></i>
                    <a href="shop.html?filter=${product.category}">${product.category.charAt(0).toUpperCase() + product.category.slice(1)}</a>
                    <i class="fas fa-chevron-right"></i>
                    <span>${product.name.length > 30 ? product.name.substring(0, 30) + '...' : product.name}</span>
                </div>

                <div class="product-detail-layout">
                    <div class="product-detail-gallery">
                        ${galleryHTML}
                    </div>

                    <div class="product-detail-info">
                        <h1 class="product-title">${product.name}</h1>
                        <div class="product-code">Product Code: SN-${String(product.id).padStart(6, '0')}</div>

                        <div class="product-rating-section">
                            <span class="product-rating-stars">${ratingStars}</span>
                            <span class="product-rating-number">${product.rating}</span>
                            <span class="product-rating-reviews">(12 verified reviews)</span>
                        </div>

                        <div class="product-price-section">
                            <div class="product-price">${isFreeDigital ? '<span style="color:#4CAF50;font-weight:700;font-size:1.5em;">FREE</span>' : '₦' + product.price.toLocaleString()}</div>
                        </div>

                        <div class="product-delivery-info">
                            <div class="delivery-item">
                                <i class="fas fa-truck"></i>
                                <div>
                                    <strong>Free Delivery</strong>
                                    <span>On orders over ₦100,000</span>
                                </div>
                            </div>
                            <div class="delivery-item">
                                <i class="fas fa-undo-alt"></i>
                                <div>
                                    <strong>7-Day Return Policy</strong>
                                    <span>Guaranteed returns</span>
                                </div>
                            </div>
                            <div class="delivery-item">
                                <i class="fas fa-shield-alt"></i>
                                <div>
                                    <strong>Secure Payment</strong>
                                    <span>100% safe checkout</span>
                                </div>
                            </div>
                        </div>

                        <div class="product-actions">
                            ${isFreeDigital ? `
                                <button onclick="downloadFreeProduct('${product.documentId}')" class="btn-add-to-cart" style="background:#4CAF50;">
                                    <i class="fas fa-download"></i> Download Free
                                </button>
                            ` : `
                                <button onclick="addToCart(${product.id})" class="btn-add-to-cart">
                                    <i class="fas fa-shopping-cart"></i> Add to Cart
                                </button>
                                <button onclick="buyNow(${product.id})" class="btn-buy-now">
                                    <i class="fas fa-bolt"></i> Buy Now
                                </button>
                            `}
                            <button onclick="toggleWishlist(${product.id})" class="btn-wishlist">
                                <i class="fas fa-heart"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="product-description-section">
                    <div class="description-tabs">
                        <button class="tab-btn active" onclick="switchTab('description')">Product Description</button>
                        <button class="tab-btn" onclick="switchTab('features')">Features & Specs</button>
                        <button class="tab-btn" onclick="switchTab('reviews')">Reviews</button>
                    </div>
                    <div class="tab-content" id="descriptionContent">
                        <div class="description-content">
                            <h3>Product Description</h3>
                            <p>${product.description || 'No description available.'}</p>
                            ${product.features && product.features.length > 0 ? `
                                <h3 style="margin-top:2rem;">📦 What's in the Box</h3>
                                <ul class="features-list">
                                    ${product.features.map(f => `<li><i class="fas fa-check-circle"></i> ${f}</li>`).join('')}
                                </ul>
                            ` : ''}
                        </div>
                    </div>
                    <div class="tab-content" id="featuresContent" style="display:none;">
                        <div class="features-content">
                            <h3>📋 Specifications</h3>
                            ${product.specifications && product.specifications.length > 0 ? `
                                <table class="specifications-table">
                                    <tbody>
                                        ${product.specifications.map(spec => `
                                            <tr>
                                                <td class="spec-name">${spec.name}</td>
                                                <td class="spec-value">${spec.value}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            ` : `
                                <p style="color:#888;text-align:center;padding:2rem;">No specifications available for this product.</p>
                            `}
                        </div>
                    </div>
                    <div class="tab-content" id="reviewsContent" style="display:none;">
                        <div class="reviews-content">
                            <h3>Customer Reviews</h3>
                            <div class="reviews-summary">
                                <div class="reviews-average">
                                    <span class="average-rating">${product.rating}</span>
                                    <span class="average-stars">${ratingStars}</span>
                                    <span class="average-count">Based on 12 reviews</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const allProducts = (await fetchProducts()).map(convertStrapiProduct);
        const related = allProducts.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
        renderProducts('relatedProducts', related);

        initializeGallery(allImages);

        console.log('✅ Product detail rendered successfully');
    } catch (error) {
        console.error('❌ Error rendering product detail:', error);
    }
}

// ============================================
// RENDER CHECKOUT SUMMARY
// ============================================
function renderCheckoutSummary() {
    const container = document.getElementById('orderSummary');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `
            <h3>Order Summary</h3>
            <p style="color:#888;text-align:center;padding:1rem 0;">Your cart is empty.</p>
            <a href="shop.html" style="display:block;text-align:center;padding:0.8rem;background:#f9c74f;color:#0d1b2a;border-radius:10px;font-weight:700;text-decoration:none;">Start Shopping</a>
        `;
        return;
    }

    const subtotal = getCartTotal();
    const hasPhysical = cartHasPhysical();
    const stateSelected = getSelectedState();
    const lgaSelected = getSelectedLga();

    let delivery = 0;
    let deliveryLabel = '';

    if (!hasPhysical) {
        deliveryLabel = '<span style="color:#4CAF50;font-weight:700;">Free (Digital only)</span>';
    } else if (!stateSelected) {
        deliveryLabel = '<span style="color:#888;font-size:0.85rem;">Select state to see fee</span>';
    } else if (!lgaSelected) {
        deliveryLabel = '<span style="color:#888;font-size:0.85rem;">Select LGA to see fee</span>';
    } else {
        delivery = currentEffectiveDeliveryFee();
        deliveryLabel = '₦' + delivery.toLocaleString();
    }

    const total = subtotal + delivery;
    const itemsCount = cart.reduce((s, i) => s + i.quantity, 0);

    const itemsHTML = cart.map(item => `
        <div class="cart-preview-item">
            <img src="${item.image}" alt="${item.name}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2244%22 height=%2244%22><rect width=%2244%22 height=%2244%22 fill=%22%23f8fafc%22/><rect x=%2216%22 y=%2215%22 width=%2212%22 height=%2210%22 rx=%221%22 fill=%22%23e0e0e0%22/></svg>'" />
            <div class="cp-info">
                <strong>${item.name}</strong>
                <span>Qty ${item.quantity} × ₦${item.price.toLocaleString()}</span>
            </div>
            <span class="cp-price">₦${(item.price * item.quantity).toLocaleString()}</span>
        </div>
    `).join('');

    container.innerHTML = `
        <h3>Order Summary</h3>
        ${itemsHTML}
        <div class="summary-row" style="margin-top:1rem;">
            <span>Subtotal (${itemsCount} item${itemsCount > 1 ? 's' : ''})</span>
            <span>₦${subtotal.toLocaleString()}</span>
        </div>
        <div class="summary-row">
            <span>Delivery</span>
            <span>${deliveryLabel}</span>
        </div>
        <div class="summary-row total">
            <span>Total</span>
            <span>₦${total.toLocaleString()}</span>
        </div>
        <div id="shippingOptionsMountPoint"></div>
    `;

    renderShippingOptionsUI();
}

// ============================================
// SEARCH BAR DROPDOWN
// ============================================
let selectedSearchCategory = 'All Categories';

function toggleSearchDropdown() {
    const dropdown = document.getElementById('searchDropdown');
    const arrow = document.getElementById('searchArrow');
    if (dropdown) dropdown.classList.toggle('active');
    if (arrow) arrow.classList.toggle('rotated');
}

function selectCategory(category) {
    selectedSearchCategory = category;
    const el = document.getElementById('selectedCategory');
    if (el) el.textContent = category;
    const dropdown = document.getElementById('searchDropdown');
    const arrow = document.getElementById('searchArrow');
    if (dropdown) dropdown.classList.remove('active');
    if (arrow) arrow.classList.remove('rotated');
}

document.addEventListener('click', function(event) {
    const searchBar = document.querySelector('.search-bar');
    const dropdown = document.getElementById('searchDropdown');
    if (searchBar && dropdown && !searchBar.contains(event.target)) {
        dropdown.classList.remove('active');
        const arrow = document.getElementById('searchArrow');
        if (arrow) arrow.classList.remove('rotated');
    }
});

function performMobileSearch() {
    const mobileSearchInput = document.getElementById('mobileSearch');
    if (!mobileSearchInput) return;
    const term = mobileSearchInput.value.trim();
    if (term) {
        window.location.href = `shop.html?q=${encodeURIComponent(term)}`;
    } else {
        window.location.href = 'shop.html';
    }
}

function performSearch() {
    const searchInput = document.getElementById('mainSearch');
    if (searchInput) {
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
            let url = `shop.html?q=${encodeURIComponent(searchTerm)}`;
            if (selectedSearchCategory !== 'All Categories') {
                url += `&filter=${selectedSearchCategory.toLowerCase()}`;
            }
            window.location.href = url;
        } else {
            alert('Please enter a search term');
        }
    }
}

// ============================================
// AUTHENTICATION — Real Strapi-backed
// ============================================
function getCurrentUser() {
    const user = JSON.parse(localStorage.getItem('iShopUser')) || null;
    const jwt = localStorage.getItem('iShopJwt');
    if (!user || !jwt) return null;
    return user;
}

function getJwt() {
    return localStorage.getItem('iShopJwt') || null;
}

function getRefreshToken() {
    return localStorage.getItem('iShopRefreshToken') || null;
}

function saveAuthSession({ user, jwt, refreshToken }) {
    if (user) localStorage.setItem('iShopUser', JSON.stringify(user));
    if (jwt) localStorage.setItem('iShopJwt', jwt);
    if (refreshToken) localStorage.setItem('iShopRefreshToken', refreshToken);
}

function clearAuthSession() {
    localStorage.removeItem('iShopUser');
    localStorage.removeItem('iShopJwt');
    localStorage.removeItem('iShopRefreshToken');
}

function toggleAccountDropdown(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const wrap = document.getElementById('accountDropdownWrap');
    if (!wrap) return;
    wrap.classList.toggle('open');
}

document.addEventListener('click', function (e) {
    const wrap = document.getElementById('accountDropdownWrap');
    if (!wrap) return;
    if (!e.target.closest('#accountDropdownWrap')) {
        wrap.classList.remove('open');
    }
});

window.addEventListener('scroll', function () {
    const wrap = document.getElementById('accountDropdownWrap');
    if (wrap && wrap.classList.contains('open')) wrap.classList.remove('open');
}, { passive: true });

function updateAuthUI() {
    const user = getCurrentUser();
    const guestPanel = document.getElementById('accountGuestPanel');
    const userPanel = document.getElementById('accountUserPanel');
    const helloName = document.getElementById('accountHelloName');
    const vendorLinks = document.getElementById('vendorAccountLinks');

    if (user) {
        if (guestPanel) guestPanel.style.display = 'none';
        if (userPanel) userPanel.style.display = 'block';
        if (helloName) {
            const firstName = (user.fullName || user.username || 'Friend').split(' ')[0];
            helloName.textContent = 'Hello, ' + firstName;
        }

        // Show admin panel link only for the admin's email
        const adminLink = document.getElementById('adminPanelLink');
        if (adminLink) {
            const adminEmail = 'agwusite@gmail.com';
            if ((user.email || '').toLowerCase() === adminEmail.toLowerCase()) {
                adminLink.style.display = 'flex';
            } else {
                adminLink.style.display = 'none';
            }
        }

        // Show vendor links only if this user has a vendor account
        if (vendorLinks) {
            if (user.isVendor) {
                vendorLinks.style.display = 'block';
            } else {
                vendorLinks.style.display = 'none';
                // Try to detect vendor status silently
                detectVendorAndUpdateUI(user);
            }
        }
        // Show vendor links in mobile drawer if user is a vendor
        const drawerVendorLinks = document.getElementById('drawerVendorLinks');
        const drawerVendorOrders = document.getElementById('drawerVendorOrders');
        const drawerVendorProducts = document.getElementById('drawerVendorProducts');
        const drawerVendorEarnings = document.getElementById('drawerVendorEarnings');
        if (user.isVendor) {
            if (drawerVendorLinks) drawerVendorLinks.style.display = 'block';
            if (drawerVendorOrders) drawerVendorOrders.style.display = 'block';
            if (drawerVendorProducts) drawerVendorProducts.style.display = 'block';
            if (drawerVendorEarnings) drawerVendorEarnings.style.display = 'block';
        } else {
            if (drawerVendorLinks) drawerVendorLinks.style.display = 'none';
            if (drawerVendorOrders) drawerVendorOrders.style.display = 'none';
            if (drawerVendorProducts) drawerVendorProducts.style.display = 'none';
            if (drawerVendorEarnings) drawerVendorEarnings.style.display = 'none';
        }
    } else {
        if (guestPanel) guestPanel.style.display = 'block';
        if (userPanel) userPanel.style.display = 'none';
        if (vendorLinks) vendorLinks.style.display = 'none';
        const drawerVendorLinks = document.getElementById('drawerVendorLinks');
        const drawerVendorOrders = document.getElementById('drawerVendorOrders');
        const drawerVendorProducts = document.getElementById('drawerVendorProducts');
        const drawerVendorEarnings = document.getElementById('drawerVendorEarnings');
        if (drawerVendorLinks) drawerVendorLinks.style.display = 'none';
        if (drawerVendorOrders) drawerVendorOrders.style.display = 'none';
        if (drawerVendorProducts) drawerVendorProducts.style.display = 'none';
        if (drawerVendorEarnings) drawerVendorEarnings.style.display = 'none';
    }
}

// Silently check if the current user has a vendor record
async function detectVendorAndUpdateUI(user) {
    const jwt = getJwt();
    if (!jwt || !user?.id) return;

    try {
        const res = await fetch(`${STRAPI_AUTH_BASE}/api/vendors?filters[user][id][$eq]=${user.id}`, {
            headers: { 'Authorization': `Bearer ${jwt}` },
        });
        const data = await res.json();
        if (data.data && data.data.length > 0) {
            const vendor = data.data[0];
            const updated = { ...user, isVendor: true, vendorId: vendor.documentId || vendor.id, vendorStatus: vendor.approvalStatus };
            localStorage.setItem('iShopUser', JSON.stringify(updated));
            const vendorLinks = document.getElementById('vendorAccountLinks');
            if (vendorLinks) vendorLinks.style.display = 'block';
        }
    } catch (err) {
        // silent fail
    }
}

function logoutUser() {
    clearAuthSession();
    localStorage.removeItem(PRODUCT_CACHE_KEY);
    updateAuthUI();
    window.location.href = 'index.html';
}

function saveUser(userData) {
    const existing = JSON.parse(localStorage.getItem('iShopUser')) || {};
    localStorage.setItem('iShopUser', JSON.stringify({ ...existing, ...userData }));
}

// ============================================
// COUNTDOWN TIMER
// ============================================
function startCountdown() {
    const hoursElement = document.getElementById('hours');
    const minutesElement = document.getElementById('minutes');
    const secondsElement = document.getElementById('seconds');
    if (!hoursElement || !minutesElement || !secondsElement) return;

    let hours = 12;
    let minutes = 30;
    let seconds = 45;

    setInterval(() => {
        seconds--;
        if (seconds < 0) {
            seconds = 59;
            minutes--;
            if (minutes < 0) {
                minutes = 59;
                hours--;
                if (hours < 0) hours = 23;
            }
        }
        hoursElement.textContent = String(hours).padStart(2, '0');
        minutesElement.textContent = String(minutes).padStart(2, '0');
        secondsElement.textContent = String(seconds).padStart(2, '0');
    }, 1000);
}

// ============================================
// FILTERS & TABS
// ============================================
function setupFilters() {
    const buttons = document.querySelectorAll('.digital-tabs .tab-btn');
    if (!buttons.length) return;

    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            buttons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const filter = this.dataset.type || 'all';
            const searchInput = document.getElementById('shopSearch');
            const search = searchInput ? searchInput.value.trim() : '';
            renderShopPage(filter, search);
        });
    });

    const shopSearch = document.getElementById('shopSearch');
    if (shopSearch) {
        let debounce;
        shopSearch.addEventListener('input', function() {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                const activeBtn = document.querySelector('.digital-tabs .tab-btn.active');
                const filter = activeBtn ? activeBtn.dataset.type : 'all';
                renderShopPage(filter, this.value.trim());
            }, 250);
        });
    }
}

function filterBySearch() {
    const searchInput = document.getElementById('shopSearch');
    const search = searchInput ? searchInput.value.trim() : '';
    const activeBtn = document.querySelector('.digital-tabs .tab-btn.active');
    const filter = activeBtn ? activeBtn.dataset.type : 'all';
    renderShopPage(filter, search);
}

function setupSubcategoryButtons(category) {
    const buttons = document.querySelectorAll('.subcat-item');
    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            buttons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const subType = this.dataset.subtype;
            filterSubcategory(category, subType);
        });
    });
}

async function filterSubcategory(category, subType = 'all') {
    try {
        const productData = await fetchProducts();
        let products = productData.map(convertStrapiProduct).filter(p => p.category === category);
        if (subType !== 'all') {
            products = products.filter(p => p.subType === subType);
        }
        const containerId = category + 'Products';
        renderProducts(containerId, products);
    } catch (error) {
        console.error('❌ Error filtering subcategory:', error);
    }
}

// ============================================
// CHECKOUT — DIFFERENT SHIPPING TOGGLE
// ============================================
function toggleDifferentShipping() {
    const checkbox = document.getElementById('differentShipping');
    const defaultFields = document.getElementById('defaultShippingFields');
    const differentFields = document.getElementById('differentShippingFields');

    if (!checkbox || !defaultFields || !differentFields) return;

    if (checkbox.checked) {
        defaultFields.style.display = 'none';
        differentFields.style.display = 'block';

        const profileName = document.getElementById('fullName')?.value || '';
        const profilePhone = document.getElementById('phone')?.value || '';
        const shipName = document.getElementById('shipName');
        const shipPhone = document.getElementById('shipPhone');
        if (shipName && !shipName.value) shipName.value = profileName;
        if (shipPhone && !shipPhone.value) shipPhone.value = profilePhone;
    } else {
        defaultFields.style.display = 'block';
        differentFields.style.display = 'none';
    }
}

// ============================================
// CHECKOUT FORM
// ============================================
function setupCheckoutForm() {
    const form = document.getElementById('checkoutForm');
    if (!form) return;

    const currentUser = getCurrentUser();
    if (currentUser) {
        const nameInput = document.getElementById('fullName');
        const emailInput = document.getElementById('email');
        const phoneInput = document.getElementById('phone');
        const addressInput = document.getElementById('address');

        if (nameInput && !nameInput.value) nameInput.value = currentUser.fullName || currentUser.username || '';
        if (emailInput && !emailInput.value) emailInput.value = currentUser.email || '';
        if (phoneInput && !phoneInput.value) phoneInput.value = currentUser.phone || '';
        if (addressInput && !addressInput.value) addressInput.value = currentUser.address || '';
    }

    const paymentSelect = document.getElementById('payment');
    const paymentInfo = document.getElementById('paymentInfo');
    if (paymentSelect && paymentInfo) {
        paymentSelect.addEventListener('change', function() {
            const notes = {
                'paystack': '<i class="fas fa-lock" style="color:#4CAF50;"></i> <span>Your payment is secured by Paystack.</span>',
                'transfer': '<i class="fas fa-university" style="color:#0d6efd;"></i> <span>You\'ll receive bank transfer details.</span>',
                'cod': '<i class="fas fa-money-bill-wave" style="color:#e67e22;"></i> <span>Pay with cash on delivery.</span>'
            };
            paymentInfo.innerHTML = notes[this.value] || '';
        });
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (cart.length === 0) {
            alert('Your cart is empty. Please add products first.');
            return;
        }

        const name = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const paymentMethod = document.getElementById('payment').value;

        const differentShipping = document.getElementById('differentShipping')?.checked;

        let shippingName, shippingPhone, shippingAddress, shippingNotes = '';
        let shippingStateSlug, shippingLgaSlug;

        if (differentShipping) {
            shippingName = document.getElementById('shipName')?.value.trim() || name;
            shippingPhone = document.getElementById('shipPhone')?.value.trim() || phone;
            shippingAddress = document.getElementById('shipAddress')?.value.trim() || '';
            shippingNotes = document.getElementById('shipNotes')?.value.trim() || '';
            shippingStateSlug = document.getElementById('shipState')?.value || '';
            shippingLgaSlug = document.getElementById('shipLga')?.value || '';
        } else {
            shippingName = name;
            shippingPhone = phone;
            shippingAddress = document.getElementById('address').value.trim();
            shippingNotes = '';
            shippingStateSlug = document.getElementById('state')?.value || '';
            shippingLgaSlug = document.getElementById('lga')?.value || '';
        }

        if (!shippingAddress) {
            alert('Please enter a delivery address.');
            return;
        }
        if (!shippingStateSlug) {
            alert('Please select a delivery state.');
            return;
        }
        if (!shippingLgaSlug) {
            alert('Please select a Local Government Area (LGA).');
            return;
        }

        const feedback = document.getElementById('orderFeedback');
        const submitBtn = document.getElementById('placeOrderBtn');

        if (paymentMethod !== 'paystack') {
            feedback.innerHTML = `
                <div style="background:#fff3cd;padding:1.5rem;border-radius:10px;margin-top:1.5rem;color:#856404;">
                    ⚠️ <strong>${paymentMethod}</strong> payment is coming soon. Please choose <strong>Paystack</strong>.
                </div>
            `;
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        try {
            const subtotal = getCartTotal();
            const delivery = currentEffectiveDeliveryFee();
            const total = subtotal + delivery;

            const response = await fetch(PAYMENT_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    amount: total,
                    customerName: name,
                    items: cart.map(item => ({
                        id: item.id,
                        documentId: item.documentId,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        type: item.type
                    })),
                    phone: phone,
                    address: shippingAddress,
                    shippingName: shippingName,
                    shippingPhone: shippingPhone,
                    shippingNotes: shippingNotes,
                    differentShipping: differentShipping,
                    shippingState: shippingStateSlug,
                    shippingLga: shippingLgaSlug,
                    deliveryFee: delivery,
                    shippingMethod: selectedShippingMethod,
                    dhlProductCode: selectedShippingMethod.startsWith('dhl-')
                        ? selectedShippingMethod.replace(/^dhl-/, '')
                        : null,
                    userJwt: getJwt()
                })
            });

            const data = await response.json();

            if (!data.status || !data.access_code) {
                throw new Error(data.error || 'Payment initialization failed');
            }

            const popup = new PaystackPop();
            popup.resumeTransaction(data.access_code, {
                onSuccess: (transaction) => {
                    cart = [];
                    saveCart();
                    window.location.href = 'order-confirmed.html?reference=' + transaction.reference;
                },
                onCancel: () => {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-lock"></i> Place Order & Pay Securely';
                    feedback.innerHTML = `
                        <div style="background:#f8d7da;padding:1rem;border-radius:10px;margin-top:1rem;color:#721c24;">
                            Payment cancelled. You can try again.
                        </div>
                    `;
                }
            });

        } catch (error) {
            console.error('Checkout error:', error);
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-lock"></i> Place Order & Pay Securely';
            feedback.innerHTML = `
                <div style="background:#f8d7da;padding:1.5rem;border-radius:10px;margin-top:1.5rem;color:#721c24;">
                    ❌ Error: ${error.message}. Please try again.
                </div>
            `;
        }
    });
}

// ============================================
// WISHLIST
// ============================================
function toggleWishlist(productId) {
    let wishlistData = JSON.parse(localStorage.getItem('iShopWishlist')) || [];
    const index = wishlistData.indexOf(productId);
    if (index > -1) {
        wishlistData.splice(index, 1);
        alert('❤️ Removed from wishlist');
    } else {
        wishlistData.push(productId);
        alert('❤️ Added to wishlist!');
    }
    localStorage.setItem('iShopWishlist', JSON.stringify(wishlistData));
    updateWishlistUI();
}

function updateWishlistUI() {
    const wishlistItems = document.getElementById('wishlistProducts');
    if (!wishlistItems) return;

    const wishlistData = JSON.parse(localStorage.getItem('iShopWishlist')) || [];

    if (wishlistData.length === 0) {
        wishlistItems.innerHTML = `
            <div class="empty-wishlist">
                <i class="fas fa-heart" style="font-size:4rem;color:#ccc;"></i>
                <h3>Your wishlist is empty</h3>
                <p>Browse our products and save your favorites!</p>
                <a href="shop.html" class="btn-primary">Start Shopping</a>
            </div>
        `;
    } else {
        fetchProducts().then(productData => {
            const products = productData.map(convertStrapiProduct);
        console.log('🔎 All categories in DB:', products.map(p => p.category));
        console.log('📋 Total products:', products.length);
            const wishlistProducts = products.filter(p => wishlistData.includes(p.id));
            renderProducts('wishlistProducts', wishlistProducts);
        });
    }
}

// ============================================
// TRACK ORDER (legacy)
// ============================================
function trackOrder() {
    const orderNumber = document.getElementById('orderNumber');
    const result = document.getElementById('trackResult');
    if (orderNumber && orderNumber.value.trim()) {
        result.style.display = 'block';
        const steps = document.querySelectorAll('.track-step');
        steps.forEach((step, index) => {
            setTimeout(() => {
                step.classList.add('active');
            }, index * 1000);
        });
    } else {
        alert('Please enter an order number');
    }
}

// ============================================
// GALLERY + QUANTITY + TAB SWITCHER + BUY NOW
// ============================================
function changeGalleryImage(imageUrl, index) {
    const mainImage = document.getElementById('mainGalleryImage');
    if (mainImage) mainImage.src = imageUrl;

    currentGalleryIndex = index;

    const counter = document.getElementById('galleryCurrentIndex');
    if (counter) counter.textContent = index + 1;

    const thumbnails = document.querySelectorAll('.gallery-thumbnail');
    thumbnails.forEach((thumb, i) => thumb.classList.toggle('active', i === index));
}

let currentQuantity = 1;
function changeQuantity(change) {
    currentQuantity += change;
    if (currentQuantity < 1) currentQuantity = 1;
    if (currentQuantity > 99) currentQuantity = 99;
    const display = document.getElementById('quantityDisplay');
    if (display) display.textContent = currentQuantity;
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const contentMap = {
        'description': 'descriptionContent',
        'features': 'featuresContent',
        'reviews': 'reviewsContent'
    };
    const content = document.getElementById(contentMap[tab]);
    if (content) content.style.display = 'block';

    const buttons = document.querySelectorAll('.tab-btn');
    const buttonMap = { 'description': 0, 'features': 1, 'reviews': 2 };
    if (buttons[buttonMap[tab]]) buttons[buttonMap[tab]].classList.add('active');
}

function buyNow(productId) {
    addToCart(productId);
    setTimeout(() => {
        window.location.href = 'checkout.html';
    }, 500);
}

// ============================================
// PRODUCT GALLERY NAVIGATION
// ============================================
let currentGalleryImages = [];
let currentGalleryIndex = 0;

function initializeGallery(images) {
    currentGalleryImages = images || [];
    currentGalleryIndex = 0;
    setupSwipe();
}

function navigateGallery(direction) {
    if (currentGalleryImages.length === 0) return;

    currentGalleryIndex += direction;
    if (currentGalleryIndex < 0) currentGalleryIndex = currentGalleryImages.length - 1;
    if (currentGalleryIndex >= currentGalleryImages.length) currentGalleryIndex = 0;

    updateGalleryView();
}

function updateGalleryView() {
    const mainImage = document.getElementById('mainGalleryImage');
    const counter = document.getElementById('galleryCurrentIndex');
    const thumbnails = document.querySelectorAll('.gallery-thumbnail');

    if (mainImage) mainImage.src = currentGalleryImages[currentGalleryIndex];
    if (counter) counter.textContent = currentGalleryIndex + 1;

    thumbnails.forEach((thumb, i) => {
        thumb.classList.toggle('active', i === currentGalleryIndex);
    });
}

function setupSwipe() {
    const galleryMain = document.getElementById('galleryMain');
    if (!galleryMain) return;

    let startX = 0;
    let startY = 0;

    galleryMain.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });

    galleryMain.addEventListener('touchend', function(e) {
        if (!startX || !startY) return;

        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;

        const diffX = startX - endX;
        const diffY = startY - endY;

        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            if (diffX > 0) {
                navigateGallery(1);
            } else {
                navigateGallery(-1);
            }
        }

        startX = 0;
        startY = 0;
    }, { passive: true });
}

// ============================================
// SOCIAL LOGIN (Google OAuth temporarily disabled)
// ============================================
function loginWithGoogle() {
    window.location.href = 'https://ishop-cms-production.up.railway.app/api/connect/google';
}

function handleGoogleCallback() {
    // Not used — Google OAuth is handled by Strapi via /connect/google
    return;
}

function loginWithFacebook() {
    alert('🚀 Facebook Login Coming Soon!');
}

function loginWithTwitter() {
    alert('🚀 Twitter Login Coming Soon!');
}

// ============================================
// SIGNUP & LOGIN HANDLERS — Real Strapi
// ============================================
async function handleSignup(e) {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const feedback = document.getElementById('signupFeedback');

    if (!fullName || !email || !password) {
        feedback.className = 'error';
        feedback.innerHTML = '⚠️ Please fill in all required fields.';
        return;
    }
    if (password !== confirmPassword) {
        feedback.className = 'error';
        feedback.innerHTML = '⚠️ Passwords do not match!';
        return;
    }
    if (password.length < 6) {
        feedback.className = 'error';
        feedback.innerHTML = '⚠️ Password must be at least 6 characters.';
        return;
    }

    feedback.className = '';
    feedback.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating your account…';

    try {
        const res = await fetch(`${STRAPI_AUTH_BASE}/api/auth/local/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: email,
                email: email,
                password: password
            })
        });

        const data = await res.json();

        if (!res.ok || !data.jwt) {
            const msg = data?.error?.message || 'Signup failed. Please try again.';
            feedback.className = 'error';
            feedback.innerHTML = `❌ ${msg}`;
            return;
        }

        saveAuthSession({
            user: {
                id: data.user.id,
                documentId: data.user.documentId,
                username: data.user.username,
                email: data.user.email,
                fullName: fullName,
                phone: phone || '',
                address: '',
                provider: 'local'
            },
            jwt: data.jwt,
            refreshToken: data.refreshToken
        });

        if (phone) {
            try {
                await fetch(`${STRAPI_AUTH_BASE}/api/users/${data.user.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${data.jwt}`
                    },
                    body: JSON.stringify({ phone: phone })
                });
            } catch (profileErr) {
                console.warn('Could not save phone field yet:', profileErr);
            }
        }

        updateAuthUI();

        feedback.className = 'success';
        feedback.innerHTML = `✅ Account created! Welcome, ${fullName}! 🎉`;

        setTimeout(() => {
            window.location.href = 'profile.html';
        }, 1200);

    } catch (err) {
        console.error('Signup error:', err);
        feedback.className = 'error';
        feedback.innerHTML = '❌ Could not connect to the server. Please try again.';
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const feedback = document.getElementById('loginFeedback');

    if (!email || !password) {
        feedback.className = 'error';
        feedback.innerHTML = '⚠️ Please enter both email and password.';
        return;
    }

    feedback.className = '';
    feedback.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…';

    try {
        const res = await fetch(`${STRAPI_AUTH_BASE}/api/auth/local`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: email,
                password: password
            })
        });

        const data = await res.json();

        if (!res.ok || !data.jwt) {
            feedback.className = 'error';
            feedback.innerHTML = '❌ Invalid email or password.';
            return;
        }

        saveAuthSession({
            user: {
                id: data.user.id,
                documentId: data.user.documentId,
                username: data.user.username,
                email: data.user.email,
                fullName: data.user.fullName || data.user.username || '',
                phone: data.user.phone || '',
                address: data.user.address || '',
                provider: data.user.provider || 'local'
            },
            jwt: data.jwt,
            refreshToken: data.refreshToken
        });

        updateAuthUI();

        // Check if this user is a vendor and redirect accordingly
        let redirectUrl = 'profile.html';
        try {
            const vendorCheckRes = await fetch(`${STRAPI_AUTH_BASE}/api/vendors?filters[user][id][$eq]=${data.user.id}`, {
                headers: { 'Authorization': `Bearer ${data.jwt}` },
            });
            const vendorCheckData = await vendorCheckRes.json();
            if (vendorCheckData.data && vendorCheckData.data.length > 0) {
                // User is a vendor — send them to the vendor dashboard
                redirectUrl = 'vendor-dashboard.html';
                // Also mark in localStorage for faster lookups
                const user = JSON.parse(localStorage.getItem('iShopUser') || '{}');
                user.isVendor = true;
                user.vendorId = vendorCheckData.data[0].documentId || vendorCheckData.data[0].id;
                user.vendorStatus = vendorCheckData.data[0].approvalStatus;
                localStorage.setItem('iShopUser', JSON.stringify(user));
            }
        } catch (vendorCheckErr) {
            console.warn('Vendor check failed during login:', vendorCheckErr);
        }

        feedback.className = 'success';
        feedback.innerHTML = `✅ Welcome back!`;

        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 800);

    } catch (err) {
        console.error('Login error:', err);
        feedback.className = 'error';
        feedback.innerHTML = '❌ Could not connect to the server. Please try again.';
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();

    const user = getCurrentUser();
    const jwt = getJwt();
    if (!user || !jwt) {
        window.location.href = 'login.html';
        return;
    }

    const fullName = document.getElementById('profileFullName').value.trim();
    const phone = document.getElementById('profilePhone').value.trim();
    const address = document.getElementById('profileAddress').value.trim();
    const feedback = document.getElementById('profileFeedback');

    feedback.className = '';
    feedback.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

    try {
        const res = await fetch(`${STRAPI_AUTH_BASE}/api/users/${user.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`
            },
            body: JSON.stringify({ phone, address })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData?.error?.message || 'Update failed');
        }

        const updatedUser = {
            ...user,
            fullName: fullName || user.fullName || '',
            phone: phone || user.phone || '',
            address: address || user.address || ''
        };
        saveAuthSession({ user: updatedUser });

        const nameEl = document.getElementById('profileName');
        if (nameEl) nameEl.textContent = `Welcome, ${updatedUser.fullName || 'Friend'}!`;
        updateAuthUI();

        feedback.className = 'success';
        feedback.innerHTML = '✅ Profile updated successfully!';

        setTimeout(() => { feedback.innerHTML = ''; feedback.className = ''; }, 3000);

    } catch (err) {
        console.error('Profile update error:', err);
        feedback.className = 'error';
        feedback.innerHTML = '❌ Could not save changes. Please try again.';
    }
}
// ============================================
// CHANGE PASSWORD
// ============================================
async function handleChangePassword(e) {
    e.preventDefault();

    const user = getCurrentUser();
    const jwt = getJwt();
    if (!user || !jwt) {
        window.location.href = 'login.html';
        return;
    }

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    const feedback = document.getElementById('passwordFeedback');

    // Validation
    if (newPassword !== confirmNewPassword) {
        feedback.className = 'error';
        feedback.style.color = '#721c24';
        feedback.style.background = '#f8d7da';
        feedback.style.padding = '0.8rem';
        feedback.style.borderRadius = '8px';
        feedback.innerHTML = '⚠️ New passwords do not match.';
        return;
    }
    if (newPassword.length < 6) {
        feedback.className = 'error';
        feedback.style.color = '#721c24';
        feedback.style.background = '#f8d7da';
        feedback.style.padding = '0.8rem';
        feedback.style.borderRadius = '8px';
        feedback.innerHTML = '⚠️ New password must be at least 6 characters.';
        return;
    }

    feedback.style.color = '';
    feedback.style.background = '';
    feedback.style.padding = '';
    feedback.className = '';
    feedback.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating password…';

    try {
        // Strapi's change-password endpoint
        const res = await fetch(`${STRAPI_AUTH_BASE}/api/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`,
            },
            body: JSON.stringify({
                currentPassword,
                password: newPassword,
                passwordConfirmation: confirmNewPassword,
            }),
        });

        const data = await res.json();

        if (!res.ok || !data.jwt) {
            const msg = data?.error?.message || 'Could not update password.';
            feedback.className = 'error';
            feedback.style.color = '#721c24';
            feedback.style.background = '#f8d7da';
            feedback.style.padding = '0.8rem';
            feedback.style.borderRadius = '8px';
            feedback.innerHTML = `❌ ${msg}`;
            return;
        }

        // Update the JWT in storage (Strapi returns a new one)
        if (data.jwt) {
            localStorage.setItem('iShopJwt', data.jwt);
        }

        feedback.className = 'success';
        feedback.style.color = '#155724';
        feedback.style.background = '#d4edda';
        feedback.style.padding = '0.8rem';
        feedback.style.borderRadius = '8px';
        feedback.innerHTML = '✅ Password updated successfully!';

        // Clear fields
        document.getElementById('changePasswordForm').reset();

        setTimeout(() => { feedback.innerHTML = ''; feedback.className = ''; feedback.style.padding = ''; feedback.style.background = ''; feedback.style.color = ''; }, 4000);
    } catch (err) {
        console.error('Change password error:', err);
        feedback.className = 'error';
        feedback.style.color = '#721c24';
        feedback.style.background = '#f8d7da';
        feedback.style.padding = '0.8rem';
        feedback.style.borderRadius = '8px';
        feedback.innerHTML = '❌ Could not connect. Please try again.';
    }
}

// ============================================
// DELIVERY ADDRESS — load, save, display
// ============================================
function loadAddressForm() {
    const user = getCurrentUser();
    if (!user) return;

    const nameField = document.getElementById('addressFullName');
    const phoneField = document.getElementById('addressPhone');
    const lineField = document.getElementById('addressLine');

    if (nameField && !nameField.value) nameField.value = user.fullName || user.username || '';
    if (phoneField && !phoneField.value) phoneField.value = user.phone || '';
    if (lineField && !lineField.value) lineField.value = user.address || '';

    renderSavedAddress(user);
}

function renderSavedAddress(user) {
    const container = document.getElementById('savedAddressDisplay');
    if (!container) return;

    if (!user.address && !user.phone) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <h3 style="font-size: 1rem; font-weight: 700; color: #0d1b2a; margin-bottom: 0.75rem;">Current Saved Address</h3>
        <div style="border: 1px solid #f0f0f0; border-radius: 12px; padding: 1.25rem; background: #f8fafc;">
            <div style="font-weight: 700; color: #0d1b2a; margin-bottom: 0.4rem;">${user.fullName || user.username || 'You'}</div>
            <div style="color: #666; font-size: 0.9rem; margin-bottom: 0.3rem;">
                <i class="fas fa-phone" style="color: #f9c74f; width: 16px;"></i> ${user.phone || 'No phone on file'}
            </div>
            <div style="color: #666; font-size: 0.9rem;">
                <i class="fas fa-map-marker-alt" style="color: #f9c74f; width: 16px;"></i> ${user.address || 'No address on file'}
            </div>
        </div>
    `;
}

async function handleAddressSave(e) {
    e.preventDefault();

    const user = getCurrentUser();
    const jwt = getJwt();
    if (!user || !jwt) {
        window.location.href = 'login.html';
        return;
    }

    const fullName = document.getElementById('addressFullName').value.trim();
    const phone = document.getElementById('addressPhone').value.trim();
    const address = document.getElementById('addressLine').value.trim();
    const feedback = document.getElementById('addressFeedback');

    feedback.className = '';
    feedback.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving address…';

    try {
        const res = await fetch(`${STRAPI_AUTH_BASE}/api/users/${user.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`,
            },
            body: JSON.stringify({ phone, address }),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData?.error?.message || 'Save failed');
        }

        // Update local user
        const updatedUser = { ...user, fullName, phone, address };
        saveAuthSession({ user: updatedUser });

        // Re-render
        renderSavedAddress(updatedUser);

        feedback.className = 'success';
        feedback.style.color = '#155724';
        feedback.style.background = '#d4edda';
        feedback.style.padding = '0.8rem';
        feedback.style.borderRadius = '8px';
        feedback.innerHTML = '✅ Address saved!';

        setTimeout(() => { feedback.innerHTML = ''; feedback.className = ''; feedback.style.padding = ''; feedback.style.background = ''; feedback.style.color = ''; }, 3000);

    } catch (err) {
        console.error('Address save error:', err);
        feedback.className = 'error';
        feedback.style.color = '#721c24';
        feedback.style.background = '#f8d7da';
        feedback.style.padding = '0.8rem';
        feedback.style.borderRadius = '8px';
        feedback.innerHTML = '❌ Could not save. Please try again.';
    }
}

// ============================================
// MY ORDERS — Fetch and render user's orders
// ============================================
async function loadMyOrders() {
    const container = document.getElementById('section-orders');
    if (!container) return;

    const user = getCurrentUser();
    const jwt = getJwt();

    if (!user || !jwt) {
        container.innerHTML = `
            <h2>My Orders</h2>
            <p class="account-subtitle">Please log in to view your orders.</p>
            <a href="login.html" class="btn-auth" style="display:inline-flex;width:auto;padding:0.7rem 1.5rem;">Login</a>
        `;
        return;
    }

    container.innerHTML = `
        <h2>My Orders</h2>
        <p class="account-subtitle">Loading your orders…</p>
        <div style="text-align:center;padding:2rem;">
            <i class="fas fa-spinner fa-spin" style="font-size:1.5rem;color:#f9c74f;"></i>
        </div>
    `;

    try {
        const res = await fetch(`${ORDERS_API_BASE}/api/orders/my`, {
            headers: { Authorization: `Bearer ${jwt}` },
        });

        if (!res.ok) {
            if (res.status === 401) {
                container.innerHTML = `
                    <h2>My Orders</h2>
                    <p class="account-subtitle">Your session has expired.</p>
                    <a href="login.html" class="btn-auth" style="display:inline-flex;width:auto;padding:0.7rem 1.5rem;">Login again</a>
                `;
                return;
            }
            throw new Error('Failed to load orders');
        }

        const data = await res.json();
        const orders = data.orders || [];

        if (orders.length === 0) {
            container.innerHTML = `
                <h2>My Orders</h2>
                <p class="account-subtitle">Track your recent purchases.</p>
                <div class="empty-state-small">
                    <i class="fas fa-box-open"></i>
                    <p>No orders yet. Start shopping to see your orders here.</p>
                    <a href="shop.html" class="btn-auth" style="display:inline-flex;width:auto;padding:0.7rem 1.5rem;">Shop Now</a>
                </div>
            `;
            return;
        }

        let html = `
            <h2>My Orders</h2>
            <p class="account-subtitle">${orders.length} order${orders.length > 1 ? 's' : ''} found</p>
        `;

        orders.forEach((order) => {
            const date = new Date(order.createdAt).toLocaleDateString('en-NG', {
                year: 'numeric', month: 'short', day: 'numeric',
            });
            const statusClass = order.orderStatus === 'paid' ? 'background:#d4edda;color:#155724;' :
                               order.orderStatus === 'shipped' ? 'background:#cce5ff;color:#004085;' :
                               order.orderStatus === 'cancelled' ? 'background:#f8d7da;color:#721c24;' :
                               'background:#fff3cd;color:#856404;';

            const itemsHtml = order.items.map(item => `
                <div style="display:flex;justify-content:space-between;padding:0.4rem 0;font-size:0.85rem;color:#555;">
                    <span>${item.name} × ${item.quantity}</span>
                    <span>₦${(item.price * item.quantity).toLocaleString()}</span>
                </div>
            `).join('');

            const hasDigital = order.items.some(i => i.type === 'digital');
            const downloadBtn = (order.orderStatus === 'paid' && hasDigital) ? `
                <a href="order-confirmed.html?reference=${order.reference}" 
                   style="display:inline-flex;align-items:center;gap:0.4rem;margin-top:0.6rem;padding:0.5rem 1rem;background:#f9c74f;color:#0d1b2a;border-radius:8px;font-weight:600;font-size:0.85rem;text-decoration:none;">
                    <i class="fas fa-download"></i> Download Files
                </a>
            ` : '';

            html += `
                <div style="border:1px solid #f0f0f0;border-radius:12px;padding:1.25rem;margin-bottom:1rem;background:#fff;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">
                        <div>
                            <div style="font-weight:700;color:#0d1b2a;font-size:0.95rem;">${order.reference}</div>
                            <div style="font-size:0.8rem;color:#888;margin-top:0.15rem;">${date}</div>
                        </div>
                        <span style="${statusClass}padding:0.3rem 0.8rem;border-radius:20px;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${order.orderStatus}</span>
                    </div>
                    <div style="border-top:1px solid #f0f0f0;padding-top:0.6rem;">
                        ${itemsHtml}
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid #f0f0f0;flex-wrap:wrap;gap:0.5rem;">
                        <span style="font-weight:700;color:#0d1b2a;">Total: ₦${Number(order.amount).toLocaleString()}</span>
                        ${downloadBtn}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (err) {
        console.error('loadMyOrders error:', err);
        container.innerHTML = `
            <h2>My Orders</h2>
            <p class="account-subtitle">Could not load your orders. Please try again.</p>
            <button onclick="loadMyOrders()" class="btn-auth" style="display:inline-flex;width:auto;padding:0.7rem 1.5rem;">Retry</button>
        `;
    }
}

// ============================================
// ACCOUNT DASHBOARD
// ============================================
function switchAccountSection(section) {
    document.querySelectorAll('.account-nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });
    document.querySelectorAll('.account-section').forEach(sec => {
        sec.classList.toggle('active', sec.id === 'section-' + section);
    });

    if (section === 'orders') loadMyOrders();
    if (section === 'addresses') loadAddressForm();
    if (section === 'security') {
        const pf = document.getElementById('passwordFeedback');
        if (pf) { pf.innerHTML = ''; pf.className = ''; }

        // Check if user signed up with Google
        const user = getCurrentUser();
        const form = document.getElementById('changePasswordForm');

        if (user && user.provider === 'google') {
            if (form) form.style.display = 'none';
            if (pf) {
                pf.style.color = '#856404';
                pf.style.background = '#fff3cd';
                pf.style.padding = '1rem';
                pf.style.borderRadius = '8px';
                pf.innerHTML = 'ℹ️ You signed up with Google, so you don\'t have a password on file. To add one, log out and use <strong>Forgot Password</strong> on the login page.';
            }
        } else {
            if (form) form.style.display = 'block';
        }
    }
}

function handleMyOrdersClick(event) {
    // If we're already on profile.html, switch to the orders section without navigating
    if (window.location.pathname.endsWith('profile.html')) {
        event.preventDefault();
        switchAccountSection('orders');
        // Update URL hash without reload
        history.pushState(null, '', 'profile.html#orders');
    }
    // Otherwise, let the browser navigate to profile.html#orders normally
}

function loadProfilePage() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const displayName = user.fullName || user.username || 'Friend';
    const email = user.email || '—';
    const phone = user.phone || '—';

    const nameEl = document.getElementById('profileName');
    const emailEl = document.getElementById('profileEmail');
    const phoneDisplayEl = document.getElementById('profilePhoneDisplay');
    if (nameEl) nameEl.textContent = `Welcome, ${displayName}!`;
    if (emailEl) emailEl.textContent = email;
    if (phoneDisplayEl) phoneDisplayEl.textContent = phone;

    const avatar = document.getElementById('profileAvatar');
    if (avatar) {
        avatar.innerHTML = `<i class="fas fa-user"></i>`;
    }

    const fullNameField = document.getElementById('profileFullName');
    const emailField = document.getElementById('profileEmailField');
    const phoneField = document.getElementById('profilePhone');
    const addressField = document.getElementById('profileAddress');
    if (fullNameField) fullNameField.value = user.fullName || user.username || '';
    if (emailField) emailField.value = user.email || '';
    if (phoneField) phoneField.value = user.phone || '';
    if (addressField) addressField.value = user.address || '';

    const cart = JSON.parse(localStorage.getItem('iShopCart')) || [];
    const wishlistData = JSON.parse(localStorage.getItem('iShopWishlist')) || [];
    const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

    const statCart = document.getElementById('statCart');
    const statWishlist = document.getElementById('statWishlist');
    const overviewCart = document.getElementById('overviewCart');
    const overviewWishlist = document.getElementById('overviewWishlist');
    if (statCart) statCart.textContent = cartCount;
    if (statWishlist) statWishlist.textContent = wishlistData.length;
    if (overviewCart) overviewCart.textContent = cartCount;
    if (overviewWishlist) overviewWishlist.textContent = wishlistData.length;
}

// ============================================
// HELP DROPDOWN TOGGLE
// ============================================
document.addEventListener('click', function (e) {
    const helpLink = e.target.closest('.help-dropdown-wrap > a');
    const helpWrap = document.querySelector('.help-dropdown-wrap');

    if (!helpWrap) return;

    if (helpLink) {
        e.preventDefault();
        e.stopPropagation();
        helpWrap.classList.toggle('open');
        return;
    }

    if (e.target.closest('.help-dropdown-panel')) {
        return;
    }

    helpWrap.classList.remove('open');
});

window.addEventListener('scroll', function () {
    const helpWrap = document.querySelector('.help-dropdown-wrap');
    if (helpWrap && helpWrap.classList.contains('open')) {
        helpWrap.classList.remove('open');
    }
}, { passive: true });

// ============================================
// INITIALIZE PAGE
// ============================================
function initializeApp() {
    // Detect admin page first
    const page = window.location.pathname.split('/').pop().split('?')[0];

    // On the admin page, only run admin init — skip all site-wide setup
    if (page === 'admin.html') {
        console.log('🔍 Admin page — running admin init only');
        if (typeof initAdminPanel === 'function') initAdminPanel();
        return;
    }

    injectHeaderAndFooter();
    initHeroCarousel();

    console.log('🔍 Current page:', page);

    updateAuthUI();
    updateCartCount();
    startCountdown();

    const searchInput = document.getElementById('mainSearch');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') performSearch();
        });
    }

    const signupForm = document.getElementById('signupForm');
    if (signupForm) signupForm.addEventListener('submit', handleSignup);

    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const profileForm = document.getElementById('profileForm');
    if (profileForm) profileForm.addEventListener('submit', handleProfileUpdate);

    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) changePasswordForm.addEventListener('submit', handleChangePassword);

    const addressForm = document.getElementById('addressForm');
    if (addressForm) addressForm.addEventListener('submit', handleAddressSave);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) logoutUser();
        });
    }

    if (page === 'index.html' || page === '') {
        renderHomepage();
    } else if (page === 'shop.html') {
        const urlParams = new URLSearchParams(window.location.search);
        const filter = urlParams.get('filter') || 'all';
        const search = urlParams.get('q') || urlParams.get('search') || '';
        const subType = urlParams.get('subtype') || '';

        if (search) {
            renderShopPage('all', search);
        } else {
            renderShopPage(filter, '', subType);
        }
        setupFilters();
    } else if (page === 'digital-products.html') {
        renderCategory('digital');
        setupSubcategoryButtons('digital');
    } else if (page === 'product-detail.html') {
        renderProductDetail();
    } else if (page === 'cart.html') {
        renderCart();
    } else if (page === 'checkout.html') {
        populateStateDropdowns();
        renderCheckoutSummary();
        setupCheckoutForm();
    } else if (page === 'wishlist.html') {
        updateWishlistUI();
    } else if (page === 'profile.html') {
        loadProfilePage();
        const hash = window.location.hash.replace('#', '');
        const validSections = ['overview', 'details', 'orders', 'addresses', 'security'];
        const sectionToOpen = validSections.includes(hash) ? hash : 'overview';
        switchAccountSection(sectionToOpen);
        loadMyOrders();
    } else if (page === 'electronics.html' || page === 'fashion.html' || page === 'beauty.html' || page === 'home.html' || page === 'traditional.html') {
        const category = page.replace('.html', '');
        const urlParams = new URLSearchParams(window.location.search);
        const subType = urlParams.get('subtype') || '';
        renderCategory(category, subType);
        setupSubcategoryButtons(category);
    } else if (page === 'vendor-orders.html') {
        initVendorOrdersPage();
    } else if (page === 'vendor-products.html') {
        initVendorProductsPage();
    } else if (page === 'vendor-dashboard.html') {
        initVendorDashboard();
    } else if (page === 'vendor-earnings.html') {
        initVendorEarningsPage();
    } else if (page === 'vendor-apply.html') {
        initVendorApplyPage();
    } else if (page === 'vendor-product-form.html') {
        initProductFormPage();
    }
}

// ============================================
// ROBUST INIT — runs even if extensions break DOMContentLoaded
// ============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    console.log('🚀 DOM already ready — running init immediately');
    initializeApp();
}
/* ============================================ */
/* TRACK ORDER PAGE — FRONTEND LOGIC */
/* ============================================ */

const TRACK_API_BASE = 'https://ishop-payments-production.up.railway.app';

// Format a date nicely
function iShopFmtDate(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('en-NG', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }) + ' · ' + d.toLocaleTimeString('en-NG', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch { return ''; }
}

// Title-case a slug: "lagos" → "Lagos", "ikeja" → "Ikeja"
function iShopTitle(s) {
    if (!s) return '';
    return String(s).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Status labels & badge classes
const TRACK_STATUS_MAP = {
    'pending':    { label: 'Pending',    class: 'pending',    icon: 'clock' },
    'paid':       { label: 'Confirmed',  class: 'paid',       icon: 'check-circle' },
    'processing': { label: 'Processing', class: 'processing', icon: 'spinner' },
    'shipped':    { label: 'Shipped',    class: 'shipped',    icon: 'truck' },
    'delivered':  { label: 'Delivered',  class: 'delivered',  icon: 'check-double' },
    'cancelled':  { label: 'Cancelled',  class: 'cancelled',  icon: 'times-circle' }
};

// Main tracking function
async function iShopTrackOrder() {
    const input = document.getElementById('trackReferenceInput');
    const btn = document.getElementById('trackBtn');
    const result = document.getElementById('trackResult');
    if (!input || !btn || !result) return;

    const ref = input.value.trim();

    if (!ref) {
        result.innerHTML = `
            <div class="track-error">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <strong>Reference required</strong>
                    Please enter your order reference to track your order.
                </div>
            </div>
        `;
        return;
    }

    // Loading state
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Searching…</span>';
    result.innerHTML = `
        <div class="track-loading">
            <i class="fas fa-spinner fa-spin"></i>
            Looking up your order…
        </div>
    `;

    try {
        const res = await fetch(`${TRACK_API_BASE}/api/orders/track/${encodeURIComponent(ref)}`);
        const data = await res.json();

        if (!res.ok || !data.status || !data.order) {
            throw new Error(data.error || 'Order not found. Please check your reference.');
        }

        renderTrackResult(data.order);

    } catch (err) {
        result.innerHTML = `
            <div class="track-error">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <strong>Order not found</strong>
                    ${err.message}
                    <p style="margin-top:0.6rem;font-size:0.85rem;color:#6b7280;">
                        If you believe this is an error, please
                        <a href="https://wa.me/2348158339217?text=Hello%20iShop%2C%20I%20need%20help%20with%20order%20${encodeURIComponent(ref)}"
                           target="_blank" style="color:#25D366;font-weight:700;">chat with us on WhatsApp</a>.
                    </p>
                </div>
            </div>
        `;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-search"></i><span>Track</span>';
    }
}

// Render the tracked order into a beautiful card
function renderTrackResult(order) {
    const result = document.getElementById('trackResult');
    if (!result) return;

    const status = (order.status || 'pending').toLowerCase();
    const statusMeta = TRACK_STATUS_MAP[status] || TRACK_STATUS_MAP.pending;

    // Build the timeline steps
    // Order: Placed → Confirmed → Processing → Shipped → Delivered
    const steps = [
        {
            key: 'placed',
            title: 'Order Placed',
            time: order.createdAt,
            desc: 'We received your order.',
            done: true // always done
        },
        {
            key: 'paid',
            title: 'Payment Confirmed',
            time: order.paidAt,
            desc: status === 'cancelled' ? 'Payment was not completed.' : 'Payment received — thank you!',
            done: ['paid', 'processing', 'shipped', 'delivered'].includes(status),
            active: status === 'paid'
        },
        {
            key: 'processing',
            title: 'Processing',
            time: null,
            desc: 'Your items are being packed and prepared for dispatch.',
            done: ['processing', 'shipped', 'delivered'].includes(status),
            active: status === 'processing'
        },
        {
            key: 'shipped',
            title: 'Shipped',
            time: order.shippedAt,
            desc: 'Your order is on the way.',
            done: ['shipped', 'delivered'].includes(status),
            active: status === 'shipped'
        },
        {
            key: 'delivered',
            title: 'Delivered',
            time: order.deliveredAt,
            desc: 'Enjoy your purchase! 🎉',
            done: status === 'delivered',
            active: status === 'delivered'
        }
    ];

    // Build timeline HTML
    const timelineHTML = steps.map(step => {
        let cls = 'pending';
        if (step.done) cls = 'completed';
        else if (step.active) cls = 'active';

        const icon = cls === 'completed' ? 'check'
                   : cls === 'active' ? 'spinner fa-spin'
                   : 'circle';

        const timeHTML = step.time
            ? `<p class="track-step-time">${iShopFmtDate(step.time)}</p>`
            : '';

        return `
            <div class="track-step ${cls}">
                <span class="track-step-dot"><i class="fas fa-${icon}"></i></span>
                <div class="track-step-body">
                    <p class="track-step-title">${step.title}</p>
                    ${timeHTML}
                    <p class="track-step-desc">${step.desc}</p>
                </div>
            </div>
        `;
    }).join('');

    // Items HTML
    const items = order.items || [];
    const itemsHTML = items.map(item => `
        <div class="track-item-row">
            <div class="item-name">
                ${item.name}
                <div class="item-qty">Qty: ${item.quantity} × ₦${Number(item.price).toLocaleString()}</div>
            </div>
            <div class="item-price">₦${(item.price * item.quantity).toLocaleString()}</div>
        </div>
    `).join('');

    // Subtotal + delivery + total
    const subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const deliveryFee = Number(order.deliveryFee) || 0;
    const total = Number(order.amount) || (subtotal + deliveryFee);

    // Shipping info
    const locationParts = [];
    if (order.shippingLga) locationParts.push(iShopTitle(order.shippingLga));
    if (order.shippingState) locationParts.push(iShopTitle(order.shippingState));
    const locationLine = locationParts.join(', ');

    // WhatsApp prefilled message
    const waMsg = `Hello iShop, I need help with order ${order.reference}.`;
    const waLink = `https://wa.me/2348158339217?text=${encodeURIComponent(waMsg)}`;

    // Build final HTML
    result.innerHTML = `
        <div class="track-card">
            <div class="track-card-header">
                <div class="track-card-ref-label">Order Reference</div>
                <div class="track-card-ref-value">${order.reference}</div>
                <div class="track-card-ref-date">Placed on ${iShopFmtDate(order.createdAt)}</div>
                <div class="track-status-pill ${statusMeta.class}">
                    <i class="fas fa-${statusMeta.icon}${status === 'processing' ? ' fa-spin' : ''}"></i>
                    ${statusMeta.label}
                </div>
            </div>

            <div class="track-timeline">
                <div class="track-timeline-inner">
                    ${timelineHTML}
                </div>
            </div>

            <div class="track-info-grid">
                <div class="track-info-block">
                    <h4><i class="fas fa-map-marker-alt" style="color:#f9c74f;"></i> Delivering To</h4>
                    <p><strong>${order.shippingName || 'You'}</strong></p>
                    ${order.shippingPhone ? `<p><i class="fas fa-phone" style="color:#999;width:14px;"></i> ${order.shippingPhone}</p>` : ''}
                    ${locationLine ? `<p>${locationLine}</p>` : ''}
                    <p>${order.address || ''}</p>
                </div>
                <div class="track-info-block">
                    <h4><i class="fas fa-receipt" style="color:#f9c74f;"></i> Order Summary</h4>
                    <p>${items.length} item${items.length > 1 ? 's' : ''}</p>
                    <p>Subtotal: <strong>₦${subtotal.toLocaleString()}</strong></p>
                    ${deliveryFee > 0 ? `<p>Delivery: <strong>₦${deliveryFee.toLocaleString()}</strong></p>` : `<p>Delivery: <strong style="color:#4CAF50;">Free</strong></p>`}
                    <p style="margin-top:0.4rem;font-size:1rem;">Total: <strong>₦${total.toLocaleString()}</strong></p>
                </div>
            </div>

            <div class="track-items">
                <h4><i class="fas fa-shopping-bag" style="color:#f9c74f;"></i> Items</h4>
                ${itemsHTML || '<p style="color:#999;">No items found.</p>'}
            </div>

            <div class="track-actions">
                <a href="${waLink}" target="_blank" class="track-action-btn whatsapp">
                    <i class="fab fa-whatsapp"></i> Ask About This Order
                </a>
                <a href="profile.html#orders" class="track-action-btn orders">
                    <i class="fas fa-box"></i> View My Orders
                </a>
                <a href="contact.html" class="track-action-btn help">
                    <i class="fas fa-life-ring"></i> Get Help
                </a>
            </div>
        </div>
    `;
}

// Auto-track on load if URL has ?ref= or ?reference=
document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('reference');
    if (ref) {
        const input = document.getElementById('trackReferenceInput');
        if (input) {
            input.value = ref;
            // Small delay so the header/footer render first
            setTimeout(() => iShopTrackOrder(), 300);
        }
    }

    // Enter key submits
    const input = document.getElementById('trackReferenceInput');
    if (input) {
        input.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                iShopTrackOrder();
            }
        });
    }
});
/* ============================================ */
/* VENDOR APPLY PAGE (vendor-apply.html) */
/* ============================================ */

let vendorCurrentStep = 1;
const VENDOR_TOTAL_STEPS = 3;

// Initialize when page loads
function initVendorApplyPage() {
    const form = document.getElementById('vendorApplyForm');
    if (!form) return;

    // Populate state dropdown from shipping.js
    const stateSelect = document.getElementById('state');
    if (stateSelect && typeof getAllStates === 'function') {
        const states = getAllStates();
        stateSelect.innerHTML = '<option value="">Select your state</option>' +
            states.map(s => `<option value="${s.slug}">${s.name}</option>`).join('');
    }

    // State change -> populate LGA
    if (stateSelect) {
        stateSelect.addEventListener('change', function () {
            const lgaSelect = document.getElementById('lga');
            if (!lgaSelect) return;

            if (!this.value) {
                lgaSelect.innerHTML = '<option value="">Select state first</option>';
                lgaSelect.disabled = true;
                return;
            }

            const lgas = getLGAsForState(this.value);
            lgaSelect.innerHTML = '<option value="">Select LGA</option>' +
                lgas.map(l => `<option value="${l.slug}">${l.name}</option>`).join('');
            lgaSelect.disabled = false;
        });
    }

    // Next/Back buttons
    const nextBtn = document.getElementById('vendorNextBtn');
    const backBtn = document.getElementById('vendorBackBtn');

    if (nextBtn) nextBtn.addEventListener('click', vendorNextStep);
    if (backBtn) backBtn.addEventListener('click', vendorPrevStep);

    // Form submit
    form.addEventListener('submit', handleVendorApplySubmit);

    // Auto-format account number (digits only, max 10)
    const accountNum = document.getElementById('bankAccountNumber');
    if (accountNum) {
        accountNum.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, '').slice(0, 10);
        });
    }

    console.log('✅ Vendor apply page initialized');
}

// Validate current step
function validateVendorStep(step) {
    const currentStepEl = document.querySelector(`.vendor-apply-step[data-step="${step}"]`);
    if (!currentStepEl) return { valid: true };

    const fields = currentStepEl.querySelectorAll('input, select, textarea');
    let firstInvalid = null;

    for (const field of fields) {
        if (field.type === 'checkbox' && field.name === 'categories') continue; // skip category checkboxes
        if (!field.required) continue;

        let value = field.value.trim();
        if (!value) {
            firstInvalid = field;
            break;
        }

        // Email
        if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            firstInvalid = field;
            break;
        }

        // Account number (10 digits)
        if (field.id === 'bankAccountNumber' && !/^\d{10}$/.test(value)) {
            firstInvalid = field;
            break;
        }
    }

    if (firstInvalid) {
        firstInvalid.focus();
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return {
            valid: false,
            message: `Please fill in: ${firstInvalid.previousElementSibling?.textContent?.replace('*', '').trim() || 'this field'}`
        };
    }

    // Step 3 specific checks
    if (step === 3) {
        const selectedCategories = document.querySelectorAll('input[name="categories"]:checked');
        if (selectedCategories.length === 0) {
            return { valid: false, message: 'Please select at least one product category.' };
        }

        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        if (password.length < 6) {
            return { valid: false, message: 'Password must be at least 6 characters.' };
        }
        if (password !== confirmPassword) {
            return { valid: false, message: 'Passwords do not match.' };
        }

        const agree = document.getElementById('agreeTerms');
        if (!agree.checked) {
            return { valid: false, message: 'Please agree to the Terms of Service to continue.' };
        }
    }

    return { valid: true };
}

// Show step
function vendorShowStep(step) {
    // Hide all steps
    document.querySelectorAll('.vendor-apply-step').forEach(el => {
        el.classList.remove('active');
    });

    // Show current
    const target = document.querySelector(`.vendor-apply-step[data-step="${step}"]`);
    if (target) target.classList.add('active');

    // Update progress bar
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        progressBar.style.width = `${(step / VENDOR_TOTAL_STEPS) * 100}%`;
    }

    // Update step indicators
    document.querySelectorAll('.vendor-progress-step').forEach(el => {
        const stepNum = parseInt(el.dataset.step, 10);
        el.classList.remove('active', 'completed');
        if (stepNum < step) el.classList.add('completed');
        if (stepNum === step) el.classList.add('active');
    });

    // Update buttons
    const backBtn = document.getElementById('vendorBackBtn');
    const nextBtn = document.getElementById('vendorNextBtn');
    const submitBtn = document.getElementById('vendorSubmitBtn');

    if (backBtn) backBtn.style.display = step > 1 ? 'inline-flex' : 'none';
    if (nextBtn) nextBtn.style.display = step < VENDOR_TOTAL_STEPS ? 'inline-flex' : 'none';
    if (submitBtn) submitBtn.style.display = step === VENDOR_TOTAL_STEPS ? 'inline-flex' : 'none';

    // Clear feedback
    const feedback = document.getElementById('vendorApplyFeedback');
    if (feedback) {
        feedback.innerHTML = '';
        feedback.className = '';
    }

    // Scroll to top of form
    document.getElementById('vendorApplyForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Next
function vendorNextStep() {
    const result = validateVendorStep(vendorCurrentStep);
    if (!result.valid) {
        showVendorFeedback(result.message, 'error');
        return;
    }
    if (vendorCurrentStep < VENDOR_TOTAL_STEPS) {
        vendorCurrentStep++;
        vendorShowStep(vendorCurrentStep);
    }
}

// Back
function vendorPrevStep() {
    if (vendorCurrentStep > 1) {
        vendorCurrentStep--;
        vendorShowStep(vendorCurrentStep);
    }
}

// Show feedback
function showVendorFeedback(message, type = 'error') {
    const feedback = document.getElementById('vendorApplyFeedback');
    if (!feedback) return;

    const icon = type === 'error' ? '⚠️' : '✅';
    feedback.innerHTML = `<div style="display:flex;align-items:flex-start;gap:0.6rem;">
        <span style="font-size:1.1rem;">${icon}</span>
        <span>${message}</span>
    </div>`;
    feedback.className = type === 'error' ? 'error' : 'success';

    // Mobile fix — scroll feedback into view so keyboard doesn't hide it
    setTimeout(() => {
        feedback.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
}

// Submit
async function handleVendorApplySubmit(e) {
    e.preventDefault();

    // Validate step 3 again
    const result = validateVendorStep(3);
    if (!result.valid) {
        showVendorFeedback(result.message, 'error');
        return;
    }

    // Gather data
    const categories = Array.from(
        document.querySelectorAll('input[name="categories"]:checked')
    ).map(cb => cb.value);

    const payload = {
        businessName: document.getElementById('businessName').value.trim(),
        ownerName: document.getElementById('ownerName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        whatsapp: document.getElementById('whatsapp').value.trim() || '',
        businessAddress: document.getElementById('businessAddress').value.trim(),
        state: document.getElementById('state').value,
        lga: document.getElementById('lga').value,
        taxId: document.getElementById('taxId').value.trim() || '',
        bankName: document.getElementById('bankName').value.trim(),
        bankAccountName: document.getElementById('bankAccountName').value.trim(),
        bankAccountNumber: document.getElementById('bankAccountNumber').value.trim(),
        categories: categories,
        description: document.getElementById('description').value.trim() || '',
        password: document.getElementById('password').value,
    };

    // Disable submit button
    const submitBtn = document.getElementById('vendorSubmitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        const response = await fetch('https://ishop-payments-production.up.railway.app/api/vendors/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok || !data.status) {
            throw new Error(data.error || 'Application failed. Please try again.');
        }

        // Save JWT + user info for immediate login
        if (data.jwt) {
            localStorage.setItem('iShopJwt', data.jwt);
        }
        if (data.vendor) {
            localStorage.setItem('iShopUser', JSON.stringify({
                fullName: payload.ownerName,
                email: payload.email,
                phone: payload.phone,
                isVendor: true,
                vendorId: data.vendorId,
                approvalStatus: 'pending',
            }));
        }

        // Show success screen
        showVendorSuccessScreen(payload, data.vendorId);

    } catch (err) {
        console.error('Vendor apply error:', err);
        showVendorFeedback(err.message || 'Something went wrong. Please try again.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Success screen
function showVendorSuccessScreen(payload, vendorId) {
    const container = document.querySelector('.vendor-apply-container');
    if (!container) return;

    container.innerHTML = `
        <div class="vendor-apply-success">
            <div class="vendor-apply-success-icon">
                <i class="fas fa-check"></i>
            </div>
            <h2>Application Submitted! 🎉</h2>
            <p>
                Thank you, <strong>${escapeHtml(payload.ownerName)}</strong>.
                We've received your application for <strong>${escapeHtml(payload.businessName)}</strong>.
            </p>
            <p>
                Our team will review it within <strong>24–48 hours</strong>. You'll receive a confirmation email at
                <strong>${escapeHtml(payload.email)}</strong> with next steps.
            </p>

            <div style="background:#fef9e7;border-left:4px solid #f9c74f;padding:1rem 1.25rem;border-radius:10px;text-align:left;max-width:520px;margin:1.5rem auto;">
                <strong style="color:#856404;display:block;margin-bottom:0.4rem;">Application Reference</strong>
                <code style="font-family:monospace;color:#0d1b2a;font-size:0.95rem;">${escapeHtml(vendorId || 'pending')}</code>
            </div>

            <div class="vendor-apply-success-actions">
                <a href="shop.html" class="primary">
                    <i class="fas fa-store"></i> Browse iShop
                </a>
                <a href="vendor-dashboard.html" class="secondary">
                    <i class="fas fa-tachometer-alt"></i> View Application Status
                </a>
            </div>

            <p style="margin-top:2rem;font-size:0.85rem;color:#8896a8;">
                Questions? Email us at <a href="mailto:info@ishop.com.ng" style="color:#d4a017;font-weight:700;">info@ishop.com.ng</a>
                or WhatsApp <a href="https://wa.me/2348158339217" target="_blank" style="color:#25D366;font-weight:700;">+234 811 480 8088</a>
            </p>
        </div>
    `;

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Simple HTML escape
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

// Init on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVendorApplyPage);
} else {
    initVendorApplyPage();
}
/* ============================================ */
/* VENDOR DASHBOARD (vendor-dashboard.html) */
/* ============================================ */

const VENDOR_DASHBOARD_API = 'https://ishop-payments-production.up.railway.app';

// Initialize on page load
function initVendorDashboard() {
    const container = document.getElementById('vendorDashboardContent');
    if (!container) return;

    // Check if user is logged in
    const jwt = localStorage.getItem('iShopJwt');
    if (!jwt) {
        container.innerHTML = `
            <div class="vendor-container">
                <div class="vendor-status-card rejected" style="text-align:center;padding:3rem 1.5rem;">
                    <div class="vendor-status-icon" style="margin:0 auto 1rem;">
                        <i class="fas fa-user-lock"></i>
                    </div>
                    <h2 style="margin-bottom:0.5rem;">Please log in</h2>
                    <p style="color:#8896a8;margin-bottom:1.5rem;">You need to be logged in to view your vendor dashboard.</p>
                    <div class="vendor-status-actions" style="justify-content:center;">
                        <a href="login.html" class="primary">
                            <i class="fas fa-sign-in-alt"></i> Log In
                        </a>
                        <a href="become-a-vendor.html" class="secondary">
                            <i class="fas fa-store"></i> Become a Vendor
                        </a>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // Fetch vendor data
    fetchVendorDashboardData(jwt);
}

// Fetch vendor data from backend
async function fetchVendorDashboardData(jwt) {
    const container = document.getElementById('vendorDashboardContent');

    try {
        const response = await fetch(`${VENDOR_DASHBOARD_API}/api/vendors/me`, {
            headers: { 'Authorization': `Bearer ${jwt}` },
        });

        const data = await response.json();

        if (!response.ok || !data.status || !data.vendor) {
            // No vendor record — show "not a vendor" state
            if (response.status === 404) {
                showNonVendorState();
                return;
            }
            throw new Error(data.error || 'Could not load your vendor data');
        }

        renderVendorDashboard(data.vendor);

    } catch (err) {
        console.error('Vendor dashboard error:', err);
        container.innerHTML = `
            <div class="vendor-container">
                <div class="vendor-status-card rejected" style="text-align:center;padding:3rem 1.5rem;">
                    <div class="vendor-status-icon" style="margin:0 auto 1rem;">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2 style="margin-bottom:0.5rem;">Something went wrong</h2>
                    <p style="color:#8896a8;margin-bottom:1.5rem;">${err.message}</p>
                    <div class="vendor-status-actions" style="justify-content:center;">
                        <button class="primary" onclick="location.reload()">
                            <i class="fas fa-redo"></i> Try Again
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

// Handle user who isn't a vendor yet
function showNonVendorState() {
    const container = document.getElementById('vendorDashboardContent');

    // Update the header greeting from localStorage
    const user = JSON.parse(localStorage.getItem('iShopUser') || '{}');
    const welcome = document.getElementById('vendorWelcome');
    const email = document.getElementById('vendorEmail');
    if (welcome) welcome.textContent = `Hello, ${(user.fullName || 'there').split(' ')[0]}`;
    if (email) email.textContent = user.email || '';

    container.innerHTML = `
        <div class="vendor-container">
            <div class="vendor-status-card pending" style="text-align:center;padding:3rem 1.5rem;">
                <div class="vendor-status-icon" style="margin:0 auto 1rem;">
                    <i class="fas fa-store"></i>
                </div>
                <h2 style="margin-bottom:0.5rem;">You're not a vendor yet</h2>
                <p class="vendor-status-message" style="margin:0 auto 1.5rem;">
                    Want to sell on iShop? It's free to apply and takes less than 5 minutes.
                </p>
                <div class="vendor-status-actions" style="justify-content:center;">
                    <a href="become-a-vendor.html" class="primary">
                        <i class="fas fa-rocket"></i> Become a Vendor
                    </a>
                    <a href="shop.html" class="secondary">
                        <i class="fas fa-store"></i> Continue Shopping
                    </a>
                </div>
            </div>
        </div>
    `;
}

// Main dashboard renderer
function renderVendorDashboard(vendor) {
    const container = document.getElementById('vendorDashboardContent');
    const welcome = document.getElementById('vendorWelcome');
    const email = document.getElementById('vendorEmail');

    // Update header
    if (welcome) welcome.textContent = `Welcome, ${vendor.businessName || 'Vendor'}`;
    if (email) email.textContent = vendor.email || '';

    // Determine status
    const status = (vendor.approvalStatus || 'pending').toLowerCase();

    // Status meta
    const statusMeta = {
        pending: {
            title: 'Application Under Review',
            icon: 'clock',
            badge: 'Pending Approval',
            message: 'Thanks for applying! Our team is reviewing your business details. This usually takes 24–48 hours. We\'ll email you as soon as a decision is made.',
        },
        approved: {
            title: 'You\'re Approved! 🎉',
            icon: 'check-circle',
            badge: 'Approved Vendor',
            message: 'Welcome aboard! You can now start listing products on iShop. Our team has set up your vendor account with the right commission rates for your categories.',
        },
        rejected: {
            title: 'Application Not Approved',
            icon: 'times-circle',
            badge: 'Not Approved',
            message: 'Unfortunately, we couldn\'t approve your application at this time. This is usually because of incomplete information or a category we don\'t currently support. Reach out to us on WhatsApp for more details.',
        },
        suspended: {
            title: 'Account Suspended',
            icon: 'ban',
            badge: 'Suspended',
            message: 'Your vendor account has been temporarily suspended. Please contact our team to resolve this.',
        },
    }[status] || {
        title: 'Status Unknown',
        icon: 'info-circle',
        badge: status,
        message: 'We couldn\'t determine your account status. Please contact support.',
    };

    // Tracker (always shows pending or approved — rejected/suspended show different)
    const trackerHTML = (status === 'approved') ? `
        <div class="vendor-tracker">
            <div class="vendor-tracker-step done">
                <div class="vendor-tracker-dot"><i class="fas fa-check"></i></div>
                <span class="vendor-tracker-label">Applied</span>
            </div>
            <div class="vendor-tracker-line done"></div>
            <div class="vendor-tracker-step done">
                <div class="vendor-tracker-dot"><i class="fas fa-check"></i></div>
                <span class="vendor-tracker-label">Reviewed</span>
            </div>
            <div class="vendor-tracker-line done"></div>
            <div class="vendor-tracker-step current">
                <div class="vendor-tracker-dot"><i class="fas fa-store"></i></div>
                <span class="vendor-tracker-label">Ready to Sell</span>
            </div>
        </div>
    ` : (status === 'pending') ? `
        <div class="vendor-tracker">
            <div class="vendor-tracker-step done">
                <div class="vendor-tracker-dot"><i class="fas fa-check"></i></div>
                <span class="vendor-tracker-label">Applied</span>
            </div>
            <div class="vendor-tracker-line"></div>
            <div class="vendor-tracker-step current">
                <div class="vendor-tracker-dot"><i class="fas fa-clock"></i></div>
                <span class="vendor-tracker-label">Under Review</span>
            </div>
            <div class="vendor-tracker-line"></div>
            <div class="vendor-tracker-step">
                <div class="vendor-tracker-dot"><i class="fas fa-store"></i></div>
                <span class="vendor-tracker-label">Ready to Sell</span>
            </div>
        </div>
    ` : '';

    // Action buttons based on status
    let actionsHTML = '';
    if (status === 'pending') {
        actionsHTML = `
            <a href="https://wa.me/2348158339217?text=Hi%20iShop%2C%20I%20applied%20to%20sell%20on%20iShop%20-%20${encodeURIComponent(vendor.businessName)}"
               target="_blank" class="whatsapp">
                <i class="fab fa-whatsapp"></i> Ask About My Application
            </a>
            <a href="shop.html" class="secondary">
                <i class="fas fa-shopping-bag"></i> Continue Shopping
            </a>
        `;
    } else if (status === 'approved') {
        actionsHTML = `
            <a href="vendor-product-form.html" class="primary">
                <i class="fas fa-plus-circle"></i> Add Your First Product
            </a>
            <a href="vendor-products.html" class="secondary">
                <i class="fas fa-boxes"></i> My Products
            </a>
            <a href="shop.html" class="secondary">
                <i class="fas fa-store"></i> View iShop Storefront
            </a>
        `;
    } else {
        actionsHTML = `
            <a href="https://wa.me/2348158339217?text=Hi%20iShop%2C%20I%20need%20help%20with%20my%20vendor%20account%20-%20${encodeURIComponent(vendor.businessName)}"
               target="_blank" class="whatsapp">
                <i class="fab fa-whatsapp"></i> Contact Support
            </a>
            <a href="contact.html" class="secondary">
                <i class="fas fa-envelope"></i> Email Us
            </a>
        `;
    }

    // Categories display
    const categories = Array.isArray(vendor.categories) ? vendor.categories : [];
    const categoriesText = categories.length > 0
        ? categories.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')
        : 'Not specified';

    // Location display
    const locationText = [
        vendor.lga ? vendor.lga.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '',
        vendor.state ? vendor.state.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '',
    ].filter(Boolean).join(', ') || 'Not specified';

    // No placeholder — product management is live
    const phase2HTML = '';

    // Render
    container.innerHTML = `
        <div class="vendor-container">
            <!-- Status card -->
            <div class="vendor-status-card ${status}">
                <div class="vendor-status-header">
                    <div class="vendor-status-icon">
                        <i class="fas fa-${statusMeta.icon}${status === 'pending' ? ' fa-spin-slow' : ''}"></i>
                    </div>
                    <div class="vendor-status-info">
                        <h2>${statusMeta.title}</h2>
                        <span class="vendor-status-badge ${status}">${statusMeta.badge}</span>
                    </div>
                </div>

                <p class="vendor-status-message">${statusMeta.message}</p>

                ${trackerHTML}

                <div class="vendor-status-actions">
                    ${actionsHTML}
                </div>
            </div>

            <!-- Business info cards -->
            <div class="vendor-info-grid">
                <div class="vendor-info-card">
                    <div class="vendor-info-card-icon"><i class="fas fa-store"></i></div>
                    <h3>Business Name</h3>
                    <p>${escapeHtml(vendor.businessName) || '—'}</p>
                </div>
                <div class="vendor-info-card">
                    <div class="vendor-info-card-icon"><i class="fas fa-user"></i></div>
                    <h3>Owner</h3>
                    <p>${escapeHtml(vendor.ownerName) || '—'}</p>
                </div>
                <div class="vendor-info-card">
                    <div class="vendor-info-card-icon"><i class="fas fa-envelope"></i></div>
                    <h3>Email</h3>
                    <p>${escapeHtml(vendor.email) || '—'}</p>
                </div>
                <div class="vendor-info-card">
                    <div class="vendor-info-card-icon"><i class="fas fa-phone"></i></div>
                    <h3>Phone</h3>
                    <p>${escapeHtml(vendor.phone) || '—'}</p>
                </div>
                <div class="vendor-info-card">
                    <div class="vendor-info-card-icon"><i class="fas fa-map-marker-alt"></i></div>
                    <h3>Location</h3>
                    <p>${locationText}</p>
                </div>
                <div class="vendor-info-card">
                    <div class="vendor-info-card-icon"><i class="fas fa-tags"></i></div>
                    <h3>Categories</h3>
                    <p>${categoriesText}</p>
                </div>
                <div class="vendor-info-card">
                    <div class="vendor-info-card-icon"><i class="fas fa-percentage"></i></div>
                    <h3>Commission Rate</h3>
                    <p>${vendor.commissionRate ? vendor.commissionRate + '%' : 'Per category'}</p>
                </div>
                <div class="vendor-info-card">
                    <div class="vendor-info-card-icon"><i class="fas fa-calendar-alt"></i></div>
                    <h3>Applied</h3>
                    <p>${vendor.approvedAt ? new Date(vendor.approvedAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Just now'}</p>
                </div>
            </div>

            ${phase2HTML}
        </div>
    `;
}

// Init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVendorDashboard);
} else {
    initVendorDashboard();
}
/* ============================================ */
/* VENDOR PRODUCTS PAGE (vendor-products.html) */
/* ============================================ */

const VENDOR_PRODUCTS_API = 'https://ishop-payments-production.up.railway.app';

let vendorProductsState = {
    allProducts: [],
    filteredProducts: [],
    currentFilter: 'all',
    searchQuery: '',
    deleteTargetId: null,
    deleteTargetName: '',
};

// Initialize
function initVendorProductsPage() {
    const container = document.getElementById('vendorProductsContainer');
    if (!container) return;

    const jwt = localStorage.getItem('iShopJwt');
    if (!jwt) {
        container.innerHTML = `
            <div class="vendor-empty-state">
                <div class="vendor-empty-icon"><i class="fas fa-user-lock"></i></div>
                <h3>Please log in</h3>
                <p>You need to be logged in to manage your products.</p>
                <a href="login.html" class="vendor-add-btn" style="margin: 0 auto;">
                    <i class="fas fa-sign-in-alt"></i> Log In
                </a>
            </div>
        `;
        return;
    }

    // Wire filters
    document.querySelectorAll('.vendor-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.vendor-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            vendorProductsState.currentFilter = btn.dataset.filter;
            applyVendorProductFilters();
        });
    });

    // Wire search
    const search = document.getElementById('vendorProductsSearch');
    if (search) {
        let debounce;
        search.addEventListener('input', function () {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                vendorProductsState.searchQuery = this.value.trim().toLowerCase();
                applyVendorProductFilters();
            }, 200);
        });
    }

    // Wire delete modal buttons
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', confirmVendorDeleteProduct);

    // Load products
    loadVendorProducts(jwt);
}

// Fetch products
async function loadVendorProducts(jwt) {
    const container = document.getElementById('vendorProductsContainer');

    try {
        const res = await fetch(`${VENDOR_PRODUCTS_API}/api/vendors/products`, {
            headers: { 'Authorization': `Bearer ${jwt}` },
        });

        const data = await res.json();

        // Handle specific error states
        if (res.status === 403) {
            container.innerHTML = `
                <div class="vendor-empty-state">
                    <div class="vendor-empty-icon"><i class="fas fa-hourglass-half"></i></div>
                    <h3>Account pending approval</h3>
                    <p>Your vendor account is still being reviewed. Once approved, you'll be able to add and manage products here.</p>
                    <a href="vendor-dashboard.html" class="vendor-add-btn" style="margin: 0 auto;">
                        <i class="fas fa-tachometer-alt"></i> View Dashboard
                    </a>
                </div>
            `;
            return;
        }

        if (res.status === 404) {
            container.innerHTML = `
                <div class="vendor-empty-state">
                    <div class="vendor-empty-icon"><i class="fas fa-store"></i></div>
                    <h3>Not a vendor yet</h3>
                    <p>You need a vendor account to manage products.</p>
                    <a href="become-a-vendor.html" class="vendor-add-btn" style="margin: 0 auto;">
                        <i class="fas fa-rocket"></i> Become a Vendor
                    </a>
                </div>
            `;
            return;
        }

        if (!res.ok || !data.status) {
            throw new Error(data.error || 'Could not load products');
        }

        vendorProductsState.allProducts = data.products || [];
        updateVendorProductStats();
        applyVendorProductFilters();

    } catch (err) {
        console.error('Vendor products load error:', err);
        container.innerHTML = `
            <div class="vendor-error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${err.message}</p>
                <button class="vendor-btn-secondary" onclick="location.reload()" style="margin-top: 1rem;">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
    }
}

// Update stats
function updateVendorProductStats() {
    const products = vendorProductsState.allProducts;

    const total = products.length;
    const live = products.filter(p => p.published).length;
    const drafts = products.filter(p => !p.published).length;
    const categories = new Set(products.map(p => p.category).filter(Boolean)).size;

    const el = (id) => document.getElementById(id);
    if (el('statTotalProducts')) el('statTotalProducts').textContent = total;
    if (el('statLiveProducts')) el('statLiveProducts').textContent = live;
    if (el('statDraftProducts')) el('statDraftProducts').textContent = drafts;
    if (el('statCategories')) el('statCategories').textContent = categories;
}

// Apply filters + search
function applyVendorProductFilters() {
    const { allProducts, currentFilter, searchQuery } = vendorProductsState;

    let filtered = [...allProducts];

    // Filter
    if (currentFilter === 'live') {
        filtered = filtered.filter(p => p.published);
    } else if (currentFilter === 'draft') {
        filtered = filtered.filter(p => !p.published);
    } else if (currentFilter === 'physical') {
        filtered = filtered.filter(p => (p.type || '').toLowerCase() === 'physical');
    } else if (currentFilter === 'digital') {
        filtered = filtered.filter(p => (p.type || '').toLowerCase() === 'digital');
    }

    // Search
    if (searchQuery) {
        filtered = filtered.filter(p =>
            (p.name || '').toLowerCase().includes(searchQuery) ||
            (p.category || '').toLowerCase().includes(searchQuery)
        );
    }

    vendorProductsState.filteredProducts = filtered;
    renderVendorProducts(filtered);
}

// Render product grid
function renderVendorProducts(products) {
    const container = document.getElementById('vendorProductsContainer');
    if (!container) return;

    if (vendorProductsState.allProducts.length === 0) {
        container.innerHTML = `
            <div class="vendor-empty-state">
                <div class="vendor-empty-icon"><i class="fas fa-box-open"></i></div>
                <h3>You haven't listed any products yet</h3>
                <p>Add your first product to start selling on iShop. Our team reviews every listing before it goes live.</p>
                <a href="vendor-product-form.html" class="vendor-add-btn" style="margin: 0 auto;">
                    <i class="fas fa-plus-circle"></i> Add Your First Product
                </a>
            </div>
        `;
        return;
    }

    if (products.length === 0) {
        container.innerHTML = `
            <div class="vendor-empty-state">
                <div class="vendor-empty-icon"><i class="fas fa-search"></i></div>
                <h3>No products match your filter</h3>
                <p>Try a different filter or clear your search.</p>
            </div>
        `;
        return;
    }

    const cardsHTML = products.map(product => {
        const isDigital = (product.type || '').toLowerCase() === 'digital';
        const mainImage = product.images?.[0]?.url || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23f8fafc"/><rect x="75" y="70" width="50" height="40" rx="4" fill="%23e0e0e0"/><circle cx="88" cy="84" r="5" fill="%23f9c74f"/></svg>';
        const statusBadge = product.published
            ? '<span class="vendor-product-badge live">Live</span>'
            : '<span class="vendor-product-badge draft">Draft</span>';
        const digitalBadge = isDigital ? '<span class="vendor-product-badge digital"><i class="fas fa-bolt"></i> Digital</span>' : '';

        const price = Number(product.price || 0).toLocaleString();
        const createdDate = new Date(product.createdAt).toLocaleDateString('en-NG', {
            month: 'short', day: 'numeric', year: 'numeric'
        });

        return `
            <div class="vendor-product-card">
                <div class="vendor-product-image">
                    ${statusBadge}
                    ${digitalBadge}
                    <img src="${mainImage}" alt="${escapeHtml(product.name)}" loading="lazy" />
                </div>
                <div class="vendor-product-body">
                    <h3 class="vendor-product-name">${escapeHtml(product.name || 'Untitled')}</h3>
                    <p class="vendor-product-category">${escapeHtml(product.category || 'Uncategorized')}</p>
                    <p class="vendor-product-price">₦${price}</p>
                    <div class="vendor-product-meta">
                        <span>Added ${createdDate}</span>
                    </div>
                    <div class="vendor-product-actions">
                        <a href="vendor-product-form.html?id=${product.id}" class="btn-edit">
                            <i class="fas fa-edit"></i> Edit
                        </a>
                        <button class="btn-delete" onclick="openVendorDeleteModal(${product.id}, '${escapeHtml(product.name).replace(/'/g, "\\'")}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `<div class="vendor-products-grid">${cardsHTML}</div>`;
}

// ============ DELETE FLOW ============

function openVendorDeleteModal(productId, productName) {
    vendorProductsState.deleteTargetId = productId;
    vendorProductsState.deleteTargetName = productName;

    const nameEl = document.getElementById('deleteModalProductName');
    if (nameEl) {
        nameEl.textContent = `"${productName}" will be permanently deleted. This cannot be undone.`;
    }

    const modal = document.getElementById('deleteModal');
    if (modal) modal.style.display = 'flex';
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) modal.style.display = 'none';
    vendorProductsState.deleteTargetId = null;
    vendorProductsState.deleteTargetName = '';
}

async function confirmVendorDeleteProduct() {
    const productId = vendorProductsState.deleteTargetId;
    if (!productId) return;

    const jwt = localStorage.getItem('iShopJwt');
    if (!jwt) {
        alert('Please log in again.');
        return;
    }

    const btn = document.getElementById('confirmDeleteBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
        const res = await fetch(`${VENDOR_PRODUCTS_API}/api/vendors/products/${productId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${jwt}` },
        });

        const data = await res.json();

        if (!res.ok || !data.status) {
            throw new Error(data.error || 'Delete failed');
        }

        // Remove from local state
        vendorProductsState.allProducts = vendorProductsState.allProducts.filter(p => p.id !== productId);
        updateVendorProductStats();
        applyVendorProductFilters();
        closeDeleteModal();

        // Success toast
        showVendorProductsToast('Product deleted successfully', 'success');
    } catch (err) {
        console.error('Delete error:', err);
        showVendorProductsToast(err.message || 'Could not delete product', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
    const modal = document.getElementById('deleteModal');
    if (modal && e.target === modal) {
        closeDeleteModal();
    }
});

// Simple toast
function showVendorProductsToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: ${type === 'error' ? '#e74c3c' : '#0d1b2a'};
        color: white;
        padding: 0.9rem 1.5rem;
        border-radius: 30px;
        font-weight: 600;
        font-size: 0.9rem;
        box-shadow: 0 8px 30px rgba(0,0,0,0.25);
        z-index: 9999;
        transition: transform 0.3s ease;
        display: flex;
        align-items: center;
        gap: 0.6rem;
    `;
    toast.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"
           style="color: ${type === 'error' ? '#fff' : '#f9c74f'};"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(100px)';
        setTimeout(() => toast.remove(), 350);
    }, 3000);
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVendorProductsPage);
} else {
    initVendorProductsPage();
}
/* ============================================ */
/* VENDOR PRODUCT FORM (vendor-product-form.html) */
/* ============================================ */

const PRODUCT_FORM_API = 'https://ishop-payments-production.up.railway.app';
const STRAPI_UPLOAD_API = 'https://ishop-cms-production.up.railway.app/api/upload';

let productFormState = {
    currentStep: 1,
    totalSteps: 3,
    editProductId: null,       // null = add mode, number = edit mode
    uploadedImages: [],        // [{ id, url, status: 'uploading'|'done'|'error', error? }]
    uploadedBookFile: null,    // { id, url, name, size }
    existingImages: [],        // for edit mode — pre-loaded from Strapi
    existingBookFile: null,    // for edit mode
};

// ============================================
// INITIALIZE
// ============================================

function initProductFormPage() {
    const form = document.getElementById('productForm');
    if (!form) return;

    // Check auth
    const jwt = localStorage.getItem('iShopJwt');
    if (!jwt) {
        window.location.href = 'login.html';
        return;
    }

    // Detect edit mode
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('id');
    if (editId) {
        productFormState.editProductId = editId;
        document.getElementById('productFormTitle').textContent = 'Edit Product';
        document.getElementById('productFormSubtitle').textContent = 'Update the details and resubmit for review.';
        document.getElementById('submitBtnText').textContent = 'Save Changes';
        loadProductForEdit(editId, jwt);
    }

    // Wire navigation
    document.getElementById('productNextBtn')?.addEventListener('click', productNextStep);
    document.getElementById('productBackBtn')?.addEventListener('click', productPrevStep);

    // Type change → toggle stock field visibility
    const typeSelect = document.getElementById('productType');
    if (typeSelect) {
        typeSelect.addEventListener('change', handleProductTypeChange);
        handleProductTypeChange();
    }

    // Image upload
    const imageInput = document.getElementById('productImages');
    if (imageInput) {
        imageInput.addEventListener('change', handleImageSelection);
    }
        // MOBILE FIX: Some browsers don't fire picker with display:none inputs.
    // Convert to visually-hidden but still present.
    ['productImages', 'productBookFile'].forEach(id => {
        const input = document.getElementById(id);
        if (input && getComputedStyle(input).display === 'none') {
            input.style.display = 'block';
            input.style.position = 'absolute';
            input.style.opacity = '0';
            input.style.width = '1px';
            input.style.height = '1px';
            input.style.pointerEvents = 'none';
        }
    });

    // Book file upload
    const bookInput = document.getElementById('productBookFile');
    if (bookInput) {
        bookInput.addEventListener('change', handleBookFileSelection);
    }

    // Drag & drop for images
    setupDragDrop('productImagesDropZone', 'productImages', handleImageSelection);

    // Drag & drop for book file
    setupDragDrop('bookFileDropZone', 'productBookFile', handleBookFileSelection);

    // Form submit
    form.addEventListener('submit', handleProductFormSubmit);

    console.log('✅ Product form initialized', editId ? `(edit mode #${editId})` : '(add mode)');
}

// ============================================
// TYPE CHANGE → toggle stock + book file
// ============================================

function handleProductTypeChange() {
    const type = document.getElementById('productType')?.value || 'physical';
    const stockGroup = document.getElementById('productStock')?.closest('.vendor-form-group');
    const bookFileGroup = document.getElementById('bookFileGroup');

    if (type === 'digital') {
        if (stockGroup) stockGroup.style.display = 'none';
        if (bookFileGroup) bookFileGroup.style.display = 'block';
    } else {
        if (stockGroup) stockGroup.style.display = '';
        if (bookFileGroup) bookFileGroup.style.display = 'none';
    }
}

// ============================================
// STEP NAVIGATION
// ============================================

function productShowStep(step) {
    document.querySelectorAll('.vendor-apply-step').forEach(el => el.classList.remove('active'));
    const target = document.querySelector(`.vendor-apply-step[data-step="${step}"]`);
    if (target) target.classList.add('active');

    // Progress bar
    const progressBar = document.getElementById('productProgressBar');
    if (progressBar) progressBar.style.width = `${(step / productFormState.totalSteps) * 100}%`;

    // Step dots
    document.querySelectorAll('.vendor-progress-step').forEach(el => {
        const n = parseInt(el.dataset.step, 10);
        el.classList.remove('active', 'completed');
        if (n < step) el.classList.add('completed');
        if (n === step) el.classList.add('active');
    });

    // Buttons
    const backBtn = document.getElementById('productBackBtn');
    const nextBtn = document.getElementById('productNextBtn');
    const submitBtn = document.getElementById('productSubmitBtn');
    if (backBtn) backBtn.style.display = step > 1 ? 'inline-flex' : 'none';
    if (nextBtn) nextBtn.style.display = step < productFormState.totalSteps ? 'inline-flex' : 'none';
    if (submitBtn) submitBtn.style.display = step === productFormState.totalSteps ? 'inline-flex' : 'none';

    // If step 3, render review
    if (step === 3) renderReviewSummary();

    // Feedback clear
    const fb = document.getElementById('productFormFeedback');
    if (fb) { fb.innerHTML = ''; fb.className = ''; }

    document.getElementById('productForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function productNextStep() {
    const result = validateProductStep(productFormState.currentStep);
    if (!result.valid) {
        showProductFeedback(result.message, 'error');
        return;
    }
    if (productFormState.currentStep < productFormState.totalSteps) {
        productFormState.currentStep++;
        productShowStep(productFormState.currentStep);
    }
}

function productPrevStep() {
    if (productFormState.currentStep > 1) {
        productFormState.currentStep--;
        productShowStep(productFormState.currentStep);
    }
}

// ============================================
// VALIDATION
// ============================================

function validateProductStep(step) {
    if (step === 1) {
        const name = document.getElementById('productName')?.value.trim();
        const category = document.getElementById('productCategory')?.value;
        const type = document.getElementById('productType')?.value;
        const price = document.getElementById('productPrice')?.value;

        if (!name) return { valid: false, message: 'Please enter a product name.' };
        if (!category) return { valid: false, message: 'Please select a category.' };
        if (!type) return { valid: false, message: 'Please select a product type.' };
        if (price === '' || Number(price) < 0) return { valid: false, message: 'Please enter a valid price.' };
    }

    if (step === 2) {
        const desc = document.getElementById('productDescription')?.value.trim();
        if (!desc || desc.length < 50) {
            return { valid: false, message: 'Please write at least 50 characters of description.' };
        }
    }

    if (step === 3) {
        // Must have at least 1 image (existing for edit mode, or freshly uploaded)
        const hasImages = productFormState.uploadedImages.length > 0 || productFormState.existingImages.length > 0;
        if (!hasImages) {
            return { valid: false, message: 'Please upload at least one product image.' };
        }

        // If digital and no existing book file, require a new one
        const type = document.getElementById('productType')?.value;
        if (type === 'digital') {
            const hasBook = productFormState.uploadedBookFile || productFormState.existingBookFile;
            if (!hasBook) {
                return { valid: false, message: 'Please upload the digital file for this product.' };
            }
        }

        // All uploads must be done (no errors, no in-progress)
        const stillUploading = productFormState.uploadedImages.some(img => img.status === 'uploading');
        if (stillUploading) return { valid: false, message: 'Please wait for image uploads to finish.' };

        const anyError = productFormState.uploadedImages.some(img => img.status === 'error');
        if (anyError) return { valid: false, message: 'Some images failed to upload. Please remove them and try again.' };
    }

    return { valid: true };
}

function showProductFeedback(message, type = 'error') {
    const fb = document.getElementById('productFormFeedback');
    if (!fb) return;
    const icon = type === 'error' ? '⚠️' : '✅';
    fb.className = type;
    fb.innerHTML = `<div style="display:flex;align-items:flex-start;gap:0.6rem;">
        <span style="font-size:1.1rem;">${icon}</span>
        <span>${message}</span>
    </div>`;

    // Mobile fix — scroll feedback into view so keyboard doesn't hide it
    setTimeout(() => {
        fb.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
}

// ============================================
// SPECIFICATIONS (key-value pairs)
// ============================================

function addSpecificationRow(name = '', value = '') {
    const container = document.getElementById('specificationsList');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'vendor-spec-row';
    row.innerHTML = `
        <input type="text" class="spec-name" placeholder="e.g. Battery" value="${escapeHtml(name)}" />
        <input type="text" class="spec-value" placeholder="e.g. 5000mAh" value="${escapeHtml(value)}" />
        <button type="button" class="vendor-spec-remove" title="Remove" onclick="this.closest('.vendor-spec-row').remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(row);
}

function getSpecificationsFromForm() {
    const rows = document.querySelectorAll('#specificationsList .vendor-spec-row');
    const specs = [];
    rows.forEach(row => {
        const name = row.querySelector('.spec-name')?.value.trim();
        const value = row.querySelector('.spec-value')?.value.trim();
        if (name && value) specs.push({ spec_name: name, spec_value: value });
    });
    return specs;
}

// ============================================
// IMAGE UPLOAD
// ============================================

function handleImageSelection(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const totalAfter = productFormState.uploadedImages.length + productFormState.existingImages.length + files.length;
    if (totalAfter > 5) {
        alert('You can upload up to 5 images. Please remove some first.');
        return;
    }

    files.forEach(file => uploadImageToStrapi(file));

    // Reset input so same file can be re-selected
    e.target.value = '';
}

async function uploadImageToStrapi(file) {
    const jwt = localStorage.getItem('iShopJwt');
    if (!jwt) return;

    // Validate size
    if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} is too large. Max 5MB per image.`);
        return;
    }

    // Create local preview entry with "uploading" status
    const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const previewUrl = URL.createObjectURL(file);
    const imgEntry = { tempId, id: null, url: previewUrl, status: 'uploading' };
    productFormState.uploadedImages.push(imgEntry);
    renderImagesPreview();

    try {
        const formData = new FormData();
        formData.append('files', file);

        const res = await fetch(STRAPI_UPLOAD_API, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${jwt}` },
            body: formData,
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('Upload failed:', errText.substring(0, 300));
            throw new Error('Upload failed');
        }

        const data = await res.json();
        const media = Array.isArray(data) ? data[0] : null;

        if (!media || !media.id) throw new Error('Invalid upload response');

        // Update state — success
        imgEntry.id = media.id;
        imgEntry.url = media.url;
        imgEntry.status = 'done';
        renderImagesPreview();

    } catch (err) {
        console.error('Image upload error:', err);
        imgEntry.status = 'error';
        imgEntry.error = err.message || 'Upload failed';
        renderImagesPreview();

        // Auto-remove after 5 seconds so user isn't stuck
        setTimeout(() => {
            productFormState.uploadedImages = productFormState.uploadedImages.filter(i => i.tempId !== tempId);
            renderImagesPreview();
        }, 5000);
    }
}

function renderImagesPreview() {
    const container = document.getElementById('productImagesPreview');
    if (!container) return;

    const allImages = [
        ...productFormState.existingImages.map(img => ({ ...img, status: 'done', isExisting: true })),
        ...productFormState.uploadedImages,
    ];

    if (allImages.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = allImages.map((img, index) => {
        const removeFn = img.isExisting
            ? `removeExistingImage(${index})`
            : `removeUploadedImage('${img.tempId}')`;

        const loadingOverlay = img.status === 'uploading'
            ? '<div class="vendor-image-uploading"><i class="fas fa-spinner fa-spin"></i></div>'
            : '';

        const errorOverlay = img.status === 'error'
            ? `<div class="vendor-image-error">
                   <i class="fas fa-exclamation-triangle"></i>
                   <span>${escapeHtml(img.error || 'Failed')}</span>
               </div>`
            : '';

        const primaryBadge = index === 0
            ? '<span class="primary-badge">Main</span>'
            : '';

        return `
            <div class="vendor-image-preview-item">
                ${primaryBadge}
                <img src="${img.url}" alt="" />
                ${loadingOverlay}
                ${errorOverlay}
                <button type="button" class="vendor-image-remove" onclick="${removeFn}" title="Remove">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
}

function removeUploadedImage(tempId) {
    productFormState.uploadedImages = productFormState.uploadedImages.filter(i => i.tempId !== tempId);
    renderImagesPreview();
}

function removeExistingImage(index) {
    productFormState.existingImages.splice(index, 1);
    renderImagesPreview();
}

// ============================================
// BOOK FILE (digital products)
// ============================================

function handleBookFileSelection(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadBookFileToStrapi(file);
    e.target.value = '';
}

async function uploadBookFileToStrapi(file) {
    const jwt = localStorage.getItem('iShopJwt');
    if (!jwt) return;

    const preview = document.getElementById('bookFilePreview');
    if (preview) {
        preview.innerHTML = `
            <div class="vendor-file-preview-item" style="background:#fef9e7;border-color:#f9c74f;">
                <i class="fas fa-spinner fa-spin file-icon" style="color:#d4a017;"></i>
                <div class="file-info">
                    <strong>Uploading ${escapeHtml(file.name)}...</strong>
                    <span>Please wait</span>
                </div>
            </div>
        `;
    }

    try {
        const formData = new FormData();
        formData.append('files', file);

        const res = await fetch(STRAPI_UPLOAD_API, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${jwt}` },
            body: formData,
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('Book file upload failed:', errText.substring(0, 300));
            throw new Error('Upload failed');
        }

        const data = await res.json();
        const media = Array.isArray(data) ? data[0] : null;
        if (!media?.id) throw new Error('Invalid response');

        productFormState.uploadedBookFile = {
            id: media.id,
            url: media.url,
            name: media.name || file.name,
            size: file.size,
        };

        renderBookFilePreview();
    } catch (err) {
        console.error('Book upload error:', err);
        if (preview) {
            preview.innerHTML = `
                <div class="vendor-file-preview-item" style="background:#fef2f2;border-color:#fecaca;">
                    <i class="fas fa-exclamation-triangle file-icon" style="color:#e74c3c;"></i>
                    <div class="file-info">
                        <strong style="color:#991b1b;">Upload failed</strong>
                        <span>${escapeHtml(err.message)}</span>
                    </div>
                </div>
            `;
        }
    }
}

function renderBookFilePreview() {
    const preview = document.getElementById('bookFilePreview');
    if (!preview) return;

    const file = productFormState.uploadedBookFile || productFormState.existingBookFile;
    if (!file) {
        preview.innerHTML = '';
        return;
    }

    preview.innerHTML = `
        <div class="vendor-file-preview-item">
            <i class="fas fa-file-alt file-icon"></i>
            <div class="file-info">
                <strong>${escapeHtml(file.name || 'Digital file')}</strong>
                <span>${file.size ? formatFileSize(file.size) : 'Ready'}</span>
            </div>
            <button type="button" class="file-remove" onclick="removeBookFile()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
}

function removeBookFile() {
    productFormState.uploadedBookFile = null;
    productFormState.existingBookFile = null;
    renderBookFilePreview();
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ============================================
// DRAG AND DROP
// ============================================

function setupDragDrop(dropZoneId, inputId, handler) {
    const zone = document.getElementById(dropZoneId);
    const input = document.getElementById(inputId);
    if (!zone || !input) return;

    ['dragenter', 'dragover'].forEach(evt => {
        zone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        zone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('dragover');
        });
    });

    zone.addEventListener('drop', (e) => {
        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        if (inputId === 'productImages') {
            const syntheticEvent = { target: { files, value: '' } };
            handler(syntheticEvent);
        } else {
            const syntheticEvent = { target: { files, value: '' } };
            handler(syntheticEvent);
        }
    });
}

// ============================================
// REVIEW SUMMARY (Step 3)
// ============================================

function renderReviewSummary() {
    const container = document.getElementById('productReviewSummary');
    if (!container) return;

    const name = document.getElementById('productName')?.value.trim() || '—';
    const category = document.getElementById('productCategory')?.value || '—';
    const type = document.getElementById('productType')?.value || 'physical';
    const subType = document.getElementById('productSubType')?.value.trim() || '';
    const price = document.getElementById('productPrice')?.value || '0';
    const stock = document.getElementById('productStock')?.value || '';
    const description = document.getElementById('productDescription')?.value.trim() || '';
    const specs = getSpecificationsFromForm();

    const allImages = [...productFormState.existingImages, ...productFormState.uploadedImages];

    const imagesHTML = allImages.length > 0
        ? allImages.map(img => `<div class="vendor-review-image-thumb"><img src="${img.url}" /></div>`).join('')
        : '<span style="color:#8896a8;">No images</span>';

    const specsHTML = specs.length > 0
        ? specs.map(s => `<div><strong>${escapeHtml(s.spec_name)}:</strong> ${escapeHtml(s.spec_value)}</div>`).join('')
        : '<span style="color:#8896a8;">No specifications</span>';

    const bookFileHTML = type === 'digital'
        ? (productFormState.uploadedBookFile || productFormState.existingBookFile)
            ? `<div class="vendor-file-preview-item" style="margin:0;">
                   <i class="fas fa-file-alt file-icon"></i>
                   <div class="file-info">
                       <strong>${escapeHtml((productFormState.uploadedBookFile || productFormState.existingBookFile).name || 'Digital file')}</strong>
                       <span>Ready to deliver</span>
                   </div>
               </div>`
            : '<span style="color:#e74c3c;">No file uploaded yet</span>'
        : null;

    container.innerHTML = `
        <div class="vendor-review-row">
            <span class="vendor-review-label">Product Name</span>
            <span class="vendor-review-value">${escapeHtml(name)}</span>
        </div>
        <div class="vendor-review-row">
            <span class="vendor-review-label">Category</span>
            <span class="vendor-review-value">${escapeHtml(category)}${subType ? ' · ' + escapeHtml(subType) : ''}</span>
        </div>
        <div class="vendor-review-row">
            <span class="vendor-review-label">Type</span>
            <span class="vendor-review-value ${type === 'digital' ? 'digital-badge' : ''}">
                ${type === 'digital' ? '<i class="fas fa-bolt"></i> Digital Download' : '📦 Physical Product'}
            </span>
        </div>
        <div class="vendor-review-row">
            <span class="vendor-review-label">Price</span>
            <span class="vendor-review-value price">₦${Number(price).toLocaleString()}</span>
        </div>
        ${type === 'physical' && stock ? `
            <div class="vendor-review-row">
                <span class="vendor-review-label">Stock</span>
                <span class="vendor-review-value">${escapeHtml(stock)} units</span>
            </div>
        ` : ''}
        <div class="vendor-review-row">
            <span class="vendor-review-label">Description</span>
            <span class="vendor-review-value">${escapeHtml(description.substring(0, 250))}${description.length > 250 ? '…' : ''}</span>
        </div>
        ${specs.length > 0 ? `
            <div class="vendor-review-row">
                <span class="vendor-review-label">Specifications</span>
                <div class="vendor-review-specs">${specsHTML}</div>
            </div>
        ` : ''}
        ${bookFileHTML ? `
            <div class="vendor-review-row">
                <span class="vendor-review-label">Digital File</span>
                <div>${bookFileHTML}</div>
            </div>
        ` : ''}
        <div class="vendor-review-row">
            <span class="vendor-review-label">Images (${allImages.length})</span>
            <div class="vendor-review-images">${imagesHTML}</div>
        </div>
    `;
}

// ============================================
// LOAD PRODUCT FOR EDIT MODE
// ============================================

async function loadProductForEdit(productId, jwt) {
    try {
        const res = await fetch(`${PRODUCT_FORM_API}/api/vendors/products`, {
            headers: { 'Authorization': `Bearer ${jwt}` },
        });

        const data = await res.json();
        if (!res.ok || !data.status) throw new Error(data.error || 'Could not load product');

        const product = (data.products || []).find(p => String(p.id) === String(productId));
        if (!product) throw new Error('Product not found in your catalogue');

        // Pre-fill fields
        document.getElementById('productName').value = product.name || '';
        document.getElementById('productCategory').value = (product.category || '').toLowerCase();
        document.getElementById('productType').value = (product.type || 'physical').toLowerCase();
        document.getElementById('productSubType').value = product.subType || '';
        document.getElementById('productPrice').value = product.price || '';
        document.getElementById('productDescription').value = extractPlainText(product.description) || '';

        // Specs
        const specsList = document.getElementById('specificationsList');
        if (specsList) specsList.innerHTML = '';
        if (Array.isArray(product.specifications)) {
            product.specifications.forEach(s => addSpecificationRow(s.spec_name, s.spec_value));
        }
        if (!product.specifications || product.specifications.length === 0) {
            // Add one empty row so it looks clean
        }

        // Existing images
        productFormState.existingImages = (product.images || []).map(img => ({
            id: img.id,
            url: img.url,
        }));

        // Existing book file
        if (product.bookFile) {
            productFormState.existingBookFile = {
                id: product.bookFile.id,
                url: product.bookFile.url,
                name: 'Current file',
                size: 0,
            };
        }

        // Type-dependent visibility
        handleProductTypeChange();

        // Render previews
        renderImagesPreview();
        renderBookFilePreview();

    } catch (err) {
        console.error('Load product error:', err);
        alert('Could not load product: ' + err.message);
        window.location.href = 'vendor-products.html';
    }
}

// Extract plain text from Strapi rich-text blocks
function extractPlainText(blocks) {
    if (!blocks) return '';
    if (typeof blocks === 'string') return blocks;
    if (!Array.isArray(blocks)) return '';

    const parts = [];
    function walk(node) {
        if (!node) return;
        if (typeof node === 'string') { parts.push(node); return; }
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (node.text) parts.push(node.text);
        if (node.children) walk(node.children);
    }
    walk(blocks);
    return parts.join(' ').trim();
}

// ============================================
// SUBMIT
// ============================================

async function handleProductFormSubmit(e) {
    e.preventDefault();

    const result = validateProductStep(3);
    if (!result.valid) {
        showProductFeedback(result.message, 'error');
        return;
    }

    const jwt = localStorage.getItem('iShopJwt');
    if (!jwt) { window.location.href = 'login.html'; return; }

    // Gather data
    const payload = {
        name: document.getElementById('productName').value.trim(),
        category: document.getElementById('productCategory').value,
        type: document.getElementById('productType').value,
        subType: document.getElementById('productSubType').value.trim(),
        price: Number(document.getElementById('productPrice').value),
        stock: document.getElementById('productStock')?.value || '',
        description: document.getElementById('productDescription').value.trim(),
        specifications: getSpecificationsFromForm(),
        images: [
            ...productFormState.existingImages.map(img => img.id),
            ...productFormState.uploadedImages.filter(i => i.status === 'done').map(i => i.id),
        ],
        bookFile: productFormState.uploadedBookFile?.id || productFormState.existingBookFile?.id || null,
    };

    const btn = document.getElementById('productSubmitBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        const isEdit = !!productFormState.editProductId;
        const url = isEdit
            ? `${PRODUCT_FORM_API}/api/vendors/products/${productFormState.editProductId}`
            : `${PRODUCT_FORM_API}/api/vendors/products`;
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`,
            },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || !data.status) {
            throw new Error(data.error || 'Submission failed');
        }

        // Success — show success screen
        invalidateProductCache();
        showProductSuccessScreen(isEdit, payload);

    } catch (err) {
        console.error('Submit error:', err);
        showProductFeedback(err.message || 'Something went wrong. Please try again.', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ============================================
// SUCCESS SCREEN
// ============================================

function showProductSuccessScreen(isEdit, payload) {
    const container = document.querySelector('.vendor-apply-container');
    if (!container) return;

    const title = isEdit ? 'Product Updated! 🎉' : 'Product Submitted! 🎉';
    const message = isEdit
        ? 'Your changes have been saved. The product will be re-reviewed by our team.'
        : 'Your product has been submitted for review. Our team will approve it within 24 hours — then it goes live on iShop.';

    container.innerHTML = `
        <div class="vendor-apply-success">
            <div class="vendor-apply-success-icon"><i class="fas fa-check"></i></div>
            <h2>${title}</h2>
            <p>${message}</p>
            <p style="margin-top:1rem;color:#8896a8;font-size:0.9rem;">
                <strong>${escapeHtml(payload.name)}</strong><br>
                ₦${Number(payload.price).toLocaleString()}
            </p>
            <div class="vendor-apply-success-actions">
                <a href="vendor-products.html" class="primary">
                    <i class="fas fa-box"></i> View My Products
                </a>
                <a href="vendor-product-form.html" class="secondary">
                    <i class="fas fa-plus-circle"></i> Add Another Product
                </a>
            </div>
        </div>
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// INIT
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductFormPage);
} else {
    initProductFormPage();
}
/* ============================================ */
/* VENDOR EARNINGS PAGE */
/* ============================================ */

const VENDOR_EARNINGS_API = 'https://ishop-payments-production.up.railway.app';

let vendorEarningsState = {
    pendingBalance: 0,
    paidOut: 0,
    totalEarnings: 0,
    salesCount: 0,
    recentSales: [],
    payoutHistory: [],
};

// Initialize
function initVendorEarningsPage() {
    const pendingEl = document.getElementById('statPending');
    if (!pendingEl) return; // not on this page

    const jwt = localStorage.getItem('iShopJwt');
    if (!jwt) {
        window.location.href = 'login.html';
        return;
    }

    // Wire payout modal
    const requestBtn = document.getElementById('requestPayoutBtn');
    if (requestBtn) requestBtn.addEventListener('click', openPayoutModal);

    const confirmBtn = document.getElementById('confirmPayoutBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', submitPayoutRequest);

    // Wire modal close on overlay click
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('payoutModal');
        if (modal && e.target === modal) closePayoutModal();
    });

    // Load earnings
    loadVendorEarnings(jwt);
}

// Load earnings from backend
async function loadVendorEarnings(jwt) {
    try {
        const res = await fetch(`${VENDOR_EARNINGS_API}/api/vendors/earnings`, {
            headers: { 'Authorization': `Bearer ${jwt}` },
        });

        const data = await res.json();

        if (res.status === 403) {
            showEarningsError('Your vendor account must be approved first.');
            return;
        }
        if (res.status === 404) {
            showEarningsError('No vendor record found for this account.');
            return;
        }
        if (!res.ok || !data.status) {
            throw new Error(data.error || 'Could not load earnings');
        }

        vendorEarningsState = {
            pendingBalance: data.pendingBalance || 0,
            paidOut: data.paidOut || 0,
            totalEarnings: data.totalEarnings || 0,
            salesCount: data.salesCount || 0,
            recentSales: data.recentSales || [],
            payoutHistory: data.payoutHistory || [],
        };

        renderEarningsStats();
        renderSalesTable();
        renderPayoutHistory();

    } catch (err) {
        console.error('Vendor earnings load error:', err);
        showEarningsError(err.message || 'Something went wrong');
    }
}

// Render stats
function renderEarningsStats() {
    const fmt = (n) => '₦' + Number(n || 0).toLocaleString();

    const el = (id) => document.getElementById(id);
    if (el('statPending')) el('statPending').textContent = fmt(vendorEarningsState.pendingBalance);
    if (el('statPaid')) el('statPaid').textContent = fmt(vendorEarningsState.paidOut);
    if (el('statTotal')) el('statTotal').textContent = fmt(vendorEarningsState.totalEarnings);
    if (el('statSales')) el('statSales').textContent = vendorEarningsState.salesCount;

    // Enable/disable payout button based on pending balance
    const requestBtn = document.getElementById('requestPayoutBtn');
    if (requestBtn) {
        if (vendorEarningsState.pendingBalance <= 0) {
            requestBtn.disabled = true;
            requestBtn.title = 'No pending balance to pay out';
        } else {
            requestBtn.disabled = false;
            requestBtn.title = '';
        }
    }

    // Update modal max hint
    const hint = document.getElementById('payoutMaxHint');
    if (hint) {
        hint.textContent = 'Max: ' + fmt(vendorEarningsState.pendingBalance);
    }
}

// Render sales table
function renderSalesTable() {
    const container = document.getElementById('salesTableContainer');
    if (!container) return;

    const sales = vendorEarningsState.recentSales;

    if (!sales || sales.length === 0) {
        container.innerHTML = `
            <div class="vendor-empty-state" style="border:none;box-shadow:none;padding:2.5rem 1rem;">
                <div class="vendor-empty-icon"><i class="fas fa-receipt"></i></div>
                <h3>No sales yet</h3>
                <p>Once customers buy your products, you'll see them here.</p>
                <a href="vendor-products.html" class="vendor-add-btn" style="margin:0 auto;">
                    <i class="fas fa-box"></i> Manage My Products
                </a>
            </div>
        `;
        return;
    }

    const fmt = (n) => '₦' + Number(n || 0).toLocaleString();

    const rows = sales.map(s => {
        const date = s.date ? new Date(s.date).toLocaleDateString('en-NG', {
            year: 'numeric', month: 'short', day: 'numeric',
        }) : '—';

        return `
            <tr>
                <td class="col-product">${escapeHtml(s.productName || 'Product')}</td>
                <td class="col-ref">${escapeHtml(s.orderRef || '')}</td>
                <td>${s.quantity || 1}</td>
                <td class="col-amount">${fmt(s.gross)}</td>
                <td>${(s.commissionRate * 100).toFixed(0)}%</td>
                <td class="col-net">${fmt(s.net)}</td>
                <td class="col-date">${date}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div style="overflow-x:auto;">
            <table class="vendor-sales-table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Order Ref</th>
                        <th>Qty</th>
                        <th>Amount</th>
                        <th>Commission</th>
                        <th>You Earned</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

// Render payout history
function renderPayoutHistory() {
    const container = document.getElementById('payoutHistoryContainer');
    if (!container) return;

    const history = vendorEarningsState.payoutHistory;

    if (!history || history.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:2rem 1rem;color:#8896a8;">
                <i class="fas fa-history" style="font-size:2rem;color:#e0e0e0;display:block;margin-bottom:0.75rem;"></i>
                <p style="margin:0;font-size:0.9rem;">No payouts yet. Your completed payouts will appear here.</p>
            </div>
        `;
        return;
    }

    const fmt = (n) => '₦' + Number(n || 0).toLocaleString();

    container.innerHTML = `
        <div class="vendor-payout-history-list">
            ${history.slice().reverse().map(p => `
                <div class="vendor-payout-history-item">
                    <div class="ph-left">
                        <div class="ph-icon"><i class="fas fa-check"></i></div>
                        <div class="ph-info">
                            <strong>Payout ${escapeHtml(p.id || '')}</strong>
                            <span>${p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-NG', {
                                year: 'numeric', month: 'short', day: 'numeric',
                            }) : '—'}</span>
                        </div>
                    </div>
                    <div class="ph-amount">${fmt(p.amount)}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// Show error state
function showEarningsError(message) {
    const container = document.getElementById('salesTableContainer');
    if (container) {
        container.innerHTML = `
            <div class="vendor-error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${escapeHtml(message)}</p>
                <button class="vendor-btn-secondary" onclick="location.reload()" style="margin-top:1rem;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
    // Zero out stats
    const el = (id) => document.getElementById(id);
    if (el('statPending')) el('statPending').textContent = '₦0';
    if (el('statPaid')) el('statPaid').textContent = '₦0';
    if (el('statTotal')) el('statTotal').textContent = '₦0';
    if (el('statSales')) el('statSales').textContent = '0';
}

// ---------- PAYOUT MODAL ----------
function openPayoutModal() {
    const modal = document.getElementById('payoutModal');
    if (!modal) return;

    if (vendorEarningsState.pendingBalance <= 0) {
        alert('You have no pending balance to pay out.');
        return;
    }

    // Pre-fill with full pending amount
    const amountInput = document.getElementById('payoutAmount');
    if (amountInput) {
        amountInput.value = vendorEarningsState.pendingBalance;
        amountInput.max = vendorEarningsState.pendingBalance;
    }

    // Clear feedback
    const fb = document.getElementById('payoutFeedback');
    if (fb) { fb.innerHTML = ''; fb.className = ''; }

    modal.style.display = 'flex';
}

function closePayoutModal() {
    const modal = document.getElementById('payoutModal');
    if (modal) modal.style.display = 'none';
}

async function submitPayoutRequest() {
    const amountInput = document.getElementById('payoutAmount');
    const feedback = document.getElementById('payoutFeedback');
    const confirmBtn = document.getElementById('confirmPayoutBtn');

    if (!amountInput || !feedback || !confirmBtn) return;

    const amount = Number(amountInput.value);

    // Validation
    if (!amount || amount <= 0) {
        feedback.className = 'error';
        feedback.style.color = '#721c24';
        feedback.style.background = '#f8d7da';
        feedback.style.padding = '0.6rem 0.9rem';
        feedback.style.borderRadius = '8px';
        feedback.innerHTML = '⚠️ Please enter a valid amount.';
        return;
    }

    if (amount > vendorEarningsState.pendingBalance) {
        feedback.className = 'error';
        feedback.style.color = '#721c24';
        feedback.style.background = '#f8d7da';
        feedback.style.padding = '0.6rem 0.9rem';
        feedback.style.borderRadius = '8px';
        feedback.innerHTML = `⚠️ Amount exceeds your pending balance of ₦${vendorEarningsState.pendingBalance.toLocaleString()}.`;
        return;
    }

    const jwt = localStorage.getItem('iShopJwt');
    if (!jwt) {
        alert('Please log in again.');
        return;
    }

    // Disable button
    const originalText = confirmBtn.innerHTML;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    feedback.innerHTML = '';

    try {
        const res = await fetch(`${VENDOR_EARNINGS_API}/api/vendors/request-payout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`,
            },
            body: JSON.stringify({ amount }),
        });

        const data = await res.json();

        if (!res.ok || !data.status) {
            throw new Error(data.error || 'Could not submit request');
        }

        // Success
        feedback.className = 'success';
        feedback.style.color = '#155724';
        feedback.style.background = '#d4edda';
        feedback.style.padding = '0.6rem 0.9rem';
        feedback.style.borderRadius = '8px';
        feedback.innerHTML = `✅ Payout request for ₦${amount.toLocaleString()} submitted! We'll review and process it within 3–5 business days.`;

        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;

        // Close modal after 3 seconds
        setTimeout(() => {
            closePayoutModal();
        }, 3000);

    } catch (err) {
        console.error('Payout request error:', err);
        feedback.className = 'error';
        feedback.style.color = '#721c24';
        feedback.style.background = '#f8d7da';
        feedback.style.padding = '0.6rem 0.9rem';
        feedback.style.borderRadius = '8px';
        feedback.innerHTML = `❌ ${err.message}`;

        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
    }
}

// Init on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVendorEarningsPage);
} else {
    initVendorEarningsPage();
}
/* ============================================ */
/* ADMIN PANEL */
/* ============================================ */

const ADMIN_API_BASE = 'https://ishop-payments-production.up.railway.app';

const adminState = {
    key: '',
    vendors: [],
    pendingVendors: [],
    products: [],
    pendingProducts: [],
    payouts: [],
    orders: [],
    stats: null,
};

// ---------- INIT ----------
function initAdminPanel() {
    const loginScreen = document.getElementById('adminLoginScreen');
    if (!loginScreen) return; // not the admin page

    const savedKey = sessionStorage.getItem('iShopAdminKey') || localStorage.getItem('iShopAdminKey');
    if (savedKey) {
        adminState.key = savedKey;
        adminShowMainScreen();
    }

    const form = document.getElementById('adminLoginForm');
    if (form) form.addEventListener('submit', adminHandleLogin);
}

// ---------- LOGIN ----------
async function adminHandleLogin(e) {
    e.preventDefault();
    const input = document.getElementById('adminKeyInput');
    const btn = document.getElementById('adminLoginBtn');
    const feedback = document.getElementById('adminLoginFeedback');
    const key = input.value.trim();

    if (!key) {
        feedback.className = 'admin-feedback error';
        feedback.textContent = 'Please enter your admin key.';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying…';
    feedback.className = '';
    feedback.textContent = '';

    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/stats?key=${encodeURIComponent(key)}`);
        if (res.status === 401) {
            feedback.className = 'admin-feedback error';
            feedback.textContent = '❌ Invalid admin key. Please try again.';
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-unlock"></i> Log In';
            return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!data.status) throw new Error('Invalid response');

        adminState.key = key;
        adminState.stats = data.stats;
        sessionStorage.setItem('iShopAdminKey', key);
        localStorage.setItem('iShopAdminKey', key);

        feedback.className = 'admin-feedback success';
        feedback.textContent = '✅ Access granted. Loading…';

        setTimeout(adminShowMainScreen, 400);
    } catch (err) {
        console.error('Admin login error:', err);
        feedback.className = 'admin-feedback error';
        feedback.textContent = '❌ Could not connect. Please try again.';
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-unlock"></i> Log In';
    }
}

function adminLogout() {
    sessionStorage.removeItem('iShopAdminKey');
    localStorage.removeItem('iShopAdminKey');
    adminState.key = '';
    document.getElementById('adminMainScreen').style.display = 'none';
    document.getElementById('adminLoginScreen').style.display = 'flex';
    document.getElementById('adminKeyInput').value = '';
    document.getElementById('adminLoginFeedback').textContent = '';
    document.getElementById('adminLoginBtn').disabled = false;
    document.getElementById('adminLoginBtn').innerHTML = '<i class="fas fa-unlock"></i> Log In';
}

// ---------- SHOW MAIN SCREEN ----------
function adminShowMainScreen() {
    document.getElementById('adminLoginScreen').style.display = 'none';
    document.getElementById('adminMainScreen').style.display = 'block';

    // Load stats first (async) then render
    adminLoadStats();
    adminLoadPendingVendors();
    adminLoadAllVendors();
    adminLoadPendingProducts();
    adminLoadAllProducts();
    adminLoadPayouts();
    adminLoadOrders();
}

// ---------- TAB SWITCHING ----------
function adminSwitchTab(tabName) {
    document.querySelectorAll('.admin-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
    });
    document.querySelectorAll('.admin-panel').forEach(p => {
        p.classList.toggle('active', p.id === 'admin-panel-' + tabName);
    });
}

// ---------- REFRESH ALL ----------
function adminRefreshAll() {
    adminToast('Refreshing all data…', 'default');
    adminLoadStats();
    adminLoadPendingVendors();
    adminLoadAllVendors();
    adminLoadPendingProducts();
    adminLoadAllProducts();
    adminLoadPayouts();
    adminLoadOrders();
}

// ============================================
// STATS / OVERVIEW
// ============================================

async function adminLoadStats() {
    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/stats?key=${encodeURIComponent(adminState.key)}`);
        if (res.status === 401) {
            console.error('[admin] Stats 401 — clearing session and showing login');
            sessionStorage.removeItem('iShopAdminKey');
    localStorage.removeItem('iShopAdminKey');
            adminState.key = '';
            document.getElementById('adminMainScreen').style.display = 'none';
            document.getElementById('adminLoginScreen').style.display = 'flex';
            const fb = document.getElementById('adminLoginFeedback');
            if (fb) { fb.className = 'admin-feedback error'; fb.textContent = 'Session expired. Please enter your admin key again.'; }
            return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.status) {
            adminState.stats = data.stats;
            adminRenderStats();
        }
    } catch (err) {
        console.error('Admin stats error:', err);
    }
}

function adminRenderStats() {
    const container = document.getElementById('adminStatsGrid');
    if (!container || !adminState.stats) return;

    const s = adminState.stats;
    const fmt = (n) => Number(n || 0).toLocaleString();

    container.innerHTML = `
        <div class="admin-stat-card">
            <div class="admin-stat-icon"><i class="fas fa-store"></i></div>
            <div class="admin-stat-label">Pending Vendors</div>
            <div class="admin-stat-value">${fmt(s.pendingVendors)}</div>
            <div class="admin-stat-hint">${fmt(s.approvedVendors)} approved · ${fmt(s.totalVendors)} total</div>
        </div>
        <div class="admin-stat-card">
            <div class="admin-stat-icon green"><i class="fas fa-box"></i></div>
            <div class="admin-stat-label">Live Products</div>
            <div class="admin-stat-value">${fmt(s.liveProducts)}</div>
            <div class="admin-stat-hint">${fmt(s.draftProducts)} awaiting review</div>
        </div>
        <div class="admin-stat-card">
            <div class="admin-stat-icon blue"><i class="fas fa-shopping-bag"></i></div>
            <div class="admin-stat-label">Total Orders</div>
            <div class="admin-stat-value">${fmt(s.totalOrders)}</div>
            <div class="admin-stat-hint">${fmt(s.ordersToday)} placed today</div>
        </div>
        <div class="admin-stat-card highlight">
            <div class="admin-stat-icon purple"><i class="fas fa-naira-sign"></i></div>
            <div class="admin-stat-label">Revenue</div>
            <div class="admin-stat-value">₦${fmt(s.revenue)}</div>
            <div class="admin-stat-hint">${fmt(s.paidOrders)} paid orders</div>
        </div>
        <div class="admin-stat-card">
            <div class="admin-stat-icon red"><i class="fas fa-money-bill-wave"></i></div>
            <div class="admin-stat-label">Pending Payouts</div>
            <div class="admin-stat-value">${fmt(s.pendingPayouts)}</div>
            <div class="admin-stat-hint">Vendor requests waiting</div>
        </div>
    `;

    // Update tab badges
    adminUpdateBadge('adminBadgeVendors', s.pendingVendors);
    adminUpdateBadge('adminBadgeProducts', s.draftProducts);
    adminUpdateBadge('adminBadgePayouts', s.pendingPayouts);
}

function adminUpdateBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count && count > 0) {
        el.textContent = count;
        el.style.display = 'inline-flex';
    } else {
        el.style.display = 'none';
    }
}

// ============================================
// VENDORS
// ============================================

async function adminLoadPendingVendors() {
    const container = document.getElementById('adminPendingVendorsList');
    if (!container) return;

    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/vendors/pending?key=${encodeURIComponent(adminState.key)}`);
        const data = await res.json();
        if (!res.ok || !data.status) throw new Error(data.error || 'Failed');
        adminState.pendingVendors = data.vendors || [];
        adminRenderPendingVendors();
    } catch (err) {
        container.innerHTML = `<div class="admin-error"><i class="fas fa-exclamation-triangle"></i>Could not load pending vendors.</div>`;
    }
}

function adminRenderPendingVendors() {
    const container = document.getElementById('adminPendingVendorsList');
    if (!container) return;

    if (adminState.pendingVendors.length === 0) {
        container.innerHTML = `
            <div class="admin-empty">
                <i class="fas fa-check-circle"></i>
                No pending vendor applications. You're all caught up.
            </div>
        `;
        return;
    }

    container.innerHTML = adminState.pendingVendors.map(v => `
        <div class="admin-card">
            <div class="admin-card-media"><i class="fas fa-store"></i></div>
            <div class="admin-card-body">
                <h3 class="admin-card-title">${adminEscape(v.businessName || 'Unnamed')}</h3>
                <p class="admin-card-meta"><strong>Owner:</strong> ${adminEscape(v.ownerName || '—')}</p>
                <p class="admin-card-meta"><strong>Email:</strong> ${adminEscape(v.email || '—')}</p>
                <p class="admin-card-meta"><strong>Phone:</strong> ${adminEscape(v.phone || '—')}</p>
                <p class="admin-card-meta"><strong>Location:</strong> ${adminEscape(adminTitle(v.lga))}, ${adminEscape(adminTitle(v.state))}</p>
                <p class="admin-card-meta"><strong>Categories:</strong> ${adminEscape((v.categories || []).join(', ') || '—')}</p>
                <span class="admin-card-badge pending">Pending</span>
            </div>
            <div class="admin-card-actions">
                <button class="admin-btn admin-btn-success" onclick="adminApproveVendor('${v.documentId}', '${adminEscape(v.businessName || '')}')">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="admin-btn admin-btn-danger" onclick="adminRejectVendor('${v.documentId}', '${adminEscape(v.businessName || '')}')">
                    <i class="fas fa-times"></i> Reject
                </button>
            </div>
        </div>
    `).join('');
}

async function adminLoadAllVendors() {
    const container = document.getElementById('adminAllVendorsList');
    if (!container) return;

    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/vendors?key=${encodeURIComponent(adminState.key)}`);
        const data = await res.json();
        if (!res.ok || !data.status) throw new Error(data.error || 'Failed');
        adminState.vendors = data.vendors || [];
        adminRenderAllVendors();
    } catch (err) {
        container.innerHTML = `<div class="admin-error"><i class="fas fa-exclamation-triangle"></i>Could not load vendors.</div>`;
    }
}

function adminRenderAllVendors() {
    const container = document.getElementById('adminAllVendorsList');
    if (!container) return;

    if (adminState.vendors.length === 0) {
        container.innerHTML = `<div class="admin-empty"><i class="fas fa-store"></i>No vendors yet.</div>`;
        return;
    }

    container.innerHTML = adminState.vendors.map(v => `
        <div class="admin-card">
            <div class="admin-card-media"><i class="fas fa-store"></i></div>
            <div class="admin-card-body">
                <h3 class="admin-card-title">${adminEscape(v.businessName || 'Unnamed')}</h3>
                <p class="admin-card-meta">${adminEscape(v.email || '—')} · ${adminEscape(v.phone || '—')}</p>
                <span class="admin-card-badge ${adminEscape(v.approvalStatus || 'pending')}">${adminEscape(v.approvalStatus || 'pending')}</span>
            </div>
            <div class="admin-card-actions">
                ${v.approvalStatus === 'approved' ? `
                    <button class="admin-btn admin-btn-secondary" onclick="adminRejectVendor('${v.documentId}', '${adminEscape(v.businessName || '')}')">
                        <i class="fas fa-times"></i> Revoke
                    </button>
                ` : v.approvalStatus === 'pending' ? `
                    <button class="admin-btn admin-btn-success" onclick="adminApproveVendor('${v.documentId}', '${adminEscape(v.businessName || '')}')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="admin-btn admin-btn-secondary" onclick="adminRejectVendor('${v.documentId}', '${adminEscape(v.businessName || '')}')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                ` : `
                    <button class="admin-btn admin-btn-success" onclick="adminApproveVendor('${v.documentId}', '${adminEscape(v.businessName || '')}')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                `}
            </div>
        </div>
    `).join('');
}

function adminApproveVendor(vendorDocumentId, businessName) {
    // Sync key from storage to avoid staleness
    adminState.key = sessionStorage.getItem('iShopAdminKey') || localStorage.getItem('iShopAdminKey') || adminState.key;

    adminConfirm({
        title: 'Approve Vendor?',
        message: `Approve "${businessName || 'this vendor'}"? They'll be able to list products immediately.`,
        icon: 'success',
        iconName: 'check',
        btnText: 'Yes, Approve',
        btnClass: 'admin-btn-success',
        onConfirm: async () => {
            console.log('[approve] callback fired for', vendorDocumentId);
            try {
                const res = await fetch(`${ADMIN_API_BASE}/api/admin/vendors/${vendorDocumentId}/approve?key=${encodeURIComponent(adminState.key)}`, {
                    method: 'POST',
                });
                const data = await res.json();
                console.log('[approve] response:', res.status, data);
                if (!res.ok || !data.status) throw new Error(data.error || 'Failed');
                adminToast('Vendor approved ✅', 'success');
                adminLoadPendingVendors();
                adminLoadAllVendors();
                adminLoadStats();
            } catch (err) {
                console.error('[approve] error:', err);
                adminToast('Could not approve vendor', 'error');
            }
        },
    });
}

function adminRejectVendor(vendorId, businessName) {
    adminState.key = sessionStorage.getItem('iShopAdminKey') || localStorage.getItem('iShopAdminKey') || adminState.key;

    adminConfirm({
        title: 'Reject Vendor?',
        message: `"${businessName}" will be marked as rejected. They'll receive a rejection email.`,
        icon: 'danger',
        iconName: 'times',
        btnText: 'Yes, Reject',
        btnClass: 'admin-btn-danger',
        onConfirm: async () => {
            try {
                const res = await fetch(`${ADMIN_API_BASE}/api/admin/vendors/${vendorId}/reject?key=${encodeURIComponent(adminState.key)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: '' }),
                });
                const data = await res.json();
                if (!res.ok || !data.status) throw new Error(data.error || 'Failed');
                adminToast('Vendor rejected', 'success');
                adminLoadPendingVendors();
                adminLoadAllVendors();
                adminLoadStats();
            } catch (err) {
                adminToast('Could not reject vendor', 'error');
            }
        },
    });
}

// ============================================
// PRODUCTS
// ============================================

async function adminLoadPendingProducts() {
    const container = document.getElementById('adminPendingProductsList');
    if (!container) return;

    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/products/pending?key=${encodeURIComponent(adminState.key)}`);
        const data = await res.json();
        if (!res.ok || !data.status) throw new Error(data.error || 'Failed');
        adminState.pendingProducts = data.products || [];
        adminRenderPendingProducts();
    } catch (err) {
        container.innerHTML = `<div class="admin-error"><i class="fas fa-exclamation-triangle"></i>Could not load products.</div>`;
    }
}

function adminRenderPendingProducts() {
    const container = document.getElementById('adminPendingProductsList');
    if (!container) return;

    if (adminState.pendingProducts.length === 0) {
        container.innerHTML = `
            <div class="admin-empty">
                <i class="fas fa-check-circle"></i>
                No draft products. Every submitted product is live.
            </div>
        `;
        return;
    }

    container.innerHTML = adminState.pendingProducts.map(p => {
        const img = p.Image && p.Image[0] && p.Image[0].url
            ? (p.Image[0].url.startsWith('http') ? p.Image[0].url : 'https://ishop-cms-production.up.railway.app' + p.Image[0].url)
            : null;
        const vendorName = p.vendor ? p.vendor.businessName : 'Unknown vendor';
        return `
            <div class="admin-card">
                <div class="admin-card-media">
                    ${img ? `<img src="${img}" alt="" />` : `<i class="fas fa-box"></i>`}
                </div>
                <div class="admin-card-body">
                    <h3 class="admin-card-title">${adminEscape(p.Product_Name || 'Untitled')}</h3>
                    <p class="admin-card-meta"><strong>Vendor:</strong> ${adminEscape(vendorName)}</p>
                    <p class="admin-card-meta"><strong>Category:</strong> ${adminEscape(p.Category || '—')}</p>
                    <p class="admin-card-meta"><strong>Price:</strong> ₦${Number(p.Price || 0).toLocaleString()}</p>
                    <span class="admin-card-badge draft">Draft</span>
                </div>
                <div class="admin-card-actions">
                    <button class="admin-btn admin-btn-success" onclick="adminPublishProduct('${p.documentId}', '${adminEscape(p.Product_Name || '')}')">
                        <i class="fas fa-rocket"></i> Publish
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function adminLoadAllProducts() {
    const container = document.getElementById('adminAllProductsList');
    if (!container) return;

    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/products?key=${encodeURIComponent(adminState.key)}`);
        const data = await res.json();
        if (!res.ok || !data.status) throw new Error(data.error || 'Failed');
        adminState.products = data.products || [];
        adminRenderAllProducts();
    } catch (err) {
        container.innerHTML = `<div class="admin-error"><i class="fas fa-exclamation-triangle"></i>Could not load products.</div>`;
    }
}

function adminRenderAllProducts() {
    const container = document.getElementById('adminAllProductsList');
    if (!container) return;

    if (adminState.products.length === 0) {
        container.innerHTML = `<div class="admin-empty"><i class="fas fa-box"></i>No products yet.</div>`;
        return;
    }

    // Only show first 50 for performance
    const list = adminState.products.slice(0, 50);

    container.innerHTML = list.map(p => {
        const img = p.Image && p.Image[0] && p.Image[0].url
            ? (p.Image[0].url.startsWith('http') ? p.Image[0].url : 'https://ishop-cms-production.up.railway.app' + p.Image[0].url)
            : null;
        const isLive = !!p.publishedAt;
        return `
            <div class="admin-card">
                <div class="admin-card-media">
                    ${img ? `<img src="${img}" alt="" />` : `<i class="fas fa-box"></i>`}
                </div>
                <div class="admin-card-body">
                    <h3 class="admin-card-title">${adminEscape(p.Product_Name || 'Untitled')}</h3>
                    <p class="admin-card-meta">₦${Number(p.Price || 0).toLocaleString()} · ${adminEscape(p.Category || '—')}</p>
                    <span class="admin-card-badge ${isLive ? 'live' : 'draft'}">${isLive ? 'Live' : 'Draft'}</span>
                </div>
                <div class="admin-card-actions">
                    ${isLive ? `
                        <button class="admin-btn admin-btn-secondary" onclick="adminUnpublishProduct('${p.documentId}', '${adminEscape(p.Product_Name || '')}')">
                            <i class="fas fa-eye-slash"></i> Unpublish
                        </button>
                    ` : `
                        <button class="admin-btn admin-btn-success" onclick="adminPublishProduct('${p.documentId}', '${adminEscape(p.Product_Name || '')}')">
                            <i class="fas fa-rocket"></i> Publish
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('') + (adminState.products.length > 50 ? `<div class="admin-empty">Showing 50 of ${adminState.products.length}. Use the "Drafts" filter or search Strapi admin for the rest.</div>` : '');
}

function adminPublishProduct(documentId, productName) {
    adminConfirm({
        title: 'Publish Product?',
        message: `"${productName}" will go live on the site. The vendor will receive an email.`,
        icon: 'success',
        iconName: 'rocket',
        btnText: 'Yes, Publish',
        btnClass: 'admin-btn-success',
        onConfirm: async () => {
            try {
                const res = await fetch(`${ADMIN_API_BASE}/api/admin/products/${documentId}/publish?key=${encodeURIComponent(adminState.key)}`, {
                    method: 'POST',
                });
                const data = await res.json();
                if (!res.ok || !data.status) throw new Error(data.error || 'Failed');
                adminToast('Product published 🚀', 'success');
                adminLoadPendingProducts();
                adminLoadAllProducts();
                adminLoadStats();
            } catch (err) {
                adminToast('Could not publish product', 'error');
            }
        },
    });
}

function adminUnpublishProduct(documentId, productName) {
    adminState.key = sessionStorage.getItem('iShopAdminKey') || localStorage.getItem('iShopAdminKey') || adminState.key;

    adminConfirm({
        title: 'Unpublish Product?',
        message: `"${productName}" will be hidden from the site until you publish it again.`,
        icon: 'danger',
        iconName: 'eye-slash',
        btnText: 'Yes, Unpublish',
        btnClass: 'admin-btn-danger',
        onConfirm: async () => {
            try {
                const res = await fetch(`${ADMIN_API_BASE}/api/admin/products/${documentId}/unpublish?key=${encodeURIComponent(adminState.key)}`, {
                    method: 'POST',
                });
                const data = await res.json();
                if (!res.ok || !data.status) throw new Error(data.error || 'Failed');
                adminToast('Product unpublished', 'success');
                adminLoadPendingProducts();
                adminLoadAllProducts();
                adminLoadStats();
            } catch (err) {
                adminToast('Could not unpublish product', 'error');
            }
        },
    });
}

// ============================================
// PAYOUTS
// ============================================

async function adminLoadPayouts() {
    const container = document.getElementById('adminPayoutsList');
    if (!container) return;

    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/payouts/pending?key=${encodeURIComponent(adminState.key)}`);
        const data = await res.json();
        if (!res.ok || !data.status) throw new Error(data.error || 'Failed');
        adminState.payouts = data.payouts || [];
        adminRenderPayouts();
    } catch (err) {
        container.innerHTML = `<div class="admin-error"><i class="fas fa-exclamation-triangle"></i>Could not load payouts.</div>`;
    }
}

function adminRenderPayouts() {
    const container = document.getElementById('adminPayoutsList');
    if (!container) return;

    if (adminState.payouts.length === 0) {
        container.innerHTML = `
            <div class="admin-empty">
                <i class="fas fa-check-circle"></i>
                No pending payouts. All vendors are settled up.
            </div>
        `;
        return;
    }

    const fmt = (n) => '₦' + Number(n || 0).toLocaleString();

    container.innerHTML = adminState.payouts.map(p => `
        <div class="admin-card">
            <div class="admin-card-media"><i class="fas fa-money-bill-wave"></i></div>
            <div class="admin-card-body">
                <h3 class="admin-card-title">${adminEscape(p.businessName || 'Vendor')}</h3>
                <p class="admin-card-meta"><strong>Bank:</strong> ${adminEscape(p.bankName || '—')}</p>
                <p class="admin-card-meta"><strong>Account Name:</strong> ${adminEscape(p.bankAccountName || '—')}</p>
                <p class="admin-card-meta"><strong>Account Number:</strong> ${adminEscape(p.bankAccountNumber || '—')}</p>
                <p class="admin-card-meta"><strong>Request ID:</strong> ${adminEscape(p.requestId || '—')}</p>
                <p class="admin-card-meta" style="font-size:1.05rem;color:#0d1b2a;font-weight:700;margin-top:0.5rem;">
                    ${fmt(p.amount)}
                </p>
            </div>
            <div class="admin-card-actions">
                <button class="admin-btn admin-btn-success" onclick="adminMarkPaid('${p.vendorId}', '${p.requestId}', '${adminEscape(p.businessName || '')}')">
                    <i class="fas fa-check"></i> Mark Paid
                </button>
            </div>
        </div>
    `).join('');
}

function adminMarkPaid(vendorId, requestId, businessName) {
    adminConfirm({
        title: 'Mark Payout as Paid?',
        message: `Confirm that you've sent the money to ${businessName}'s bank account. This moves it to their payout history.`,
        icon: 'success',
        iconName: 'money-bill-wave',
        btnText: 'Yes, Mark Paid',
        btnClass: 'admin-btn-success',
        onConfirm: async () => {
            try {
                const res = await fetch(`${ADMIN_API_BASE}/api/admin/payouts/${vendorId}/${requestId}/mark-paid?key=${encodeURIComponent(adminState.key)}`, {
                    method: 'POST',
                });
                const data = await res.json();
                if (!res.ok || !data.status) throw new Error(data.error || 'Failed');
                adminToast('Payout marked as paid 💸', 'success');
                adminLoadPayouts();
                adminLoadStats();
            } catch (err) {
                adminToast('Could not mark payout as paid', 'error');
            }
        },
    });
}

// ============================================
// ORDERS
// ============================================

async function adminLoadOrders() {
    const container = document.getElementById('adminOrdersList');
    if (!container) return;

    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/orders?key=${encodeURIComponent(adminState.key)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        adminState.orders = data.data || [];
        adminRenderOrders();
    } catch (err) {
        container.innerHTML = `<div class="admin-error"><i class="fas fa-exclamation-triangle"></i>Could not load orders.</div>`;
    }
}

function adminRenderOrders() {
    const container = document.getElementById('adminOrdersList');
    if (!container) return;

    if (adminState.orders.length === 0) {
        container.innerHTML = `<div class="admin-empty"><i class="fas fa-shopping-bag"></i>No orders yet.</div>`;
        return;
    }

    const list = adminState.orders.slice(0, 50);
    const fmt = (n) => '₦' + Number(n || 0).toLocaleString();

    container.innerHTML = list.map(o => {
        const status = (o.orderStatus || 'pending').toLowerCase();
        const date = new Date(o.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });
        const itemsCount = Array.isArray(o.items) ? o.items.length : 0;
        return `
            <div class="admin-card">
                <div class="admin-card-media"><i class="fas fa-receipt"></i></div>
                <div class="admin-card-body">
                    <h3 class="admin-card-title">${adminEscape(o.reference || '—')}</h3>
                    <p class="admin-card-meta"><strong>${adminEscape(o.customerName || 'Customer')}</strong> · ${adminEscape(o.customerEmail || '')}</p>
                    <p class="admin-card-meta">${itemsCount} item${itemsCount === 1 ? '' : 's'} · ${fmt(o.amount)} · ${date}</p>
                    <span class="admin-card-badge ${status}">${status}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// HELPERS
// ============================================

function adminEscape(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

function adminTitle(s) {
    if (!s) return '';
    return String(s).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function adminToast(message, type = 'default') {
    const wrap = document.getElementById('adminToastWrap');
    if (!wrap) return;
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    const toast = document.createElement('div');
    toast.className = 'admin-toast ' + type;
    toast.innerHTML = `<i class="fas fa-${icon}"></i><span>${adminEscape(message)}</span>`;
    wrap.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

let adminConfirmCallback = null;

function adminConfirm(opts) {
    try {
        const { title, message, icon, iconName, btnText, btnClass, onConfirm } = opts || {};

        const modal = document.getElementById('adminConfirmModal');
        const titleEl = document.getElementById('adminConfirmModalTitle');
        const msgEl = document.getElementById('adminConfirmModalMessage');
        const iconEl = document.getElementById('adminConfirmModalIcon');
        const btnEl = document.getElementById('adminConfirmModalBtn');

        if (!modal) {
            console.error('[adminConfirm] modal element not found');
            return;
        }

        if (titleEl) titleEl.textContent = title || 'Confirm';
        if (msgEl) msgEl.textContent = message || '';
        if (iconEl) {
            iconEl.className = 'admin-modal-icon ' + (icon || '');
            iconEl.innerHTML = `<i class="fas fa-${iconName || 'question-circle'}"></i>`;
        }
        if (btnEl) {
            btnEl.textContent = btnText || 'Confirm';
            btnEl.className = 'admin-btn ' + (btnClass || 'admin-btn-primary');
        }

        adminConfirmCallback = onConfirm;

        // Clone the button to strip ALL previous listeners, then wire fresh
        if (btnEl) {
            const freshBtn = btnEl.cloneNode(true);
            btnEl.parentNode.replaceChild(freshBtn, btnEl);
            freshBtn.addEventListener('click', async (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                console.log('[adminConfirm] confirm button clicked');

                // IMPORTANT: grab the callback BEFORE closing the modal
                const cb = adminConfirmCallback;

                // Now it's safe to reset the modal state
                adminCloseConfirm();

                // And only then run the callback
                if (typeof cb === 'function') {
                    try {
                        await cb();
                    } catch (e) {
                        console.error('[adminConfirm] onConfirm threw:', e);
                    }
                } else {
                    console.warn('[adminConfirm] no callback found');
                }
            });
        }

        // Also wire the Cancel button via delegation (it uses onclick="adminCloseConfirm()" already, fine)

        modal.style.display = 'flex';
        modal.style.zIndex = '999999';

        console.log('[adminConfirm] opened modal for:', title);
    } catch (err) {
        console.error('[adminConfirm] error:', err);
        if (typeof opts?.onConfirm === 'function' && window.confirm(opts?.title || 'Confirm this action?')) {
            try { opts.onConfirm(); } catch (e) { console.error(e); }
        }
    }
}

function adminCloseConfirm() {
    const modal = document.getElementById('adminConfirmModal');
    if (modal) modal.style.display = 'none';
    adminConfirmCallback = null;
}

// Close modal on overlay click
document.addEventListener('click', function (e) {
    const modal = document.getElementById('adminConfirmModal');
    if (modal && e.target === modal) adminCloseConfirm();
});

// ---------- AUTO-INIT ----------
// Handled by initializeApp() above — no separate init needed for admin.

/* ============================================ */
/* VENDOR ORDERS — dedicated view */
/* ============================================ */

const VENDOR_ORDERS_API = 'https://ishop-payments-production.up.railway.app';

const vendorOrdersState = {
    all: [],
    filtered: [],
    currentFilter: 'all',
    search: '',
};

// ---------- INITIALIZE ----------
function initVendorOrdersPage() {
    const container = document.getElementById('vendorOrdersContainer');
    if (!container) return;

    const jwt = localStorage.getItem('iShopJwt');
    if (!jwt) {
        container.innerHTML = `
            <div class="vendor-empty-state">
                <div class="vendor-empty-icon"><i class="fas fa-user-lock"></i></div>
                <h3>Please log in</h3>
                <p>You need to be logged in to view your orders.</p>
                <a href="login.html" class="vendor-add-btn" style="margin: 0 auto;">
                    <i class="fas fa-sign-in-alt"></i> Log In
                </a>
            </div>
        `;
        return;
    }

    // Wire filter buttons
    document.querySelectorAll('.vendor-order-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.vendor-order-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            vendorOrdersState.currentFilter = btn.dataset.filter;
            applyVendorOrderFilters();
        });
    });

    // Wire search
    const search = document.getElementById('vendorOrdersSearch');
    if (search) {
        let debounce;
        search.addEventListener('input', function () {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                vendorOrdersState.search = this.value.trim().toLowerCase();
                applyVendorOrderFilters();
            }, 200);
        });
    }

    loadVendorOrders(jwt);
}

// ---------- FETCH ----------
async function loadVendorOrders(jwt) {
    const container = document.getElementById('vendorOrdersContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="vendor-loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading your orders…</p>
        </div>
    `;

    try {
        const res = await fetch(`${VENDOR_ORDERS_API}/api/vendors/orders`, {
            headers: { 'Authorization': `Bearer ${jwt}` },
        });

        if (res.status === 403) {
            container.innerHTML = `
                <div class="vendor-empty-state">
                    <div class="vendor-empty-icon"><i class="fas fa-hourglass-half"></i></div>
                    <h3>Account pending approval</h3>
                    <p>Your vendor account is still being reviewed. Orders will appear here once you're approved.</p>
                    <a href="vendor-dashboard.html" class="vendor-add-btn" style="margin: 0 auto;">
                        <i class="fas fa-tachometer-alt"></i> Back to Dashboard
                    </a>
                </div>
            `;
            return;
        }
        if (res.status === 404) {
            container.innerHTML = `
                <div class="vendor-empty-state">
                    <div class="vendor-empty-icon"><i class="fas fa-store"></i></div>
                    <h3>Not a vendor yet</h3>
                    <p>You need a vendor account to view orders.</p>
                    <a href="become-a-vendor.html" class="vendor-add-btn" style="margin: 0 auto;">
                        <i class="fas fa-rocket"></i> Become a Vendor
                    </a>
                </div>
            `;
            return;
        }

        const data = await res.json();
        if (!res.ok || !data.status) {
            throw new Error(data.error || 'Could not load orders');
        }

        vendorOrdersState.all = data.orders || [];
        updateVendorOrderStats();
        applyVendorOrderFilters();
    } catch (err) {
        console.error('Vendor orders load error:', err);
        container.innerHTML = `
            <div class="vendor-error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${escapeHtml(err.message)}</p>
                <button class="vendor-btn-secondary" onclick="initVendorOrdersPage()" style="margin-top: 1rem;">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
    }
}

// ---------- STATS ----------
function updateVendorOrderStats() {
    const orders = vendorOrdersState.all;
    const el = (id) => document.getElementById(id);

    const total = orders.length;
    const processing = orders.filter(o => (o.orderStatus || '').toLowerCase() === 'processing').length;
    const shipped = orders.filter(o => (o.orderStatus || '').toLowerCase() === 'shipped').length;
    const delivered = orders.filter(o => (o.orderStatus || '').toLowerCase() === 'delivered').length;

    if (el('vendorOrdersTotal')) el('vendorOrdersTotal').textContent = total;
    if (el('vendorOrdersProcessing')) el('vendorOrdersProcessing').textContent = processing;
    if (el('vendorOrdersShipped')) el('vendorOrdersShipped').textContent = shipped;
    if (el('vendorOrdersDelivered')) el('vendorOrdersDelivered').textContent = delivered;
}

// ---------- FILTERS ----------
function applyVendorOrderFilters() {
    const { all, currentFilter, search } = vendorOrdersState;
    let filtered = [...all];

    if (currentFilter !== 'all') {
        filtered = filtered.filter(o => (o.orderStatus || '').toLowerCase() === currentFilter);
    }

    if (search) {
        filtered = filtered.filter(o =>
            (o.reference || '').toLowerCase().includes(search) ||
            (o.customerName || '').toLowerCase().includes(search) ||
            (o.shippingName || '').toLowerCase().includes(search) ||
            (o.address || '').toLowerCase().includes(search)
        );
    }

    vendorOrdersState.filtered = filtered;
    renderVendorOrders(filtered);
}

// ---------- RENDER ----------
function renderVendorOrders(orders) {
    const container = document.getElementById('vendorOrdersContainer');
    if (!container) return;

    if (vendorOrdersState.all.length === 0) {
        container.innerHTML = `
            <div class="vendor-empty-state">
                <div class="vendor-empty-icon"><i class="fas fa-shopping-bag"></i></div>
                <h3>No orders yet</h3>
                <p>Once customers buy your products, their orders will show up here with shipping details.</p>
                <a href="vendor-products.html" class="vendor-add-btn" style="margin: 0 auto;">
                    <i class="fas fa-box"></i> Manage My Products
                </a>
            </div>
        `;
        return;
    }

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="vendor-empty-state">
                <div class="vendor-empty-icon"><i class="fas fa-search"></i></div>
                <h3>No orders match your filter</h3>
                <p>Try a different filter or clear your search.</p>
            </div>
        `;
        return;
    }

    const fmt = (n) => '₦' + Number(n || 0).toLocaleString();
    const titleCase = (s) => (s || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const cardsHTML = orders.map(o => {
        const status = (o.orderStatus || 'paid').toLowerCase();
        const itemsHTML = (o.items || []).map(item => `
            <div class="vo-item-row">
                <span class="vo-item-name">${escapeHtml(item.name)} × ${item.quantity}</span>
                <span class="vo-item-price">${fmt(item.price * item.quantity)}</span>
            </div>
        `).join('');

        const location = [titleCase(o.shippingLga), titleCase(o.shippingState)].filter(Boolean).join(', ');

        // Action button changes based on status
        let actionHTML = '';
        if (status === 'paid') {
            actionHTML = `
                <button class="vo-action-btn primary" onclick="updateVendorOrderStatus('${o.documentId}', 'processing')">
                    <i class="fas fa-box-open"></i> Start Processing
                </button>
            `;
        } else if (status === 'processing') {
            actionHTML = `
                <button class="vo-action-btn primary" onclick="updateVendorOrderStatus('${o.documentId}', 'shipped')">
                    <i class="fas fa-truck"></i> Mark as Shipped
                </button>
            `;
        } else if (status === 'shipped') {
            actionHTML = `
                <button class="vo-action-btn secondary" onclick="updateVendorOrderStatus('${o.documentId}', 'delivered')">
                    <i class="fas fa-check-double"></i> Mark as Delivered
                </button>
            `;
        } else if (status === 'delivered') {
            actionHTML = `<span class="vo-done-badge"><i class="fas fa-check-circle"></i> Fulfilled</span>`;
        }

        const customerPhone = o.shippingPhone || '';
        const waLink = customerPhone
            ? `https://wa.me/234${customerPhone.replace(/^0/, '')}?text=${encodeURIComponent(`Hello ${o.shippingName || o.customerName || 'customer'}, regarding your iShop order ${o.reference}`)}`
            : '';

        return `
            <div class="vendor-order-card">
                <div class="vo-header">
                    <div class="vo-header-left">
                        <div class="vo-ref">${escapeHtml(o.reference || '')}</div>
                        <div class="vo-date">${new Date(o.createdAt).toLocaleDateString('en-NG', {
                            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}</div>
                    </div>
                    <span class="vo-status ${status}">${status}</span>
                </div>

                <div class="vo-grid">
                    <div class="vo-block">
                        <h4><i class="fas fa-map-marker-alt"></i> Ship To</h4>
                        <p><strong>${escapeHtml(o.shippingName || o.customerName || 'Customer')}</strong></p>
                        ${customerPhone ? `<p><i class="fas fa-phone" style="color:#8896a8;width:14px;"></i> ${escapeHtml(customerPhone)}</p>` : ''}
                        ${location ? `<p>${escapeHtml(location)}</p>` : ''}
                        <p>${escapeHtml(o.address || '')}</p>
                        ${o.shippingNotes ? `<p class="vo-notes"><em>Note:</em> ${escapeHtml(o.shippingNotes)}</p>` : ''}
                    </div>
                    <div class="vo-block">
                        <h4><i class="fas fa-receipt"></i> Your Items</h4>
                        ${itemsHTML}
                        <div class="vo-total-row">
                            <span>You earn</span>
                            <span class="vo-total-value">${fmt(o.vendorGross)}</span>
                        </div>
                    </div>
                </div>

                <div class="vo-actions">
                    ${actionHTML}
                    ${waLink ? `
                        <a href="${waLink}" target="_blank" class="vo-action-btn whatsapp">
                            <i class="fab fa-whatsapp"></i> Contact Buyer
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `<div class="vendor-orders-list">${cardsHTML}</div>`;
}

// ---------- UPDATE STATUS ----------
async function updateVendorOrderStatus(orderDocumentId, newStatus) {
    const labels = { processing: 'start processing', shipped: 'mark as shipped', delivered: 'mark as delivered' };
    if (!window.confirm(`Are you sure you want to ${labels[newStatus] || 'update'} this order?`)) return;

    const jwt = localStorage.getItem('iShopJwt');
    if (!jwt) { alert('Please log in again.'); return; }

    // Optimistic UI: update local state immediately
    const order = vendorOrdersState.all.find(o => o.documentId === orderDocumentId);
    if (order) order.orderStatus = newStatus;
    updateVendorOrderStats();
    applyVendorOrderFilters();
    showVendorProductsToast('Order status updated', 'success');

    try {
        const res = await fetch(`${VENDOR_ORDERS_API}/api/vendors/orders/${orderDocumentId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`,
            },
            body: JSON.stringify({ status: newStatus }),
        });

        const data = await res.json();
        if (!res.ok || !data.status) {
            throw new Error(data.error || 'Update failed');
        }
    } catch (err) {
        console.error('Order status update error:', err);
        showVendorProductsToast(err.message || 'Could not update order', 'error');
        // Reload to get real state
        loadVendorOrders(jwt);
    }
}

// ---------- AUTO-INIT ----------
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVendorOrdersPage);
} else {
    initVendorOrdersPage();
}