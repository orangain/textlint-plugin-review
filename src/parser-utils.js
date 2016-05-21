// LICENSE : MIT
'use strict';
import assert from 'assert';
import { Syntax } from './mapping';

/**
 * parse arguments of a block like "[foo][This is foo]".
 * @param {string} argsText - String to parse
 * @param {number} offset - Offset index where the args starts with in the line
 * @return {[Arg]} Array of Args
 */
export function parseBlockArgs(argsText, offset) {
  const argRegex = /\[(.*?)\]/g;
  const args = [];

  let openIndex = 0;
  while (argsText[openIndex] === '[') {
    let closeIndex = findCloseBracket(argsText, ']', openIndex);

    args.push({
      value: argsText.slice(openIndex + 1, closeIndex),
      startColumn: offset + openIndex + 1,
    });

    openIndex = closeIndex + 1;
  }

  return args;
}

/**
 * find inline tag from text
 * @param {string} text - Text to parse
 * @return {Tag} the first Tag object if inline tag found, otherwise null
 */
export function findInlineTag(text) {
  const match = text.match(/@<(\w+)>\{/);
  if (!match) {
    return null; // inline tag not found
  }

  // We need to ignore escaped closing brace \}.
  // As look-behind expression is relatively new, use indexOf()
  let contentStartIndex = match.index + match[0].length;
  let closeIndex = findCloseBracket(text, '}', contentStartIndex);
  if (closeIndex < 0) {
    return null; // not found
  }

  const contentCloseIndex = closeIndex - 1;
  const rawContent = text.substr(contentStartIndex, contentCloseIndex - contentStartIndex + 1);
  const tag = {
    name: match[1],
    content: {
      raw: rawContent,
      index: contentStartIndex - match.index,
    },
    fullText: text.substr(match.index, closeIndex - match.index + 1),
    precedingText: text.substr(0, match.index),
    followingText: text.substr(closeIndex + 1),
  };

  return tag;
}

function findCloseBracket(text, character, fromIndex=0) {
  let closeIndex;
  while (true) {
    closeIndex = text.indexOf(character, fromIndex);
    if (closeIndex < 0) {
      break; // closing } not found. this is normal string not a inline tag
    }

    if (text[closeIndex - 1] !== '\\') {
      break; // found closing } which is not escaped
    }

    fromIndex = closeIndex + 1;
  }

  return closeIndex;
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
 * create TxtNode from single line.
 * @param {Line} line - A line
 * @param {string} type - Type of node
 * @return {TxtNode} Created TxtNode
 */
export function createNodeFromLine(type, line) {
  assert(!line.isComment);
  return createInlineNode(type, line.text, contextFromLine(line));
}

/**
 * create comment TxtNode from single line.
 * @param {Line} line - A line
 * @return {TxtNode} Created TxtNode
 */
export function createCommentNodeFromLine(line) {
  assert(line.isComment);
  const node = createInlineNode(Syntax.Comment, line.text, contextFromLine(line));
  let match;
  if (match = line.text.match(/^#@#\s*(.*)/)) {
    node.value = match[1];
  } else if (match = line.text.match(/^#@warn\((.*)\)/)) {
    node.value = match[1];
  } else {
    node.value = line.text;
  }

  return node;
}

/**
 * create Str TxtNode.
 * @param {string} raw - Raw text of node
 * @param {Context} context - context of the node
 * @return {TxtNode} Created TxtNode
 */
export function createStrNode(raw, context) {
  const node = createInlineNode(Syntax.Str, raw, context);
  node.value = unescapeValue(raw, context);
  return node;
}

/**
 * unescape value considering context
 * @param {string} value - Value to unescape
 * @param {Context} context - context of unescape
 * @return {string} Unescaped value
 */
export function unescapeValue(value, context) {
  if (context.unescapeBraces) {
    value = value.replace(/\\\}/g, '}');
  }

  if (context.unescapeBrackets) {
    value = value.replace(/\\\]/g, ']');
  }

  return value;
}

/**
 * create inline TxtNode.
 * @param {string} type - Type of node
 * @param {string} raw - Raw text of node
 * @param {Context} context - context of the node
 * @return {TxtNode} Created TxtNode
 */
export function createInlineNode(type, raw, context) {
  assert(!raw.match(/[\r\n]/));

  return {
    type: type,
    raw: raw,
    range: [context.startIndex, context.startIndex + raw.length],
    loc: {
      start: {
        line: context.lineNumber,
        column: context.startColumn,
      },
      end: {
        line: context.lineNumber,
        column: context.startColumn + raw.length,
      },
    },
  };
}

/**
 * create context from Line.
 * @param {Line} line - Line object
 * @param {number} [offset=0] - Column offset
 * @return {Context} Created Context object
 */
export function contextFromLine(line, offset=0) {
  return {
    startIndex: line.startIndex + offset,
    lineNumber: line.lineNumber,
    startColumn: offset,
  };
}

/**
 * create new context with offset from original context.
 * @param {Context} originalContext - Original Context object
 * @param {number} offset - Column offset
 * @return {Context} New Context object
 */
export function offsetContext(originalContext, offset) {
  const newContext = Object.assign({}, originalContext);
  newContext.startIndex += offset;
  newContext.startColumn += offset;
  return newContext;
}

/**
 * create new context with unescapeBraces = true.
 * @param {Context} originalContext - Original Context object
 * @return {Context} New Context object
 */
export function contextNeedsUnescapeBraces(originalContext) {
  const newContext = Object.assign({}, originalContext);
  newContext.unescapeBraces = true;
  return newContext;
}

/**
 * create new context with unescapeBrackets = true.
 * @param {Context} originalContext - Original Context object
 * @return {Context} New Context object
 */
export function contextNeedsUnescapeBrackets(originalContext) {
  const newContext = Object.assign({}, originalContext);
  newContext.unescapeBrackets = true;
  return newContext;
}
