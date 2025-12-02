#!/usr/bin/env node
/**
 * Comprehensive Source Scraper - Finds and scrapes all missing KDM sources
 * Run: node scripts/scrape-missing-sources.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCES_PATH = path.join(__dirname, '../docs/lore/sources');

// ============================================
// DISCOVERY FUNCTIONS
// ============================================

function getCurrentState() {
  const state = {
    kickstarter: {
      updates: 0,
      images: 0,
      ocr: 0,
      missing: [],
    },
    newsletters: {
      have: [],
      missing: [],
    },
    shop: {
      products: 0,
    },
  };

  // Count Kickstarter updates
  const ksUpdates = path.join(SOURCES_PATH, 'kickstarter/updates');
  if (fs.existsSync(ksUpdates)) {
    const files = fs.readdirSync(ksUpdates).filter(f => f.endsWith('.txt'));
    state.kickstarter.updates = files.length;
    
    // Parse update numbers
    const updateNums = new Set();
    files.forEach(f => {
      const match = f.match(/update-(\d+)/);
      if (match && parseInt(match[1]) < 200) {
        updateNums.add(parseInt(match[1]));
      }
    });
    
    // Find missing 1-134
    for (let i = 1; i <= 134; i++) {
      if (!updateNums.has(i)) {
        state.kickstarter.missing.push(i);
      }
    }
  }

  // Count newsletters
  const newsDir = path.join(SOURCES_PATH, 'official-site/news');
  if (fs.existsSync(newsDir)) {
    const years = fs.readdirSync(newsDir).filter(d => 
      fs.statSync(path.join(newsDir, d)).isDirectory()
    );
    
    for (const year of years) {
      const yearDir = path.join(newsDir, year);
      const files = fs.readdirSync(yearDir).filter(f => f.endsWith('.txt'));
      files.forEach(f => {
        const match = f.match(/kdu-(\d+)/);
        if (match) {
          state.newsletters.have.push(parseInt(match[1]));
        }
      });
    }
    
    // Find missing 1-109
    for (let i = 1; i <= 109; i++) {
      if (!state.newsletters.have.includes(i)) {
        state.newsletters.missing.push(i);
      }
    }
  }

  // Count shop products
  const shopDir = path.join(SOURCES_PATH, 'official-site/shop/smart-scraped');
  if (fs.existsSync(shopDir)) {
    state.shop.products = fs.readdirSync(shopDir).filter(f => f.endsWith('.txt')).length;
  }

  return state;
}

async function main() {
  console.log('📊 KDM Source Collection Status');
  console.log('='.repeat(60));
  
  const state = getCurrentState();
  
  console.log('\n📁 KICKSTARTER UPDATES');
  console.log(`  Have: ${state.kickstarter.updates} update files`);
  console.log(`  Missing: ${state.kickstarter.missing.length} updates (${state.kickstarter.missing.slice(0, 10).join(', ')}...)`);
  
  console.log('\n📰 NEWSLETTERS (KDU)');
  console.log(`  Have: ${state.newsletters.have.length} newsletters (${state.newsletters.have.sort((a,b) => a-b).join(', ')})`);
  console.log(`  Missing: ${state.newsletters.missing.length} newsletters`);
  
  console.log('\n🛒 SHOP PRODUCTS');
  console.log(`  Have: ${state.shop.products} products`);
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 PRIORITY SCRAPING TARGETS');
  console.log('='.repeat(60));
  
  // Priority 1: Recent Kickstarter updates (2016-2024)
  const recentMissing = state.kickstarter.missing.filter(n => n >= 50);
  console.log(`\n1️⃣ Kickstarter Updates #50-120 (${recentMissing.length} missing)`);
  console.log('   These contain Gambler\'s Chest development, wave updates, etc.');
  
  // Priority 2: Newsletters 2020-2024
  const recentNewsletters = state.newsletters.missing.filter(n => n >= 50);
  console.log(`\n2️⃣ Newsletters #50-96 (${recentNewsletters.length} missing)`);
  console.log('   Monthly updates with new monster/expansion reveals');
  
  // Priority 3: Original campaign updates
  const originalMissing = state.kickstarter.missing.filter(n => n < 50);
  console.log(`\n3️⃣ Kickstarter Updates #1-49 (${originalMissing.length} missing)`);
  console.log('   Original 2012-2016 campaign - stretch goals, reveals');
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 NEXT STEPS');
  console.log('='.repeat(60));
  console.log(`
1. Run Kickstarter discovery to find more post IDs:
   npx ts-node scripts/discover-all-posts.ts

2. Run full Kickstarter scraper:
   npx ts-node scripts/scrape-all-kickstarter.ts

3. Scrape newsletters from Wayback Machine:
   (newsletters are email-only, need archived versions)

4. OCR any new Kickstarter images:
   npx ts-node scripts/ocr-kickstarter-images.ts
`);
}

main().catch(console.error);

