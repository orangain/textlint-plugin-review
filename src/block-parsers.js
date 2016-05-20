'use strict';
import { Syntax } from './mapping';
import { parseText, parseBlockArg, createNodeFromChunk, createNode } from './parser-utils';

export const BlockParsers = {
  table: parseTable,
  footnote: parseFootnote,
  list: (blockName, blockArgs, chunk) => parseCodeBlock(1, blockName, blockArgs, chunk),
  listnum: (blockName, blockArgs, chunk) => parseCodeBlock(1, blockName, blockArgs, chunk),
  emlist: (blockName, blockArgs, chunk) => parseCodeBlock(0, blockName, blockArgs, chunk),
  emlistnum: (blockName, blockArgs, chunk) => parseCodeBlock(0, blockName, blockArgs, chunk),
  source: (blockName, blockArgs, chunk) => parseCodeBlock(null, blockName, blockArgs, chunk),
  image: parseImage,
};

/**
 * parse table block.
 * @param {string} blockName - Name of the block, should be '//footnote'
 * @param {[Arg]} blockArgs - Args of the block
 * @param {Chunk} chunk - Chunk to parse
 * @return {TxtNode} Table node
 */
export function parseTable(blockName, blockArgs, chunk) {
  const node = createNodeFromChunk(chunk, Syntax.Table);
  node.children = [];

  const caption = parseBlockArg(Syntax.Caption, blockArgs[1], chunk.lines[0]);
  if (caption) {
    node.children.push(caption);
  }

  chunk.lines.slice(1, chunk.lines.length - 1).forEach(line => {
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
 * @param {string} blockName - Name of the block, should be '//footnote'
 * @param {[Arg]} blockArgs - Args of the block
 * @param {Chunk} chunk - Chunk to parse
 * @return {TxtNode} FootnoteNode
 */
export function parseFootnote(blockName, blockArgs, chunk) {
  const node = createNodeFromChunk(chunk, Syntax.Footnote);
  const footnoteParagraph = parseBlockArg(Syntax.Paragraph, blockArgs[1], chunk.lines[0]);
  if (footnoteParagraph) {
    node.children = [footnoteParagraph];
  }

  return node;
}

/**
 * parse code block, e.g //list, //emlist, //source etc.
 * @param {number} captionIndex - Index of caption in blockArgs, can be null if there is no caption
 * @param {string} blockName - Name of the block, should be '//footnote'
 * @param {[Arg]} blockArgs - Args of the block
 * @param {Chunk} chunk - Chunk to parse
 * @return {TxtNode} CodeBlock node
 */
export function parseCodeBlock(captionIndex, blockName, blockArgs, chunk) {
  const node = createNodeFromChunk(chunk, Syntax.CodeBlock);
  const caption = parseBlockArg(Syntax.Caption, blockArgs[1], chunk.lines[0]);
  if (caption) {
    node.children = [caption];
  }

  return node;
}

/**
 * parse image block.
 * @param {string} blockName - Name of the block, should be '//footnote'
 * @param {[Arg]} blockArgs - Args of the block
 * @param {Chunk} chunk - Chunk to parse
 * @return {TxtNode} Image node
 */
export function parseImage(blockName, blockArgs, chunk) {
  const node = createNodeFromChunk(chunk, Syntax.Image);
  const caption = parseBlockArg(Syntax.Caption, blockArgs[1], chunk.lines[0]);
  if (caption) {
    node.children = [caption];
  }

  return node;
}
