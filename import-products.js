// ============================================
// IMPORT PRODUCTS TO STRAPI - FIXED VERSION
// ============================================

const fs = require('fs');

// ============================================
// CONFIGURATION
// ============================================

const STRAPI_URL = 'http://localhost:1337';
const API_TOKEN = '415f84d714e3596b6e0a71a9d35740c6158f2731c5b9f3f02a60d01dc5677fff6ee90fe76d9b2a80fcff8ddc82501a366bc425e79f7b10db7f8e441382b26faa8526ddd88543e799212a2aaa132f868ffb154fdb09bacb8ce20168aacb3d0af8be0c649a22a132b6d275ef07b54904abc91f7081b4d939350d6481b8cc74b6d6'; // 👈 Replace with your token

// ============================================
// READ PRODUCT DATA
// ============================================

if (!fs.existsSync('scraped-products.json')) {
    console.error('❌ scraped-products.json file not found!');
    process.exit(1);
}

const dataFile = fs.readFileSync('scraped-products.json', 'utf8');
let products;

try {
    const parsed = JSON.parse(dataFile);
    products = parsed.products || parsed.data || parsed;
} catch (error) {
    console.error('❌ Error parsing JSON:', error.message);
    process.exit(1);
}

if (!Array.isArray(products) || products.length === 0) {
    console.error('❌ No products found.');
    process.exit(1);
}

console.log(`📦 Found ${products.length} products to import`);
console.log('🚀 Starting import...\n');

// ============================================
// IMPORT FUNCTION
// ============================================

async function importProducts() {
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        
        try {
            // Prepare data - ONLY use fields that exist in Strapi
            const productData = {
                data: {
                    Product_Name: product.Product_Name || product.name || 'Unnamed Product',
                    Price: parseFloat(product.Price || product.price || 0),
                    Category: product.Category || product.category || 'uncategorized',
                    // Sub_Type and Type are optional - comment out if they don't exist
                    // Sub_Type: product.Sub_Type || product.subType || '',
                    // Type: product.Type || product.type || 'physical',
                    Description: product.Description || product.description || '',
                    Rating: parseFloat(product.Rating || product.rating || 4.5)
                }
            };
            
            // Only add Sub_Type if the field exists in Strapi
            if (product.Sub_Type || product.subType) {
                productData.data.Sub_Type = product.Sub_Type || product.subType || '';
            }
            
            // Only add Type if the field exists in Strapi
            if (product.Type || product.type) {
                productData.data.Type = product.Type || product.type || 'physical';
            }
            
            console.log(`📤 Importing: ${productData.data.Product_Name}`);
            
            const response = await fetch(`${STRAPI_URL}/api/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_TOKEN}`
                },
                body: JSON.stringify(productData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            console.log(`✅ [${i + 1}/${products.length}] Imported: ${product.Product_Name || product.name}`);
            successCount++;
            
            // Upload image if available
            const imageUrl = product.Image || product.image;
            if (imageUrl && result.data) {
                try {
                    await uploadImage(result.data.id, imageUrl);
                    console.log(`   📸 Image uploaded`);
                } catch (imgError) {
                    console.log(`   ⚠️ Image upload failed: ${imgError.message}`);
                }
            }
            
        } catch (error) {
            console.error(`❌ Failed to import product ${i + 1}:`, error.message);
            failCount++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log('\n=================================');
    console.log(`✅ Successfully imported: ${successCount} products`);
    console.log(`❌ Failed to import: ${failCount} products`);
    console.log('=================================');
}

// ============================================
// IMAGE UPLOAD FUNCTION
// ============================================

async function uploadImage(productId, imageUrl) {
    try {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to download: ${imageResponse.status}`);
        }
        
        const imageBuffer = await imageResponse.buffer();
        
        const formData = new FormData();
        const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
        formData.append('files', blob, `${productId}-product.jpg`);
        
        const uploadResponse = await fetch(`${STRAPI_URL}/api/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`
            },
            body: formData
        });
        
        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status}`);
        }
        
        const uploadResult = await uploadResponse.json();
        const imageId = uploadResult[0]?.id;
        
        if (imageId) {
            await fetch(`${STRAPI_URL}/api/products/${productId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_TOKEN}`
                },
                body: JSON.stringify({
                    data: {
                        Image: [imageId]
                    }
                })
            });
            return true;
        }
        return false;
        
    } catch (error) {
        throw new Error(`Image upload failed: ${error.message}`);
    }
}

// ============================================
// RUN THE IMPORT
// ============================================

console.log('🔍 Checking Strapi connection...');

fetch(`${STRAPI_URL}/api/products?populate=*`)
    .then(response => {
        if (response.ok) {
            console.log('✅ Strapi is running!');
            importProducts().catch(console.error);
        } else {
            console.error('❌ Strapi error:', response.status);
            console.log('👉 Make sure Strapi is running: npm run develop');
        }
    })
    .catch(error => {
        console.error('❌ Cannot connect to Strapi!');
        console.log(`❌ Error: ${error.message}`);
        console.log('\n👉 Make sure Strapi is running:');
        console.log('   cd C:\\Users\\HomePC\\my-store-backend');
        console.log('   npm run develop');
    });
    // Test the token first
async function testToken() {
    try {
        const response = await fetch(`${STRAPI_URL}/api/products`, {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`
            }
        });
        console.log('Token test status:', response.status);
        if (response.status === 403) {
            console.log('❌ Token does not have permission to access products.');
            console.log('👉 Go to Strapi Admin → Settings → Roles & Permissions → Public');
            console.log('👉 Check "create", "update", "find", "findOne" for Product');
        }
        return response.ok;
    } catch (error) {
        console.error('Token test failed:', error);
        return false;
    }
}