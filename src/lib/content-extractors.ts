/**
 * Content Extractors - Specialized parsers for KDM game content
 * Extracts structured data from gear cards, AI cards, events, etc.
 */

import { classifyContentWithContext, ContentType } from './content-classifier';

// =============================================================================
// TYPES
// =============================================================================

export interface GearCard {
  name: string;
  type: 'weapon' | 'armor' | 'item' | 'consumable';
  weaponType?: string; // axe, sword, bow, etc.
  armorLocation?: string; // head, body, arms, legs, waist
  stats: {
    speed?: number;
    accuracy?: number;
    strength?: number;
    luck?: number;
    evasion?: number;
    armor?: number;
  };
  keywords: string[];
  affinities: {
    red?: number;
    blue?: number;
    green?: number;
    requires?: string[]; // e.g., ["red-left", "blue-top"]
    provides?: string[]; // e.g., ["green-right", "blue-bottom"]
  };
  effect: string;
  activation?: string;
  special?: string;
  craftingRequirements?: string[];
  expansion: string;
  sourceFile: string;
}

export interface AICard {
  name: string;
  monster: string;
  phase: 'basic' | 'advanced' | 'legendary' | 'special';
  targeting: {
    primary: string;
    fallback?: string;
    noTarget?: string;
  };
  speed: number;
  accuracy: string;
  damage: number;
  trigger?: string;
  effects: string[];
  persistentEffects?: string[];
  failure?: string; // What happens on failure/gimped
  sourceFile: string;
}

export interface HuntEvent {
  number: number;
  name: string;
  description: string;
  rolls: Array<{
    range: string; // e.g., "1-3", "4-7", "8+"
    result: string;
    outcomes?: string[];
  }>;
  conditions?: string[];
  requirements?: string[];
  relatedEvents?: number[];
  sourceFile: string;
  pageNumber?: number;
}

export interface StoryEvent {
  name: string;
  trigger: string;
  description: string;
  choices?: Array<{
    text: string;
    consequence: string;
  }>;
  outcomes: string[];
  relatedEntities: string[];
  sourceFile: string;
}

export interface SettlementLocation {
  name: string;
  buildCost: string[];
  effect: string;
  activation?: string;
  departing?: string;
  returning?: string;
  destroy?: string;
  innovation?: string;
  expansion: string;
  sourceFile: string;
}

export interface FightingArt {
  name: string;
  type: 'standard' | 'secret';
  description: string;
  effect: string;
  restriction?: string;
  sourceFile: string;
}

export interface Disorder {
  name: string;
  severity: 'standard' | 'severe';
  description: string;
  effect: string;
  cure?: string;
  sourceFile: string;
}

export type ExtractedContent = 
  | { type: 'gear_card'; data: GearCard }
  | { type: 'ai_card'; data: AICard }
  | { type: 'hunt_event'; data: HuntEvent[] }
  | { type: 'story_event'; data: StoryEvent }
  | { type: 'settlement_location'; data: SettlementLocation }
  | { type: 'fighting_art'; data: FightingArt }
  | { type: 'disorder'; data: Disorder }
  | { type: 'general'; data: { text: string; summary: string } };

// =============================================================================
// GEAR CARD EXTRACTOR
// =============================================================================

const WEAPON_TYPES = ['axe', 'sword', 'dagger', 'grand', 'spear', 'bow', 'whip', 'katar', 'scythe', 'club', 'shield', 'fist & tooth', 'thrown'];
const ARMOR_LOCATIONS = ['head', 'body', 'arms', 'legs', 'waist'];
const GEAR_KEYWORDS = [
  'sharp', 'deadly', 'slow', 'cumbersome', 'frail', 'irreplaceable', 'paired',
  'savage', 'devastating', 'unwieldy', 'sentient', 'cursed', 'amber', 'other',
  'unique', 'set', 'consumable', 'ammunition', 'thrown', 'instrument', 'noisy',
  'reach', 'block', 'deflect', 'vital', 'accessory', 'bone', 'organ', 'herb',
  'metal', 'finesse', 'two-handed', 'light', 'heavy'
];

export function extractGearCard(text: string, filename: string, sourcePath: string): GearCard | null {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  // Extract name (usually first bold text or header)
  let name = extractName(lines, filename);
  if (!name) return null;
  
  // Determine gear type
  const type = determineGearType(text);
  
  // Extract weapon type if applicable
  const weaponType = type === 'weapon' ? extractWeaponType(text) : undefined;
  
  // Extract armor location if applicable
  const armorLocation = type === 'armor' ? extractArmorLocation(text) : undefined;
  
  // Extract stats
  const stats = extractGearStats(text);
  
  // Extract keywords
  const keywords = extractKeywords(text);
  
  // Extract affinities
  const affinities = extractAffinities(text);
  
  // Extract effect text
  const effect = extractEffectText(text, ['effect:', 'special:', 'activation:']);
  
  // Determine expansion from path
  const expansion = determineExpansion(sourcePath, filename);
  
  return {
    name,
    type,
    weaponType,
    armorLocation,
    stats,
    keywords,
    affinities,
    effect,
    expansion,
    sourceFile: `${sourcePath}/${filename}`,
  };
}

function extractName(lines: string[], filename: string): string | null {
  // Try first markdown header
  for (const line of lines.slice(0, 5)) {
    if (line.startsWith('#')) {
      const name = line.replace(/^#+\s*/, '').trim();
      if (name.length > 2 && name.length < 50) return name;
    }
    if (line.startsWith('**') && line.endsWith('**')) {
      const name = line.replace(/\*\*/g, '').trim();
      if (name.length > 2 && name.length < 50) return name;
    }
  }
  
  // Fall back to filename
  const cleanName = filename
    .replace(/\.(txt|md)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleanName.length > 2 ? cleanName : null;
}

function determineGearType(text: string): GearCard['type'] {
  const lower = text.toLowerCase();
  
  if (WEAPON_TYPES.some(w => lower.includes(w))) return 'weapon';
  if (ARMOR_LOCATIONS.some(l => lower.includes(l + ' armor') || lower.includes('armor ' + l))) return 'armor';
  if (lower.includes('consumable') || lower.includes('use once')) return 'consumable';
  
  // Check for weapon-like stats
  if (/speed\s*:?\s*\d|accuracy\s*:?\s*\d|strength\s*:?\s*\d/i.test(text)) {
    return 'weapon';
  }
  
  // Check for armor-like stats
  if (/armor\s*:?\s*\d|evasion\s*:?\s*\d/i.test(text)) {
    return 'armor';
  }
  
  return 'item';
}

function extractWeaponType(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const type of WEAPON_TYPES) {
    if (lower.includes(type)) return type;
  }
  return undefined;
}

function extractArmorLocation(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const location of ARMOR_LOCATIONS) {
    if (lower.includes(location)) return location;
  }
  return undefined;
}

function extractGearStats(text: string): GearCard['stats'] {
  const stats: GearCard['stats'] = {};
  
  // Try table format first
  const tableMatch = text.match(/\|\s*(\d+)\s*\|\s*(\d+)\+?\s*\|\s*(\d+)\s*\|/);
  if (tableMatch) {
    stats.speed = parseInt(tableMatch[1], 10);
    stats.accuracy = parseInt(tableMatch[2], 10);
    stats.strength = parseInt(tableMatch[3], 10);
  }
  
  // Try inline format
  const speedMatch = text.match(/speed\s*:?\s*(\d+)/i);
  const accuracyMatch = text.match(/accuracy\s*:?\s*(\d+)/i);
  const strengthMatch = text.match(/strength\s*:?\s*(\d+)/i);
  const armorMatch = text.match(/\barmor\s*:?\s*(\d+)/i);
  const evasionMatch = text.match(/evasion\s*:?\s*(\d+)/i);
  const luckMatch = text.match(/luck\s*:?\s*(\d+)/i);
  
  if (speedMatch) stats.speed = parseInt(speedMatch[1], 10);
  if (accuracyMatch) stats.accuracy = parseInt(accuracyMatch[1], 10);
  if (strengthMatch) stats.strength = parseInt(strengthMatch[1], 10);
  if (armorMatch) stats.armor = parseInt(armorMatch[1], 10);
  if (evasionMatch) stats.evasion = parseInt(evasionMatch[1], 10);
  if (luckMatch) stats.luck = parseInt(luckMatch[1], 10);
  
  return stats;
}

function extractKeywords(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  
  for (const keyword of GEAR_KEYWORDS) {
    // Match whole word with optional number
    const pattern = new RegExp(`\\b${keyword}\\s*\\d*\\b`, 'i');
    const match = lower.match(pattern);
    if (match) {
      found.push(match[0].trim());
    }
  }
  
  return [...new Set(found)]; // Dedupe
}

function extractAffinities(text: string): GearCard['affinities'] {
  const affinities: GearCard['affinities'] = {};
  
  // Count colored squares/references
  const redCount = (text.match(/\bred\b/gi) || []).length;
  const blueCount = (text.match(/\bblue\b/gi) || []).length;
  const greenCount = (text.match(/\bgreen\b/gi) || []).length;
  
  if (redCount > 0) affinities.red = redCount;
  if (blueCount > 0) affinities.blue = blueCount;
  if (greenCount > 0) affinities.green = greenCount;
  
  // Check for directional affinities
  const directions = ['top', 'bottom', 'left', 'right'];
  const requires: string[] = [];
  const provides: string[] = [];
  
  for (const dir of directions) {
    for (const color of ['red', 'blue', 'green']) {
      if (text.toLowerCase().includes(`${color} ${dir}`) || text.toLowerCase().includes(`${dir} ${color}`)) {
        provides.push(`${color}-${dir}`);
      }
      if (text.toLowerCase().includes(`requires ${color}`) || text.toLowerCase().includes(`needs ${color}`)) {
        requires.push(color);
      }
    }
  }
  
  if (requires.length > 0) affinities.requires = requires;
  if (provides.length > 0) affinities.provides = provides;
  
  return affinities;
}

function extractEffectText(text: string, markers: string[]): string {
  const lines = text.split('\n');
  let inEffect = false;
  let effectLines: string[] = [];
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Check if we're starting an effect section
    if (markers.some(m => lowerLine.startsWith(m))) {
      inEffect = true;
      const rest = line.replace(/^[^:]+:\s*/i, '').trim();
      if (rest) effectLines.push(rest);
      continue;
    }
    
    // Check if we're leaving the effect section
    if (inEffect && (line.startsWith('#') || line.startsWith('---') || line.startsWith('|'))) {
      break;
    }
    
    if (inEffect && line.trim()) {
      effectLines.push(line.trim());
    }
  }
  
  // If no markers found, look for key description patterns
  if (effectLines.length === 0) {
    // Find text that looks like an effect description
    const descPattern = /(?:^|\n)([A-Z][^.\n]+(?:\.[^.\n]+)*\.)/;
    const match = text.match(descPattern);
    if (match) {
      effectLines.push(match[1].trim());
    }
  }
  
  return effectLines.join(' ').trim();
}

function determineExpansion(sourcePath: string, filename: string): string {
  const lower = (sourcePath + '/' + filename).toLowerCase();
  
  if (lower.includes('gorm')) return 'Gorm';
  if (lower.includes('dragon-king') || lower.includes('dragonking') || lower.includes('dk-')) return 'Dragon King';
  if (lower.includes('flower-knight') || lower.includes('flower_knight') || lower.includes('fk-')) return 'Flower Knight';
  if (lower.includes('lion-knight') || lower.includes('lion_knight')) return 'Lion Knight';
  if (lower.includes('dung-beetle') || lower.includes('dbk')) return 'Dung Beetle Knight';
  if (lower.includes('lion-god') || lower.includes('liongod')) return 'Lion God';
  if (lower.includes('lonely-tree') || lower.includes('lonely_tree')) return 'Lonely Tree';
  if (lower.includes('manhunter')) return 'Manhunter';
  if (lower.includes('slenderman')) return 'Slenderman';
  if (lower.includes('spidicules')) return 'Spidicules';
  if (lower.includes('sunstalker')) return 'Sunstalker';
  if (lower.includes('gambler') || lower.includes('gc-')) return "Gambler's Chest";
  if (lower.includes('crimson')) return 'Crimson Crocodile';
  if (lower.includes('bone-eater') || lower.includes('bone_eater')) return 'Bone Eater';
  if (lower.includes('smog')) return 'Smog Singers';
  
  return 'Core Game';
}

// =============================================================================
// AI CARD EXTRACTOR
// =============================================================================

export function extractAICard(text: string, filename: string, sourcePath: string): AICard | null {
  // Extract monster name
  const monster = extractMonsterName(filename, text);
  if (!monster) return null;
  
  // Extract card name
  const name = extractAICardName(text, filename);
  if (!name) return null;
  
  // Determine phase
  const phase = determineAIPhase(filename, text);
  
  // Extract targeting
  const targeting = extractTargeting(text);
  
  // Extract stats
  const statsMatch = text.match(/\|\s*(\d+)\s*\|\s*(\d+)\+?\s*\|\s*(\d+)\s*\|/);
  const speed = statsMatch ? parseInt(statsMatch[1], 10) : 0;
  const accuracy = statsMatch ? statsMatch[2] + '+' : '0+';
  const damage = statsMatch ? parseInt(statsMatch[3], 10) : 0;
  
  // Extract trigger
  const triggerMatch = text.match(/trigger\s*\|[\s\S]*?\|([^|]+)\|/i) || text.match(/⚙\s*\*\*([^*]+)\*\*/);
  const trigger = triggerMatch ? triggerMatch[1].trim() : undefined;
  
  // Extract effects
  const effects = extractAIEffects(text);
  
  // Extract failure condition
  const failureMatch = text.match(/⚙\s*\*\*gimped\*\*:?\s*([^\n]+)/i) || text.match(/failure:?\s*([^\n]+)/i);
  const failure = failureMatch ? failureMatch[1].trim() : undefined;
  
  return {
    name,
    monster,
    phase,
    targeting,
    speed,
    accuracy,
    damage,
    trigger,
    effects,
    failure,
    sourceFile: `${sourcePath}/${filename}`,
  };
}

function extractMonsterName(filename: string, text: string): string | null {
  // Try filename first (e.g., "Gorm-AI_A---Charge.txt")
  const filenameMatch = filename.match(/^([A-Za-z]+)[-_]AI/i);
  if (filenameMatch) {
    return filenameMatch[1];
  }
  
  // Try text patterns
  const textMatch = text.match(/the\s+(\w+)\s+(?:is|attacks|moves)/i);
  if (textMatch) {
    return textMatch[1];
  }
  
  return null;
}

function extractAICardName(text: string, filename: string): string | null {
  // Try bold header in text
  const boldMatch = text.match(/^\*\*([^*]+)\*\*/m);
  if (boldMatch && boldMatch[1].length < 30) {
    return boldMatch[1].trim();
  }
  
  // Try extracting from filename (e.g., "Gorm-AI_A---Charge.txt")
  const filenameMatch = filename.match(/---([^.]+)\./);
  if (filenameMatch) {
    return filenameMatch[1].replace(/-/g, ' ').trim();
  }
  
  return null;
}

function determineAIPhase(filename: string, text: string): AICard['phase'] {
  const lower = (filename + ' ' + text).toLowerCase();
  
  if (lower.includes('_l-') || lower.includes('_l_') || lower.includes('legendary')) return 'legendary';
  if (lower.includes('_s-') || lower.includes('_s_') || lower.includes('special')) return 'special';
  if (lower.includes('_b-') || lower.includes('_b_') || lower.includes('advanced')) return 'advanced';
  
  return 'basic';
}

function extractTargeting(text: string): AICard['targeting'] {
  const targeting: AICard['targeting'] = {
    primary: 'closest threat',
  };
  
  // Look for Pick Target section
  const pickTargetMatch = text.match(/pick\s+target[\s\S]*?(?=---|\n\n|move\s*&?\s*attack)/i);
  if (pickTargetMatch) {
    const section = pickTargetMatch[0];
    const lines = section.split('\n').map(l => l.trim()).filter(l => l.startsWith('•') || l.startsWith('-'));
    
    if (lines.length >= 1) {
      targeting.primary = lines[0].replace(/^[•-]\s*/, '').trim();
    }
    if (lines.length >= 2) {
      targeting.fallback = lines[1].replace(/^[•-]\s*/, '').trim();
    }
    
    // Check for no target action
    const noTargetMatch = section.match(/no\s+target:\s*\*?\*?(\w+)/i);
    if (noTargetMatch) {
      targeting.noTarget = noTargetMatch[1].trim();
    }
  }
  
  return targeting;
}

function extractAIEffects(text: string): string[] {
  const effects: string[] = [];
  
  // Look for effects marked with ⚙ or after damage
  const effectPattern = /⚙\s*([^⚙\n]+)/g;
  let match;
  while ((match = effectPattern.exec(text)) !== null) {
    const effect = match[1].replace(/\*\*/g, '').trim();
    if (effect.length > 5 && !effect.toLowerCase().includes('gimped')) {
      effects.push(effect);
    }
  }
  
  // Look for trigger effects
  const triggerMatch = text.match(/trigger\s*\|[\s\S]*?\n([^\n|]+)/i);
  if (triggerMatch) {
    effects.push(triggerMatch[1].trim());
  }
  
  // Look for movement effects
  const moveMatch = text.match(/full\s+move\s+towards?\s+([^\n.]+)/i);
  if (moveMatch) {
    effects.push(`Full move towards ${moveMatch[1].trim()}`);
  }
  
  return effects;
}

// =============================================================================
// HUNT EVENT EXTRACTOR
// =============================================================================

export function extractHuntEvents(text: string, filename: string, sourcePath: string): HuntEvent[] {
  const events: HuntEvent[] = [];
  
  // Look for numbered event patterns
  const eventPattern = /(\d+)\s*\|\s*([^\n]+)\n([\s\S]*?)(?=\n\d+\s*\||$)/g;
  let match;
  
  while ((match = eventPattern.exec(text)) !== null) {
    const number = parseInt(match[1], 10);
    const name = match[2].trim();
    const content = match[3];
    
    const event: HuntEvent = {
      number,
      name,
      description: extractEventDescription(content),
      rolls: extractRollResults(content),
      sourceFile: `${sourcePath}/${filename}`,
    };
    
    // Try to extract page number from filename
    const pageMatch = filename.match(/(\d+)/);
    if (pageMatch) {
      event.pageNumber = parseInt(pageMatch[1], 10);
    }
    
    events.push(event);
  }
  
  // If no structured events found, try to parse free-form text
  if (events.length === 0) {
    const freeFormEvent = extractFreeFormEvent(text, filename, sourcePath);
    if (freeFormEvent) {
      events.push(freeFormEvent);
    }
  }
  
  return events;
}

function extractEventDescription(text: string): string {
  // Get text before first roll table
  const beforeRoll = text.split(/1d10|roll/i)[0];
  return beforeRoll.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function extractRollResults(text: string): HuntEvent['rolls'] {
  const rolls: HuntEvent['rolls'] = [];
  
  // Pattern for roll results like "1-3: result" or "| 1-3 | result |"
  const rollPattern = /(\d+)\s*[-–]\s*(\d+)\s*[:|]\s*([^\n|]+)/g;
  let match;
  
  while ((match = rollPattern.exec(text)) !== null) {
    rolls.push({
      range: `${match[1]}-${match[2]}`,
      result: match[3].trim(),
    });
  }
  
  // Also check for "X+" patterns
  const plusPattern = /(\d+)\s*\+\s*[:|]?\s*([^\n|]+)/g;
  while ((match = plusPattern.exec(text)) !== null) {
    rolls.push({
      range: `${match[1]}+`,
      result: match[2].trim(),
    });
  }
  
  return rolls;
}

function extractFreeFormEvent(text: string, filename: string, sourcePath: string): HuntEvent | null {
  // Try to extract a single event from unstructured text
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 3) return null;
  
  // First non-metadata line is likely the name
  let name = '';
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#') && !line.startsWith('Source:') && !line.startsWith('Processed:') && !line.startsWith('Tokens:')) {
      name = line.replace(/^\*\*|\*\*$/g, '').trim();
      startIndex = i + 1;
      break;
    }
  }
  
  if (!name) return null;
  
  return {
    number: 0, // Unknown number
    name,
    description: lines.slice(startIndex).join(' ').replace(/\s+/g, ' ').trim().slice(0, 500),
    rolls: extractRollResults(text),
    sourceFile: `${sourcePath}/${filename}`,
  };
}

// =============================================================================
// MAIN EXTRACTION FUNCTION
// =============================================================================

/**
 * Extract structured content from text based on its classified type
 */
export function extractContent(
  text: string,
  filename: string,
  sourcePath: string
): ExtractedContent {
  const classification = classifyContentWithContext(text, filename, sourcePath);
  
  switch (classification.type) {
    case 'gear_card': {
      const data = extractGearCard(text, filename, sourcePath);
      if (data) {
        return { type: 'gear_card', data };
      }
      break;
    }
    
    case 'ai_card': {
      const data = extractAICard(text, filename, sourcePath);
      if (data) {
        return { type: 'ai_card', data };
      }
      break;
    }
    
    case 'hunt_event': {
      const data = extractHuntEvents(text, filename, sourcePath);
      if (data.length > 0) {
        return { type: 'hunt_event', data };
      }
      break;
    }
    
    // For other types, return general extraction
    case 'story_event':
    case 'settlement_location':
    case 'fighting_art':
    case 'disorder':
    default:
      break;
  }
  
  // Fallback to general extraction
  return {
    type: 'general',
    data: {
      text,
      summary: text.slice(0, 300).replace(/\s+/g, ' ').trim(),
    },
  };
}

/**
 * Batch extract content from multiple files
 */
export function batchExtract(
  files: Array<{ text: string; filename: string; sourcePath: string }>
): Map<string, ExtractedContent> {
  const results = new Map<string, ExtractedContent>();
  
  for (const { text, filename, sourcePath } of files) {
    const key = `${sourcePath}/${filename}`;
    results.set(key, extractContent(text, filename, sourcePath));
  }
  
  return results;
}

/**
 * Get all gear cards from extracted content
 */
export function filterGearCards(extractions: Map<string, ExtractedContent>): GearCard[] {
  const gearCards: GearCard[] = [];
  
  for (const extraction of extractions.values()) {
    if (extraction.type === 'gear_card') {
      gearCards.push(extraction.data);
    }
  }
  
  return gearCards;
}

/**
 * Get all AI cards from extracted content
 */
export function filterAICards(extractions: Map<string, ExtractedContent>): AICard[] {
  const aiCards: AICard[] = [];
  
  for (const extraction of extractions.values()) {
    if (extraction.type === 'ai_card') {
      aiCards.push(extraction.data);
    }
  }
  
  return aiCards;
}

/**
 * Get all hunt events from extracted content
 */
export function filterHuntEvents(extractions: Map<string, ExtractedContent>): HuntEvent[] {
  const huntEvents: HuntEvent[] = [];
  
  for (const extraction of extractions.values()) {
    if (extraction.type === 'hunt_event') {
      huntEvents.push(...extraction.data);
    }
  }
  
  return huntEvents;
}

