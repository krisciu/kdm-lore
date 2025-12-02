#!/usr/bin/env npx ts-node
/**
 * Fast Post ID Discovery
 * Uses HTTP requests to follow "Previous" links and discover all post IDs
 */

import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'docs', 'lore', 'sources', 'kickstarter');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'all-post-ids.txt');

// Known post IDs (newest first)
const KNOWN_IDS = [
  '4550627', '4528510', '4498770', '4471289', '4423166',
  '4398287', '4374406', '4327928', '4324893', '4303789',
  '4281544', '4257269', '4240089', '4211226', '4184460',
  '4140735', '4140665', '4115109', '4089074', '4039944',
  '4039851', '4017975'
];

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(postId: string): Promise<string | null> {
  const url = `https://www.kickstarter.com/projects/poots/kingdom-death-monster-15/posts/${postId}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch (error: any) {
    console.log(`  ⚠ Failed to fetch ${postId}: ${error.message?.slice(0, 40)}`);
    return null;
  }
}

function findPreviousPostId(html: string): string | null {
  // Look for Previous link pattern
  const patterns = [
    /href="\/projects\/poots\/kingdom-death-monster-15\/posts\/(\d+)"[^>]*>[\s\S]*?Previous/i,
    /Previous[\s\S]*?href="\/projects\/poots\/kingdom-death-monster-15\/posts\/(\d+)"/i,
    /posts\/(\d+)"[^>]*>\s*<[^>]*>[\s\S]*?Previous/i,
    /data-href="\/projects\/poots\/kingdom-death-monster-15\/posts\/(\d+)"[\s\S]*?Previous/i,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  // Fallback: look for any posts link before "Previous" text
  const prevSection = html.split('Previous')[0];
  const lastPostMatch = prevSection?.match(/posts\/(\d+)/g);
  if (lastPostMatch && lastPostMatch.length > 0) {
    const lastId = lastPostMatch[lastPostMatch.length - 1].replace('posts/', '');
    // Make sure it's not the current post
    if (!KNOWN_IDS.includes(lastId)) {
      return lastId;
    }
  }
  
  return null;
}

async function discoverAllPosts(): Promise<string[]> {
  console.log('\n🔍 Discovering all Kickstarter post IDs\n');
  
  const allIds = [...KNOWN_IDS];
  let currentId = KNOWN_IDS[KNOWN_IDS.length - 1]; // Start from oldest known
  
  console.log(`Starting from post ${currentId}...\n`);
  
  let consecutiveFailures = 0;
  const maxFailures = 3;
  
  while (consecutiveFailures < maxFailures) {
    process.stdout.write(`  Checking ${currentId}... `);
    
    const html = await fetchPage(currentId);
    
    if (!html) {
      consecutiveFailures++;
      console.log('fetch failed');
      await delay(2000);
      continue;
    }
    
    const prevId = findPreviousPostId(html);
    
    if (prevId && !allIds.includes(prevId)) {
      allIds.push(prevId);
      currentId = prevId;
      consecutiveFailures = 0;
      console.log(`→ found ${prevId} (total: ${allIds.length})`);
    } else if (prevId) {
      console.log(`already have ${prevId}`);
      // Try to find another ID on this page
      const allMatches = html.match(/posts\/(\d+)/g) || [];
      const newIds = allMatches
        .map(m => m.replace('posts/', ''))
        .filter(id => !allIds.includes(id) && id.length > 5);
      
      if (newIds.length > 0) {
        const nextId = newIds[0];
        allIds.push(nextId);
        currentId = nextId;
        console.log(`  → jumping to ${nextId}`);
      } else {
        consecutiveFailures++;
      }
    } else {
      console.log('no previous link found (might be first update)');
      consecutiveFailures++;
    }
    
    await delay(1000); // Rate limiting
  }
  
  console.log(`\n✓ Discovered ${allIds.length} post IDs\n`);
  return allIds;
}

async function main(): Promise<void> {
  const allIds = await discoverAllPosts();
  
  // Save to file
  const content = `# All Kickstarter Post IDs
# Total: ${allIds.length}
# Generated: ${new Date().toISOString()}
# Newest to oldest

${allIds.join('\n')}
`;
  
  fs.writeFileSync(OUTPUT_FILE, content);
  console.log(`✓ Saved to ${OUTPUT_FILE}\n`);
  
  // Show summary
  console.log('═══════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════');
  console.log(`  Total post IDs: ${allIds.length}`);
  console.log(`  Newest: ${allIds[0]}`);
  console.log(`  Oldest: ${allIds[allIds.length - 1]}`);
}

main().catch(console.error);

