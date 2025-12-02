#!/usr/bin/env node
/**
 * Batch scrape MORE Kingdom Death shop pages
 * Run: node scripts/batch-scrape-more.mjs
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../docs/lore/sources/official-site/shop/batch-scraped');

// MORE URLs - 1.6 versions, pinups, special items
const SHOP_URLS = [
  // === 1.6 VERSIONS OF EXPANSIONS ===
  'https://shop.kingdomdeath.com/products/gorm-expansion-1-6',
  'https://shop.kingdomdeath.com/products/dragon-king-expansion-1-6',
  'https://shop.kingdomdeath.com/products/flower-knight-expansion-1-6',
  'https://shop.kingdomdeath.com/products/spidicules-expansion-1-6',
  'https://shop.kingdomdeath.com/products/dung-beetle-knight-expansion-1-6',
  'https://shop.kingdomdeath.com/products/lion-god-expansion-1-6',
  'https://shop.kingdomdeath.com/products/lion-knight-expansion-1-6',
  'https://shop.kingdomdeath.com/products/slenderman-expansion-1-6',
  'https://shop.kingdomdeath.com/products/lonely-tree-expansion-1-6',
  'https://shop.kingdomdeath.com/products/manhunter-expansion-1-6',
  'https://shop.kingdomdeath.com/products/sunstalker-expansion-1-6',
  
  // === MORE INDOMITABLE SURVIVORS ===
  'https://shop.kingdomdeath.com/products/indomitable-survivor-dashing-reaper-paleun',
  'https://shop.kingdomdeath.com/products/indomitable-survivor-prism-fanatic-mirrin',
  'https://shop.kingdomdeath.com/products/indomitable-survivor-golden-scythe-kale',
  
  // === SPECIAL SURVIVORS ===
  'https://shop.kingdomdeath.com/products/pinup-survivors-of-death-2',
  'https://shop.kingdomdeath.com/products/pinup-survivors-of-death-3',
  'https://shop.kingdomdeath.com/products/before-the-wall-survivors',
  
  // === PROMOS AND SPECIALS ===
  'https://shop.kingdomdeath.com/products/promos-of-death-1',
  'https://shop.kingdomdeath.com/products/promos-of-death-2',
  'https://shop.kingdomdeath.com/products/echoes-of-death-1',
  'https://shop.kingdomdeath.com/products/echoes-of-death-2',
  'https://shop.kingdomdeath.com/products/echoes-of-death-3',
  
  // === CHARACTER MINIATURES ===
  'https://shop.kingdomdeath.com/products/twilight-witch',
  'https://shop.kingdomdeath.com/products/beyond-the-wall',
  'https://shop.kingdomdeath.com/products/percival',
  'https://shop.kingdomdeath.com/products/the-saviors',
  
  // === CROSSOVER CONTENT ===
  'https://shop.kingdomdeath.com/products/white-box',
  'https://shop.kingdomdeath.com/products/black-box',
  
  // === BUSTS AND COLLECTIBLES ===
  'https://shop.kingdomdeath.com/products/twilight-knight-bust',
  'https://shop.kingdomdeath.com/products/white-lion-bust',
  'https://shop.kingdomdeath.com/products/phoenix-bust',
  
  // === PINUPS (some have lore!) ===
  'https://shop.kingdomdeath.com/products/pinup-twilight-knight',
  'https://shop.kingdomdeath.com/products/pinup-phoenix-dancer',
  'https://shop.kingdomdeath.com/products/pinup-sci-fi-twilight-knight',
  'https://shop.kingdomdeath.com/products/pinup-warrior-of-the-sun',
  
  // === NARRATIVE SCULPTURES ===
  'https://shop.kingdomdeath.com/products/before-the-wall',
  'https://shop.kingdomdeath.com/products/messenger-of-the-spiral-path',
  'https://shop.kingdomdeath.com/products/messenger-of-humanity',
  'https://shop.kingdomdeath.com/products/messenger-of-courage',
  'https://shop.kingdomdeath.com/products/messenger-of-the-first-story',
  
  // === FIRST HERO ===
  'https://shop.kingdomdeath.com/products/first-hero',
  'https://shop.kingdomdeath.com/products/first-hero-survivors',
  
  // === ARMOR KITS ===
  'https://shop.kingdomdeath.com/products/lion-armor-kit',
  'https://shop.kingdomdeath.com/products/phoenix-armor-kit',
  'https://shop.kingdomdeath.com/products/antelope-armor-kit',
  'https://shop.kingdomdeath.com/products/leather-armor-kit',
  
  // === MORE WANDERERS ===
  'https://shop.kingdomdeath.com/products/wanderer-lantern-hag',
  'https://shop.kingdomdeath.com/products/wanderer-old-man',
  'https://shop.kingdomdeath.com/products/wanderer-ribbon',
  'https://shop.kingdomdeath.com/products/wanderer-storm',
];

async function scrapeProductPage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    const title = await page.title();
    if (title.includes('404')) {
      console.log(`  ⚠️ 404: ${url.split('/').pop()}`);
      return null;
    }
    
    const productTitle = await page.$eval('h1', el => el.textContent?.trim() || '').catch(() => '');
    
    const description = await page.evaluate(() => {
      const tabContent = document.querySelector('[role="tab"][aria-selected="true"]');
      if (tabContent && tabContent.textContent && tabContent.textContent.length > 100) {
        return tabContent.textContent.trim();
      }
      
      const selectors = ['.product-description', '[data-product-description]', '.product__description', '.rte'];
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent && el.textContent.length > 50) {
          return el.textContent.trim();
        }
      }
      
      const main = document.querySelector('main');
      return main?.textContent?.trim().slice(0, 8000) || '';
    });
    
    const price = await page.$eval('[class*="price"]', el => el.textContent?.trim() || '').catch(() => '');
    
    const contents = await page.$$eval('li', els => 
      els.map(el => el.textContent?.trim() || '').filter(t => t.length > 5 && t.length < 200)
    );
    
    return { url, title: productTitle, description, contents, price, timestamp: new Date().toISOString() };
  } catch (error) {
    console.log(`  ❌ Error: ${url.split('/').pop()}`);
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
`;

  fs.writeFileSync(filepath, content);
  console.log(`  ✅ ${filename}`);
}

async function main() {
  console.log('🚀 Kingdom Death Shop Batch Scraper (Round 2)');
  console.log('='.repeat(50));
  
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  const BATCH_SIZE = 5;
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < SHOP_URLS.length; i += BATCH_SIZE) {
    const batch = SHOP_URLS.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(SHOP_URLS.length/BATCH_SIZE)}`);
    
    const results = await Promise.all(
      batch.map(async (url) => {
        const page = await context.newPage();
        const result = await scrapeProductPage(page, url);
        await page.close();
        return result;
      })
    );
    
    for (const product of results) {
      if (product) {
        saveProduct(product);
        successCount++;
      } else {
        failCount++;
      }
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await browser.close();
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Complete! Scraped ${successCount} more products, ${failCount} failed`);
}

main().catch(console.error);

