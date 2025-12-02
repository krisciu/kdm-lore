#!/usr/bin/env npx ts-node
/**
 * Kingdom Death Monster 1.5 Kickstarter Updates Scraper
 * 
 * Scrapes all 134 updates from the KDM 1.5 Kickstarter campaign including:
 * - Full text content from each update
 * - All embedded images (monster reveals, cards, artwork)
 * - Metadata for indexing
 * 
 * Usage:
 *   npx ts-node scripts/scrape-kickstarter.ts list      - List all update URLs
 *   npx ts-node scripts/scrape-kickstarter.ts scrape    - Scrape all updates
 *   npx ts-node scripts/scrape-kickstarter.ts single N  - Scrape update N
 *   npx ts-node scripts/scrape-kickstarter.ts status    - Show scraping progress
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const KS_BASE_URL = 'https://www.kickstarter.com/projects/poots/kingdom-death-monster-15';
const OUTPUT_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources', 'kickstarter');
const UPDATES_PATH = path.join(OUTPUT_PATH, 'updates');
const IMAGES_PATH = path.join(OUTPUT_PATH, 'images');
const INDEX_FILE = path.join(OUTPUT_PATH, 'updates-index.json');

// Console colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(color: keyof typeof colors, message: string): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

interface KickstarterUpdate {
  number: number;
  title: string;
  date: string;
  url: string;
  content: string;
  images: string[];
  localImages: string[];
  hasLore: boolean;
  tags: string[];
}

interface UpdatesIndex {
  version: string;
  lastUpdated: string;
  totalUpdates: number;
  scrapedUpdates: number;
  updates: KickstarterUpdate[];
}

/**
 * Ensure directory exists
 */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Rate limit delay
 */
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sanitize filename
 */
function sanitize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

/**
 * Fetch HTML from URL
 */
async function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    };
    
    protocol.get(url, options, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          fetchHtml(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Download image to local path
 */
async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    
    // Ensure directory exists
    ensureDir(path.dirname(outputPath));
    
    const file = fs.createWriteStream(outputPath);
    
    protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          downloadImage(redirectUrl, outputPath).then(resolve);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(outputPath); } catch {}
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
      try { fs.unlinkSync(outputPath); } catch {}
      resolve(false);
    });
  });
}

/**
 * Extract update URLs from the updates list page HTML
 */
function extractUpdateUrls(html: string): { number: number; url: string; title: string }[] {
  const updates: { number: number; url: string; title: string }[] = [];
  
  // Pattern for update links: /projects/poots/kingdom-death-monster-15/posts/NNNNNN
  const urlPattern = /\/projects\/poots\/kingdom-death-monster-15\/posts\/(\d+)/g;
  const seen = new Set<string>();
  
  let match;
  while ((match = urlPattern.exec(html)) !== null) {
    const postId = match[1];
    if (!seen.has(postId)) {
      seen.add(postId);
      updates.push({
        number: updates.length + 1,
        url: `${KS_BASE_URL}/posts/${postId}`,
        title: `Update ${updates.length + 1}`
      });
    }
  }
  
  return updates;
}

/**
 * Extract content from a single update page
 */
function parseUpdatePage(html: string, updateNum: number): Partial<KickstarterUpdate> {
  // Extract title
  const titleMatch = html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                     html.match(/<title>([^<|]+)/i);
  const title = titleMatch ? titleMatch[1].trim() : `Update ${updateNum}`;
  
  // Extract date
  const dateMatch = html.match(/datetime="([^"]+)"/) ||
                    html.match(/(\w+ \d+, \d{4})/);
  const date = dateMatch ? dateMatch[1] : 'Unknown';
  
  // Extract main content - look for the post body
  let content = '';
  
  // Try to find the post content div
  const contentMatch = html.match(/<div[^>]*class="[^"]*post-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                       html.match(/<div[^>]*class="[^"]*body[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                       html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  
  if (contentMatch) {
    content = contentMatch[1]
      // Remove script and style tags
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
      // Convert links to text
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
      // Remove remaining HTML tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // Clean up whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }
  
  // Extract images
  const images: string[] = [];
  const imgPattern = /<img[^>]+src="([^"]+)"[^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgPattern.exec(html)) !== null) {
    let imgUrl = imgMatch[1];
    // Skip small images, icons, avatars
    if (imgUrl.includes('avatar') || imgUrl.includes('icon') || imgUrl.includes('1x1')) {
      continue;
    }
    // Make absolute URL
    if (imgUrl.startsWith('//')) {
      imgUrl = 'https:' + imgUrl;
    }
    if (imgUrl.startsWith('http')) {
      images.push(imgUrl);
    }
  }
  
  // Detect lore-related content
  const loreKeywords = [
    'monster', 'survivor', 'settlement', 'hunt', 'showdown', 'darkness',
    'lantern', 'expansion', 'campaign', 'nemesis', 'quarry', 'story',
    'lion', 'butcher', 'phoenix', 'dragon', 'sunstalker', 'gorm',
    'spidicules', 'flower knight', 'dung beetle', 'slenderman',
    'gambler', 'chest', 'screaming', 'antelope', 'watcher', 'hand',
    'gold smoke', 'twilight', 'knight', 'armor', 'weapon', 'gear'
  ];
  
  const contentLower = (content + ' ' + title).toLowerCase();
  const hasLore = loreKeywords.some(kw => contentLower.includes(kw));
  
  // Auto-tag based on content
  const tags: string[] = [];
  if (contentLower.includes('monster')) tags.push('monster');
  if (contentLower.includes('survivor')) tags.push('survivor');
  if (contentLower.includes('expansion')) tags.push('expansion');
  if (contentLower.includes('campaign')) tags.push('campaign');
  if (contentLower.includes('shipping') || contentLower.includes('wave')) tags.push('shipping');
  if (contentLower.includes('stretch goal')) tags.push('stretch-goal');
  if (contentLower.includes('update') && contentLower.includes('rule')) tags.push('rules');
  if (images.length > 3) tags.push('image-heavy');
  
  return {
    number: updateNum,
    title,
    date,
    content,
    images,
    hasLore,
    tags,
  };
}

/**
 * Load existing index
 */
function loadIndex(): UpdatesIndex {
  if (fs.existsSync(INDEX_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
    } catch {}
  }
  
  return {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    totalUpdates: 134,
    scrapedUpdates: 0,
    updates: [],
  };
}

/**
 * Save index
 */
function saveIndex(index: UpdatesIndex): void {
  ensureDir(OUTPUT_PATH);
  index.lastUpdated = new Date().toISOString();
  index.scrapedUpdates = index.updates.length;
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Save update to file
 */
function saveUpdate(update: KickstarterUpdate): void {
  ensureDir(UPDATES_PATH);
  
  const filename = `update-${String(update.number).padStart(3, '0')}.txt`;
  const filepath = path.join(UPDATES_PATH, filename);
  
  const header = `# ${update.title}
Update #${update.number}
Date: ${update.date}
Source: ${update.url}
Tags: ${update.tags.join(', ')}
Has Lore: ${update.hasLore ? 'Yes' : 'No'}
Images: ${update.images.length}

---

`;
  
  fs.writeFileSync(filepath, header + update.content, 'utf-8');
  log('green', `✓ Saved: ${filename}`);
}

/**
 * Download images for an update
 */
async function downloadUpdateImages(update: KickstarterUpdate): Promise<string[]> {
  const localImages: string[] = [];
  const updateDir = path.join(IMAGES_PATH, `update-${String(update.number).padStart(3, '0')}`);
  ensureDir(updateDir);
  
  for (let i = 0; i < update.images.length; i++) {
    const imgUrl = update.images[i];
    const ext = path.extname(new URL(imgUrl).pathname) || '.jpg';
    const filename = `image-${String(i + 1).padStart(3, '0')}${ext}`;
    const localPath = path.join(updateDir, filename);
    
    // Skip if already downloaded
    if (fs.existsSync(localPath)) {
      localImages.push(localPath);
      continue;
    }
    
    const success = await downloadImage(imgUrl, localPath);
    if (success) {
      localImages.push(localPath);
      log('dim', `  ✓ Image ${i + 1}/${update.images.length}`);
    } else {
      log('yellow', `  ✗ Failed: ${filename}`);
    }
    
    await delay(500); // Rate limit
  }
  
  return localImages;
}

/**
 * Scrape a single update
 */
async function scrapeUpdate(url: string, updateNum: number): Promise<KickstarterUpdate | null> {
  try {
    log('blue', `\n📄 Scraping Update #${updateNum}...`);
    
    const html = await fetchHtml(url);
    const parsed = parseUpdatePage(html, updateNum);
    
    const update: KickstarterUpdate = {
      number: updateNum,
      title: parsed.title || `Update ${updateNum}`,
      date: parsed.date || 'Unknown',
      url,
      content: parsed.content || '',
      images: parsed.images || [],
      localImages: [],
      hasLore: parsed.hasLore || false,
      tags: parsed.tags || [],
    };
    
    log('cyan', `   Title: ${update.title}`);
    log('dim', `   Date: ${update.date}`);
    log('dim', `   Images: ${update.images.length}`);
    log('dim', `   Has Lore: ${update.hasLore}`);
    
    // Download images
    if (update.images.length > 0) {
      update.localImages = await downloadUpdateImages(update);
    }
    
    // Save text content
    saveUpdate(update);
    
    return update;
  } catch (error: any) {
    log('red', `✗ Error scraping update ${updateNum}: ${error.message}`);
    return null;
  }
}

/**
 * Show progress status
 */
function showStatus(): void {
  const index = loadIndex();
  
  log('cyan', '\n═══════════════════════════════════════════');
  log('cyan', '  Kickstarter Updates Scraper - Status');
  log('cyan', '═══════════════════════════════════════════\n');
  
  log('blue', `Last Updated: ${index.lastUpdated}`);
  log('cyan', `\nTotal Updates: ${index.totalUpdates}`);
  log('green', `Scraped: ${index.scrapedUpdates}`);
  log('yellow', `Remaining: ${index.totalUpdates - index.scrapedUpdates}`);
  
  const progress = ((index.scrapedUpdates / index.totalUpdates) * 100).toFixed(1);
  log('blue', `\nProgress: ${progress}%`);
  
  // Count images
  let totalImages = 0;
  let loreUpdates = 0;
  for (const update of index.updates) {
    totalImages += update.localImages?.length || 0;
    if (update.hasLore) loreUpdates++;
  }
  
  log('dim', `\nImages Downloaded: ${totalImages}`);
  log('dim', `Updates with Lore: ${loreUpdates}`);
  
  // Show tag distribution
  const tagCounts: Record<string, number> = {};
  for (const update of index.updates) {
    for (const tag of update.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  
  if (Object.keys(tagCounts).length > 0) {
    log('blue', '\nTags:');
    for (const [tag, count] of Object.entries(tagCounts).sort((a, b) => b[1] - a[1])) {
      log('dim', `  ${tag}: ${count}`);
    }
  }
}

/**
 * Generate summary markdown
 */
function generateSummary(index: UpdatesIndex): void {
  const loreUpdates = index.updates.filter(u => u.hasLore);
  const totalImages = index.updates.reduce((sum, u) => sum + (u.localImages?.length || 0), 0);
  
  const content = `# Kingdom Death Monster 1.5 - Kickstarter Updates

**Source:** ${KS_BASE_URL}
**Total Updates:** ${index.totalUpdates}
**Scraped:** ${index.scrapedUpdates}
**Last Updated:** ${index.lastUpdated}

## Summary

- **Total Images:** ${totalImages}
- **Updates with Lore:** ${loreUpdates.length}
- **Image-Heavy Updates:** ${index.updates.filter(u => u.tags.includes('image-heavy')).length}

## Updates with Notable Lore

${loreUpdates.slice(0, 20).map(u => `- [Update #${u.number}](updates/update-${String(u.number).padStart(3, '0')}.txt) - ${u.title} (${u.date})`).join('\n')}

## Tag Index

${Object.entries(
  index.updates.reduce((acc, u) => {
    for (const tag of u.tags) {
      acc[tag] = acc[tag] || [];
      acc[tag].push(u.number);
    }
    return acc;
  }, {} as Record<string, number[]>)
).map(([tag, nums]) => `- **${tag}:** ${nums.length} updates`).join('\n')}

## File Structure

\`\`\`
kickstarter/
├── updates/           # ${index.scrapedUpdates} text files
├── images/            # ${totalImages} images organized by update
├── updates-index.json # Full metadata
└── kickstarter-summary.md
\`\`\`
`;

  fs.writeFileSync(path.join(OUTPUT_PATH, 'kickstarter-summary.md'), content, 'utf-8');
  log('green', '✓ Generated kickstarter-summary.md');
}

/**
 * Main scraping function
 */
async function scrapeAllUpdates(): Promise<void> {
  log('cyan', '\n═══════════════════════════════════════════');
  log('cyan', '  Kingdom Death Monster 1.5 Kickstarter');
  log('cyan', '  Updates Scraper');
  log('cyan', '═══════════════════════════════════════════\n');
  
  const index = loadIndex();
  const scrapedNumbers = new Set(index.updates.map(u => u.number));
  
  // Known update post IDs (these need to be discovered from the updates page)
  // For now, we'll try sequential scraping of the updates page
  log('blue', '📋 Fetching updates list...\n');
  
  try {
    // Fetch the main updates page
    const updatesPageHtml = await fetchHtml(`${KS_BASE_URL}/posts`);
    const updateLinks = extractUpdateUrls(updatesPageHtml);
    
    if (updateLinks.length === 0) {
      log('yellow', 'No update URLs found on page. Kickstarter may require JavaScript rendering.');
      log('yellow', 'Try using the browser-based scraper with: scrape-kickstarter.ts browser');
      return;
    }
    
    log('green', `Found ${updateLinks.length} updates\n`);
    
    // Scrape each update
    for (const link of updateLinks) {
      if (scrapedNumbers.has(link.number)) {
        log('dim', `Skipping Update #${link.number} (already scraped)`);
        continue;
      }
      
      const update = await scrapeUpdate(link.url, link.number);
      if (update) {
        index.updates.push(update);
        saveIndex(index);
      }
      
      // Rate limit between updates
      await delay(3000);
    }
    
    // Generate summary
    generateSummary(index);
    
    log('green', '\n✅ Scraping complete!');
    showStatus();
    
  } catch (error: any) {
    log('red', `Error: ${error.message}`);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';
  
  ensureDir(OUTPUT_PATH);
  ensureDir(UPDATES_PATH);
  ensureDir(IMAGES_PATH);
  
  switch (command) {
    case 'status':
      showStatus();
      break;
      
    case 'scrape':
      await scrapeAllUpdates();
      break;
      
    case 'single':
      const num = parseInt(args[1], 10);
      if (isNaN(num)) {
        log('red', 'Usage: scrape-kickstarter.ts single <update-number>');
        break;
      }
      // For single update, we need the URL
      log('yellow', 'Single update scraping requires the post ID.');
      log('yellow', 'Use "scrape" to discover and scrape all updates.');
      break;
      
    case 'list':
      log('blue', 'Fetching update list...\n');
      try {
        const html = await fetchHtml(`${KS_BASE_URL}/posts`);
        const links = extractUpdateUrls(html);
        log('cyan', `Found ${links.length} updates:\n`);
        for (const link of links) {
          console.log(`  ${link.number}. ${link.url}`);
        }
      } catch (error: any) {
        log('red', `Error: ${error.message}`);
      }
      break;
      
    case 'summary':
      const index = loadIndex();
      generateSummary(index);
      break;
      
    default:
      console.log(`
Kingdom Death Monster 1.5 Kickstarter Scraper

Usage:
  npx ts-node scripts/scrape-kickstarter.ts status   - Show scraping progress
  npx ts-node scripts/scrape-kickstarter.ts list     - List all update URLs
  npx ts-node scripts/scrape-kickstarter.ts scrape   - Scrape all updates
  npx ts-node scripts/scrape-kickstarter.ts summary  - Generate summary file
`);
  }
}

main().catch(console.error);

