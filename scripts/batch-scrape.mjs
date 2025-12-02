#!/usr/bin/env node
/**
 * Batch scrape Kingdom Death shop pages for lore content
 * Run: node scripts/batch-scrape.mjs
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../docs/lore/sources/official-site/shop/batch-scraped');

// All known shop product URLs to scrape
const SHOP_URLS = [
  // === QUARRY EXPANSIONS ===
  'https://shop.kingdomdeath.com/products/gorm-expansion',
  'https://shop.kingdomdeath.com/products/dragon-king-expansion',
  'https://shop.kingdomdeath.com/products/sunstalker-expansion',
  'https://shop.kingdomdeath.com/products/flower-knight-expansion',
  'https://shop.kingdomdeath.com/products/spidicules-expansion',
  'https://shop.kingdomdeath.com/products/dung-beetle-knight-expansion',
  'https://shop.kingdomdeath.com/products/lion-god-expansion',
  'https://shop.kingdomdeath.com/products/frogdog-expansion',
  
  // === NEMESIS EXPANSIONS ===
  'https://shop.kingdomdeath.com/products/manhunter-expansion',
  'https://shop.kingdomdeath.com/products/lion-knight-expansion',
  'https://shop.kingdomdeath.com/products/slenderman-expansion',
  'https://shop.kingdomdeath.com/products/black-knight-expansion',
  'https://shop.kingdomdeath.com/products/red-witches-expansion',
  'https://shop.kingdomdeath.com/products/pariah-expansion',
  
  // === SPECIAL EXPANSIONS ===
  'https://shop.kingdomdeath.com/products/gamblers-chest-expansion',
  'https://shop.kingdomdeath.com/products/lonely-tree-expansion',
  'https://shop.kingdomdeath.com/products/preorder-screaming-god-expansion',
  'https://shop.kingdomdeath.com/products/preorder-campaigns-of-death',
  
  // === WANDERERS ===
  'https://shop.kingdomdeath.com/products/wanderer-candy',
  'https://shop.kingdomdeath.com/products/wanderer-aeneas',
  'https://shop.kingdomdeath.com/products/wanderer-death-drifter',
  'https://shop.kingdomdeath.com/products/wanderer-goth',
  'https://shop.kingdomdeath.com/products/preorder-wanderer-preacher',
  
  // === INDOMITABLE SURVIVORS ===
  'https://shop.kingdomdeath.com/products/indomitable-survivor-tyrant-slayer-scarlet',
  'https://shop.kingdomdeath.com/products/indomitable-survivor-poison-partisan-ritika',
  'https://shop.kingdomdeath.com/products/indomitable-survivor-roaring-harmonica-kale',
  'https://shop.kingdomdeath.com/products/indomitable-survivor-lustrous-hunter-edlen',
  'https://shop.kingdomdeath.com/products/indomitable-survivor-blood-sheath-mirrel',
  'https://shop.kingdomdeath.com/products/indomitable-survivor-tachyon-nodachi-rubi',
  
  // === PILLAR SURVIVORS ===
  'https://shop.kingdomdeath.com/products/pillar-fade',
  'https://shop.kingdomdeath.com/products/pillar-percival',
  'https://shop.kingdomdeath.com/products/people-of-the-sun-priestess-percival',
  
  // === SPECIAL RELEASES ===
  'https://shop.kingdomdeath.com/products/woe-grimmory',
  'https://shop.kingdomdeath.com/products/naked-cat-doctors',
  'https://shop.kingdomdeath.com/products/10th-anniversary-survivors',
  'https://shop.kingdomdeath.com/products/survivors-of-death-1',
  'https://shop.kingdomdeath.com/products/false-messengers-expansion',
  'https://shop.kingdomdeath.com/products/philosophy-of-death-gatherism',
  
  // === VIGNETTES ===
  'https://shop.kingdomdeath.com/products/vignettes-of-death-collection-us',
  'https://shop.kingdomdeath.com/products/vignette-of-death-screaming-nukealope',
  'https://shop.kingdomdeath.com/products/vignette-of-death-killennium-butcher',
  
  // === MINIATURES WITH LORE ===
  'https://shop.kingdomdeath.com/products/allison-the-twilight-knight',
  'https://shop.kingdomdeath.com/products/black-friday-formal-erza-painters-scale',
  'https://shop.kingdomdeath.com/products/ashbloom-bust',
  
  // === CORE GAME ===
  'https://shop.kingdomdeath.com/products/kingdom-death-monster-1-6',
];

async function scrapeProductPage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Check for 404
    const title = await page.title();
    if (title.includes('404')) {
      console.log(`  ⚠️ 404: ${url}`);
      return null;
    }
    
    // Extract product title
    const productTitle = await page.$eval('h1', el => el.textContent?.trim() || '').catch(() => '');
    
    // Extract description text - get all text content from tabs/description
    const description = await page.evaluate(() => {
      // Try to get tab content first
      const tabContent = document.querySelector('[role="tab"][aria-selected="true"]');
      if (tabContent && tabContent.textContent && tabContent.textContent.length > 100) {
        return tabContent.textContent.trim();
      }
      
      // Try product description
      const selectors = [
        '.product-description',
        '[data-product-description]',
        '.product__description',
        '.rte',
        'div[itemprop="description"]',
      ];
      
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent && el.textContent.length > 50) {
          return el.textContent.trim();
        }
      }
      
      // Fallback: get main content
      const main = document.querySelector('main');
      return main?.textContent?.trim().slice(0, 8000) || '';
    });
    
    // Extract price
    const price = await page.$eval('[class*="price"]', el => el.textContent?.trim() || '').catch(() => '');
    
    // Extract list items (contents)
    const contents = await page.$$eval('li', els => 
      els.map(el => el.textContent?.trim() || '').filter(t => t.length > 5 && t.length < 200)
    );
    
    return {
      url,
      title: productTitle,
      description,
      contents,
      price,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.log(`  ❌ Error: ${url} - ${error.message}`);
    return null;
  }
}

function saveProduct(product) {
  const slug = product.url.split('/').pop() || 'unknown';
  const filename = `${slug}.txt`;
  const filepath = path.join(OUTPUT_DIR, filename);
  
  const content = `# ${product.title}
Source: ${product.url}
Scraped: ${product.timestamp}
Price: ${product.price}

---

## Description

${product.description}

---

## Contents

${product.contents.map(c => `- ${c}`).join('\n')}

---

## Keywords
${product.title.toLowerCase().split(/[\\s-]+/).filter(w => w.length > 3).join(', ')}
`;

  fs.writeFileSync(filepath, content);
  console.log(`  ✅ Saved: ${filename}`);
}

async function main() {
  console.log('🚀 Kingdom Death Shop Batch Scraper');
  console.log('='.repeat(50));
  
  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  // Process in batches of 5 for speed
  const BATCH_SIZE = 5;
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < SHOP_URLS.length; i += BATCH_SIZE) {
    const batch = SHOP_URLS.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(SHOP_URLS.length/BATCH_SIZE)}: ${batch.length} pages`);
    
    // Process batch in parallel
    const results = await Promise.all(
      batch.map(async (url) => {
        const page = await context.newPage();
        const result = await scrapeProductPage(page, url);
        await page.close();
        return result;
      })
    );
    
    // Save results
    for (const product of results) {
      if (product) {
        saveProduct(product);
        successCount++;
      } else {
        failCount++;
      }
    }
    
    // Small delay between batches
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await browser.close();
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Complete! Scraped ${successCount} products, ${failCount} failed`);
  console.log(`📁 Output: ${OUTPUT_DIR}`);
}

main().catch(console.error);

