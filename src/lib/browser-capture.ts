/**
 * Browser-based Image Capture Utility
 * 
 * Provides functions for capturing images from web pages during scraping.
 * Works with Playwright/browser automation tools.
 */

import fs from 'fs';
import path from 'path';
import {
  prepareImagePath,
  registerImage,
  IMAGE_CATEGORIES,
  ImageMetadata,
} from './image-manager';

/**
 * Image capture configuration
 */
export interface CaptureConfig {
  /** Base directory for saving images */
  outputDir: string;
  /** Category for organizing images */
  category: keyof typeof IMAGE_CATEGORIES | string;
  /** Source type */
  source: ImageMetadata['source'];
  /** Optional subcategory */
  subcategory?: string;
  /** Tags to apply to captured images */
  tags?: string[];
  /** Whether to skip existing images */
  skipExisting?: boolean;
}

/**
 * Image capture result
 */
export interface CaptureResult {
  success: boolean;
  url: string;
  localPath?: string;
  metadata?: ImageMetadata;
  error?: string;
}

/**
 * Extract image URLs from page content
 */
export function extractImageUrls(pageContent: string, baseUrl: string): string[] {
  const urls: string[] = [];
  
  // Match img src attributes
  const imgSrcPattern = /src=["']([^"']+)["']/gi;
  let match;
  while ((match = imgSrcPattern.exec(pageContent)) !== null) {
    const url = resolveUrl(match[1], baseUrl);
    if (isImageUrl(url) && !urls.includes(url)) {
      urls.push(url);
    }
  }
  
  // Match srcset attributes
  const srcsetPattern = /srcset=["']([^"']+)["']/gi;
  while ((match = srcsetPattern.exec(pageContent)) !== null) {
    const srcset = match[1];
    const srcUrls = srcset.split(',').map(s => {
      const parts = s.trim().split(/\s+/);
      return parts[0];
    });
    srcUrls.forEach(url => {
      const resolved = resolveUrl(url, baseUrl);
      if (isImageUrl(resolved) && !urls.includes(resolved)) {
        urls.push(resolved);
      }
    });
  }
  
  // Match background-image CSS
  const bgPattern = /background-image:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((match = bgPattern.exec(pageContent)) !== null) {
    const url = resolveUrl(match[1], baseUrl);
    if (isImageUrl(url) && !urls.includes(url)) {
      urls.push(url);
    }
  }
  
  return urls;
}

/**
 * Check if URL is an image
 */
export function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  try {
    const urlObj = new URL(url);
    const ext = path.extname(urlObj.pathname).toLowerCase();
    return imageExtensions.includes(ext) || 
           url.includes('image') || 
           url.includes('img');
  } catch {
    return false;
  }
}

/**
 * Resolve relative URL to absolute
 */
export function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

/**
 * Filter image URLs to only include relevant ones
 */
export function filterRelevantImages(urls: string[], options: {
  minSize?: number;
  excludePatterns?: RegExp[];
  includePatterns?: RegExp[];
}): string[] {
  const excludePatterns = options.excludePatterns || [
    /logo/i,
    /icon/i,
    /favicon/i,
    /avatar/i,
    /button/i,
    /social/i,
    /tracking/i,
    /pixel/i,
    /1x1/i,
    /spacer/i,
  ];
  
  return urls.filter(url => {
    // Check exclude patterns
    if (excludePatterns.some(pattern => pattern.test(url))) {
      return false;
    }
    
    // Check include patterns if specified
    if (options.includePatterns && options.includePatterns.length > 0) {
      return options.includePatterns.some(pattern => pattern.test(url));
    }
    
    return true;
  });
}

/**
 * Generate filename from URL
 */
export function generateFilename(url: string, prefix?: string): string {
  try {
    const urlObj = new URL(url);
    let filename = path.basename(urlObj.pathname);
    
    // Remove query params from filename
    filename = filename.split('?')[0];
    
    // Sanitize
    filename = filename
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80);
    
    if (prefix) {
      filename = `${prefix}-${filename}`;
    }
    
    return filename;
  } catch {
    return `image-${Date.now()}`;
  }
}

/**
 * Create image capture manifest for a page
 */
export function createCaptureManifest(
  pageUrl: string,
  pageTitle: string,
  imageUrls: string[],
  config: CaptureConfig
): CaptureManifest {
  return {
    pageUrl,
    pageTitle,
    createdAt: new Date().toISOString(),
    config,
    images: imageUrls.map(url => ({
      url,
      filename: generateFilename(url, config.subcategory),
      status: 'pending' as const,
    })),
  };
}

export interface CaptureManifest {
  pageUrl: string;
  pageTitle: string;
  createdAt: string;
  config: CaptureConfig;
  images: Array<{
    url: string;
    filename: string;
    localPath?: string;
    status: 'pending' | 'downloaded' | 'failed';
    error?: string;
  }>;
}

/**
 * Save capture manifest to file
 */
export function saveCaptureManifest(manifest: CaptureManifest, outputDir: string): string {
  const filename = `capture-manifest-${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(filepath, JSON.stringify(manifest, null, 2), 'utf-8');
  return filepath;
}

/**
 * Instructions for browser-based image capture
 * 
 * Since actual image downloading requires network access and browser automation,
 * this provides guidance for the scraping agent.
 */
export const CAPTURE_INSTRUCTIONS = `
## Browser Image Capture Process

When scraping a page with relevant images:

1. **Identify images** using the browser snapshot
   - Look for img elements with src attributes
   - Note banner images, content images, product photos

2. **Take screenshots** for OCR processing
   - Use mcp_cursor-ide-browser_browser_take_screenshot for full page
   - Use element-specific screenshots for important images

3. **Record image URLs** in the scraped content
   - Add an "## Images" section to scraped files
   - List all relevant image URLs

4. **Download images** using the screenshot tool
   - Save to: docs/lore/sources/official-site/images/[category]/
   - Name format: [source]-[content]-[identifier].[ext]

5. **Register images** after download
   - Update images-index.json
   - Or run: npx ts-node scripts/process-images.ts scan

### Priority Images to Capture

- Newsletter banners (KDU #1-109)
- Product page hero images
- Rulebook page scans
- Card images with flavor text

### Screenshot Commands

\`\`\`
// Full page screenshot
mcp_cursor-ide-browser_browser_take_screenshot({ fullPage: true, filename: "page-name.png" })

// Element screenshot
mcp_cursor-ide-browser_browser_take_screenshot({ ref: "element-ref", filename: "element-name.png" })
\`\`\`
`;

/**
 * Get capture config for different page types
 */
export function getCaptureConfigForPageType(
  pageUrl: string,
  pageType: 'newsletter' | 'shop' | 'news' | 'rules' | 'other'
): CaptureConfig {
  const configs: Record<string, CaptureConfig> = {
    newsletter: {
      outputDir: 'docs/lore/sources/official-site/images',
      category: IMAGE_CATEGORIES.NEWSLETTER_BANNERS,
      source: 'official-site',
      tags: ['newsletter', 'banner'],
      skipExisting: true,
    },
    shop: {
      outputDir: 'docs/lore/sources/official-site/images',
      category: IMAGE_CATEGORIES.SHOP_PRODUCTS,
      source: 'official-site',
      tags: ['product', 'expansion'],
      skipExisting: true,
    },
    news: {
      outputDir: 'docs/lore/sources/official-site/images',
      category: IMAGE_CATEGORIES.NEWSLETTER_CONTENT,
      source: 'official-site',
      tags: ['news', 'announcement'],
      skipExisting: true,
    },
    rules: {
      outputDir: 'docs/lore/sources/official-site/images',
      category: IMAGE_CATEGORIES.RULEBOOK_PAGES,
      source: 'rulebook',
      tags: ['rules', 'rulebook'],
      skipExisting: true,
    },
    other: {
      outputDir: 'docs/lore/sources/official-site/images',
      category: 'uncategorized',
      source: 'official-site',
      tags: [],
      skipExisting: true,
    },
  };
  
  return configs[pageType] || configs.other;
}

