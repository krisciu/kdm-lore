import { notFound } from 'next/navigation';
import Link from 'next/link';
import { 
  Skull, 
  MapPin, 
  Users, 
  Swords, 
  Scroll, 
  Sparkles,
  Eye,
  Flame,
  BookOpen,
  Link as LinkIcon,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Flag,
  Lightbulb,
  Cog,
  ExternalLink,
  Calendar
} from 'lucide-react';
import { getLoreEntries, getLoreBySlug, getRelatedLore } from '@/data/lore';
import { LoreEntry } from '@/types/lore';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import TableOfContents from '@/components/TableOfContents';
import Breadcrumbs from '@/components/Breadcrumbs';
import LoreCard from '@/components/LoreCard';
import ReadingProgress from '@/components/ReadingProgress';

const categoryIcons: Record<string, React.ElementType> = {
  monster: Skull,
  location: MapPin,
  survivor: Users,
  character: Users,
  settlement: Flame,
  item: Swords,
  event: Scroll,
  philosophy: Sparkles,
  entity: Eye,
  faction: Flag,
  concept: Lightbulb,
  technology: Cog,
};

const categoryColors: Record<string, string> = {
  monster: 'text-red-400 bg-red-500/10 border-red-500/30',
  location: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  character: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  survivor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  settlement: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  item: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  event: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  philosophy: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  entity: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
  faction: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  concept: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
  technology: 'text-slate-300 bg-slate-400/10 border-slate-400/30',
};

const confidenceConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  confirmed: { 
    icon: CheckCircle, 
    label: 'Confirmed lore from official sources',
    color: 'text-green-400'
  },
  likely: { 
    icon: AlertCircle, 
    label: 'Likely accurate based on evidence',
    color: 'text-yellow-400'
  },
  speculative: { 
    icon: HelpCircle, 
    label: 'Speculative interpretation',
    color: 'text-orange-400'
  },
};

// Generate static params for all lore entries
export function generateStaticParams() {
  const entries = getLoreEntries();
  return entries.map((entry) => ({
    slug: entry.slug,
  }));
}

// Generate metadata
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getLoreBySlug(slug);
  
  if (!entry) {
    return {
      title: 'Entry Not Found | KDM Lore',
    };
  }
  
  return {
    title: `${entry.title} | Kingdom Death Lore`,
    description: entry.summary,
  };
}

function LoreContent({ entry }: { entry: LoreEntry }) {
  const Icon = categoryIcons[entry.category] || Scroll;
  const colorClasses = categoryColors[entry.category] || categoryColors.concept;
  const confidence = confidenceConfig[entry.confidence];
  const relatedEntries = getRelatedLore(entry.id);

  const categoryName = entry.category.charAt(0).toUpperCase() + entry.category.slice(1);

  return (
    <>
      <ReadingProgress />
      <div className="min-h-screen py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumbs */}
          <Breadcrumbs 
          items={[
            { label: 'Lore', href: '/lore' },
            { label: categoryName + 's', href: `/lore?category=${entry.category}` },
            { label: entry.title }
          ]} 
        />

        {/* Entry Header */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Category Badge */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colorClasses}`}>
              <Icon className="w-4 h-4" />
              <span className="text-sm font-[var(--font-display)] tracking-wider uppercase">
                {entry.category}
              </span>
            </div>
            
            {/* Additional Badges */}
            {entry.monsterType && (
              <span className="px-3 py-1.5 bg-[var(--weathered-bone)]/10 border border-[var(--weathered-bone)]/30 rounded-lg text-sm font-[var(--font-display)] tracking-wider uppercase text-[var(--text-secondary)]">
                {entry.monsterType}
              </span>
            )}
            {entry.level && (
              <span className="px-3 py-1.5 bg-[var(--weathered-bone)]/10 border border-[var(--weathered-bone)]/30 rounded-lg text-sm font-[var(--font-display)] tracking-wider uppercase text-[var(--text-secondary)]">
                Level {entry.level}
              </span>
            )}
            
            {/* Confidence Badge */}
            <div className={`flex items-center gap-1.5 text-sm ${confidence.color}`}>
              <confidence.icon className="w-4 h-4" />
              <span>{entry.confidence}</span>
            </div>
          </div>
          
          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-[var(--font-display)] tracking-wider mb-4">
            {entry.title}
          </h1>
          
          {/* Summary */}
          <p className="text-xl text-[var(--text-secondary)] leading-relaxed max-w-3xl">
            {entry.summary}
          </p>
        </header>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-[1fr_280px] gap-8">
          {/* Content Column */}
          <div className="min-w-0">
            {/* Main Article */}
            <article className="bg-[var(--dark-stone)]/50 border border-[var(--weathered-bone)]/20 rounded-xl p-6 md:p-8">
              <MarkdownRenderer content={entry.content} />

              {/* Quotes Section */}
              {entry.quotes && entry.quotes.length > 0 && (
                <div className="mt-12 pt-8 border-t border-[var(--weathered-bone)]/20">
                  <h2 className="text-xl font-[var(--font-display)] tracking-wider mb-6 flex items-center gap-3 text-lantern">
                    <BookOpen className="w-5 h-5" />
                    Notable Quotes
                  </h2>
                  <div className="space-y-4">
                    {entry.quotes.map((quote, idx) => (
                      <blockquote 
                        key={idx} 
                        className="pl-4 border-l-2 border-lantern/50 italic text-[var(--text-secondary)]"
                      >
                        {quote}
                      </blockquote>
                    ))}
                  </div>
                </div>
              )}
            </article>

            {/* Related Lore */}
            {relatedEntries.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-[var(--font-display)] tracking-wider mb-6 flex items-center gap-3">
                  <LinkIcon className="w-5 h-5 text-lantern" />
                  Related Lore
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {relatedEntries.map((related, idx) => (
                    <LoreCard key={related.id} entry={related} variant="compact" index={idx} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Table of Contents */}
            <TableOfContents content={entry.content} />

            {/* Tags */}
            <div className="bg-[var(--dark-stone)]/50 border border-[var(--weathered-bone)]/20 rounded-xl p-5">
              <h3 className="font-[var(--font-display)] tracking-wider text-sm uppercase text-[var(--text-muted)] mb-4">
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {entry.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/lore?q=${tag}`}
                    className="px-2.5 py-1 bg-[var(--weathered-bone)]/10 hover:bg-[var(--weathered-bone)]/20 border border-[var(--weathered-bone)]/20 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>

            {/* Sources */}
            <div className="bg-[var(--dark-stone)]/50 border border-[var(--weathered-bone)]/20 rounded-xl p-5">
              <h3 className="font-[var(--font-display)] tracking-wider text-sm uppercase text-[var(--text-muted)] mb-4">
                Sources
              </h3>
              <div className="space-y-3">
                {entry.sources.map((source, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    {source.verified ? (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <span className="text-[var(--text-secondary)] break-words">
                        {source.name}
                      </span>
                      {source.page && (
                        <span className="text-[var(--text-muted)]"> (p. {source.page})</span>
                      )}
                      <div className="text-xs text-[var(--text-muted)] mt-0.5 capitalize">
                        {source.type}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Metadata */}
            <div className="bg-[var(--dark-stone)]/50 border border-[var(--weathered-bone)]/20 rounded-xl p-5">
              <h3 className="font-[var(--font-display)] tracking-wider text-sm uppercase text-[var(--text-muted)] mb-4">
                Entry Info
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Calendar className="w-4 h-4" />
                  <span>Updated {new Date(entry.updatedAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <confidence.icon className={`w-4 h-4 ${confidence.color}`} />
                  <span>{confidence.label}</span>
                </div>
              </div>
            </div>

            {/* External Links */}
            <div className="bg-[var(--dark-stone)]/50 border border-[var(--weathered-bone)]/20 rounded-xl p-5">
              <h3 className="font-[var(--font-display)] tracking-wider text-sm uppercase text-[var(--text-muted)] mb-4">
                External
              </h3>
              <div className="space-y-2">
                <a 
                  href={`https://boardgamegeek.com/boardgame/55690/kingdom-death-monster`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-lantern transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  BoardGameGeek
                </a>
                <a 
                  href={`https://kingdomdeath.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-lantern transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Official Site
                </a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
    </>
  );
}

export default async function LoreEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getLoreBySlug(slug);
  
  if (!entry) {
    notFound();
  }

  return <LoreContent entry={entry} />;
}
