'use strict';
import assert from 'power-assert';
import { Syntax } from './mapping';
import { BlockParsers } from './block-parsers';
import {
  parseText, parseLine, createNodeFromChunk, createNodeFromLine, createNode
} from './parser-utils';

export const ChunkParsers = {
  Paragraph: parseParagraph,
  Heading: parseHeading,
  UnorderedList: chunk => parseList(/^\s+\*+\s+/, chunk),
  OrderedList: chunk => parseList(/^\s+\d+\.\s+/, chunk),
  DefinitionList: chunk => parseList(/^(\s+:\s+|\s+)/, chunk),
  Block: parseBlock,
};

/**
 * parse paragraph chunk.
 * @param {Chunk} chunk - Chunk to parse
 * @return {TxtNode} Paragraph node
 */
export function parseParagraph(chunk) {
  const node = createNodeFromChunk(chunk);
  node.children = [];
  chunk.lines.forEach(line => {
    Array.prototype.push.apply(node.children, parseLine(line));
  });
  return node;
}

/**
 * parse heading chunk.
 * @param {Chunk} chunk - Chunk to parse
 * @return {TxtNode} Heading node
 */
export function parseHeading(chunk) {
  const line = chunk.lines[0];
  const match = line.text.match(/(=+)\S*\s*(.*)/);  // \S* skip [column] and {ch01}
  const depth = match[1].length;
  const label = match[2].trim();
  const labelOffset = line.text.indexOf(label);
  assert(labelOffset >= 0);
  const strNode = createNode(Syntax.Str, label, line.startIndex + labelOffset,
                             line.lineNumber, labelOffset);

  const heading = createNodeFromLine(line, Syntax.Heading);
  heading.depth = depth;
  heading.label = label;
  heading.children = [strNode];

  return heading;
}

/**
 * parse list chunk.
 * @param {Chunk} chunk - Chunk to parse
 * @return {TxtNode} Block node
 */
export function parseList(prefixRegex, chunk) {
  const node = createNodeFromChunk(chunk);
  node.children = [];
  chunk.lines.forEach(line => {
    const itemNode = createNodeFromLine(line, Syntax.ListItem);
    itemNode.children = [];
    const itemText = line.text.replace(prefixRegex, '');
    const startColumn = line.text.length - itemText.length;
    Array.prototype.push.apply(itemNode.children, parseText(
      itemText, line.startIndex + startColumn, line.lineNumber, startColumn));

    node.children.push(itemNode);
  });
  return node;
}

/**
 * parse block chunk.
 * @param {Chunk} chunk - Chunk to parse
 * @return {TxtNode} Block node
 */
export function parseBlock(chunk) {
  const line = chunk.lines[0];
  const match = line.text.match(/^\/\/(\w+)(.*)\{?$/);
  const block = {
    name: match[1],
    args: parseBlockArgs(match[2], 2 + match[1].length),
    chunk: chunk,
  };
  const parser = BlockParsers[block.name];

  if (!parser) {
    return null;
  }

  return parser(block);
}

/**
 * parse arguments of a block like "[foo][This is foo]".
 * @param {string} argsText - String to parse
 * @param {number} offset - Offset index where the args starts with in the line
 * @return {[Arg]} Array of Args
 */
function parseBlockArgs(argsText, offset) {
  const argRegex = /\[(.*?)\]/g;
  const args = [];
  let match;
  while (match = argRegex.exec(argsText)) {
    args.push({
      value: match[1],
      startColumn: offset + match.index + 1,
    });
  }

  return args;
}
