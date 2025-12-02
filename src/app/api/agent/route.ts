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
  AgentConfig,
} from '@/lib/agent-core';
import { runDiscovery, getDiscoveryStats } from '@/lib/entity-discovery';
import { generateEntryForEntity, saveApprovedEntry } from '@/lib/entry-generator';
import { getImageStats } from '@/lib/image-analyzer';
import { getCitationStats } from '@/lib/citation-manager';

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
          state: { status: 'idle', lastRun: null, nextRun: null, currentTask: null, error: null, stats: { totalRuns: 0, entitiesDiscovered: 0, entriesGenerated: 0, entriesApproved: 0, entriesRejected: 0 }, history: [] },
          config: { schedule: { intervalMinutes: 60, maxEntriesPerRun: 3, apiDelayMs: 2000 }, ai: { model: 'claude-opus-4-5-20251101', maxTokens: 4096, temperature: 0.7 }, sources: { priority: ['shop', 'rulebook', 'newsletter', 'community'], imageDirectories: [] } },
          queue: { discovered: 0, queued: 0, generating: 0, pendingReview: 0 },
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
        const state = await safeCall(loadState, { history: [], stats: { totalRuns: 0, entitiesDiscovered: 0, entriesGenerated: 0, entriesApproved: 0, entriesRejected: 0 }, status: 'idle', lastRun: null, nextRun: null, currentTask: null, error: null });
        return NextResponse.json({ 
          runs: state.history || [],
          stats: state.stats || {},
        });
      }

      case 'config': {
        const config = await safeCall(loadConfig, { schedule: { intervalMinutes: 60, maxEntriesPerRun: 3, apiDelayMs: 2000 }, ai: { model: 'claude-opus-4-5-20251101', maxTokens: 4096, temperature: 0.7 }, sources: { priority: ['shop', 'rulebook', 'newsletter', 'community'], imageDirectories: [] } });
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

        try {
          // Stage 1: Discovery
          await updateState({ currentTask: 'Discovering entities from sources...' });
          const discoveryResult = await runDiscovery({
            useAI: true,
            apiKey,
            maxSources: 10,
          });
          runLog.discovered = discoveryResult.newEntities;

          // Stage 2: Generate entries
          await updateState({ currentTask: 'Generating lore entries...' });
          const entitiesToProcess = Math.min(
            config.schedule.maxEntriesPerRun,
            discoveryResult.newEntities
          );

          for (let i = 0; i < entitiesToProcess; i++) {
            const entity = await getNextEntityToProcess();
            if (!entity) break;

            await updateState({ currentTask: `Generating entry for ${entity.name}...` });
            
            const entry = await generateEntryForEntity(entity, apiKey, {
              analyzeImages: false, // Skip vision for speed
            });

            if (entry) {
              runLog.generated++;
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, config.schedule.apiDelayMs));
          }

          await completeRun(runLog, runLog.errors.length > 0 ? 'partial' : 'success');

          return NextResponse.json({
            success: true,
            discovered: runLog.discovered,
            generated: runLog.generated,
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

        // Save to lore directory
        const saveResult = await saveApprovedEntry(entry);

        if (saveResult.success) {
          // Update entry status
          await updatePendingEntryStatus(entryId, 'approved');

          // Update stats
          const state = await loadState();
          state.stats.entriesApproved++;
          await updateState({ stats: state.stats });

          return NextResponse.json({
            success: true,
            path: saveResult.path,
          });
        } else {
          return NextResponse.json({
            success: false,
            error: saveResult.error,
          }, { status: 500 });
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
