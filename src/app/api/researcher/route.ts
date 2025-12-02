/**
 * Researcher Agent API Routes
 * Handles task management, queue operations, and research execution
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadQueue,
  addTask,
  getTasks,
  getQueueStats,
  updateTaskStatus,
  approveTask,
  rejectTask,
  loadConfig,
  saveConfig,
  generateAutoTasks,
  getRecentSessions,
} from '@/lib/research-agent';
import { ResearchTaskType, ResearchAgentConfig } from '@/types/researcher';

/**
 * GET /api/researcher
 * Get queue status and tasks
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';

  try {
    switch (action) {
      case 'status': {
        const stats = getQueueStats();
        const config = loadConfig();
        const recentSessions = getRecentSessions(5);
        return NextResponse.json({
          stats,
          config,
          recentSessions,
        });
      }

      case 'tasks': {
        const status = searchParams.get('status') as any;
        const type = searchParams.get('type') as ResearchTaskType;
        const limit = parseInt(searchParams.get('limit') || '50');
        
        const tasks = getTasks({ status, type, limit });
        return NextResponse.json({ tasks });
      }

      case 'queue': {
        const queue = loadQueue();
        return NextResponse.json(queue);
      }

      case 'config': {
        const config = loadConfig();
        return NextResponse.json(config);
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Researcher API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/researcher
 * Add tasks, approve/reject, or trigger actions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'add_task': {
        const { type, topic, description, priority, category, relatedEntries } = body;
        
        if (!type || !topic) {
          return NextResponse.json(
            { error: 'Missing required fields: type, topic' },
            { status: 400 }
          );
        }

        const task = addTask(type, topic, description || `Research: ${topic}`, {
          priority,
          targetCategory: category,
          relatedEntries,
        });

        return NextResponse.json({ success: true, task });
      }

      case 'approve': {
        const { taskId, reviewedBy } = body;
        
        if (!taskId) {
          return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
        }

        const result = approveTask(taskId, reviewedBy);
        return NextResponse.json(result);
      }

      case 'reject': {
        const { taskId, reviewedBy } = body;
        
        if (!taskId) {
          return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
        }

        rejectTask(taskId, reviewedBy);
        return NextResponse.json({ success: true });
      }

      case 'update_status': {
        const { taskId, status, updates } = body;
        
        if (!taskId || !status) {
          return NextResponse.json(
            { error: 'Missing taskId or status' },
            { status: 400 }
          );
        }

        const task = updateTaskStatus(taskId, status, updates);
        return NextResponse.json({ success: !!task, task });
      }

      case 'generate_auto_tasks': {
        const newTasks = generateAutoTasks();
        return NextResponse.json({
          success: true,
          tasksGenerated: newTasks.length,
          tasks: newTasks,
        });
      }

      case 'update_config': {
        const { config } = body as { config: Partial<ResearchAgentConfig> };
        const currentConfig = loadConfig();
        const newConfig = { ...currentConfig, ...config };
        saveConfig(newConfig);
        return NextResponse.json({ success: true, config: newConfig });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Researcher API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

