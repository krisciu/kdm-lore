/**
 * Lore API Routes
 * Provides endpoints for lore entries and categories
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLoreEntries, getLoreBySlug, searchLore, getCategoriesWithCounts } from '@/data/lore';

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
        
        const categories = getCategoriesWithCounts();
        
        return NextResponse.json({
          entries: entries.slice(0, limit),
          categories,
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
        
        return NextResponse.json({ entry });
      }

      case 'search': {
        const query = searchParams.get('q');
        
        if (!query) {
          return NextResponse.json({ error: 'Missing search query' }, { status: 400 });
        }
        
        const entries = searchLore(query);
        
        return NextResponse.json({
          entries: entries.slice(0, 20),
          total: entries.length,
        });
      }

      case 'stats': {
        const entries = getLoreEntries();
        const categories = getCategoriesWithCounts();
        
        return NextResponse.json({
          total: entries.length,
          categories,
          byCategory: categories.reduce((acc, cat) => {
            acc[cat.id] = cat.count;
            return acc;
          }, {} as Record<string, number>),
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
