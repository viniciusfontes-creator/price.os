'use client'

import React from 'react'

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const elements = parseMarkdown(content)
  return <div className="prose prose-sm dark:prose-invert max-w-none">{elements}</div>
}

function parseMarkdown(text: string): React.ReactNode[] {
  // Preprocess: ensure heading markers (##) always start on their own line
  const preprocessed = text.replace(/([^\n])(#{1,3}\s)/g, '$1\n$2')
  const lines = preprocessed.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code blocks
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      elements.push(
        <pre
          key={`code-${i}`}
          className="bg-muted rounded-md p-3 overflow-x-auto text-xs my-2"
        >
          <code className={lang ? `language-${lang}` : ''}>
            {codeLines.join('\n')}
          </code>
        </pre>
      )
      continue
    }

    // Tables
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableRows: string[] = [line]
      i++
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        tableRows.push(lines[i])
        i++
      }
      if (tableRows.length >= 2) {
        elements.push(renderTable(tableRows, `table-${i}`))
        continue
      }
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-sm font-semibold mt-3 mb-1">
          {renderInline(line.slice(4))}
        </h3>
      )
      i++
      continue
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-base font-semibold mt-3 mb-1">
          {renderInline(line.slice(3))}
        </h2>
      )
      i++
      continue
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-lg font-bold mt-3 mb-1">
          {renderInline(line.slice(2))}
        </h1>
      )
      i++
      continue
    }

    // Unordered lists
    if (line.match(/^\s*[-*]\s/)) {
      const listItems: string[] = []
      while (i < lines.length && lines[i].match(/^\s*[-*]\s/)) {
        listItems.push(lines[i].replace(/^\s*[-*]\s/, ''))
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc pl-4 my-1 space-y-0.5">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-sm">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Ordered lists
    if (line.match(/^\s*\d+\.\s/)) {
      const listItems: string[] = []
      while (i < lines.length && lines[i].match(/^\s*\d+\.\s/)) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s/, ''))
        i++
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal pl-4 my-1 space-y-0.5">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-sm">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      )
      continue
    }

    // Empty lines
    if (line.trim() === '') {
      i++
      continue
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${i}`} className="text-sm my-1">
        {renderInline(line)}
      </p>
    )
    i++
  }

  return elements
}

function renderInline(text: string): React.ReactNode {
  // Process inline formatting: bold, italic, code, currency
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/)
    // Inline code
    const codeMatch = remaining.match(/`([^`]+)`/)

    // Find earliest match
    let earliest: { type: string; match: RegExpMatchArray; index: number } | null = null

    if (boldMatch && boldMatch.index !== undefined) {
      earliest = { type: 'bold', match: boldMatch, index: boldMatch.index }
    }
    if (codeMatch && codeMatch.index !== undefined) {
      if (!earliest || codeMatch.index < earliest.index) {
        earliest = { type: 'code', match: codeMatch, index: codeMatch.index }
      }
    }

    if (!earliest) {
      parts.push(remaining)
      break
    }

    // Add text before match
    if (earliest.index > 0) {
      parts.push(remaining.slice(0, earliest.index))
    }

    if (earliest.type === 'bold') {
      parts.push(
        <strong key={`b-${key++}`} className="font-semibold">
          {earliest.match[1]}
        </strong>
      )
    } else if (earliest.type === 'code') {
      parts.push(
        <code
          key={`c-${key++}`}
          className="bg-muted px-1 py-0.5 rounded text-xs font-mono"
        >
          {earliest.match[1]}
        </code>
      )
    }

    remaining = remaining.slice(earliest.index + earliest.match[0].length)
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>
}

function renderTable(rows: string[], key: string): React.ReactNode {
  const parseRow = (row: string) =>
    row
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())

  const headers = parseRow(rows[0])
  // Skip separator row (index 1)
  const dataRows = rows.slice(2).map(parseRow)

  return (
    <div key={key} className="overflow-x-auto my-2">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            {headers.map((h, idx) => (
              <th key={idx} className="text-left p-1.5 font-semibold text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, rowIdx) => (
            <tr key={rowIdx} className="border-b border-border/50">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="p-1.5">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
