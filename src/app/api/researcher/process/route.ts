/**
 * Researcher Process API Route
 * Handles the actual research processing with AI
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getNextTask,
  updateTaskStatus,
  addFindings,
  setSuggestedEntry,
  loadConfig,
  logSession,
} from '@/lib/research-agent';
import { searchLoreFiles, getAllLoreFiles } from '@/lib/lore-service';
import { ResearchFinding, SuggestedLoreEntry, ResearchSession } from '@/types/researcher';
import { getLoreEntries } from '@/data/lore';

// System prompt for research tasks
const RESEARCH_SYSTEM_PROMPT = `You are an expert Kingdom Death: Monster lore researcher. Your task is to research and compile accurate lore information.

IMPORTANT GUIDELINES:
1. Distinguish between CONFIRMED facts (from official sources) and SPECULATION
2. Always cite sources when possible (rulebook pages, expansions, etc.)
3. Note when information comes from community theories vs official sources
4. Be thorough but accurate - don't make up information
5. Flag anything uncertain with appropriate confidence levels

When creating new entries, format your response as JSON:
{
  "findings": [
    {
      "content": "The finding text",
      "source": "rulebook|expansion|kickstarter|community_wiki|ai_inference",
      "confidence": "confirmed|likely|speculative",
      "relevance": 0.0-1.0
    }
  ],
  "suggestedEntry": {
    "title": "Entry Title",
    "category": "monster|location|character|faction|concept|etc",
    "summary": "One paragraph summary",
    "content": "Full markdown content with ## headers",
    "tags": ["tag1", "tag2"],
    "confidence": "confirmed|likely|speculative",
    "sources": [{"name": "Source Name", "type": "rulebook"}],
    "connections": [{"slug": "related-entry", "type": "related"}]
  }
}`;

/**
 * POST /api/researcher/process
 * Process the next research task in the queue
 */
export async function POST(request: NextRequest) {
  const sessionStart = new Date();
  const session: ResearchSession = {
    id: `session-${Date.now()}`,
    startedAt: sessionStart.toISOString(),
    tasksProcessed: 0,
    entriesCreated: 0,
    findingsGenerated: 0,
    errors: [],
  };

  try {
    const config = loadConfig();
    
    if (!config.enabled) {
      return NextResponse.json({ 
        success: false, 
        message: 'Research agent is disabled' 
      });
    }

    // Get next task
    const task = getNextTask();
    
    if (!task) {
      return NextResponse.json({ 
        success: true, 
        message: 'No tasks in queue' 
      });
    }

    // Mark task as in progress
    updateTaskStatus(task.id, 'in_progress');

    // Get context from existing lore
    const existingEntries = getLoreEntries();
    const relatedFiles = task.relatedEntries 
      ? task.relatedEntries.map(slug => searchLoreFiles(slug)).flat()
      : [];

    // Build context string
    const contextEntries = existingEntries
      .filter(e => 
        e.title.toLowerCase().includes(task.topic.toLowerCase()) ||
        task.topic.toLowerCase().includes(e.title.toLowerCase()) ||
        e.tags.some(t => task.topic.toLowerCase().includes(t))
      )
      .slice(0, 5)
      .map(e => `- ${e.title} (${e.category}): ${e.summary}`)
      .join('\n');

    // Check for API key
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      // Simulate research without API
      const simulatedResult = simulateResearch(task.topic, task.type, existingEntries);
      
      addFindings(task.id, simulatedResult.findings);
      if (simulatedResult.suggestedEntry) {
        setSuggestedEntry(task.id, simulatedResult.suggestedEntry);
      }
      
      updateTaskStatus(task.id, 'needs_review');
      session.tasksProcessed = 1;
      session.findingsGenerated = simulatedResult.findings.length;
      
      return NextResponse.json({
        success: true,
        task: task.id,
        simulated: true,
        findings: simulatedResult.findings.length,
      });
    }

    // Build the research prompt
    const userPrompt = buildResearchPrompt(task, contextEntries);

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    // Parse the response
    const result = JSON.parse(assistantMessage);

    // Add findings
    if (result.findings && result.findings.length > 0) {
      const findings: ResearchFinding[] = result.findings.map((f: any, idx: number) => ({
        id: `finding-${task.id}-${idx}`,
        content: f.content,
        source: f.source || 'ai_inference',
        confidence: f.confidence || 'speculative',
        relevance: f.relevance || 0.5,
        timestamp: new Date().toISOString(),
      }));
      
      addFindings(task.id, findings);
      session.findingsGenerated = findings.length;
    }

    // Add suggested entry
    if (result.suggestedEntry) {
      const entry: SuggestedLoreEntry = {
        title: result.suggestedEntry.title || task.topic,
        category: result.suggestedEntry.category || task.targetCategory || 'concept',
        summary: result.suggestedEntry.summary || '',
        content: result.suggestedEntry.content || '',
        tags: result.suggestedEntry.tags || [],
        confidence: result.suggestedEntry.confidence || 'speculative',
        sources: result.suggestedEntry.sources || [],
        connections: result.suggestedEntry.connections || [],
      };
      
      setSuggestedEntry(task.id, entry);
    }

    // Update task status
    updateTaskStatus(task.id, 'needs_review');
    session.tasksProcessed = 1;

    // Log session
    session.endedAt = new Date().toISOString();
    logSession(session);

    return NextResponse.json({
      success: true,
      task: task.id,
      findings: session.findingsGenerated,
      hasSuggestedEntry: !!result.suggestedEntry,
    });

  } catch (error) {
    console.error('Research processing error:', error);
    session.errors.push(String(error));
    session.endedAt = new Date().toISOString();
    logSession(session);

    return NextResponse.json(
      { error: 'Failed to process research task', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Build a research prompt based on task type
 */
function buildResearchPrompt(task: any, context: string): string {
  const basePrompt = `Research Task: ${task.type}
Topic: ${task.topic}
Description: ${task.description}

Existing related lore in our compendium:
${context || 'No directly related entries found.'}

Please research this topic and provide:
1. Key findings with sources and confidence levels
2. A suggested lore entry if appropriate

Focus on Kingdom Death: Monster lore specifically.`;

  switch (task.type) {
    case 'explore_topic':
      return `${basePrompt}\n\nProvide a comprehensive overview of this topic, including origins, significance, and connections to other lore elements.`;
    
    case 'expand_entry':
      return `${basePrompt}\n\nFocus on adding new details, quotes, mechanics connections, and deeper analysis to the existing entry.`;
    
    case 'verify_facts':
      return `${basePrompt}\n\nVerify the accuracy of existing information. Note any discrepancies or unverified claims.`;
    
    case 'find_connections':
      return `${basePrompt}\n\nIdentify and explain connections between this topic and other lore elements. Include both obvious and subtle connections.`;
    
    default:
      return basePrompt;
  }
}

/**
 * Simulate research when no API key is available
 */
function simulateResearch(topic: string, type: string, existingEntries: any[]): { 
  findings: ResearchFinding[]; 
  suggestedEntry?: SuggestedLoreEntry;
} {
  const related = existingEntries.filter(e => 
    e.title.toLowerCase().includes(topic.toLowerCase()) ||
    topic.toLowerCase().includes(e.title.toLowerCase())
  );

  const findings: ResearchFinding[] = [
    {
      id: `finding-sim-1`,
      content: `Research simulation for "${topic}". This entry requires manual research and verification.`,
      source: 'ai_inference',
      confidence: 'speculative',
      relevance: 0.5,
      timestamp: new Date().toISOString(),
    },
  ];

  if (related.length > 0) {
    findings.push({
      id: `finding-sim-2`,
      content: `Found ${related.length} potentially related entries: ${related.map(e => e.title).join(', ')}`,
      source: 'ai_inference',
      confidence: 'likely',
      relevance: 0.7,
      timestamp: new Date().toISOString(),
    });
  }

  const suggestedEntry: SuggestedLoreEntry = {
    title: topic,
    category: 'concept',
    summary: `Research placeholder for ${topic}. This entry needs to be filled in with verified information.`,
    content: `# ${topic}\n\n> *This entry was generated as a research placeholder and needs verification.*\n\n## Overview\n\nTODO: Add verified information about ${topic}.\n\n## Sources\n\n- Needs research`,
    tags: ['needs-research', 'placeholder'],
    confidence: 'speculative',
    sources: [],
    connections: related.map(e => ({ slug: e.slug, type: 'related' as const })),
  };

  return { findings, suggestedEntry };
}

