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
      assert.equal(paragraph.type, 'Paragraph');
      assert.equal(paragraph.children.length, 2);
      paragraph.children.forEach(str => {
        assert.equal(str.type, 'Str');
      });
    });

    it('should parse separated lines as each Paragraph', function () {
      const result = parse(`test
paragraph

another paragraph`);
      assert.equal(result.children.length, 2);
      assert.deepEqual(result.children.map(node => node.type),
                       ['Paragraph', 'Paragraph']);
    });

    it('should parse equal signs as headings', function () {
      const result = parse(`={ch01} Test

== Headings`);
      const heading1 = result.children[0];
      assert.equal(heading1.type, 'Header');
      assert.equal(heading1.depth, 1);
      assert.equal(heading1.children[0].type, 'Str');
      assert.equal(heading1.children[0].raw, 'Test');
      const heading2 = result.children[result.children.length - 1];
      assert.equal(heading2.type, 'Header');
      assert.equal(heading2.depth, 2);
      assert.equal(heading2.children[0].type, 'Str');
      assert.equal(heading2.children[0].raw, 'Headings');
    });

    it('should parse @<code>{} as a Code', function () {
      const result = parse(`@<code>{var a = 1}`);
      const script = result.children[0];
      script.children.forEach(code => {
        assert.equal(code.type, 'Code');
      });
    });

    it('should parse @<br>{} as a Break', function () {
      const result = parse(`first line and@<br>{}second line are same pagaraph.
`);
      const script = result.children[0];
      assert(script.children[0].raw.startsWith('first line'));
      assert.equal(script.children[1].type, 'Break');
      assert.equal(script.children[1].raw, '@<br>{}');
      assert(script.children[2].raw.startsWith('second line'));
    });

    it('should ignore #@#', function () {
      const result = parse(`#@# ???
test
paragraph
#@# !!!

another paragraph`);
      assert.equal(result.children.length, 2);
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
      assert(result.children[0].raw == 'first line\n');
      assert(result.children[2].raw == 'second line');
      const list = result.children[1];
      assert(list.type == 'CodeBlock');
      assert(list.raw == `//list[foo][Assign 0 to x]{
let x = 0;
//}
`);
      assert(list.children.length == 1);
      const caption = list.children[0];
      assert(caption.type == 'Caption');
    });

    it('should not ignore following content of //footnote having inline tags', function () {
      const result = parse(`first line

//footnote[example][@<href>{http://example.com/}]

second line`);
      assert(result.children.length == 3);
      assert(result.children[0].raw == 'first line\n');
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
  });
});
