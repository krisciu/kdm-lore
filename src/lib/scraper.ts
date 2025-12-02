/**
 * KDM Lore Scraper Utility
 * Handles page scraping, text extraction, image downloading, and rate limiting
 */

import fs from 'fs';
import path from 'path';

const SOURCES_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources');

export interface ScrapedPage {
  url: string;
  title: string;
  content: string;
  html?: string;
  images: ScrapedImage[];
  metadata: PageMetadata;
}

export interface ScrapedImage {
  url: string;
  alt?: string;
  localPath?: string;
  ocrText?: string;
  ocrConfidence?: number;
}

export interface PageMetadata {
  url: string;
  scrapedAt: string;
  category: string;
  source: 'official-site' | 'kickstarter' | 'community' | 'rulebook';
  subCategory?: string;
  title?: string;
}

export interface ScrapeResult {
  success: boolean;
  page?: ScrapedPage;
  error?: string;
  filePath?: string;
}

/**
 * Rate limiter to avoid being blocked
 */
export async function rateLimitDelay(ms: number = 2000): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sanitize filename for safe filesystem storage
 */
export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

/**
 * Ensure directory exists
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Save scraped page to files
 */
export function saveScrapedPage(
  page: ScrapedPage,
  baseDir: string,
  saveHtml: boolean = false
): { textPath: string; metaPath: string; htmlPath?: string } {
  const filename = sanitizeFilename(page.title || 'untitled');
  const dirPath = path.join(SOURCES_PATH, baseDir);
  ensureDir(dirPath);

  // Save text content
  const textPath = path.join(dirPath, `${filename}.txt`);
  fs.writeFileSync(textPath, page.content, 'utf-8');

  // Save metadata
  const metaPath = path.join(dirPath, `${filename}.meta.json`);
  fs.writeFileSync(metaPath, JSON.stringify(page.metadata, null, 2), 'utf-8');

  // Optionally save HTML
  let htmlPath: string | undefined;
  if (saveHtml && page.html) {
    htmlPath = path.join(dirPath, `${filename}.html`);
    fs.writeFileSync(htmlPath, page.html, 'utf-8');
  }

  return { textPath, metaPath, htmlPath };
}

/**
 * Save image data to file
 */
export async function saveImage(
  imageUrl: string,
  baseDir: string,
  filename: string
): Promise<string | null> {
  try {
    const imagesDir = path.join(SOURCES_PATH, baseDir, 'images');
    ensureDir(imagesDir);

    const ext = path.extname(new URL(imageUrl).pathname) || '.png';
    const safeName = sanitizeFilename(filename);
    const localPath = path.join(imagesDir, `${safeName}${ext}`);

    // Note: Actual image download will happen via browser tools
    // This function prepares the path
    return localPath;
  } catch (error) {
    console.error('Error preparing image save:', error);
    return null;
  }
}

/**
 * Parse HTML to extract clean text content
 */
export function extractTextFromHtml(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags but keep line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<li>/gi, '• ');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Clean up whitespace
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  text = text.trim();
  
  return text;
}

/**
 * Extract image URLs from HTML
 */
export function extractImagesFromHtml(html: string, baseUrl: string): ScrapedImage[] {
  const images: ScrapedImage[] = [];
  const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  
  let match;
  while ((match = imgPattern.exec(html)) !== null) {
    let url = match[1];
    const alt = match[2] || '';
    
    // Convert relative URLs to absolute
    if (url.startsWith('/')) {
      try {
        const base = new URL(baseUrl);
        url = `${base.protocol}//${base.host}${url}`;
      } catch {
        // Keep as is
      }
    } else if (!url.startsWith('http')) {
      try {
        url = new URL(url, baseUrl).href;
      } catch {
        // Keep as is
      }
    }
    
    images.push({ url, alt });
  }
  
  return images;
}

/**
 * Load existing index of scraped content
 */
export function loadSourcesIndex(): Record<string, PageMetadata> {
  const indexPath = path.join(SOURCES_PATH, 'index.json');
  
  if (fs.existsSync(indexPath)) {
    try {
      return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    } catch {
      return {};
    }
  }
  
  return {};
}

/**
 * Save sources index
 */
export function saveSourcesIndex(index: Record<string, PageMetadata>): void {
  const indexPath = path.join(SOURCES_PATH, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Add entry to sources index
 */
export function addToSourcesIndex(key: string, metadata: PageMetadata): void {
  const index = loadSourcesIndex();
  index[key] = metadata;
  saveSourcesIndex(index);
}

/**
 * Check if URL has already been scraped
 */
export function isAlreadyScraped(url: string): boolean {
  const index = loadSourcesIndex();
  return Object.values(index).some(meta => meta.url === url);
}

/**
 * Get all scraped files in a category
 */
export function getScrapedFiles(category: string): string[] {
  const dirPath = path.join(SOURCES_PATH, category);
  
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  
  return fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.txt'))
    .map(f => path.join(dirPath, f));
}

/**
 * Create scrape summary report
 */
export function createScrapeReport(): {
  totalFiles: number;
  bySource: Record<string, number>;
  byCategory: Record<string, number>;
  recentScrapes: PageMetadata[];
} {
  const index = loadSourcesIndex();
  const entries = Object.values(index);
  
  const bySource: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  
  entries.forEach(meta => {
    bySource[meta.source] = (bySource[meta.source] || 0) + 1;
    byCategory[meta.category] = (byCategory[meta.category] || 0) + 1;
  });
  
  // Get recent scrapes (last 10)
  const recentScrapes = entries
    .sort((a, b) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime())
    .slice(0, 10);
  
  return {
    totalFiles: entries.length,
    bySource,
    byCategory,
    recentScrapes,
  };
}

/**
 * Format scraped content for lore entry
 */
export function formatForLoreEntry(page: ScrapedPage): string {
  let formatted = `# ${page.title}\n\n`;
  formatted += `> Source: ${page.url}\n`;
  formatted += `> Scraped: ${page.metadata.scrapedAt}\n\n`;
  formatted += `---\n\n`;
  formatted += page.content;
  
  if (page.images.length > 0) {
    formatted += `\n\n## Images\n\n`;
    page.images.forEach((img, i) => {
      formatted += `${i + 1}. ${img.alt || 'Image'}: ${img.url}\n`;
      if (img.ocrText) {
        formatted += `   OCR: ${img.ocrText.slice(0, 200)}...\n`;
      }
    });
  }
  
  return formatted;
}

