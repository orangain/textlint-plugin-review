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
  return parseText(line.text, line.startIndex, line.lineNumber);
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
  return (tag, startIndex, lineNumber, startColumn) =>
    parseInlineNonTextTag(type, tag, startIndex, lineNumber, startColumn);
}

/**
 * get text tag parser function.
 * @param {string} type - type of tag
 * @return {function} parser function
 */
function inlineTextTagParser(type) {
  return (tag, startIndex, lineNumber, startColumn) =>
    parseInlineTextTag(type, tag, startIndex, lineNumber, startColumn);
}

/**
 * parse non-text tag, which has no child.
 * @param {string} type - type of tag
 * @param {Tag} tag - tag to parse
 * @param {number} startIndex - Global start index of the line
 * @param {number} lineNumber - Line number of the line
 * @param {number} startColumn - Start column in the line
 * @return {TxtNode}
 */
function parseInlineNonTextTag(type, tag, startIndex, lineNumber, startColumn) {
  const node = createInlineNode(type, tag.fullText, startIndex, lineNumber, startColumn);
  return node;
}

/**
 * parse text tag, which has child Str node.
 * @param {string} type - type of tag
 * @param {Tag} tag - tag to parse
 * @param {number} startIndex - Global start index of the line
 * @param {number} lineNumber - Line number of the line
 * @param {number} startColumn - Start column in the line
 * @return {TxtNode}
 */
function parseInlineTextTag(type, tag, startIndex, lineNumber, startColumn) {
  const node = createInlineNode(type, tag.fullText, startIndex, lineNumber, startColumn);
  const strNode = createStrNode(tag.content.raw, tag.content.value,
                                startIndex + tag.content.index, lineNumber,
                                startColumn + tag.content.index);
  node.children = [strNode];
  return node;
}

/**
 * parse @<href>{} tag.
 * @param {Tag} tag - tag to parse
 * @param {number} startIndex - Global start index of the line
 * @param {number} lineNumber - Line number of the line
 * @param {number} startColumn - Start column in the line
 * @return {TxtNode}
 */
function parseHrefTag(tag, startIndex, lineNumber, startColumn) {
  const node = createInlineNode(Syntax.Href, tag.fullText, startIndex, lineNumber, startColumn);

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

  const strNode = createStrNode(label, label, startIndex + labelOffset,
                                lineNumber, startColumn + labelOffset);

  node.url = url;
  node.children = [strNode];

  return node;
}

/**
 * parse @<ruby>{} tag.
 * @param {Tag} tag - tag to parse
 * @param {number} startIndex - Global start index of the line
 * @param {number} lineNumber - Line number of the line
 * @param {number} startColumn - Start column in the line
 * @return {TxtNode}
 */
function parseRubyTag(tag, startIndex, lineNumber, startColumn) {
  const node = createInlineNode(Syntax.Ruby, tag.fullText, startIndex, lineNumber, startColumn);
  const pieces = tag.content.raw.split(/\s*,\s*/, 2);
  assert(pieces.length == 2);
  const rubyBase = pieces[0];
  const rubyText = pieces[1];

  const strNode = createStrNode(rubyBase, rubyBase, startIndex, lineNumber, startColumn);

  node.rubyText = rubyText;
  node.children = [strNode];

  return node;
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

  const nodes = [];
  let tag;
  while (tag = findInlineTag(text)) {
    if (tag.precedingText != '') {
      const node = createStrNode(tag.precedingText, tag.precedingText,
                                 startIndex, lineNumber, startColumn);
      nodes.push(node);
      startIndex += node.raw.length;
      startColumn += node.raw.length;
    }

    const parser = InlineParsers[tag.name];
    if (parser) {
      const node = parser(tag, startIndex, lineNumber, startColumn);
      nodes.push(node);
    }

    startIndex += tag.fullText.length;
    startColumn += tag.fullText.length;
    text = tag.followingText;
  }

  if (text.length) {
    const node = createStrNode(text, text, startIndex, lineNumber, startColumn);
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
      value: unescapeContent(rawContent),
      index: contentStartIndex - match.index,
    },
    fullText: text.substr(match.index, closeIndex - match.index + 1),
    precedingText: text.substr(0, match.index),
    followingText: text.substr(closeIndex + 1),
  };

  return tag;

  function unescapeContent(text) {
    return text.replace(/\\\}/g, '}');
  };
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
  return createInlineNode(type, line.text, line.startIndex, line.lineNumber);
}

/**
 * create Str TxtNode.
 * @param {string} raw - Raw text of node
 * @param {string} value - like raw but does not contain escape character
 * @param {number} startIndex - Start index in the document
 * @param {number} lineNumber - Line number of node
 * @param {number} [startColumn=0] - Start column in the line
 * @return {TxtNode} Created TxtNode
 */
export function createStrNode(raw, value, startIndex, lineNumber, startColumn=0) {
  assert(!value.match(/[\r\n]/));

  const node = createInlineNode(Syntax.Str, raw, startIndex, lineNumber, startColumn);
  node.value = value;
  return node;
}

/**
 * create inline TxtNode.
 * @param {string} type - Type of node
 * @param {string} raw - Raw text of node
 * @param {number} startIndex - Start index in the document
 * @param {number} lineNumber - Line number of node
 * @param {number} [startColumn=0] - Start column in the line
 * @return {TxtNode} Created TxtNode
 */
export function createInlineNode(type, raw, startIndex, lineNumber, startColumn=0) {
  assert(!raw.match(/[\r\n]/));

  return {
    type: type,
    raw: raw,
    range: [startIndex, startIndex + raw.length],
    loc: {
      start: {
        line: lineNumber,
        column: startColumn,
      },
      end: {
        line: lineNumber,
        column: startColumn + raw.length,
      },
    },
  };
}

