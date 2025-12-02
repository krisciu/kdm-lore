/**
 * Types for the Autonomous Lore Researcher Agent System
 */

export type ResearchTaskStatus = 
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'needs_review'
  | 'approved'
  | 'rejected';

export type ResearchTaskType =
  | 'explore_topic'      // Research a new topic
  | 'expand_entry'       // Add more detail to existing entry
  | 'verify_facts'       // Verify existing information
  | 'find_connections'   // Find connections between entries
  | 'update_citations'   // Update/verify citations
  | 'web_research'       // Research from web sources
  | 'create_entry';      // Create a new lore entry

export type ResearchSource =
  | 'rulebook'
  | 'expansion'
  | 'kickstarter'
  | 'official_site'
  | 'community_wiki'
  | 'forum_discussion'
  | 'ai_inference';

export interface ResearchTask {
  id: string;
  type: ResearchTaskType;
  status: ResearchTaskStatus;
  
  // Task details
  topic: string;
  description: string;
  priority: number; // 1-10, higher = more important
  
  // Context
  relatedEntries?: string[];  // Slugs of related entries
  targetCategory?: string;
  
  // Results
  findings?: ResearchFinding[];
  suggestedEntry?: SuggestedLoreEntry;
  error?: string;
  
  // Metadata
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface ResearchFinding {
  id: string;
  content: string;
  source: ResearchSource;
  sourceUrl?: string;
  sourcePage?: string;
  confidence: 'confirmed' | 'likely' | 'speculative';
  relevance: number; // 0-1
  timestamp: string;
}

export interface SuggestedLoreEntry {
  title: string;
  category: string;
  summary: string;
  content: string;
  tags: string[];
  confidence: 'confirmed' | 'likely' | 'speculative';
  sources: Array<{
    name: string;
    type: ResearchSource;
    url?: string;
    page?: string;
  }>;
  connections: Array<{
    slug: string;
    type: 'related' | 'parent' | 'child' | 'enemy' | 'ally';
    description?: string;
  }>;
}

export interface ResearchQueue {
  tasks: ResearchTask[];
  currentTask?: string;  // ID of currently processing task
  lastUpdated: string;
  stats: {
    queued: number;
    inProgress: number;
    completed: number;
    failed: number;
    needsReview: number;
  };
}

export interface ResearchAgentConfig {
  enabled: boolean;
  maxConcurrentTasks: number;
  autoApprove: boolean;  // Auto-approve high-confidence findings
  minConfidenceForAutoApprove: number;  // 0-1
  researchIntervalMs: number;  // How often to check for new tasks
  webResearchEnabled: boolean;
  sources: {
    rulebooks: boolean;
    kickstarter: boolean;
    communityWiki: boolean;
    forums: boolean;
    webSearch: boolean;
  };
}

export interface ResearchSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  tasksProcessed: number;
  entriesCreated: number;
  findingsGenerated: number;
  errors: string[];
}

// Research prompts for the AI
export interface ResearchPrompt {
  id: string;
  name: string;
  description: string;
  prompt: string;
  taskType: ResearchTaskType;
  category?: string;
}

// Default research prompts
export const DEFAULT_RESEARCH_PROMPTS: ResearchPrompt[] = [
  {
    id: 'explore-monster',
    name: 'Explore Monster Lore',
    description: 'Research lore about a specific monster',
    prompt: 'Research and compile all known lore about {topic}. Include origins, behavior, connections to other entities, and significance to survivors.',
    taskType: 'explore_topic',
    category: 'monster',
  },
  {
    id: 'find-connections',
    name: 'Find Lore Connections',
    description: 'Discover connections between lore elements',
    prompt: 'Analyze the relationship between {topic} and other elements in Kingdom Death lore. Identify direct connections, thematic links, and speculative relationships.',
    taskType: 'find_connections',
  },
  {
    id: 'verify-entry',
    name: 'Verify Entry Facts',
    description: 'Verify facts in an existing entry',
    prompt: 'Review the lore entry for {topic} and verify all stated facts against known sources. Flag any unverified or speculative claims.',
    taskType: 'verify_facts',
  },
  {
    id: 'expand-entry',
    name: 'Expand Entry Content',
    description: 'Add more detail to an existing entry',
    prompt: 'Research additional details about {topic} that could expand the existing entry. Look for quotes, specific events, mechanical connections, and community theories.',
    taskType: 'expand_entry',
  },
  {
    id: 'web-research',
    name: 'Web Research',
    description: 'Search the web for latest information',
    prompt: 'Search for the latest information about {topic} in Kingdom Death: Monster. Focus on official announcements, community discoveries, and confirmed updates.',
    taskType: 'web_research',
  },
];

// Helper function to create a new research task
export function createResearchTask(
  type: ResearchTaskType,
  topic: string,
  description: string,
  options?: Partial<ResearchTask>
): ResearchTask {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    status: 'queued',
    topic,
    description,
    priority: options?.priority ?? 5,
    relatedEntries: options?.relatedEntries,
    targetCategory: options?.targetCategory,
    createdAt: new Date().toISOString(),
    ...options,
  };
}

