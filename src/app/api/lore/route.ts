/**
 * Lore API Routes
 * Provides endpoints for lore file operations, stats, and search
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllLoreFiles,
  getLoreStats,
  searchLoreFiles,
  getBacklinks,
  findBrokenLinks,
  LORE_DIRECTORIES,
} from '@/lib/lore-service';
import { getLoreEntries, getLoreBySlug, searchLore } from '@/data/lore';

/**
 * GET /api/lore
 * Get lore entries, stats, or perform searches
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'entries';

  try {
    switch (action) {
      case 'entries': {
        const category = searchParams.get('category');
        const limit = parseInt(searchParams.get('limit') || '100');
        
        let entries = getLoreEntries();
        
        if (category) {
          entries = entries.filter(e => e.category === category);
        }
        
        return NextResponse.json({
          entries: entries.slice(0, limit),
          total: entries.length,
        });
      }

      case 'entry': {
        const slug = searchParams.get('slug');
        
        if (!slug) {
          return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
        }
        
        const entry = getLoreBySlug(slug);
        
        if (!entry) {
          return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
        }
        
        // Get backlinks
        const backlinks = getBacklinks(slug);
        
        return NextResponse.json({
          entry,
          backlinks: backlinks.map(f => ({
            slug: f.slug,
            title: f.title,
            category: f.category,
          })),
        });
      }

      case 'search': {
        const query = searchParams.get('q');
        
        if (!query) {
          return NextResponse.json({ error: 'Missing search query' }, { status: 400 });
        }
        
        const entries = searchLore(query);
        const files = searchLoreFiles(query);
        
        return NextResponse.json({
          entries: entries.slice(0, 20),
          files: files.slice(0, 20).map(f => ({
            slug: f.slug,
            title: f.title,
            category: f.category,
            directory: f.directory,
          })),
        });
      }

      case 'stats': {
        const stats = getLoreStats();
        const directories = Object.entries(LORE_DIRECTORIES).map(([key, config]) => ({
          key,
          ...config,
          count: stats.byDirectory[key] || 0,
        }));
        
        return NextResponse.json({
          ...stats,
          directories,
        });
      }

      case 'files': {
        const directory = searchParams.get('directory');
        let files = getAllLoreFiles();
        
        if (directory) {
          files = files.filter(f => f.directory === directory);
        }
        
        return NextResponse.json({
          files: files.map(f => ({
            slug: f.slug,
            title: f.title,
            category: f.category,
            directory: f.directory,
            lastModified: f.lastModified,
          })),
        });
      }

      case 'broken-links': {
        const files = getAllLoreFiles();
        const brokenByFile: Record<string, any[]> = {};
        
        files.forEach(file => {
          const broken = findBrokenLinks(file.path);
          if (broken.length > 0) {
            brokenByFile[file.slug] = broken;
          }
        });
        
        return NextResponse.json({
          totalBroken: Object.values(brokenByFile).flat().length,
          byFile: brokenByFile,
        });
      }

      case 'directories': {
        return NextResponse.json({
          directories: Object.entries(LORE_DIRECTORIES).map(([key, config]) => ({
            key,
            ...config,
          })),
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Lore API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

