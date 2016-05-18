// LICENSE : MIT
'use strict';
import assert from 'power-assert';
import ReVIEWProcessor from '../src/ReVIEWProcessor';
import { parse } from '../src/review-to-ast';
import { tagNameToType } from '../src/mapping';
import { TextLintCore } from 'textlint';
import path from 'path';
describe('ReVIEWProcessor-test', function () {
  describe('#parse', function () {
    it('should return AST', function () {
      var result = parse(`= Text

aaaa`);
      assert(result.type === 'Document');
    });

    it('text should be Paragraph', function () {
      var result = parse(`test`);
      let paragraph = result.children[0];
      assert.equal(paragraph.type, 'Paragraph');
    });

    it('consecutive lines should form a Paragraph', function () {
      var result = parse(`test
paragraph`);
      let paragraph = result.children[0];
      assert.equal(paragraph.type, 'Paragraph');
      assert.equal(paragraph.children.length, 2);
      paragraph.children.forEach(str => {
        assert.equal(str.type, 'Str');
      });
    });

    it('separated lines should form each Paragraph', function () {
      var result = parse(`test
paragraph

another paragraph`);
      assert.equal(result.children.length, 2);
      assert.deepEqual(result.children.map(node => node.type),
                       ['Paragraph', 'Paragraph']);
    });

    it('equal signs should be headings', function () {
      var result = parse(`={ch01} Test

== Headings`);
      let heading1 = result.children[0];
      assert.equal(heading1.type, 'Header');
      assert.equal(heading1.depth, 1);
      assert.equal(heading1.children[0].type, 'Str');
      assert.equal(heading1.children[0].raw, 'Test');
      let heading2 = result.children[result.children.length - 1];
      assert.equal(heading2.type, 'Header');
      assert.equal(heading2.depth, 2);
      assert.equal(heading2.children[0].type, 'Str');
      assert.equal(heading2.children[0].raw, 'Headings');
    });

    it('@<code>{} should be Code', function () {
      var result = parse(`@<code>{var a = 1}`);
      let script = result.children[0];
      script.children.forEach(code => {
        assert.equal(code.type, 'Code');
      });
    });

    it('@<br>{} should be Break', function () {
      let result = parse(`first line and@<br>{}second line are same pagaraph.
`);
      let script = result.children[0];
      assert(script.children[0].raw.startsWith('first line'));
      assert.equal(script.children[1].type, 'Break');
      assert.equal(script.children[1].raw, '@<br>{}');
      assert(script.children[2].raw.startsWith('second line'));
    });

    it('#@# should be ignored', function () {
      let result = parse(`#@# ???
test
paragraph
#@# !!!

another paragraph`);
      assert.equal(result.children.length, 2);
      assert(!result.children[0].raw.includes('???'));
      assert.deepEqual(result.children.map(node => node.type),
                       ['Paragraph', 'Paragraph']);
    });

    it('#@warn should be ignored', function () {
      let result = parse(`test
paragraph

#@warn(TODO: should be fixed)
another paragraph`);
      assert(!result.children[1].raw.includes('TODO'));
      assert.deepEqual(result.children.map(node => node.type),
                       ['Paragraph', 'Paragraph']);
    });

    it('should ignore //list', function () {
      let result = parse(`first line

//list[][]{
let x = 0;
//}

second line`);
      assert(result.children.length == 2);
      assert(result.children[0].raw == 'first line');
      assert(result.children[1].raw == 'second line');
    });

    it('should not ignore following content of //footnote having inline tags', function () {
      let result = parse(`first line

//footnote[example][@<href>{http://example.com/}]

second line`);
      assert(result.children.length == 3);
      assert(result.children[0].raw == 'first line');
      assert(result.children[2].raw == 'second line');
    });

    it('should parse table cell as ListItem', function () {
      let result = parse(`
//table[][]{
Name		Comment
-------------------------------------------------------------
PATH		Directories where commands exist
TERM		Terminal. ex: linux, kterm, vt100
//}`);
      assert(result.children.length == 6);
      result.children.forEach(function (node) {
        assert(node.type == 'ListItem');
        assert(node.children.length == 1);
        assert(node.children[0].type == 'Str');
      });

      assert.deepEqual(result.children.map(node => node.children[0].raw), [
        'Name', 'Comment',
        'PATH', 'Directories where commands exist',
        'TERM', 'Terminal. ex: linux, kterm, vt100',
      ]);
    });

    it('should parse inline markups in a table cell', function () {
      let result = parse(`
//table[][]{
Name	Value
-----------
@<code>{x}	1
//}`);
      assert(result.children[2].children[0].type == 'Code');
    });

    it('should ignore starting . in a table cell', function () {
      let result = parse(`
//table[][]{
.	..gitignore	
//}`);
      assert.deepEqual(result.children.map(node => node.children[0].raw),
                             ['.gitignore']);
    });

    it('should ignore comments in a table', function () {
      let result = parse(`
//table[][]{
#@# comment in a table
//}`);
      assert(result.children.length == 0);
    });

    it('should parse footnote', function () {
      const result = parse(`//footnote[foo][This is a footnote text.]`);
      const footnote = result.children[0];
      assert(footnote.type == 'Footnote');
      assert(footnote.raw == '//footnote[foo][This is a footnote text.]');
      assert(footnote.children[0].type == 'Paragraph');
      assert(footnote.children[0].raw == 'This is a footnote text.');
    });
  });

  describe('ReVIEWPlugin', function () {
    let textlint;
    context('when target file is a ReVIEW', function () {
      beforeEach(function () {
        textlint = new TextLintCore();
        textlint.addProcessor(ReVIEWProcessor);
        textlint.setupRules({
          'no-todo': require('textlint-rule-no-todo'),
        });
      });

      it('should report error', function () {
        var fixturePath = path.join(__dirname, '/fixtures/test.re');
        let results = textlint.lintFile(fixturePath);
        assert(results.messages.length > 0);
        assert(results.filePath === fixturePath);
      });
    });
  });
});
