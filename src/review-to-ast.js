// LICENSE : MIT
'use strict';
import assert from 'assert';
import { traverse } from 'txt-ast-traverse';
import { Syntax } from './mapping';
import { parseAsChunks } from './review-to-chunks';
import { ChunkParsers } from './chunk-parsers';

/**
 * parse text and return ast mapped location info.
 * @param {string} text
 * @return {TxtNode}
 */
export function parse(text) {
  const ast = parseDocument(text);

  var prevNode = ast;
  traverse(ast, {
    enter(node) {
      if (node.type != Syntax.Document) {
        try {
          assert.deepEqual(node.raw, text.slice(node.range[0], node.range[1]));
        } catch (ex) {
          console.log('type: %s, line: %s, column: %s',
                      prevNode.type, prevNode.loc.start.line, prevNode.loc.start.column);
          console.log('type: %s, line: %s, column: %s',
                      node.type, node.loc.start.line, node.loc.start.column);
          throw ex;
        }
      }

      prevNode = node;
    },
  });

  return ast;
}

/**
 * parse whole document and return ast mapped location info.
 * @param {string} text
 * @return {TxtNode}
 */
function parseDocument(text) {
  const lines = text.match(/(?:.*\r?\n|.+$)/g); // split lines preserving line endings
  const chunks = parseAsChunks(text);
  const nodes = [];
  chunks.forEach(chunk => {
    const parser = ChunkParsers[chunk.type];
    const node = parser(chunk);
    if (node != null) {
      nodes.push(node);
    }
  });

  const lastChunk = chunks[chunks.length - 1];
  const lastLine = lastChunk.lines[lastChunk.lines.length - 1];

  const ast = {
    type: Syntax.Document,
    raw: text,
    range: [0, text.length],
    loc: {
      start: {
        line: 1,
        column: 0,
      },
      end: {
        line: lastLine.lineNumber,
        column: lastLine.text.length,
      },
    },
    children: nodes,
  };

  return ast;
}
