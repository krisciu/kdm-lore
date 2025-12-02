/**
 * Cron Job - Automated Agent Runner
 * 
 * This endpoint is called by Vercel Cron every hour to run the research agent.
 * Schedule: "0 * * * *" (every hour at minute 0)
 * 
 * Security: Vercel automatically adds CRON_SECRET to verify cron requests.
 * In development, you can call this manually for testing.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadState,
  loadConfig,
  updateState,
  startRun,
  completeRun,
  getNextEntityToProcess,
  getNextReviewEntry,
  shouldRunScan,
  recordScanComplete,
  addToReviewQueue,
} from '@/lib/agent-core';
import { runDiscovery } from '@/lib/entity-discovery';
import { generateEntryForEntity } from '@/lib/entry-generator';
import { scanAllEntries, calculateReviewPriority, ScannedEntry } from '@/lib/entry-scanner';
import { processReviewEntry } from '@/lib/entry-reviewer';

export const runtime = 'nodejs';
export const maxDuration = 60; // Maximum allowed for Vercel Pro

/**
 * GET /api/cron/agent
 * Called by Vercel Cron on schedule
 */
export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // In production, verify the request is from Vercel Cron
  if (process.env.NODE_ENV === 'production' && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log('[Cron] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Check if API key is configured
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('[Cron] No ANTHROPIC_API_KEY configured');
    return NextResponse.json({ 
      error: 'No API key configured',
      message: 'Set ANTHROPIC_API_KEY in environment variables'
    }, { status: 400 });
  }

  // Check agent state
  const state = await loadState();
  
  // Don't run if paused or already running
  if (state.status === 'paused') {
    console.log('[Cron] Agent is paused, skipping');
    return NextResponse.json({ 
      skipped: true, 
      reason: 'Agent is paused' 
    });
  }
  
  if (state.status === 'running') {
    console.log('[Cron] Agent is already running, skipping');
    return NextResponse.json({ 
      skipped: true, 
      reason: 'Agent is already running' 
    });
  }

  // Start the run
  console.log('[Cron] Starting automated agent run...');
  const config = await loadConfig();
  const runLog = await startRun();
  let entriesProcessed = 0;

  try {
    // Stage 0: Check if scan needed (every 24 hours)
    const needsScan = await shouldRunScan();
    if (needsScan) {
      console.log('[Cron] Running quality scan...');
      await updateState({ currentTask: 'Scanning existing entries...' });
      const scanResult = scanAllEntries();
      
      // Add entries with issues to review queue
      let addedToQueue = 0;
      for (const entry of scanResult.entries) {
        if (entry.issues.length > 0 && entry.score < 80) {
          await addToReviewQueue({
            filePath: entry.filePath,
            entryName: entry.entryName,
            category: entry.category,
            issues: entry.issues,
            priority: calculateReviewPriority(entry),
            score: entry.score,
          });
          addedToQueue++;
        }
      }
      
      await recordScanComplete();
      console.log(`[Cron] Scan complete: ${scanResult.totalScanned} scanned, ${addedToQueue} added to review queue`);
    }

    // Stage 1: Discovery
    console.log('[Cron] Running entity discovery...');
    await updateState({ currentTask: 'Discovering entities from sources...' });
    const discoveryResult = await runDiscovery({
      useAI: true,
      apiKey,
      maxSources: 10,
    });
    runLog.discovered = discoveryResult.newEntities;
    console.log(`[Cron] Discovered ${discoveryResult.newEntities} new entities`);

    // Stage 2: Process mix of new entries and reviews
    const maxEntries = config.schedule.maxEntriesPerRun;
    const newEntryQuota = Math.ceil(maxEntries * 0.7);
    const reviewQuota = Math.floor(maxEntries * 0.3);

    // Generate new entries
    console.log('[Cron] Generating new lore entries...');
    await updateState({ currentTask: 'Generating new lore entries...' });
    for (let i = 0; i < newEntryQuota && entriesProcessed < maxEntries; i++) {
      const entity = await getNextEntityToProcess();
      if (!entity) {
        console.log('[Cron] No more entities to process');
        break;
      }

      console.log(`[Cron] Generating entry for: ${entity.name}`);
      await updateState({ currentTask: `Generating entry for ${entity.name}...` });
      
      const entry = await generateEntryForEntity(entity, apiKey, {
        analyzeImages: false,
      });

      if (entry) {
        runLog.generated++;
        entriesProcessed++;
      }

      await new Promise(resolve => setTimeout(resolve, config.schedule.apiDelayMs));
    }

    // Review existing entries
    console.log('[Cron] Reviewing existing entries...');
    await updateState({ currentTask: 'Reviewing existing entries...' });
    for (let i = 0; i < reviewQuota && entriesProcessed < maxEntries; i++) {
      const reviewEntry = await getNextReviewEntry();
      if (!reviewEntry) {
        console.log('[Cron] No more entries to review');
        break;
      }

      console.log(`[Cron] Reviewing: ${reviewEntry.entryName}`);
      await updateState({ currentTask: `Reviewing ${reviewEntry.entryName}...` });
      
      const scannedEntry: ScannedEntry = {
        filePath: reviewEntry.filePath,
        fileName: reviewEntry.filePath.split('/').pop() || '',
        entryName: reviewEntry.entryName,
        category: reviewEntry.category,
        issues: reviewEntry.issues.map(issue => ({
          ...issue,
          type: issue.type as ScannedEntry['issues'][0]['type'],
        })),
        score: reviewEntry.score,
        lastScanned: new Date().toISOString(),
      };
      
      const result = await processReviewEntry(reviewEntry, scannedEntry);

      if (result) {
        runLog.reviewed++;
        entriesProcessed++;
      }

      await new Promise(resolve => setTimeout(resolve, config.schedule.apiDelayMs));
    }

    // Complete the run
    await completeRun(runLog, runLog.errors.length > 0 ? 'partial' : 'success');

    console.log(`[Cron] Run complete: discovered=${runLog.discovered}, generated=${runLog.generated}, reviewed=${runLog.reviewed}`);

    return NextResponse.json({
      success: true,
      discovered: runLog.discovered,
      generated: runLog.generated,
      reviewed: runLog.reviewed,
      duration: Date.now() - new Date(runLog.startedAt).getTime(),
    });

  } catch (error) {
    console.error('[Cron] Error during run:', error);
    runLog.errors.push(String(error));
    await completeRun(runLog, 'failed');
    
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}

