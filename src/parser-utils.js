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
  const captionText = blockArg.value;
  if (!captionText) {
    return null;
  }

  const startColumn = blockArg.startColumn;
  const caption = createNode(type, captionText, line.startIndex + startColumn,
                              line.lineNumber, startColumn);
  caption.children = parseText(captionText, line.startIndex + startColumn,
                                line.lineNumber, startColumn);
  return caption;
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

  const createInlineNode = function (type, text) {
    return createNode(type, text, startIndex, lineNumber, startColumn);
  };

  const createInlineStrNode = function (text, offset=0) {
    return createNode(Syntax.Str, text, startIndex + offset, lineNumber, startColumn + offset);
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
      const node = createInlineNode(Syntax.Code, match[0]);
      nodes.push(node);
    } else if (markup.name == 'href') {
      const pieces = markup.content.split(/,/, 2);
      const url = pieces[0];
      const label = pieces.length == 2 ? pieces[1] : url;

      const linkNode = createInlineNode(Syntax.Link, match[0]);
      const labelOffset = match[0].indexOf(label);
      assert(labelOffset >= 0);
      const strNode = createInlineStrNode(label, labelOffset);
      linkNode.children = [strNode];
      nodes.push(linkNode);
    } else if (markup.name == 'br') {
      const emptyBreakNode = createInlineNode(Syntax.Break, match[0]);
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
  const firstLine = chunk.lines[0];
  type = type || Syntax[chunk.type];
  return createNode(type, chunk.raw, firstLine.startIndex, firstLine.lineNumber);
}

/**
 * create TxtNode from line.
 * @param {Line} line - A line
 * @param {string} type - Type of node
 * @return {TxtNode} Created TxtNode
 */
export function createNodeFromLine(line, type) {
  return createNode(type, line.text, line.startIndex, line.lineNumber);
}

/**
 * create TxtNode.
 * @param {string} type - Type of node
 * @param {string} text - Raw text of node
 * @param {number} startIndex - Start index in the document
 * @param {number} lineNumber - Line number of node
 * @param {number} [startColumn=0] - Start column in the line
 * @return {TxtNode} Created TxtNode
 */
export function createNode(type, text, startIndex, lineNumber, startColumn) {
  startColumn = startColumn || 0;

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
