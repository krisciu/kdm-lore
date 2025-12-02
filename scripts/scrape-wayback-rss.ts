#!/usr/bin/env npx ts-node
/**
 * Wayback Machine RSS Scraper
 * 
 * Fetches historical RSS feeds from archive.org to get old Kickstarter updates
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

const OUTPUT_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources', 'kickstarter');
const UPDATES_PATH = path.join(OUTPUT_PATH, 'updates');
const IMAGES_PATH = path.join(OUTPUT_PATH, 'images');

// Wayback Machine snapshots of the RSS feed (discovered via CDX API)
const WAYBACK_SNAPSHOTS = [
  { timestamp: '20161205163525', date: '2016-12-05', expectedUpdates: '1-10' },
  { timestamp: '20170105184304', date: '2017-01-05', expectedUpdates: '10-20' },
  { timestamp: '20170815060518', date: '2017-08-15', expectedUpdates: '20-40' },
  { timestamp: '20180120224717', date: '2018-01-20', expectedUpdates: '40-60' },
  { timestamp: '20190103064351', date: '2019-01-03', expectedUpdates: '60-80' },
  { timestamp: '20190804215236', date: '2019-08-04', expectedUpdates: '80-100' },
  { timestamp: '20200727121450', date: '2020-07-27', expectedUpdates: '100-110' },
];

interface ParsedUpdate {
  postId: string;
  title: string;
  published: string;
  url: string;
  content: string;
  imageUrls: string[];
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirect = response.headers.location;
        if (redirect) {
          fetchUrl(redirect).then(resolve).catch(reject);
          return;
        }
      }
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function decodeHtml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<h[1-6][^>]*>([^<]*)<\/h[1-6]>/gi, '\n## $1\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<img[^>]*>/gi, '[IMAGE]')
    .replace(/<[^>]+>/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

function parseRssEntries(xml: string): ParsedUpdate[] {
  const updates: ParsedUpdate[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    
    // Post ID from old format (Post/NNNN) or new format (FreeformPost/NNNN)
    const idMatch = entry.match(/(?:Post|FreeformPost)\/(\d+)/);
    const postId = idMatch ? idMatch[1] : '';
    
    const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? decodeHtml(titleMatch[1]) : '';
    
    const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
    const published = publishedMatch ? publishedMatch[1] : '';
    
    const urlMatch = entry.match(/href="([^"]+posts\/\d+[^"]*)"/);
    const url = urlMatch ? urlMatch[1] : '';
    
    const contentMatch = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/);
    const htmlContent = contentMatch ? decodeHtml(contentMatch[1]) : '';
    const content = htmlToText(htmlContent);
    
    // Extract image URLs
    const imageUrls: string[] = [];
    const imgRegex = /src="(https?:\/\/[^"]+(?:\.png|\.jpg|\.jpeg|\.gif)[^"]*)"/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(htmlContent)) !== null) {
      imageUrls.push(decodeHtml(imgMatch[1]));
    }
    
    if (postId && title) {
      updates.push({ postId, title, published, url, content, imageUrls });
    }
  }
  
  return updates;
}

async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(outputPath);
    const protocol = url.startsWith('https') ? https : require('http');
    
    protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response: any) => {
      if (response.statusCode !== 200) {
        file.close();
        resolve(false);
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
    }).on('error', () => { file.close(); resolve(false); });
  });
}

function saveUpdate(postId: string, title: string, published: string, url: string, content: string, imageUrls: string[]): void {
  const filename = `update-${postId}.txt`;
  const filepath = path.join(UPDATES_PATH, filename);
  
  // Skip if already exists
  if (fs.existsSync(filepath)) {
    return;
  }
  
  const fileContent = `# ${title}
Post ID: ${postId}
Date: ${published}
Source: ${url}
Images: ${imageUrls.length}

---

${content}

---

## Image URLs
${imageUrls.map((u, i) => `${i + 1}. ${u}`).join('\n')}
`;
  
  fs.writeFileSync(filepath, fileContent, 'utf-8');
}

async function processSnapshot(timestamp: string, date: string): Promise<number> {
  // Use id_/ prefix for raw content (no Wayback wrapper)
  const waybackUrl = `https://web.archive.org/web/${timestamp}id_/https://www.kickstarter.com/projects/poots/kingdom-death-monster-15/posts.atom`;
  
  console.log(`\n📦 Fetching snapshot from ${date}...`);
  
  try {
    const xml = await fetchUrl(waybackUrl);
    const updates = parseRssEntries(xml);
    
    console.log(`   Found ${updates.length} updates`);
    
    let newUpdates = 0;
    for (const update of updates) {
      const filepath = path.join(UPDATES_PATH, `update-${update.postId}.txt`);
      if (!fs.existsSync(filepath)) {
        saveUpdate(update.postId, update.title, update.published, update.url, update.content, update.imageUrls);
        newUpdates++;
        console.log(`   ✓ ${update.title.slice(0, 50)}...`);
        
        // Download images
        if (update.imageUrls.length > 0) {
          const imgDir = path.join(IMAGES_PATH, `post-${update.postId}`);
          ensureDir(imgDir);
          
          for (let i = 0; i < Math.min(update.imageUrls.length, 20); i++) {
            const imgUrl = update.imageUrls[i];
            const ext = imgUrl.includes('.gif') ? '.gif' : imgUrl.includes('.png') ? '.png' : '.jpg';
            const imgPath = path.join(imgDir, `img-${String(i + 1).padStart(2, '0')}${ext}`);
            
            if (!fs.existsSync(imgPath)) {
              await downloadImage(imgUrl, imgPath);
            }
          }
        }
      }
    }
    
    return newUpdates;
  } catch (error: any) {
    console.log(`   ✗ Error: ${error.message}`);
    return 0;
  }
}

async function main(): Promise<void> {
  console.log('\n🕰️  Wayback Machine RSS Scraper\n');
  console.log('Fetching historical Kickstarter updates from archive.org...\n');
  
  ensureDir(UPDATES_PATH);
  ensureDir(IMAGES_PATH);
  
  let totalNew = 0;
  
  for (const snapshot of WAYBACK_SNAPSHOTS) {
    const newCount = await processSnapshot(snapshot.timestamp, snapshot.date);
    totalNew += newCount;
    
    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Count total files
  const updateFiles = fs.readdirSync(UPDATES_PATH).filter(f => f.endsWith('.txt'));
  
  console.log('\n═══════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════');
  console.log(`  New updates scraped: ${totalNew}`);
  console.log(`  Total update files: ${updateFiles.length}`);
  console.log('\n✅ Done!');
}

main().catch(console.error);

