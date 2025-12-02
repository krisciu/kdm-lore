'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Send, 
  Loader2, 
  Sparkles,
  BookOpen,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Lightbulb,
  Search,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  suggestedEntry?: SuggestedEntry;
}

interface SuggestedEntry {
  title: string;
  category: string;
  summary: string;
  content: string;
  tags: string[];
  confidence: 'confirmed' | 'likely' | 'speculative';
  status: 'pending' | 'approved' | 'rejected';
}

const researchPrompts = [
  "Tell me about the Gold Smoke Knight and its significance",
  "What is the connection between The King and his servants?",
  "Explain the People of the Sun philosophy",
  "What monsters are connected to the Phoenix?",
  "Describe the lore behind the Twilight Knight",
  "What happened during the Golden Age?",
];

export default function ResearchPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: `Welcome to the **Research Lab**. I'm your AI research assistant, specialized in Kingdom Death: Monster lore.

I can help you:
- **Research** existing lore and find connections
- **Explain** complex storylines and relationships
- **Discover** hidden details and interpretations
- **Propose** new lore entries for the compendium

What mysteries would you like to explore?`,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPrompts, setShowPrompts] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowPrompts(false);

    // Simulate AI response (in production, this would call the API)
    setTimeout(() => {
      const aiResponse = generateResearchResponse(userMessage.content);
      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500 + Math.random() * 1500);
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    setShowPrompts(false);
  };

  // Simulated AI response generator
  const generateResearchResponse = (query: string): Message => {
    const lowerQuery = query.toLowerCase();
    
    let response = '';
    let suggestedEntry: SuggestedEntry | undefined;

    if (lowerQuery.includes('gold smoke knight')) {
      response = `# The Gold Smoke Knight

The **Gold Smoke Knight** is one of the most enigmatic entities in Kingdom Death lore. Here's what we know:

## Appearance
Clad in armor of purest gold and perpetually surrounded by ethereal golden smoke, this being appears at pivotal moments in the world's history.

## Key Facts
- The Knight's origins are completely unknown
- Its armor is said to be indestructible
- The golden smoke carries whispers of forgotten knowledge
- It operates according to inscrutable rules that no one understands

## Theories
1. **Transcended Survivor Theory**: Some believe it was once a survivor who achieved a form of transcendence
2. **Ancient Entity Theory**: Others claim it has always existed as a fundamental cosmic force
3. **Golden Entity Connection**: May be related to other "golden" elements in the world

## Connections
The Gold Smoke Knight may have connections to:
- The luminescent mane of the White Lion
- The golden light of certain settlements
- The mysterious "Gold" philosophy path

Would you like me to propose a new lore entry about the Gold Smoke Knight, or explore any of these connections further?`;
    } else if (lowerQuery.includes('king') || lowerQuery.includes("king's man")) {
      response = `# The King and His Servants

The entity known as **The King** rules over a domain of twisted opulence, and sends forth servants to collect "taxes" from settlements that grow too prosperous.

## Known Servants

### The King's Man
- A heavily armored enforcer
- Arrives to collect the settlement's strongest survivors
- Wears armor of exquisite craftsmanship
- Those who wear the harvested armor hear whispers...

### The Hand
- Another servant of The King
- Connected to higher-level nemesis encounters
- Represents a more direct intervention

## The King's Domain
Shrouded in mystery, The King's domain is said to be a place of:
- Twisted opulence and decadence
- Courtiers who have forgotten their humanity
- A throne that may not be what it seems

## Key Questions
- What purpose do the "taxes" serve?
- Why does The King care about prosperous settlements?
- Is The King a single entity or a title/position?

I can propose a detailed lore entry about The King if you'd like, or we can explore the individual servants in more detail.`;
      
      suggestedEntry = {
        title: 'The Hand',
        category: 'monster',
        summary: 'A powerful servant of The King who represents direct intervention in mortal affairs.',
        content: `The Hand is one of The King's most powerful servants, appearing when The King's will demands more than mere collection. Unlike the King's Man, The Hand does not simply collect—it enforces.

## Purpose
Where the King's Man collects taxes, The Hand delivers punishment. Settlements that have somehow defied or escaped The King's attention find themselves facing this terrifying entity.

## Connection to The King
The Hand is said to be more directly connected to The King than other servants, perhaps serving as an extension of The King's will itself.`,
        tags: ['nemesis', 'the-king', 'servant', 'humanoid'],
        confidence: 'likely',
        status: 'pending',
      };
    } else if (lowerQuery.includes('phoenix')) {
      response = `# Phoenix Lore and Connections

The **Phoenix** is a majestic quarry that burns with eternal flame. Let me share what we know about its connections:

## Direct Connections

### Phoenix Cult
Some survivors worship the Phoenix, seeing hope and renewal in its eternal flame. This can lead to:
- Special cult mechanics
- Phoenix egg protection
- Transformation of devoted followers

### Rebirth Mechanics
True to its namesake, the Phoenix can be reborn from ashes, making it a recurring threat that evolves with each encounter.

## Thematic Connections

### Fire Theme
- Connected to the concept of transformation
- Represents both destruction and renewal
- Tied to the "People of the Sun" philosophy

### Courage Connection
The Phoenix is attracted to displays of bravery and heroism, suggesting it may serve as a test or reward for the bold.

## Speculative Connections
- May have links to the "heat" mechanics in certain expansions
- Possible connection to other "eternal" entities
- Some theories suggest Phoenix fire predates the current world

Would you like me to research any of these connections in more detail?`;
    } else {
      response = `# Research Results for: "${query}"

I've searched through the lore compendium and my knowledge base. Here's what I found:

## Current Compendium Status
This topic may not have a detailed entry in our compendium yet. This is an opportunity to expand our knowledge!

## What I Know
Based on Kingdom Death: Monster lore, this topic likely connects to:
- The core survival themes of the game
- The cosmic horror elements that permeate the world
- The struggle between darkness and the lantern's light

## Suggested Actions
1. **Explore Related Entries**: Check monsters, entities, or philosophies that might connect
2. **Propose New Entry**: If you have specific knowledge, I can help format it for the compendium
3. **Refine Your Query**: Ask about specific aspects (origins, abilities, connections, etc.)

## Research Prompts
Try asking about:
- Specific monsters or entities
- Philosophies (Lantern, Stars, Sun)
- Timeline events and eras
- Connections between lore elements

What aspect would you like to explore further?`;
    }

    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      suggestedEntry,
    };
  };

  const parseMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    
    lines.forEach((line, idx) => {
      if (line.startsWith('# ')) {
        elements.push(
          <h2 key={idx} className="text-xl font-[var(--font-display)] tracking-wider text-[var(--red)] mb-4 mt-2">
            {line.replace('# ', '')}
          </h2>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h3 key={idx} className="text-lg font-[var(--font-display)] tracking-wider text-white mb-3 mt-6">
            {line.replace('## ', '')}
          </h3>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h4 key={idx} className="font-semibold text-[var(--text-primary)] mb-2 mt-4">
            {line.replace('### ', '')}
          </h4>
        );
      } else if (line.startsWith('- ')) {
        elements.push(
          <li key={idx} className="ml-4 text-[var(--text-secondary)] mb-1 list-disc list-inside">
            {parseInlineMarkdown(line.replace('- ', ''))}
          </li>
        );
      } else if (line.match(/^\d+\. /)) {
        elements.push(
          <li key={idx} className="ml-4 text-[var(--text-secondary)] mb-1 list-decimal list-inside">
            {parseInlineMarkdown(line.replace(/^\d+\. /, ''))}
          </li>
        );
      } else if (line.trim()) {
        elements.push(
          <p key={idx} className="text-[var(--text-secondary)] mb-3">
            {parseInlineMarkdown(line)}
          </p>
        );
      }
    });

    return elements;
  };

  const parseInlineMarkdown = (text: string) => {
    // Handle bold text
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="min-h-screen flex flex-col pt-20">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Brain className="w-10 h-10 text-[var(--red)]" />
              <motion.div
                className="absolute inset-0 blur-md bg-[var(--red)]/30"
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-[var(--font-display)] tracking-wider">
                RESEARCH <span className="text-[var(--red)]">LAB</span>
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                AI-powered lore discovery and expansion
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mb-6 ${message.role === 'user' ? 'flex justify-end' : ''}`}
              >
                {message.role === 'user' ? (
                  <div className="bg-[var(--black-elevated)] rounded-lg px-6 py-4 max-w-[80%]">
                    <p className="text-[var(--text-primary)]">{message.content}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                ) : (
                  <div className="lore-card p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-[var(--red)]/10 rounded-lg flex-shrink-0">
                        {message.role === 'system' ? (
                          <Sparkles className="w-5 h-5 text-[var(--red)]" />
                        ) : (
                          <Brain className="w-5 h-5 text-[var(--red)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="prose-content">
                          {parseMarkdown(message.content)}
                        </div>
                        
                        {/* Suggested Entry Card */}
                        {message.suggestedEntry && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-6 p-4 bg-[var(--black-elevated)] rounded-lg border border-[var(--border)]"
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <FileText className="w-4 h-4 text-[var(--red)]" />
                              <span className="text-sm font-[var(--font-display)] tracking-wider uppercase text-[var(--red)]">
                                Suggested Entry
                              </span>
                              <span className="tag ml-auto">
                                <Clock className="w-3 h-3 inline mr-1" />
                                Pending Review
                              </span>
                            </div>
                            <h4 className="font-[var(--font-display)] tracking-wider text-lg mb-2">
                              {message.suggestedEntry.title}
                            </h4>
                            <p className="text-sm text-[var(--text-secondary)] mb-4">
                              {message.suggestedEntry.summary}
                            </p>
                            <div className="flex flex-wrap gap-2 mb-4">
                              {message.suggestedEntry.tags.map(tag => (
                                <span key={tag} className="tag">#{tag}</span>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button className="btn text-sm flex items-center gap-1 px-3 py-1">
                                <CheckCircle className="w-3 h-3" /> Approve
                              </button>
                              <button className="btn text-sm flex items-center gap-1 px-3 py-1">
                                <XCircle className="w-3 h-3" /> Reject
                              </button>
                              <button className="btn text-sm flex items-center gap-1 px-3 py-1">
                                <BookOpen className="w-3 h-3" /> View Full
                              </button>
                            </div>
                          </motion.div>
                        )}
                        
                        <p className="text-xs text-[var(--text-muted)] mt-4">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading State */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="lore-card p-6"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-[var(--red)]/10 rounded-lg">
                  <Loader2 className="w-5 h-5 text-[var(--red)] animate-spin" />
                </div>
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <span>Researching the darkness</span>
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    ...
                  </motion.span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Suggested Prompts */}
          <AnimatePresence>
            {showPrompts && messages.length === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mt-8"
              >
                <div className="flex items-center gap-2 mb-4 text-[var(--text-muted)]">
                  <Lightbulb className="w-4 h-4" />
                  <span className="text-sm">Suggested research topics</span>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {researchPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePromptClick(prompt)}
                      className="text-left p-4 lore-card group"
                    >
                      <div className="flex items-start gap-3">
                        <Search className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--red)] transition-colors flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                          {prompt}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-[var(--border-subtle)] bg-[var(--black)]/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSubmit} className="flex gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about Kingdom Death lore, or propose a new entry..."
                className="w-full px-6 py-4 bg-[var(--black-raised)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--red)] transition-colors pr-12"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPrompts(!showPrompts)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--red)] transition-colors"
              >
                {showPrompts ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="btn btn-primary px-6 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              <span className="hidden sm:inline">Research</span>
            </button>
          </form>
          <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
            Research is powered by AI and should be verified against official sources
          </p>
        </div>
      </div>
    </div>
  );
}
