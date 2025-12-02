/**
 * Lore Generation API
 * AI-powered lore entry generation and management
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateEntry,
  scanForEntities,
  approveEntry,
  rejectEntry,
  loadPendingEntries,
  loadEntityQueue,
  getGeneratorStatus,
  getBestSources,
} from '@/lib/lore-generator';
import { isAIConfigured } from '@/lib/ai-service';

/**
 * GET /api/generate
 * Get status, pending entries, or entity queue
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';

  try {
    switch (action) {
      case 'status': {
        const status = getGeneratorStatus();
        return NextResponse.json(status);
      }

      case 'pending': {
        const entries = loadPendingEntries();
        const pending = entries.filter(e => e.status === 'pending');
        return NextResponse.json({ entries: pending, total: pending.length });
      }

      case 'queue': {
        const queue = loadEntityQueue();
        return NextResponse.json({ entities: queue, total: queue.length });
      }

      case 'all': {
        const entries = loadPendingEntries();
        return NextResponse.json({ entries, total: entries.length });
      }

      case 'sources': {
        const entityName = searchParams.get('entity');
        if (!entityName) {
          return NextResponse.json({ error: 'Entity name required' }, { status: 400 });
        }
        const sources = getBestSources(entityName);
        return NextResponse.json({
          entity: entityName,
          sources: sources.map(s => ({
            fileName: s.fileName,
            filePath: s.filePath,
            type: s.type,
            preview: s.content.slice(0, 500) + '...',
          })),
          total: sources.length,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Generate API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/generate
 * Generate entries, approve, reject, or scan for entities
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Check AI configuration for generation actions
    if (['generate', 'scan'].includes(action) && !isAIConfigured()) {
      return NextResponse.json({
        error: 'AI not configured',
        message: 'Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your environment variables.',
        configured: false,
      }, { status: 400 });
    }

    switch (action) {
      case 'generate': {
        const { entityName } = body;
        if (!entityName) {
          return NextResponse.json({ error: 'Entity name required' }, { status: 400 });
        }

        const result = await generateEntry(entityName);
        return NextResponse.json(result);
      }

      case 'scan': {
        const { sourceFile } = body;
        const result = await scanForEntities(sourceFile);
        return NextResponse.json(result);
      }

      case 'approve': {
        const { entryId } = body;
        if (!entryId) {
          return NextResponse.json({ error: 'Entry ID required' }, { status: 400 });
        }

        const result = approveEntry(entryId);
        return NextResponse.json(result);
      }

      case 'reject': {
        const { entryId, reason } = body;
        if (!entryId) {
          return NextResponse.json({ error: 'Entry ID required' }, { status: 400 });
        }

        const success = rejectEntry(entryId, reason);
        return NextResponse.json({ success });
      }

      case 'batch_generate': {
        const { entityNames } = body;
        if (!Array.isArray(entityNames) || entityNames.length === 0) {
          return NextResponse.json({ error: 'Entity names array required' }, { status: 400 });
        }

        const results = [];
        for (const name of entityNames.slice(0, 5)) { // Limit to 5 at a time
          const result = await generateEntry(name);
          results.push({ name, ...result });
        }

        return NextResponse.json({
          success: true,
          results,
          generated: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Generate API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: String(error) },
      { status: 500 }
    );
  }
}

