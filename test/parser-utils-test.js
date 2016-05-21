'use strict';
import assert from 'power-assert';
import { parseBlockArgs, findInlineTag } from '../src/parser-utils';

describe('parser-utils', function () {
  describe('#parseBlockArgs', function () {
    it('should parse empty string as an empty array', function () {
      const args = parseBlockArgs('', 0);
      assert.deepEqual(args, []);
    });

    it('should parse one arguments', function () {
      const args = parseBlockArgs('[foo]', 0);
      assert.deepEqual(args, [
        { startColumn: 1, value: 'foo' },
      ]);
    });

    it('should parse two arguments', function () {
      const args = parseBlockArgs('[foo][bar]', 0);
      assert.deepEqual(args, [
        { startColumn: 1, value: 'foo' },
        { startColumn: 6, value: 'bar' },
      ]);
    });

    it('should parse arguments with offset', function () {
      const args = parseBlockArgs('[foo][bar]', 4);
      assert.deepEqual(args, [
        { startColumn: 5, value: 'foo' },
        { startColumn: 10, value: 'bar' },
      ]);
    });

    it('should parse arguments with escape character', function () {
      const args = parseBlockArgs('[foo][bar\\]baz]', 0);
      assert.deepEqual(args, [
        { startColumn: 1, value: 'foo' },
        { startColumn: 6, value: 'bar\\]baz' },
      ]);
    });
  });

  describe('#findInlineTag', function () {
    it('should find inline tag', function () {
      const tag = findInlineTag(`AAA@<b>{BBB}CCC`);
      assert.deepEqual(tag, {
        name: 'b',
        content: {
          raw: 'BBB',
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
});
