import { NextRequest, NextResponse } from 'next/server';
import { loreEntries, searchLore } from '@/data/lore';

// System prompt for the KDM lore research assistant
const SYSTEM_PROMPT = `You are an expert Kingdom Death: Monster lore researcher and archivist. Your role is to:

1. Answer questions about KDM lore accurately, citing sources when possible
2. Make connections between different lore elements
3. Distinguish between confirmed canon, likely interpretations, and speculation
4. Propose new lore entries when appropriate
5. Help expand the lore compendium with verified information

Current lore entries in the compendium:
${loreEntries.map(e => `- ${e.title} (${e.category}): ${e.summary}`).join('\n')}

When proposing new entries, use this format:
[PROPOSED ENTRY]
Title: <title>
Category: <monster|location|survivor|settlement|item|event|philosophy|entity>
Summary: <one paragraph summary>
Content: <detailed content>
Tags: <comma-separated tags>
Confidence: <confirmed|likely|speculative>
[END ENTRY]

Always be helpful, accurate, and encourage the user's curiosity about the dark world of Kingdom Death.`;

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    // Check if OpenAI API key is configured
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      // Return a simulated response if no API key
      return NextResponse.json({
        response: generateSimulatedResponse(message),
        suggestedEntry: null,
      });
    }

    // Build messages array for OpenAI
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(history || []),
      { role: 'user', content: message },
    ];

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error('OpenAI API request failed');
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    // Check if response contains a proposed entry
    const suggestedEntry = parseProposedEntry(assistantMessage);

    return NextResponse.json({
      response: assistantMessage,
      suggestedEntry,
    });
  } catch (error) {
    console.error('Research API error:', error);
    return NextResponse.json(
      { error: 'Failed to process research request' },
      { status: 500 }
    );
  }
}

function parseProposedEntry(content: string) {
  const entryMatch = content.match(/\[PROPOSED ENTRY\]([\s\S]*?)\[END ENTRY\]/);
  
  if (!entryMatch) return null;

  const entryContent = entryMatch[1];
  
  const title = entryContent.match(/Title:\s*(.+)/)?.[1]?.trim();
  const category = entryContent.match(/Category:\s*(.+)/)?.[1]?.trim();
  const summary = entryContent.match(/Summary:\s*(.+)/)?.[1]?.trim();
  const contentMatch = entryContent.match(/Content:\s*([\s\S]*?)(?=Tags:|$)/)?.[1]?.trim();
  const tags = entryContent.match(/Tags:\s*(.+)/)?.[1]?.trim().split(',').map(t => t.trim());
  const confidence = entryContent.match(/Confidence:\s*(.+)/)?.[1]?.trim();

  if (!title || !category || !summary) return null;

  return {
    title,
    category,
    summary,
    content: contentMatch || '',
    tags: tags || [],
    confidence: confidence as 'confirmed' | 'likely' | 'speculative' || 'speculative',
    status: 'pending' as const,
  };
}

function generateSimulatedResponse(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  // Search existing lore for relevant information
  const relevantEntries = searchLore(message).slice(0, 3);
  
  if (relevantEntries.length > 0) {
    const entry = relevantEntries[0];
    return `# ${entry.title}

Based on our compendium, here's what I found:

${entry.summary}

## Key Details
${entry.content.split('\n\n').slice(0, 3).join('\n\n')}

${relevantEntries.length > 1 ? `

## Related Entries
I also found these related entries that might interest you:
${relevantEntries.slice(1).map(e => `- **${e.title}**: ${e.summary}`).join('\n')}
` : ''}

Would you like me to explore any aspect of this topic in more detail?`;
  }

  // Generic response for topics not in the compendium
  return `# Research Results

I've searched through our lore compendium for information about "${message}".

## Current Status
This topic doesn't have a detailed entry in our compendium yet. This represents an opportunity to expand our knowledge base!

## What I Know
Based on Kingdom Death: Monster lore patterns, this topic likely relates to:
- The eternal struggle between light and darkness
- The mysterious entities that shape the world
- The survival narratives of settlements

## Next Steps
1. If you have specific knowledge about this topic, I can help format it as a new lore entry
2. We can explore related topics that might provide context
3. Try asking about specific aspects (origins, connections, mechanics)

What would you like to explore?`;
}

