import { LoreEntry, CategoryInfo, LoreCategory } from '@/types/lore';

// Base categories with icons
export const categories: CategoryInfo[] = [
  {
    id: 'monster',
    name: 'Monsters',
    description: 'The nightmarish creatures that hunt and are hunted in the darkness',
    icon: '🦴',
    count: 0,
  },
  {
    id: 'location',
    name: 'Locations',
    description: 'Places of darkness, wonder, and terror in the world',
    icon: '🏛️',
    count: 0,
  },
  {
    id: 'character',
    name: 'Characters',
    description: 'Notable survivors, heroes, and figures of legend',
    icon: '⚔️',
    count: 0,
  },
  {
    id: 'faction',
    name: 'Factions',
    description: 'Organizations, cults, and groups that shape the world',
    icon: '🏴',
    count: 0,
  },
  {
    id: 'settlement',
    name: 'Settlements',
    description: 'The fragile bastions of humanity against the darkness',
    icon: '🏕️',
    count: 0,
  },
  {
    id: 'item',
    name: 'Items & Gear',
    description: 'Weapons, armor, and artifacts crafted from monsters',
    icon: '🗡️',
    count: 0,
  },
  {
    id: 'event',
    name: 'Events',
    description: 'Story events, hunt events, and settlement occurrences',
    icon: '📜',
    count: 0,
  },
  {
    id: 'philosophy',
    name: 'Philosophies',
    description: 'The beliefs and ways of life that guide survivors',
    icon: '✨',
    count: 0,
  },
  {
    id: 'entity',
    name: 'Entities',
    description: 'Gods, ancient beings, and cosmic horrors',
    icon: '👁️',
    count: 0,
  },
  {
    id: 'concept',
    name: 'Concepts',
    description: 'Core ideas, phenomena, and mechanics of the world',
    icon: '💡',
    count: 0,
  },
  {
    id: 'technology',
    name: 'Technology',
    description: 'Crafting systems, innovations, and artifacts',
    icon: '⚙️',
    count: 0,
  },
];

// Seed lore entries - these serve as fallback and examples
export const seedLoreEntries: LoreEntry[] = [
  // MONSTERS
  {
    id: 'white-lion',
    slug: 'white-lion',
    title: 'White Lion',
    category: 'monster',
    monsterType: 'quarry',
    level: 1,
    summary: 'The first quarry encountered by most survivors. A massive feline predator that stalks the darkness, its mane glowing faintly in the void.',
    content: `The White Lion is often the first true monster encountered by fledgling settlements. This massive beast prowls the endless darkness, an apex predator in a world filled with horrors far greater than itself.

Despite its terrifying nature, the White Lion represents something almost hopeful in the world of Kingdom Death—it can be hunted, it can be killed, and its remains can be crafted into tools for survival. Many settlements owe their early existence to the resources harvested from these creatures.

The White Lion's most distinctive feature is its luminescent mane, which provides a soft glow in the otherwise absolute darkness. Some survivors theorize this glow serves to attract prey, while others believe it is a remnant of some ancient connection to the entity known as the Gold Smoke Knight.

## Behavior
White Lions are territorial and aggressive. They will stalk survivors for extended periods before attacking, seemingly enjoying the fear they instill. Their intelligence should not be underestimated—they have been known to set ambushes and target the weakest members of a hunting party.

## Significance
For many settlements, the first successful White Lion hunt marks a turning point. The creature's hide, bones, and organs provide essential materials for crafting basic weapons and armor. The "Founding Stone" that survivors awaken with can be used to craft a rudimentary spear or knife—just enough to give them a fighting chance against this beast.`,
    quotes: [
      '"In the darkness, we saw its mane glow. In that moment, we knew we were no longer alone."',
      '"The lion teaches us our first lesson: in this world, everything wants to kill you. But some things, you can kill back."'
    ],
    tags: ['quarry', 'level-1', 'core-game', 'beast', 'starting-monster'],
    connections: [
      { id: 'screaming-antelope', type: 'related', description: 'Fellow early-game quarry' },
      { id: 'gold-smoke-knight', type: 'related', description: 'Possible connection through luminescence' },
    ],
    sources: [
      { name: 'Core Game Rulebook', type: 'rulebook', verified: true },
      { name: "White Lion Hunt Event Cards", type: 'rulebook', verified: true },
    ],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    confidence: 'confirmed',
  },
  {
    id: 'butcher',
    slug: 'butcher',
    title: 'The Butcher',
    category: 'monster',
    monsterType: 'nemesis',
    level: 1,
    summary: 'A towering humanoid figure in blood-soaked robes, wielding massive cleavers. The Butcher seeks out settlements to harvest survivors.',
    content: `The Butcher represents one of the most personal threats a settlement can face. Unlike quarries that must be sought out, Nemesis monsters come to the settlement—and the Butcher comes with singular purpose: to harvest.

## Appearance
The Butcher is a massive humanoid figure, standing several times the height of a normal survivor. It wears heavy robes permanently stained with the blood of countless victims, and its face is hidden behind a disturbing mask. Most terrifying are its weapons: two enormous cleavers that it uses with disturbing precision.

## The Harvest
The Butcher does not kill randomly. It selects survivors with care, seeming to evaluate them before making its choice. Those it takes are never seen again—or if they are, they have been transformed into something unrecognizable.`,
    quotes: [
      '"It did not speak. It did not need to. Its cleavers spoke for it."',
      '"We killed it. We celebrated. Then, a lantern year later, we heard the familiar footsteps."'
    ],
    tags: ['nemesis', 'level-1', 'core-game', 'humanoid', 'recurring'],
    sources: [
      { name: 'Core Game Rulebook', type: 'rulebook', verified: true },
    ],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    confidence: 'confirmed',
  },

  // ENTITIES
  {
    id: 'gold-smoke-knight',
    slug: 'gold-smoke-knight',
    title: 'Gold Smoke Knight',
    category: 'entity',
    summary: 'A legendary figure of gleaming gold armor, wreathed in strange smoke. The Gold Smoke Knight is spoken of in hushed whispers as both savior and destroyer.',
    content: `The Gold Smoke Knight is one of the most enigmatic figures in Kingdom Death lore. Clad in armor of purest gold and surrounded by ethereal golden smoke, this being appears at moments of great significance—though whether to help or hinder is never clear.

## Origins
The origins of the Gold Smoke Knight are unknown. Some believe it to be a survivor who achieved transcendence, becoming something more than human. Others claim it is an ancient entity that has always existed.

## The Golden Armor
The Gold Smoke Knight's armor is said to be indestructible and unimaginably valuable. It gleams with an inner light that seems to defy the surrounding darkness.`,
    quotes: [
      '"I saw it standing at the edge of the light. It looked at me, and I knew—I KNEW—everything I believed was wrong."',
      '"Gold that burns. Smoke that whispers. A knight that serves no king."'
    ],
    tags: ['entity', 'legendary', 'core-game', 'mysterious'],
    sources: [
      { name: 'Core Game Rulebook', type: 'rulebook', verified: true },
    ],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    confidence: 'likely',
  },

  // LOCATIONS
  {
    id: 'lantern-hoard',
    slug: 'lantern-hoard',
    title: 'The Lantern Hoard',
    category: 'location',
    summary: 'The central gathering place where survivors first awaken. A pile of stone faces surrounding a lone lantern—the first light in a world of darkness.',
    content: `The Lantern Hoard is where everything begins. In the absolute darkness of the Kingdom Death world, survivors awaken with no memory, no identity, and no understanding of where they are. They find themselves near a towering pile of stone faces, each carved with serene expressions, surrounding a single lantern that provides the only light in existence.

## The Stone Faces
The stone faces of the Lantern Hoard are ancient beyond measuring. They seem to have been deliberately placed, stacked in a cairn-like formation. Each face is unique.

## The Lantern
At the center of the Hoard sits a single lantern. This lantern provides light where no light should be possible.`,
    quotes: [
      '"We awoke to light. Just a flicker, but enough. The faces watched us with stone eyes."',
    ],
    tags: ['location', 'core-game', 'settlement', 'starting-location'],
    sources: [
      { name: 'Core Game Rulebook', type: 'rulebook', verified: true },
    ],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    confidence: 'confirmed',
  },

  // PHILOSOPHIES
  {
    id: 'people-of-the-lantern',
    slug: 'people-of-the-lantern',
    title: 'People of the Lantern',
    category: 'philosophy',
    summary: 'The default philosophy of survivors who gather around the Lantern Hoard. They believe in the power of light and community to survive the darkness.',
    content: `The People of the Lantern represent the default path of survival in Kingdom Death. They gather around the lantern light, build their settlement outward from the Lantern Hoard, and believe that together, humanity can endure.

## Core Beliefs
The People of the Lantern hold that light is sacred—the only defense against the absolute darkness that surrounds them.`,
    tags: ['philosophy', 'core-game', 'default', 'survival'],
    sources: [
      { name: 'Core Game Rulebook', type: 'rulebook', verified: true },
    ],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    confidence: 'confirmed',
  },
];

// This will be populated at runtime - NOTE: cache disabled for dev to pick up new entries
let _loreEntries: LoreEntry[] | null = null;

/**
 * Clear the lore entries cache (useful after agent generates new content)
 */
export function clearLoreCache(): void {
  _loreEntries = null;
}

/**
 * Get all lore entries - loads from docs on server, uses seed data on client
 */
export function getLoreEntries(): LoreEntry[] {
  // In development, always reload to pick up new entries
  if (process.env.NODE_ENV === 'development') {
    _loreEntries = null;
  }
  
  // Return cached if available
  if (_loreEntries) {
    return _loreEntries;
  }

  // On the server, try to load from docs
  if (typeof window === 'undefined') {
    try {
      // Dynamic import to avoid bundling issues
      const { loadLoreFromDocs } = require('@/lib/markdown');
      const docsEntries = loadLoreFromDocs();
      
      if (docsEntries.length > 0) {
        // Merge with seed entries, preferring docs versions
        const docsIds = new Set(docsEntries.map((e: LoreEntry) => e.id));
        const uniqueSeedEntries = seedLoreEntries.filter(e => !docsIds.has(e.id));
        _loreEntries = [...docsEntries, ...uniqueSeedEntries];
        return _loreEntries;
      }
    } catch (error) {
      console.warn('Could not load lore from docs:', error);
    }
  }

  // Fallback to seed entries
  _loreEntries = seedLoreEntries;
  return _loreEntries;
}

// Export for direct access (will use seed data on initial load)
export const loreEntries = seedLoreEntries;

// Calculate category counts
export const categoriesWithCounts = categories.map(cat => ({
  ...cat,
  count: seedLoreEntries.filter(entry => entry.category === cat.id).length,
}));

// Helper functions
export function getLoreByCategory(category: LoreCategory): LoreEntry[] {
  return getLoreEntries().filter(entry => entry.category === category);
}

export function getLoreBySlug(slug: string): LoreEntry | undefined {
  return getLoreEntries().find(entry => entry.slug === slug);
}

export function getLoreById(id: string): LoreEntry | undefined {
  return getLoreEntries().find(entry => entry.id === id);
}

export function searchLore(query: string): LoreEntry[] {
  const lowerQuery = query.toLowerCase();
  return getLoreEntries().filter(entry => 
    entry.title.toLowerCase().includes(lowerQuery) ||
    entry.summary.toLowerCase().includes(lowerQuery) ||
    entry.content.toLowerCase().includes(lowerQuery) ||
    entry.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

export function getRelatedLore(entryId: string): LoreEntry[] {
  const entry = getLoreById(entryId);
  if (!entry?.connections) return [];
  
  return entry.connections
    .map(conn => getLoreById(conn.id))
    .filter((e): e is LoreEntry => e !== undefined);
}

/**
 * Get updated category counts based on all loaded entries
 */
export function getCategoriesWithCounts(): CategoryInfo[] {
  const entries = getLoreEntries();
  return categories.map(cat => ({
    ...cat,
    count: entries.filter(entry => entry.category === cat.id).length,
  }));
}
