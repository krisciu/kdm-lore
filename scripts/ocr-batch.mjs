#!/usr/bin/env node
/**
 * OCR Batch Processor - Extract text from KDM images using OpenAI Vision
 * Run: OPENAI_API_KEY=sk-xxx node scripts/ocr-batch.mjs
 * 
 * Processes images flagged with needsOCR in images-index.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCES_PATH = path.join(__dirname, '../docs/lore/sources');
const INDEX_PATH = path.join(SOURCES_PATH, 'images-index.json');
const OCR_OUTPUT_PATH = path.join(SOURCES_PATH, 'ocr-results');

// Ensure output directory exists
if (!fs.existsSync(OCR_OUTPUT_PATH)) {
  fs.mkdirSync(OCR_OUTPUT_PATH, { recursive: true });
}

// Parse command line args first to check for dry-run
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Check for API key (not required for dry-run)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY && !dryRun) {
  console.error('❌ Error: OPENAI_API_KEY environment variable is required');
  console.log('\nUsage: OPENAI_API_KEY=sk-xxx node scripts/ocr-batch.mjs [--limit N] [--category TYPE]');
  console.log('\nOptions:');
  console.log('  --limit N      Process only N images (default: 10)');
  console.log('  --category X   Only process images in category X');
  console.log('  --high-value   Only process images without existing text extracts');
  console.log('  --dry-run      Show what would be processed without calling API');
  process.exit(1);
}

// Parse remaining command line args
const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : 10;
const categoryFilter = args.includes('--category') ? args[args.indexOf('--category') + 1] : null;
const highValueOnly = args.includes('--high-value');

/**
 * Check if we already have text for an image (in extracted/core/*.txt)
 */
function hasExistingText(imagePath) {
  // Check for rulebook pages that have corresponding text files
  if (imagePath.includes('rulebook-pages')) {
    const match = imagePath.match(/rulebook-1\.6-(\d+)/i);
    if (match) {
      const pageNum = match[1];
      const textPath = path.join(SOURCES_PATH, 'rulebooks/extracted/core', `RuleBook_${pageNum}.txt`);
      return fs.existsSync(textPath);
    }
  }
  return false;
}

/**
 * Convert image to base64
 */
function imageToBase64(imagePath) {
  const absolutePath = path.join(SOURCES_PATH, imagePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  const imageBuffer = fs.readFileSync(absolutePath);
  const ext = path.extname(imagePath).toLowerCase().replace('.', '');
  const mimeType = ext === 'jpg' ? 'jpeg' : ext;
  return `data:image/${mimeType};base64,${imageBuffer.toString('base64')}`;
}

/**
 * Extract text from image using OpenAI Vision
 */
async function extractTextFromImage(imagePath, imageInfo) {
  const base64Image = imageToBase64(imagePath);
  if (!base64Image) {
    return { error: 'Image not found', text: null };
  }

  const prompt = `You are extracting text from a Kingdom Death: Monster game image.

This is a ${imageInfo.category} image${imageInfo.keyword ? ` related to "${imageInfo.keyword}"` : ''}.

Please extract ALL visible text from this image, including:
- Card titles and names
- Flavor text and descriptions  
- Rules text and game mechanics
- Any story or lore content
- Numbers and statistics

Format the output as clean, readable text. Use markdown formatting where appropriate:
- Use **bold** for titles and card names
- Use *italics* for flavor text
- Use bullet points for lists
- Preserve paragraph breaks

If there is no readable text, respond with "[No text found]".
If the image is a card back or purely decorative, note that.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: base64Image, detail: 'high' } },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { error: `API Error: ${response.status} - ${error}`, text: null };
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '[No response]';
    
    return { error: null, text, usage: data.usage };
  } catch (err) {
    return { error: err.message, text: null };
  }
}

/**
 * Save OCR result to file
 */
function saveResult(imagePath, result) {
  const basename = path.basename(imagePath, path.extname(imagePath));
  const subdir = path.dirname(imagePath).split('/').slice(-2).join('-');
  
  const outputDir = path.join(OCR_OUTPUT_PATH, subdir);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, `${basename}.txt`);
  
  const content = `# OCR Result: ${path.basename(imagePath)}

Source: ${imagePath}
Processed: ${new Date().toISOString()}
${result.usage ? `Tokens: ${result.usage.total_tokens}` : ''}

---

${result.text}

---
`;

  fs.writeFileSync(outputPath, content);
  return outputPath;
}

/**
 * Check if image was already processed
 */
function isAlreadyProcessed(imagePath) {
  const basename = path.basename(imagePath, path.extname(imagePath));
  const subdir = path.dirname(imagePath).split('/').slice(-2).join('-');
  const outputPath = path.join(OCR_OUTPUT_PATH, subdir, `${basename}.txt`);
  return fs.existsSync(outputPath);
}

async function main() {
  console.log('🔍 OCR Batch Processor');
  console.log('='.repeat(50));
  
  // Load image index
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  
  // Filter images that need OCR
  let imagesToProcess = index.images.filter(img => img.needsOCR);
  
  // Apply category filter
  if (categoryFilter) {
    imagesToProcess = imagesToProcess.filter(img => img.category === categoryFilter);
    console.log(`📁 Filtering to category: ${categoryFilter}`);
  }
  
  // Skip already processed
  imagesToProcess = imagesToProcess.filter(img => !isAlreadyProcessed(img.path));
  
  // High-value filter: skip images that already have text extracts
  if (highValueOnly) {
    const before = imagesToProcess.length;
    imagesToProcess = imagesToProcess.filter(img => !hasExistingText(img.path));
    console.log(`🎯 High-value filter: ${before} → ${imagesToProcess.length} (skipped ${before - imagesToProcess.length} with existing text)`);
  }
  
  // Sort by priority (highest first)
  imagesToProcess.sort((a, b) => (b.ocrPriority || 0) - (a.ocrPriority || 0));
  
  console.log(`📸 Total images needing OCR: ${index.summary.needsOCR}`);
  console.log(`📸 Images to process (after filter): ${imagesToProcess.length}`);
  console.log(`📸 Processing limit: ${limit}`);
  
  if (dryRun) {
    console.log('\n🔸 DRY RUN - Would process (sorted by priority):');
    for (const img of imagesToProcess.slice(0, limit)) {
      const hasText = hasExistingText(img.path) ? ' [has text]' : '';
      console.log(`  [P${img.ocrPriority || 0}] ${img.path} (${img.category})${hasText}`);
    }
    
    // Show priority breakdown
    const byPriority = {};
    for (const img of imagesToProcess) {
      const p = img.ocrPriority || 0;
      byPriority[p] = (byPriority[p] || 0) + 1;
    }
    console.log('\n📊 Priority Breakdown:');
    for (const [p, count] of Object.entries(byPriority).sort((a, b) => b[0] - a[0])) {
      console.log(`  Priority ${p}: ${count} images`);
    }
    
    // Show top categories to process
    const byCat = {};
    for (const img of imagesToProcess.slice(0, 100)) {
      byCat[img.category] = (byCat[img.category] || 0) + 1;
    }
    console.log('\n📁 Top categories (first 100):');
    for (const [cat, count] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cat}: ${count}`);
    }
    return;
  }
  
  const batch = imagesToProcess.slice(0, limit);
  console.log(`\n🚀 Processing ${batch.length} images...`);
  
  let processed = 0;
  let errors = 0;
  let totalTokens = 0;
  
  for (const img of batch) {
    console.log(`\n[${processed + 1}/${batch.length}] ${img.filename}`);
    
    const result = await extractTextFromImage(img.path, img);
    
    if (result.error) {
      console.log(`  ❌ Error: ${result.error}`);
      errors++;
    } else {
      const outputPath = saveResult(img.path, result);
      const preview = result.text.slice(0, 100).replace(/\n/g, ' ');
      console.log(`  ✅ Saved: ${path.basename(outputPath)}`);
      console.log(`  📝 Preview: ${preview}...`);
      
      if (result.usage) {
        totalTokens += result.usage.total_tokens;
      }
      processed++;
    }
    
    // Rate limiting - wait 500ms between requests
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Processed: ${processed}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`🎫 Total tokens used: ${totalTokens}`);
  console.log(`💰 Estimated cost: $${(totalTokens * 0.00001).toFixed(4)}`);
  console.log(`📁 Results saved to: ${OCR_OUTPUT_PATH}`);
}

main().catch(console.error);
