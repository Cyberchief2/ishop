// ============================================
// iShop API CONFIGURATION
// ============================================
const API_URL = 'https://ishop-cms-production.up.railway.app/api/products?populate[0]=Image&populate[1]=Specifications';
const IMAGE_BASE_URL = 'https://ishop-cms-production.up.railway.app';
const PAYMENT_API = 'https://ishop-payments-production.up.railway.app/api/orders/initialize';
const FREE_DOWNLOAD_API = 'https://ishop-payments-production.up.railway.app/api/free-download';
const PAID_DOWNLOAD_API = 'https://ishop-payments-production.up.railway.app/api/download';
const STRAPI_AUTH_BASE = 'https://ishop-cms-production.up.railway.app';

// ============================================
// GOOGLE OAUTH CONFIGURATION
// ============================================
const GOOGLE_CLIENT_ID = '1095016186699-sp0adum1qn7urnq8ka87mvjglmhoqu6o.apps.googleusercontent.com';

// ============================================
// FETCH PRODUCTS FROM STRAPI
// ============================================
async function fetchProducts() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const products = data.data || [];
        console.log('✅ Products fetched from Strapi:', products.length);
        return products;
    } catch (error) {
        console.error('❌ Error fetching products:', error);
        return [];
    }
}

// ============================================
// DESCRIPTION PARSER — Handles paragraphs, lists, nested blocks
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
    let imageUrls = ['https://via.placeholder.com/400x400/1a2a3a/f9c74f?text=No+Image'];
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
            imageUrls = ['https://via.placeholder.com/400x400/1a2a3a/f9c74f?text=No+Image'];
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
        category: (strapiProduct.Category || 'uncategorized').toLowerCase(),
        subType: (strapiProduct.Sub_Type || '').toLowerCase(),
        type: (strapiProduct.Type || 'physical').toLowerCase(),
        price: parseFloat(strapiProduct.Price || 0),
        rating: parseFloat(strapiProduct.Rating || 4.5),
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
// RENDER PRODUCTS (clickable cards)
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
                <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400/1a2a3a/f9c74f?text=No+Image'" />
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p class="product-category">${product.category}</p>
                <p class="product-price">${isFreeDigital ? '<span style="color:#4CAF50;font-weight:700;">FREE</span>' : '₦' + product.price.toLocaleString()}</p>
                <div class="product-rating">⭐ ${product.rating}</div>
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
            <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/80x80/1a2a3a/f9c74f?text=No+Image'" />
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
        const delivery = cart.some(item => item.type === 'physical') ? 2500 : 0;
        const total = subtotal + delivery;

        summary.innerHTML = `
            <h3>Order Summary</h3>
            <div class="summary-row">
                <span>Subtotal</span>
                <span>₦${subtotal.toLocaleString()}</span>
            </div>
            ${delivery > 0 ? `
            <div class="summary-row">
                <span>Delivery</span>
                <span>₦${delivery.toLocaleString()}</span>
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
// RENDER HOMEPAGE (multi-section layout)
// ============================================
async function renderHomepage() {
    console.log('🏠 Rendering homepage...');

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

        const excludedFromFeatured = ['ebook', 'course', 'template'];
        const featuredPool = products.filter(p => !excludedFromFeatured.includes(p.subType));
        const featured = getVarietyProducts(featuredPool, 12);
        renderProducts('featuredProducts', featured);

        const electronicsProducts = products.filter(p => p.category === 'electronics');
        const freshElectronics = shuffleArray([...electronicsProducts]).slice(0, 4);
        renderProducts('freshElectronics', freshElectronics);

        const fashionProducts = products.filter(p => p.category === 'fashion');
        const fashionPicks = shuffleArray([...fashionProducts]).slice(0, 4);
        renderProducts('fashionPicks', fashionPicks);

        const digitalProducts = products.filter(p => p.category === 'digital');
        const digitalFeatured = shuffleArray([...digitalProducts]).slice(0, 4);
        renderProducts('featuredDigitalProducts', digitalFeatured);

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
                            category === 'beauty' ? 'beautyProducts' : null;
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
                                    <span>On orders over ₦50,000</span>
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
    const delivery = cart.some(item => item.type === 'physical') ? 2500 : 0;
    const total = subtotal + delivery;
    const itemsCount = cart.reduce((s, i) => s + i.quantity, 0);

    const itemsHTML = cart.map(item => `
        <div class="cart-preview-item">
            <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/44x44/1a2a3a/f9c74f?text=+'" />
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
            <span>${delivery > 0 ? '₦' + delivery.toLocaleString() : '<span style="color:#4CAF50;">Free!</span>'}</span>
        </div>
        <div class="summary-row total">
            <span>Total</span>
            <span>₦${total.toLocaleString()}</span>
        </div>
    `;
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

function updateAuthUI() {
    const authIcon = document.getElementById('authIcon');
    const user = getCurrentUser();
    if (authIcon) {
        if (user) {
            authIcon.innerHTML = '<i class="fas fa-user-check" style="color:#f9c74f;"></i>';
            authIcon.title = 'My Profile';
            authIcon.href = 'profile.html';
        } else {
            authIcon.innerHTML = '<i class="fas fa-user-circle"></i>';
            authIcon.title = 'Login / Sign Up';
            authIcon.href = 'login.html';
        }
    }
}

function logoutUser() {
    clearAuthSession();
    updateAuthUI();
    window.location.href = 'index.html';
}

// Keep saveUser for backward-compat
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
        if (differentShipping) {
            shippingName = document.getElementById('shipName')?.value.trim() || name;
            shippingPhone = document.getElementById('shipPhone')?.value.trim() || phone;
            shippingAddress = document.getElementById('shipAddress')?.value.trim() || '';
            shippingNotes = document.getElementById('shipNotes')?.value.trim() || '';
        } else {
            shippingName = name;
            shippingPhone = phone;
            shippingAddress = document.getElementById('address').value.trim();
            shippingNotes = '';
        }

        if (!shippingAddress) {
            alert('Please enter a delivery address.');
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
            const delivery = cart.some(item => item.type === 'physical') ? 2500 : 0;
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
                    differentShipping: differentShipping
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
// SOCIAL LOGIN (Google OAuth temporarily disabled — pending real OAuth setup)
// ============================================
function loginWithGoogle() {
    alert('Google Sign-In is being upgraded. Please use email/password for now.');
}

function handleGoogleCallback() {
    // Disabled until proper OAuth flow is rebuilt
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
                address: ''
            },
            jwt: data.jwt,
            refreshToken: data.refreshToken
        });

        // Try to save phone on the server
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
                address: data.user.address || ''
            },
            jwt: data.jwt,
            refreshToken: data.refreshToken
        });

        updateAuthUI();

        feedback.className = 'success';
        feedback.innerHTML = `✅ Welcome back!`;

        setTimeout(() => {
            window.location.href = 'profile.html';
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
// ACCOUNT DASHBOARD
// ============================================
function switchAccountSection(section) {
    document.querySelectorAll('.account-nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });
    document.querySelectorAll('.account-section').forEach(sec => {
        sec.classList.toggle('active', sec.id === 'section-' + section);
    });
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
// HELP DROPDOWN TOGGLE (mobile + desktop)
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
document.addEventListener('DOMContentLoaded', function() {
    const page = window.location.pathname.split('/').pop().split('?')[0];

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
        renderCheckoutSummary();
        setupCheckoutForm();
    } else if (page === 'wishlist.html') {
        updateWishlistUI();
    } else if (page === 'profile.html') {
        loadProfilePage();
        switchAccountSection('overview');
    } else if (page === 'electronics.html' || page === 'fashion.html' || page === 'beauty.html') {
        const category = page.replace('.html', '');
        const urlParams = new URLSearchParams(window.location.search);
        const subType = urlParams.get('subtype') || '';
        renderCategory(category, subType);
        setupSubcategoryButtons(category);
    }
});