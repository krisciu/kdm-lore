import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { getLoreEntries, getLoreBySlug, getRelatedLore } from '@/data/lore';
import { LoreEntry } from '@/types/lore';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import TableOfContents from '@/components/TableOfContents';
import Breadcrumbs from '@/components/Breadcrumbs';
import LoreCard from '@/components/LoreCard';
import ReadingProgress from '@/components/ReadingProgress';

const confidenceConfig: Record<string, { icon: React.ElementType; label: string }> = {
  confirmed: { icon: CheckCircle, label: 'Confirmed' },
  likely: { icon: AlertCircle, label: 'Likely' },
  speculative: { icon: HelpCircle, label: 'Speculative' },
};

export function generateStaticParams() {
  const entries = getLoreEntries();
  return entries.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getLoreBySlug(slug);
  
  if (!entry) {
    return { title: 'Not Found | KDM Lore' };
  }
  
  return {
    title: `${entry.title} | Kingdom Death Lore`,
    description: entry.summary,
  };
}

function LoreContent({ entry }: { entry: LoreEntry }) {
  const confidence = confidenceConfig[entry.confidence];
  const relatedEntries = getRelatedLore(entry.id);
  const isMonster = entry.category === 'monster';
  const categoryName = entry.category.charAt(0).toUpperCase() + entry.category.slice(1);

  return (
    <>
      <ReadingProgress />
      <div className="min-h-screen pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Breadcrumbs */}
          <Breadcrumbs 
            items={[
              { label: 'Compendium', href: '/lore' },
              { label: categoryName + 's', href: `/lore?category=${entry.category}` },
              { label: entry.title }
            ]} 
          />

          {/* Header */}
          <header className="mb-12 max-w-3xl">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className={`text-xs tracking-[0.15em] uppercase px-2 py-1 border ${
                isMonster 
                  ? 'border-[var(--red-dark)] text-[var(--red)]' 
                  : 'border-[var(--border)] text-[var(--text-muted)]'
              }`}>
                {entry.category}
              </span>
              {entry.monsterType && (
                <span className="text-xs tracking-wider uppercase text-[var(--text-muted)]">
                  {entry.monsterType}
                </span>
              )}
              {entry.level && (
                <span className="text-xs tracking-wider uppercase text-[var(--text-muted)]">
                  Level {entry.level}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <confidence.icon className="w-3.5 h-3.5" />
                {confidence.label}
              </span>
            </div>
            
            {/* Title */}
            <h1 className="font-[var(--font-display)] text-3xl md:text-4xl lg:text-5xl tracking-wider uppercase mb-6">
              {entry.title}
            </h1>
            
            {/* Summary */}
            <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
              {entry.summary}
            </p>
          </header>

          {/* Content Grid */}
          <div className="grid lg:grid-cols-[1fr_260px] gap-12">
            {/* Main Content */}
            <main>
              <article className="prose">
                <MarkdownRenderer content={entry.content} />
              </article>

              {/* Quotes */}
              {entry.quotes && entry.quotes.length > 0 && (
                <section className="mt-16 pt-12 border-t border-[var(--border-subtle)]">
                  <h2 className="font-[var(--font-display)] text-lg tracking-wider uppercase mb-8">
                    Notable Quotes
                  </h2>
                  <div className="space-y-6">
                    {entry.quotes.map((quote, idx) => (
                      <blockquote key={idx} className="text-[var(--text-secondary)] italic">
                        {quote}
                      </blockquote>
                    ))}
                  </div>
                </section>
              )}

              {/* Related */}
              {relatedEntries.length > 0 && (
                <section className="mt-16 pt-12 border-t border-[var(--border-subtle)]">
                  <h2 className="font-[var(--font-display)] text-lg tracking-wider uppercase mb-8">
                    Related Lore
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {relatedEntries.map((related, idx) => (
                      <LoreCard key={related.id} entry={related} variant="compact" index={idx} />
                    ))}
                  </div>
                </section>
              )}
            </main>

            {/* Sidebar */}
            <aside className="space-y-8">
              <TableOfContents content={entry.content} />

              {/* Tags */}
              <div>
                <h3 className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-muted)] mb-4">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {entry.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/lore?q=${tag}`}
                      className="text-xs text-[var(--text-muted)] hover:text-white transition-colors"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Sources */}
              <div>
                <h3 className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-muted)] mb-4">
                  Sources
                </h3>
                <div className="space-y-3">
                  {entry.sources.map((source, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      {source.verified ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <span className="text-[var(--text-secondary)] text-xs break-words">
                          {source.name}
                        </span>
                        {source.page && (
                          <span className="text-[var(--text-muted)] text-xs"> p.{source.page}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Meta */}
              <div className="pt-6 border-t border-[var(--border-subtle)]">
                <p className="text-[10px] text-[var(--text-muted)] mb-1">
                  Updated {new Date(entry.updatedAt).toLocaleDateString('en-US', { 
                    year: 'numeric', month: 'short', day: 'numeric' 
                  })}
                </p>
              </div>

              {/* External */}
              <div className="space-y-2">
                <a 
                  href="https://kingdomdeath.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-white transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Official Site
                </a>
                <a 
                  href="https://boardgamegeek.com/boardgame/55690/kingdom-death-monster"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-white transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  BoardGameGeek
                </a>
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
