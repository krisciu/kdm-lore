#!/usr/bin/env npx ts-node
/**
 * Extract Images Script
 * 
 * Visits a page and extracts all image URLs, then downloads them.
 * Much more useful than full-page screenshots!
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const IMAGES_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources', 'official-site', 'images');

interface ExtractedImage {
  url: string;
  alt: string;
  filename: string;
  category: string;
}

/**
 * Download a single image from URL
 */
async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const file = fs.createWriteStream(outputPath);
    
    protocol.get(url, (response) => {
      // Follow redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadImage(redirectUrl, outputPath).then(resolve);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        console.error(`Failed to download ${url}: ${response.statusCode}`);
        file.close();
        fs.unlinkSync(outputPath);
        resolve(false);
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✓ Downloaded: ${path.basename(outputPath)}`);
        resolve(true);
      });
    }).on('error', (err) => {
      fs.unlinkSync(outputPath);
      console.error(`Error downloading ${url}:`, err.message);
      resolve(false);
    });
  });
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
 * Get file extension from URL or content type
 */
function getExtension(url: string): string {
  const urlPath = new URL(url).pathname;
  const ext = path.extname(urlPath).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
    return ext;
  }
  return '.jpg'; // Default
}

/**
 * Parse HTML and extract image information
 */
function parseImagesFromHtml(html: string, baseUrl: string): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  
  // Match img tags
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    let url = match[1];
    const alt = match[2] || '';
    
    // Skip tiny images, icons, etc.
    if (url.includes('icon') || url.includes('logo') || url.includes('1x1')) {
      continue;
    }
    
    // Make absolute URL
    if (url.startsWith('//')) {
      url = 'https:' + url;
    } else if (url.startsWith('/')) {
      const base = new URL(baseUrl);
      url = base.origin + url;
    } else if (!url.startsWith('http')) {
      continue;
    }
    
    // Generate filename from alt text or URL
    const ext = getExtension(url);
    const baseName = alt ? sanitize(alt) : sanitize(path.basename(new URL(url).pathname, ext));
    const filename = baseName + ext;
    
    // Categorize based on URL patterns
    let category = 'misc';
    if (url.includes('shopify') || url.includes('product')) {
      category = 'products';
    } else if (url.includes('gallery') || url.includes('artwork')) {
      category = 'artwork';
    } else if (url.includes('community') || url.includes('spotlight')) {
      category = 'community';
    }
    
    images.push({ url, alt, filename, category });
  }
  
  // Also check for background images in style attributes
  const bgRegex = /background(?:-image)?:\s*url\(['"]?([^'")\s]+)['"]?\)/gi;
  while ((match = bgRegex.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }
    if (url.startsWith('http')) {
      const ext = getExtension(url);
      const filename = sanitize(path.basename(new URL(url).pathname, ext)) + ext;
      images.push({ url, alt: '', filename, category: 'backgrounds' });
    }
  }
  
  return images;
}

/**
 * Fetch HTML from URL
 */
async function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          fetchHtml(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }
      
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Process a page - extract and download all images
 */
async function processPage(
  pageUrl: string, 
  outputDir: string,
  prefix: string = ''
): Promise<{ downloaded: number; skipped: number; failed: number }> {
  console.log(`\n📄 Processing: ${pageUrl}`);
  
  const html = await fetchHtml(pageUrl);
  const images = parseImagesFromHtml(html, pageUrl);
  
  console.log(`   Found ${images.length} images`);
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  
  // Dedupe by URL
  const seenUrls = new Set<string>();
  
  for (const img of images) {
    if (seenUrls.has(img.url)) {
      continue;
    }
    seenUrls.add(img.url);
    
    const filename = prefix ? `${prefix}-${img.filename}` : img.filename;
    const outputPath = path.join(outputDir, filename);
    
    // Skip if already exists
    if (fs.existsSync(outputPath)) {
      skipped++;
      continue;
    }
    
    const success = await downloadImage(img.url, outputPath);
    if (success) {
      downloaded++;
    } else {
      failed++;
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }
  
  return { downloaded, skipped, failed };
}

/**
 * Save image manifest
 */
function saveManifest(images: ExtractedImage[], pageUrl: string, outputDir: string): void {
  const manifestPath = path.join(outputDir, 'manifest.json');
  
  let manifest: Record<string, any> = {};
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }
  
  manifest[pageUrl] = {
    extractedAt: new Date().toISOString(),
    imageCount: images.length,
    images: images.map(i => ({
      url: i.url,
      alt: i.alt,
      filename: i.filename,
      category: i.category
    }))
  };
  
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

// Example usage with known newsletter URLs
const NEWSLETTER_URLS = {
  'kdu-99': 'https://kingdomdeath.com/news/mc-059aa211d2',
  'kdu-101': 'https://kingdomdeath.com/news/mc-83970b9b56',
  'kdu-102': 'https://kingdomdeath.com/news/mc-fa567e6a76',
  'kdu-103': 'https://kingdomdeath.com/news/mc-e8badbb129',
  'kdu-104': 'https://kingdomdeath.com/news/mc-b63c5e0bfe',
  'kdu-105': 'https://kingdomdeath.com/news/mc-c4395458a8',
  'kdu-106': 'https://kingdomdeath.com/news/mc-a9d27eedc7',
  'kdu-107': 'https://kingdomdeath.com/news/mc-0620fe74a1',
  'kdu-108': 'https://kingdomdeath.com/news/mc-38e1aabf18',
  'kdu-109': 'https://kingdomdeath.com/news/mc-f54efd621f',
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'url' && args[1]) {
    // Process single URL
    const url = args[1];
    const outputDir = args[2] || path.join(IMAGES_PATH, 'extracted');
    const prefix = args[3] || '';
    
    const result = await processPage(url, outputDir, prefix);
    console.log(`\n✅ Done: ${result.downloaded} downloaded, ${result.skipped} skipped, ${result.failed} failed`);
    
  } else if (command === 'newsletters') {
    // Process all newsletters
    const outputDir = path.join(IMAGES_PATH, 'newsletters');
    
    for (const [id, url] of Object.entries(NEWSLETTER_URLS)) {
      try {
        await processPage(url, outputDir, id);
        await new Promise(r => setTimeout(r, 1000)); // Rate limit between pages
      } catch (err) {
        console.error(`Error processing ${id}:`, err);
      }
    }
    
  } else {
    console.log(`
Usage:
  npx ts-node scripts/extract-images.ts url <page-url> [output-dir] [prefix]
  npx ts-node scripts/extract-images.ts newsletters
  
Examples:
  npx ts-node scripts/extract-images.ts url https://kingdomdeath.com/news/mc-059aa211d2 ./images/kdu-99
  npx ts-node scripts/extract-images.ts newsletters
`);
  }
}

main().catch(console.error);

