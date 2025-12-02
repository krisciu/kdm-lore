#!/usr/bin/env npx ts-node
/**
 * Build Content Index
 * 
 * Scans all sources and creates a unified index of available content:
 * - Images (extracted rulebook pages, newsletters, shop)
 * - Text files (OCR'd content, scraped pages)
 * - Lore entries (markdown files in docs/lore/)
 */

import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const SOURCES_PATH = path.join(PROJECT_ROOT, 'docs', 'lore', 'sources');
const LORE_PATH = path.join(PROJECT_ROOT, 'docs', 'lore');
const OUTPUT_PATH = path.join(SOURCES_PATH, 'content-index.json');

interface ContentItem {
  path: string;
  type: 'image' | 'text' | 'markdown';
  category: string;
  subcategory?: string;
  name: string;
  size: number;
  hasOcr?: boolean;
  ocrPath?: string;
  lineCount?: number;
}

interface ContentIndex {
  version: string;
  generatedAt: string;
  summary: {
    totalImages: number;
    totalTextFiles: number;
    totalMarkdownFiles: number;
    totalSizeBytes: number;
    categories: Record<string, number>;
  };
  items: ContentItem[];
}

/**
 * Recursively scan a directory
 */
function scanDirectory(
  dir: string, 
  category: string,
  filter?: (name: string) => boolean
): ContentItem[] {
  if (!fs.existsSync(dir)) return [];
  
  const items: ContentItem[] = [];
  
  function scan(currentDir: string, subcategory?: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(PROJECT_ROOT, fullPath);
      
      if (entry.isDirectory()) {
        scan(fullPath, subcategory || entry.name);
        continue;
      }
      
      if (filter && !filter(entry.name)) continue;
      
      const stats = fs.statSync(fullPath);
      const ext = path.extname(entry.name).toLowerCase();
      
      let type: 'image' | 'text' | 'markdown';
      if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
        type = 'image';
      } else if (ext === '.md') {
        type = 'markdown';
      } else if (ext === '.txt' || ext === '.json') {
        type = 'text';
      } else {
        continue;
      }
      
      const item: ContentItem = {
        path: relativePath,
        type,
        category,
        subcategory,
        name: entry.name,
        size: stats.size,
      };
      
      // Check for corresponding OCR text
      if (type === 'image') {
        const textPath = fullPath.replace(/\.(png|jpg|jpeg)$/i, '.txt');
        if (fs.existsSync(textPath)) {
          item.hasOcr = true;
          item.ocrPath = path.relative(PROJECT_ROOT, textPath);
        }
      }
      
      // Count lines for text files
      if (type === 'text' && ext === '.txt') {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          item.lineCount = content.split('\n').length;
        } catch {}
      }
      
      items.push(item);
    }
  }
  
  scan(dir);
  return items;
}

/**
 * Build the complete content index
 */
function buildIndex(): ContentIndex {
  const items: ContentItem[] = [];
  
  // Scan rulebook images
  items.push(...scanDirectory(
    path.join(SOURCES_PATH, 'rulebooks', 'extracted', 'images'),
    'rulebook-images',
    name => /\.(png|jpg|jpeg)$/i.test(name)
  ));
  
  // Scan rulebook text
  items.push(...scanDirectory(
    path.join(SOURCES_PATH, 'rulebooks', 'extracted', 'core'),
    'rulebook-text',
    name => name.endsWith('.txt')
  ));
  
  // Scan lore-extracted
  items.push(...scanDirectory(
    path.join(SOURCES_PATH, 'rulebooks', 'lore-extracted'),
    'lore-extracted',
    name => name.endsWith('.txt')
  ));
  
  // Scan newsletter images
  items.push(...scanDirectory(
    path.join(SOURCES_PATH, 'official-site', 'images', 'newsletters'),
    'newsletter-images',
    name => /\.(png|jpg|jpeg)$/i.test(name)
  ));
  
  // Scan shop images
  items.push(...scanDirectory(
    path.join(SOURCES_PATH, 'official-site', 'images', 'shop'),
    'shop-images',
    name => /\.(png|jpg|jpeg)$/i.test(name)
  ));
  
  // Scan scraped text
  items.push(...scanDirectory(
    path.join(SOURCES_PATH, 'official-site', 'news'),
    'newsletter-text',
    name => name.endsWith('.txt')
  ));
  
  items.push(...scanDirectory(
    path.join(SOURCES_PATH, 'official-site', 'shop'),
    'shop-text',
    name => name.endsWith('.txt')
  ));
  
  items.push(...scanDirectory(
    path.join(SOURCES_PATH, 'official-site', 'guides'),
    'guides-text',
    name => name.endsWith('.txt')
  ));
  
  // Scan lore markdown
  items.push(...scanDirectory(
    LORE_PATH,
    'lore-entries',
    name => name.endsWith('.md') && !name.includes('README')
  ));
  
  // Scan existing research
  items.push(...scanDirectory(
    path.join(SOURCES_PATH, 'existing-research'),
    'existing-research',
    name => name.endsWith('.txt')
  ));
  
  // Build summary
  const summary = {
    totalImages: items.filter(i => i.type === 'image').length,
    totalTextFiles: items.filter(i => i.type === 'text').length,
    totalMarkdownFiles: items.filter(i => i.type === 'markdown').length,
    totalSizeBytes: items.reduce((sum, i) => sum + i.size, 0),
    categories: {} as Record<string, number>,
  };
  
  for (const item of items) {
    summary.categories[item.category] = (summary.categories[item.category] || 0) + 1;
  }
  
  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    summary,
    items,
  };
}

/**
 * Main
 */
function main(): void {
  console.log('\n📊 Building content index...\n');
  
  const index = buildIndex();
  
  // Save index
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2));
  
  // Print summary
  console.log('═══════════════════════════════════════════');
  console.log('  Kingdom Death Lore - Content Index');
  console.log('═══════════════════════════════════════════\n');
  
  console.log(`Generated: ${index.generatedAt}\n`);
  
  console.log('Summary:');
  console.log(`  📷 Images: ${index.summary.totalImages.toLocaleString()}`);
  console.log(`  📄 Text Files: ${index.summary.totalTextFiles.toLocaleString()}`);
  console.log(`  📝 Markdown: ${index.summary.totalMarkdownFiles.toLocaleString()}`);
  console.log(`  💾 Total Size: ${(index.summary.totalSizeBytes / 1024 / 1024).toFixed(1)} MB`);
  
  console.log('\nBy Category:');
  const sortedCats = Object.entries(index.summary.categories)
    .sort((a, b) => b[1] - a[1]);
  
  for (const [cat, count] of sortedCats) {
    console.log(`  ${cat}: ${count.toLocaleString()}`);
  }
  
  console.log(`\n✓ Index saved to: ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`);
}

main();

