#!/usr/bin/env node
/**
 * Re-scrape empty/placeholder Kickstarter update files
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPDATES_DIR = path.join(__dirname, '../docs/lore/sources/kickstarter/updates');

// Post IDs that need re-scraping (updates 117-124)
const TO_RESCRAPE = [
  { number: 117, postId: '4115109' },
  { number: 118, postId: '4140665' },
  { number: 119, postId: '4140735' },
  { number: 120, postId: '4184460' },
  { number: 121, postId: '4211226' },
  { number: 122, postId: '4240089' },
  { number: 123, postId: '4257269' },
  { number: 124, postId: '4281544' },
];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeUpdate(page, postId, updateNumber) {
  const url = `https://www.kickstarter.com/projects/poots/kingdom-death-monster-15/posts/${postId}`;
  
  try {
    console.log(`  Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(3000);
    
    // Get title from page title
    const pageTitle = await page.title();
    const title = pageTitle.replace(/Kingdom Death.*?»\s*/, '').replace(/\s*—.*/, '').trim();
    
    // Get date
    let date = new Date().toISOString();
    try {
      const dateEl = await page.$('time[datetime]');
      if (dateEl) {
        date = await dateEl.getAttribute('datetime') || date;
      }
    } catch {}
    
    // Get content - try multiple selectors
    const selectors = [
      '.rte__content',
      '[data-test-id="post-body"]',
      'article',
      '.post-body',
      'main .prose',
    ];
    
    let content = '';
    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          content = await el.textContent();
          if (content.length > 100) break;
        }
      } catch {}
    }
    
    if (content.length < 100) {
      // Try getting all text from main content area
      content = await page.evaluate(() => {
        const main = document.querySelector('main') || document.body;
        return main.innerText;
      });
    }
    
    // Get images
    let images = [];
    try {
      images = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img'))
          .map(img => img.src)
          .filter(src => src && !src.startsWith('data:') && !src.includes('placeholder'));
      });
    } catch {}
    
    return {
      postId,
      updateNumber,
      title,
      date,
      url,
      content: content.trim(),
      images,
    };
  } catch (error) {
    console.log(`  ⚠ Error: ${error.message?.slice(0, 80)}`);
    return null;
  }
}

async function saveUpdate(update) {
  const filename = `update-${String(update.updateNumber).padStart(3, '0')}.txt`;
  const filePath = path.join(UPDATES_DIR, filename);
  
  let output = `# ${update.title}\n`;
  output += `Post ID: ${update.postId}\n`;
  output += `Update: ${update.updateNumber}\n`;
  output += `Date: ${update.date}\n`;
  output += `Source: ${update.url}\n`;
  output += `Images: ${update.images.length}\n`;
  output += `\n---\n\n`;
  output += update.content;
  output += `\n\n---\n\n## Image URLs\n`;
  update.images.forEach((img, i) => {
    output += `${i + 1}. ${img}\n`;
  });
  
  fs.writeFileSync(filePath, output);
  console.log(`  ✓ Saved: ${filename} (${update.content.length} chars)`);
}

async function main() {
  console.log('\n🔄 Re-scraping Empty Updates\n');
  
  const browser = await chromium.launch({ 
    headless: true,
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  
  const page = await context.newPage();
  
  let success = 0;
  let failed = 0;
  
  for (const item of TO_RESCRAPE) {
    console.log(`\n[${item.number}] Post ${item.postId}...`);
    
    const update = await scrapeUpdate(page, item.postId, item.number);
    
    if (update && update.content.length > 100) {
      await saveUpdate(update);
      success++;
    } else {
      console.log(`  ⚠ Skipped - insufficient content`);
      failed++;
    }
    
    await delay(3000);
  }
  
  await browser.close();
  
  console.log(`\n═══════════════════════════════════════`);
  console.log(`  Success: ${success}`);
  console.log(`  Failed: ${failed}`);
  console.log(`═══════════════════════════════════════\n`);
}

main().catch(console.error);

