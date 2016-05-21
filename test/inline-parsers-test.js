// LICENSE : MIT
'use strict';
import assert from 'power-assert';
import { parseText } from '../src/inline-parsers';

describe('inline-parsers', function () {
  describe('#parseText', function () {
    const context = {
      startIndex: 0,
      lineNumber: 1,
      startColumn: 0,
    };

    it('should parse inline tag', function () {
      const nodes = parseText(`@<b>{BBB}`, context);
      assert(nodes.length == 1);
      const strong = nodes[0];
      assert(strong.type == 'Strong');
      assert(strong.children.length == 1);
      assert(strong.children[0].type == 'Str');
      assert(strong.children[0].loc.start.line == 1);
      assert(strong.children[0].loc.start.column == 5);
    });

    it('should parse inline tag with following text', function () {
      const nodes = parseText(`@<b>{BBB}CCC`, context);
      assert(nodes.length == 2);
      assert.deepEqual(nodes.map(node => node.type),
                       ['Strong', 'Str']);
      assert.deepEqual(nodes.map(node => node.raw),
                       ['@<b>{BBB}', 'CCC']);
      const strong = nodes[0];
      assert(strong.type == 'Strong');
      assert(strong.children.length == 1);
      assert(strong.children[0].type == 'Str');
      assert(strong.children[0].loc.start.line == 1);
      assert(strong.children[0].loc.start.column == 5);
    });

    it('should parse inline tag with preceding text', function () {
      const nodes = parseText(`AAA@<b>{BBB}`, context);
      assert(nodes.length == 2);
      assert.deepEqual(nodes.map(node => node.type),
                       ['Str', 'Strong']);
      assert.deepEqual(nodes.map(node => node.raw),
                       ['AAA', '@<b>{BBB}']);
      const strong = nodes[1];
      assert(strong.type == 'Strong');
      assert(strong.children.length == 1);
      assert(strong.children[0].type == 'Str');
      assert(strong.children[0].loc.start.line == 1);
      assert(strong.children[0].loc.start.column == 8);
    });

    it('should parse inline tag with surrounding texts', function () {
      const nodes = parseText(`AAA@<b>{BBB}CCC`, context);
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
      const nodes = parseText(`AAA@<b>{BB\\}B}CCC`, context);
      assert(nodes.length == 3);
      assert.deepEqual(nodes.map(node => node.type),
                       ['Str', 'Strong', 'Str']);
      assert.deepEqual(nodes.map(node => node.raw),
                       ['AAA', '@<b>{BB\\}B}', 'CCC']);
    });

    it('should parse href tag as a Link node', function () {
      const nodes = parseText(`See: @<href>{http://www.google.com/}.`, context);
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
      const nodes = parseText(`See: @<href>{http://www.google.com/, google}.`, context);
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

    it('should parse href tag as a Link node with label contains escape character', function () {
      const nodes = parseText(`See: @<href>{http://www.google.com/, {google\\}}.`, context);
      assert(nodes.length == 3);
      assert.deepEqual(nodes.map(node => node.type),
                       ['Str', 'Link', 'Str']);
      const link = nodes[1];
      assert(link.url == 'http://www.google.com/');
      assert(link.raw == '@<href>{http://www.google.com/, {google\\}}');
      assert(link.children.length == 1);
      assert(link.children[0].type == 'Str');
      assert(link.children[0].raw == '{google\\}');
      assert(link.children[0].value == '{google}');
      assert(link.children[0].loc.start.line == 1);
      assert(link.children[0].loc.start.column == 37);
    });

    it('should parse ruby tag as a Ruby node', function () {
      const nodes = parseText(`He is @<ruby>{Matsumoto, Matz}.`, context);
      assert(nodes.length == 3);
      assert.deepEqual(nodes.map(node => node.type),
                       ['Str', 'Ruby', 'Str']);
      const ruby = nodes[1];
      assert(ruby.rubyText == 'Matz');
      assert(ruby.children.length == 1);
      assert(ruby.children[0].type == 'Str');
      assert(ruby.children[0].raw == 'Matsumoto');
    });

    it('should parse fn tag as a Reference node', function () {
      const nodes = parseText(`This is it@<fn>{example}.`, context);
      assert(nodes.length == 3);
      assert.deepEqual(nodes.map(node => node.type),
                       ['Str', 'Reference', 'Str']);
    });
  });
});
