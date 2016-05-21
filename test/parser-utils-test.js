'use strict';
import assert from 'power-assert';
import { findInlineTag, parseText } from '../src/parser-utils';

describe('parser-utils', function () {
  describe('#findInlineTag', function () {
    it('should find inline tag', function () {
      const tag = findInlineTag(`AAA@<b>{BBB}CCC`);
      assert.deepEqual(tag, {
        name: 'b',
        content: {
          raw: 'BBB',
          value: 'BBB',
          index: 5,
        },
        fullText: '@<b>{BBB}',
        precedingText: 'AAA',
        followingText: 'CCC',
      });
    });

    it('should find inline tag contains escape character', function () {
      const tag = findInlineTag(`AAA@<b>{BB\\}B}CCC`);
      assert.deepEqual(tag, {
        name: 'b',
        content: {
          raw: 'BB\\}B',
          value: 'BB}B',
          index: 5,
        },
        fullText: '@<b>{BB\\}B}',
        precedingText: 'AAA',
        followingText: 'CCC',
      });
    });

    it('should find first tag only', function () {
      const tag = findInlineTag(`AAA@<b>{BBB}CCC@<code>{x = 1}DDD`);
      assert.deepEqual(tag, {
        name: 'b',
        content: {
          raw: 'BBB',
          value: 'BBB',
          index: 5,
        },
        fullText: '@<b>{BBB}',
        precedingText: 'AAA',
        followingText: 'CCC@<code>{x = 1}DDD',
      });
    });

    it('should return null when inline tag does not appear', function () {
      const tag = findInlineTag(`AAA`);
      assert(tag == null);
    });

    it('should return null when inline tag is broken', function () {
      const tag = findInlineTag(`AAA@<b>{BBCCC`);
      assert(tag == null);
    });
  });

  describe('#parseText', function () {
    it('should parse inline tags', function () {
      const nodes = parseText(`AAA@<b>{BBB}CCC`, 0, 1);
      assert(nodes.length == 3);
      assert.deepEqual(nodes.map(node => node.type),
                       ['Str', 'Strong', 'Str']);
      assert.deepEqual(nodes.map(node => node.raw),
                       ['AAA', '@<b>{BBB}', 'CCC']);
      const strong = nodes[1];
      assert(strong.children.length == 1);
      assert(strong.children[0].type == 'Str');
      assert(strong.children[0].loc.start.line == 1);
      assert(strong.children[0].loc.start.column == 8);
    });

    it('should parse inline tags contains escape character', function () {
      const nodes = parseText(`AAA@<b>{BB\\}B}CCC`, 0, 1);
      assert(nodes.length == 3);
      assert.deepEqual(nodes.map(node => node.type),
                       ['Str', 'Strong', 'Str']);
      assert.deepEqual(nodes.map(node => node.raw),
                       ['AAA', '@<b>{BB\\}B}', 'CCC']);
    });

    it('should parse href tag as a Link node', function () {
      const nodes = parseText(`See: @<href>{http://www.google.com/}.`, 0, 1);
      assert(nodes.length == 3);
      assert.deepEqual(nodes.map(node => node.type),
                       ['Str', 'Link', 'Str']);
      const link = nodes[1];
      assert(link.url == 'http://www.google.com/');
      assert(link.children.length == 1);
      assert(link.children[0].type == 'Str');
      assert(link.children[0].raw == 'http://www.google.com/');
      assert(link.loc.start.column == 5);
      assert.deepEqual(link.range, [5, 36]);
    });

    it('should parse href tag as a Link node with label', function () {
      const nodes = parseText(`See: @<href>{http://www.google.com/, google}.`, 0, 1);
      assert(nodes.length == 3);
      assert.deepEqual(nodes.map(node => node.type),
                       ['Str', 'Link', 'Str']);
      const link = nodes[1];
      assert(link.url == 'http://www.google.com/');
      assert(link.children.length == 1);
      assert(link.children[0].type == 'Str');
      assert(link.children[0].raw == 'google');
      assert(link.children[0].loc.start.line == 1);
      assert(link.children[0].loc.start.column == 37);
    });
  });
});
