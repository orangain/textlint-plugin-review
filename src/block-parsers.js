// LICENSE : MIT
'use strict';
import { Syntax } from './mapping';
import { parseText, parseLine } from './inline-parsers';
import {
  createNodeFromChunk, createNodeFromLinesInChunk, createCommentNodeFromLine, createInlineNode,
  contextFromLine, contextNeedsUnescapeBrackets
} from './parser-utils';

export const BlockParsers = {
  table: withCaption(1, parseTable),
  footnote: parseFootnote,
  quote: parseQuote,

  list: withCaption(1, parseCodeBlock),
  listnum: withCaption(1, parseCodeBlock),
  emlist: withCaption(0, parseCodeBlock),
  emlistnum: withCaption(0, parseCodeBlock),
  source: parseCodeBlock,
  cmd: parseCodeBlock,

  image: withCaption(1, parseImage),
  indepimage: withCaption(1, parseImage),
  numberlessimage: withCaption(1, parseImage),
  graph: withCaption(2, parseImage),
  imgtable: withCaption(1, parseImage),

  lead: parseLead,
  read: parseLead,

  note: withCaption(0, parseShortColumn),
  memo: withCaption(0, parseShortColumn),
  tip: withCaption(0, parseShortColumn),
  info: withCaption(0, parseShortColumn),
  warning: withCaption(0, parseShortColumn),
  important: withCaption(0, parseShortColumn),
  caution: withCaption(0, parseShortColumn),
  notice: withCaption(0, parseShortColumn),
};

/**
 * return new parser to parse block with caption.
 * @param {number} captionIndex - index of caption in block args
 * @param {function} blockParser - Parser function of a block
 * @return {function} parser function
 */
function withCaption(captionIndex, blockParser) {
  return function (block) {
    const node = blockParser(block);

    if (captionIndex != null) {
      const blockArg = block.args[captionIndex];
      if (blockArg) {
        const caption = parseBlockArg(Syntax.Caption, blockArg, block.chunk.lines[0]);
        if (caption) {
          node.children = node.children || [];
          node.children.unshift(caption);
        }
      }
    }

    return node;
  };
}

/**
 * parse table block.
 * @param {Block} block - Block to parse
 * @return {TxtNode} Table node
 */
function parseTable(block) {
  const node = createNodeFromChunk(block.chunk, Syntax.Table);
  node.children = [];

  block.chunk.lines.slice(1, block.chunk.lines.length - 1).forEach(line => {
    Array.prototype.push.apply(node.children, parseTableContent(line));
  });

  return node;
}

/**
 * parse line in a table.
 * @param {Line} line - Line to parse
 * @return {[TxtNode]} ListItem nodes in the line
 */
function parseTableContent(line) {
  if (line.isComment) {
    return [createCommentNodeFromLine(line)];
  }

  if (line.text.match(/^-+$/)) {
    return [];  // Ignore horizontal line
  }

  const nodes = [];
  const cellRegex = /[^\t]+/g;
  var match;
  while (match = cellRegex.exec(line.text)) {
    let startColumn = match.index;
    let cellContent = match[0];
    if (cellContent.startsWith('.')) {
      cellContent = cellContent.substr(1);
      startColumn += 1;
    }

    if (cellContent == '') {
      continue;
    }

    const context = contextFromLine(line, startColumn);
    const cellNode = createInlineNode(Syntax.TableCell, cellContent, context);
    cellNode.children = parseText(cellContent, context);
    nodes.push(cellNode);
  }

  return nodes;
}

/**
 * parse footnote block.
 * @param {Block} block - Block to parse
 * @return {TxtNode} Footnote node
 */
function parseFootnote(block) {
  const node = createNodeFromChunk(block.chunk, Syntax.Footnote);
  const footnoteParagraph = parseBlockArg(Syntax.Paragraph, block.args[1], block.chunk.lines[0]);
  if (footnoteParagraph) {
    node.children = [footnoteParagraph];
  }

  return node;
}

/**
 * parse quote block.
 * @param {Block} block - Block to parse
 * @return {TxtNode} BlockQuote node
 */
function parseQuote(block) {
  return parseBlockWithContent(block, Syntax.Quote);
}

/**
 * parse code block, e.g //list, //emlist, //source etc.
 * @param {Block} block - Block to parse
 * @return {TxtNode} CodeBlock node
 */
function parseCodeBlock(block) {
  const node = createNodeFromChunk(block.chunk, Syntax.CodeBlock);
  node.value = block.chunk.lines
    .slice(1, block.chunk.lines.length - 1)
    .filter(line => !line.isComment)
    .map(line => line.raw)
    .join('');
  return node;
}

/**
 * parse image block.
 * @param {Block} block - Block to parse
 * @return {TxtNode} Image node
 */
function parseImage(block) {
  return createNodeFromChunk(block.chunk, Syntax.Image);
}

/**
 * parse lead block.
 * @param {Block} block - Block to parse
 * @return {TxtNode} Block node
 */
function parseLead(block) {
  return parseBlockWithContent(block, Syntax.Lead);
}

/**
 * parse various short column block.
 * @param {Block} block - Block to parse
 * @return {TxtNode} Block node
 */
function parseShortColumn(block) {
  return parseBlockWithContent(block, Syntax.ShortColumn);
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
  const blockArgContext = contextNeedsUnescapeBrackets(contextFromLine(line, startColumn));
  const argNode = createInlineNode(type, argText, blockArgContext);
  argNode.children = parseText(argText, blockArgContext);
  return argNode;
}

