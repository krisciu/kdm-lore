/**
 * Research Pipeline API
 * Controls the multi-stage research pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runPipeline,
  stageIndex,
  stageExtract,
  stageAnalyze,
  stageGenerate,
  loadPipelineState,
  loadEntityIndex,
  loadSourceIndex,
  getEntitiesByType,
  getEntitiesNeedingEntry,
  searchEntities,
  getEntityStats,
  ExtractedEntity,
  EntityType,
} from '@/lib/research-pipeline';
import { saveLoreEntry, getAllLoreFiles } from '@/lib/lore-service';

/**
 * GET /api/pipeline
 * Get pipeline status, entities, and sources
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';

  try {
    switch (action) {
      case 'status': {
        const state = loadPipelineState();
        const stats = getEntityStats();
        const sources = loadSourceIndex();
        const entities = loadEntityIndex();
        
        // Get existing lore entries for comparison
        const existingEntries = getAllLoreFiles().map(f => f.title.toLowerCase());
        
        return NextResponse.json({
          state,
          stats,
          sourcesCount: sources.length,
          entitiesCount: entities.length,
          existingEntriesCount: existingEntries.length,
          coverage: {
            ...stats.coverage,
            percentComplete: entities.length > 0 
              ? Math.round((stats.coverage.withLoreEntry / entities.length) * 100) 
              : 0,
          },
        });
      }

      case 'entities': {
        const type = searchParams.get('type') as EntityType | null;
        const query = searchParams.get('query');
        const needsEntry = searchParams.get('needsEntry') === 'true';
        const limit = parseInt(searchParams.get('limit') || '50');
        
        let entities: ExtractedEntity[];
        
        if (query) {
          entities = searchEntities(query);
        } else if (type) {
          entities = getEntitiesByType(type);
        } else if (needsEntry) {
          entities = getEntitiesNeedingEntry();
        } else {
          entities = loadEntityIndex();
        }
        
        entities = entities.slice(0, limit);
        
        return NextResponse.json({ 
          entities,
          total: entities.length,
        });
      }

      case 'sources': {
        const sources = loadSourceIndex();
        const byType: Record<string, number> = {};
        
        for (const source of sources) {
          byType[source.type] = (byType[source.type] || 0) + 1;
        }
        
        return NextResponse.json({ 
          sources,
          total: sources.length,
          byType,
        });
      }

      case 'entity': {
        const id = searchParams.get('id');
        const name = searchParams.get('name');
        
        const entities = loadEntityIndex();
        const entity = id 
          ? entities.find(e => e.id === id)
          : name 
            ? entities.find(e => e.name.toLowerCase() === name.toLowerCase())
            : null;
        
        if (!entity) {
          return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
        }
        
        return NextResponse.json({ entity });
      }

      case 'stats': {
        const stats = getEntityStats();
        return NextResponse.json(stats);
      }

      case 'types': {
        // Get all entity types and their counts
        const stats = getEntityStats();
        return NextResponse.json({ byType: stats.byType });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Pipeline API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pipeline
 * Run pipeline stages and manage entities
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'run': {
        // Run the full pipeline or specific stages
        const { stages, generateLimit } = body;
        const result = await runPipeline({ stages, generateLimit });
        return NextResponse.json(result);
      }

      case 'index': {
        // Run just the index stage
        const result = await stageIndex();
        return NextResponse.json({
          success: true,
          sources: result.sources.length,
          newSources: result.newSources,
        });
      }

      case 'extract': {
        // Run just the extract stage
        const result = await stageExtract();
        return NextResponse.json({
          success: true,
          entities: result.entities.length,
          newEntities: result.newEntities,
        });
      }

      case 'analyze': {
        // Run just the analyze stage
        const result = await stageAnalyze();
        return NextResponse.json({
          success: true,
          connectionsFound: result.connectionsFound,
        });
      }

      case 'generate': {
        // Run just the generate stage
        const { limit } = body;
        const result = await stageGenerate(limit || 5);
        return NextResponse.json({
          success: true,
          entries: result.map(e => ({
            name: e.entity.name,
            type: e.entity.type,
            directory: e.directory,
            filename: e.filename,
          })),
          count: result.length,
        });
      }

      case 'create_entry': {
        // Create a lore entry for a specific entity
        const { entityId, entityName } = body;
        
        const entities = loadEntityIndex();
        const entity = entityId 
          ? entities.find(e => e.id === entityId)
          : entities.find(e => e.name.toLowerCase() === entityName?.toLowerCase());
        
        if (!entity) {
          return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
        }
        
        // Generate and save the entry
        const generated = await stageGenerate(1);
        const entry = generated.find(e => e.entity.id === entity.id);
        
        if (!entry) {
          return NextResponse.json({ error: 'Failed to generate entry' }, { status: 500 });
        }
        
        // Save to filesystem
        const typeToDir: Record<string, string> = {
          monster: 'monsters',
          nemesis: 'monsters',
          quarry: 'monsters',
          character: 'characters',
          faction: 'factions',
          location: 'locations',
          concept: 'concepts',
          philosophy: 'philosophy',
        };
        
        const dir = typeToDir[entity.type] || 'concepts';
        const result = await saveLoreEntry(
          {
            title: entity.name,
            category: entity.type as any,
            summary: entity.description.slice(0, 200),
            content: entry.content,
            tags: entity.tags,
            confidence: entity.confidence,
          },
          dir as any,
          {
            source: 'agent_research',
            findings: entity.sources.map(s => s.sourcePath),
          }
        );
        
        return NextResponse.json(result);
      }

      case 'bulk_create': {
        // Create entries for multiple entities
        const { entityIds, limit } = body;
        const entities = loadEntityIndex();
        
        const toCreate = entityIds 
          ? entities.filter(e => entityIds.includes(e.id))
          : entities.filter(e => !e.hasLoreEntry).slice(0, limit || 5);
        
        const results = [];
        
        for (const entity of toCreate) {
          const generated = await stageGenerate(1);
          if (generated.length > 0) {
            results.push({
              entityId: entity.id,
              entityName: entity.name,
              success: true,
            });
          }
        }
        
        return NextResponse.json({
          success: true,
          created: results.length,
          results,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Pipeline API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: String(error) },
      { status: 500 }
    );
  }
}

