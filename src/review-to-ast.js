// LICENSE : MIT
'use strict';
import assert from 'assert';
import { traverse } from '@textlint/ast-traverse';
import { test as testTextlintAST } from '@textlint/ast-tester';
import { Syntax } from './mapping';
import { parseAsChunks } from './chunker';
import { ChunkParsers } from './chunk-parsers';

/**
 * parse text and return ast mapped location info.
 * @param {string} text
 * @return {TxtNode}
 */
export function parse(text) {
  const lines = text.match(/(?:.*\r?\n|.+$)/g); // split lines preserving line endings
  const chunks = parseAsChunks(text);
  const nodes = [];
  chunks.forEach(chunk => {
    const parser = ChunkParsers[chunk.type];
    const node = parser(chunk);
    if (node !== null) {
      nodes.push(node);
    }
  });

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
        line: lines.length,
        column: lines[lines.length - 1].length,
      },
    },
    children: nodes,
  };

  validateAST(ast, text, lines);

  return ast;
}

function validateAST(ast, text, lines) {
  testTextlintAST(ast);

  let prevNode = ast;
  traverse(ast, {
    enter(node) {
      try {
        assert(node.raw === text.slice(node.range[0], node.range[1]));

        if (node.loc.start.line === node.loc.end.line) {
          // single line
          const line = lines[node.loc.start.line - 1];
          assert(node.raw === line.slice(node.loc.start.column, node.loc.end.column));
        } else {
          // multi line
          const firstLine = lines[node.loc.start.line - 1];
          assert(node.raw.startsWith(firstLine.substr(node.loc.start.column)));
          const lastLine = lines[node.loc.end.line - 1];
          assert(node.raw.endsWith(lastLine.substr(0, node.loc.end.column)));
        }
      } catch (ex) {
        console.log('type: %s, line: %s, column: %s',
                    prevNode.type, prevNode.loc.start.line, prevNode.loc.start.column);
        console.log('type: %s, line: %s, column: %s',
                    node.type, node.loc.start.line, node.loc.start.column);
        throw ex;
      }

      prevNode = node;
    },
  });

}
