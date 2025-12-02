#!/usr/bin/env npx ts-node
/**
 * FAST Kickstarter RSS Scraper
 * 
 * Parses the Kickstarter RSS/Atom feed which contains FULL content and image URLs!
 * Much faster than browser-based scraping.
 * 
 * Usage:
 *   npx ts-node scripts/scrape-kickstarter-rss.ts
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

const RSS_URL = 'https://www.kickstarter.com/projects/poots/kingdom-death-monster-15/posts.atom';
const OUTPUT_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources', 'kickstarter');
const UPDATES_PATH = path.join(OUTPUT_PATH, 'updates');
const IMAGES_PATH = path.join(OUTPUT_PATH, 'images');

interface ParsedUpdate {
  number: number;
  postId: string;
  title: string;
  published: string;
  updated: string;
  url: string;
  htmlContent: string;
  textContent: string;
  imageUrls: string[];
  videoUrls: string[];
  headings: string[];
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Fetch the RSS feed
 */
async function fetchRssFeed(): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(RSS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      }
    }, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Parse RSS feed entries
 */
function parseRssFeed(xml: string): ParsedUpdate[] {
  const updates: ParsedUpdate[] = [];
  
  // Extract all <entry> elements
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  let updateNumber = 134; // Start from most recent
  
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    
    // Extract post ID
    const idMatch = entry.match(/FreeformPost\/(\d+)/);
    const postId = idMatch ? idMatch[1] : '';
    
    // Extract title
    const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : '';
    
    // Extract dates
    const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
    const updatedMatch = entry.match(/<updated>([^<]+)<\/updated>/);
    
    // Extract URL
    const urlMatch = entry.match(/href="([^"]+)"/);
    const url = urlMatch ? urlMatch[1] : '';
    
    // Extract HTML content
    const contentMatch = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/);
    const htmlContent = contentMatch ? decodeHtmlEntities(contentMatch[1]) : '';
    
    // Extract image URLs
    const imageUrls: string[] = [];
    const imgRegex = /src="(https:\/\/i\.kickstarter\.com\/[^"]+)"/g;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(htmlContent)) !== null) {
      imageUrls.push(decodeHtmlEntities(imgMatch[1]));
    }
    
    // Extract video URLs
    const videoUrls: string[] = [];
    const videoRegex = /url="(https:\/\/(?:youtu\.be|www\.youtube\.com)[^"]+)"/g;
    let videoMatch;
    while ((videoMatch = videoRegex.exec(htmlContent)) !== null) {
      videoUrls.push(decodeHtmlEntities(videoMatch[1]));
    }
    
    // Extract headings (lore sections)
    const headings: string[] = [];
    const headingRegex = /<h[34][^>]*>([^<]+)<\/h[34]>/g;
    let headingMatch;
    while ((headingMatch = headingRegex.exec(htmlContent)) !== null) {
      headings.push(decodeHtmlEntities(headingMatch[1]));
    }
    
    // Convert HTML to text
    const textContent = htmlToText(htmlContent);
    
    updates.push({
      number: updateNumber--,
      postId,
      title,
      published: publishedMatch ? publishedMatch[1] : '',
      updated: updatedMatch ? updatedMatch[1] : '',
      url,
      htmlContent,
      textContent,
      imageUrls,
      videoUrls,
      headings,
    });
  }
  
  return updates;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Convert HTML to plain text
 */
function htmlToText(html: string): string {
  return html
    // Remove script and style
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Convert headers
    .replace(/<h[1-6][^>]*>([^<]*)<\/h[1-6]>/gi, '\n## $1\n')
    // Convert paragraphs
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    // Convert line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Convert lists
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    // Remove figure/div wrappers
    .replace(/<figure[^>]*>/gi, '\n')
    .replace(/<\/figure>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '')
    // Remove img tags (we capture URLs separately)
    .replace(/<img[^>]*>/gi, '[IMAGE]')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Clean up whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Download image
 */
async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirect = response.headers.location;
        if (redirect) {
          file.close();
          downloadImage(redirect, outputPath).then(resolve);
          return;
        }
      }
      if (response.statusCode !== 200) {
        file.close();
        resolve(false);
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
    }).on('error', () => {
      file.close();
      resolve(false);
    });
  });
}

/**
 * Save update to file
 */
function saveUpdate(update: ParsedUpdate): void {
  const filename = `update-${String(update.number).padStart(3, '0')}.txt`;
  const filepath = path.join(UPDATES_PATH, filename);
  
  const content = `# Update #${update.number}: ${update.title}
Date: ${update.published}
Source: ${update.url}
Post ID: ${update.postId}
Images: ${update.imageUrls.length}
Videos: ${update.videoUrls.length}

## Sections
${update.headings.map(h => `- ${h}`).join('\n')}

---

${update.textContent}

---

## Image URLs
${update.imageUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}

## Video URLs
${update.videoUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}
`;
  
  fs.writeFileSync(filepath, content, 'utf-8');
}

/**
 * Save index
 */
function saveIndex(updates: ParsedUpdate[]): void {
  const index = {
    version: '2.0',
    lastUpdated: new Date().toISOString(),
    source: 'RSS Feed',
    totalUpdates: updates.length,
    totalImages: updates.reduce((sum, u) => sum + u.imageUrls.length, 0),
    updates: updates.map(u => ({
      number: u.number,
      postId: u.postId,
      title: u.title,
      date: u.published,
      url: u.url,
      imageCount: u.imageUrls.length,
      videoCount: u.videoUrls.length,
      headings: u.headings,
    })),
  };
  
  fs.writeFileSync(
    path.join(OUTPUT_PATH, 'updates-index.json'),
    JSON.stringify(index, null, 2),
    'utf-8'
  );
}

/**
 * Main
 */
async function main(): Promise<void> {
  console.log('\n🚀 FAST Kickstarter RSS Scraper\n');
  console.log('Fetching RSS feed...');
  
  ensureDir(UPDATES_PATH);
  ensureDir(IMAGES_PATH);
  
  try {
    const xml = await fetchRssFeed();
    console.log(`✓ Fetched ${xml.length} bytes\n`);
    
    const updates = parseRssFeed(xml);
    console.log(`✓ Parsed ${updates.length} updates\n`);
    
    // Save all updates
    console.log('Saving updates...');
    for (const update of updates) {
      saveUpdate(update);
      console.log(`  ✓ Update #${update.number}: ${update.title} (${update.imageUrls.length} images)`);
    }
    
    // Save index
    saveIndex(updates);
    console.log(`\n✓ Saved index with ${updates.length} updates`);
    
    // Summary
    const totalImages = updates.reduce((sum, u) => sum + u.imageUrls.length, 0);
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`  Summary`);
    console.log(`═══════════════════════════════════════════`);
    console.log(`  Updates: ${updates.length}`);
    console.log(`  Images: ${totalImages}`);
    console.log(`  Videos: ${updates.reduce((sum, u) => sum + u.videoUrls.length, 0)}`);
    console.log(`\n✅ All updates saved to ${UPDATES_PATH}`);
    
    // Now download images
    console.log('\n📷 Downloading images...');
    let downloaded = 0;
    let failed = 0;
    
    for (const update of updates) {
      if (update.imageUrls.length === 0) continue;
      
      const updateDir = path.join(IMAGES_PATH, `update-${String(update.number).padStart(3, '0')}`);
      ensureDir(updateDir);
      
      for (let i = 0; i < update.imageUrls.length; i++) {
        const url = update.imageUrls[i];
        const ext = url.includes('.gif') ? '.gif' : url.includes('.png') ? '.png' : '.jpg';
        const filename = `img-${String(i + 1).padStart(3, '0')}${ext}`;
        const outputPath = path.join(updateDir, filename);
        
        if (fs.existsSync(outputPath)) {
          continue; // Skip existing
        }
        
        const success = await downloadImage(url, outputPath);
        if (success) {
          downloaded++;
          process.stdout.write(`\r  Downloaded: ${downloaded} images...`);
        } else {
          failed++;
        }
        
        // Small delay between downloads
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    console.log(`\n\n✅ Downloaded ${downloaded} images (${failed} failed)`);
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

main();

