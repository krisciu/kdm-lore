#!/usr/bin/env npx ts-node
/**
 * Complete Kickstarter Update Scraper
 * 
 * Strategy: Start from earliest known update and work forward,
 * or use post ID list from RSS/Wayback to scrape all content.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { JSDOM } from 'jsdom';

const OUTPUT_DIR = path.join(process.cwd(), 'docs', 'lore', 'sources', 'kickstarter');
const UPDATES_DIR = path.join(OUTPUT_DIR, 'updates');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');
const INDEX_FILE = path.join(OUTPUT_DIR, 'updates-index.json');
const POST_IDS_FILE = path.join(OUTPUT_DIR, 'all-post-ids.txt');

interface UpdateInfo {
  postId: string;
  updateNumber?: number;
  title: string;
  date: string;
  url: string;
  imageCount: number;
  content: string;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 30000,
    });
    return response.data;
  } catch (error: any) {
    console.log(`  ⚠ Failed to fetch: ${error.message?.slice(0, 50)}`);
    return null;
  }
}

async function parseUpdatePage(html: string, url: string): Promise<UpdateInfo | null> {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Extract post ID from URL
  const postIdMatch = url.match(/\/posts\/(\d+)/);
  if (!postIdMatch) return null;
  const postId = postIdMatch[1];

  // Title
  const titleEl = doc.querySelector('h2.mb3 a') || doc.querySelector('.post-title');
  const title = titleEl?.textContent?.trim() || 'Untitled Update';

  // Date
  const dateEl = doc.querySelector('time.block');
  const date = dateEl?.getAttribute('datetime') || new Date().toISOString();

  // Content
  const contentEl = doc.querySelector('.rte__content');
  if (!contentEl) {
    console.log(`  ⚠ No content element found`);
    return null;
  }

  // Extract images
  const images: string[] = [];
  contentEl.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('data:')) {
      images.push(src);
    }
  });

  // Clean content
  contentEl.querySelectorAll('figure, script, style').forEach(el => el.remove());
  const content = contentEl.textContent?.replace(/\n\s*\n/g, '\n\n').trim() || '';

  // Try to extract update number from title or page
  let updateNumber: number | undefined;
  const updateMatch = title.match(/Update\s+#?(\d+)/i) || 
                      doc.body.textContent?.match(/Update\s+#?(\d+)/i);
  if (updateMatch) {
    updateNumber = parseInt(updateMatch[1]);
  }

  return {
    postId,
    updateNumber,
    title,
    date,
    url,
    imageCount: images.length,
    content,
  };
}

async function saveUpdate(update: UpdateInfo): Promise<void> {
  const filename = update.updateNumber 
    ? `update-${String(update.updateNumber).padStart(3, '0')}.txt`
    : `update-${update.postId}.txt`;
  
  const filePath = path.join(UPDATES_DIR, filename);
  
  if (fs.existsSync(filePath)) {
    return; // Skip existing
  }

  let content = `# ${update.title}\n`;
  content += `Post ID: ${update.postId}\n`;
  if (update.updateNumber) {
    content += `Update Number: ${update.updateNumber}\n`;
  }
  content += `Date: ${update.date}\n`;
  content += `Source: ${update.url}\n`;
  content += `Images: ${update.imageCount}\n`;
  content += `\n---\n\n`;
  content += update.content;

  fs.writeFileSync(filePath, content);
  console.log(`  ✓ Saved: ${filename}`);
}

async function downloadImages(update: UpdateInfo, html: string): Promise<number> {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const contentEl = doc.querySelector('.rte__content');
  if (!contentEl) return 0;

  const images: string[] = [];
  contentEl.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('data:')) {
      images.push(src);
    }
  });

  if (images.length === 0) return 0;

  const imageDir = path.join(IMAGES_DIR, `post-${update.postId}`);
  ensureDir(imageDir);

  let downloaded = 0;
  for (let i = 0; i < images.length; i++) {
    const imageUrl = images[i];
    const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
    const imagePath = path.join(imageDir, `img-${String(i + 1).padStart(2, '0')}${ext}`);

    if (fs.existsSync(imagePath)) {
      downloaded++;
      continue;
    }

    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
      fs.writeFileSync(imagePath, response.data);
      downloaded++;
    } catch {
      // Skip failed downloads
    }
    await delay(100);
  }

  return downloaded;
}

async function discoverPostIds(startingPostId: string): Promise<string[]> {
  const postIds: string[] = [startingPostId];
  let currentId = startingPostId;
  
  console.log('Discovering all post IDs by following Previous links...\n');
  
  while (true) {
    const url = `https://www.kickstarter.com/projects/poots/kingdom-death-monster-15/posts/${currentId}`;
    const html = await fetchPage(url);
    
    if (!html) break;
    
    // Find Previous link
    const prevMatch = html.match(/href="\/projects\/poots\/kingdom-death-monster-15\/posts\/(\d+)"[^>]*>\s*<[^>]*Previou/i) ||
                      html.match(/posts\/(\d+)"[^>]*class="[^"]*prev/i);
    
    if (prevMatch) {
      const prevId = prevMatch[1];
      if (postIds.includes(prevId)) break;
      
      postIds.push(prevId);
      currentId = prevId;
      process.stdout.write(`  Found ${postIds.length} post IDs...\r`);
      await delay(1000);
    } else {
      break;
    }
  }
  
  console.log(`\n✓ Discovered ${postIds.length} total post IDs\n`);
  return postIds;
}

async function main(): Promise<void> {
  console.log('\n🚀 Complete Kickstarter Scraper\n');
  
  ensureDir(UPDATES_DIR);
  ensureDir(IMAGES_DIR);
  
  // Check existing progress
  const existingFiles = fs.readdirSync(UPDATES_DIR);
  console.log(`Found ${existingFiles.length} existing update files\n`);
  
  // Get list of post IDs we need to scrape
  // Load from post-ids.txt if it exists, or discover them
  let postIds: string[] = [];
  
  if (fs.existsSync(POST_IDS_FILE)) {
    const content = fs.readFileSync(POST_IDS_FILE, 'utf-8');
    postIds = content.split('\n')
      .map(line => line.trim())
      .filter(line => /^\d+$/.test(line));
    console.log(`Loaded ${postIds.length} post IDs from file\n`);
  }
  
  if (postIds.length === 0) {
    // Discover from oldest known
    console.log('No post ID list found. Discovering...');
    // Start from earliest we know about
    postIds = await discoverPostIds('4115109');
    
    // Save for future use
    fs.writeFileSync(POST_IDS_FILE, postIds.join('\n'));
  }
  
  // Scrape each post
  let scraped = 0;
  let skipped = 0;
  let totalImages = 0;
  
  console.log('Scraping updates...\n');
  
  for (const postId of postIds) {
    const existingFile = existingFiles.find(f => f.includes(postId));
    if (existingFile) {
      skipped++;
      continue;
    }
    
    const url = `https://www.kickstarter.com/projects/poots/kingdom-death-monster-15/posts/${postId}`;
    console.log(`📄 Scraping ${postId}...`);
    
    const html = await fetchPage(url);
    if (!html) {
      await delay(2000);
      continue;
    }
    
    const update = await parseUpdatePage(html, url);
    if (update) {
      await saveUpdate(update);
      const imgCount = await downloadImages(update, html);
      totalImages += imgCount;
      scraped++;
    }
    
    await delay(1500); // Rate limit
  }
  
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Complete!`);
  console.log(`═══════════════════════════════════════════`);
  console.log(`  Scraped: ${scraped}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Images: ${totalImages}`);
  console.log(`  Total files: ${existingFiles.length + scraped}\n`);
}

main().catch(console.error);

