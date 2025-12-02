'use client';

import { useMemo } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

interface TableData {
  headers: string[];
  rows: string[][];
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const elements = useMemo(() => {
    const lines = content.split('\n');
    const result: React.ReactNode[] = [];
    let i = 0;
    let listItems: React.ReactNode[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let tableData: TableData | null = null;

    const flushList = () => {
      if (listItems.length > 0) {
        if (listType === 'ul') {
          result.push(
            <ul key={`list-${result.length}`} className="list-disc list-outside ml-5 mb-6 space-y-2 text-[var(--text-secondary)]">
              {listItems}
            </ul>
          );
        } else {
          result.push(
            <ol key={`list-${result.length}`} className="list-decimal list-outside ml-5 mb-6 space-y-2 text-[var(--text-secondary)]">
              {listItems}
            </ol>
          );
        }
        listItems = [];
        listType = null;
      }
    };

    const flushTable = () => {
      if (tableData && tableData.rows.length > 0) {
        result.push(
          <div key={`table-${result.length}`} className="overflow-x-auto mb-8 border border-[var(--border-subtle)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {tableData.headers.map((header, idx) => (
                    <th key={idx} className="text-left px-4 py-3 text-[10px] tracking-[0.15em] uppercase text-[var(--text-muted)]">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-[var(--border-subtle)] hover:bg-[var(--black-raised)]">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                        {parseInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableData = null;
      }
    };

    const parseInline = (text: string): React.ReactNode => {
      const parts: React.ReactNode[] = [];
      let remaining = text;
      let keyCounter = 0;

      while (remaining.length > 0) {
        // Bold
        const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
        if (boldMatch) {
          parts.push(<strong key={keyCounter++} className="text-white font-semibold">{boldMatch[1]}</strong>);
          remaining = remaining.slice(boldMatch[0].length);
          continue;
        }

        // Italic
        const italicMatch = remaining.match(/^[*_]([^*_]+?)[*_]/);
        if (italicMatch) {
          parts.push(<em key={keyCounter++} className="italic">{italicMatch[1]}</em>);
          remaining = remaining.slice(italicMatch[0].length);
          continue;
        }

        // Code
        const codeMatch = remaining.match(/^`([^`]+?)`/);
        if (codeMatch) {
          parts.push(
            <code key={keyCounter++} className="px-1.5 py-0.5 bg-[var(--black-elevated)] text-sm font-mono text-[var(--red)]">
              {codeMatch[1]}
            </code>
          );
          remaining = remaining.slice(codeMatch[0].length);
          continue;
        }

        // Link
        const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          parts.push(
            <a 
              key={keyCounter++} 
              href={linkMatch[2]} 
              className="text-white underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--red)] hover:decoration-[var(--red)] transition-colors"
              target={linkMatch[2].startsWith('http') ? '_blank' : undefined}
              rel={linkMatch[2].startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {linkMatch[1]}
            </a>
          );
          remaining = remaining.slice(linkMatch[0].length);
          continue;
        }

        parts.push(remaining[0]);
        remaining = remaining.slice(1);
      }

      return parts;
    };

    while (i < lines.length) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        flushList();
        flushTable();
        i++;
        continue;
      }

      // Table
      if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
        flushList();
        const cells = trimmedLine.slice(1, -1).split('|').map(c => c.trim());
        
        if (cells.every(c => /^[-:]+$/.test(c))) {
          i++;
          continue;
        }

        if (!tableData) {
          tableData = { headers: cells, rows: [] };
        } else {
          tableData.rows.push(cells);
        }
        i++;
        continue;
      } else {
        flushTable();
      }

      // H1
      if (trimmedLine.startsWith('# ')) {
        flushList();
        result.push(
          <h1 key={i} className="font-[var(--font-display)] text-2xl tracking-wider uppercase text-[var(--red)] mb-6 mt-12 first:mt-0">
            {parseInline(trimmedLine.slice(2))}
          </h1>
        );
        i++;
        continue;
      }

      // H2
      if (trimmedLine.startsWith('## ')) {
        flushList();
        const text = trimmedLine.slice(3);
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        result.push(
          <h2 key={i} id={id} className="font-[var(--font-display)] text-lg tracking-wider uppercase text-white mb-4 mt-12 first:mt-0 scroll-mt-28">
            {parseInline(text)}
          </h2>
        );
        i++;
        continue;
      }

      // H3
      if (trimmedLine.startsWith('### ')) {
        flushList();
        const text = trimmedLine.slice(4);
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        result.push(
          <h3 key={i} id={id} className="font-[var(--font-display)] text-sm tracking-wider uppercase text-white mb-3 mt-8 scroll-mt-28">
            {parseInline(text)}
          </h3>
        );
        i++;
        continue;
      }

      // H4
      if (trimmedLine.startsWith('#### ')) {
        flushList();
        result.push(
          <h4 key={i} className="font-semibold text-white mb-2 mt-6">
            {parseInline(trimmedLine.slice(5))}
          </h4>
        );
        i++;
        continue;
      }

      // Blockquote
      if (trimmedLine.startsWith('> ')) {
        flushList();
        const quoteContent = trimmedLine.slice(2);
        
        if (quoteContent.includes('⚠️') || quoteContent.toLowerCase().includes('speculation')) {
          result.push(
            <div key={i} className="my-6 py-4 px-5 border-l-2 border-yellow-600/50 bg-yellow-600/5">
              <p className="text-sm text-[var(--text-secondary)] italic">
                {parseInline(quoteContent.replace('⚠️', '').trim())}
              </p>
            </div>
          );
        } else {
          result.push(
            <blockquote key={i} className="my-6 pl-5 border-l-2 border-[var(--red-dark)] text-[var(--text-secondary)] italic">
              {parseInline(quoteContent)}
            </blockquote>
          );
        }
        i++;
        continue;
      }

      // HR
      if (trimmedLine === '---' || trimmedLine === '***') {
        flushList();
        result.push(
          <hr key={i} className="my-10 border-0 h-px bg-[var(--border-subtle)]" />
        );
        i++;
        continue;
      }

      // UL
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        listItems.push(
          <li key={i}>{parseInline(trimmedLine.slice(2))}</li>
        );
        i++;
        continue;
      }

      // OL
      const orderedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/);
      if (orderedMatch) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        listItems.push(
          <li key={i}>{parseInline(orderedMatch[2])}</li>
        );
        i++;
        continue;
      }

      // Paragraph
      flushList();
      result.push(
        <p key={i} className="mb-5 text-[var(--text-secondary)] leading-relaxed">
          {parseInline(trimmedLine)}
        </p>
      );
      i++;
    }

    flushList();
    flushTable();

    return result;
  }, [content]);

  return <div className={className}>{elements}</div>;
}
