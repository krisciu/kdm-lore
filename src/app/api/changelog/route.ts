/**
 * Changelog API Route
 * Provides endpoints for viewing and managing the lore changelog
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getChangelogEntries,
  getChangelogEntry,
  getChangelogStats,
  getCombinedHistory,
  getAgentActivitySummary,
  approveChangelogEntry,
  rejectChangelogEntry,
  loadChangelogConfig,
  saveChangelogConfig,
  exportChangelogToMarkdown,
} from '@/lib/changelog-service';
import { getGitLog, getCommitDiff, getCommitPatch, getLoreGitStats } from '@/lib/git-service';
import { ChangelogFilter, ChangeType, ChangeSource } from '@/types/changelog';

/**
 * GET /api/changelog
 * Retrieve changelog entries with filtering
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  try {
    switch (action) {
      case 'list': {
        // Build filter from query params
        const filter: ChangelogFilter = {};
        
        const types = searchParams.get('type');
        if (types) {
          filter.type = types.split(',') as ChangeType[];
        }
        
        const sources = searchParams.get('source');
        if (sources) {
          filter.source = sources.split(',') as ChangeSource[];
        }
        
        const status = searchParams.get('status');
        if (status) {
          filter.reviewStatus = status.split(',');
        }
        
        const dateFrom = searchParams.get('dateFrom');
        if (dateFrom) filter.dateFrom = dateFrom;
        
        const dateTo = searchParams.get('dateTo');
        if (dateTo) filter.dateTo = dateTo;
        
        const search = searchParams.get('search');
        if (search) filter.searchTerm = search;
        
        const limit = searchParams.get('limit');
        if (limit) filter.limit = parseInt(limit);
        
        const offset = searchParams.get('offset');
        if (offset) filter.offset = parseInt(offset);

        const entries = getChangelogEntries(filter);
        const stats = getChangelogStats();

        return NextResponse.json({ entries, stats });
      }

      case 'entry': {
        const id = searchParams.get('id');
        if (!id) {
          return NextResponse.json({ error: 'Missing entry ID' }, { status: 400 });
        }
        
        const entry = getChangelogEntry(id);
        if (!entry) {
          return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
        }

        return NextResponse.json({ entry });
      }

      case 'stats': {
        const stats = getChangelogStats();
        const activity = getAgentActivitySummary();
        const gitStats = await getLoreGitStats();
        
        return NextResponse.json({ stats, activity, gitStats });
      }

      case 'activity': {
        const activity = getAgentActivitySummary();
        return NextResponse.json(activity);
      }

      case 'combined': {
        const limit = parseInt(searchParams.get('limit') || '50');
        const combined = await getCombinedHistory(limit);
        return NextResponse.json(combined);
      }

      case 'git-log': {
        const limit = parseInt(searchParams.get('limit') || '20');
        const log = await getGitLog(limit);
        return NextResponse.json({ log });
      }

      case 'git-diff': {
        const commit = searchParams.get('commit');
        if (!commit) {
          return NextResponse.json({ error: 'Missing commit hash' }, { status: 400 });
        }
        
        const diff = await getCommitDiff(commit);
        const patch = await getCommitPatch(commit);
        
        return NextResponse.json({ diff, patch });
      }

      case 'config': {
        const config = loadChangelogConfig();
        return NextResponse.json({ config });
      }

      case 'export': {
        const format = searchParams.get('format') || 'markdown';
        const limit = parseInt(searchParams.get('limit') || '100');
        
        if (format === 'markdown') {
          const entries = getChangelogEntries({ limit });
          const markdown = exportChangelogToMarkdown(entries);
          
          return new NextResponse(markdown, {
            headers: {
              'Content-Type': 'text/markdown',
              'Content-Disposition': 'attachment; filename=changelog.md',
            },
          });
        }
        
        // JSON export
        const entries = getChangelogEntries({ limit });
        return NextResponse.json({ entries });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Changelog API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/changelog
 * Manage changelog entries (approve, reject, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'approve': {
        const { entryId, reviewedBy, note } = body;
        
        if (!entryId) {
          return NextResponse.json({ error: 'Missing entry ID' }, { status: 400 });
        }

        const entry = approveChangelogEntry(entryId, reviewedBy, note);
        if (!entry) {
          return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, entry });
      }

      case 'reject': {
        const { entryId, reviewedBy, note } = body;
        
        if (!entryId) {
          return NextResponse.json({ error: 'Missing entry ID' }, { status: 400 });
        }

        const entry = rejectChangelogEntry(entryId, reviewedBy, note);
        if (!entry) {
          return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, entry });
      }

      case 'update_config': {
        const { config } = body;
        const currentConfig = loadChangelogConfig();
        const newConfig = { ...currentConfig, ...config };
        saveChangelogConfig(newConfig);
        
        return NextResponse.json({ success: true, config: newConfig });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Changelog API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: String(error) },
      { status: 500 }
    );
  }
}

