// ============================================
// fix-all.js — Fixes all HTML files to use injected header/footer
// Run: node fix-all.js
// ============================================

const fs = require('fs');
const path = require('path');

const FOLDER = __dirname;
const SKIP_FILES = ['index.html']; // already done manually

// Which files to process
const htmlFiles = fs.readdirSync(FOLDER).filter(f =>
    f.endsWith('.html') &&
    !f.includes(' (1)') &&        // skip draft copies like "beauty (1).html"
    !f.includes('template') &&    // skip og-image-template.html
    !f.includes('sitemap') &&     // skip generate-sitemap.html
    !SKIP_FILES.includes(f)
);

console.log(`Found ${htmlFiles.length} HTML files to process\n`);

let successCount = 0;
let skipCount = 0;
let failCount = 0;

htmlFiles.forEach(file => {
    const filePath = path.join(FOLDER, file);
    try {
        let html = fs.readFileSync(filePath, 'utf8');
        const original = html;

        // ============================================
        // STEP 1: Backup
        // ============================================
        const backupPath = filePath + '.bak';
        if (!fs.existsSync(backupPath)) {
            fs.writeFileSync(backupPath, html, 'utf8');
        }

        // ============================================
        // STEP 2: Replace TOP section (top bar + header + mega menu + orphan nav-icons)
        // ============================================
        // Find <body>
        const bodyOpenMatch = html.match(/<body[^>]*>/i);
        if (!bodyOpenMatch) {
            console.log(`⚠️  ${file}: no <body> tag found, skipping`);
            skipCount++;
            return;
        }
        const bodyOpenEnd = bodyOpenMatch.index + bodyOpenMatch[0].length;
        const beforeBody = html.slice(0, bodyOpenEnd);
        const afterBody = html.slice(bodyOpenEnd);

        // Find the first content section: <section>, <main>, or <!-- PAGE HEADER / <!-- HERO
        // We look for the LAST marker because some files have nav/menu before content
        let contentStart = -1;

        // Try to find specific markers that always come after the header
        const markers = [
            '<!-- PAGE HEADER -->',
            '<!-- HERO BANNER -->',
            '<!-- PRODUCT DETAIL PAGE',
            '<!-- CHECKOUT HEADER -->',
            '<!-- CART SECTION -->',
            '<!-- WISHLIST SECTION -->',
            '<!-- ============================================ -->\n    <!-- SIGNUP SECTION',
            '<!-- ============================================ -->\n    <!-- LOGIN SECTION',
            '<!-- HELP HERO -->',
            '<!-- BREADCRUMB -->',
            '<!-- TRACK ORDER SECTION -->',
            '<!-- ============================================ -->\n    <!-- SIGNUP',
        ];

        for (const marker of markers) {
            const idx = afterBody.indexOf(marker);
            if (idx !== -1 && (contentStart === -1 || idx < contentStart)) {
                contentStart = idx;
            }
        }

        // Fallback: look for first <section class="
        if (contentStart === -1) {
            const sectionMatch = afterBody.match(/<section\s+class="/i);
            if (sectionMatch) contentStart = sectionMatch.index;
        }

        // Fallback: look for first <main
        if (contentStart === -1) {
            const mainMatch = afterBody.match(/<main[\s>]/i);
            if (mainMatch) contentStart = mainMatch.index;
        }

        if (contentStart === -1) {
            console.log(`⚠️  ${file}: could not find content section start, skipping`);
            skipCount++;
            return;
        }

        // Clean the top of afterBody
        const newTop = '\n    <div id="site-header"></div>\n\n    ';
        const cleanedAfterBody = afterBody.slice(contentStart);
        html = beforeBody + newTop + cleanedAfterBody;

        // ============================================
        // STEP 3: Replace FOOTER + WhatsApp float
        // ============================================
        // Find <footer...> through </footer>
        const footerStartRegex = /<!--\s*FOOTER\s*-->\s*<footer[^>]*>/i;
        let footerMatch = html.match(footerStartRegex);
        let footerStartIdx, footerEndIdx;

        if (footerMatch) {
            footerStartIdx = footerMatch.index;
            // Find matching </footer>
            const afterFooter = html.indexOf('</footer>', footerStartIdx);
            if (afterFooter !== -1) {
                footerEndIdx = afterFooter + '</footer>'.length;

                // Check if WhatsApp float follows
                const afterFooterContent = html.slice(footerEndIdx);
                const waMatch = afterFooterContent.match(/^\s*<a[^>]*class="whatsapp-float"[\s\S]*?<\/a>/i);
                if (waMatch) {
                    footerEndIdx += waMatch[0].length;
                }

                html = html.slice(0, footerStartIdx) +
                       '<div id="site-footer"></div>\n\n    ' +
                       html.slice(footerEndIdx);
            }
        } else {
            // Try <footer> without comment
            const plainFooterMatch = html.match(/<footer[^>]*>/i);
            if (plainFooterMatch) {
                footerStartIdx = plainFooterMatch.index;
                const afterFooter = html.indexOf('</footer>', footerStartIdx);
                if (afterFooter !== -1) {
                    footerEndIdx = afterFooter + '</footer>'.length;
                    const afterFooterContent = html.slice(footerEndIdx);
                    const waMatch = afterFooterContent.match(/^\s*<a[^>]*class="whatsapp-float"[\s\S]*?<\/a>/i);
                    if (waMatch) {
                        footerEndIdx += waMatch[0].length;
                    }
                    html = html.slice(0, footerStartIdx) +
                           '<div id="site-footer"></div>\n\n    ' +
                           html.slice(footerEndIdx);
                }
            }
        }

        // ============================================
        // STEP 4: Save
        // ============================================
        if (html === original) {
            console.log(`ℹ️  ${file}: no changes needed (already clean?)`);
            skipCount++;
            return;
        }

        fs.writeFileSync(filePath, html, 'utf8');
        console.log(`✅ ${file}: fixed`);
        successCount++;

    } catch (err) {
        console.log(`❌ ${file}: ERROR — ${err.message}`);
        failCount++;
    }
});

console.log(`\n=================================`);
console.log(`✅ Fixed:  ${successCount}`);
console.log(`ℹ️  Skipped: ${skipCount}`);
console.log(`❌ Failed:  ${failCount}`);
console.log(`=================================\n`);
console.log(`Backups saved as filename.html.bak`);
console.log(`Test: open a few files in the browser. If anything looks wrong, restore with the .bak file.`);