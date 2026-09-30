// Markdown Renderer for Coconut Knowledge Articles

export function renderMarkdown(md) {
  if (!md) return '';

  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inList = false;
  let listType = null;
  let inBlockquote = false;
  let blockquoteLines = [];
  let inTable = false;
  let tableRows = [];

  function flushList() {
    if (inList) {
      out.push(listType === 'ol' ? '</ol>' : '</ul>');
      inList = false;
      listType = null;
    }
  }

  function flushBlockquote() {
    if (inBlockquote) {
      const content = blockquoteLines.map(formatInline).join('<br />');
      out.push(`<blockquote>${content}</blockquote>`);
      inBlockquote = false;
      blockquoteLines = [];
    }
  }

  function flushTable() {
    if (inTable && tableRows.length > 0) {
      let html = '<div class="table-wrap"><table class="markdown-table">';
      const [headerRow, ...bodyRows] = tableRows;
      if (headerRow) {
        const ths = headerRow
          .split('|')
          .slice(1, -1)
          .map((c) => `<th>${formatInline(c.trim())}</th>`)
          .join('');
        html += `<thead><tr>${ths}</tr></thead>`;
      }
      if (bodyRows.length > 0) {
        html += '<tbody>';
        bodyRows.forEach((row) => {
          const tds = row
            .split('|')
            .slice(1, -1)
            .map((c) => `<td>${formatInline(c.trim())}</td>`)
            .join('');
          html += `<tr>${tds}</tr>`;
        });
        html += '</tbody>';
      }
      html += '</table></div>';
      out.push(html);
      inTable = false;
      tableRows = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Check table row
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList();
      flushBlockquote();
      // Skip separator row |---|---|
      if (/^\|(\s*[-:]+[-| :]*)\|$/.test(line)) {
        continue;
      }
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(line);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Check blockquote
    if (line.startsWith('>')) {
      flushList();
      if (!inBlockquote) {
        inBlockquote = true;
        blockquoteLines = [];
      }
      blockquoteLines.push(line.replace(/^>\s*/, ''));
      continue;
    } else if (inBlockquote) {
      flushBlockquote();
    }

    // Empty line
    if (!line) {
      flushList();
      continue;
    }

    // Horizontal rule
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line)) {
      flushList();
      out.push('<hr />');
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const anchor = slugify(text);
      out.push(`<h${level} id="${anchor}">${formatInline(text)}</h${level}>`);
      continue;
    }

    // Unordered List
    const ulMatch = line.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        flushList();
        inList = true;
        listType = 'ul';
        out.push('<ul>');
      }
      out.push(`<li>${formatInline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered List
    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        flushList();
        inList = true;
        listType = 'ol';
        out.push('<ol>');
      }
      out.push(`<li>${formatInline(olMatch[1])}</li>`);
      continue;
    }

    // Regular paragraph
    flushList();
    out.push(`<p>${formatInline(line)}</p>`);
  }

  flushList();
  flushBlockquote();
  flushTable();

  return out.join('\n');
}

export function formatInline(text) {
  if (!text) return '';
  return text
    // Math formulas $...$
    .replace(/\$([^$]+)\$/g, '<code class="math-expr">$1</code>')
    // Bold & italic ***text***
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    // Bold **text**
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic *text* or _text_
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    // Inline code `text`
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\u0E00-\u0E7Fa-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
