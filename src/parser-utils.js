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
  const argNode = createInlineNode(type, argText, contextFromLine(line, startColumn));
  argNode.children = parseText(argText, contextFromLine(line, startColumn));
  return argNode;
}

/**
 * parse a block with content. which is parsed as paragraphs.
 * @param {Block} block - line to parse
 * @param {string} type - Type of node
 * @return {[TxtNode]} TxtNode
 */
export function parseBlockWithContent(block, type) {
  const chunk = block.chunk;
  const node = createNodeFromChunk(chunk, type);
  node.children = [];

  let lines = [];
  const flushParagraph = function () {
    if (lines.length > 0) {
      const paragraph = createNodeFromLinesInChunk(Syntax.Paragraph, lines, chunk);
      paragraph.children = [];
      lines.forEach(line => {
        Array.prototype.push.apply(paragraph.children, parseLine(line));
      });
      node.children.push(paragraph);
    }

    lines = [];
  };

  chunk.lines.slice(1, chunk.lines.length - 1).forEach(line => {
    if (line.text == '') {
      flushParagraph();
    } else {
      lines.push(line);
    }
  });

  flushParagraph();

  return node;
}

/**
 * parse a line.
 * @param {Line} line - line to parse
 * @return {[TxtNode]} TxtNodes
 */
export function parseLine(line) {
  return parseText(line.text, contextFromLine(line));
}

const InlineParsers = {
  // text tags
  kw:      inlineTextTagParser(Syntax.Keyword),
  bou:     inlineTextTagParser(Syntax.Bouten),
  ami:     inlineTextTagParser(Syntax.Amikake),
  u:       inlineTextTagParser(Syntax.Underline),
  b:       inlineTextTagParser(Syntax.Bold),
  i:       inlineTextTagParser(Syntax.Italic),
  strong:  inlineTextTagParser(Syntax.Strong),
  em:      inlineTextTagParser(Syntax.Emphasis),
  tt:      inlineTextTagParser(Syntax.Teletype),
  tti:     inlineTextTagParser(Syntax.TeletypeItalic),
  ttb:     inlineTextTagParser(Syntax.TeletypeBold),
  tcy:     inlineTextTagParser(Syntax.TateChuYoko),

  // partially text tags
  ruby:    parseRubyTag,
  href:    parseHrefTag,

  // non-text tags
  chap:    inlineNonTextTagParser(Syntax.Reference),
  title:   inlineNonTextTagParser(Syntax.Reference),
  chapref: inlineNonTextTagParser(Syntax.Reference),
  list:    inlineNonTextTagParser(Syntax.Reference),
  img:     inlineNonTextTagParser(Syntax.Reference),
  table:   inlineNonTextTagParser(Syntax.Reference),
  hd:      inlineNonTextTagParser(Syntax.Reference),
  column:  inlineNonTextTagParser(Syntax.Reference),
  fn:      inlineNonTextTagParser(Syntax.Reference),

  code:    inlineNonTextTagParser(Syntax.Code),
  uchar:   inlineNonTextTagParser(Syntax.UnicodeChar),
  br:      inlineNonTextTagParser(Syntax.Break),
  icon:    inlineNonTextTagParser(Syntax.Icon),
  m:       inlineNonTextTagParser(Syntax.Math),
  raw:     inlineNonTextTagParser(Syntax.Raw),
};

/**
 * get non-text tag parser function.
 * @param {string} type - type of tag
 * @return {function} parser function
 */
function inlineNonTextTagParser(type) {
  return (tag, context) =>
    parseInlineNonTextTag(type, tag, context);
}

/**
 * get text tag parser function.
 * @param {string} type - type of tag
 * @return {function} parser function
 */
function inlineTextTagParser(type) {
  return (tag, context) =>
    parseInlineTextTag(type, tag, context);
}

/**
 * parse non-text tag, which has no child.
 * @param {string} type - type of tag
 * @param {Tag} tag - tag to parse
 * @param {Context} context - context of the node
 * @return {TxtNode}
 */
function parseInlineNonTextTag(type, tag, context) {
  const node = createInlineNode(type, tag.fullText, context);
  return node;
}

/**
 * parse text tag, which has child Str node.
 * @param {string} type - type of tag
 * @param {Tag} tag - tag to parse
 * @param {Context} context - context of the node
 * @return {TxtNode}
 */
function parseInlineTextTag(type, tag, context) {
  const node = createInlineNode(type, tag.fullText, context);
  const strContext = contextNeedsUnescapeBraces(offsetContext(context, tag.content.index));
  const strNode = createStrNode(tag.content.raw, strContext);
  node.children = [strNode];
  return node;
}

/**
 * parse @<href>{} tag.
 * @param {Tag} tag - tag to parse
 * @param {Context} context - context of the node
 * @return {TxtNode}
 */
function parseHrefTag(tag, context) {
  const node = createInlineNode(Syntax.Href, tag.fullText, context);

  const pieces = tag.content.raw.split(/\s*,\s*/, 2);
  const url = pieces[0];
  let label;
  let labelOffset;
  if (pieces.length == 2) {
    label = pieces[1];
    labelOffset = tag.content.index + tag.content.raw.indexOf(label, url.length);
    assert(labelOffset >= tag.content.index);
  } else {
    label = url;
    labelOffset = tag.content.index;
  }

  const strContext = contextNeedsUnescapeBraces(offsetContext(context, labelOffset));
  const strNode = createStrNode(label, strContext);

  node.url = url;
  node.children = [strNode];

  return node;
}

/**
 * parse @<ruby>{} tag.
 * @param {Tag} tag - tag to parse
 * @param {Context} context - context of the node
 * @return {TxtNode}
 */
function parseRubyTag(tag, context) {
  const node = createInlineNode(Syntax.Ruby, tag.fullText, context);
  const pieces = tag.content.raw.split(/\s*,\s*/, 2);
  assert(pieces.length == 2);
  const rubyBase = pieces[0];
  const rubyText = pieces[1];

  const strContext = contextNeedsUnescapeBraces(context);
  const strNode = createStrNode(rubyBase, strContext);

  node.rubyText = rubyText;
  node.children = [strNode];

  return node;
}

/**
 * parse inline tags and StrNodes from line.
 * @param {string} text - Text of the line
 * @param {Context} context - context of the node
 * @return {[TxtNode]} TxtNodes in the line
 */
export function parseText(text, context) {
  assert(!text.match(/[\r\n]/));

  const nodes = [];
  let tag;
  while (tag = findInlineTag(text)) {
    if (tag.precedingText != '') {
      const node = createStrNode(tag.precedingText, context);
      nodes.push(node);
      context = offsetContext(context, node.raw.length);
    }

    const parser = InlineParsers[tag.name];
    if (parser) {
      const node = parser(tag, context);
      nodes.push(node);
    }

    context = offsetContext(context, tag.fullText.length);
    text = tag.followingText;
  }

  if (text.length) {
    const node = createStrNode(text, context);
    nodes.push(node);
  }

  return nodes;
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
  let fromIndex = contentStartIndex;
  let closeIndex;
  while (true) {
    closeIndex = text.indexOf('}', fromIndex);
    if (closeIndex < 0) {
      break; // closing } not found. this is normal string not a inline tag
    }

    if (text[closeIndex - 1] != '\\') {
      break; // found closing } which is not escaped
    }

    fromIndex = closeIndex + 1;
  }

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
  return createInlineNode(type, line.text, contextFromLine(line));
}

/**
 * create Str TxtNode.
 * @param {string} raw - Raw text of node
 * @param {Context} context - context of the node
 * @return {TxtNode} Created TxtNode
 */
export function createStrNode(raw, context) {
  const node = createInlineNode(Syntax.Str, raw, context);

  let value = raw;

  if (context.unescapeBraces) {
    value = value.replace(/\\\}/g, '}');
  }

  if (context.unescapeBrackets) {
    value = value.replace(/\\\]/g, ']');
  }

  node.value = value;
  return node;
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
function offsetContext(originalContext, offset) {
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
function contextNeedsUnescapeBraces(originalContext) {
  const newContext = Object.assign({}, originalContext);
  newContext.unescapeBraces = true;
  return newContext;
}
