// LICENSE : MIT
'use strict';
import assert from 'assert';
import { traverse } from 'txt-ast-traverse';
import { Syntax, ChunkTypes } from './mapping';
import { parseAsChunks } from './review-to-chunks';

/**
 * parse text and return ast mapped location info.
 * @param {string} text
 * @return {TxtNode}
 */
export function parse(text) {
  const ast = parseDocument(text);

  var prevNode = ast;
  traverse(ast, {
    enter(node) {
      if (node.type != Syntax.Document) {
        try {
          assert.deepEqual(node.raw, text.slice(node.range[0], node.range[1]));
        } catch (ex) {
          console.log('type: %s, line: %s, column: %s',
                      prevNode.type, prevNode.loc.start.line, prevNode.loc.start.column);
          console.log('type: %s, line: %s, column: %s',
                      node.type, node.loc.start.line, node.loc.start.column);
          throw ex;
        }
      }

      prevNode = node;
    },
  });

  return ast;
}

const ChunkParsers = {
  Paragraph: parseParagraph,
  Heading: parseHeading,
  UnorderedList: chunk => parseList(/^\s+\*+\s+/, chunk),
  OrderedList: chunk => parseList(/^\s+\d+\.\s+/, chunk),
  DefinitionList: chunk => parseList(/^(\s+:\s+|\s+)/, chunk),
  Block: parseBlock,
};

/**
 * parse whole document and return ast mapped location info.
 * @param {string} text
 * @return {TxtNode}
 */
function parseDocument(text) {
  const lines = text.match(/(?:.*\r?\n|.+$)/g); // split lines preserving line endings
  const chunks = parseAsChunks(text);
  const nodes = [];
  chunks.forEach(chunk => {
    const parser = ChunkParsers[chunk.type];
    const node = parser(chunk);
    if (node != null) {
      nodes.push(node);
    }
  });

  const lastChunk = chunks[chunks.length - 1];
  const lastLine = lastChunk.lines[lastChunk.lines.length - 1];

  const ast = {
    type: Syntax.Document,
    raw: text,
    range: [0, text.length],
    loc: {
      start: {
        line: 1,
        column: 0,
      },
      end: {
        line: lastLine.lineNumber,
        column: lastLine.text.length,
      },
    },
    children: nodes,
  };

  return ast;
}

/**
 * parse paragraph chunk.
 * @param {Chunk} chunk - Chunk to parse
 * @return {TxtNode} Paragraph node
 */
function parseParagraph(chunk) {
  const node = createNodeFromChunk(chunk);
  node.children = [];
  chunk.lines.forEach(line => {
    Array.prototype.push.apply(node.children, parseLine(line));
  });
  return node;
}

/**
 * parse a line.
 * @param {Line} line - line to parse
 * @return {[TxtNode]} TxtNodes
 */
function parseLine(line) {
  return parseText(line.text, line.startIndex, line.lineNumber);
}

/**
 * parse heading line.
 * @param {Chunk} chunk - Chunk to parse
 * @return {TxtNode} Heading node
 */
function parseHeading(chunk) {
  const line = chunk.lines[0];
  const match = line.text.match(/(=+)\S*\s*(.*)/);  // \S* skip [column] and {ch01}
  const depth = match[1].length;
  const label = match[2].trim();
  const labelOffset = line.text.indexOf(label);
  assert(labelOffset >= 0);
  const strNode = createStrNode(label, line.startIndex + labelOffset, line.lineNumber, labelOffset);
  return createHeadingNode(line.text, depth, line.startIndex, line.lineNumber, strNode);
}

function parseList(prefixRegex, chunk) {
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

const BlockParsers = {
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
 * parse block.
 * @param {Chunk} chunk - Chunk to parse
 * @return {TxtNode} Block node
 */
function parseBlock(chunk) {
  const line = chunk.lines[0];
  const match = line.text.match(/^\/\/(\w+)(.*)\{?$/);
  const blockName = match[1];
  const blockArgs = parseArgs(match[2], 2 + blockName.length);
  const parser = BlockParsers[blockName];

  if (!parser) {
    return null;
  }

  return parser(blockName, blockArgs, chunk);
}

/**
 * parse arguments of a block like "[foo][This is foo]".
 * @param {string} argsText - String to parse
 * @param {number} offset - Offset index where the args starts with in the line
 * @return {[Arg]} Array of Args
 */
function parseArgs(argsText, offset) {
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

/**
 * parse single argument of a block as a TxtNode
 * @param {string} type - Type of node
 * @param {Arg} blockArg - Arg of a block to parse
 * @param {Line} line - line where Arg exists
 * @return {TxtNode}
 */
function parseBlockArg(type, blockArg, line) {
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
 * parse table block.
 * @param {string} blockName - Name of the block, should be '//footnote'
 * @param {[Arg]} blockArgs - Args of the block
 * @param {Chunk} chunk - Chunk to parse
 * @return {TxtNode} Table node
 */
function parseTable(blockName, blockArgs, chunk) {
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
function parseFootnote(blockName, blockArgs, chunk) {
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
function parseCodeBlock(captionIndex, blockName, blockArgs, chunk) {
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
function parseImage(blockName, blockArgs, chunk) {
  const node = createNodeFromChunk(chunk, Syntax.Image);
  const caption = parseBlockArg(Syntax.Caption, blockArgs[1], chunk.lines[0]);
  if (caption) {
    node.children = [caption];
  }

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
function parseText(text, startIndex, lineNumber, startColumn) {
  startColumn = startColumn || 0;
  var nodes = [];
  var match;

  // TODO: Support escape character \} in { }
  while (match = text.match(/@<(\w+)>\{(.*?)\}/)) {
    if (match.index > 0) {
      let node = createStrNode(text.substr(0, match.index), startIndex, lineNumber, startColumn);
      nodes.push(node);
      startIndex += node.raw.length;
      startColumn += node.raw.length;
    }

    var markup = { name: match[1], content: match[2] };
    if (markup.name == 'code') {
      let node = createNode(Syntax.Code, match[0], startIndex, lineNumber, startColumn);
      nodes.push(node);
    } else if (markup.name == 'href') {
      let pieces = markup.content.split(/,/, 2);
      let url = pieces[0];
      let label = pieces.length == 2 ? pieces[1] : url;

      let linkNode = createNode(Syntax.Link, match[0], startIndex, lineNumber, startColumn);
      let labelOffset = match[0].indexOf(label);
      assert(labelOffset >= 0);
      let strNode = createStrNode(label, startIndex + labelOffset,
                                  lineNumber, startColumn + labelOffset);
      linkNode.children = [strNode];
      nodes.push(linkNode);
    } else if (markup.name == 'br') {
      let emptyBreakNode = createBRNode(match[0], startIndex, lineNumber, startColumn);
      nodes.push(emptyBreakNode);
    } else if (['img', 'list', 'hd', 'table', 'fn'].indexOf(markup.name) >= 0) {
      // do nothing
    } else {
      let offset = ('@<' + markup.name + '>{').length;
      let node = createStrNode(markup.content, startIndex + offset,
                               lineNumber, startColumn + offset);
      nodes.push(node);
    }

    startIndex += match[0].length;
    startColumn += match[0].length;
    text = text.substr(match.index + match[0].length);
  }

  if (text.length) {
    let node = createStrNode(text, startIndex, lineNumber, startColumn);
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
function createNodeFromChunk(chunk, type) {
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
function createNodeFromLine(line, type) {
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
function createNode(type, text, startIndex, lineNumber, startColumn) {
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

/**
 * create StrNode.
 * @param {string} text - Raw text of node
 * @param {number} startIndex - Start index in the document
 * @param {number} lineNumber - Line number of node
 * @param {number} [startColumn=0] - Start column in the line
 * @return {TxtNode} Created StrNode
 */
function createStrNode(text, startIndex, lineNumber, startColumn) {
  return createNode(Syntax.Str, text, startIndex, lineNumber, startColumn);
}

/**
 * create BreakNode.
 * @param {string} text - Raw text of line break
 * @param {number} startIndex - Start index in the document
 * @param {number} lineNumber - Line number of node
 * @param {number} [startColumn=0] - Start column in the line
 * @return {TxtNode} Created BRNode
 */
function createBRNode(text, startIndex, lineNumber, startColumn) {
  return createNode(Syntax.Break, text, startIndex, lineNumber, startColumn);
}

/**
 * create HeaderNode.
 * @param {string} text - Raw text of node
 * @param {number} depth - Depth of heading
 * @param {number} startIndex - Start index in the document
 * @param {number} lineNumber - Line number of node
 * @param {TxtNode} strNode - Child StrNode
 * @return {TxtNode} Created StrNode
 */
function createHeadingNode(text, depth, startIndex, lineNumber, strNode) {
  var node = createNode(Syntax.Heading, text, startIndex, lineNumber);
  node.depth = depth;
  node.children = [strNode];
  return node;
}
