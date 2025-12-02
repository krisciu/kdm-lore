#!/usr/bin/env node
/**
 * Link Images to Lore - Add image references to lore entries
 * Run: node scripts/link-images-to-lore.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LORE_PATH = path.join(__dirname, '../docs/lore');
const INDEX_PATH = path.join(__dirname, '../docs/lore/sources/images-index.json');

// Load image index
const imageIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));

// Build reverse map: lore entry → images
const loreToImages = new Map();

for (const img of imageIndex.images) {
  for (const rel of img.related || []) {
    const entryPath = rel.entry;
    if (!loreToImages.has(entryPath)) {
      loreToImages.set(entryPath, []);
    }
    loreToImages.get(entryPath).push({
      path: img.path,
      filename: img.filename,
      category: img.category,
      confidence: rel.confidence,
      keyword: img.keyword,
    });
  }
}

// Sort images by confidence for each entry
for (const [entry, images] of loreToImages) {
  images.sort((a, b) => {
    const confOrder = { high: 0, medium: 1, low: 2 };
    return (confOrder[a.confidence] || 2) - (confOrder[b.confidence] || 2);
  });
}

async function main() {
  console.log('🔗 Linking Images to Lore Entries');
  console.log('='.repeat(50));
  
  let updated = 0;
  let skipped = 0;
  
  for (const [entryPath, images] of loreToImages) {
    const fullPath = path.join(LORE_PATH, entryPath);
    
    if (!fs.existsSync(fullPath)) {
      skipped++;
      continue;
    }
    
    let content = fs.readFileSync(fullPath, 'utf-8');
    
    // Check if already has images section
    if (content.includes('## Related Images') || content.includes('## Images')) {
      skipped++;
      continue;
    }
    
    // Filter to high-confidence images, max 5
    const bestImages = images.filter(i => i.confidence === 'high').slice(0, 5);
    
    if (bestImages.length === 0) {
      skipped++;
      continue;
    }
    
    // Build images section
    const imagesSection = `
---

## Related Images

${bestImages.map(img => `- \`${img.path}\` (${img.category}${img.keyword ? `, ${img.keyword}` : ''})`).join('\n')}

*Note: Images are stored in the sources directory. Use the image index for full metadata.*
`;
    
    // Insert before the Source section if it exists, otherwise at the end
    if (content.includes('## Source')) {
      content = content.replace('## Source', imagesSection + '\n## Source');
    } else if (content.includes('[← Back')) {
      content = content.replace(/\n\[← Back/, imagesSection + '\n[← Back');
    } else {
      content += imagesSection;
    }
    
    fs.writeFileSync(fullPath, content);
    console.log(`  ✅ ${entryPath} (${bestImages.length} images)`);
    updated++;
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Updated: ${updated} lore entries with image references`);
  console.log(`⏭️  Skipped: ${skipped} (no high-confidence matches or already has images)`);
}

main().catch(console.error);

