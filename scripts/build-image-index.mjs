#!/usr/bin/env node
/**
 * Build Image Index - Scan all images and create searchable metadata
 * Connects images to lore entries by name/keyword matching
 * Run: node scripts/build-image-index.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCES_PATH = path.join(__dirname, '../docs/lore/sources');
const LORE_PATH = path.join(__dirname, '../docs/lore');
const INDEX_PATH = path.join(SOURCES_PATH, 'images-index.json');

// Keywords that map images to lore categories
const CATEGORY_KEYWORDS = {
  monsters: [
    'white-lion', 'butcher', 'phoenix', 'dragon-king', 'gorm', 'sunstalker',
    'flower-knight', 'spidicules', 'dung-beetle', 'lion-god', 'frogdog',
    'slenderman', 'lion-knight', 'manhunter', 'black-knight', 'kings-man',
    'screaming-antelope', 'gold-smoke', 'watcher', 'hand', 'tyrant', 
    'pariah', 'red-witch', 'lonely-tree', 'nightmare-ram'
  ],
  characters: [
    'survivor', 'twilight-knight', 'white-speaker', 'savior', 'aya', 
    'lucy', 'erza', 'percival', 'nico', 'allison', 'zachary', 'preacher',
    'necromancer', 'pinup', 'death-high'
  ],
  gear: [
    'armor', 'weapon', 'gear', 'card', 'sword', 'katar', 'bow', 'spear',
    'shield', 'lantern', 'rawhide', 'leather', 'bone', 'lion-', 'phoenix-'
  ],
  gameplay: [
    'ai-card', 'hl-card', 'hunt', 'showdown', 'settlement', 'terrain',
    'disorder', 'fighting-art', 'innovation', 'resource', 'hit-location'
  ],
  art: [
    'bust', 'pinup', 'art-print', 'concept', 'promo', 'diorama'
  ]
};

// Extract entity name from filename
function extractEntityName(filename) {
  return filename
    .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\d+/g, '')
    .trim()
    .toLowerCase();
}

// Categorize an image based on its path and filename
function categorizeImage(imagePath, filename) {
  const lowerPath = imagePath.toLowerCase();
  const lowerName = filename.toLowerCase();
  const combined = `${lowerPath}/${lowerName}`;
  
  // Check each category's keywords
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (combined.includes(keyword.toLowerCase())) {
        return { category, matchedKeyword: keyword };
      }
    }
  }
  
  // Fallback categorization by directory
  if (lowerPath.includes('rulebook-pages')) return { category: 'rulebook', matchedKeyword: null };
  if (lowerPath.includes('game-content')) return { category: 'gameplay', matchedKeyword: null };
  if (lowerPath.includes('expansions-of-death')) return { category: 'expansions', matchedKeyword: null };
  if (lowerPath.includes('gamblers-chest')) return { category: 'gamblers-chest', matchedKeyword: null };
  if (lowerPath.includes('newsletter')) return { category: 'newsletters', matchedKeyword: null };
  if (lowerPath.includes('shop')) return { category: 'shop', matchedKeyword: null };
  
  return { category: 'uncategorized', matchedKeyword: null };
}

// Find potential lore entries this image could relate to
function findRelatedLoreEntries(imagePath, filename) {
  const related = [];
  const entityName = extractEntityName(filename);
  const words = entityName.split(' ').filter(w => w.length > 2);
  
  // Scan lore directories
  const loreDirs = fs.readdirSync(LORE_PATH)
    .filter(d => d.match(/^\d{2}-/) && fs.statSync(path.join(LORE_PATH, d)).isDirectory());
  
  for (const dir of loreDirs) {
    const dirPath = path.join(LORE_PATH, dir);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md') && f !== '_index.md');
    
    for (const file of files) {
      const loreSlug = file.replace('.md', '').toLowerCase();
      
      // Check if any word matches
      for (const word of words) {
        if (loreSlug.includes(word) && word.length > 3) {
          related.push({
            entry: `${dir}/${file}`,
            confidence: word.length > 5 ? 'high' : 'medium',
            matchedWord: word
          });
          break;
        }
      }
    }
  }
  
  return related;
}

// Recursively scan for images
function scanDirectory(dirPath, relativeTo, results = []) {
  if (!fs.existsSync(dirPath)) return results;
  
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      scanDirectory(fullPath, relativeTo, results);
    } else if (/\.(png|jpg|jpeg|gif|webp)$/i.test(item)) {
      const relativePath = fullPath.replace(relativeTo + '/', '');
      const { category, matchedKeyword } = categorizeImage(relativePath, item);
      const relatedEntries = findRelatedLoreEntries(relativePath, item);
      
      // Determine if image needs OCR (high-value text extraction)
      const needsOCR = 
        // Rulebook pages (story events, lore text)
        relativePath.includes('rulebook-pages') ||
        // Newsletter images (announcements, lore reveals)
        relativePath.includes('newsletter') ||
        // Artcards with lore text
        item.toLowerCase().includes('artcard') ||
        // Card fronts (not backs)
        (item.toLowerCase().includes('card') && !item.toLowerCase().includes('back')) ||
        // Gear cards
        (item.toLowerCase().includes('gear') && !item.toLowerCase().includes('back')) ||
        // AI/HL cards with content
        (item.toLowerCase().includes('ai') && !item.toLowerCase().includes('back')) ||
        (item.toLowerCase().includes('hl') && !item.toLowerCase().includes('back'));
      
      // Priority for OCR (higher = more important)
      let ocrPriority = 0;
      if (relativePath.includes('rulebook-pages')) ocrPriority = 10;
      else if (relativePath.includes('newsletter')) ocrPriority = 9; // Newsletter images are high value
      else if (item.toLowerCase().includes('artcard')) ocrPriority = 8;
      else if (item.toLowerCase().includes('story')) ocrPriority = 9;
      else if (needsOCR) ocrPriority = 5;
      
      results.push({
        path: relativePath,
        filename: item,
        size: stat.size,
        category,
        matchedKeyword,
        relatedEntries: relatedEntries.slice(0, 5), // Top 5 matches
        entityName: extractEntityName(item),
        needsOCR,
        ocrPriority,
      });
    }
  }
  
  return results;
}

async function main() {
  console.log('🖼️  Building Image Index');
  console.log('='.repeat(50));
  
  // Scan for images
  console.log('\n📸 Scanning for images...');
  const images = scanDirectory(SOURCES_PATH, SOURCES_PATH);
  console.log(`  Found ${images.length} images`);
  
  // Build category counts
  const byCategory = {};
  const byKeyword = {};
  const withRelations = [];
  
  for (const img of images) {
    // Count by category
    byCategory[img.category] = (byCategory[img.category] || 0) + 1;
    
    // Count by keyword
    if (img.matchedKeyword) {
      byKeyword[img.matchedKeyword] = (byKeyword[img.matchedKeyword] || 0) + 1;
    }
    
    // Track images with lore relations
    if (img.relatedEntries.length > 0) {
      withRelations.push(img);
    }
  }
  
  // Build index
  const index = {
    version: '2.0',
    generatedAt: new Date().toISOString(),
    summary: {
      totalImages: images.length,
      withLoreRelations: withRelations.length,
      needsOCR: images.filter(i => i.needsOCR).length,
      byCategory,
      topKeywords: Object.entries(byKeyword)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
    },
    images: images.map(img => ({
      path: img.path,
      filename: img.filename,
      category: img.category,
      keyword: img.matchedKeyword,
      related: img.relatedEntries,
      needsOCR: img.needsOCR,
      ocrPriority: img.ocrPriority || 0,
    })),
  };
  
  // Write index
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log(`\n✅ Index written to ${INDEX_PATH}`);
  
  // Print summary
  console.log('\n📊 Summary:');
  console.log(`  Total images: ${images.length}`);
  console.log(`  With lore relations: ${withRelations.length}`);
  console.log(`  Needs OCR: ${images.filter(i => i.needsOCR).length}`);
  
  console.log('\n📁 By Category:');
  for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }
  
  console.log('\n🏷️  Top Keywords:');
  for (const [keyword, count] of Object.entries(byKeyword).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${keyword}: ${count}`);
  }
  
  // Show some example relations
  console.log('\n🔗 Example Image→Lore Relations:');
  for (const img of withRelations.slice(0, 5)) {
    console.log(`  ${img.filename}`);
    for (const rel of img.relatedEntries.slice(0, 2)) {
      console.log(`    → ${rel.entry} (${rel.confidence})`);
    }
  }
}

main().catch(console.error);

