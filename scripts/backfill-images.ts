#!/usr/bin/env npx ts-node
/**
 * Backfill Images Script
 * 
 * Scans existing scraped content and creates a manifest of images to capture.
 * Generates browser capture tasks for each page that needs image extraction.
 * 
 * Usage:
 *   npx ts-node scripts/backfill-images.ts scan     - Scan for pages needing images
 *   npx ts-node scripts/backfill-images.ts manifest - Generate capture manifest
 *   npx ts-node scripts/backfill-images.ts status   - Show backfill progress
 */

import fs from 'fs';
import path from 'path';

const SOURCES_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources');
const BACKFILL_PATH = path.join(SOURCES_PATH, 'backfill');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function log(color: keyof typeof colors, message: string): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Page types that need image capture
interface ScrapedPage {
  filePath: string;
  fileName: string;
  category: string;
  sourceUrl?: string;
  title?: string;
  hasImages: boolean;
  imageUrls: string[];
  needsCapture: boolean;
}

interface BackfillManifest {
  version: string;
  generatedAt: string;
  totalPages: number;
  pagesNeedingCapture: number;
  capturedPages: number;
  pages: BackfillPage[];
}

interface BackfillPage {
  id: string;
  filePath: string;
  sourceUrl: string;
  title: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  imageTypes: string[];
  status: 'pending' | 'captured' | 'no-images' | 'skipped';
  capturedAt?: string;
  imageCount?: number;
  notes?: string;
}

/**
 * Known source URLs for scraped content
 */
const KNOWN_SOURCES: Record<string, string> = {
  // KDU Newsletters
  'kdu-97-august-2024': 'https://kingdomdeath.com/news/mc-980dbb0cda',
  'kdu-99-october-2024': 'https://kingdomdeath.com/news/mc-059aa211d2',
  'kdu-101-december-2024': 'https://kingdomdeath.com/news/mc-83970b9b56',
  'kdu-102-january-2025': 'https://kingdomdeath.com/news/mc-fa567e6a76',
  'kdu-103-february-2025': 'https://kingdomdeath.com/news/mc-e8badbb129',
  'kdu-104-march-2025': 'https://kingdomdeath.com/news/mc-b63c5e0bfe',
  'kdu-105-april-2025': 'https://kingdomdeath.com/news/mc-c4395458a8',
  'kdu-106-may-2025': 'https://kingdomdeath.com/news/mc-a9d27eedc7',
  'kdu-107-june-2025': 'https://kingdomdeath.com/news/mc-0620fe74a1',
  'kdu-108-july-2025': 'https://kingdomdeath.com/news/mc-38e1aabf18',
  'kdu-109-august-2025': 'https://kingdomdeath.com/news/mc-f54efd621f',
  
  // Shop expansions
  'kingdom-death-monster-1-6': 'https://shop.kingdomdeath.com/products/kingdom-death-monster-1-5',
  'gorm-expansion-1-6': 'https://shop.kingdomdeath.com/products/gorm-expansion',
  'dragon-king-expansion-1-6': 'https://shop.kingdomdeath.com/products/dragon-king-expansion',
  'sunstalker-expansion-1-6': 'https://shop.kingdomdeath.com/products/sunstalker-expansion',
  'flower-knight-expansion-1-6': 'https://shop.kingdomdeath.com/products/flower-knight-expansion',
  'spidicules-expansion-1-6': 'https://shop.kingdomdeath.com/products/spidicules-expansion',
  'lion-knight-expansion-1-6': 'https://shop.kingdomdeath.com/products/lion-knight-expansion',
  'slenderman-expansion-1-6': 'https://shop.kingdomdeath.com/products/slenderman-expansion',
  'dung-beetle-knight-expansion-1-6': 'https://shop.kingdomdeath.com/products/dung-beetle-knight-expansion',
  'lion-god-expansion-1-6': 'https://shop.kingdomdeath.com/products/lion-god-expansion',
  'lonely-tree-expansion-1-6': 'https://shop.kingdomdeath.com/products/lonely-tree-expansion',
  'gamblers-chest-expansion': 'https://shop.kingdomdeath.com/products/gamblers-chest-expansion',
  'frogdog-expansion': 'https://shop.kingdomdeath.com/products/frogdog-expansion',
  'black-knight-expansion': 'https://shop.kingdomdeath.com/products/black-knight-expansion',
  'red-witches-expansion': 'https://shop.kingdomdeath.com/products/red-witches-expansion',
  'pariah-expansion': 'https://shop.kingdomdeath.com/products/pariah-expansion',
  'false-messengers': 'https://shop.kingdomdeath.com/products/false-messengers',
  'philosophy-gatherism': 'https://shop.kingdomdeath.com/products/philosophy-of-death-gatherism',
  
  // Wanderers
  'wanderer-candy': 'https://shop.kingdomdeath.com/products/wanderer-candy',
  'wanderer-aeneas': 'https://shop.kingdomdeath.com/products/wanderer-aeneas',
  'wanderer-death-drifter': 'https://shop.kingdomdeath.com/products/wanderer-death-drifter',
  'wanderer-goth': 'https://shop.kingdomdeath.com/products/wanderer-goth',
  
  // Pillar survivors
  'pillar-fade': 'https://shop.kingdomdeath.com/products/pillar-survivor-fade',
  'pillar-percival': 'https://shop.kingdomdeath.com/products/pillar-survivor-percival',
  
  // Guides
  'indomitable-survivors-guide': 'https://shop.kingdomdeath.com/pages/indomitable-survivors',
  'seed-patterns-guide': 'https://shop.kingdomdeath.com/pages/seed-patterns',
  'monster-nodes-guide': 'https://shop.kingdomdeath.com/pages/nodes-in-monster-campaigns',
  'philosophies-of-death-guide': 'https://shop.kingdomdeath.com/pages/philosophies-of-death',
};

/**
 * Scan all scraped files and identify what needs image capture
 */
function scanScrapedContent(): ScrapedPage[] {
  const pages: ScrapedPage[] = [];
  
  function scanDirectory(dir: string, category: string): void {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        // Skip certain directories
        if (['images', 'ocr-results', 'backfill', 'reports'].includes(item.name)) {
          continue;
        }
        scanDirectory(fullPath, `${category}/${item.name}`);
      } else if (item.name.endsWith('.txt') && !item.name.endsWith('.meta.txt')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const page = analyzeScrapedFile(fullPath, content, category);
        pages.push(page);
      }
    }
  }
  
  // Scan official-site content
  scanDirectory(path.join(SOURCES_PATH, 'official-site'), 'official-site');
  
  return pages;
}

/**
 * Analyze a scraped file to determine if it needs image capture
 */
function analyzeScrapedFile(filePath: string, content: string, category: string): ScrapedPage {
  const fileName = path.basename(filePath, '.txt');
  
  // Extract source URL if present
  const sourceMatch = content.match(/Source:\s*(https?:\/\/[^\s\n]+)/i);
  const sourceUrl = sourceMatch?.[1] || KNOWN_SOURCES[fileName];
  
  // Extract title
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1] || fileName;
  
  // Check for existing image references
  const imageUrls: string[] = [];
  const urlPattern = /https?:\/\/[^\s\n)]+\.(png|jpg|jpeg|gif|webp)/gi;
  let match;
  while ((match = urlPattern.exec(content)) !== null) {
    imageUrls.push(match[0]);
  }
  
  // Check if images section exists
  const hasImagesSection = content.includes('## Images') || content.includes('## Image');
  
  // Determine if capture is needed
  // Newsletters and shop pages should have images
  const isNewsletter = category.includes('news') || fileName.includes('kdu');
  const isShopPage = category.includes('shop');
  const needsCapture = (isNewsletter || isShopPage) && imageUrls.length === 0;
  
  return {
    filePath,
    fileName,
    category,
    sourceUrl,
    title,
    hasImages: hasImagesSection || imageUrls.length > 0,
    imageUrls,
    needsCapture,
  };
}

/**
 * Generate backfill manifest
 */
function generateManifest(): BackfillManifest {
  const pages = scanScrapedContent();
  
  // Load existing manifest to preserve status
  const existingManifest = loadManifest();
  const existingStatus = new Map(
    existingManifest?.pages.map(p => [p.filePath, p]) || []
  );
  
  const backfillPages: BackfillPage[] = pages
    .filter(p => p.sourceUrl) // Only pages with known URLs
    .map(p => {
      const existing = existingStatus.get(p.filePath);
      const id = p.fileName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      
      // Determine priority
      let priority: 'high' | 'medium' | 'low' = 'medium';
      if (p.category.includes('news')) priority = 'high';
      if (p.category.includes('shop')) priority = 'medium';
      if (p.category.includes('guides')) priority = 'low';
      
      // Determine image types expected
      const imageTypes: string[] = [];
      if (p.category.includes('news')) {
        imageTypes.push('banner', 'content-images', 'community-spotlight');
      }
      if (p.category.includes('shop')) {
        imageTypes.push('product-hero', 'gallery');
      }
      
      return {
        id,
        filePath: p.filePath,
        sourceUrl: p.sourceUrl!,
        title: p.title || p.fileName,
        category: p.category,
        priority,
        imageTypes,
        status: existing?.status || (p.hasImages ? 'captured' : 'pending'),
        capturedAt: existing?.capturedAt,
        imageCount: existing?.imageCount || p.imageUrls.length,
      };
    });
  
  // Sort by priority
  backfillPages.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    totalPages: backfillPages.length,
    pagesNeedingCapture: backfillPages.filter(p => p.status === 'pending').length,
    capturedPages: backfillPages.filter(p => p.status === 'captured').length,
    pages: backfillPages,
  };
}

/**
 * Load existing manifest
 */
function loadManifest(): BackfillManifest | null {
  const manifestPath = path.join(BACKFILL_PATH, 'backfill-manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Save manifest
 */
function saveManifest(manifest: BackfillManifest): void {
  if (!fs.existsSync(BACKFILL_PATH)) {
    fs.mkdirSync(BACKFILL_PATH, { recursive: true });
  }
  
  const manifestPath = path.join(BACKFILL_PATH, 'backfill-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Generate browser capture tasks
 */
function generateCaptureTasks(manifest: BackfillManifest): string {
  const pending = manifest.pages.filter(p => p.status === 'pending');
  
  let tasks = `# Image Backfill Tasks
Generated: ${new Date().toISOString()}
Total Pending: ${pending.length}

---

## High Priority (Newsletters)

${pending.filter(p => p.priority === 'high').map(p => `
### ${p.title}
- **URL:** ${p.sourceUrl}
- **File:** ${p.filePath}
- **Expected:** ${p.imageTypes.join(', ')}

\`\`\`
// Navigate to page
mcp_cursor-ide-browser_browser_navigate({ url: "${p.sourceUrl}" })

// Take full page screenshot
mcp_cursor-ide-browser_browser_take_screenshot({ 
  fullPage: true, 
  filename: "${p.id}-full.png" 
})

// After capture, mark as done:
// Edit backfill-manifest.json and set status: "captured"
\`\`\`
`).join('\n')}

---

## Medium Priority (Shop Pages)

${pending.filter(p => p.priority === 'medium').map(p => `
### ${p.title}
- **URL:** ${p.sourceUrl}
- **File:** ${p.filePath}

\`\`\`
mcp_cursor-ide-browser_browser_navigate({ url: "${p.sourceUrl}" })
mcp_cursor-ide-browser_browser_take_screenshot({ fullPage: true, filename: "${p.id}-full.png" })
\`\`\`
`).join('\n')}

---

## Low Priority (Guides & Other)

${pending.filter(p => p.priority === 'low').map(p => `
### ${p.title}
- **URL:** ${p.sourceUrl}
`).join('\n')}
`;

  return tasks;
}

/**
 * Mark a page as captured
 */
function markCaptured(pageId: string, imageCount: number = 0): void {
  const manifest = loadManifest();
  if (!manifest) {
    log('red', 'No manifest found. Run "manifest" first.');
    return;
  }
  
  const page = manifest.pages.find(p => p.id === pageId);
  if (!page) {
    log('red', `Page not found: ${pageId}`);
    return;
  }
  
  page.status = 'captured';
  page.capturedAt = new Date().toISOString();
  page.imageCount = imageCount;
  
  manifest.capturedPages = manifest.pages.filter(p => p.status === 'captured').length;
  manifest.pagesNeedingCapture = manifest.pages.filter(p => p.status === 'pending').length;
  
  saveManifest(manifest);
  log('green', `✓ Marked as captured: ${page.title}`);
}

/**
 * Show backfill status
 */
function showStatus(): void {
  const manifest = loadManifest();
  
  log('cyan', '\n═══════════════════════════════════════════');
  log('cyan', '  Image Backfill Status');
  log('cyan', '═══════════════════════════════════════════\n');
  
  if (!manifest) {
    log('yellow', 'No manifest found. Run "manifest" to generate one.');
    return;
  }
  
  log('blue', `Last Updated: ${manifest.generatedAt}`);
  log('cyan', `\nTotal Pages: ${manifest.totalPages}`);
  log('green', `Captured: ${manifest.capturedPages}`);
  log('yellow', `Pending: ${manifest.pagesNeedingCapture}`);
  
  const progress = (manifest.capturedPages / manifest.totalPages * 100).toFixed(1);
  log('blue', `\nProgress: ${progress}%`);
  
  // Show pending by priority
  const pending = manifest.pages.filter(p => p.status === 'pending');
  const byPriority = {
    high: pending.filter(p => p.priority === 'high'),
    medium: pending.filter(p => p.priority === 'medium'),
    low: pending.filter(p => p.priority === 'low'),
  };
  
  log('blue', '\nPending by Priority:');
  log('red', `  High: ${byPriority.high.length}`);
  log('yellow', `  Medium: ${byPriority.medium.length}`);
  log('dim', `  Low: ${byPriority.low.length}`);
  
  // Show next 5 to capture
  if (pending.length > 0) {
    log('blue', '\nNext to Capture:');
    pending.slice(0, 5).forEach((p, i) => {
      log('dim', `  ${i + 1}. [${p.priority}] ${p.title}`);
    });
  }
}

/**
 * Main
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';
  
  switch (command) {
    case 'scan':
      log('blue', '\n📂 Scanning scraped content...\n');
      const pages = scanScrapedContent();
      log('cyan', `Found ${pages.length} scraped pages`);
      log('yellow', `Pages needing capture: ${pages.filter(p => p.needsCapture).length}`);
      log('green', `Pages with images: ${pages.filter(p => p.hasImages).length}`);
      break;
      
    case 'manifest':
      log('blue', '\n📋 Generating backfill manifest...\n');
      const manifest = generateManifest();
      saveManifest(manifest);
      log('green', `✓ Manifest saved with ${manifest.totalPages} pages`);
      log('yellow', `  Pending capture: ${manifest.pagesNeedingCapture}`);
      
      // Generate tasks file
      const tasks = generateCaptureTasks(manifest);
      const tasksPath = path.join(BACKFILL_PATH, 'capture-tasks.md');
      fs.writeFileSync(tasksPath, tasks, 'utf-8');
      log('green', `✓ Capture tasks saved: ${tasksPath}`);
      break;
      
    case 'mark':
      const pageId = args[1];
      const count = parseInt(args[2] || '0', 10);
      if (!pageId) {
        log('red', 'Usage: backfill-images.ts mark <page-id> [image-count]');
        return;
      }
      markCaptured(pageId, count);
      break;
      
    case 'status':
    default:
      showStatus();
      break;
  }
}

main().catch(console.error);

