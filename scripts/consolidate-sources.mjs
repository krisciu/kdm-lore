#!/usr/bin/env node
/**
 * Consolidate and deduplicate lore source files
 * Run: node scripts/consolidate-sources.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCES_DIR = path.join(__dirname, '../docs/lore/sources');
const SHOP_DIR = path.join(SOURCES_DIR, 'official-site/shop');

// Priority: smart-scraped > batch-scraped > root files > subdirectories
const PRIORITY_DIRS = [
  'smart-scraped',
  'batch-scraped',
  '', // root
];

function findAllShopFiles() {
  const files = new Map(); // slug -> { path, size, priority }
  
  function scanDir(dir, priority) {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Scan subdirectories with lower priority
        scanDir(fullPath, priority + 10);
      } else if (entry.name.endsWith('.txt')) {
        const slug = entry.name.replace('.txt', '');
        const stat = fs.statSync(fullPath);
        
        const existing = files.get(slug);
        if (!existing || priority < existing.priority || 
            (priority === existing.priority && stat.size > existing.size)) {
          files.set(slug, { 
            path: fullPath, 
            size: stat.size, 
            priority,
            relativePath: path.relative(SHOP_DIR, fullPath)
          });
        }
      }
    }
  }
  
  // Scan in priority order
  scanDir(path.join(SHOP_DIR, 'smart-scraped'), 1);
  scanDir(path.join(SHOP_DIR, 'batch-scraped'), 2);
  scanDir(SHOP_DIR, 3); // root files
  
  // Scan subdirectories (quarry-expansions, etc.)
  const subdirs = fs.readdirSync(SHOP_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !['smart-scraped', 'batch-scraped'].includes(d.name));
  
  for (const subdir of subdirs) {
    scanDir(path.join(SHOP_DIR, subdir.name), 5);
  }
  
  return files;
}

function generateReport(files) {
  const report = {
    timestamp: new Date().toISOString(),
    totalUniqueProducts: files.size,
    bySource: {
      'smart-scraped': 0,
      'batch-scraped': 0,
      'root': 0,
      'subdirectories': 0,
    },
    duplicatesFound: [],
    largestFiles: [],
  };
  
  for (const [slug, info] of files) {
    if (info.relativePath.startsWith('smart-scraped')) {
      report.bySource['smart-scraped']++;
    } else if (info.relativePath.startsWith('batch-scraped')) {
      report.bySource['batch-scraped']++;
    } else if (!info.relativePath.includes('/')) {
      report.bySource['root']++;
    } else {
      report.bySource['subdirectories']++;
    }
  }
  
  // Find largest files
  const sorted = [...files.entries()].sort((a, b) => b[1].size - a[1].size);
  report.largestFiles = sorted.slice(0, 10).map(([slug, info]) => ({
    slug,
    size: info.size,
    path: info.relativePath,
  }));
  
  return report;
}

async function main() {
  console.log('📁 Consolidating Shop Source Files');
  console.log('='.repeat(50));
  
  const files = findAllShopFiles();
  const report = generateReport(files);
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total unique products: ${report.totalUniqueProducts}`);
  console.log(`   From smart-scraped: ${report.bySource['smart-scraped']}`);
  console.log(`   From batch-scraped: ${report.bySource['batch-scraped']}`);
  console.log(`   From root: ${report.bySource['root']}`);
  console.log(`   From subdirectories: ${report.bySource['subdirectories']}`);
  
  console.log(`\n📄 Largest files:`);
  for (const file of report.largestFiles) {
    console.log(`   ${file.slug}: ${(file.size/1024).toFixed(1)}KB (${file.path})`);
  }
  
  // Save report
  const reportPath = path.join(SHOP_DIR, 'consolidation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Report saved: ${reportPath}`);
  
  // Create master index
  const masterIndex = {
    generatedAt: new Date().toISOString(),
    products: [...files.entries()].map(([slug, info]) => ({
      slug,
      path: info.relativePath,
      size: info.size,
    })).sort((a, b) => a.slug.localeCompare(b.slug)),
  };
  
  const indexPath = path.join(SHOP_DIR, 'master-product-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(masterIndex, null, 2));
  console.log(`📋 Master index saved: ${indexPath}`);
}

main().catch(console.error);

