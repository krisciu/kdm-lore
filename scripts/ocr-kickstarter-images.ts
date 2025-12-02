#!/usr/bin/env npx ts-node
/**
 * OCR all Kickstarter images using Tesseract.js
 */

import Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';

const IMAGES_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources', 'kickstarter', 'images');
const OCR_OUTPUT_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources', 'kickstarter', 'ocr');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function processImage(imagePath: string): Promise<{ text: string; confidence: number } | null> {
  try {
    // Check if file exists and has content
    const stats = fs.statSync(imagePath);
    if (stats.size < 100) {
      return null; // Skip tiny/empty files
    }
    
    const { data: { text, confidence } } = await Tesseract.recognize(
      imagePath,
      'eng',
      {
        // logger: m => process.stdout.write('.') // Progress dots
      }
    );
    return { text: text.trim(), confidence };
  } catch (error: any) {
    console.log(`    ⚠ Error: ${error.message?.slice(0, 50) || 'Unknown'}`);
    return null;
  }
}

async function main(): Promise<void> {
  console.log('\n🔍 OCR Processing Kickstarter Images\n');
  
  ensureDir(OCR_OUTPUT_PATH);
  
  // Get all image directories
  const updateDirs = fs.readdirSync(IMAGES_PATH).filter(d => 
    fs.statSync(path.join(IMAGES_PATH, d)).isDirectory()
  );
  
  console.log(`Found ${updateDirs.length} update directories with images\n`);
  
  let totalImages = 0;
  let processedImages = 0;
  let totalTextLength = 0;
  
  for (const updateDir of updateDirs) {
    const dirPath = path.join(IMAGES_PATH, updateDir);
    const images = fs.readdirSync(dirPath).filter(f => 
      /\.(jpg|jpeg|png|gif)$/i.test(f)
    );
    
    if (images.length === 0) continue;
    
    totalImages += images.length;
    const ocrOutputDir = path.join(OCR_OUTPUT_PATH, updateDir);
    ensureDir(ocrOutputDir);
    
    console.log(`📁 ${updateDir} (${images.length} images)`);
    
    const allText: string[] = [];
    
    for (const image of images) {
      const imagePath = path.join(dirPath, image);
      const ocrFile = path.join(ocrOutputDir, image.replace(/\.[^.]+$/, '.txt'));
      
      // Skip if already processed
      if (fs.existsSync(ocrFile)) {
        const existingText = fs.readFileSync(ocrFile, 'utf-8');
        allText.push(existingText);
        processedImages++;
        continue;
      }
      
      const result = await processImage(imagePath);
      if (result && result.text.length > 10) {
        fs.writeFileSync(ocrFile, result.text, 'utf-8');
        allText.push(result.text);
        totalTextLength += result.text.length;
        process.stdout.write(`  ✓ ${image} (${result.text.length} chars)\n`);
      } else {
        process.stdout.write(`  - ${image} (no text)\n`);
      }
      processedImages++;
    }
    
    // Save combined OCR for this update
    if (allText.length > 0) {
      const combinedPath = path.join(ocrOutputDir, '_combined.txt');
      fs.writeFileSync(combinedPath, allText.join('\n\n---\n\n'), 'utf-8');
    }
  }
  
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  OCR Complete`);
  console.log(`═══════════════════════════════════════════`);
  console.log(`  Directories: ${updateDirs.length}`);
  console.log(`  Images processed: ${processedImages}/${totalImages}`);
  console.log(`  Total text extracted: ${totalTextLength} characters`);
  console.log(`  Output: ${OCR_OUTPUT_PATH}`);
}

main().catch(console.error);

