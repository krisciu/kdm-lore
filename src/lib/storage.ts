/**
 * Storage Abstraction Layer
 * 
 * Provides a unified interface for persistent storage that works in both:
 * - Local development (file system)
 * - Production/Vercel (Vercel KV - Redis-compatible)
 * 
 * This allows the agent and other features to work seamlessly in all environments.
 */

import fs from 'fs';
import path from 'path';

// Lazy import for Vercel KV to avoid issues when not configured
let kvClient: typeof import('@vercel/kv').kv | null = null;

async function getKVClient() {
  if (kvClient) return kvClient;
  
  // Only import if KV is configured
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = await import('@vercel/kv');
      kvClient = kv;
      return kv;
    } catch (error) {
      console.warn('[Storage] Failed to initialize Vercel KV:', error);
      return null;
    }
  }
  return null;
}

// Check if we should use KV storage
function shouldUseKV(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// Local file paths
const DATA_PATH = path.join(process.cwd(), 'data');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(DATA_PATH, { recursive: true });
  }
}

function getFilePath(key: string): string {
  return path.join(DATA_PATH, `${key}.json`);
}

/**
 * Storage interface for JSON data
 */
export interface Storage {
  get<T>(key: string, defaultValue: T): Promise<T>;
  set<T>(key: string, value: T): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
}

/**
 * File-based storage implementation (for local development)
 */
const fileStorage: Storage = {
  async get<T>(key: string, defaultValue: T): Promise<T> {
    ensureDataDir();
    const filePath = getFilePath(key);
    
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as T;
      } catch (error) {
        console.warn(`[Storage] Failed to read ${key}:`, error);
        return defaultValue;
      }
    }
    return defaultValue;
  },

  async set<T>(key: string, value: T): Promise<boolean> {
    ensureDataDir();
    const filePath = getFilePath(key);
    
    try {
      fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
      return true;
    } catch (error) {
      console.error(`[Storage] Failed to write ${key}:`, error);
      return false;
    }
  },

  async delete(key: string): Promise<boolean> {
    const filePath = getFilePath(key);
    
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch (error) {
      console.error(`[Storage] Failed to delete ${key}:`, error);
      return false;
    }
  },

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(getFilePath(key));
  },
};

/**
 * Vercel KV-based storage implementation (for production)
 */
const kvStorage: Storage = {
  async get<T>(key: string, defaultValue: T): Promise<T> {
    const kv = await getKVClient();
    if (!kv) return defaultValue;
    
    try {
      const value = await kv.get<T>(key);
      return value ?? defaultValue;
    } catch (error) {
      console.warn(`[Storage] KV get failed for ${key}:`, error);
      return defaultValue;
    }
  },

  async set<T>(key: string, value: T): Promise<boolean> {
    const kv = await getKVClient();
    if (!kv) return false;
    
    try {
      await kv.set(key, value);
      return true;
    } catch (error) {
      console.error(`[Storage] KV set failed for ${key}:`, error);
      return false;
    }
  },

  async delete(key: string): Promise<boolean> {
    const kv = await getKVClient();
    if (!kv) return false;
    
    try {
      await kv.del(key);
      return true;
    } catch (error) {
      console.error(`[Storage] KV delete failed for ${key}:`, error);
      return false;
    }
  },

  async exists(key: string): Promise<boolean> {
    const kv = await getKVClient();
    if (!kv) return false;
    
    try {
      const value = await kv.exists(key);
      return value > 0;
    } catch (error) {
      return false;
    }
  },
};

/**
 * Get the appropriate storage backend based on environment
 */
export function getStorage(): Storage {
  if (shouldUseKV()) {
    console.log('[Storage] Using Vercel KV storage');
    return kvStorage;
  }
  console.log('[Storage] Using file system storage');
  return fileStorage;
}

// Storage keys used by the application
export const STORAGE_KEYS = {
  AGENT_STATE: 'agent-state',
  AGENT_CONFIG: 'agent-config',
  DISCOVERY_QUEUE: 'discovery-queue',
  PENDING_ENTRIES: 'pending-entries',
  CITATION_INDEX: 'citation-index',
  SOURCE_INDEX: 'source-index',
  PIPELINE_STATE: 'pipeline-state',
  CHANGELOG: 'changelog',
  RESEARCH_QUEUE: 'research-queue',
  RESEARCH_SESSIONS: 'research-sessions',
  SCHEDULER_STATE: 'scheduler-state',
} as const;

// Export a singleton storage instance
let _storage: Storage | null = null;

export function storage(): Storage {
  if (!_storage) {
    _storage = getStorage();
  }
  return _storage;
}

// Helper function to check storage mode
export function isUsingKV(): boolean {
  return shouldUseKV();
}

