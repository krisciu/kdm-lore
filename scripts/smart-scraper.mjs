#!/usr/bin/env node
/**
 * SMART Kingdom Death Scraper
 * - Auto-discovers ALL product URLs from shop
 * - Extracts ONLY lore content (no nav menus)
 * - Validates high-value content
 * Run: node scripts/smart-scraper.mjs
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../docs/lore/sources/official-site/shop/smart-scraped');
const INDEX_FILE = path.join(OUTPUT_DIR, 'scrape-index.json');

// High-value products to verify manually
const HIGH_VALUE_SLUGS = [
  'kingdom-death-monster-1-6',
  'gamblers-chest',
  'dragon-king-expansion-1-6',
  'sunstalker-expansion-1-6',
  'gorm-expansion-1-6',
];

async function discoverAllProductUrls(page) {
  console.log('🔍 Discovering all product URLs from shop...');
  const allUrls = new Set();
  
  // Visit main shop categories
  const categoryUrls = [
    'https://shop.kingdomdeath.com/collections/monster-expansions',
    'https://shop.kingdomdeath.com/collections/gameplay-expansions', 
    'https://shop.kingdomdeath.com/collections/limited-edition-resin',
    'https://shop.kingdomdeath.com/collections/collectible-miniatures',
    'https://shop.kingdomdeath.com/collections/pinups',
    'https://shop.kingdomdeath.com/collections/all',
  ];
  
  for (const catUrl of categoryUrls) {
    try {
      await page.goto(catUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Scroll to load all products
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('End');
        await page.waitForTimeout(500);
      }
      
      // Get all product links
      const links = await page.$$eval('a[href*="/products/"]', els => 
        els.map(el => el.href).filter(h => h.includes('/products/') && !h.includes('#'))
      );
      
      links.forEach(link => allUrls.add(link));
      console.log(`  📁 ${catUrl.split('/').pop()}: found ${links.length} products`);
    } catch (e) {
      console.log(`  ⚠️ Failed to load ${catUrl}`);
    }
  }
  
  return [...allUrls];
}

async function scrapeProductPage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    const title = await page.title();
    if (title.includes('404')) {
      return null;
    }
    
    // Get product title (first h1)
    const productTitle = await page.$eval('h1', el => el.textContent?.trim() || '').catch(() => '');
    
    // Get ONLY the description content - avoid nav menus
    const description = await page.evaluate(() => {
      // Look for the description tab content specifically
      const descTab = document.querySelector('[role="tabpanel"]');
      if (descTab) {
        // Clone and remove unwanted elements
        const clone = descTab.cloneNode(true);
        clone.querySelectorAll('nav, header, footer, [class*="nav"], [class*="menu"], button').forEach(el => el.remove());
        const text = clone.textContent?.trim() || '';
        if (text.length > 100) return text;
      }
      
      // Fallback: look for product description divs
      const descSelectors = [
        '.product__description',
        '.product-description', 
        '[itemprop="description"]',
        '.rte',
      ];
      
      for (const sel of descSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const clone = el.cloneNode(true);
          clone.querySelectorAll('nav, header, footer').forEach(n => n.remove());
          const text = clone.textContent?.trim();
          if (text && text.length > 100) return text;
        }
      }
      
      return '';
    });
    
    // Get price
    const price = await page.evaluate(() => {
      const priceEl = document.querySelector('[class*="price"]:not(nav *)');
      return priceEl?.textContent?.match(/\$[\d,]+(\.\d{2})?/)?.[0] || '';
    });
    
    // Get ONLY meaningful list items (product contents, not nav)
    const contents = await page.evaluate(() => {
      const items = [];
      // Find lists that are likely product contents
      document.querySelectorAll('[role="tabpanel"] li, .product-description li, .rte li').forEach(li => {
        const text = li.textContent?.trim() || '';
        // Filter out navigation items
        if (text.length > 10 && text.length < 300 && 
            !text.includes('Kingdom Death: Monster') && 
            !text.includes('Warehouse') &&
            !text.includes('BLACK FRIDAY') &&
            !text.match(/^(Monster|Pinups|Accessories|Simulator|Europe|United Kingdom|Australia|Canada)$/)) {
          items.push(text);
        }
      });
      return items;
    });
    
    // Get any lore quotes (italicized text, often story text)
    const loreQuotes = await page.evaluate(() => {
      const quotes = [];
      document.querySelectorAll('em, i, blockquote, [style*="italic"]').forEach(el => {
        const text = el.textContent?.trim() || '';
        if (text.length > 30 && text.length < 1000) {
          quotes.push(text);
        }
      });
      return quotes;
    });
    
    return {
      url,
      slug: url.split('/').pop(),
      title: productTitle,
      price,
      description: description.slice(0, 10000),
      contents,
      loreQuotes,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return null;
  }
}

function formatAndSaveProduct(product) {
  const filename = `${product.slug}.txt`;
  const filepath = path.join(OUTPUT_DIR, filename);
  
  // Clean description - remove duplicate lines and navigation
  const cleanDesc = product.description
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .filter(l => !l.match(/^(Monster Bundles|Monster Expansions|Gameplay Expansions|Limited Edition|Collectible|Pinups|Accessories|Simulator|Europe|United Kingdom|Australia|Canada|BLACK FRIDAY|Description)$/))
    .filter((l, i, arr) => arr.indexOf(l) === i) // Remove duplicates
    .join('\n');
  
  const content = `# ${product.title}
Source: ${product.url}
Scraped: ${product.timestamp}
Price: ${product.price}

---

## Lore / Description

${cleanDesc}

${product.loreQuotes.length > 0 ? `
---

## Story Quotes

${product.loreQuotes.map(q => `> "${q}"`).join('\n\n')}
` : ''}
---

## Product Contents

${product.contents.map(c => `- ${c}`).join('\n')}
`;

  fs.writeFileSync(filepath, content);
  return filename;
}

async function main() {
  console.log('🚀 SMART Kingdom Death Scraper');
  console.log('='.repeat(50));
  
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Step 1: Discover all product URLs
  const allUrls = await discoverAllProductUrls(page);
  console.log(`\n📦 Found ${allUrls.length} total product URLs\n`);
  
  // Step 2: Scrape all products
  const index = { 
    scrapedAt: new Date().toISOString(),
    products: [],
    highValueVerified: [],
    failed: []
  };
  
  const BATCH_SIZE = 5;
  let successCount = 0;
  
  for (let i = 0; i < allUrls.length; i += BATCH_SIZE) {
    const batch = allUrls.slice(i, i + BATCH_SIZE);
    console.log(`📦 Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(allUrls.length/BATCH_SIZE)}`);
    
    const results = await Promise.all(
      batch.map(async (url) => {
        const p = await context.newPage();
        const result = await scrapeProductPage(p, url);
        await p.close();
        return result;
      })
    );
    
    for (const product of results) {
      if (product && product.description.length > 50) {
        const filename = formatAndSaveProduct(product);
        
        // Check if high-value
        const isHighValue = HIGH_VALUE_SLUGS.includes(product.slug);
        
        index.products.push({
          slug: product.slug,
          title: product.title,
          filename,
          descLength: product.description.length,
          contentsCount: product.contents.length,
          hasLoreQuotes: product.loreQuotes.length > 0,
          isHighValue,
        });
        
        if (isHighValue) {
          index.highValueVerified.push(product.slug);
          console.log(`  ✅ [HIGH VALUE] ${filename} (${product.description.length} chars)`);
        } else {
          console.log(`  ✅ ${filename}`);
        }
        successCount++;
      } else if (product) {
        index.failed.push({ url: product.url, reason: 'Empty description' });
      } else {
        index.failed.push({ url: batch[results.indexOf(product)], reason: '404 or error' });
      }
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Save index
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
  
  await browser.close();
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Complete! Scraped ${successCount} products`);
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log(`🏆 High-value verified: ${index.highValueVerified.join(', ')}`);
  console.log(`❌ Failed: ${index.failed.length}`);
}

main().catch(console.error);

