/**
 * Agent API Route
 * Controls the autonomous research agent and scheduler
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runResearchCycle,
  getSchedulerStatus,
  toggleScheduler,
  updateSchedulerSettings,
  generateTasksFromSources,
  loadSchedulerState,
} from '@/lib/agent-scheduler';
import {
  getAllParsedEntities,
  getSourceStats,
  searchEntities,
} from '@/lib/source-parser';
import {
  loadQueue,
  getQueueStats,
  getTasks,
  approveTask,
  rejectTask,
} from '@/lib/research-agent';

/**
 * GET /api/agent
 * Get agent status, queue, and source information
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';

  try {
    switch (action) {
      case 'status': {
        const status = getSchedulerStatus();
        const queueStats = getQueueStats();
        
        return NextResponse.json({
          ...status,
          queueStats,
          timestamp: new Date().toISOString(),
        });
      }

      case 'queue': {
        const queue = loadQueue();
        return NextResponse.json(queue);
      }

      case 'tasks': {
        const status = searchParams.get('status') as any;
        const limit = parseInt(searchParams.get('limit') || '20');
        const tasks = getTasks({ status, limit });
        return NextResponse.json({ tasks });
      }

      case 'sources': {
        const stats = getSourceStats();
        return NextResponse.json(stats);
      }

      case 'entities': {
        const query = searchParams.get('query');
        const limit = parseInt(searchParams.get('limit') || '50');
        
        let entities = query 
          ? searchEntities(query)
          : getAllParsedEntities();
          
        entities = entities.slice(0, limit);
        
        return NextResponse.json({ 
          entities,
          total: getAllParsedEntities().length,
        });
      }

      case 'pending': {
        const tasks = getTasks({ status: 'needs_review' });
        return NextResponse.json({ tasks });
      }

      case 'scheduler': {
        const state = loadSchedulerState();
        return NextResponse.json(state);
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

/**
 * POST /api/agent
 * Trigger agent actions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'run': {
        // Trigger a research cycle
        const result = await runResearchCycle();
        return NextResponse.json(result);
      }

      case 'generate_tasks': {
        // Generate new tasks from sources
        const tasks = generateTasksFromSources();
        return NextResponse.json({
          success: true,
          tasksGenerated: tasks.length,
          tasks: tasks.slice(0, 10), // Return first 10 for preview
        });
      }

      case 'toggle': {
        // Enable/disable scheduler
        const { enabled } = body;
        const state = toggleScheduler(enabled);
        return NextResponse.json({ success: true, state });
      }

      case 'configure': {
        // Update scheduler settings
        const { settings } = body;
        const state = updateSchedulerSettings(settings);
        return NextResponse.json({ success: true, state });
      }

      case 'approve': {
        // Approve a research task
        const { taskId, reviewedBy } = body;
        if (!taskId) {
          return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
        }
        const result = await approveTask(taskId, reviewedBy || 'User');
        return NextResponse.json(result);
      }

      case 'reject': {
        // Reject a research task
        const { taskId, reviewedBy } = body;
        if (!taskId) {
          return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
        }
        rejectTask(taskId, reviewedBy || 'User');
        return NextResponse.json({ success: true });
      }

      case 'approve_all': {
        // Approve all pending tasks
        const tasks = getTasks({ status: 'needs_review' });
        const results = await Promise.all(
          tasks.map(t => approveTask(t.id, body.reviewedBy || 'User'))
        );
        const approved = results.filter(r => r.success).length;
        return NextResponse.json({ 
          success: true, 
          approved,
          total: tasks.length,
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

