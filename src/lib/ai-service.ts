/**
 * AI Service - LLM integration for high-quality lore generation
 * Supports OpenAI and Anthropic APIs
 */

export interface AIConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model?: string;
}

export interface GeneratedLoreEntry {
  title: string;
  type: 'monster' | 'character' | 'faction' | 'location' | 'concept' | 'item' | 'event';
  summary: string;
  content: string;
  tags: string[];
  connections: Array<{ name: string; relationship: string }>;
  citations: Array<{ source: string; quote?: string }>;
  confidence: 'confirmed' | 'likely' | 'speculative';
}

export interface SourceContext {
  fileName: string;
  filePath: string;
  content: string;
  type: 'shop' | 'rulebook' | 'newsletter' | 'community';
}

const LORE_SYSTEM_PROMPT = `You are an expert lore archivist for Kingdom Death: Monster, a dark fantasy horror board game. Your role is to create comprehensive, well-written lore entries based on official source material.

Kingdom Death takes place in a nightmare realm of eternal darkness. Survivors awaken with no memories and must build settlements, hunt terrifying monsters, and struggle against cosmic horrors. The tone is dark, atmospheric, and philosophical.

Key aspects of the setting:
- The world is shrouded in darkness, with lanterns as precious sources of light
- Monsters are often tragic, ancient beings with their own histories
- Settlements are fragile bastions of humanity
- There are cosmic entities (like the Entity, Gold Smoke Knight) that transcend mortal understanding
- Death is common and meaningful
- Philosophy and belief systems shape survivor development

When writing lore entries:
1. Write in an encyclopedic but evocative style
2. Maintain the dark, mysterious tone of the game
3. Distinguish between confirmed facts (from rulebooks/official sources) and speculation
4. Note connections to other lore elements
5. Include relevant quotes when available
6. Be comprehensive but concise`;

/**
 * Generate a lore entry using AI
 */
export async function generateLoreEntry(
  entityName: string,
  sources: SourceContext[],
  config: AIConfig
): Promise<GeneratedLoreEntry | null> {
  const sourceText = sources
    .map(s => `--- SOURCE: ${s.fileName} (${s.type}) ---\n${s.content}`)
    .join('\n\n');

  const prompt = `Based on the following official Kingdom Death: Monster source material, create a comprehensive lore entry for "${entityName}".

${sourceText}

---

Create a lore entry with the following JSON structure:
{
  "title": "The official name",
  "type": "monster|character|faction|location|concept|item|event",
  "summary": "A 1-2 sentence overview",
  "content": "Full markdown content with sections like ## Overview, ## Lore, ## Connections, etc.",
  "tags": ["relevant", "tags"],
  "connections": [{"name": "Related Entity", "relationship": "Description of relationship"}],
  "citations": [{"source": "Source file name", "quote": "Relevant quote if applicable"}],
  "confidence": "confirmed|likely|speculative"
}

Write the content section in rich markdown with proper headers, paragraphs, and formatting. Be thorough but don't invent information not present in the sources.`;

  try {
    if (config.provider === 'anthropic') {
      return await callAnthropic(prompt, config);
    } else {
      return await callOpenAI(prompt, config);
    }
  } catch (error) {
    console.error('AI generation failed:', error);
    return null;
  }
}

/**
 * Extract entities from source content using AI
 */
export async function extractEntities(
  source: SourceContext,
  config: AIConfig
): Promise<Array<{ name: string; type: string; brief: string }>> {
  const prompt = `Analyze this Kingdom Death: Monster source material and extract all named entities (monsters, characters, factions, locations, concepts, items).

SOURCE: ${source.fileName}
---
${source.content.slice(0, 8000)}
---

Return a JSON array of entities found:
[
  {"name": "Entity Name", "type": "monster|character|faction|location|concept|item", "brief": "One sentence description"}
]

Only include entities that are explicitly named and described. Don't include generic terms.`;

  try {
    const response = config.provider === 'anthropic'
      ? await callAnthropicRaw(prompt, config)
      : await callOpenAIRaw(prompt, config);
    
    // Parse JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    console.error('Entity extraction failed:', error);
    return [];
  }
}

/**
 * Call Anthropic API
 */
async function callAnthropic(prompt: string, config: AIConfig): Promise<GeneratedLoreEntry | null> {
  const response = await callAnthropicRaw(prompt, config);
  
  // Parse JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]) as GeneratedLoreEntry;
  }
  return null;
}

async function callAnthropicRaw(prompt: string, config: AIConfig): Promise<string> {
  const model = config.model || 'claude-opus-4-5-20251101';
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      thinking: {
        type: 'enabled',
        budget_tokens: 10000,
      },
      system: LORE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  // Find the text block (thinking mode returns thinking + text blocks)
  const textBlock = data.content.find((block: { type: string }) => block.type === 'text');
  if (!textBlock) {
    throw new Error('No text block in response');
  }
  
  return textBlock.text;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(prompt: string, config: AIConfig): Promise<GeneratedLoreEntry | null> {
  const response = await callOpenAIRaw(prompt, config);
  
  // Parse JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]) as GeneratedLoreEntry;
  }
  return null;
}

async function callOpenAIRaw(prompt: string, config: AIConfig): Promise<string> {
  const model = config.model || 'gpt-4-turbo-preview';
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: LORE_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Get AI config from environment
 */
export function getAIConfig(): AIConfig | null {
  // Check for Anthropic first
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-5-20251101',
    };
  }
  
  // Fall back to OpenAI
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    };
  }
  
  return null;
}

/**
 * Check if AI is configured
 */
export function isAIConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

