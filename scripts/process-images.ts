#!/usr/bin/env npx ts-node
/**
 * Image Processing Script for Kingdom Death Lore
 * 
 * Usage:
 *   npx ts-node scripts/process-images.ts [command] [options]
 * 
 * Commands:
 *   scan     - Scan directories for images and register them
 *   ocr      - Process images with OCR
 *   status   - Show image collection status
 *   export   - Export manifests and reports
 */

import fs from 'fs';
import path from 'path';
import {
  loadImageIndex,
  saveImageIndex,
  registerImage,
  getUnprocessedImages,
  getImageStats,
  exportCategoryManifest,
  IMAGE_CATEGORIES,
  IMAGE_TAGS,
  ImageMetadata,
} from '../src/lib/image-manager';
import {
  processImage,
  processBatch,
  saveOCRResult,
  detectImageType,
  getOptionsForImageType,
  cleanOCRText,
  extractLoreText,
  OCRResult,
} from '../src/lib/ocr';

const SOURCES_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources');

// Colors for console output
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

/**
 * Scan directories for images
 */
async function scanForImages(targetDir?: string): Promise<void> {
  log('blue', '\n📸 Scanning for images...\n');
  
  const searchDir = targetDir || path.join(SOURCES_PATH, 'official-site', 'images');
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  
  function findImages(dir: string): string[] {
    const results: string[] = [];
    
    if (!fs.existsSync(dir)) {
      log('yellow', `Directory not found: ${dir}`);
      return results;
    }
    
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        results.push(...findImages(fullPath));
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (imageExtensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
    
    return results;
  }
  
  const images = findImages(searchDir);
  log('cyan', `Found ${images.length} images\n`);
  
  // Register each image
  let registered = 0;
  let skipped = 0;
  
  for (const imagePath of images) {
    // Determine category from path
    const relativePath = path.relative(SOURCES_PATH, imagePath);
    const parts = relativePath.split(path.sep);
    
    const source = parts[0] as ImageMetadata['source'] || 'official-site';
    const category = parts[2] || 'uncategorized';
    const subcategory = parts[3];
    
    // Check if already registered
    const index = loadImageIndex();
    const alreadyExists = Object.values(index.images).some(
      img => img.localPath === imagePath
    );
    
    if (alreadyExists) {
      skipped++;
      continue;
    }
    
    // Register the image
    try {
      registerImage(
        `file://${imagePath}`,
        imagePath,
        {
          category,
          source,
          subcategory,
          tags: detectTagsFromPath(imagePath),
        }
      );
      registered++;
      log('green', `  ✓ Registered: ${path.basename(imagePath)}`);
    } catch (error) {
      log('red', `  ✗ Failed: ${path.basename(imagePath)} - ${error}`);
    }
  }
  
  log('blue', `\n📊 Summary:`);
  log('green', `  Registered: ${registered}`);
  log('dim', `  Skipped (already registered): ${skipped}`);
}

/**
 * Detect tags from file path
 */
function detectTagsFromPath(imagePath: string): string[] {
  const tags: string[] = [];
  const pathLower = imagePath.toLowerCase();
  
  // Check for monster tags
  if (pathLower.includes('white-lion') || pathLower.includes('whitelion')) {
    tags.push(IMAGE_TAGS.WHITE_LION);
  }
  if (pathLower.includes('phoenix')) {
    tags.push(IMAGE_TAGS.PHOENIX);
  }
  if (pathLower.includes('butcher')) {
    tags.push(IMAGE_TAGS.BUTCHER);
  }
  if (pathLower.includes('antelope')) {
    tags.push(IMAGE_TAGS.SCREAMING_ANTELOPE);
  }
  
  // Check for expansion tags
  if (pathLower.includes('gambler') || pathLower.includes('gce')) {
    tags.push(IMAGE_TAGS.GAMBLERS_CHEST);
  }
  if (pathLower.includes('dragon-king') || pathLower.includes('dragonking')) {
    tags.push(IMAGE_TAGS.DRAGON_KING);
  }
  if (pathLower.includes('sunstalker')) {
    tags.push(IMAGE_TAGS.SUNSTALKER);
  }
  
  // Check for character tags
  if (pathLower.includes('twilight-knight') || pathLower.includes('twilightknight')) {
    tags.push(IMAGE_TAGS.TWILIGHT_KNIGHT);
  }
  if (pathLower.includes('white-speaker') || pathLower.includes('whitespeaker')) {
    tags.push(IMAGE_TAGS.WHITE_SPEAKER);
  }
  
  // Check for content type
  if (pathLower.includes('newsletter') || pathLower.includes('kdu')) {
    tags.push('newsletter');
  }
  if (pathLower.includes('rulebook') || pathLower.includes('rules')) {
    tags.push('rulebook');
  }
  if (pathLower.includes('card')) {
    tags.push('card');
  }
  
  return tags;
}

/**
 * Process images with OCR
 */
async function processOCR(limit?: number): Promise<void> {
  log('blue', '\n🔍 Processing images with OCR...\n');
  
  const unprocessed = getUnprocessedImages();
  const toProcess = limit ? unprocessed.slice(0, limit) : unprocessed;
  
  if (toProcess.length === 0) {
    log('green', 'All images have been processed!');
    return;
  }
  
  log('cyan', `Processing ${toProcess.length} images...\n`);
  
  let processed = 0;
  let failed = 0;
  
  for (const image of toProcess) {
    log('dim', `Processing: ${image.filename}...`);
    
    try {
      // Detect image type and get optimal options
      const imageType = detectImageType(image.localPath);
      const options = getOptionsForImageType(imageType);
      
      // Process with OCR
      const result = await processImage(image.localPath, options);
      
      // Save OCR result
      const outputDir = path.join(
        path.dirname(image.localPath),
        'ocr-results'
      );
      const ocrPath = saveOCRResult(result, outputDir);
      
      // Update image metadata
      const index = loadImageIndex();
      if (index.images[image.id]) {
        index.images[image.id].ocrProcessed = true;
        index.images[image.id].ocrResultPath = ocrPath;
        saveImageIndex(index);
      }
      
      processed++;
      log('green', `  ✓ Completed (${result.confidence.toFixed(1)}% confidence)`);
      
    } catch (error) {
      failed++;
      log('red', `  ✗ Failed: ${error}`);
    }
  }
  
  log('blue', `\n📊 OCR Summary:`);
  log('green', `  Processed: ${processed}`);
  if (failed > 0) {
    log('red', `  Failed: ${failed}`);
  }
}

/**
 * Show image collection status
 */
function showStatus(): void {
  log('blue', '\n📊 Image Collection Status\n');
  
  const stats = getImageStats();
  
  log('cyan', `Total Images: ${stats.total}`);
  log('green', `OCR Processed: ${stats.ocrProcessed}`);
  log('yellow', `OCR Pending: ${stats.ocrPending}`);
  
  if (Object.keys(stats.byCategory).length > 0) {
    log('blue', '\nBy Category:');
    Object.entries(stats.byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        log('dim', `  ${cat}: ${count}`);
      });
  }
  
  if (Object.keys(stats.bySource).length > 0) {
    log('blue', '\nBy Source:');
    Object.entries(stats.bySource)
      .sort((a, b) => b[1] - a[1])
      .forEach(([src, count]) => {
        log('dim', `  ${src}: ${count}`);
      });
  }
}

/**
 * Export manifests and reports
 */
function exportReports(): void {
  log('blue', '\n📄 Exporting Reports...\n');
  
  const index = loadImageIndex();
  const categories = Object.keys(index.byCategory);
  
  const reportsDir = path.join(SOURCES_PATH, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // Export category manifests
  categories.forEach(category => {
    const manifest = exportCategoryManifest(category);
    const manifestPath = path.join(reportsDir, `manifest-${category}.md`);
    fs.writeFileSync(manifestPath, manifest, 'utf-8');
    log('green', `  ✓ Exported: ${path.basename(manifestPath)}`);
  });
  
  // Export summary report
  const stats = getImageStats();
  const summary = `# Image Collection Summary

Generated: ${new Date().toISOString()}

## Overview

- **Total Images:** ${stats.total}
- **OCR Processed:** ${stats.ocrProcessed}
- **OCR Pending:** ${stats.ocrPending}

## By Category

${Object.entries(stats.byCategory)
  .sort((a, b) => b[1] - a[1])
  .map(([cat, count]) => `- ${cat}: ${count}`)
  .join('\n')}

## By Source

${Object.entries(stats.bySource)
  .sort((a, b) => b[1] - a[1])
  .map(([src, count]) => `- ${src}: ${count}`)
  .join('\n')}

## Available Categories

${Object.entries(IMAGE_CATEGORIES).map(([key, value]) => `- \`${value}\` - ${key}`).join('\n')}

## Available Tags

${Object.entries(IMAGE_TAGS).map(([key, value]) => `- \`${value}\` - ${key}`).join('\n')}
`;

  const summaryPath = path.join(reportsDir, 'image-summary.md');
  fs.writeFileSync(summaryPath, summary, 'utf-8');
  log('green', `  ✓ Exported: ${path.basename(summaryPath)}`);
  
  log('blue', `\nReports saved to: ${reportsDir}`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';
  
  log('cyan', '═══════════════════════════════════════════');
  log('cyan', '  KDM Lore Image Processor');
  log('cyan', '═══════════════════════════════════════════');
  
  switch (command) {
    case 'scan':
      const scanDir = args[1];
      await scanForImages(scanDir);
      break;
      
    case 'ocr':
      const limit = args[1] ? parseInt(args[1], 10) : undefined;
      await processOCR(limit);
      break;
      
    case 'status':
      showStatus();
      break;
      
    case 'export':
      exportReports();
      break;
      
    case 'help':
    default:
      console.log(`
Usage: npx ts-node scripts/process-images.ts [command] [options]

Commands:
  scan [dir]     Scan directories for images and register them
  ocr [limit]    Process images with OCR (optional limit)
  status         Show image collection status
  export         Export manifests and reports
  help           Show this help message

Examples:
  npx ts-node scripts/process-images.ts scan
  npx ts-node scripts/process-images.ts scan ./docs/lore/sources/official-site
  npx ts-node scripts/process-images.ts ocr 10
  npx ts-node scripts/process-images.ts status
  npx ts-node scripts/process-images.ts export
`);
  }
}

// Run if called directly
main().catch(console.error);

