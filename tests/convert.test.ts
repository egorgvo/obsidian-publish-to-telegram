import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mdToTelegramHtml } from '../src/markdown';

// `expect(x).toBe(y)` over node:assert, so the ported test bodies stay unchanged.
function expect(received: unknown) {
  return {
    toBe(expected: unknown) {
      assert.strictEqual(received, expected);
    },
  };
}

// Test cases for markdown to Telegram HTML conversion

test('Text', () => {
  const markdown = 'Hello world!';
  const expected = 'Hello world!';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Escaped text', () => {
  const markdown = 'Simple t`ext 2 + 2 * (32 / 32) = 4';
  const expected = 'Simple t`ext 2 + 2 * (32 / 32) = 4';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Headings', () => {
  const markdown = '# heading 1\n## heading 2\n### heading 3';
  const expected = '<b>heading 1</b>\n\n<b>heading 2</b>\n\n<b>heading 3</b>';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Bold', () => {
  const markdown = '**bold text**';
  const expected = `<b>bold text</b>`;
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Bold character in word', () => {
  expect(mdToTelegramHtml('he**l**lo')).toBe(`he<b>l</b>lo`);
});

test('Italic', () => {
  const markdown = '*italic text*';
  const expected = `<i>italic text</i>`;
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Bold+Italic', () => {
  const markdown = '***bold+italic***';
  const expected = `<i><b>bold+italic</b></i>`;
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Strike', () => {
  const markdown = '~~strike text~~';
  const expected = `<s>strike text</s>`;
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Unordered list', () => {
  const markdown = '* list\n* list\n* list';
  const expected = '• list\n• list\n• list';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Unordered list with + marker', () => {
  const markdown = '+ list\n+ list\n+ list';
  const expected = '• list\n• list\n• list';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Unordered list with - marker', () => {
  const markdown = '- list\n- list\n- list';
  const expected = '• list\n• list\n• list';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Unordered list with mixed markers', () => {
  const markdown = '* list\n* list\n+ list';
  const expected = '• list\n• list\n• list';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Unordered list with mixed markers separated by blank line', () => {
  const markdown = '* list\n* list\n\n+ list\n+ list';
  const expected = '• list\n• list\n\n• list\n• list';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Ordered list', () => {
  const markdown = '1. list\n2. list\n3. list';
  const expected = '1. list\n2. list\n3. list';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Ordered list with ) marker', () => {
  const markdown = '1) list\n2) list\n3) list';
  const expected = '1) list\n2) list\n3) list';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Ordered list with mixed ) and . markers', () => {
  const markdown = '1) list\n2) list\n3. list';
  const expected = '1) list\n2) list\n\n3. list';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Link with alt', () => {
  const markdown = '[t.e.s+t](http://atlassian.com)';
  const expected = '<a href="http://atlassian.com">t.e.s+t</a>';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Inline code', () => {
  const markdown = 'hello `world`';
  const expected = 'hello <code>world</code>';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Code block', () => {
  const markdown = '```\ncode block\n```';
  const expected = '<pre>code block</pre>';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Code block with language', () => {
  const markdown = '```javascript\ncode block\n```';
  const expected = '<pre>code block</pre>';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('HTML Comment', () => {
  const markdown = '<!-- Comment -->';
  const expected = '';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Bold text in lists', () => {
  const markdown =
    '- To make text **bold**, surround it with double asterisks (`**`): `**This text is bold.**`';
  const expected =
    '• To make text <b>bold</b>, surround it with double asterisks (<code>**</code>): <code>**This text is bold.**</code>';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Code after list', () => {
  const markdown = `1. Foo:\n\n\`\`\`\nBar\n\`\`\``;
  const expected = `1. Foo:\n\n<pre>Bar</pre>`;
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Multiple code blocks and lists', () => {
  const markdown = `1. Foo:\n\n\`\`\`\nBar\n\`\`\`\n\n2. Baz:\n\n\`\`\`\nQux\n\`\`\``;
  const expected = `1. Foo:\n\n<pre>Bar</pre>\n\n2. Baz:\n\n<pre>Qux</pre>`;
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Telegram V2: Special character escaping', () => {
  const markdown = 'Test with {braces} and |pipes| and =equals=';
  const expected = 'Test with {braces} and |pipes| and =equals=';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Blockquote preserves line breaks', () => {
  const markdown = `> line one
> line two
>
> line after break`;
  const expected = `<blockquote>line one\nline two\n\nline after break</blockquote>`;
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Blockquote with paragraphs preserves breaks', () => {
  const markdown = `> first paragraph
>
> second paragraph`;
  const expected = `<blockquote>first paragraph\n\nsecond paragraph</blockquote>`;
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Underline support with HTML <u> tags', () => {
  const markdown = 'This is <u>underlined</u> text';
  const expected = 'This is <u>underlined</u> text';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Nested formatting with underline', () => {
  const markdown = '<u>**bold underline**</u>';
  const expected = '<u><b>bold underline</b></u>';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('User mention links', () => {
  const markdown = '[John Doe](tg://user?id=123456)';
  const expected = '<a href="tg://user?id=123456">John Doe</a>';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Escaping in V2 features', () => {
  const markdown = '<u>under_line_test</u>';
  const expected = '<u>under_line_test</u>';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Thematic break with ---', () => {
  const markdown = 'before\n\n---\n\nafter';
  const expected = 'before\n\n───\n\nafter';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Thematic break with *****', () => {
  const markdown = 'before\n\n*****\n\nafter';
  const expected = 'before\n\n─────\n\nafter';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});

test('Thematic break with ___', () => {
  const markdown = 'before\n\n___\n\nafter';
  const expected = 'before\n\n───\n\nafter';
  expect(mdToTelegramHtml(markdown)).toBe(expected);
});
