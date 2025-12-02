'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  Sparkles, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface PendingEntry {
  id: string;
  entityName: string;
  generated: {
    title: string;
    type: string;
    summary: string;
    content: string;
    tags: string[];
    confidence: string;
  };
  sources: string[];
  createdAt: string;
  status: string;
}

interface GeneratorStatus {
  configured: boolean;
  provider?: string;
  queuedEntities: number;
  pendingReview: number;
  approved: number;
  rejected: number;
}

export default function GeneratorPage() {
  const [status, setStatus] = useState<GeneratorStatus | null>(null);
  const [pendingEntries, setPendingEntries] = useState<PendingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [entityName, setEntityName] = useState('');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [statusRes, pendingRes] = await Promise.all([
        fetch('/api/generate?action=status'),
        fetch('/api/generate?action=pending'),
      ]);

      if (statusRes.ok) {
        setStatus(await statusRes.json());
      }
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingEntries(data.entries || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!entityName.trim()) return;

    setGenerating(true);
    setMessage(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', entityName: entityName.trim() }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: `Generated entry for "${entityName}"` });
        setEntityName('');
        loadData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Generation failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to generate entry' });
    }

    setGenerating(false);
  }

  async function handleApprove(entryId: string) {
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', entryId }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Entry approved and saved!' });
        loadData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Approval failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to approve entry' });
    }
  }

  async function handleReject(entryId: string) {
    try {
      await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', entryId }),
      });
      loadData();
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--red)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="font-[var(--font-display)] text-3xl tracking-wider uppercase mb-4">
            <Sparkles className="inline w-8 h-8 mr-3 text-[var(--red)]" />
            Lore <span className="text-[var(--red)]">Generator</span>
          </h1>
          <p className="text-[var(--text-secondary)]">
            AI-powered lore entry generation with human review
          </p>
        </motion.div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatusCard
            label="AI Status"
            value={status?.configured ? status.provider || 'Configured' : 'Not Configured'}
            icon={status?.configured ? <CheckCircle className="text-green-500" /> : <AlertCircle className="text-[var(--red)]" />}
          />
          <StatusCard
            label="Pending Review"
            value={status?.pendingReview || 0}
            icon={<Clock className="text-yellow-500" />}
          />
          <StatusCard
            label="Approved"
            value={status?.approved || 0}
            icon={<CheckCircle className="text-green-500" />}
          />
          <StatusCard
            label="Rejected"
            value={status?.rejected || 0}
            icon={<XCircle className="text-[var(--text-muted)]" />}
          />
        </div>

        {/* Not Configured Warning */}
        {!status?.configured && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8 p-6 bg-[var(--red)]/10 border border-[var(--red)]/30 rounded-lg"
          >
            <h3 className="font-semibold text-[var(--red)] mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              AI Not Configured
            </h3>
            <p className="text-[var(--text-secondary)] mb-4">
              To generate lore entries, you need to configure an AI provider. Add one of these to your environment:
            </p>
            <code className="block bg-[var(--black)] p-4 rounded text-sm mb-2">
              ANTHROPIC_API_KEY=your-api-key
            </code>
            <p className="text-xs text-[var(--text-muted)]">
              or OPENAI_API_KEY for OpenAI
            </p>
          </motion.div>
        )}

        {/* Generation Form */}
        {status?.configured && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 p-6 bg-[var(--black-raised)] border border-[var(--border-subtle)] rounded-lg"
          >
            <h2 className="font-[var(--font-display)] text-lg tracking-wider uppercase mb-4">
              Generate Entry
            </h2>
            
            <form onSubmit={handleGenerate} className="flex gap-4">
              <input
                type="text"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                placeholder="Enter entity name (e.g., White Lion, Twilight Knight)"
                className="flex-1 px-4 py-3 bg-[var(--black)] border border-[var(--border)] rounded-lg focus:border-[var(--red)] focus:outline-none transition-colors"
                disabled={generating}
              />
              <button
                type="submit"
                disabled={generating || !entityName.trim()}
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Generate
              </button>
            </form>

            {message && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`mt-4 text-sm ${message.type === 'success' ? 'text-green-500' : 'text-[var(--red)]'}`}
              >
                {message.text}
              </motion.p>
            )}
          </motion.div>
        )}

        {/* Pending Entries */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-[var(--font-display)] text-lg tracking-wider uppercase">
              Pending Review ({pendingEntries.length})
            </h2>
            <button
              onClick={loadData}
              className="text-[var(--text-muted)] hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {pendingEntries.length === 0 ? (
            <div className="p-12 bg-[var(--black-raised)] border border-[var(--border-subtle)] rounded-lg text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
              <p className="text-[var(--text-secondary)]">No entries pending review</p>
              <p className="text-sm text-[var(--text-muted)] mt-2">
                Generate an entry above to get started
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  expanded={expandedEntry === entry.id}
                  onToggle={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                  onApprove={() => handleApprove(entry.id)}
                  onReject={() => handleReject(entry.id)}
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick Links */}
        <div className="mt-12 pt-8 border-t border-[var(--border-subtle)]">
          <h3 className="text-sm tracking-wider uppercase text-[var(--text-muted)] mb-4">
            Quick Links
          </h3>
          <div className="flex gap-4">
            <Link href="/lore" className="btn">
              View Compendium
            </Link>
            <Link href="/agent" className="btn">
              Agent Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="p-4 bg-[var(--black-raised)] border border-[var(--border-subtle)] rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs tracking-wider uppercase text-[var(--text-muted)]">{label}</span>
      </div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function EntryCard({
  entry,
  expanded,
  onToggle,
  onApprove,
  onReject,
}: {
  entry: PendingEntry;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="bg-[var(--black-raised)] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--black)] transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold">{entry.generated.title}</h3>
            <span className="text-xs px-2 py-0.5 bg-[var(--border)] rounded">
              {entry.generated.type}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              entry.generated.confidence === 'confirmed' 
                ? 'bg-green-500/20 text-green-400'
                : entry.generated.confidence === 'likely'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-[var(--border)] text-[var(--text-muted)]'
            }`}>
              {entry.generated.confidence}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-1">
            {entry.generated.summary}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-[var(--border-subtle)]"
        >
          <div className="p-4 space-y-4">
            {/* Preview */}
            <div>
              <h4 className="text-xs tracking-wider uppercase text-[var(--text-muted)] mb-2">
                Content Preview
              </h4>
              <div className="prose prose-invert prose-sm max-h-64 overflow-y-auto p-4 bg-[var(--black)] rounded">
                <div dangerouslySetInnerHTML={{ __html: entry.generated.content.slice(0, 1000) + '...' }} />
              </div>
            </div>

            {/* Tags */}
            <div>
              <h4 className="text-xs tracking-wider uppercase text-[var(--text-muted)] mb-2">
                Tags
              </h4>
              <div className="flex flex-wrap gap-2">
                {entry.generated.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-1 bg-[var(--border)] rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Sources */}
            <div>
              <h4 className="text-xs tracking-wider uppercase text-[var(--text-muted)] mb-2">
                Sources ({entry.sources.length})
              </h4>
              <ul className="text-sm text-[var(--text-secondary)] space-y-1">
                {entry.sources.slice(0, 3).map((source) => (
                  <li key={source} className="flex items-center gap-2">
                    <ExternalLink className="w-3 h-3" />
                    {source}
                  </li>
                ))}
                {entry.sources.length > 3 && (
                  <li className="text-[var(--text-muted)]">
                    +{entry.sources.length - 3} more sources
                  </li>
                )}
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border-subtle)]">
              <button
                onClick={onApprove}
                className="btn btn-primary flex-1"
              >
                <CheckCircle className="w-4 h-4" />
                Approve & Publish
              </button>
              <button
                onClick={onReject}
                className="btn flex-1"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

