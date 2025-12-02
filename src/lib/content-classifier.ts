/**
 * Content Classifier - Detects content type from OCR text patterns
 * Identifies AI cards, gear cards, hunt events, story events, etc.
 */

// =============================================================================
// TYPES
// =============================================================================

export type ContentType = 
  | 'ai_card'
  | 'gear_card'
  | 'hunt_event'
  | 'story_event'
  | 'settlement_location'
  | 'fighting_art'
  | 'disorder'
  | 'monster_info'
  | 'rulebook_page'
  | 'newsletter'
  | 'general';

export interface ClassificationResult {
  type: ContentType;
  confidence: number; // 0-1
  matchedPatterns: string[];
  extractedData?: Record<string, unknown>;
}

// =============================================================================
// PATTERN DEFINITIONS
// =============================================================================

const AI_CARD_PATTERNS = [
  /pick\s+target/i,
  /move\s*&?\s*attack/i,
  /speed\s*\|\s*accuracy\s*\|\s*damage/i,
  /\|\s*speed\s*\|\s*accuracy\s*\|\s*damage\s*\|/i,
  /after\s+damage/i,
  /basic\s+action/i,
  /advanced\s+action/i,
  /legendary\s+action/i,
  /special\s+action/i,
  /persistent\s+injury/i,
  /threat/i,
  /field\s+of\s+view/i,
  /no\s+target:\s*\*?\*?illuminate/i,
  /knockback\s+\d+/i,
  /grab/i,
  /bash/i,
];

const GEAR_CARD_PATTERNS = [
  /\bsharp\b/i,
  /\bdeadly\b/i,
  /\bblock\s*\d+/i,
  /\breach\s*\d+/i,
  /\bfrail\b/i,
  /\birreplaceble\b/i,
  /\bcumbersome\b/i,
  /\bslow\b/i,
  /\bpaired\b/i,
  /\bsentinel\b/i,
  /\bammunition\b/i,
  /affinity/i,
  /\bblue\b.*\bred\b|\bred\b.*\bblue\b/i,
  /\bgreen\b.*affinity|\baffinity\b.*green/i,
  /activation\s*:/i,
  /special\s*:/i,
  /gear\s+keyword/i,
  /\d+\s*strength|\bstrength\s*\d+/i,
  /\d+\s*accuracy|\baccuracy\s*\d+/i,
  /\d+\s*speed|\bspeed\s*\d+/i,
  /weapon\s+type/i,
  /armor\s+set/i,
  /\baxe\b|\bsword\b|\bspear\b|\bbow\b|\bdagger\b|\bwhip\b|\bfist\s*&\s*tooth\b|\bkatar\b|\bscythe\b|\bshield\b/i,
];

const HUNT_EVENT_PATTERNS = [
  /\b1d10\b/i,
  /event\s+revealer/i,
  /\bhunt\s+event\b/i,
  /roll\s+1d10/i,
  /\b\d+\s*[-–]\s*\d+\s*[:|]/i, // Roll ranges like "1-3:", "4-7:"
  /on\s+a\s+\d+\+/i,
  /each\s+survivor\s+rolls/i,
  /the\s+survivors?\s+encounter/i,
  /straggler/i,
  /\|\s*\d+\s*[-–]\s*\d+\s*\|/i, // Table format roll ranges
];

const STORY_EVENT_PATTERNS = [
  /story\s+event/i,
  /\bprologue\b/i,
  /\bepilogue\b/i,
  /read\s+aloud/i,
  /the\s+survivors?\s+(?:find|discover|encounter|see|hear)/i,
  /settlement\s+event/i,
  /milestone/i,
  /victory/i,
  /defeat/i,
  /aftermath/i,
  /\bchoice\s*:/i,
  /\boutcome\s*:/i,
  /trigger\s*:/i,
];

const SETTLEMENT_LOCATION_PATTERNS = [
  /settlement\s+location/i,
  /\bbuild\s+cost\b/i,
  /\bdestroy\s*:/i,
  /\bactivation\s*:/i,
  /\bdeparting\s+survivors\b/i,
  /\breturning\s+survivors\b/i,
  /innovation/i,
  /endeavor/i,
  /\bhide\b.*\bbone\b.*\borgan\b/i, // Resource costs
];

const FIGHTING_ART_PATTERNS = [
  /fighting\s+art/i,
  /\bsecret\s+fighting\s+art\b/i,
  /\bspecial\s+ability\b/i,
  /survivor\s+gains/i,
  /once\s+per\s+(?:round|showdown|lifetime)/i,
  /\bspend\s+survival\b/i,
];

const DISORDER_PATTERNS = [
  /\bdisorder\b/i,
  /\bsevere\s+injury\b/i,
  /\bmental\s+illness\b/i,
  /\bphobia\b/i,
  /\bmania\b/i,
  /\btrauma\b/i,
  /cannot\s+(?:be\s+)?(?:encouraged|inspired)/i,
  /skip\s+next\s+hunt/i,
];

const MONSTER_INFO_PATTERNS = [
  /\bmonster\s+level\b/i,
  /\bhit\s+location\b/i,
  /\bai\s+deck\b/i,
  /\bhit\s+locations?\s+deck\b/i,
  /\bresources?\s+deck\b/i,
  /\bquarry\b/i,
  /\bnemesis\b/i,
  /\bshowdown\b/i,
  /toughness/i,
  /movement/i,
  /damage\s+token/i,
];

// =============================================================================
// CLASSIFICATION FUNCTIONS
// =============================================================================

/**
 * Classify content type from OCR text
 */
export function classifyContent(text: string): ClassificationResult {
  const results: Array<{ type: ContentType; score: number; patterns: string[] }> = [];
  
  // Check AI Card patterns
  const aiMatches = checkPatterns(text, AI_CARD_PATTERNS);
  if (aiMatches.length > 0) {
    results.push({
      type: 'ai_card',
      score: calculateScore(aiMatches.length, AI_CARD_PATTERNS.length, 0.3),
      patterns: aiMatches,
    });
  }
  
  // Check Gear Card patterns
  const gearMatches = checkPatterns(text, GEAR_CARD_PATTERNS);
  if (gearMatches.length > 0) {
    results.push({
      type: 'gear_card',
      score: calculateScore(gearMatches.length, GEAR_CARD_PATTERNS.length, 0.25),
      patterns: gearMatches,
    });
  }
  
  // Check Hunt Event patterns
  const huntMatches = checkPatterns(text, HUNT_EVENT_PATTERNS);
  if (huntMatches.length > 0) {
    results.push({
      type: 'hunt_event',
      score: calculateScore(huntMatches.length, HUNT_EVENT_PATTERNS.length, 0.35),
      patterns: huntMatches,
    });
  }
  
  // Check Story Event patterns
  const storyMatches = checkPatterns(text, STORY_EVENT_PATTERNS);
  if (storyMatches.length > 0) {
    results.push({
      type: 'story_event',
      score: calculateScore(storyMatches.length, STORY_EVENT_PATTERNS.length, 0.3),
      patterns: storyMatches,
    });
  }
  
  // Check Settlement Location patterns
  const locationMatches = checkPatterns(text, SETTLEMENT_LOCATION_PATTERNS);
  if (locationMatches.length > 0) {
    results.push({
      type: 'settlement_location',
      score: calculateScore(locationMatches.length, SETTLEMENT_LOCATION_PATTERNS.length, 0.35),
      patterns: locationMatches,
    });
  }
  
  // Check Fighting Art patterns
  const fightingArtMatches = checkPatterns(text, FIGHTING_ART_PATTERNS);
  if (fightingArtMatches.length > 0) {
    results.push({
      type: 'fighting_art',
      score: calculateScore(fightingArtMatches.length, FIGHTING_ART_PATTERNS.length, 0.4),
      patterns: fightingArtMatches,
    });
  }
  
  // Check Disorder patterns
  const disorderMatches = checkPatterns(text, DISORDER_PATTERNS);
  if (disorderMatches.length > 0) {
    results.push({
      type: 'disorder',
      score: calculateScore(disorderMatches.length, DISORDER_PATTERNS.length, 0.35),
      patterns: disorderMatches,
    });
  }
  
  // Check Monster Info patterns
  const monsterMatches = checkPatterns(text, MONSTER_INFO_PATTERNS);
  if (monsterMatches.length > 0) {
    results.push({
      type: 'monster_info',
      score: calculateScore(monsterMatches.length, MONSTER_INFO_PATTERNS.length, 0.25),
      patterns: monsterMatches,
    });
  }
  
  // Sort by score and return best match
  results.sort((a, b) => b.score - a.score);
  
  if (results.length > 0 && results[0].score >= 0.3) {
    return {
      type: results[0].type,
      confidence: results[0].score,
      matchedPatterns: results[0].patterns,
    };
  }
  
  // Fallback classification based on source path or general content
  return {
    type: 'general',
    confidence: 0.5,
    matchedPatterns: [],
  };
}

/**
 * Check which patterns match in the text
 */
function checkPatterns(text: string, patterns: RegExp[]): string[] {
  const matched: string[] = [];
  
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      matched.push(pattern.source);
    }
  }
  
  return matched;
}

/**
 * Calculate confidence score
 */
function calculateScore(matchCount: number, totalPatterns: number, minThreshold: number): number {
  const ratio = matchCount / totalPatterns;
  // Boost score for multiple matches, cap at 1.0
  const boosted = Math.min(ratio * 2, 1.0);
  return boosted >= minThreshold ? boosted : ratio;
}

/**
 * Classify content with additional context from filename
 */
export function classifyContentWithContext(
  text: string,
  filename: string,
  sourcePath: string
): ClassificationResult {
  // First, try to infer from filename/path
  const lowerFilename = filename.toLowerCase();
  const lowerPath = sourcePath.toLowerCase();
  
  // AI Card detection from filename
  if (lowerFilename.includes('-ai_') || lowerFilename.includes('_ai-') || lowerFilename.includes('-ai-')) {
    const result = classifyContent(text);
    if (result.type === 'ai_card' || result.confidence < 0.5) {
      return {
        type: 'ai_card',
        confidence: Math.max(0.8, result.confidence),
        matchedPatterns: [...result.matchedPatterns, 'filename:ai_card'],
      };
    }
  }
  
  // Gear Card detection from filename
  if (lowerFilename.includes('gear') || lowerPath.includes('gear')) {
    const result = classifyContent(text);
    if (result.type === 'gear_card' || result.confidence < 0.5) {
      return {
        type: 'gear_card',
        confidence: Math.max(0.7, result.confidence),
        matchedPatterns: [...result.matchedPatterns, 'filename:gear'],
      };
    }
  }
  
  // Hunt Event detection from path
  if (lowerPath.includes('rulebook') && text.toLowerCase().includes('1d10')) {
    const result = classifyContent(text);
    if (result.type === 'hunt_event' || result.confidence < 0.5) {
      return {
        type: 'hunt_event',
        confidence: Math.max(0.7, result.confidence),
        matchedPatterns: [...result.matchedPatterns, 'context:rulebook_event'],
      };
    }
  }
  
  // Newsletter detection from path
  if (lowerPath.includes('newsletter') || lowerPath.includes('kickstarter')) {
    const result = classifyContent(text);
    if (result.type === 'general') {
      return {
        type: 'newsletter',
        confidence: 0.7,
        matchedPatterns: ['context:newsletter_path'],
      };
    }
    return result;
  }
  
  // Rulebook page detection from path
  if (lowerPath.includes('rulebook') || lowerFilename.startsWith('rulebook_')) {
    const result = classifyContent(text);
    if (result.type === 'general') {
      return {
        type: 'rulebook_page',
        confidence: 0.7,
        matchedPatterns: ['context:rulebook_path'],
      };
    }
    return result;
  }
  
  return classifyContent(text);
}

/**
 * Extract monster name from AI card content
 */
export function extractMonsterFromAICard(text: string, filename: string): string | null {
  // Try to extract from filename first (e.g., "Gorm-AI_A---Charge.txt")
  const filenameMatch = filename.match(/^([A-Za-z\s]+)[-_]AI/i);
  if (filenameMatch) {
    return filenameMatch[1].replace(/[-_]/g, ' ').trim();
  }
  
  // Try to extract from text content
  const monsterPatterns = [
    /the\s+(\w+)\s+(?:is|attacks|moves)/i,
    /(\w+)'s\s+(?:den|lair|territory)/i,
    /^\*\*(\w+)\*\*$/m, // Bold name at start
  ];
  
  for (const pattern of monsterPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Extract gear name from gear card content
 */
export function extractGearName(text: string, filename: string): string | null {
  // Try filename first
  const cleanFilename = filename
    .replace(/\.(txt|md)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\bgear\b/gi, '')
    .trim();
  
  if (cleanFilename.length > 2 && cleanFilename.length < 50) {
    return cleanFilename;
  }
  
  // Try first bold text or header
  const headerMatch = text.match(/^(?:#\s*|\*\*)([\w\s]+?)(?:\*\*|$)/m);
  if (headerMatch) {
    return headerMatch[1].trim();
  }
  
  return null;
}

/**
 * Batch classify multiple content pieces
 */
export function batchClassify(
  contents: Array<{ text: string; filename: string; sourcePath: string }>
): Map<string, ClassificationResult> {
  const results = new Map<string, ClassificationResult>();
  
  for (const { text, filename, sourcePath } of contents) {
    const key = `${sourcePath}/${filename}`;
    results.set(key, classifyContentWithContext(text, filename, sourcePath));
  }
  
  return results;
}

