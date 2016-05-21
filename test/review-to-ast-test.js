'use strict';
import assert from 'power-assert';
import { parse } from '../src/review-to-ast';

describe('review-to-ast', function () {
  describe('#parse', function () {
    it('should return AST', function () {
      const result = parse(`= Text

aaaa`);
      assert(result.type === 'Document');
    });

    it('should parse text as a Paragraph', function () {
      const result = parse(`test`);
      const paragraph = result.children[0];
      assert.deepEqual(paragraph, {
        type: 'Paragraph',
        raw: 'test',
        range: [0, 4],
        loc: {
          start: {
            line: 1,
            column: 0,
          },
          end: {
            line: 1,
            column: 4,
          },
        },
        children: [
          {
            type: 'Str',
            raw: 'test',
            value: 'test',
            range: [0, 4],
            loc: {
              start: {
                line: 1,
                column: 0,
              },
              end: {
                line: 1,
                column: 4,
              },
            },
          },
        ],
      });
    });

    it('should parse consecutive lines as a Paragraph', function () {
      const result = parse(`test
paragraph`);
      const paragraph = result.children[0];
      assert(paragraph.type == 'Paragraph');
      assert(paragraph.raw == `test
paragraph`);
      assert(paragraph.loc.start.line == 1);
      assert(paragraph.loc.start.column == 0);
      assert(paragraph.loc.end.line == 2);
      assert(paragraph.loc.end.column == 9);
      assert(paragraph.children.length == 2);
      assert.deepEqual(paragraph.children.map(node => node.type),
                       ['Str', 'Str']);
      assert.deepEqual(paragraph.children.map(node => node.raw),
                       ['test', 'paragraph']);
    });

    it('should parse separated lines as each Paragraph', function () {
      const result = parse(`test
paragraph

another paragraph`);
      assert(result.children.length == 2);
      assert.deepEqual(result.children.map(node => node.type),
                       ['Paragraph', 'Paragraph']);
    });

    it('should not split paragraph with comments', function () {
      const result = parse(`test
paragraph
#@# This is a comment
continuation line`);
      assert(result.raw == `test
paragraph
#@# This is a comment
continuation line`);
      assert(result.children.length == 1);
      const paragraph = result.children[0];
      assert.deepEqual(paragraph.children.map(node => node.type),
                       ['Str', 'Str', 'Str']);
      assert.deepEqual(paragraph.children.map(node => node.raw),
                       ['test', 'paragraph', 'continuation line']);
      assert.deepEqual(paragraph.children.map(node => node.loc.start.line),
                       [1, 2, 4]);
    });

    it('should parse equal signs as headings', function () {
      const result = parse(`={ch01} Test

== Headings`);
      const heading1 = result.children[0];
      assert(heading1.type == 'Header');
      assert(heading1.depth == 1);
      assert(heading1.raw == '={ch01} Test');
      assert(heading1.children[0].type == 'Str');
      assert(heading1.children[0].raw == 'Test');
      const heading2 = result.children[result.children.length - 1];
      assert(heading2.type == 'Header');
      assert(heading2.depth == 2);
      assert(heading2.children[0].type == 'Str');
      assert(heading2.children[0].raw == 'Headings');
    });

    it('should parse @<code>{} as a Code', function () {
      const result = parse(`@<code>{var a = 1}`);
      const paragraph = result.children[0];
      assert(paragraph.type == 'Paragraph');
      assert(paragraph.children.length == 1);
      const code = paragraph.children[0];
      assert(code.type == 'Code');
      assert(code.raw == '@<code>{var a = 1}');
    });

    it('should parse @<br>{} as a Break', function () {
      const result = parse(`first line and@<br>{}second line are same pagaraph.
`);
      const paragraph = result.children[0];
      assert(paragraph.children[0].type == 'Str');
      assert(paragraph.children[0].raw.startsWith('first line'));
      assert(paragraph.children[1].type == 'Break');
      assert(paragraph.children[1].raw == '@<br>{}');
      assert(paragraph.children[1].loc.start.column == 14);
      assert(paragraph.children[2].type == 'Str');
      assert(paragraph.children[2].raw.startsWith('second line'));
    });

    it('should ignore #@#', function () {
      const result = parse(`#@# ???
test
paragraph
#@# !!!

another paragraph`);
      assert(result.children.length == 2);
      assert(!result.children[0].raw.includes('???'));
      assert.deepEqual(result.children.map(node => node.type),
                       ['Paragraph', 'Paragraph']);
    });

    it('should ignore #@warn', function () {
      const result = parse(`test
paragraph

#@warn(TODO: should be fixed)
another paragraph`);
      assert(!result.children[1].raw.includes('TODO'));
      assert.deepEqual(result.children.map(node => node.type),
                       ['Paragraph', 'Paragraph']);
    });

    it('should parse block', function () {
      const result = parse(`first line

//list[foo][Assign 0 to x]{
let x = 0;
//}

second line`);
      assert(result.children.length == 3);
      assert(result.children[0].raw == 'first line');
      assert(result.children[2].raw == 'second line');
      const list = result.children[1];
      assert(list.type == 'CodeBlock');
      assert(list.raw == `//list[foo][Assign 0 to x]{
let x = 0;
//}`);
      assert(list.children.length == 1);
      const caption = list.children[0];
      assert(caption.type == 'Caption');
    });

    it('should not ignore following content of //footnote having inline tags', function () {
      const result = parse(`first line

//footnote[example][@<href>{http://example.com/}]

second line`);
      assert(result.children.length == 3);
      assert(result.children[0].raw == 'first line');
      assert(result.children[2].raw == 'second line');
    });

    it('should parse table cell as ListItem', function () {
      const result = parse(`
//table[id][Environment Variables]{
Name		Comment
-------------------------------------------------------------
PATH		Directories where commands exist
TERM		Terminal. ex: linux, kterm, vt100
//}`);
      assert(result.children.length == 1);
      const table = result.children[0];
      assert(table.type == 'Table');
      assert(table.children.length == 7);
      const caption = table.children[0];
      assert(caption.type == 'Caption');
      assert(caption.children.length == 1);
      const captionStr = caption.children[0];
      assert(captionStr.type == 'Str');
      assert(captionStr.raw == 'Environment Variables');

      const tableCells = table.children.slice(1);
      tableCells.forEach(function (node) {
        assert(node.type == 'ListItem');
        assert(node.children.length == 1);
        assert(node.children[0].type == 'Str');
      });

      assert.deepEqual(tableCells.map(node => node.children[0].raw), [
        'Name', 'Comment',
        'PATH', 'Directories where commands exist',
        'TERM', 'Terminal. ex: linux, kterm, vt100',
      ]);
    });

    it('should parse inline markups in a table cell', function () {
      const result = parse(`
//table[][]{
Name	Value
-----------
@<code>{x}	1
//}`);
      const table = result.children[0];
      assert(table.children[2].children[0].type == 'Code');
    });

    it('should ignore starting . in a table cell', function () {
      const result = parse(`
//table[][]{
.	..gitignore
//}`);
      const table = result.children[0];
      assert.deepEqual(table.children.map(node => node.children[0].raw),
                       ['.gitignore']);
    });

    it('should ignore comments in a table', function () {
      const result = parse(`
//table[][]{
#@# comment in a table
//}`);
      const table = result.children[0];
      assert(table.children.length == 0);
    });

    it('should parse footnote', function () {
      const result = parse(`//footnote[foo][This is a footnote text.]`);
      const footnote = result.children[0];
      assert(footnote.type == 'Footnote');
      assert(footnote.raw == '//footnote[foo][This is a footnote text.]');
      assert(footnote.children[0].type == 'Paragraph');
      assert(footnote.children[0].raw == 'This is a footnote text.');
    });

    it('should parse footnote having inline tags', function () {
      const result = parse(`//footnote[foo][See: @<href>{http://example.com/}.]`);
      const footnote = result.children[0];
      assert(footnote.type == 'Footnote');
      assert(footnote.raw == '//footnote[foo][See: @<href>{http://example.com/}.]');
      const paragraph = footnote.children[0];
      assert(paragraph.type == 'Paragraph');
      assert(paragraph.loc.start.column == 16);
      assert(paragraph.raw == 'See: @<href>{http://example.com/}.');
      assert(paragraph.children.length == 3);
    });

    it('should parse footnote having escape characters', function () {
      const result = parse(`//footnote[foo][See: [1\\]]`);
      const footnote = result.children[0];
      assert(footnote.type == 'Footnote');
      const paragraph = footnote.children[0];
      assert(paragraph.type == 'Paragraph');
      assert(paragraph.children.length == 1);
      const code = paragraph.children[0];
      assert(code.type == 'Str');
      assert(code.raw == 'See: [1\\]');
      assert(code.value == 'See: [1]');
    });

    it('should parse footnote having more escape characters', function () {
      const result = parse(`//footnote[foo][The object should be @<code>{{x: a[1\\]\\}}.]`);
      const footnote = result.children[0];
      assert(footnote.type == 'Footnote');
      assert(footnote.raw == '//footnote[foo][The object should be @<code>{{x: a[1\\]\\}}.]');
      const paragraph = footnote.children[0];
      assert(paragraph.type == 'Paragraph');
      assert(paragraph.children.length == 3);
      const code = paragraph.children[1];
      assert(code.type == 'Code');
      assert(code.raw == '@<code>{{x: a[1\\]\\}}');
      assert(code.value == '{x: a[1]}');
    });

    it('should parse lines starting with * as a List', function () {
      const result = parse(`
 * 第1の項目
 ** 第1の項目のネスト
 * 第2の項目
 ** 第2の項目のネスト
 * 第3の項目
`);
      assert(result.children.length == 1);
      const list = result.children[0];
      assert(list.type == 'List');
      assert(list.children.length == 5);

      const item = list.children[0];
      assert(item.type == 'ListItem');
      assert(item.raw == ' * 第1の項目');
      assert(item.children.length == 1);
      const str = item.children[0];
      assert(str.type == 'Str');
      assert(str.raw == '第1の項目');
    });

    it('should parse lines starting with a number as a List', function () {
      const result = parse(`
 1. 第1の条件
 2. 第2の条件
 3. 第3の条件
`);
      assert(result.children.length == 1);
      const list = result.children[0];
      assert(list.type == 'List');
      assert(list.children.length == 3);

      const item = list.children[0];
      assert(item.type == 'ListItem');
      assert(item.raw == ' 1. 第1の条件');
      assert(item.children.length == 1);
      const str = item.children[0];
      assert(str.type == 'Str');
      assert(str.raw == '第1の条件');
    });

    it('should parse lines starting with : as a List', function () {
      const result = parse(`
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
      assert(result.children.length == 1);
      const list = result.children[0];
      assert(list.type == 'List');
      assert(list.children.length == 9);  // should be 6

      const firstItem = list.children[0];
      assert(firstItem.type == 'ListItem');
      assert(firstItem.raw == ' : Alpha');
      assert(firstItem.children.length == 1);
      const firstStr = firstItem.children[0];
      assert(firstStr.type == 'Str');
      assert(firstStr.raw == 'Alpha');

      // <dd> should be concatenated with the next line
      const secondItem = list.children[1];
      assert(secondItem.type == 'ListItem');
      assert(secondItem.raw == '    DEC の作っていた RISC CPU。');
      assert(secondItem.children.length == 1);
      const secondStr = secondItem.children[0];
      assert(secondStr.type == 'Str');
      assert(secondStr.raw == 'DEC の作っていた RISC CPU。');
    });

    it('should parse single-line image block with caption', function () {
      const result = parse(`
//image[unixhistory][a brief history of UNIX-like OS]
`);
      assert(result.children.length == 1);
      const image = result.children[0];
      assert(image.type == 'Image');
      assert(image.children.length == 1);
      const caption = image.children[0];
      assert(caption.type == 'Caption');
      assert(caption.raw == 'a brief history of UNIX-like OS');
    });

    it('should parse multi-line image block with caption', function () {
      const result = parse(`
//image[unixhistory][a brief history of UNIX-like OS]{
System V
//}
`);
      assert(result.children.length == 1);
      const image = result.children[0];
      assert(image.type == 'Image');
      assert(image.children.length == 1);
      const caption = image.children[0];
      assert(caption.type == 'Caption');
      assert(caption.raw == 'a brief history of UNIX-like OS');
    });

    it('should parse lead block as block having paragraphs', function () {
      const result = parse(`
//lead{
In the chapter, I introduce brief summary of the book,
and I show the way how to write a program in Linux.
//}
`);
      assert(result.children.length == 1);
      const lead = result.children[0];
      assert(lead.type == 'Block');
      assert(lead.children.length == 1);
      assert(lead.children[0].type == 'Paragraph');
      assert(lead.children[0].loc.start.line == 3);
      assert(lead.children[0].loc.start.column == 0);
      assert(lead.children[0].loc.end.line == 4);
      assert(lead.children[0].loc.end.column == 51);
      assert(lead.children[0].raw == `In the chapter, I introduce brief summary of the book,
and I show the way how to write a program in Linux.`);
      assert(lead.children[0].children.length == 2);
    });

    it('should parse quote block', function () {
      const result = parse(`
//quote{
Seeing is believing.
//}
`);
      assert(result.children.length == 1);
      const quote = result.children[0];
      assert(quote.type == 'BlockQuote');
      assert(quote.children.length == 1);
      assert(quote.children[0].type == 'Paragraph');
      assert(quote.children[0].raw == 'Seeing is believing.');
      assert(quote.children[0].children.length == 1);
    });

    it('should parse quote block with two paragraphs', function () {
      const result = parse(`
//quote{
Seeing is believing.

But feeling is the truth.
//}
`);
      assert(result.children.length == 1);
      const quote = result.children[0];
      assert(quote.type == 'BlockQuote');
      assert(quote.children.length == 2);
      assert.deepEqual(quote.children.map(node => node.type), ['Paragraph', 'Paragraph']);
      assert.deepEqual(quote.children.map(node => node.raw), [
        'Seeing is believing.',
        'But feeling is the truth.',
      ]);
    });

    it('should parse short column block', function () {
      const result = parse(`
//info{
You need to install python.
//}
`);
      assert(result.children.length == 1);
      const lead = result.children[0];
      assert(lead.type == 'Block');
      assert(lead.children.length == 1);
      assert(lead.children[0].type == 'Paragraph');
      assert(lead.children[0].raw == `You need to install python.`);
    });
  });
});
