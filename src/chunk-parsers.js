// LICENSE : MIT
'use strict';
import assert from 'assert';
import { Syntax } from './mapping';
import { BlockParsers } from './block-parsers';
import { parseText, parseLine } from './inline-parsers';
import {
  parseBlockArgs, createNodeFromChunk, createNodeFromLine, createStrNode, contextFromLine
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
  assert(chunk.lines.length == 1);
  const line = chunk.lines[0];
  const match = line.text.match(/(=+)\S*\s*(.*)/);  // \S* skip [column] and {ch01}
  const depth = match[1].length;
  const label = match[2].trim();
  const labelOffset = line.text.indexOf(label);
  assert(labelOffset >= 0);
  const strNode = createStrNode(label, contextFromLine(line, labelOffset));
  const heading = createNodeFromLine(Syntax.Heading, line);
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
    const itemNode = createNodeFromLine(Syntax.ListItem, line);
    itemNode.children = [];
    const itemText = line.text.replace(prefixRegex, '');
    const startColumn = line.text.length - itemText.length;
    Array.prototype.push.apply(itemNode.children,
                               parseText(itemText, contextFromLine(line, startColumn)));

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
