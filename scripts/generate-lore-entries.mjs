#!/usr/bin/env node
/**
 * Generate structured lore entries from scraped source files
 * Run: node scripts/generate-lore-entries.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCES_DIR = path.join(__dirname, '../docs/lore/sources/official-site/shop/smart-scraped');
const LORE_DIR = path.join(__dirname, '../docs/lore');

// Category mapping based on product type
const CATEGORY_MAP = {
  // Monsters (04-monsters)
  'expansion': '04-monsters',
  'quarry': '04-monsters',
  'nemesis': '04-monsters',
  'vignette': '04-monsters',
  
  // Characters (05-characters)
  'survivor': '05-characters',
  'indomitable': '05-characters',
  'wanderer': '05-characters',
  'pillar': '05-characters',
  
  // Factions (02-factions)
  'witches': '02-factions',
  'order': '02-factions',
  
  // Locations (03-locations)
  'citadel': '03-locations',
  'settlement': '03-locations',
  
  // Concepts (06-concepts)
  'philosophy': '06-concepts',
  'pattern': '06-concepts',
  
  // Technology (07-technology)
  'armor': '07-technology',
  'weapon': '07-technology',
  'gear': '07-technology',
};

function categorizeProduct(filename, content) {
  const lower = filename.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // Check filename patterns
  if (lower.includes('expansion') || lower.includes('vignette')) {
    return '04-monsters';
  }
  if (lower.includes('survivor') || lower.includes('wanderer') || lower.includes('pillar')) {
    return '05-characters';
  }
  if (lower.includes('philosophy') || lower.includes('pattern')) {
    return '06-concepts';
  }
  if (lower.includes('armor') || lower.includes('kit')) {
    return '07-technology';
  }
  
  // Check content
  if (contentLower.includes('quarry monster') || contentLower.includes('nemesis monster')) {
    return '04-monsters';
  }
  if (contentLower.includes('survivor') && contentLower.includes('miniature')) {
    return '05-characters';
  }
  
  // Default to concepts
  return '06-concepts';
}

function extractLoreFromSource(content) {
  // Find the description section
  const descMatch = content.match(/## (?:Lore \/ )?Description\n\n([\s\S]*?)(?=\n---|\n## )/);
  const description = descMatch ? descMatch[1].trim() : '';
  
  // Clean up description
  const cleanDesc = description
    .split('\n')
    .filter(line => {
      const l = line.trim();
      return l.length > 0 && 
             !l.includes('VAT') && 
             !l.includes('customs') && 
             !l.includes('warehouse') &&
             !l.match(/^\$[\d,]+/);
    })
    .join('\n')
    .trim();
  
  // Extract title
  const titleMatch = content.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Unknown';
  
  // Extract price
  const priceMatch = content.match(/Price: ([\$\d,.]+)/);
  const price = priceMatch ? priceMatch[1] : '';
  
  return { title, description: cleanDesc, price };
}

function generateMarkdown(slug, title, category, description, sourceFile) {
  const categoryName = category.split('-')[1]; // '04-monsters' -> 'monsters'
  
  return `---
title: "${title}"
category: ${categoryName}
source: ${sourceFile}
confidence: confirmed
updated: ${new Date().toISOString().split('T')[0]}
---

# ${title}

${description}

---

## Source

This entry was extracted from official Kingdom Death product descriptions.

- **Source File:** \`${sourceFile}\`
- **Category:** ${categoryName}
- **Confidence:** Confirmed (official product description)

---

[← Back to ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}](../_index.md)
`;
}

async function main() {
  console.log('📝 Generating Lore Entries from Sources');
  console.log('='.repeat(50));
  
  if (!fs.existsSync(SOURCES_DIR)) {
    console.log(`❌ Source directory not found: ${SOURCES_DIR}`);
    return;
  }
  
  const files = fs.readdirSync(SOURCES_DIR).filter(f => f.endsWith('.txt'));
  console.log(`📄 Found ${files.length} source files\n`);
  
  const stats = {
    generated: 0,
    skipped: 0,
    byCategory: {},
  };
  
  for (const file of files) {
    const sourcePath = path.join(SOURCES_DIR, file);
    const content = fs.readFileSync(sourcePath, 'utf-8');
    
    const { title, description } = extractLoreFromSource(content);
    
    // Skip files with minimal content
    if (description.length < 100) {
      stats.skipped++;
      continue;
    }
    
    const category = categorizeProduct(file, content);
    const slug = file.replace('.txt', '');
    
    // Generate markdown
    const markdown = generateMarkdown(slug, title, category, description, file);
    
    // Write to appropriate directory
    const outputDir = path.join(LORE_DIR, category);
    const outputPath = path.join(outputDir, `${slug}.md`);
    
    // Don't overwrite existing files
    if (fs.existsSync(outputPath)) {
      stats.skipped++;
      continue;
    }
    
    fs.writeFileSync(outputPath, markdown);
    
    stats.generated++;
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    
    console.log(`  ✅ ${category}/${slug}.md`);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Generated: ${stats.generated} lore entries`);
  console.log(`⏭️ Skipped: ${stats.skipped} (too short or already exists)`);
  console.log('\nBy category:');
  for (const [cat, count] of Object.entries(stats.byCategory)) {
    console.log(`  ${cat}: ${count}`);
  }
}

main().catch(console.error);

