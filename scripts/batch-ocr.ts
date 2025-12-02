#!/usr/bin/env npx ts-node
/**
 * Batch OCR for Rulebook Images
 * 
 * Processes extracted rulebook page images and extracts text using Tesseract.
 * Outputs text files alongside images or to a separate text directory.
 * 
 * Usage:
 *   npx ts-node scripts/batch-ocr.ts status          - Show OCR progress
 *   npx ts-node scripts/batch-ocr.ts core            - OCR core rulebook pages
 *   npx ts-node scripts/batch-ocr.ts gamblers        - OCR Gambler's Chest pages
 *   npx ts-node scripts/batch-ocr.ts expansions      - OCR expansion pages
 *   npx ts-node scripts/batch-ocr.ts all             - OCR everything
 *   npx ts-node scripts/batch-ocr.ts file <path>     - OCR single file
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const EXTRACTED_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources', 'rulebooks', 'extracted');
const IMAGES_PATH = path.join(EXTRACTED_PATH, 'images');
const TEXT_PATH = path.join(EXTRACTED_PATH, 'text');

interface OcrResult {
  imagePath: string;
  textPath: string;
  success: boolean;
  lineCount?: number;
  error?: string;
}

interface OcrProgress {
  total: number;
  completed: number;
  pending: string[];
  errors: string[];
}

/**
 * Check if Tesseract is installed
 */
function checkTesseract(): boolean {
  try {
    execSync('tesseract --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run Tesseract OCR on an image
 */
function runOcr(imagePath: string, outputPath: string): OcrResult {
  const textPath = outputPath.replace(/\.(png|jpg|jpeg)$/i, '.txt');
  
  try {
    // Create output directory if needed
    const dir = path.dirname(textPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Run Tesseract with best quality settings for rulebook text
    execSync(`tesseract "${imagePath}" "${textPath.replace('.txt', '')}" -l eng --psm 6 --oem 3`, {
      stdio: 'pipe',
      timeout: 60000 // 60 second timeout per image
    });
    
    // Check result
    if (fs.existsSync(textPath)) {
      const content = fs.readFileSync(textPath, 'utf-8');
      const lineCount = content.split('\n').filter(l => l.trim()).length;
      
      return {
        imagePath,
        textPath,
        success: true,
        lineCount
      };
    } else {
      return {
        imagePath,
        textPath,
        success: false,
        error: 'No output file created'
      };
    }
  } catch (err: any) {
    return {
      imagePath,
      textPath,
      success: false,
      error: err.message || 'Unknown error'
    };
  }
}

/**
 * Get all image files in a directory
 */
function getImageFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  
  const files: string[] = [];
  
  function scanDir(currentDir: string): void {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item.name);
      
      if (item.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(png|jpg|jpeg)$/i.test(item.name)) {
        files.push(fullPath);
      }
    }
  }
  
  scanDir(dir);
  return files.sort();
}

/**
 * Check OCR progress for a directory
 */
function checkProgress(imageDir: string, textDir: string): OcrProgress {
  const images = getImageFiles(imageDir);
  const completed: string[] = [];
  const pending: string[] = [];
  const errors: string[] = [];
  
  for (const imagePath of images) {
    const relativePath = path.relative(imageDir, imagePath);
    const textPath = path.join(textDir, relativePath.replace(/\.(png|jpg|jpeg)$/i, '.txt'));
    
    if (fs.existsSync(textPath)) {
      const content = fs.readFileSync(textPath, 'utf-8').trim();
      if (content.length > 10) {
        completed.push(imagePath);
      } else {
        errors.push(imagePath);
      }
    } else {
      pending.push(imagePath);
    }
  }
  
  return {
    total: images.length,
    completed: completed.length,
    pending,
    errors
  };
}

/**
 * Process a batch of images
 */
async function processBatch(
  imageDir: string, 
  textDir: string,
  options: { limit?: number; filter?: RegExp } = {}
): Promise<{ success: number; failed: number }> {
  const progress = checkProgress(imageDir, textDir);
  let toProcess = progress.pending;
  
  if (options.filter) {
    toProcess = toProcess.filter(p => options.filter!.test(p));
  }
  
  if (options.limit) {
    toProcess = toProcess.slice(0, options.limit);
  }
  
  console.log(`\n📄 Processing ${toProcess.length} images...`);
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < toProcess.length; i++) {
    const imagePath = toProcess[i];
    const relativePath = path.relative(imageDir, imagePath);
    const outputPath = path.join(textDir, relativePath);
    
    process.stdout.write(`\r  [${i + 1}/${toProcess.length}] ${path.basename(imagePath)}...`);
    
    const result = runOcr(imagePath, outputPath);
    
    if (result.success) {
      success++;
      process.stdout.write(` ✓ (${result.lineCount} lines)\n`);
    } else {
      failed++;
      process.stdout.write(` ✗ ${result.error}\n`);
    }
  }
  
  return { success, failed };
}

/**
 * Show overall status
 */
function showStatus(): void {
  console.log('\n═══════════════════════════════════════════');
  console.log('  OCR Status - Rulebook Extraction');
  console.log('═══════════════════════════════════════════\n');
  
  const categories = [
    { name: 'Core Rulebook', imageDir: path.join(IMAGES_PATH, 'rulebook-pages'), textDir: path.join(TEXT_PATH, 'rulebook-pages') },
    { name: "Gambler's Chest", imageDir: path.join(IMAGES_PATH, 'gamblers-chest'), textDir: path.join(TEXT_PATH, 'gamblers-chest') },
    { name: 'Expansions of Death', imageDir: path.join(IMAGES_PATH, 'expansions-of-death'), textDir: path.join(TEXT_PATH, 'expansions-of-death') },
    { name: 'Miscellaneous', imageDir: path.join(IMAGES_PATH, 'miscellaneous'), textDir: path.join(TEXT_PATH, 'miscellaneous') },
    { name: 'Game Content', imageDir: path.join(IMAGES_PATH, 'game-content'), textDir: path.join(TEXT_PATH, 'game-content') },
  ];
  
  let totalImages = 0;
  let totalCompleted = 0;
  
  for (const cat of categories) {
    const progress = checkProgress(cat.imageDir, cat.textDir);
    totalImages += progress.total;
    totalCompleted += progress.completed;
    
    const pct = progress.total > 0 ? ((progress.completed / progress.total) * 100).toFixed(1) : '0.0';
    const bar = '█'.repeat(Math.floor(progress.completed / progress.total * 20)) + 
                '░'.repeat(20 - Math.floor(progress.completed / progress.total * 20));
    
    console.log(`${cat.name}:`);
    console.log(`  [${bar}] ${pct}%`);
    console.log(`  ${progress.completed}/${progress.total} pages, ${progress.pending.length} pending, ${progress.errors.length} errors\n`);
  }
  
  console.log('───────────────────────────────────────────');
  console.log(`Total: ${totalCompleted}/${totalImages} images processed (${((totalCompleted/totalImages)*100).toFixed(1)}%)`);
}

/**
 * Main
 */
async function main(): Promise<void> {
  // Check Tesseract
  if (!checkTesseract()) {
    console.error('Error: Tesseract is not installed.');
    console.error('Install it with: brew install tesseract');
    process.exit(1);
  }
  
  const args = process.argv.slice(2);
  const command = args[0] || 'status';
  
  switch (command) {
    case 'status':
      showStatus();
      break;
      
    case 'core':
      await processBatch(
        path.join(IMAGES_PATH, 'rulebook-pages'),
        path.join(TEXT_PATH, 'rulebook-pages')
      );
      break;
      
    case 'gamblers':
      await processBatch(
        path.join(IMAGES_PATH, 'gamblers-chest'),
        path.join(TEXT_PATH, 'gamblers-chest')
      );
      break;
      
    case 'expansions':
      await processBatch(
        path.join(IMAGES_PATH, 'expansions-of-death'),
        path.join(TEXT_PATH, 'expansions-of-death')
      );
      break;
      
    case 'misc':
      await processBatch(
        path.join(IMAGES_PATH, 'miscellaneous'),
        path.join(TEXT_PATH, 'miscellaneous')
      );
      break;
      
    case 'all':
      console.log('Processing all categories...\n');
      
      const dirs = [
        { name: 'Core Rulebook', img: 'rulebook-pages' },
        { name: "Gambler's Chest", img: 'gamblers-chest' },
        { name: 'Expansions', img: 'expansions-of-death' },
        { name: 'Miscellaneous', img: 'miscellaneous' },
      ];
      
      for (const d of dirs) {
        console.log(`\n=== ${d.name} ===`);
        await processBatch(
          path.join(IMAGES_PATH, d.img),
          path.join(TEXT_PATH, d.img)
        );
      }
      break;
      
    case 'file':
      if (!args[1]) {
        console.error('Usage: batch-ocr.ts file <image-path>');
        process.exit(1);
      }
      const result = runOcr(args[1], args[1]);
      if (result.success) {
        console.log(`✓ OCR complete: ${result.textPath} (${result.lineCount} lines)`);
        console.log(fs.readFileSync(result.textPath, 'utf-8'));
      } else {
        console.error(`✗ OCR failed: ${result.error}`);
      }
      break;
      
    default:
      console.log(`
Usage:
  npx ts-node scripts/batch-ocr.ts status     - Show OCR progress
  npx ts-node scripts/batch-ocr.ts core       - OCR core rulebook pages
  npx ts-node scripts/batch-ocr.ts gamblers   - OCR Gambler's Chest pages
  npx ts-node scripts/batch-ocr.ts expansions - OCR expansion pages
  npx ts-node scripts/batch-ocr.ts misc       - OCR miscellaneous pages
  npx ts-node scripts/batch-ocr.ts all        - OCR everything
  npx ts-node scripts/batch-ocr.ts file <path> - OCR single file
`);
  }
}

main().catch(console.error);

