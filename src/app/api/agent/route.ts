/**
 * Agent Control API
 * Manages the autonomous research agent
 * 
 * Works in both local (file storage) and production (Vercel KV) environments
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAgentStatus,
  loadState,
  loadConfig,
  saveConfig,
  updateState,
  pauseAgent,
  resumeAgent,
  startRun,
  completeRun,
  loadDiscoveryQueue,
  loadPendingEntries,
  updatePendingEntryStatus,
  getNextEntityToProcess,
  loadReviewQueue,
  addToReviewQueue,
  getNextReviewEntry,
  getReviewQueueStats,
  shouldRunScan,
  recordScanComplete,
  AgentConfig,
} from '@/lib/agent-core';
import { runDiscovery, getDiscoveryStats } from '@/lib/entity-discovery';
import { generateEntryForEntity, saveApprovedEntry } from '@/lib/entry-generator';
import { getImageStats } from '@/lib/image-analyzer';
import { getCitationStats } from '@/lib/citation-manager';
import { scanAllEntries, scanEntry, calculateReviewPriority, ScannedEntry } from '@/lib/entry-scanner';
import { processReviewEntry, saveApprovedReview } from '@/lib/entry-reviewer';

// Helper for consistent error responses
function errorResponse(message: string, status = 500, details?: string) {
  return NextResponse.json(
    { success: false, error: message, details },
    { status }
  );
}

// Safe wrapper for async operations that might fail
async function safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error('Safe call failed:', error);
    return fallback;
  }
}

// Safe wrapper for sync operations that might fail  
function safeCallSync<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (error) {
    console.error('Safe call sync failed:', error);
    return fallback;
  }
}

/**
 * GET /api/agent
 * Get agent status and data
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';

  try {
    switch (action) {
      case 'status': {
        const status = await safeCall(getAgentStatus, {
          state: { status: 'idle', lastRun: null, nextRun: null, lastScan: null, lastHealthCheck: null, currentTask: null, currentTaskType: null, error: null, healthScore: 100, stats: { totalRuns: 0, entitiesDiscovered: 0, entriesGenerated: 0, entriesApproved: 0, entriesRejected: 0, entriesReviewed: 0, entriesFixed: 0, entriesExpanded: 0 }, history: [] },
          config: { schedule: { intervalMinutes: 60, maxEntriesPerRun: 25, maxRunTimeMinutes: 30, maxTokenBudget: 100000, apiDelayMs: 1500, staleThresholdDays: 30, priorityWeights: { fix_broken: 10, review_quality: 5, expand_basic: 3, update_stale: 2, generate_new: 1 } }, ai: { model: 'claude-opus-4-5-20251101', maxTokens: 16000, temperature: 0.7 }, sources: { priority: ['shop', 'rulebook', 'newsletter', 'community'], imageDirectories: [] } },
          queue: { discovered: 0, queued: 0, generating: 0, pendingReview: 0 },
          reviewQueue: { total: 0, queued: 0, reviewing: 0 },
          storageMode: 'file' as const,
        });
        return NextResponse.json(status);
      }

      case 'full_status': {
        const status = await safeCall(getAgentStatus, null);
        const discovery = safeCallSync(getDiscoveryStats, { totalSources: 0, byType: {}, recentSources: [] });
        const images = await safeCall(getImageStats, { totalImages: 0, byType: {}, byDirectory: {}, indexedEntities: 0 });
        const citations = safeCallSync(getCitationStats, { totalCitations: 0, byType: {}, byQuality: {}, recentTopics: [] });
        
        return NextResponse.json({
          ...status,
          discovery,
          images,
          citations,
        });
      }

      case 'queue': {
        const queue = await safeCall(loadDiscoveryQueue, []);
        return NextResponse.json({ 
          entities: queue,
          total: queue.length,
          byStatus: {
            queued: queue.filter(e => e.status === 'queued').length,
            generating: queue.filter(e => e.status === 'generating').length,
            pending_review: queue.filter(e => e.status === 'pending_review').length,
          },
        });
      }

      case 'pending': {
        const entries = await safeCall(loadPendingEntries, []);
        const pending = entries.filter(e => e.status === 'pending');
        return NextResponse.json({ 
          entries: pending,
          total: pending.length,
        });
      }

      case 'history': {
        const state = await safeCall(loadState, { history: [], stats: { totalRuns: 0, entitiesDiscovered: 0, entriesGenerated: 0, entriesApproved: 0, entriesRejected: 0, entriesReviewed: 0, entriesFixed: 0, entriesExpanded: 0 }, status: 'idle', lastRun: null, nextRun: null, lastScan: null, lastHealthCheck: null, currentTask: null, currentTaskType: null, error: null, healthScore: 100 });
        return NextResponse.json({ 
          runs: state.history || [],
          stats: state.stats || {},
        });
      }

      case 'review-queue': {
        const queue = await safeCall(loadReviewQueue, []);
        const stats = await safeCall(getReviewQueueStats, { total: 0, queued: 0, reviewing: 0, completed: 0, byCategory: {}, byIssueType: {} });
        return NextResponse.json({ 
          entries: queue.filter(e => e.status === 'queued' || e.status === 'reviewing'),
          stats,
        });
      }

      case 'scan-status': {
        const state = await safeCall(loadState, { lastScan: null, lastHealthCheck: null, status: 'idle', lastRun: null, nextRun: null, currentTask: null, currentTaskType: null, error: null, healthScore: 100, stats: { totalRuns: 0, entitiesDiscovered: 0, entriesGenerated: 0, entriesApproved: 0, entriesRejected: 0, entriesReviewed: 0, entriesFixed: 0, entriesExpanded: 0 }, history: [] });
        const needsScan = await shouldRunScan();
        const reviewStats = await safeCall(getReviewQueueStats, { total: 0, queued: 0, reviewing: 0, completed: 0, byCategory: {}, byIssueType: {} });
        return NextResponse.json({
          lastScan: state.lastScan,
          needsScan,
          reviewStats,
        });
      }

      case 'config': {
        const config = await safeCall(loadConfig, { schedule: { intervalMinutes: 60, maxEntriesPerRun: 25, maxRunTimeMinutes: 30, maxTokenBudget: 100000, apiDelayMs: 1500, staleThresholdDays: 30, priorityWeights: { fix_broken: 10, review_quality: 5, expand_basic: 3, update_stale: 2, generate_new: 1 } }, ai: { model: 'claude-opus-4-5-20251101', maxTokens: 16000, temperature: 0.7 }, sources: { priority: ['shop', 'rulebook', 'newsletter', 'community'], imageDirectories: [] } });
        return NextResponse.json(config);
      }

      case 'preview': {
        const entryId = searchParams.get('entryId');
        if (!entryId) {
          return errorResponse('Entry ID required', 400);
        }

        const entries = await safeCall(loadPendingEntries, []);
        const entry = entries.find(e => e.id === entryId);

        if (!entry) {
          return errorResponse('Entry not found', 404);
        }

        return NextResponse.json({ success: true, entry });
      }

      default:
        return errorResponse('Unknown action', 400);
    }
  } catch (error) {
    console.error('Agent API error:', error);
    return errorResponse('Failed to process request', 500, String(error));
  }
}

/**
 * POST /api/agent
 * Control agent operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Get API key from environment
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;

    switch (action) {
      case 'run': {
        // Run a full agent cycle
        if (!apiKey) {
          return NextResponse.json({
            error: 'No API key configured',
            message: 'Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your environment',
          }, { status: 400 });
        }

        const state = await loadState();
        if (state.status === 'running') {
          return NextResponse.json({
            error: 'Agent is already running',
          }, { status: 400 });
        }

        const config = await loadConfig();
        const runLog = await startRun();
        let entriesProcessed = 0;

        try {
          // Stage 0: Check if scan needed
          const needsScan = await shouldRunScan();
          if (needsScan) {
            await updateState({ currentTask: 'Scanning existing entries for quality issues...' });
            const scanResult = scanAllEntries();
            
            // Add entries with issues to review queue
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
              }
            }
            
            await recordScanComplete();
          }

          // Stage 1: Discovery
          await updateState({ currentTask: 'Discovering entities from sources...' });
          const discoveryResult = await runDiscovery({
            useAI: true,
            apiKey,
            maxSources: 15,
          });
          runLog.discovered = discoveryResult.newEntities;

          // Stage 2: Process mix of new entries and reviews
          const maxEntries = config.schedule.maxEntriesPerRun;
          
          // Split between new generation and reviews (70% new, 30% reviews)
          const newEntryQuota = Math.ceil(maxEntries * 0.7);
          const reviewQuota = Math.floor(maxEntries * 0.3);

          // Generate new entries
          await updateState({ currentTask: 'Generating new lore entries...' });
          for (let i = 0; i < newEntryQuota && entriesProcessed < maxEntries; i++) {
            const entity = await getNextEntityToProcess();
            if (!entity) break;

            await updateState({ currentTask: `Generating entry for ${entity.name}... (${entriesProcessed + 1}/${maxEntries})` });
            
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
          await updateState({ currentTask: 'Reviewing existing entries...' });
          for (let i = 0; i < reviewQuota && entriesProcessed < maxEntries; i++) {
            const reviewEntry = await getNextReviewEntry();
            if (!reviewEntry) break;

            await updateState({ currentTask: `Reviewing ${reviewEntry.entryName}... (${entriesProcessed + 1}/${maxEntries})` });
            
            // Create a scanned entry from the review queue entry
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

          await completeRun(runLog, runLog.errors.length > 0 ? 'partial' : 'success');

          return NextResponse.json({
            success: true,
            discovered: runLog.discovered,
            generated: runLog.generated,
            reviewed: runLog.reviewed,
            duration: Date.now() - new Date(runLog.startedAt).getTime(),
          });

        } catch (error) {
          runLog.errors.push(String(error));
          await completeRun(runLog, 'failed');
          throw error;
        }
      }

      case 'discover': {
        // Run discovery only
        if (!apiKey) {
          return NextResponse.json({
            error: 'No API key configured',
          }, { status: 400 });
        }

        await updateState({ 
          status: 'running', 
          currentTask: 'Running discovery...' 
        });

        try {
          const result = await runDiscovery({
            useAI: true,
            apiKey,
            maxSources: body.maxSources || 20,
          });

          await updateState({ status: 'idle', currentTask: null });

          return NextResponse.json({
            success: true,
            sourcesScanned: result.sourcesScanned,
            entitiesFound: result.entitiesFound,
            newEntities: result.newEntities,
          });
        } catch (error) {
          await updateState({ status: 'error', error: String(error) });
          throw error;
        }
      }

      case 'generate': {
        // Generate entry for a specific entity
        if (!apiKey) {
          return NextResponse.json({
            error: 'No API key configured',
          }, { status: 400 });
        }

        const { entityId } = body;
        const queue = await loadDiscoveryQueue();
        const entity = entityId 
          ? queue.find(e => e.id === entityId)
          : await getNextEntityToProcess();

        if (!entity) {
          return NextResponse.json({
            error: 'No entity found to process',
          }, { status: 404 });
        }

        await updateState({ 
          status: 'running', 
          currentTask: `Generating entry for ${entity.name}...` 
        });

        try {
          const entry = await generateEntryForEntity(entity, apiKey, {
            analyzeImages: body.analyzeImages || false,
          });

          await updateState({ status: 'idle', currentTask: null });

          if (entry) {
            return NextResponse.json({
              success: true,
              entry: {
                id: entry.id,
                entityName: entry.entityName,
                confidence: entry.confidence,
                sourceCount: entry.sourceFiles.length,
                imageCount: entry.images.length,
              },
            });
          } else {
            return NextResponse.json({
              success: false,
              error: 'Failed to generate entry',
            });
          }
        } catch (error) {
          await updateState({ status: 'error', error: String(error) });
          throw error;
        }
      }

      case 'reject': {
        const { entryId, reason } = body;
        if (!entryId) {
          return NextResponse.json({ error: 'Entry ID required' }, { status: 400 });
        }

        await updatePendingEntryStatus(entryId, 'rejected', reason);

        // Update stats
        const state = await loadState();
        state.stats.entriesRejected++;
        await updateState({ stats: state.stats });

        return NextResponse.json({ success: true });
      }

      case 'pause': {
        await pauseAgent();
        return NextResponse.json({ success: true, status: 'paused' });
      }

      case 'resume': {
        await resumeAgent();
        return NextResponse.json({ success: true, status: 'idle' });
      }

      case 'configure': {
        const { config } = body;
        if (!config) {
          return NextResponse.json({ error: 'Config required' }, { status: 400 });
        }

        const currentConfig = await loadConfig();
        const newConfig: AgentConfig = {
          ...currentConfig,
          ...config,
          schedule: { ...currentConfig.schedule, ...config.schedule },
          ai: { ...currentConfig.ai, ...config.ai },
          sources: { ...currentConfig.sources, ...config.sources },
        };

        await saveConfig(newConfig);
        return NextResponse.json({ success: true, config: newConfig });
      }

      case 'scan': {
        // Force a scan of existing entries
        await updateState({ 
          status: 'running', 
          currentTask: 'Scanning existing entries...' 
        });

        try {
          const scanResult = scanAllEntries();
          let addedToQueue = 0;

          // Add entries with issues to review queue
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
          await updateState({ status: 'idle', currentTask: null });

          return NextResponse.json({
            success: true,
            totalScanned: scanResult.totalScanned,
            entriesWithIssues: scanResult.entriesWithIssues,
            addedToQueue,
            issuesByType: scanResult.issuesByType,
            duration: scanResult.scanDuration,
          });
        } catch (error) {
          await updateState({ status: 'error', error: String(error) });
          throw error;
        }
      }

      case 'review': {
        // Review a specific entry
        if (!apiKey) {
          return NextResponse.json({
            error: 'No API key configured',
          }, { status: 400 });
        }

        const { entryPath } = body;
        if (!entryPath) {
          return NextResponse.json({ error: 'Entry path required' }, { status: 400 });
        }

        await updateState({ 
          status: 'running', 
          currentTask: `Reviewing entry...` 
        });

        try {
          // Scan the entry first
          const scannedEntry = scanEntry(entryPath);
          
          if (scannedEntry.issues.length === 0) {
            await updateState({ status: 'idle', currentTask: null });
            return NextResponse.json({
              success: true,
              message: 'Entry has no issues to review',
              score: scannedEntry.score,
            });
          }

          // Add to review queue
          const reviewEntry = await addToReviewQueue({
            filePath: scannedEntry.filePath,
            entryName: scannedEntry.entryName,
            category: scannedEntry.category,
            issues: scannedEntry.issues,
            priority: calculateReviewPriority(scannedEntry),
            score: scannedEntry.score,
          });

          // Process the review
          const result = await processReviewEntry(reviewEntry, scannedEntry);

          await updateState({ status: 'idle', currentTask: null });

          if (result) {
            return NextResponse.json({
              success: true,
              pendingEntryId: result.id,
              issues: scannedEntry.issues.length,
              changes: result.frontmatter.changes,
            });
          } else {
            return NextResponse.json({
              success: false,
              error: 'Failed to generate review',
            });
          }
        } catch (error) {
          await updateState({ status: 'error', error: String(error) });
          throw error;
        }
      }

      case 'approve': {
        const { entryId } = body;
        if (!entryId) {
          return NextResponse.json({ error: 'Entry ID required' }, { status: 400 });
        }

        const entries = await loadPendingEntries();
        const entry = entries.find(e => e.id === entryId);

        if (!entry) {
          return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
        }

        // Check if this is a review (has originalPath) or new entry
        const isReview = entry.frontmatter.reviewType === 'improvement';
        let saveResult;

        if (isReview) {
          // Save as update to existing file
          const saved = await saveApprovedReview(entry);
          saveResult = {
            success: saved,
            path: entry.frontmatter.originalPath as string,
            error: saved ? undefined : 'Failed to save review',
          };
        } else {
          // Save as new entry
          saveResult = await saveApprovedEntry(entry);
        }

        if (saveResult.success) {
          await updatePendingEntryStatus(entryId, 'approved');

          const state = await loadState();
          state.stats.entriesApproved++;
          if (isReview) {
            state.stats.entriesReviewed++;
          }
          await updateState({ stats: state.stats });

          return NextResponse.json({
            success: true,
            path: saveResult.path,
            type: isReview ? 'review' : 'new',
          });
        } else {
          return NextResponse.json({
            success: false,
            error: saveResult.error,
          }, { status: 500 });
        }
      }

      case 'bulk-fix': {
        // Bulk fix broken links and malformed YAML across all entries
        const { dryRun = true, fixLinks = true, fixYAML = true } = body;
        
        await updateState({ 
          status: 'running', 
          currentTask: dryRun ? 'Previewing bulk fixes...' : 'Applying bulk fixes...'
        });

        try {
          // Import fixers dynamically to avoid circular deps
          const { fixAllLinks, generateValidationReport } = await import('@/lib/link-fixer');
          const { fixAllFrontmatter, generateFrontmatterReport } = await import('@/lib/frontmatter-fixer');
          
          const results: {
            links?: { filesFixed: number; linksFixed: number; report?: unknown };
            yaml?: { filesFixed: number; issuesFixed: number; report?: unknown };
          } = {};
          
          if (fixLinks) {
            if (dryRun) {
              const report = generateValidationReport();
              results.links = {
                filesFixed: 0,
                linksFixed: 0,
                report: {
                  filesWithIssues: report.filesWithIssues,
                  totalBrokenLinks: report.totalBrokenLinks,
                  byType: report.byType,
                },
              };
            } else {
              const linkResult = fixAllLinks();
              results.links = {
                filesFixed: linkResult.filesFixed,
                linksFixed: linkResult.linksFixed,
              };
            }
          }
          
          if (fixYAML) {
            if (dryRun) {
              const report = generateFrontmatterReport();
              results.yaml = {
                filesFixed: 0,
                issuesFixed: 0,
                report: {
                  filesWithIssues: report.filesWithIssues,
                  totalIssues: report.totalIssues,
                  byType: report.byType,
                },
              };
            } else {
              const yamlResult = fixAllFrontmatter();
              results.yaml = {
                filesFixed: yamlResult.filesFixed,
                issuesFixed: yamlResult.issuesFixed,
              };
            }
          }
          
          await updateState({ status: 'idle', currentTask: null });
          
          // Update stats if we actually fixed things
          if (!dryRun) {
            const state = await loadState();
            const totalFixed = (results.links?.filesFixed || 0) + (results.yaml?.filesFixed || 0);
            state.stats.entriesFixed = (state.stats.entriesFixed || 0) + totalFixed;
            await updateState({ stats: state.stats });
          }
          
          return NextResponse.json({
            success: true,
            dryRun,
            results,
          });
        } catch (error) {
          await updateState({ status: 'error', error: String(error) });
          throw error;
        }
      }

      case 'scheduler-stats': {
        // Get task scheduler statistics
        const { getSchedulerStats, analyzeCompendiumHealth } = await import('@/lib/task-scheduler');
        
        const health = await analyzeCompendiumHealth();
        const stats = await getSchedulerStats();
        
        return NextResponse.json({
          success: true,
          health,
          pendingTasks: stats.pendingTasks,
          nextBatch: {
            taskCount: stats.nextBatch.tasks.length,
            estimatedTokens: stats.nextBatch.totalEstimatedTokens,
            taskCounts: stats.nextBatch.taskCounts,
          },
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: String(error) },
      { status: 500 }
    );
  }
}
