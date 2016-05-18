// LICENSE : MIT
'use strict';
import assert from 'assert';
import { traverse } from 'txt-ast-traverse';
import { Syntax } from './mapping';

/**
 * parse text and return ast mapped location info.
 * @param {string} text
 * @return {TxtNode}
 */
export function parse(text) {
  var ast = doParse(text);

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

/**
 * do parse text and return ast mapped location info.
 * @param {string} text
 * @return {TxtNode}
 */
function doParse(text) {
  var lines = text.match(/(?:.*\r?\n|.+$)/g); // split lines preserving line endings
  //console.log(lines);
  var startIndex = 0;
  var children = lines.reduce(function (result, currentLine, index) {
    var lineNumber = index + 1;
    parseLine(result, currentLine, lineNumber, startIndex);
    startIndex += currentLine.length;
    return result;
  }, []);

  flushParagraph(children);

  // update paragraph node using str nodes
  children.forEach(function (node) {
    if (node.type == Syntax.Paragraph) {
      fixParagraphNode(node, text);
    }
  });

  var ast = {
    type: Syntax.Document,
    raw: text,
    range: [0, startIndex],
    loc: {
      start: {
        line: 1,
        column: 0,
      },
      end: {
        line: lines.length,
        column: lines[lines.length - 1].length,
      },
    },
    children: children,
  };

  return ast;

  var currentBlock = null;
  var currentParagraph = null;

  function parseLine(result, currentLine, lineNumber, startIndex) {
    var currentText = currentLine.replace(/\r?\n$/, ''); // without line endings

    // ignore comment
    if (currentLine.startsWith('#@')) {
      return;
    }

    // ignore block
    if (isInBlock()) {
      if (currentLine.startsWith('//}')) {
        currentBlock = null;
      } else if (currentBlock == '//table') {
        Array.prototype.push.apply(result, parseTableContent(currentText, startIndex, lineNumber));
      }

      return;
    }

    // blocks
    let match = currentText.match(/^(\/\/\w+)(.*)\{?$/);
    if (match) {
      flushParagraph(result);
      const blockName = match[1];
      const blockArgs = parseArgs(match[2]);
      if (currentText.endsWith('{')) {
        // block with open and end tags, e.g. //list, //emlist, etc.
        currentBlock = blockName;
      } else {
        // one-line block, e.g. //footnote, //image, etc.
        if (blockName == '//footnote') {
          result.push(
            parseFootnoteBlock(currentText, blockName, blockArgs, startIndex, lineNumber));
        }
      }

      return;
    }

    // heading
    if (currentLine.startsWith('=')) {
      var headingNode = parseHeading(currentText, startIndex, lineNumber);
      result.push(headingNode);
      flushParagraph(result);
      return;
    }

    // empty line
    if (currentLine == '\n' || currentLine == '\r\n') {
      flushParagraph(result);
      return;
    }

    // normal string
    var nodes = parseText(currentText, startIndex, lineNumber);
    if (currentParagraph) {
      // add str node to the last paragraph
      currentParagraph.children = currentParagraph.children.concat(nodes);
    } else {
      // create paragraph node having str node
      currentParagraph = createParagraphNode(nodes);
    }
  }

  function flushParagraph(result) {
    if (currentParagraph) {
      result.push(currentParagraph);
    }

    currentParagraph = null;
  }

  function isInBlock() {
    return currentBlock != null;
  }

  function parseArgs(argsText) {
    var match;
    const argRegex = /\[(.*?)\]/g;
    const args = [];
    while (match = argRegex.exec(argsText)) {
      args.push({
        value: match[1],
        index: match.index + 1,
      });
    }

    return args;
  }
}

/**
 * parse heading line.
 * @param {string} text - Text of the line
 * @param {number} startIndex - Global start index of the line
 * @param {number} lineNumber - Line number of the line
 * @return {TxtNode} HeadingNode
 */
function parseHeading(text, startIndex, lineNumber) {
  var match = text.match(/(=+)\S*\s*(.*)/);  // \S* skip [column] and {ch01}
  var depth = match[1].length;
  var label = match[2].trim();
  var labelOffset = text.indexOf(label);
  assert(labelOffset >= 0);
  var strNode = createStrNode(label, startIndex + labelOffset, lineNumber, labelOffset);
  return createHeadingNode(text, depth, startIndex, lineNumber, strNode);
}

/**
 * parse line in a table.
 * @param {string} text - Text of the line
 * @param {number} startIndex - Global start index of the line
 * @param {number} lineNumber - Line number of the line
 * @return {[TxtNode]} TxtNodes in the line
 */
function parseTableContent(text, startIndex, lineNumber) {
  if (text.match(/^-+$/)) {
    return [];  // Ignore horizontal line
  }

  const nodes = [];
  const cellRegex = /[^\t]+/g;
  var match;
  while (match = cellRegex.exec(text)) {
    let startColumn = match.index;
    let cellContent = match[0];
    if (cellContent.startsWith('.')) {
      cellContent = cellContent.substr(1);
      startColumn += 1;
    }

    if (cellContent == '') {
      continue;
    }

    const cellNode = createNode('ListItem', cellContent, startIndex + startColumn,
                                lineNumber, startColumn);
    cellNode.children = parseText(cellContent, startIndex + startColumn, lineNumber, startColumn);
    nodes.push(cellNode);
  }

  return nodes;
}

/**
 * parse footnote block.
 * @param {string} text - Text of the line
 * @param {string} blockName - Name of the block, should be '//footnote'
 * @param {[Arg]} blockArgs - Args of the block
 * @param {number} startIndex - Global start index of the line
 * @param {number} lineNumber - Line number of the line
 * @return {TxtNode} FootnoteNode
 */
function parseFootnoteBlock(text, blockName, blockArgs, startIndex, lineNumber) {
  const footnote = createNode(Syntax.Footnote, text, startIndex, lineNumber);
  const footnoteText = blockArgs[1].value;
  const startColumn = blockName.length + blockArgs[1].index;
  const paragraph = createNode(Syntax.Paragraph, footnoteText,
                               startIndex + startColumn, lineNumber, startColumn);
  paragraph.children = parseText(footnoteText, startIndex + startColumn, lineNumber, startColumn);
  footnote.children = [paragraph];
  return footnote;
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

/**
 * create paragraph node from TxtNodes.
 * @param {[TxtNode]} nodes - Child nodes
 * @return {TxtNode} Paragraph node
 */
function createParagraphNode(nodes) {
  return {
    type: Syntax.Paragraph,
    children: nodes || [],
  };
}

/**
 * fill properties of paragraph node.
 * @param {TxtNode} node - Paragraph node to modify
 * @param {string} fullText - Full text of the document
 */
function fixParagraphNode(node, fullText) {
  var firstNode = node.children[0];
  var lastNode = node.children[node.children.length - 1];

  node.range = [firstNode.range[0], lastNode.range[1]];
  node.raw = fullText.slice(node.range[0], node.range[1]);
  node.loc = {
    start: {
      line: firstNode.loc.start.line,
      column: firstNode.loc.start.column,
    },
    end: {
      line: lastNode.loc.end.line,
      column: lastNode.loc.end.column,
    },
  };
}
