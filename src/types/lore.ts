// Kingdom Death: Monster Lore Types

export type LoreCategory = 
  | 'monster'
  | 'location'
  | 'survivor'
  | 'settlement'
  | 'item'
  | 'event'
  | 'philosophy'
  | 'timeline'
  | 'entity'
  | 'faction'
  | 'concept'
  | 'technology'
  | 'character';

export type MonsterType = 
  | 'quarry'
  | 'nemesis'
  | 'unique'
  | 'legendary'
  | 'node-1'
  | 'node-2'
  | 'node-3'
  | 'node-4';

export type Rarity = 
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'legendary';

export interface LoreSource {
  name: string;
  type: 'rulebook' | 'expansion' | 'story' | 'community' | 'llm-research';
  page?: string;
  verified: boolean;
}

export interface LoreConnection {
  id: string;
  type: 'related' | 'parent' | 'child' | 'enemy' | 'ally' | 'origin' | 'evolution';
  description?: string;
}

export interface LoreEntry {
  id: string;
  slug: string;
  title: string;
  category: LoreCategory;
  subcategory?: string;
  
  // Content
  summary: string;
  content: string;
  quotes?: string[];
  
  // Metadata
  tags: string[];
  aliases?: string[];
  connections?: LoreConnection[];
  sources: LoreSource[];
  
  // For monsters
  monsterType?: MonsterType;
  level?: number;
  
  // For items
  rarity?: Rarity;
  
  // Dates
  createdAt: string;
  updatedAt: string;
  
  // Research tracking
  researchNotes?: string;
  needsReview?: boolean;
  confidence: 'confirmed' | 'likely' | 'speculative';
}

export interface LoreSearchResult {
  entry: LoreEntry;
  score: number;
  matchedFields: string[];
}

export interface LoreResearchSession {
  id: string;
  query: string;
  findings: string;
  suggestedEntries: Partial<LoreEntry>[];
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  createdAt: string;
}

export interface CategoryInfo {
  id: LoreCategory;
  name: string;
  description: string;
  icon: string;
  count: number;
}

// Timeline specific types
export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  era: 'ancient' | 'golden-age' | 'age-of-darkness' | 'current';
  approximateOrder: number;
  relatedEntries: string[];
}

