'use strict';
import { Syntax } from './mapping';
import { parseText, parseBlockArg, createNodeFromChunk, createNode } from './parser-utils';

export const BlockParsers = {
  table: withCaption(1, parseTable),
  footnote: parseFootnote,

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
};

/**
 * parse block with caption.
 * @param {number} captionIndex - index of caption in block args
 * @param {function} blockParser - Parser function of a block
 * @return {TxtNode} block node
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

    const cellNode = createNode(Syntax.TableCell, cellContent, line.startIndex + startColumn,
                                line.lineNumber, startColumn);
    cellNode.children = parseText(cellContent, line.startIndex + startColumn,
                                  line.lineNumber, startColumn);
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
 * parse code block, e.g //list, //emlist, //source etc.
 * @param {Block} block - Block to parse
 * @return {TxtNode} CodeBlock node
 */
function parseCodeBlock(block) {
  return createNodeFromChunk(block.chunk, Syntax.CodeBlock);
}

/**
 * parse image block.
 * @param {Block} block - Block to parse
 * @return {TxtNode} Image node
 */
function parseImage(block) {
  return createNodeFromChunk(block.chunk, Syntax.Image);
}
