import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, formatInline } from '../public/shared/markdown.js';

test('renderMarkdown converts headings, lists, and tables', () => {
  const md = `# หัวข้อหลัก

> ข้อความอ้างอิงสำคัญ

## สารบัญ
1. ข้อหนึ่ง
2. ข้อสอง

- ประเด็นย่อย A
- ประเด็นย่อย B

| ตัวชี้วัด | ค่าเฉลี่ย |
|---|---|
| Brix | 7.0 |
| น้ำหนัก | 1.8 |

ข้อความปกติที่มี **ตัวหนา** และ _ตัวเอียง_ และ \`โค้ด\`
`;

  const html = renderMarkdown(md);

  assert.ok(html.includes('<h1 id="หัวข้อหลัก">หัวข้อหลัก</h1>'));
  assert.ok(html.includes('<blockquote>ข้อความอ้างอิงสำคัญ</blockquote>'));
  assert.ok(html.includes('<ol>'));
  assert.ok(html.includes('<li>ข้อหนึ่ง</li>'));
  assert.ok(html.includes('<ul>'));
  assert.ok(html.includes('<li>ประเด็นย่อย A</li>'));
  assert.ok(html.includes('<table class="markdown-table">'));
  assert.ok(html.includes('<th>ตัวชี้วัด</th>'));
  assert.ok(html.includes('<td>7.0</td>'));
  assert.ok(html.includes('<strong>ตัวหนา</strong>'));
  assert.ok(html.includes('<em>ตัวเอียง</em>'));
  assert.ok(html.includes('<code>โค้ด</code>'));
});

test('formatInline converts links and math', () => {
  const text = 'ดู [เอกสารอ้างอิง](https://example.com) และสูตร $2AP-fgr$';
  const formatted = formatInline(text);
  assert.ok(formatted.includes('<a href="https://example.com" target="_blank" rel="noopener">เอกสารอ้างอิง</a>'));
  assert.ok(formatted.includes('<code class="math-expr">2AP-fgr</code>'));
});
