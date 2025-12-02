#!/usr/bin/env npx tsx
/**
 * Data Cleanup Script - Prunes old queue items and archives stale data
 * 
 * Run with: npx tsx scripts/cleanup-data.ts
 * 
 * Options:
 *   --dry-run    Preview changes without applying
 *   --archive    Archive removed items to backup files
 *   --aggressive Remove items older than 7 days (default: 30 days)
 */

import fs from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'data');
const ARCHIVE_PATH = path.join(DATA_PATH, 'archive');

interface CleanupResult {
  file: string;
  originalCount: number;
  removedCount: number;
  newCount: number;
  archived: boolean;
}

interface CleanupReport {
  timestamp: string;
  dryRun: boolean;
  results: CleanupResult[];
  totalRemoved: number;
  spaceReclaimed: string;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getFileSizeStr(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function loadJSON<T>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function saveJSON(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// =============================================================================
// CLEANUP FUNCTIONS
// =============================================================================

/**
 * Clean discovery queue - remove completed/rejected entities
 */
function cleanDiscoveryQueue(dryRun: boolean, ageDays: number, archive: boolean): CleanupResult {
  const filePath = path.join(DATA_PATH, 'discovery-queue.json');
  const result: CleanupResult = {
    file: 'discovery-queue.json',
    originalCount: 0,
    removedCount: 0,
    newCount: 0,
    archived: false,
  };
  
  const queue = loadJSON<Array<{ status: string; discoveredAt: string }>>(filePath);
  if (!queue) return result;
  
  result.originalCount = queue.length;
  const cutoffDate = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
  
  const toRemove: typeof queue = [];
  const toKeep: typeof queue = [];
  
  for (const item of queue) {
    const shouldRemove = 
      item.status === 'approved' ||
      item.status === 'rejected' ||
      (item.status === 'pending_review' && new Date(item.discoveredAt) < cutoffDate);
    
    if (shouldRemove) {
      toRemove.push(item);
    } else {
      toKeep.push(item);
    }
  }
  
  result.removedCount = toRemove.length;
  result.newCount = toKeep.length;
  
  if (!dryRun && toRemove.length > 0) {
    if (archive) {
      ensureDir(ARCHIVE_PATH);
      const archivePath = path.join(ARCHIVE_PATH, `discovery-queue-${Date.now()}.json`);
      saveJSON(archivePath, toRemove);
      result.archived = true;
    }
    saveJSON(filePath, toKeep);
  }
  
  return result;
}

/**
 * Clean pending entries - remove approved/rejected entries
 */
function cleanPendingEntries(dryRun: boolean, ageDays: number, archive: boolean): CleanupResult {
  const filePath = path.join(DATA_PATH, 'pending-entries.json');
  const result: CleanupResult = {
    file: 'pending-entries.json',
    originalCount: 0,
    removedCount: 0,
    newCount: 0,
    archived: false,
  };
  
  const entries = loadJSON<Array<{ status: string; createdAt: string }>>(filePath);
  if (!entries) return result;
  
  result.originalCount = entries.length;
  const cutoffDate = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
  
  const toRemove: typeof entries = [];
  const toKeep: typeof entries = [];
  
  for (const entry of entries) {
    const shouldRemove = 
      entry.status === 'approved' ||
      entry.status === 'rejected' ||
      (entry.status === 'pending' && new Date(entry.createdAt) < cutoffDate);
    
    if (shouldRemove) {
      toRemove.push(entry);
    } else {
      toKeep.push(entry);
    }
  }
  
  result.removedCount = toRemove.length;
  result.newCount = toKeep.length;
  
  if (!dryRun && toRemove.length > 0) {
    if (archive) {
      ensureDir(ARCHIVE_PATH);
      const archivePath = path.join(ARCHIVE_PATH, `pending-entries-${Date.now()}.json`);
      saveJSON(archivePath, toRemove);
      result.archived = true;
    }
    saveJSON(filePath, toKeep);
  }
  
  return result;
}

/**
 * Clean review queue - remove completed/skipped entries
 */
function cleanReviewQueue(dryRun: boolean, ageDays: number, archive: boolean): CleanupResult {
  const filePath = path.join(DATA_PATH, 'review-queue.json');
  const result: CleanupResult = {
    file: 'review-queue.json',
    originalCount: 0,
    removedCount: 0,
    newCount: 0,
    archived: false,
  };
  
  const queue = loadJSON<Array<{ status: string; queuedAt: string }>>(filePath);
  if (!queue) return result;
  
  result.originalCount = queue.length;
  const cutoffDate = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
  
  const toRemove: typeof queue = [];
  const toKeep: typeof queue = [];
  
  for (const item of queue) {
    const shouldRemove = 
      item.status === 'completed' ||
      item.status === 'skipped' ||
      (new Date(item.queuedAt) < cutoffDate);
    
    if (shouldRemove) {
      toRemove.push(item);
    } else {
      toKeep.push(item);
    }
  }
  
  result.removedCount = toRemove.length;
  result.newCount = toKeep.length;
  
  if (!dryRun && toRemove.length > 0) {
    if (archive) {
      ensureDir(ARCHIVE_PATH);
      const archivePath = path.join(ARCHIVE_PATH, `review-queue-${Date.now()}.json`);
      saveJSON(archivePath, toRemove);
      result.archived = true;
    }
    saveJSON(filePath, toKeep);
  }
  
  return result;
}

/**
 * Clean agent history - keep only last 20 runs
 */
function cleanAgentHistory(dryRun: boolean, maxRuns: number = 20): CleanupResult {
  const filePath = path.join(DATA_PATH, 'agent-state.json');
  const result: CleanupResult = {
    file: 'agent-state.json (history)',
    originalCount: 0,
    removedCount: 0,
    newCount: 0,
    archived: false,
  };
  
  const state = loadJSON<{ history: unknown[] }>(filePath);
  if (!state || !state.history) return result;
  
  result.originalCount = state.history.length;
  
  if (state.history.length > maxRuns) {
    result.removedCount = state.history.length - maxRuns;
    result.newCount = maxRuns;
    
    if (!dryRun) {
      state.history = state.history.slice(-maxRuns);
      saveJSON(filePath, state);
    }
  } else {
    result.newCount = state.history.length;
  }
  
  return result;
}

/**
 * Remove stale/unused data files
 */
function removeStaleFiles(dryRun: boolean, archive: boolean): CleanupResult[] {
  const results: CleanupResult[] = [];
  
  // Files that are likely unused or redundant
  const staleFiles = [
    'pipeline-state.json',
    'scheduler-state.json',
    'research-queue.json',
    'research-sessions.json',
  ];
  
  for (const fileName of staleFiles) {
    const filePath = path.join(DATA_PATH, fileName);
    
    if (!fs.existsSync(filePath)) continue;
    
    const content = loadJSON<unknown[]>(filePath);
    const count = Array.isArray(content) ? content.length : 1;
    
    const result: CleanupResult = {
      file: fileName,
      originalCount: count,
      removedCount: count,
      newCount: 0,
      archived: false,
    };
    
    if (!dryRun) {
      if (archive) {
        ensureDir(ARCHIVE_PATH);
        const archivePath = path.join(ARCHIVE_PATH, `${fileName}.${Date.now()}`);
        fs.copyFileSync(filePath, archivePath);
        result.archived = true;
      }
      // Don't delete, just empty the file
      saveJSON(filePath, Array.isArray(content) ? [] : {});
    }
    
    results.push(result);
  }
  
  return results;
}

/**
 * Dedupe discovery queue entries
 */
function dedupeDiscoveryQueue(dryRun: boolean): CleanupResult {
  const filePath = path.join(DATA_PATH, 'discovery-queue.json');
  const result: CleanupResult = {
    file: 'discovery-queue.json (dedupe)',
    originalCount: 0,
    removedCount: 0,
    newCount: 0,
    archived: false,
  };
  
  const queue = loadJSON<Array<{ name: string; id: string }>>(filePath);
  if (!queue) return result;
  
  result.originalCount = queue.length;
  
  const seen = new Map<string, typeof queue[0]>();
  for (const item of queue) {
    const key = item.name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  
  const deduped = Array.from(seen.values());
  result.removedCount = queue.length - deduped.length;
  result.newCount = deduped.length;
  
  if (!dryRun && result.removedCount > 0) {
    saveJSON(filePath, deduped);
  }
  
  return result;
}

// =============================================================================
// MAIN
// =============================================================================

function runCleanup(options: {
  dryRun: boolean;
  archive: boolean;
  aggressive: boolean;
}): CleanupReport {
  const { dryRun, archive, aggressive } = options;
  const ageDays = aggressive ? 7 : 30;
  
  console.log('\n🧹 KDM Lore Data Cleanup\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Archive: ${archive ? 'Yes' : 'No'}`);
  console.log(`Age threshold: ${ageDays} days\n`);
  
  const beforeSize = fs.readdirSync(DATA_PATH)
    .filter(f => f.endsWith('.json'))
    .reduce((sum, f) => sum + getFileSize(path.join(DATA_PATH, f)), 0);
  
  const results: CleanupResult[] = [];
  
  // Run cleanup functions
  results.push(cleanDiscoveryQueue(dryRun, ageDays, archive));
  results.push(cleanPendingEntries(dryRun, ageDays, archive));
  results.push(cleanReviewQueue(dryRun, ageDays, archive));
  results.push(cleanAgentHistory(dryRun));
  results.push(dedupeDiscoveryQueue(dryRun));
  results.push(...removeStaleFiles(dryRun, archive));
  
  // Print results
  console.log('Results:');
  console.log('─'.repeat(60));
  
  let totalRemoved = 0;
  for (const result of results) {
    if (result.removedCount > 0) {
      console.log(`${result.file}:`);
      console.log(`  ${result.originalCount} → ${result.newCount} (removed ${result.removedCount})`);
      if (result.archived) {
        console.log(`  ✓ Archived to data/archive/`);
      }
      totalRemoved += result.removedCount;
    }
  }
  
  if (totalRemoved === 0) {
    console.log('Nothing to clean up!');
  }
  
  const afterSize = dryRun ? beforeSize : fs.readdirSync(DATA_PATH)
    .filter(f => f.endsWith('.json'))
    .reduce((sum, f) => sum + getFileSize(path.join(DATA_PATH, f)), 0);
  
  const spaceReclaimed = getFileSizeStr(beforeSize - afterSize);
  
  console.log('\n' + '─'.repeat(60));
  console.log(`Total items removed: ${totalRemoved}`);
  console.log(`Space reclaimed: ${spaceReclaimed}`);
  
  if (dryRun) {
    console.log('\n⚠️  This was a dry run. Run without --dry-run to apply changes.');
  }
  
  return {
    timestamp: new Date().toISOString(),
    dryRun,
    results,
    totalRemoved,
    spaceReclaimed,
  };
}

// Parse CLI args
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  archive: args.includes('--archive'),
  aggressive: args.includes('--aggressive'),
};

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: npx tsx scripts/cleanup-data.ts [options]

Options:
  --dry-run      Preview changes without applying
  --archive      Archive removed items to data/archive/
  --aggressive   Remove items older than 7 days (default: 30 days)
  --help, -h     Show this help message

Examples:
  npx tsx scripts/cleanup-data.ts --dry-run
  npx tsx scripts/cleanup-data.ts --archive
  npx tsx scripts/cleanup-data.ts --aggressive --archive
`);
  process.exit(0);
}

// Run cleanup
runCleanup(options);

