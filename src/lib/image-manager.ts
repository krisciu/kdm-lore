/**
 * Image Manager for Kingdom Death Lore Collection
 * 
 * Handles:
 * - Image downloading from URLs
 * - Image organization and storage
 * - Image metadata tracking
 * - Image indexing for quick lookup
 */

import fs from 'fs';
import path from 'path';
import { sanitizeFilename, ensureDir } from './scraper';

const IMAGES_BASE_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources');

// Image metadata structure
export interface ImageMetadata {
  id: string;
  originalUrl: string;
  localPath: string;
  filename: string;
  category: string;
  subcategory?: string;
  source: 'official-site' | 'kickstarter' | 'community' | 'rulebook';
  alt?: string;
  title?: string;
  description?: string;
  downloadedAt: string;
  fileSize?: number;
  dimensions?: { width: number; height: number };
  ocrProcessed: boolean;
  ocrResultPath?: string;
  tags: string[];
  relatedContent?: string[]; // Paths to related lore files
}

// Image index structure
export interface ImageIndex {
  version: string;
  lastUpdated: string;
  totalImages: number;
  images: Record<string, ImageMetadata>;
  byCategory: Record<string, string[]>;
  bySource: Record<string, string[]>;
  byTag: Record<string, string[]>;
}

/**
 * Load the image index
 */
export function loadImageIndex(): ImageIndex {
  const indexPath = path.join(IMAGES_BASE_PATH, 'images-index.json');
  
  if (fs.existsSync(indexPath)) {
    try {
      return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    } catch {
      console.error('Failed to load image index, creating new one');
    }
  }
  
  return createEmptyIndex();
}

/**
 * Create empty image index
 */
function createEmptyIndex(): ImageIndex {
  return {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    totalImages: 0,
    images: {},
    byCategory: {},
    bySource: {},
    byTag: {},
  };
}

/**
 * Save the image index
 */
export function saveImageIndex(index: ImageIndex): void {
  const indexPath = path.join(IMAGES_BASE_PATH, 'images-index.json');
  index.lastUpdated = new Date().toISOString();
  index.totalImages = Object.keys(index.images).length;
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Generate unique image ID
 */
export function generateImageId(url: string, category: string): string {
  const urlHash = Buffer.from(url).toString('base64').slice(0, 8);
  const timestamp = Date.now().toString(36);
  return `${sanitizeFilename(category)}-${urlHash}-${timestamp}`;
}

/**
 * Get storage path for an image
 */
export function getImageStoragePath(
  category: string,
  source: ImageMetadata['source'],
  subcategory?: string
): string {
  const parts = [IMAGES_BASE_PATH, source, 'images', category];
  if (subcategory) {
    parts.push(subcategory);
  }
  return path.join(...parts);
}

/**
 * Add image to index
 */
export function addImageToIndex(
  index: ImageIndex,
  metadata: ImageMetadata
): ImageIndex {
  // Add to main images record
  index.images[metadata.id] = metadata;
  
  // Add to category index
  if (!index.byCategory[metadata.category]) {
    index.byCategory[metadata.category] = [];
  }
  if (!index.byCategory[metadata.category].includes(metadata.id)) {
    index.byCategory[metadata.category].push(metadata.id);
  }
  
  // Add to source index
  if (!index.bySource[metadata.source]) {
    index.bySource[metadata.source] = [];
  }
  if (!index.bySource[metadata.source].includes(metadata.id)) {
    index.bySource[metadata.source].push(metadata.id);
  }
  
  // Add to tag indices
  metadata.tags.forEach(tag => {
    if (!index.byTag[tag]) {
      index.byTag[tag] = [];
    }
    if (!index.byTag[tag].includes(metadata.id)) {
      index.byTag[tag].push(metadata.id);
    }
  });
  
  return index;
}

/**
 * Create image metadata entry
 */
export function createImageMetadata(
  url: string,
  localPath: string,
  options: {
    category: string;
    source: ImageMetadata['source'];
    subcategory?: string;
    alt?: string;
    title?: string;
    tags?: string[];
    relatedContent?: string[];
  }
): ImageMetadata {
  const id = generateImageId(url, options.category);
  const filename = path.basename(localPath);
  
  return {
    id,
    originalUrl: url,
    localPath,
    filename,
    category: options.category,
    subcategory: options.subcategory,
    source: options.source,
    alt: options.alt,
    title: options.title,
    downloadedAt: new Date().toISOString(),
    ocrProcessed: false,
    tags: options.tags || [],
    relatedContent: options.relatedContent,
  };
}

/**
 * Prepare image download path
 * Returns the local path where the image should be saved
 */
export function prepareImagePath(
  url: string,
  category: string,
  source: ImageMetadata['source'],
  customFilename?: string,
  subcategory?: string
): string {
  const storageDir = getImageStoragePath(category, source, subcategory);
  ensureDir(storageDir);
  
  // Determine filename
  let filename: string;
  if (customFilename) {
    filename = sanitizeFilename(customFilename);
  } else {
    try {
      const urlObj = new URL(url);
      const urlFilename = path.basename(urlObj.pathname);
      filename = sanitizeFilename(urlFilename.replace(/\.[^/.]+$/, ''));
    } catch {
      filename = `image-${Date.now()}`;
    }
  }
  
  // Get extension from URL
  let ext = '.png';
  try {
    const urlObj = new URL(url);
    const urlExt = path.extname(urlObj.pathname);
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(urlExt.toLowerCase())) {
      ext = urlExt.toLowerCase();
    }
  } catch {
    // Keep default extension
  }
  
  // Ensure unique filename
  let finalPath = path.join(storageDir, `${filename}${ext}`);
  let counter = 1;
  while (fs.existsSync(finalPath)) {
    finalPath = path.join(storageDir, `${filename}-${counter}${ext}`);
    counter++;
  }
  
  return finalPath;
}

/**
 * Register a downloaded image
 */
export function registerImage(
  url: string,
  localPath: string,
  options: {
    category: string;
    source: ImageMetadata['source'];
    subcategory?: string;
    alt?: string;
    title?: string;
    tags?: string[];
  }
): ImageMetadata {
  const index = loadImageIndex();
  
  // Check if already registered
  const existing = Object.values(index.images).find(
    img => img.originalUrl === url
  );
  if (existing) {
    console.log(`Image already registered: ${existing.id}`);
    return existing;
  }
  
  // Create metadata
  const metadata = createImageMetadata(url, localPath, options);
  
  // Get file size if file exists
  if (fs.existsSync(localPath)) {
    const stats = fs.statSync(localPath);
    metadata.fileSize = stats.size;
  }
  
  // Add to index and save
  addImageToIndex(index, metadata);
  saveImageIndex(index);
  
  console.log(`Registered image: ${metadata.id}`);
  return metadata;
}

/**
 * Mark image as OCR processed
 */
export function markOCRProcessed(
  imageId: string,
  ocrResultPath: string
): void {
  const index = loadImageIndex();
  
  if (index.images[imageId]) {
    index.images[imageId].ocrProcessed = true;
    index.images[imageId].ocrResultPath = ocrResultPath;
    saveImageIndex(index);
  }
}

/**
 * Get images needing OCR processing
 */
export function getUnprocessedImages(): ImageMetadata[] {
  const index = loadImageIndex();
  return Object.values(index.images).filter(img => !img.ocrProcessed);
}

/**
 * Get images by category
 */
export function getImagesByCategory(category: string): ImageMetadata[] {
  const index = loadImageIndex();
  const ids = index.byCategory[category] || [];
  return ids.map(id => index.images[id]).filter(Boolean);
}

/**
 * Get images by tag
 */
export function getImagesByTag(tag: string): ImageMetadata[] {
  const index = loadImageIndex();
  const ids = index.byTag[tag] || [];
  return ids.map(id => index.images[id]).filter(Boolean);
}

/**
 * Search images by criteria
 */
export function searchImages(criteria: {
  category?: string;
  source?: ImageMetadata['source'];
  tags?: string[];
  ocrProcessed?: boolean;
  textSearch?: string;
}): ImageMetadata[] {
  const index = loadImageIndex();
  let results = Object.values(index.images);
  
  if (criteria.category) {
    results = results.filter(img => img.category === criteria.category);
  }
  
  if (criteria.source) {
    results = results.filter(img => img.source === criteria.source);
  }
  
  if (criteria.tags && criteria.tags.length > 0) {
    results = results.filter(img => 
      criteria.tags!.some(tag => img.tags.includes(tag))
    );
  }
  
  if (criteria.ocrProcessed !== undefined) {
    results = results.filter(img => img.ocrProcessed === criteria.ocrProcessed);
  }
  
  if (criteria.textSearch) {
    const search = criteria.textSearch.toLowerCase();
    results = results.filter(img => 
      img.title?.toLowerCase().includes(search) ||
      img.alt?.toLowerCase().includes(search) ||
      img.description?.toLowerCase().includes(search) ||
      img.filename.toLowerCase().includes(search)
    );
  }
  
  return results;
}

/**
 * Get image statistics
 */
export function getImageStats(): {
  total: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  ocrProcessed: number;
  ocrPending: number;
} {
  const index = loadImageIndex();
  const images = Object.values(index.images);
  
  const byCategory: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let ocrProcessed = 0;
  
  images.forEach(img => {
    byCategory[img.category] = (byCategory[img.category] || 0) + 1;
    bySource[img.source] = (bySource[img.source] || 0) + 1;
    if (img.ocrProcessed) ocrProcessed++;
  });
  
  return {
    total: images.length,
    byCategory,
    bySource,
    ocrProcessed,
    ocrPending: images.length - ocrProcessed,
  };
}

/**
 * Export image manifest for a category
 */
export function exportCategoryManifest(category: string): string {
  const images = getImagesByCategory(category);
  
  let manifest = `# Image Manifest: ${category}\n`;
  manifest += `Generated: ${new Date().toISOString()}\n`;
  manifest += `Total Images: ${images.length}\n\n`;
  manifest += `---\n\n`;
  
  images.forEach((img, idx) => {
    manifest += `## ${idx + 1}. ${img.title || img.filename}\n`;
    manifest += `- **ID:** ${img.id}\n`;
    manifest += `- **Source URL:** ${img.originalUrl}\n`;
    manifest += `- **Local Path:** ${img.localPath}\n`;
    manifest += `- **Downloaded:** ${img.downloadedAt}\n`;
    manifest += `- **OCR Processed:** ${img.ocrProcessed ? 'Yes' : 'No'}\n`;
    if (img.tags.length > 0) {
      manifest += `- **Tags:** ${img.tags.join(', ')}\n`;
    }
    manifest += '\n';
  });
  
  return manifest;
}

/**
 * Standard image categories for KDM content
 */
export const IMAGE_CATEGORIES = {
  NEWSLETTER_BANNERS: 'newsletter-banners',
  NEWSLETTER_CONTENT: 'newsletter-content',
  SHOP_PRODUCTS: 'shop-products',
  RULEBOOK_PAGES: 'rulebook-pages',
  CARD_SCANS: 'card-scans',
  STORY_EVENTS: 'story-events',
  ARTWORK: 'artwork',
  MINIATURES: 'miniatures',
  COMMUNITY_PAINT: 'community-paint',
} as const;

/**
 * Standard tags for image categorization
 */
export const IMAGE_TAGS = {
  // Content type
  LORE_TEXT: 'lore-text',
  FLAVOR_TEXT: 'flavor-text',
  RULES_TEXT: 'rules-text',
  
  // Monster tags
  WHITE_LION: 'white-lion',
  SCREAMING_ANTELOPE: 'screaming-antelope',
  PHOENIX: 'phoenix',
  BUTCHER: 'butcher',
  KINGS_MAN: 'kings-man',
  HAND: 'the-hand',
  WATCHER: 'watcher',
  GOLD_SMOKE_KNIGHT: 'gold-smoke-knight',
  
  // Expansion tags
  GAMBLERS_CHEST: 'gamblers-chest',
  DRAGON_KING: 'dragon-king',
  SUNSTALKER: 'sunstalker',
  GORM: 'gorm',
  FLOWER_KNIGHT: 'flower-knight',
  
  // Character tags
  TWILIGHT_KNIGHT: 'twilight-knight',
  WHITE_SPEAKER: 'white-speaker',
  SURVIVOR: 'survivor',
  
  // Quality tags
  HIGH_RES: 'high-res',
  NEEDS_ENHANCEMENT: 'needs-enhancement',
  OCR_READY: 'ocr-ready',
} as const;

