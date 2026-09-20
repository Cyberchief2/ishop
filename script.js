// ============================================
// STRAPI API CONFIGURATION
// ============================================
const API_URL = 'http://localhost:1337/api/products?populate=*';
const IMAGE_BASE_URL = 'http://localhost:1337';

// ============================================
// GOOGLE OAUTH CONFIGURATION
// ============================================
const GOOGLE_CLIENT_ID = '1003949995784-76ikigvqh1md7hieb9fh1v1t0q2om9jj.apps.googleusercontent.com';

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
        console.log('✅ Products fetched from Strapi:', data.data.length);
        return data.data;
    } catch (error) {
        console.error('❌ Error fetching products:', error);
        return [];
    }
}

// ============================================
// CONVERT STRAPI PRODUCT TO WEBSITE FORMAT
// ============================================
function convertStrapiProduct(strapiProduct) {
    let imageUrl = 'https://via.placeholder.com/400x400/1a2a3a/f9c74f?text=No+Image';
    if (strapiProduct.Image && strapiProduct.Image.length > 0) {
        imageUrl = `${IMAGE_BASE_URL}${strapiProduct.Image[0].url}`;
    }
    
    let features = ['Check product details'];
    let description = 'No description available';
    
    if (strapiProduct.Description && strapiProduct.Description.length > 0) {
        const textParts = strapiProduct.Description
            .filter(block => block.children)
            .flatMap(block => block.children.map(child => child.text))
            .filter(text => text && text.trim());
        
        if (textParts.length > 0) {
            description = textParts.join(' ');
            features = textParts;
        }
    }
    
    // 👇 NEW: Extract specifications
    let specifications = [];
    if (strapiProduct.Specifications && strapiProduct.Specifications.length > 0) {
        specifications = strapiProduct.Specifications
            .filter(spec => spec.spec_name && spec.spec_value)
            .map(spec => ({
                name: spec.spec_name,
                value: spec.spec_value
            }));
    }
    
    return {
        id: strapiProduct.id,
        documentId: strapiProduct.documentId,
        name: strapiProduct.Product_Name || 'Unnamed Product',
        category: strapiProduct.Category?.toLowerCase() || 'uncategorized',
        subType: strapiProduct.Sub_Type?.toLowerCase() || '',
        type: strapiProduct.Type?.toLowerCase() || 'physical',
        price: strapiProduct.Price || 0,
        rating: strapiProduct.Rating || 4.5,
        images: [imageUrl],
        image: imageUrl,
        description: description,
        features: features.length > 0 ? features : ['Check product details'],
        specifications: specifications, // 👈 NEW
        createdAt: strapiProduct.createdAt,
        updatedAt: strapiProduct.updatedAt
    };
}

// ============================================
// SHOPPING CART
// ============================================
let cart = JSON.parse(localStorage.getItem('shopnaijaCart')) || [];

function saveCart() {
    localStorage.setItem('shopnaijaCart', JSON.stringify(cart));
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
        const response = await fetch(`http://localhost:1337/api/products/${productId}?populate=*`);
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
// RENDER FUNCTIONS
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

    container.innerHTML = items.map(product => `
        <div class="product-card ${product.type === 'digital' ? 'digital-product' : ''}">
            ${product.type === 'digital' ? '<span class="digital-badge">💻 Instant Download</span>' : ''}
            <div class="image-container">
                <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400/1a2a3a/f9c74f?text=No+Image'" />
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p class="product-category">${product.category}</p>
                <p class="product-price">₦${product.price.toLocaleString()}</p>
                <div class="product-rating">⭐ ${product.rating}</div>
                <button onclick="addToCart(${product.id})" class="btn-add-cart">
                    ${product.type === 'digital' ? '📥 Buy & Download' : '🛒 Add to Cart'}
                </button>
                <a href="product-detail.html?id=${product.id}" class="btn-view">View Details</a>
            </div>
        </div>
    `).join('');
}

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
//// ============================================
// RENDER HOMEPAGE - WITH VARIETY
// ============================================

async function renderHomepage() {
    console.log('🏠 Rendering homepage...');
    
    try {
        const productData = await fetchProducts();
        console.log('📦 Products fetched from Strapi:', productData.length);
        
        if (productData.length === 0) {
            console.warn('⚠️ No products found in Strapi!');
            document.getElementById('featuredProducts').innerHTML = `
                <div style="text-align:center;padding:3rem;color:#888;grid-column:1/-1;">
                    <i class="fas fa-database" style="font-size:2.5rem;display:block;margin-bottom:0.5rem;"></i>
                    <p>No products available. Please add products in Strapi.</p>
                    <p style="font-size:0.85rem;color:#aaa;">Visit <a href="http://localhost:1337/admin" target="_blank" style="color:#f9c74f;">Strapi Admin</a> to add products.</p>
                </div>
            `;
            return;
        }
        
        const products = productData.map(convertStrapiProduct);
        console.log('🔄 Converted products:', products.length);
        
        // ============================================
        // FEATURED PRODUCTS - VARIETY FROM ALL CATEGORIES
        // ============================================
        
        const featured = getVarietyProducts(products, 8);
        console.log('🎯 Featured products (variety):', featured.length);
        renderProducts('featuredProducts', featured);
        
        // ============================================
        // DIGITAL PRODUCTS SECTION
        // ============================================
        
        const digitalProducts = products.filter(p => p.category === 'digital');
        const digitalFeatured = shuffleArray([...digitalProducts]).slice(0, 4);
        renderProducts('featuredDigitalProducts', digitalFeatured);
        
        console.log('✅ Homepage rendered successfully!');
    } catch (error) {
        console.error('❌ Error rendering homepage:', error);
        document.getElementById('featuredProducts').innerHTML = `
            <div style="text-align:center;padding:3rem;color:#e74c3c;grid-column:1/-1;">
                <i class="fas fa-exclamation-triangle" style="font-size:2.5rem;display:block;margin-bottom:0.5rem;"></i>
                <p>Error loading products. Please check your Strapi connection.</p>
                <p style="font-size:0.85rem;color:#888;">Make sure Strapi is running at http://localhost:1337</p>
            </div>
        `;
    }
}

// ============================================
// HELPER: Get Variety of Products
// ============================================

function getVarietyProducts(products, count = 8) {
    // Group products by category
    const byCategory = {};
    
    products.forEach(p => {
        if (!byCategory[p.category]) {
            byCategory[p.category] = [];
        }
        byCategory[p.category].push(p);
    });
    
    const categories = Object.keys(byCategory);
    console.log('📂 Categories found:', categories);
    
    // Shuffle each category's products
    categories.forEach(cat => {
        byCategory[cat] = shuffleArray([...byCategory[cat]]);
    });
    
    // Round-robin pick from each category for maximum variety
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
        
        // If no products added this round, break
        if (!addedThisRound) break;
        index++;
    }
    
    // If still not enough, fill with random products
    if (result.length < count) {
        const remaining = products.filter(p => !result.includes(p));
        const shuffledRemaining = shuffleArray(remaining);
        while (result.length < count && shuffledRemaining.length > 0) {
            result.push(shuffledRemaining.pop());
        }
    }
    
    return result;
}

// ============================================
// HELPER: Shuffle Array
// ============================================

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function renderShopPage(filter = 'all', search = '', subType = '') {
    console.log('🛒 Rendering shop page...', { filter, search, subType });
    
    try {
        const productData = await fetchProducts();
        let products = productData.map(convertStrapiProduct);
        
        // Filter by main category
        if (filter !== 'all') {
            products = products.filter(p => p.category === filter);
        }
        
        // Filter by sub-category
        if (subType) {
            products = products.filter(p => p.subType === subType);
        }
        
        // Filter by search
        if (search) {
            products = products.filter(p => 
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.category.toLowerCase().includes(search.toLowerCase())
            );
        }
        
        renderProducts('allProducts', products);
        
        // Update page title
        const title = document.querySelector('.page-header h1');
        if (title) {
            const categoryNames = {
                'electronics': '📱 Electronics',
                'fashion': '👗 Fashion',
                'beauty': '💄 Beauty',
                'digital': '💻 Digital Products'
            };
            
            const subTypeNames = {
                'smartphones': 'Smartphones',
                'laptops': 'Laptops',
                'audio': 'Audio',
                'tablets': 'Tablets',
                'smartwatches': 'Smartwatches',
                'accessories': 'Accessories',
                'tv': 'TV & Video',
                'clothing': 'Clothing',
                'shoes': 'Shoes',
                'bags': 'Bags',
                'traditional': 'Traditional Wear',
                'jewelry': 'Jewelry',
                'skincare': 'Skincare',
                'makeup': 'Makeup',
                'fragrances': 'Fragrances',
                'haircare': 'Hair Care',
                'software': 'Software',
                'ebook': 'E-books',
                'course': 'Courses',
                'template': 'Templates'
            };
            
            let newTitle = 'All Products';
            if (subType && subTypeNames[subType]) {
                newTitle = subTypeNames[subType];
            } else if (filter !== 'all' && categoryNames[filter]) {
                newTitle = categoryNames[filter];
            }
            title.textContent = newTitle;
        }
        
        console.log('✅ Shop page rendered with', products.length, 'products');
    } catch (error) {
        console.error('❌ Error rendering shop page:', error);
    }
}

async function renderDigitalPage(filter = 'all') {
    console.log('💻 Rendering digital products page...');
    
    try {
        const productData = await fetchProducts();
        let products = productData.map(convertStrapiProduct).filter(p => p.category === 'digital');
        
        if (filter !== 'all') {
            products = products.filter(p => p.subType === filter);
        }
        
        renderProducts('digitalProductsGrid', products);
        
        const title = document.querySelector('.page-header h1');
        if (title) {
            const filterNames = {
                'all': '💻 Digital Products',
                'software': '💻 Software',
                'ebook': '📚 E-books',
                'course': '🎓 Courses',
                'template': '📄 Templates',
                'graphics': '🎨 Graphics',
                'music': '🎵 Music'
            };
            title.textContent = filterNames[filter] || '💻 Digital Products';
        }
        
        console.log('✅ Digital page rendered with', products.length, 'products');
    } catch (error) {
        console.error('❌ Error rendering digital page:', error);
    }
}

async function renderCategory(category) {
    try {
        const productData = await fetchProducts();
        const products = productData.map(convertStrapiProduct).filter(p => p.category === category);
        
        const containerId = category === 'digital' ? 'digitalCategoryProducts' : 
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
// RENDER PRODUCT DETAIL - KONGA STYLE
// ============================================

async function renderProductDetail() {
    console.log('📄 Rendering product detail...');
    
    try {
        const params = new URLSearchParams(window.location.search);
        const productId = parseInt(params.get('id'));
        
        if (!productId) {
            document.getElementById('productDetail').innerHTML = `
                <div style="text-align:center;padding:3rem;">
                    <h2>Product ID missing</h2>
                    <p>Please select a product from the shop.</p>
                    <a href="shop.html" class="btn-primary">Browse Products</a>
                </div>
            `;
            return;
        }
        
        const productData = await fetchProducts();
        const strapiProduct = productData.find(p => p.id === productId);
        
        const container = document.getElementById('productDetail');
        if (!container) return;

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
        
        let galleryHTML = `
            <div class="product-gallery">
                <div class="gallery-main">
                    <img src="${product.image}" alt="${product.name}" id="mainGalleryImage" />
                    ${product.type === 'digital' ? '<span class="digital-badge-large">💻 Instant Download</span>' : ''}
                </div>
                <div class="gallery-thumbnails">
                    <div class="gallery-thumbnail active" onclick="changeGalleryImage('${product.image}', 0)">
                        <img src="${product.image}" alt="Main view" />
                    </div>
                    ${product.images && product.images.length > 1 ? product.images.slice(1, 4).map((img, index) => `
                        <div class="gallery-thumbnail" onclick="changeGalleryImage('${img}', ${index + 1})">
                            <img src="${img}" alt="View ${index + 2}" />
                        </div>
                    `).join('') : ''}
                </div>
            </div>
        `;
        
        const featuresList = product.features && product.features.length > 0 
            ? product.features.map(f => `<li><i class="fas fa-check-circle"></i> ${f}</li>`).join('')
            : '<li><i class="fas fa-check-circle"></i> Premium quality product</li>';
        
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
                            <div class="product-price">₦${product.price.toLocaleString()}</div>
                            ${product.oldPrice ? `
                                <div class="product-old-price">₦${product.oldPrice.toLocaleString()}</div>
                                <div class="product-discount">-${Math.round((1 - product.price / product.oldPrice) * 100)}%</div>
                            ` : ''}
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
                        
                        <div class="product-quantity-section">
                            <label for="quantity">Quantity:</label>
                            <div class="quantity-selector">
                                <button onclick="changeQuantity(-1)">−</button>
                                <span id="quantityDisplay">1</span>
                                <button onclick="changeQuantity(1)">+</button>
                            </div>
                        </div>
                        
                        <div class="product-actions">
                            <button onclick="addToCart(${product.id})" class="btn-add-to-cart">
                                <i class="fas fa-shopping-cart"></i> Add to Cart
                            </button>
                            <button onclick="buyNow(${product.id})" class="btn-buy-now">
                                <i class="fas fa-bolt"></i> Buy Now
                            </button>
                            <button onclick="toggleWishlist(${product.id})" class="btn-wishlist">
                                <i class="fas fa-heart"></i>
                            </button>
                        </div>
                        
                        <div class="product-seller-info">
                            <div class="seller-info">
                                <div class="seller-avatar">
                                    <i class="fas fa-store"></i>
                                </div>
                                <div class="seller-details">
                                    <div class="seller-name">ShopNaija Official Store</div>
                                    <div class="seller-stats">
                                        <span><i class="fas fa-star" style="color:#f9c74f;"></i> 4.8 (2,345 reviews)</span>
                                        <span><i class="fas fa-shopping-bag"></i> 10,000+ sales</span>
                                        <span><i class="fas fa-clock"></i> Since 2024</span>
                                    </div>
                                </div>
                            </div>
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
        
        ${product.features && product.features.length > 0 ? `
            <h3 style="margin-top:2rem;">✨ Key Features</h3>
            <ul class="features-list">
                ${featuresList}
            </ul>
        ` : ''}
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
                                <div class="review-item">
                                    <div class="review-header">
                                        <span class="review-name">Chidi O.</span>
                                        <span class="review-stars">⭐ ⭐ ⭐ ⭐ ⭐</span>
                                        <span class="review-date">Verified Purchase</span>
                                    </div>
                                    <p class="review-text">Excellent product! Exactly as described. Fast delivery too.</p>
                                </div>
                                <div class="review-item">
                                    <div class="review-header">
                                        <span class="review-name">Aisha B.</span>
                                        <span class="review-stars">⭐ ⭐ ⭐ ⭐</span>
                                        <span class="review-date">Verified Purchase</span>
                                    </div>
                                    <p class="review-text">Great quality. Would definitely recommend to others.</p>
                                </div>
                                <div class="review-item">
                                    <div class="review-header">
                                        <span class="review-name">Emeka N.</span>
                                        <span class="review-stars">⭐ ⭐ ⭐ ⭐ ⭐</span>
                                        <span class="review-date">Verified Purchase</span>
                                    </div>
                                    <p class="review-text">Fast shipping and product is exactly what I wanted. 5 stars!</p>
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
        
        console.log('✅ Product detail rendered successfully');
    } catch (error) {
        console.error('❌ Error rendering product detail:', error);
    }

    function renderProducts(containerId, productList, limit = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const items = limit ? productList.slice(0, limit) : productList;
    
    if (items.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:2rem;color:#888;">No products found.</p>';
        return;
    }

    // Get wishlist from localStorage
    const wishlist = JSON.parse(localStorage.getItem('shopnaijaWishlist')) || [];

    container.innerHTML = items.map(product => {
        const isInWishlist = wishlist.includes(product.id);
        return `
        <div class="product-card ${product.type === 'digital' ? 'digital-product' : ''}">
            <button class="wishlist-heart ${isInWishlist ? 'active' : ''}" 
                    onclick="event.preventDefault(); toggleWishlistHeart(${product.id}, this)">
                <i class="fa${isInWishlist ? 's' : 'r'} fa-heart"></i>
            </button>
            ${product.type === 'digital' ? '<span class="digital-badge">💻 Instant Download</span>' : ''}
            <div class="image-container">
                <img src="${product.image}" alt="${product.name}" loading="lazy" />
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p class="product-category">${product.category}</p>
                <p class="product-price">₦${product.price.toLocaleString()}</p>
                <div class="product-rating">⭐ ${product.rating}</div>
                <button onclick="addToCart(${product.id})" class="btn-add-cart">
                    ${product.type === 'digital' ? '📥 Buy & Download' : '🛒 Add to Cart'}
                </button>
                <a href="product-detail.html?id=${product.id}" class="btn-view">View Details</a>
            </div>
        </div>
        `;
    }).join('');
}

// Toggle wishlist heart
function toggleWishlistHeart(productId, btn) {
    let wishlist = JSON.parse(localStorage.getItem('shopnaijaWishlist')) || [];
    
    if (wishlist.includes(productId)) {
        wishlist = wishlist.filter(id => id !== productId);
        btn.classList.remove('active');
        btn.querySelector('i').className = 'far fa-heart';
    } else {
        wishlist.push(productId);
        btn.classList.add('active');
        btn.querySelector('i').className = 'fas fa-heart';
    }
    
    localStorage.setItem('shopnaijaWishlist', JSON.stringify(wishlist));
}
}

function renderCheckoutSummary() {
    const container = document.getElementById('orderSummary');
    if (!container) return;

    const subtotal = getCartTotal();
    const delivery = cart.some(item => item.type === 'physical') ? 2500 : 0;
    const total = subtotal + delivery;

    container.innerHTML = `
        <h3>Order Summary</h3>
        <div class="summary-row">
            <span>Items</span>
            <span>${cart.reduce((s,i) => s + i.quantity, 0)}</span>
        </div>
        <div class="summary-row">
            <span>Subtotal</span>
            <span>₦${subtotal.toLocaleString()}</span>
        </div>
        <div class="summary-row">
            <span>Delivery</span>
            <span>${delivery > 0 ? '₦' + delivery.toLocaleString() : 'Free!'}</span>
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
    
    dropdown.classList.toggle('active');
    if (arrow) {
        arrow.classList.toggle('rotated');
    }
}

function selectCategory(category) {
    selectedSearchCategory = category;
    document.getElementById('selectedCategory').textContent = category;
    
    const dropdown = document.getElementById('searchDropdown');
    const arrow = document.getElementById('searchArrow');
    dropdown.classList.remove('active');
    if (arrow) {
        arrow.classList.remove('rotated');
    }
}

document.addEventListener('click', function(event) {
    const searchBar = document.querySelector('.search-bar');
    const dropdown = document.getElementById('searchDropdown');
    
    if (searchBar && dropdown && !searchBar.contains(event.target)) {
        dropdown.classList.remove('active');
        const arrow = document.getElementById('searchArrow');
        if (arrow) {
            arrow.classList.remove('rotated');
        }
    }
});

function performSearch() {
    const searchInput = document.getElementById('mainSearch');
    if (searchInput) {
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
            let url = `shop.html?search=${encodeURIComponent(searchTerm)}`;
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
// AUTHENTICATION
// ============================================
function getCurrentUser() {
    return JSON.parse(localStorage.getItem('shopnaijaUser')) || null;
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

function saveUser(userData) {
    localStorage.setItem('shopnaijaUser', JSON.stringify(userData));
}

function logoutUser() {
    localStorage.removeItem('shopnaijaUser');
    updateAuthUI();
    window.location.href = 'index.html';
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
                if (hours < 0) {
                    hours = 23;
                }
            }
        }
        hoursElement.textContent = String(hours).padStart(2, '0');
        minutesElement.textContent = String(minutes).padStart(2, '0');
        secondsElement.textContent = String(seconds).padStart(2, '0');
    }, 1000);
}

// ============================================
// FILTERS & SEARCH
// ============================================

function searchShopProducts() {
    const input = document.getElementById('shopSearch');
    if (input) {
        const search = input.value.toLowerCase();
        const products = document.querySelectorAll('.product-card');
        products.forEach(card => {
            const name = card.querySelector('h3')?.textContent?.toLowerCase() || '';
            if (name.includes(search)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }
}

function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const filter = this.dataset.filter;
            const search = document.getElementById('shopSearch')?.value || '';
            renderShopPage(filter, search);
        });
    });
}

function setupDigitalTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderDigitalPage(this.dataset.type);
        });
    });
}

function setupCheckoutForm() {
    const form = document.getElementById('checkoutForm');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('fullName').value;
        const feedback = document.getElementById('orderFeedback');
        feedback.innerHTML = `
            <div style="background:#d4edda;padding:1.5rem;border-radius:8px;margin-top:1.5rem;">
                <h3 style="color:#155724;">✅ Order Placed Successfully!</h3>
                <p>Thank you, ${name}! Your order has been received.</p>
                ${cart.some(item => item.type === 'digital') ? 
                    '<p>📥 Digital products will be sent to your email within 5 minutes.</p>' : 
                    '<p>📦 You will receive a confirmation email shortly.</p>'}
                <p style="margin-top:1rem;">
                    <a href="index.html" class="btn-primary">Continue Shopping</a>
                </p>
            </div>
        `;
        cart = [];
        saveCart();
        this.reset();
    });
}

// ============================================
// WISHLIST
// ============================================
let wishlist = JSON.parse(localStorage.getItem('shopnaijaWishlist')) || [];

function toggleWishlist(productId) {
    const index = wishlist.indexOf(productId);
    if (index > -1) {
        wishlist.splice(index, 1);
        alert('❤️ Removed from wishlist');
    } else {
        wishlist.push(productId);
        alert('❤️ Added to wishlist!');
    }
    localStorage.setItem('shopnaijaWishlist', JSON.stringify(wishlist));
    updateWishlistUI();
}

function updateWishlistUI() {
    const wishlistItems = document.getElementById('wishlistProducts');
    if (wishlistItems) {
        if (wishlist.length === 0) {
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
                const wishlistProducts = products.filter(p => wishlist.includes(p.id));
                renderProducts('wishlistProducts', wishlistProducts);
            });
        }
    }
}

// ============================================
// TRACK ORDER
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
// GALLERY FUNCTIONS
// ============================================

function changeGalleryImage(imageUrl, index) {
    const mainImage = document.getElementById('mainGalleryImage');
    if (mainImage) {
        mainImage.src = imageUrl;
    }
    
    const thumbnails = document.querySelectorAll('.gallery-thumbnail');
    thumbnails.forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
}

// ============================================
// QUANTITY CONTROLS
// ============================================

let currentQuantity = 1;

function changeQuantity(change) {
    currentQuantity += change;
    if (currentQuantity < 1) currentQuantity = 1;
    if (currentQuantity > 99) currentQuantity = 99;
    const display = document.getElementById('quantityDisplay');
    if (display) display.textContent = currentQuantity;
}

// ============================================
// TAB SWITCHER
// ============================================

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const contentMap = {
        'description': 'descriptionContent',
        'features': 'featuresContent',
        'reviews': 'reviewsContent'
    };
    
    const content = document.getElementById(contentMap[tab]);
    if (content) content.style.display = 'block';
    
    const buttons = document.querySelectorAll('.tab-btn');
    const buttonMap = {
        'description': 0,
        'features': 1,
        'reviews': 2
    };
    if (buttons[buttonMap[tab]]) {
        buttons[buttonMap[tab]].classList.add('active');
    }
}

// ============================================
// BUY NOW FUNCTION
// ============================================

function buyNow(productId) {
    addToCart(productId);
    setTimeout(() => {
        window.location.href = 'checkout.html';
    }, 500);
}

// ============================================
// SOCIAL LOGIN - COMPLETE
// ============================================

// ---------- GOOGLE LOGIN ----------
function loginWithGoogle() {
    const btn = document.querySelector('.btn-social.google');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;
    }

    const redirectUri = window.location.origin + '/';
    const scope = 'openid email profile';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=token&` +
        `scope=${encodeURIComponent(scope)}&` +
        `prompt=select_account`;

    window.location.href = authUrl;
}

// Handle Google callback
function handleGoogleCallback() {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        
        if (accessToken) {
            fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })
            .then(res => res.json())
            .then(user => {
                const userData = {
                    name: user.name || 'Google User',
                    email: user.email,
                    picture: user.picture || '',
                    loginMethod: 'Google'
                };
                localStorage.setItem('shopnaijaUser', JSON.stringify(userData));
                alert(`✅ Welcome ${userData.name}!`);
                window.location.href = 'profile.html';
            })
            .catch(err => {
                console.error('Error:', err);
                alert('Login failed. Please try again.');
                const btn = document.querySelector('.btn-social.google');
                if (btn) {
                    btn.innerHTML = '<i class="fab fa-google"></i>';
                    btn.disabled = false;
                }
            });
        }
    }
}

// ---------- FACEBOOK LOGIN ----------
function loginWithFacebook() {
    const btn = document.querySelector('.btn-social.facebook');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;
    }

    setTimeout(() => {
        if (btn) {
            btn.innerHTML = '<i class="fab fa-facebook-f"></i>';
            btn.disabled = false;
        }
        alert('🚀 Facebook Login Coming Soon!\n\nTo enable:\n1. Go to Facebook Developers\n2. Create a Facebook App\n3. Add your App ID here');
    }, 1000);
}

// ---------- TWITTER LOGIN ----------
function loginWithTwitter() {
    const btn = document.querySelector('.btn-social.twitter');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;
    }

    setTimeout(() => {
        if (btn) {
            btn.innerHTML = '<i class="fab fa-twitter"></i>';
            btn.disabled = false;
        }
        alert('🚀 Twitter Login Coming Soon!\n\nTo enable:\n1. Go to Twitter Developer Portal\n2. Create a Twitter App\n3. Add your API Key here');
    }, 1000);
}

// ============================================
// SIGNUP & LOGIN HANDLERS
// ============================================

function handleSignup(e) {
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
    
    const existingUsers = JSON.parse(localStorage.getItem('shopnaijaUsers')) || [];
    if (existingUsers.some(u => u.email === email)) {
        feedback.className = 'error';
        feedback.innerHTML = '⚠️ This email is already registered. Please login.';
        return;
    }
    
    const newUser = {
        id: Date.now(),
        fullName,
        email,
        phone: phone || '',
        address: '',
        password: password,
        createdAt: new Date().toISOString()
    };
    
    existingUsers.push(newUser);
    localStorage.setItem('shopnaijaUsers', JSON.stringify(existingUsers));
    saveUser(newUser);
    updateAuthUI();
    
    feedback.className = 'success';
    feedback.innerHTML = `✅ Account created successfully! Welcome, ${fullName}! 🎉`;
    
    setTimeout(() => {
        window.location.href = 'profile.html';
    }, 1500);
}

function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const feedback = document.getElementById('loginFeedback');
    
    if (!email || !password) {
        feedback.className = 'error';
        feedback.innerHTML = '⚠️ Please enter both email and password.';
        return;
    }
    
    const users = JSON.parse(localStorage.getItem('shopnaijaUsers')) || [];
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
        feedback.className = 'error';
        feedback.innerHTML = '❌ Invalid email or password. Please try again.';
        return;
    }
    
    saveUser(user);
    updateAuthUI();
    
    feedback.className = 'success';
    feedback.innerHTML = `✅ Welcome back, ${user.fullName}! 🎉`;
    
    setTimeout(() => {
        window.location.href = 'profile.html';
    }, 1000);
}

function handleProfileUpdate(e) {
    e.preventDefault();
    
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    const fullName = document.getElementById('profileFullName').value.trim();
    const phone = document.getElementById('profilePhone').value.trim();
    const address = document.getElementById('profileAddress').value.trim();
    const feedback = document.getElementById('profileFeedback');
    
    const users = JSON.parse(localStorage.getItem('shopnaijaUsers')) || [];
    const userIndex = users.findIndex(u => u.id === user.id);
    
    if (userIndex !== -1) {
        users[userIndex].fullName = fullName || user.fullName;
        users[userIndex].phone = phone || user.phone;
        users[userIndex].address = address || user.address;
        localStorage.setItem('shopnaijaUsers', JSON.stringify(users));
        saveUser(users[userIndex]);
        updateAuthUI();
        
        feedback.className = 'success';
        feedback.innerHTML = '✅ Profile updated successfully!';
    } else {
        feedback.className = 'error';
        feedback.innerHTML = '❌ Error updating profile. Please try again.';
    }
}

// ============================================
// INITIALIZE PAGE
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const page = window.location.pathname.split('/').pop().split('?')[0];
    
    console.log('🔍 Current page:', page);
    console.log('📦 Using Strapi backend for products');
    
    // Handle Google callback
    handleGoogleCallback();
    
    // Update auth UI
    updateAuthUI();
    updateCartCount();
    startCountdown();
    
    // Search enter key
    const searchInput = document.getElementById('mainSearch');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    // Signup form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Profile form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                logoutUser();
            }
        });
    }
    
    // Contact form
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const feedback = document.getElementById('formFeedback');
            feedback.innerHTML = `
                <div style="background:#d4edda;padding:1rem;border-radius:8px;margin-top:1rem;color:#155724;">
                    ✅ Message sent! We'll get back to you within 24 hours.
                </div>
            `;
            this.reset();
            setTimeout(() => { feedback.innerHTML = ''; }, 5000);
        });
    }
    
    // Initialize page based on URL
    if (page === 'index.html' || page === '') {
        renderHomepage();
    } else if (page === 'shop.html') {
        const urlParams = new URLSearchParams(window.location.search);
        const filter = urlParams.get('filter') || 'all';
        const search = urlParams.get('search') || '';
        const subType = urlParams.get('subtype') || '';
        
        if (search) {
            renderShopPage('all', search);
        } else {
            renderShopPage(filter, '', subType);
        }
        setupFilters();
    } else if (page === 'digital-products.html') {
        const urlParams = new URLSearchParams(window.location.search);
        const filter = urlParams.get('type') || 'all';
        renderDigitalPage(filter);
        setupDigitalTabs();
    } else if (page === 'product-detail.html') {
        renderProductDetail();
    } else if (page === 'cart.html') {
        renderCart();
    } else if (page === 'checkout.html') {
        renderCheckoutSummary();
        setupCheckoutForm();
    } else if (page === 'wishlist.html') {
        updateWishlistUI();
    } else if (page === 'electronics.html' || page === 'fashion.html' || page === 'beauty.html' || page === 'digital.html') {
        const category = page.replace('.html', '');
        renderCategory(category);
    }
});