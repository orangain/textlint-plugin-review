// LICENSE : MIT
'use strict';
import assert from 'power-assert';
import { parseAsChunks } from '../src/chunker';

describe('chunker', function () {
  describe('#parseAsChunks', function () {
    it('should return chunks', function () {
      const chunks = parseAsChunks(`= Text

aaaa`);
      assert(Array.isArray(chunks));
    });

    it('should parse text as a Paragraph', function () {
      const chunks = parseAsChunks(`test`);
      assert(chunks.length == 1);
      const paragraph = chunks[0];
      assert(paragraph.type == 'Paragraph');
      assert(paragraph.raw == `test`);
      assert(paragraph.lines.length == 1);
      assert.deepEqual(paragraph.lines, [
        {
          text: 'test',
          raw: 'test',
          lineNumber: 1,
          startIndex: 0,
        },
      ]);
    });

    it('should parse consecutive lines as a Paragraph', function () {
      const chunks = parseAsChunks(`
test
paragraph
`);
      assert(chunks.length == 1);
      const paragraph = chunks[0];
      assert(paragraph.type == 'Paragraph');
      assert(paragraph.raw == 'test\nparagraph\n');
      assert(paragraph.lines.length == 2);
      assert.deepEqual(paragraph.lines, [
        {
          text: 'test',
          raw: 'test\n',
          lineNumber: 2,
          startIndex: 1,
        },
        {
          text: 'paragraph',
          raw: 'paragraph\n',
          lineNumber: 3,
          startIndex: 6,
        },
      ]);
    });

    it('should parse separated lines as each Paragraph', function () {
      const chunks = parseAsChunks(`test
paragraph

another paragraph`);
      assert(chunks.length == 2);
      assert.deepEqual(chunks.map(chunk => chunk.type),
                       ['Paragraph', 'Paragraph']);
      assert.deepEqual(chunks.map(chunk => chunk.raw),
                       ['test\nparagraph\n', 'another paragraph']);
    });

    it('should parse equal signs as headings', function () {
      const chunks = parseAsChunks(`={ch01} Test

This is paragraph

== Headings`);
      assert(chunks.length == 3);
      assert.deepEqual(chunks.map(chunk => chunk.type),
                       ['Heading', 'Paragraph', 'Heading']);
      assert.deepEqual(chunks.map(chunk => chunk.raw),
                       ['={ch01} Test\n', 'This is paragraph\n', '== Headings']);
    });

    it('should not ignore #@#', function () {
      const chunks = parseAsChunks(`#@# ???
test
paragraph
#@# !!!

another paragraph`);
      assert(chunks.length == 3);
      assert(chunks[0].raw.includes('???'));
      assert.deepEqual(chunks.map(chunk => chunk.type),
                       ['Comment', 'Paragraph', 'Paragraph']);
    });

    it('should not ignore #@warn', function () {
      const chunks = parseAsChunks(`test
paragraph

#@warn(TODO: should be fixed)
another paragraph`);
      assert(chunks[1].raw.includes('TODO'));
      assert.deepEqual(chunks.map(chunk => chunk.type),
                       ['Paragraph', 'Comment', 'Paragraph']);
    });

    it('should not split a block with a comment', function () {
      const chunks = parseAsChunks(`
//list[][]{
x = 2
#@# comment in a list
x += 1
//}`);
      assert(chunks.length == 1);
      const list = chunks[0];
      assert(list.type == 'Block');
      assert(list.lines.length == 5); // including open and close tags
      assert(list.lines[2].isComment);
      assert.deepEqual(list.lines.map(line => line.text), [
        '//list[][]{',
        'x = 2',
        '#@# comment in a list',
        'x += 1',
        '//}',
      ]);
      assert(list.raw == `//list[][]{
x = 2
#@# comment in a list
x += 1
//}`);

    });

    it('should parse //list as a block', function () {
      const chunks = parseAsChunks(`first line

//list[][]{
let x = 0;
//}

second line`);
      assert(chunks.length == 3);
      assert.deepEqual(chunks.map(chunk => chunk.type),
                       ['Paragraph', 'Block', 'Paragraph']);
    });

    it('should not parse one-line block having "{" as a multi-line block', function () {
      const chunks = parseAsChunks(`first line

//footnote[example][@<href>{http://example.com/}]

second line`);
      assert(chunks.length == 3);
      assert.deepEqual(chunks.map(chunk => chunk.type),
                       ['Paragraph', 'Block', 'Paragraph']);
    });

    it('should parse lines starting with * as a UnorderedList', function () {
      const chunks = parseAsChunks(`
 * 第1の項目
 ** 第1の項目のネスト
 * 第2の項目
 ** 第2の項目のネスト
 * 第3の項目
`);
      assert(chunks.length == 1);
      const list = chunks[0];
      assert(list.type == 'UnorderedList');
    });

    it('should parse lines starting with a number as a OrderedList', function () {
      const chunks = parseAsChunks(`
 1. 第1の条件
 2. 第2の条件
 3. 第3の条件
`);
      assert(chunks.length == 1);
      const list = chunks[0];
      assert(list.type == 'OrderedList');
    });

    it('should parse lines starting with : as a DefinitionList', function () {
      const chunks = parseAsChunks(`
 : Alpha
    DEC の作っていた RISC CPU。
    浮動小数点数演算が速い。
 : POWER
    IBM とモトローラが共同製作した RISC CPU。
    派生として POWER PC がある。
 : SPARC
    Sun が作っている RISC CPU。
    CPU 数を増やすのが得意。
`);
      assert(chunks.length == 1);
      const list = chunks[0];
      assert(list.type == 'DefinitionList');
    });

    it('should parse comments as a Comment chunk', function () {
      const chunks = parseAsChunks(`
#@# This is a comment.
#@# Independent comment lines form a Comment chunk.
`);
      assert(chunks.length == 2);
      assert.deepEqual(chunks.map(chunk => chunk.type),
                       ['Comment', 'Comment']);
      assert.deepEqual(chunks.map(chunk => chunk.lines.length), [1, 1]);
    });

    it('should parse paragraph immediately after comments as a Paragraph chunk', function () {
      const chunks = parseAsChunks(`
#@# This is a comment.
#@# Independent comment lines form a Comment chunk.
This is a paragraph immediately after a comment.
`);
      assert(chunks.length == 3);
      assert.deepEqual(chunks.map(chunk => chunk.type),
                       ['Comment', 'Comment', 'Paragraph']);
      assert.deepEqual(chunks.map(chunk => chunk.lines.length),
                       [1, 1, 1]);
    });

    it('should parse comments in a paragraph as a part of a Paragraph chunks', function () {
      const chunks = parseAsChunks(`
This is a paragraph immediately before a comment.
#@# This is a comment.
#@# Comment lines in a paragraph does not form a Comment chunk.
This is a paragraph immediately after a comment.
`);
      assert(chunks.length == 1);
      const paragraph = chunks[0];
      assert(paragraph.type == 'Paragraph');
      assert(paragraph.lines.length == 4);
      assert.deepEqual(paragraph.lines.map(line => line.isComment),
                       [undefined, true, true, undefined]);
    });
  });
});
