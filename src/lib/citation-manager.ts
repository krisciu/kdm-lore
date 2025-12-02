/**
 * Citation Manager - Track sources and update citations.md
 * Maintains proper attribution for all lore entries
 */

import fs from 'fs';
import path from 'path';

const LORE_PATH = path.join(process.cwd(), 'docs', 'lore');
const CITATIONS_FILE = path.join(LORE_PATH, 'citations.md');
const CITATION_INDEX_FILE = path.join(process.cwd(), 'data', 'citation-index.json');

// =============================================================================
// TYPES
// =============================================================================

export interface Citation {
  id: string;
  range: string;           // e.g., "[400-405]"
  source: string;          // Source file name
  type: 'shop' | 'rulebook' | 'newsletter' | 'community' | 'kickstarter';
  path: string;            // Relative path to source file
  topic: string;           // What this citation is about
  url?: string;            // Original URL if available
  page?: string;           // Page numbers if applicable
  quote?: string;          // Relevant quote if any
  dateAdded: string;
  quality: 'official' | 'developer' | 'implied' | 'community' | 'speculative';
}

export interface CitationIndex {
  lastUpdated: string;
  nextNumber: number;
  citations: Citation[];
}

// =============================================================================
// INDEX MANAGEMENT
// =============================================================================

function ensureDataDir(): void {
  const dataDir = path.dirname(CITATION_INDEX_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function loadCitationIndex(): CitationIndex {
  ensureDataDir();
  
  if (fs.existsSync(CITATION_INDEX_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CITATION_INDEX_FILE, 'utf-8'));
    } catch {
      // Fall through to default
    }
  }
  
  // Parse existing citations.md to get highest number
  const nextNumber = parseExistingCitationsForNextNumber();
  
  const defaultIndex: CitationIndex = {
    lastUpdated: new Date().toISOString(),
    nextNumber,
    citations: [],
  };
  
  saveCitationIndex(defaultIndex);
  return defaultIndex;
}

export function saveCitationIndex(index: CitationIndex): void {
  ensureDataDir();
  index.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CITATION_INDEX_FILE, JSON.stringify(index, null, 2));
}

/**
 * Parse citations.md to find the highest citation number
 */
function parseExistingCitationsForNextNumber(): number {
  if (!fs.existsSync(CITATIONS_FILE)) {
    return 400; // Start after existing citations
  }
  
  const content = fs.readFileSync(CITATIONS_FILE, 'utf-8');
  
  // Find all citation numbers
  const pattern = /\[(\d+)-(\d+)\]/g;
  let highest = 399;
  let match;
  
  while ((match = pattern.exec(content)) !== null) {
    const end = parseInt(match[2]);
    if (end > highest) {
      highest = end;
    }
  }
  
  return highest + 1;
}

// =============================================================================
// CITATION OPERATIONS
// =============================================================================

/**
 * Get the next available citation range
 */
export function getNextCitationRange(count: number = 5): string {
  const index = loadCitationIndex();
  const start = index.nextNumber;
  const end = start + count - 1;
  return `[${start}-${end}]`;
}

/**
 * Add a new citation
 */
export function addCitation(data: {
  source: string;
  type: Citation['type'];
  path: string;
  topic: string;
  url?: string;
  page?: string;
  quote?: string;
}): string {
  const index = loadCitationIndex();
  
  // Check for existing citation with same source and topic
  const existing = index.citations.find(c => 
    c.source === data.source && c.topic === data.topic
  );
  
  if (existing) {
    return existing.range;
  }
  
  // Create new citation
  const start = index.nextNumber;
  const end = start + 4; // 5-number range
  const range = `[${start}-${end}]`;
  
  const citation: Citation = {
    id: `cit-${Date.now()}`,
    range,
    source: data.source,
    type: data.type,
    path: data.path,
    topic: data.topic,
    url: data.url,
    page: data.page,
    quote: data.quote,
    dateAdded: new Date().toISOString(),
    quality: determineQuality(data.type),
  };
  
  index.citations.push(citation);
  index.nextNumber = end + 1;
  saveCitationIndex(index);
  
  // Also update citations.md
  appendToCitationsFile(citation);
  
  return range;
}

/**
 * Determine citation quality based on source type
 */
function determineQuality(type: Citation['type']): Citation['quality'] {
  switch (type) {
    case 'rulebook':
    case 'shop':
      return 'official';
    case 'kickstarter':
      return 'developer';
    case 'newsletter':
      return 'implied';
    case 'community':
      return 'community';
    default:
      return 'speculative';
  }
}

/**
 * Get a citation by its range
 */
export function getCitation(range: string): Citation | undefined {
  const index = loadCitationIndex();
  return index.citations.find(c => c.range === range);
}

/**
 * Get all citations for a topic
 */
export function getCitationsForTopic(topic: string): Citation[] {
  const index = loadCitationIndex();
  return index.citations.filter(c => 
    c.topic.toLowerCase().includes(topic.toLowerCase())
  );
}

// =============================================================================
// CITATIONS.MD MANAGEMENT
// =============================================================================

/**
 * Append a new citation to citations.md
 */
function appendToCitationsFile(citation: Citation): void {
  if (!fs.existsSync(CITATIONS_FILE)) {
    console.warn('citations.md not found, skipping append');
    return;
  }
  
  const content = fs.readFileSync(CITATIONS_FILE, 'utf-8');
  
  // Find the appropriate section based on source type
  const sectionHeaders: Record<Citation['type'], string> = {
    shop: '### Official Website Content',
    rulebook: '### Core Rulebooks',
    newsletter: '### Official Website Content',
    kickstarter: '### Kickstarter Updates (Adam Poots)',
    community: '## Community Sources',
  };
  
  const sectionHeader = sectionHeaders[citation.type];
  const sectionIndex = content.indexOf(sectionHeader);
  
  if (sectionIndex === -1) {
    // Add to Agent-Generated section (create if needed)
    const agentSection = '## Agent-Generated Citations';
    let agentIndex = content.indexOf(agentSection);
    
    if (agentIndex === -1) {
      // Add new section before "## Source Quality Guide"
      const qualityIndex = content.indexOf('## Source Quality Guide');
      if (qualityIndex !== -1) {
        const newSection = `\n${agentSection}\n\n> These citations were automatically generated by the Research Agent.\n\n| Citation | Source | Path | Topic |\n|----------|--------|------|-------|\n`;
        const updatedContent = content.slice(0, qualityIndex) + newSection + '\n---\n\n' + content.slice(qualityIndex);
        fs.writeFileSync(CITATIONS_FILE, updatedContent);
        agentIndex = updatedContent.indexOf(agentSection);
      }
    }
    
    // Add citation row
    if (agentIndex !== -1) {
      const tableEndPattern = /\|[^\n]+\|\n(?!\|)/;
      const afterSection = content.slice(agentIndex);
      const match = afterSection.match(tableEndPattern);
      
      if (match) {
        const insertPos = agentIndex + (match.index || 0) + match[0].length - 1;
        const citationRow = `| ${citation.range} | ${citation.source} | ${citation.path} | ${citation.topic} |\n`;
        const updatedContent = content.slice(0, insertPos) + citationRow + content.slice(insertPos);
        fs.writeFileSync(CITATIONS_FILE, updatedContent);
      }
    }
  }
}

/**
 * Build the full citation reference for an entry
 */
export function buildCitationReference(citations: string[]): string {
  const index = loadCitationIndex();
  const lines: string[] = [];
  
  for (const range of citations) {
    const citation = index.citations.find(c => c.range === range);
    if (citation) {
      let line = `- ${citation.range} ${formatSourceName(citation.source)}`;
      if (citation.path) {
        line += `: \`${citation.path}\``;
      }
      if (citation.quote) {
        line += `\n  > "${citation.quote}"`;
      }
      lines.push(line);
    } else {
      lines.push(`- ${range} (Citation pending)`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Format source name for display
 */
function formatSourceName(source: string): string {
  return source
    .replace(/-/g, ' ')
    .replace(/\.(txt|md)$/, '')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// =============================================================================
// STATISTICS
// =============================================================================

export function getCitationStats(): {
  totalCitations: number;
  byType: Record<string, number>;
  byQuality: Record<string, number>;
  recentTopics: string[];
} {
  const index = loadCitationIndex();
  
  const byType: Record<string, number> = {};
  const byQuality: Record<string, number> = {};
  
  for (const citation of index.citations) {
    byType[citation.type] = (byType[citation.type] || 0) + 1;
    byQuality[citation.quality] = (byQuality[citation.quality] || 0) + 1;
  }
  
  const recentTopics = index.citations
    .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
    .slice(0, 10)
    .map(c => c.topic);
  
  return {
    totalCitations: index.citations.length,
    byType,
    byQuality,
    recentTopics,
  };
}

/**
 * Validate that all citations in an entry exist
 */
export function validateCitations(citationRanges: string[]): {
  valid: boolean;
  missing: string[];
} {
  const index = loadCitationIndex();
  const missing: string[] = [];
  
  for (const range of citationRanges) {
    if (!index.citations.find(c => c.range === range)) {
      missing.push(range);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

