/**
 * Relationship Mapper - Discovers and tracks connections between KDM entities
 * 
 * Maps relationships like:
 * - Monsters -> Gear they drop
 * - Monsters -> AI cards they use
 * - Monsters -> Hunt/Story events that mention them
 * - Characters -> Factions they belong to
 * - Locations -> What exists there
 */

import fs from 'fs';
import path from 'path';
import { getAllSourceFiles, SourceFile } from './entity-discovery';
import { extractContent, GearCard, AICard, HuntEvent } from './content-extractors';

const LORE_PATH = path.join(process.cwd(), 'docs', 'lore');

// =============================================================================
// TYPES
// =============================================================================

export type RelationshipType = 
  | 'drops_gear'       // Monster -> Gear
  | 'has_ai_card'      // Monster -> AI Card
  | 'appears_in_event' // Entity -> Event
  | 'located_at'       // Entity -> Location
  | 'member_of'        // Character -> Faction
  | 'related_to'       // General connection
  | 'opposes'          // Faction -> Faction
  | 'created_by'       // Item/Entity -> Creator
  | 'hunts'            // Monster -> What it preys on
  | 'expansion_of';    // Entity -> Expansion

export interface Relationship {
  sourceEntity: string;
  targetEntity: string;
  type: RelationshipType;
  confidence: 'confirmed' | 'likely' | 'speculative';
  sourceFile?: string;
  description?: string;
}

export interface EntityRelationships {
  entityName: string;
  category: string;
  incomingRelations: Relationship[];
  outgoingRelations: Relationship[];
  relatedGear: GearCard[];
  relatedAICards: AICard[];
  relatedEvents: HuntEvent[];
}

// =============================================================================
// MONSTER MAPPINGS (Known relationships)
// =============================================================================

const MONSTER_GEAR_MAPPING: Record<string, string[]> = {
  'white lion': ['white lion armor', 'lion skin', 'lion claw', 'lion headdress', 'whisker harp'],
  'gorm': ['gorm armor', 'gorm brain', 'regeneration suit', 'rib blade', 'black sword'],
  'screaming antelope': ['rawhide armor', 'bandages', 'drums', 'monster grease'],
  'phoenix': ['phoenix armor', 'feather shield', 'hollow sword', 'phoenix gauntlet'],
  'dragon king': ['dragon armor', 'dragonskull helm', 'dragon vestments', 'blast sword'],
  'flower knight': ['flower knight armor', 'vespertine bow', 'vespertine foil'],
  'lion knight': ['lion knight armor', 'calcified greaves', 'lion knight helm'],
  'dung beetle knight': ['dbk armor', 'calcified greaves', 'trash crown'],
  'sunstalker': ['sunstalker armor', 'sun vestments', 'sunspot lantern'],
  'spidicules': ['silk armor', 'web silk', 'throwing knives'],
  'butcher': ['butcher cleaver', 'lantern glaive'],
  'king': ['kings crown', 'kings blessing'],
  'watcher': ['watcher armor', 'eye patch'],
  'lion god': ['god armor'],
  'slenderman': ['dark water'],
  'manhunter': ['manhunter gear'],
};

const MONSTER_EXPANSION_MAPPING: Record<string, string> = {
  'white lion': 'Core Game',
  'screaming antelope': 'Core Game',
  'phoenix': 'Core Game',
  'butcher': 'Core Game',
  'king': 'Core Game',
  'watcher': 'Core Game',
  'gorm': 'Gorm',
  'dragon king': 'Dragon King',
  'flower knight': 'Flower Knight',
  'lion knight': 'Lion Knight',
  'dung beetle knight': 'Dung Beetle Knight',
  'sunstalker': 'Sunstalker',
  'spidicules': 'Spidicules',
  'lion god': 'Lion God',
  'manhunter': 'Manhunter',
  'slenderman': 'Slenderman',
  'lonely tree': 'Lonely Tree',
  'crimson crocodile': "Gambler's Chest",
  'smog singers': "Gambler's Chest",
  'bone eater': "Gambler's Chest",
};

// =============================================================================
// RELATIONSHIP DISCOVERY
// =============================================================================

/**
 * Find all relationships for a given entity
 */
export function findRelationshipsForEntity(entityName: string): EntityRelationships {
  const lowerName = entityName.toLowerCase();
  const allSources = getAllSourceFiles();
  
  const result: EntityRelationships = {
    entityName,
    category: determineCategory(entityName),
    incomingRelations: [],
    outgoingRelations: [],
    relatedGear: [],
    relatedAICards: [],
    relatedEvents: [],
  };
  
  // Find gear relationships from known mappings
  const gearNames = MONSTER_GEAR_MAPPING[lowerName] || [];
  for (const gear of gearNames) {
    result.outgoingRelations.push({
      sourceEntity: entityName,
      targetEntity: gear,
      type: 'drops_gear',
      confidence: 'confirmed',
      description: `${entityName} drops materials for ${gear}`,
    });
  }
  
  // Find expansion relationship
  const expansion = MONSTER_EXPANSION_MAPPING[lowerName];
  if (expansion) {
    result.outgoingRelations.push({
      sourceEntity: entityName,
      targetEntity: expansion,
      type: 'expansion_of',
      confidence: 'confirmed',
      description: `${entityName} is part of ${expansion}`,
    });
  }
  
  // Scan sources for additional relationships
  for (const source of allSources) {
    const lowerContent = source.content.toLowerCase();
    
    // Skip if this source doesn't mention the entity
    if (!lowerContent.includes(lowerName)) continue;
    
    // Extract content type
    const extracted = extractContent(source.content, source.name, source.relativePath);
    
    // Handle AI cards
    if (extracted.type === 'ai_card') {
      const aiCard = extracted.data;
      if (aiCard.monster.toLowerCase() === lowerName || lowerContent.includes(lowerName)) {
        result.relatedAICards.push(aiCard);
        result.outgoingRelations.push({
          sourceEntity: entityName,
          targetEntity: aiCard.name,
          type: 'has_ai_card',
          confidence: 'confirmed',
          sourceFile: source.relativePath,
          description: `${entityName} uses ${aiCard.name} (${aiCard.phase})`,
        });
      }
    }
    
    // Handle gear cards
    if (extracted.type === 'gear_card') {
      const gearCard = extracted.data;
      if (lowerContent.includes(lowerName)) {
        result.relatedGear.push(gearCard);
        // Check if gear is related to this monster
        if (gearCard.expansion.toLowerCase().includes(lowerName) || 
            gearCard.name.toLowerCase().includes(lowerName)) {
          result.outgoingRelations.push({
            sourceEntity: entityName,
            targetEntity: gearCard.name,
            type: 'drops_gear',
            confidence: 'likely',
            sourceFile: source.relativePath,
            description: `${entityName} likely provides materials for ${gearCard.name}`,
          });
        }
      }
    }
    
    // Handle hunt events
    if (extracted.type === 'hunt_event') {
      for (const event of extracted.data) {
        if (event.name.toLowerCase().includes(lowerName) || 
            event.description.toLowerCase().includes(lowerName)) {
          result.relatedEvents.push(event);
          result.outgoingRelations.push({
            sourceEntity: entityName,
            targetEntity: `Hunt Event ${event.number}: ${event.name}`,
            type: 'appears_in_event',
            confidence: 'confirmed',
            sourceFile: source.relativePath,
          });
        }
      }
    }
  }
  
  // Find incoming relationships (other entries that link to this one)
  result.incomingRelations = findIncomingRelationships(entityName);
  
  return result;
}

/**
 * Find entries that reference a given entity
 */
function findIncomingRelationships(entityName: string): Relationship[] {
  const incoming: Relationship[] = [];
  const lowerName = entityName.toLowerCase();
  
  const categories = [
    '01-world', '02-factions', '03-locations', '04-monsters',
    '05-characters', '06-concepts', '07-technology', '08-theories',
  ];
  
  for (const category of categories) {
    const categoryPath = path.join(LORE_PATH, category);
    if (!fs.existsSync(categoryPath)) continue;
    
    const files = fs.readdirSync(categoryPath);
    
    for (const file of files) {
      if (!file.endsWith('.md') || file.startsWith('_')) continue;
      
      const filePath = path.join(categoryPath, file);
      const content = fs.readFileSync(filePath, 'utf-8').toLowerCase();
      
      // Skip self-references
      const entryName = file.replace('.md', '').replace(/-/g, ' ');
      if (entryName.toLowerCase() === lowerName) continue;
      
      // Check if this entry mentions our entity
      if (content.includes(lowerName)) {
        // Determine relationship type based on content
        const type = inferRelationshipType(content, lowerName, category);
        
        incoming.push({
          sourceEntity: entryName,
          targetEntity: entityName,
          type,
          confidence: 'likely',
          sourceFile: filePath,
        });
      }
    }
  }
  
  return incoming;
}

/**
 * Infer relationship type from content
 */
function inferRelationshipType(content: string, entityName: string, category: string): RelationshipType {
  const lower = content.toLowerCase();
  
  // Check for specific patterns
  if (lower.includes(`created ${entityName}`) || lower.includes(`built ${entityName}`)) {
    return 'created_by';
  }
  if (lower.includes(`member of ${entityName}`) || lower.includes(`belongs to ${entityName}`)) {
    return 'member_of';
  }
  if (lower.includes(`fights ${entityName}`) || lower.includes(`opposes ${entityName}`)) {
    return 'opposes';
  }
  if (lower.includes(`hunts ${entityName}`) || lower.includes(`preys on ${entityName}`)) {
    return 'hunts';
  }
  if (lower.includes(`located at ${entityName}`) || lower.includes(`found in ${entityName}`)) {
    return 'located_at';
  }
  
  return 'related_to';
}

/**
 * Determine entity category from name
 */
function determineCategory(entityName: string): string {
  const lower = entityName.toLowerCase();
  
  // Check against known monsters
  if (Object.keys(MONSTER_GEAR_MAPPING).includes(lower)) {
    return 'monster';
  }
  
  // Check for location indicators
  const locationWords = ['city', 'land', 'plain', 'woods', 'hoard', 'settlement'];
  if (locationWords.some(word => lower.includes(word))) {
    return 'location';
  }
  
  // Check for faction indicators
  const factionWords = ['order', 'cult', 'society', 'collective'];
  if (factionWords.some(word => lower.includes(word))) {
    return 'faction';
  }
  
  return 'concept';
}

// =============================================================================
// RELATIONSHIP GRAPH
// =============================================================================

/**
 * Build a complete relationship graph for all entities
 */
export function buildRelationshipGraph(): Map<string, EntityRelationships> {
  const graph = new Map<string, EntityRelationships>();
  
  const categories = [
    '01-world', '02-factions', '03-locations', '04-monsters',
    '05-characters', '06-concepts',
  ];
  
  for (const category of categories) {
    const categoryPath = path.join(LORE_PATH, category);
    if (!fs.existsSync(categoryPath)) continue;
    
    const files = fs.readdirSync(categoryPath);
    
    for (const file of files) {
      if (!file.endsWith('.md') || file.startsWith('_')) continue;
      
      const filePath = path.join(categoryPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Extract entry name
      const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/title:\s*"?([^"\n]+)"?/);
      const entryName = titleMatch ? titleMatch[1].trim() : file.replace('.md', '').replace(/-/g, ' ');
      
      const relationships = findRelationshipsForEntity(entryName);
      graph.set(entryName.toLowerCase(), relationships);
    }
  }
  
  return graph;
}

/**
 * Find all gear related to a monster
 */
export function findGearForMonster(monsterName: string): GearCard[] {
  const relationships = findRelationshipsForEntity(monsterName);
  return relationships.relatedGear;
}

/**
 * Find all AI cards for a monster
 */
export function findAICardsForMonster(monsterName: string): AICard[] {
  const relationships = findRelationshipsForEntity(monsterName);
  return relationships.relatedAICards;
}

/**
 * Find all events mentioning an entity
 */
export function findEventsForEntity(entityName: string): HuntEvent[] {
  const relationships = findRelationshipsForEntity(entityName);
  return relationships.relatedEvents;
}

/**
 * Get expansion for an entity
 */
export function getExpansionForEntity(entityName: string): string {
  return MONSTER_EXPANSION_MAPPING[entityName.toLowerCase()] || 'Unknown';
}

/**
 * Generate a connections section for an entry
 */
export function generateConnectionsSection(entityName: string): string {
  const relationships = findRelationshipsForEntity(entityName);
  
  if (relationships.outgoingRelations.length === 0 && relationships.incomingRelations.length === 0) {
    return '';
  }
  
  let section = '## Connections\n\n';
  
  // Group outgoing by type
  const byType = new Map<RelationshipType, Relationship[]>();
  for (const rel of relationships.outgoingRelations) {
    if (!byType.has(rel.type)) {
      byType.set(rel.type, []);
    }
    byType.get(rel.type)!.push(rel);
  }
  
  // Format each relationship type
  if (byType.has('drops_gear')) {
    section += '### Related Gear\n';
    for (const rel of byType.get('drops_gear')!) {
      section += `- [${rel.targetEntity}](./gear/${rel.targetEntity.replace(/\s+/g, '-').toLowerCase()}.md)`;
      if (rel.confidence !== 'confirmed') section += ` (${rel.confidence})`;
      section += '\n';
    }
    section += '\n';
  }
  
  if (byType.has('has_ai_card')) {
    section += '### AI Cards\n';
    const cards = byType.get('has_ai_card')!;
    const byPhase = { basic: [] as string[], advanced: [] as string[], legendary: [] as string[], special: [] as string[] };
    for (const rel of cards) {
      const phaseMatch = rel.description?.match(/\((basic|advanced|legendary|special)\)/i);
      const phase = phaseMatch ? phaseMatch[1].toLowerCase() as keyof typeof byPhase : 'basic';
      byPhase[phase].push(rel.targetEntity);
    }
    if (byPhase.basic.length > 0) section += `- **Basic**: ${byPhase.basic.join(', ')}\n`;
    if (byPhase.advanced.length > 0) section += `- **Advanced**: ${byPhase.advanced.join(', ')}\n`;
    if (byPhase.legendary.length > 0) section += `- **Legendary**: ${byPhase.legendary.join(', ')}\n`;
    if (byPhase.special.length > 0) section += `- **Special**: ${byPhase.special.join(', ')}\n`;
    section += '\n';
  }
  
  if (byType.has('appears_in_event')) {
    section += '### Related Events\n';
    for (const rel of byType.get('appears_in_event')!) {
      section += `- ${rel.targetEntity}\n`;
    }
    section += '\n';
  }
  
  if (byType.has('expansion_of')) {
    const expansion = byType.get('expansion_of')![0];
    section += `### Expansion\n- Part of: **${expansion.targetEntity}**\n\n`;
  }
  
  // Add incoming relationships
  if (relationships.incomingRelations.length > 0) {
    section += '### Mentioned By\n';
    const unique = [...new Set(relationships.incomingRelations.map(r => r.sourceEntity))];
    for (const entity of unique.slice(0, 10)) {
      section += `- ${entity}\n`;
    }
    section += '\n';
  }
  
  return section;
}

