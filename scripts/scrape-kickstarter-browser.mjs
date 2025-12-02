#!/usr/bin/env node
/**
 * Browser-based Kickstarter Scraper using Playwright
 * This script uses a real browser to scrape Kickstarter updates
 * because Kickstarter blocks direct HTTP requests.
 * 
 * Run: npx playwright install chromium (first time)
 * Run: node scripts/scrape-kickstarter-browser.mjs
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../docs/lore/sources/kickstarter');
const UPDATES_DIR = path.join(OUTPUT_DIR, 'updates');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeUpdatePage(page, postId) {
  const url = `https://www.kickstarter.com/projects/poots/kingdom-death-monster-15/posts/${postId}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await delay(2000); // Wait for dynamic content
    
    // Get title
    const titleEl = await page.$('h2.mb3 a, .post-title, [data-test-id="post-title"]');
    const title = titleEl ? await titleEl.textContent() : 'Untitled Update';
    
    // Get date
    const dateEl = await page.$('time.block, time[datetime]');
    const date = dateEl ? await dateEl.getAttribute('datetime') : new Date().toISOString();
    
    // Get content
    const contentEl = await page.$('.rte__content, [data-test-id="post-body"]');
    if (!contentEl) {
      console.log(`  ⚠ No content found for ${postId}`);
      return null;
    }
    
    const content = await contentEl.textContent();
    
    // Get images
    const images = await contentEl.$$eval('img', imgs => 
      imgs.map(img => img.src).filter(src => !src.startsWith('data:'))
    );
    
    // Try to extract update number from title or page
    let updateNumber;
    const updateMatch = title.match(/Update\s+#?(\d+)/i);
    if (updateMatch) {
      updateNumber = parseInt(updateMatch[1]);
    }
    
    return {
      postId,
      updateNumber,
      title: title.trim(),
      date,
      url,
      imageCount: images.length,
      content: content.trim(),
      images,
    };
  } catch (error) {
    console.log(`  ⚠ Error scraping ${postId}: ${error.message?.slice(0, 50)}`);
    return null;
  }
}

async function saveUpdate(update) {
  const filename = update.updateNumber 
    ? `update-${String(update.updateNumber).padStart(3, '0')}.txt`
    : `update-${update.postId}.txt`;
  
  const filePath = path.join(UPDATES_DIR, filename);
  
  let content = `# ${update.title}\n`;
  content += `Post ID: ${update.postId}\n`;
  if (update.updateNumber) {
    content += `Update: ${update.updateNumber}\n`;
  }
  content += `Date: ${update.date}\n`;
  content += `Source: ${update.url}\n`;
  content += `Images: ${update.imageCount}\n`;
  content += `\n---\n\n`;
  content += update.content;
  content += `\n\n---\n\n## Image URLs\n`;
  update.images.forEach((img, i) => {
    content += `${i + 1}. ${img}\n`;
  });
  
  fs.writeFileSync(filePath, content);
  console.log(`  ✓ Saved: ${filename} (${update.content.length} chars)`);
}

async function discoverPostIds(page) {
  console.log('\n🔍 Discovering post IDs from updates list...\n');
  
  const postIds = [];
  
  await page.goto('https://www.kickstarter.com/projects/poots/kingdom-death-monster-15/posts', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  
  // Click "Load more" until all updates are loaded
  let previousCount = 0;
  let attempts = 0;
  
  while (attempts < 20) {
    const currentIds = await page.$$eval('a[href*="/posts/"]', links => 
      links.map(a => {
        const match = a.href.match(/\/posts\/(\d+)/);
        return match ? match[1] : null;
      }).filter(Boolean)
    );
    
    const uniqueIds = [...new Set(currentIds)];
    
    if (uniqueIds.length === previousCount) {
      attempts++;
    } else {
      attempts = 0;
      previousCount = uniqueIds.length;
    }
    
    // Try to click load more
    try {
      const loadMore = await page.$('button:has-text("Load more")');
      if (loadMore) {
        await loadMore.click();
        await delay(2000);
      } else {
        break;
      }
    } catch {
      break;
    }
    
    console.log(`  Found ${uniqueIds.length} post IDs...`);
  }
  
  const finalIds = await page.$$eval('a[href*="/posts/"]', links => 
    links.map(a => {
      const match = a.href.match(/\/posts\/(\d+)/);
      return match ? match[1] : null;
    }).filter(Boolean)
  );
  
  return [...new Set(finalIds)];
}

async function main() {
  console.log('\n🚀 Browser-based Kickstarter Scraper\n');
  
  ensureDir(UPDATES_DIR);
  ensureDir(IMAGES_DIR);
  
  // Load known post IDs
  const postIdsFile = path.join(OUTPUT_DIR, 'post-ids.txt');
  let postIds = [];
  
  if (fs.existsSync(postIdsFile)) {
    const content = fs.readFileSync(postIdsFile, 'utf-8');
    const lines = content.split('\n').filter(l => !l.startsWith('#') && l.trim());
    postIds = lines.map(l => l.split('|').pop().trim()).filter(id => /^\d+$/.test(id));
    console.log(`Loaded ${postIds.length} post IDs from file\n`);
  }
  
  // Check existing files
  const existingFiles = fs.readdirSync(UPDATES_DIR).filter(f => f.endsWith('.txt'));
  const existingPostIds = new Set();
  
  existingFiles.forEach(f => {
    const content = fs.readFileSync(path.join(UPDATES_DIR, f), 'utf-8');
    const match = content.match(/Post ID: (\d+)/);
    if (match) {
      existingPostIds.add(match[1]);
    }
    // Also check if file has actual content (> 500 bytes)
    if (content.length > 500) {
      const idMatch = f.match(/update-(\d+)\.txt/);
      if (idMatch && idMatch[1].length > 6) {
        existingPostIds.add(idMatch[1]);
      }
    }
  });
  
  console.log(`Found ${existingPostIds.size} already scraped post IDs\n`);
  
  // Filter to only unscraped IDs
  const toScrape = postIds.filter(id => !existingPostIds.has(id));
  
  if (toScrape.length === 0) {
    console.log('✅ All known post IDs are already scraped!');
    console.log('Run with --discover to find more post IDs.\n');
    return;
  }
  
  console.log(`📋 Will scrape ${toScrape.length} updates\n`);
  
  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  const page = await context.newPage();
  
  // Discover more if requested
  if (process.argv.includes('--discover')) {
    const discoveredIds = await discoverPostIds(page);
    console.log(`\nDiscovered ${discoveredIds.length} post IDs\n`);
    
    // Save discovered IDs
    const newPostIds = discoveredIds.filter(id => !postIds.includes(id));
    if (newPostIds.length > 0) {
      fs.appendFileSync(postIdsFile, '\n# Discovered via browser\n' + newPostIds.join('\n') + '\n');
      console.log(`Added ${newPostIds.length} new post IDs to ${postIdsFile}\n`);
    }
    
    toScrape.push(...newPostIds);
  }
  
  // Scrape updates
  let scraped = 0;
  let errors = 0;
  
  const limit = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1]) || toScrape.length;
  
  for (let i = 0; i < Math.min(toScrape.length, limit); i++) {
    const postId = toScrape[i];
    console.log(`[${i + 1}/${Math.min(toScrape.length, limit)}] Scraping ${postId}...`);
    
    const update = await scrapeUpdatePage(page, postId);
    
    if (update && update.content.length > 100) {
      await saveUpdate(update);
      scraped++;
    } else {
      errors++;
    }
    
    await delay(2000); // Be nice to Kickstarter
  }
  
  await browser.close();
  
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Complete!`);
  console.log(`═══════════════════════════════════════════`);
  console.log(`  Scraped: ${scraped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total files: ${existingFiles.length + scraped}\n`);
}

main().catch(console.error);

