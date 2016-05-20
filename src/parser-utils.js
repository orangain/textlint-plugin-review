'use strict';
import assert from 'power-assert';
import { Syntax } from './mapping';

/**
 * parse single argument of a block as a TxtNode
 * @param {string} type - Type of node
 * @param {Arg} blockArg - Arg of a block to parse
 * @param {Line} line - line where Arg exists
 * @return {TxtNode}
 */
export function parseBlockArg(type, blockArg, line) {
  const argText = blockArg.value;
  if (!argText) {
    return null;
  }

  const startColumn = blockArg.startColumn;
  const argNode = createInlineNode(type, argText, line.startIndex + startColumn,
                                   line.lineNumber, startColumn);
  argNode.children = parseText(argText, line.startIndex + startColumn,
                               line.lineNumber, startColumn);
  return argNode;
}

/**
 * parse a line.
 * @param {Line} line - line to parse
 * @return {[TxtNode]} TxtNodes
 */
export function parseLine(line) {
  return parseText(line.text, line.startIndex, line.lineNumber);
}

/**
 * parse inline tags and StrNodes from line.
 * @param {string} text - Text of the line
 * @param {number} startIndex - Global start index of the line
 * @param {number} lineNumber - Line number of the line
 * @param {number} [startColumn=0] - Start column in the line
 * @return {[TxtNode]} TxtNodes in the line
 */
export function parseText(text, startIndex, lineNumber, startColumn=0) {
  assert(!text.match(/[\r\n]/));

  const createInlineNonStrNode = function (type, text) {
    return createInlineNode(type, text, startIndex, lineNumber, startColumn);
  };

  const createInlineStrNode = function (text, offset=0) {
    return createInlineNode(Syntax.Str, text, startIndex + offset, lineNumber,
                            startColumn + offset);
  };

  const nodes = [];
  let match;

  // TODO: Support escape character \} in { }
  while (match = text.match(/@<(\w+)>\{(.*?)\}/)) {
    if (match.index > 0) {
      const node = createInlineStrNode(text.substr(0, match.index));
      nodes.push(node);
      startIndex += node.raw.length;
      startColumn += node.raw.length;
    }

    const markup = { name: match[1], content: match[2] };
    if (markup.name == 'code') {
      const node = createInlineNonStrNode(Syntax.Code, match[0]);
      nodes.push(node);
    } else if (markup.name == 'href') {
      const pieces = markup.content.split(/,/, 2);
      const url = pieces[0];
      const label = pieces.length == 2 ? pieces[1] : url;

      const linkNode = createInlineNonStrNode(Syntax.Link, match[0]);
      const labelOffset = match[0].indexOf(label);
      assert(labelOffset >= 0);
      const strNode = createInlineStrNode(label, labelOffset);
      linkNode.children = [strNode];
      nodes.push(linkNode);
    } else if (markup.name == 'br') {
      const emptyBreakNode = createInlineNonStrNode(Syntax.Break, match[0]);
      nodes.push(emptyBreakNode);
    } else if (['img', 'list', 'hd', 'table', 'fn'].indexOf(markup.name) >= 0) {
      // do nothing
    } else {
      const offset = ('@<' + markup.name + '>{').length;
      const node = createInlineStrNode(markup.content, offset);
      nodes.push(node);
    }

    startIndex += match[0].length;
    startColumn += match[0].length;
    text = text.substr(match.index + match[0].length);
  }

  if (text.length) {
    const node = createInlineStrNode(text);
    nodes.push(node);
  }

  return nodes;
}

/**
 * create TxtNode from chunk.
 * @param {Chunk} chunk - A chunk
 * @param {string} [type=chunk.type] - Type of node
 * @return {TxtNode} Created TxtNode
 */
export function createNodeFromChunk(chunk, type) {
  type = type || Syntax[chunk.type];
  return createNodeFromLinesInChunk(type, chunk.lines, chunk);
}

/**
 * create TxtNode from lines in a chunk.
 * @param {string} type - Type of node
 * @param {[Line]} lines - lines in a chunk
 * @param {Chunk} chunk - A chunk
 * @return {TxtNode} Created TxtNode
 */
export function createNodeFromLinesInChunk(type, lines, chunk) {
  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1];
  const chunkStartIndex = chunk.lines[0].startIndex;
  const startIndex = firstLine.startIndex;
  const endIndex = lastLine.startIndex + lastLine.text.length;
  const text = chunk.raw.slice(startIndex - chunkStartIndex, endIndex - chunkStartIndex);

  return {
    type: type,
    raw: text,
    range: [startIndex, endIndex],
    loc: {
      start: {
        line: firstLine.lineNumber,
        column: 0,
      },
      end: {
        line: lastLine.lineNumber,
        column: lastLine.text.length,
      },
    },
  };
}

/**
 * create TxtNode from line.
 * @param {Line} line - A line
 * @param {string} type - Type of node
 * @return {TxtNode} Created TxtNode
 */
export function createNodeFromLine(line, type) {
  return createInlineNode(type, line.text, line.startIndex, line.lineNumber);
}

/**
 * create inline TxtNode.
 * @param {string} type - Type of node
 * @param {string} text - Raw text of node
 * @param {number} startIndex - Start index in the document
 * @param {number} lineNumber - Line number of node
 * @param {number} [startColumn=0] - Start column in the line
 * @return {TxtNode} Created TxtNode
 */
export function createInlineNode(type, text, startIndex, lineNumber, startColumn=0) {
  assert(!text.match(/[\r\n]/));

  return {
    type: type,
    raw: text,
    range: [startIndex, startIndex + text.length],
    loc: {
      start: {
        line: lineNumber,
        column: startColumn,
      },
      end: {
        line: lineNumber,
        column: startColumn + text.length,
      },
    },
  };
}
