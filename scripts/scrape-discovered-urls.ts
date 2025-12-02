#!/usr/bin/env npx ts-node
/**
 * Batch scraper for discovered Kickstarter post URLs
 * Uses the post IDs we collected via browser clicking
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

const OUTPUT_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources', 'kickstarter');
const UPDATES_PATH = path.join(OUTPUT_PATH, 'updates');
const IMAGES_PATH = path.join(OUTPUT_PATH, 'images');

// Post IDs discovered via browser clicking
const DISCOVERED_POST_IDS = [
  { update: 134, postId: '4550627' },
  { update: 133, postId: '4528510' },
  { update: 132, postId: '4498770' },
  { update: 131, postId: '4471289' },
  { update: 130, postId: '4423166' },
  { update: 129, postId: '4398287' },
  { update: 128, postId: '4374406' },
  { update: 127, postId: '4327928' },
  { update: 126, postId: '4324893' },
  { update: 125, postId: '4303789' },
  { update: 124, postId: '4281544' },
  { update: 123, postId: '4257269' },
  { update: 122, postId: '4240089' },
  { update: 121, postId: '4211226' },
  { update: 120, postId: '4184460' },
  { update: 119, postId: '4140735' },
  { update: 118, postId: '4140665' },
  { update: 117, postId: '4115109' },
];

// Historical 2016 posts from Wayback
const HISTORICAL_POST_IDS = [
  { postId: '1755400', title: '$6.6M Secret Stretch Goal' },
  { postId: '1754792', title: '$6.5M Lion Knight Return' },
  { postId: '1753379', title: '$6.25M Gambler Chest Roll 5' },
  { postId: '1752444', title: 'OVER $6 MILLION' },
  { postId: '1751597', title: '5.7M Twitch Phoenix' },
  { postId: '1750349', title: '$5.2M Nightmare Ram' },
  { postId: '1749527', title: 'OVER $5 MILLION' },
  { postId: '1748638', title: '$4.6M Dragon King Reprint' },
  { postId: '1748282', title: '$4.3M in 24 hours' },
];

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirect = response.headers.location;
        if (redirect) {
          fetchHtml(redirect).then(resolve).catch(reject);
          return;
        }
      }
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
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

function extractContent(html: string): { title: string; content: string; images: string[] } {
  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].split('»')[1]?.trim() || titleMatch[1] : 'Unknown';
  
  // Extract images from i.kickstarter.com
  const images: string[] = [];
  const imgRegex = /src="(https:\/\/i\.kickstarter\.com[^"]+)"/g;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    images.push(imgMatch[1]);
  }
  
  // Extract post content (simplified)
  const contentMatch = html.match(/<div[^>]*class="[^"]*rte[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  let content = '';
  if (contentMatch) {
    content = contentMatch[1]
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  return { title, content, images };
}

async function scrapePost(postId: string, updateNum?: number): Promise<void> {
  const url = `https://www.kickstarter.com/projects/poots/kingdom-death-monster-15/posts/${postId}`;
  const filename = updateNum 
    ? `update-${String(updateNum).padStart(3, '0')}.txt`
    : `post-${postId}.txt`;
  const filepath = path.join(UPDATES_PATH, filename);
  
  // Skip if already exists
  if (fs.existsSync(filepath)) {
    console.log(`  ⏭ Skip: ${filename} (exists)`);
    return;
  }
  
  try {
    console.log(`  📄 Fetching: ${postId}...`);
    const html = await fetchHtml(url);
    const { title, content, images } = extractContent(html);
    
    // Save content
    const fileContent = `# ${title}
Post ID: ${postId}
Update: ${updateNum || 'Unknown'}
Source: ${url}
Images: ${images.length}

---

${content.slice(0, 5000)}${content.length > 5000 ? '...[truncated]' : ''}

---

## Image URLs
${images.slice(0, 20).map((u, i) => `${i + 1}. ${u}`).join('\n')}
${images.length > 20 ? `\n... and ${images.length - 20} more` : ''}
`;
    
    fs.writeFileSync(filepath, fileContent, 'utf-8');
    console.log(`  ✓ Saved: ${filename} (${images.length} images)`);
    
    // Download images
    if (images.length > 0) {
      const imgDir = path.join(IMAGES_PATH, updateNum ? `update-${String(updateNum).padStart(3, '0')}` : `post-${postId}`);
      ensureDir(imgDir);
      
      for (let i = 0; i < Math.min(images.length, 10); i++) {
        const imgUrl = images[i];
        const ext = imgUrl.includes('.gif') ? '.gif' : imgUrl.includes('.png') ? '.png' : '.jpg';
        const imgPath = path.join(imgDir, `img-${String(i + 1).padStart(2, '0')}${ext}`);
        
        if (!fs.existsSync(imgPath)) {
          await downloadImage(imgUrl, imgPath);
        }
      }
    }
    
  } catch (error: any) {
    console.log(`  ✗ Error: ${error.message}`);
  }
}

async function main(): Promise<void> {
  console.log('\n🚀 Batch Kickstarter Scraper\n');
  
  ensureDir(UPDATES_PATH);
  ensureDir(IMAGES_PATH);
  
  // Scrape discovered recent posts
  console.log('📦 Scraping recent updates (117-134)...\n');
  for (const post of DISCOVERED_POST_IDS) {
    await scrapePost(post.postId, post.update);
    await new Promise(r => setTimeout(r, 1500)); // Rate limit
  }
  
  // Count results
  const updateFiles = fs.readdirSync(UPDATES_PATH).filter(f => f.endsWith('.txt'));
  console.log(`\n✅ Done! Total update files: ${updateFiles.length}`);
}

main().catch(console.error);

