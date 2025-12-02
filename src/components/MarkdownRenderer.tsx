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
            <ul key={`list-${result.length}`} className="list-disc list-outside ml-6 mb-4 space-y-1 text-[var(--text-secondary)]">
              {listItems}
            </ul>
          );
        } else {
          result.push(
            <ol key={`list-${result.length}`} className="list-decimal list-outside ml-6 mb-4 space-y-1 text-[var(--text-secondary)]">
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
          <div key={`table-${result.length}`} className="overflow-x-auto mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--weathered-bone)]/30">
                  {tableData.headers.map((header, idx) => (
                    <th 
                      key={idx} 
                      className="text-left px-4 py-2 font-[var(--font-display)] text-sm tracking-wider text-lantern"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((row, rowIdx) => (
                  <tr 
                    key={rowIdx} 
                    className="border-b border-[var(--weathered-bone)]/10 hover:bg-[var(--weathered-bone)]/5"
                  >
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-2 text-sm text-[var(--text-secondary)]">
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
        // Bold: **text**
        const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
        if (boldMatch) {
          parts.push(<strong key={keyCounter++} className="text-parchment font-semibold">{boldMatch[1]}</strong>);
          remaining = remaining.slice(boldMatch[0].length);
          continue;
        }

        // Italic: *text* or _text_
        const italicMatch = remaining.match(/^[*_]([^*_]+?)[*_]/);
        if (italicMatch) {
          parts.push(<em key={keyCounter++} className="italic text-[var(--text-secondary)]">{italicMatch[1]}</em>);
          remaining = remaining.slice(italicMatch[0].length);
          continue;
        }

        // Code: `text`
        const codeMatch = remaining.match(/^`([^`]+?)`/);
        if (codeMatch) {
          parts.push(
            <code key={keyCounter++} className="px-1.5 py-0.5 bg-[var(--weathered-bone)]/20 rounded text-sm font-mono text-lantern">
              {codeMatch[1]}
            </code>
          );
          remaining = remaining.slice(codeMatch[0].length);
          continue;
        }

        // Link: [text](url)
        const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          parts.push(
            <a 
              key={keyCounter++} 
              href={linkMatch[2]} 
              className="text-lantern hover:text-parchment underline decoration-lantern/30 hover:decoration-parchment/50 transition-colors"
              target={linkMatch[2].startsWith('http') ? '_blank' : undefined}
              rel={linkMatch[2].startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {linkMatch[1]}
            </a>
          );
          remaining = remaining.slice(linkMatch[0].length);
          continue;
        }

        // Regular text - take one character and continue
        parts.push(remaining[0]);
        remaining = remaining.slice(1);
      }

      return parts;
    };

    while (i < lines.length) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Empty line
      if (!trimmedLine) {
        flushList();
        flushTable();
        i++;
        continue;
      }

      // Table detection
      if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
        flushList();
        
        const cells = trimmedLine.slice(1, -1).split('|').map(c => c.trim());
        
        // Check if this is a separator row
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

      // Headers
      if (trimmedLine.startsWith('# ')) {
        flushList();
        result.push(
          <h1 key={i} className="text-3xl font-[var(--font-display)] tracking-wider text-lantern mb-6 mt-8 first:mt-0">
            {parseInline(trimmedLine.slice(2))}
          </h1>
        );
        i++;
        continue;
      }

      if (trimmedLine.startsWith('## ')) {
        flushList();
        const text = trimmedLine.slice(3);
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        result.push(
          <h2 key={i} id={id} className="text-xl font-[var(--font-display)] tracking-wider text-parchment mb-4 mt-8 first:mt-0 scroll-mt-24">
            {parseInline(text)}
          </h2>
        );
        i++;
        continue;
      }

      if (trimmedLine.startsWith('### ')) {
        flushList();
        const text = trimmedLine.slice(4);
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        result.push(
          <h3 key={i} id={id} className="text-lg font-[var(--font-display)] tracking-wider text-[var(--text-primary)] mb-3 mt-6 scroll-mt-24">
            {parseInline(text)}
          </h3>
        );
        i++;
        continue;
      }

      if (trimmedLine.startsWith('#### ')) {
        flushList();
        result.push(
          <h4 key={i} className="font-semibold text-[var(--text-primary)] mb-2 mt-4">
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
        
        // Check for special warning/note blocks
        if (quoteContent.includes('⚠️') || quoteContent.toLowerCase().includes('speculation')) {
          result.push(
            <div key={i} className="my-4 p-4 border-l-2 border-yellow-500/50 bg-yellow-500/5 rounded-r">
              <p className="text-sm text-[var(--text-secondary)] italic">
                {parseInline(quoteContent.replace('⚠️', '').trim())}
              </p>
            </div>
          );
        } else {
          result.push(
            <blockquote key={i} className="my-4 pl-4 border-l-2 border-lantern/50 text-[var(--text-secondary)] italic">
              {parseInline(quoteContent)}
            </blockquote>
          );
        }
        i++;
        continue;
      }

      // Horizontal rule
      if (trimmedLine === '---' || trimmedLine === '***' || trimmedLine === '___') {
        flushList();
        result.push(
          <hr key={i} className="my-8 border-0 h-px bg-gradient-to-r from-transparent via-[var(--weathered-bone)]/50 to-transparent" />
        );
        i++;
        continue;
      }

      // Unordered list item
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

      // Ordered list item
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

      // Regular paragraph
      flushList();
      result.push(
        <p key={i} className="mb-4 text-[var(--text-secondary)] leading-relaxed">
          {parseInline(trimmedLine)}
        </p>
      );
      i++;
    }

    flushList();
    flushTable();

    return result;
  }, [content]);

  return (
    <div className={`prose-kdm ${className}`}>
      {elements}
    </div>
  );
}

