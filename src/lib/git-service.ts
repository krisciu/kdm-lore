/**
 * Git Service - Handles git operations for version control
 * Allows the agent to commit changes with proper tracking
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);
const REPO_ROOT = process.cwd();

export interface GitCommitResult {
  success: boolean;
  commitHash?: string;
  message?: string;
  error?: string;
}

export interface GitStatus {
  branch: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  hasChanges: boolean;
}

export interface GitLogEntry {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
  files?: string[];
}

export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  patch: string;
}

/**
 * Check if git is available and we're in a git repository
 */
export async function isGitAvailable(): Promise<boolean> {
  try {
    await execAsync('git rev-parse --git-dir', { cwd: REPO_ROOT });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current git status
 */
export async function getGitStatus(): Promise<GitStatus> {
  try {
    // Get current branch
    const { stdout: branchOutput } = await execAsync('git branch --show-current', { cwd: REPO_ROOT });
    const branch = branchOutput.trim();

    // Get status
    const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: REPO_ROOT });
    const lines = statusOutput.split('\n').filter(Boolean);

    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    lines.forEach(line => {
      const status = line.substring(0, 2);
      const file = line.substring(3).trim();

      if (status.startsWith('?')) {
        untracked.push(file);
      } else if (status[0] !== ' ') {
        staged.push(file);
      }
      if (status[1] !== ' ' && status[1] !== '?') {
        unstaged.push(file);
      }
    });

    return {
      branch,
      staged,
      unstaged,
      untracked,
      hasChanges: staged.length > 0 || unstaged.length > 0 || untracked.length > 0,
    };
  } catch (error) {
    console.error('Git status error:', error);
    return {
      branch: 'unknown',
      staged: [],
      unstaged: [],
      untracked: [],
      hasChanges: false,
    };
  }
}

/**
 * Stage files for commit
 */
export async function stageFiles(files: string[]): Promise<boolean> {
  try {
    if (files.length === 0) return true;
    
    const fileList = files.map(f => `"${f}"`).join(' ');
    await execAsync(`git add ${fileList}`, { cwd: REPO_ROOT });
    return true;
  } catch (error) {
    console.error('Git stage error:', error);
    return false;
  }
}

/**
 * Stage all changes in a directory
 */
export async function stageDirectory(dir: string): Promise<boolean> {
  try {
    await execAsync(`git add "${dir}"`, { cwd: REPO_ROOT });
    return true;
  } catch (error) {
    console.error('Git stage directory error:', error);
    return false;
  }
}

/**
 * Create a git commit with a message
 */
export async function createCommit(
  message: string,
  options?: {
    prefix?: string;
    author?: string;
    files?: string[];
  }
): Promise<GitCommitResult> {
  try {
    // Check if git is available
    if (!(await isGitAvailable())) {
      return { success: false, error: 'Git is not available' };
    }

    // Stage specific files if provided, otherwise stage docs/lore
    if (options?.files && options.files.length > 0) {
      await stageFiles(options.files);
    } else {
      await stageDirectory('docs/lore');
    }

    // Check if there's anything to commit
    const status = await getGitStatus();
    if (status.staged.length === 0) {
      return { success: false, error: 'No changes to commit' };
    }

    // Build commit message
    const fullMessage = options?.prefix 
      ? `${options.prefix} ${message}` 
      : message;

    // Build command
    let command = `git commit -m "${fullMessage.replace(/"/g, '\\"')}"`;
    
    if (options?.author) {
      command += ` --author="${options.author}"`;
    }

    const { stdout } = await execAsync(command, { cwd: REPO_ROOT });
    
    // Extract commit hash from output
    const hashMatch = stdout.match(/\[[\w-]+\s+([a-f0-9]+)\]/);
    const commitHash = hashMatch ? hashMatch[1] : undefined;

    return {
      success: true,
      commitHash,
      message: fullMessage,
    };
  } catch (error) {
    console.error('Git commit error:', error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Get recent git log entries
 */
export async function getGitLog(limit: number = 20): Promise<GitLogEntry[]> {
  try {
    const format = '%H|%h|%an|%aI|%s';
    const { stdout } = await execAsync(
      `git log --format="${format}" -n ${limit} -- docs/lore`,
      { cwd: REPO_ROOT }
    );

    return stdout.split('\n').filter(Boolean).map(line => {
      const [hash, shortHash, author, date, message] = line.split('|');
      return { hash, shortHash, author, date, message };
    });
  } catch (error) {
    console.error('Git log error:', error);
    return [];
  }
}

/**
 * Get the diff for a specific commit
 */
export async function getCommitDiff(commitHash: string): Promise<GitDiff[]> {
  try {
    const { stdout } = await execAsync(
      `git show --stat --format="" ${commitHash}`,
      { cwd: REPO_ROOT }
    );

    const diffs: GitDiff[] = [];
    const lines = stdout.split('\n').filter(Boolean);

    for (const line of lines) {
      const match = line.match(/^\s*(.+?)\s+\|\s+(\d+)\s+([+-]+)/);
      if (match) {
        const [, file, changes, diffIndicator] = match;
        const additions = (diffIndicator.match(/\+/g) || []).length;
        const deletions = (diffIndicator.match(/-/g) || []).length;
        diffs.push({
          file: file.trim(),
          additions,
          deletions,
          patch: '',
        });
      }
    }

    return diffs;
  } catch (error) {
    console.error('Git diff error:', error);
    return [];
  }
}

/**
 * Get the full patch for a commit
 */
export async function getCommitPatch(commitHash: string, file?: string): Promise<string> {
  try {
    const fileArg = file ? `-- "${file}"` : '';
    const { stdout } = await execAsync(
      `git show --format="" ${commitHash} ${fileArg}`,
      { cwd: REPO_ROOT }
    );
    return stdout;
  } catch (error) {
    console.error('Git patch error:', error);
    return '';
  }
}

/**
 * Get diff between working tree and HEAD
 */
export async function getWorkingDiff(file?: string): Promise<string> {
  try {
    const fileArg = file ? `-- "${file}"` : '';
    const { stdout } = await execAsync(
      `git diff HEAD ${fileArg}`,
      { cwd: REPO_ROOT }
    );
    return stdout;
  } catch (error) {
    console.error('Git working diff error:', error);
    return '';
  }
}

/**
 * Get file content at a specific commit
 */
export async function getFileAtCommit(commitHash: string, filePath: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `git show ${commitHash}:"${filePath}"`,
      { cwd: REPO_ROOT }
    );
    return stdout;
  } catch {
    return null;
  }
}

/**
 * Rollback a specific file to a previous commit
 */
export async function rollbackFile(filePath: string, commitHash: string): Promise<boolean> {
  try {
    await execAsync(`git checkout ${commitHash} -- "${filePath}"`, { cwd: REPO_ROOT });
    return true;
  } catch (error) {
    console.error('Git rollback error:', error);
    return false;
  }
}

/**
 * Create a simple text-based diff between two strings
 */
export function createTextDiff(before: string, after: string): {
  additions: number;
  deletions: number;
  hunks: Array<{
    type: 'add' | 'remove' | 'context';
    content: string;
  }[]>;
} {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  
  let additions = 0;
  let deletions = 0;
  const hunks: Array<{ type: 'add' | 'remove' | 'context'; content: string }[]> = [];
  const currentHunk: Array<{ type: 'add' | 'remove' | 'context'; content: string }> = [];

  // Simple diff: compare line by line (this is a simplified version)
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const beforeLine = beforeLines[i];
    const afterLine = afterLines[i];

    if (beforeLine === afterLine) {
      currentHunk.push({ type: 'context', content: beforeLine || '' });
    } else {
      if (beforeLine !== undefined) {
        currentHunk.push({ type: 'remove', content: beforeLine });
        deletions++;
      }
      if (afterLine !== undefined) {
        currentHunk.push({ type: 'add', content: afterLine });
        additions++;
      }
    }
  }

  if (currentHunk.length > 0) {
    hunks.push(currentHunk);
  }

  return { additions, deletions, hunks };
}

/**
 * Get all commits that modified a specific file
 */
export async function getFileHistory(filePath: string, limit: number = 20): Promise<GitLogEntry[]> {
  try {
    const format = '%H|%h|%an|%aI|%s';
    const { stdout } = await execAsync(
      `git log --format="${format}" -n ${limit} -- "${filePath}"`,
      { cwd: REPO_ROOT }
    );

    return stdout.split('\n').filter(Boolean).map(line => {
      const [hash, shortHash, author, date, message] = line.split('|');
      return { hash, shortHash, author, date, message, files: [filePath] };
    });
  } catch (error) {
    console.error('Git file history error:', error);
    return [];
  }
}

/**
 * Get statistics for the lore directory
 */
export async function getLoreGitStats(): Promise<{
  totalCommits: number;
  recentCommits: number;
  contributors: string[];
  firstCommitDate?: string;
  lastCommitDate?: string;
}> {
  try {
    // Total commits
    const { stdout: countOutput } = await execAsync(
      'git rev-list --count HEAD -- docs/lore',
      { cwd: REPO_ROOT }
    );
    const totalCommits = parseInt(countOutput.trim()) || 0;

    // Recent commits (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { stdout: recentOutput } = await execAsync(
      `git rev-list --count HEAD --since="${weekAgo.toISOString()}" -- docs/lore`,
      { cwd: REPO_ROOT }
    );
    const recentCommits = parseInt(recentOutput.trim()) || 0;

    // Contributors
    const { stdout: authorsOutput } = await execAsync(
      'git log --format="%an" -- docs/lore | sort | uniq',
      { cwd: REPO_ROOT }
    );
    const contributors = authorsOutput.split('\n').filter(Boolean);

    // First and last commit dates
    const log = await getGitLog(totalCommits);
    const firstCommitDate = log.length > 0 ? log[log.length - 1].date : undefined;
    const lastCommitDate = log.length > 0 ? log[0].date : undefined;

    return {
      totalCommits,
      recentCommits,
      contributors,
      firstCommitDate,
      lastCommitDate,
    };
  } catch (error) {
    console.error('Git stats error:', error);
    return {
      totalCommits: 0,
      recentCommits: 0,
      contributors: [],
    };
  }
}

