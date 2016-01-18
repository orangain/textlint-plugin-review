// LICENSE : MIT
"use strict";
import assert from 'assert';
import {traverse} from 'txt-ast-traverse';
import {Syntax} from './mapping';

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
    }
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
  var children = lines.reduce(function(result, currentLine, index) {
    var lineNumber = index + 1;
    parseLine(result, currentLine, lineNumber, startIndex);
    startIndex += currentLine.length;
    return result;
  }, []);

  // update paragraph node using str nodes
  children.forEach(function(node) {
    if (node.type == Syntax.Paragraph) {
      fixParagraphNode(node, text);
    }
  });

  var ast = {
    type: Syntax.Document,
    range: [0, startIndex],
    loc: {
      start: {
        line: 1,
        column: 0
      },
      end: {
        line: lines.length,
        column: lines[lines.length - 1].length
      }
    },
    children: children
  };

  return ast;

  var isInBlock = false;

  function parseLine(result, currentLine, lineNumber, startIndex) {
    var currentText = currentLine.replace(/\r?\n$/, ''); // without line endings

    // ignore block
    if (isInBlock) {
      if (currentLine.startsWith('//}')) {
        isInBlock = false;
      }
      return;
    }

    if (currentLine.search(/^\/\/\w+.*?\{/) >= 0) {
      isInBlock = true;
      return;
    }

    // ignore images or something
    if (currentLine.search(/^\/\/\w+/) >= 0) {
      return;
    }

    // ignore comment
    if (currentLine.startsWith('#@#')) {
      return;
    }

    // heading
    if (currentLine.startsWith('=')) {
      var headingNode = parseHeading(currentText, startIndex, lineNumber);
      result.push(headingNode);
      return;
    }

    // empty line
    if (currentLine == '\n' || currentLine == '\r\n') {
      var emptyBreakNode = createBRNode(currentLine, startIndex, lineNumber);
      result.push(emptyBreakNode);
      return;
    }

    // normal string
    var nodes = parseText(currentText, startIndex, lineNumber);
    if (result.length && result[result.length - 1].type == Syntax.Paragraph) {
      // add str node to the last paragraph
      let paragraph = result[result.length - 1];
      paragraph.children = paragraph.children.concat(nodes);
    } else {
      // create paragraph node having str node
      let paragraph = createParagraphNode(nodes);
      result.push(paragraph);
    }
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
  return createHeadingNode(text, startIndex, lineNumber, strNode);
}

/**
 * parse inline tags and StrNodes from line.
 * @param {string} text - Text of the line
 * @param {number} startIndex - Global start index of the line
 * @param {number} lineNumber - Line number of the line
 * @return {[TxtNode]} TxtNodes in the line
 */
function parseText(text, startIndex, lineNumber) {
  var nodes = [];
  var startColumn = 0;
  var match;
  // TODO: Support escape character \} in { }
  while (match = text.match(/@<(\w+)>\{(.*?)\}/)) {
    if (match.index > 0) {
      let node = createStrNode(text.substr(0, match.index), startIndex, lineNumber, startColumn);
      nodes.push(node);
      startIndex += node.raw.length;
      startColumn += node.raw.length;
    }

    var markup = {name: match[1], content: match[2]};
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
        column: startColumn
      },
      end: {
        line: lineNumber,
        column: startColumn + text.length
      }
    }
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
 * @param {string} text - Raw text of line ending, '\r\n' or '\n'
 * @param {number} startIndex - Start index in the document
 * @param {number} lineNumber - Line number of node
 * @return {TxtNode} Created BRNode
 */
function createBRNode(text, startIndex, lineNumber) {
  return createNode(Syntax.Break, text, startIndex, lineNumber);
}

/**
 * create HeaderNode.
 * @param {string} text - Raw text of node
 * @param {number} startIndex - Start index in the document
 * @param {number} lineNumber - Line number of node
 * @param {TxtNode} strNode - Child StrNode
 * @return {TxtNode} Created StrNode
 */
function createHeadingNode(text, startIndex, lineNumber, strNode) {
  var node = createNode(Syntax.Heading, text, startIndex, lineNumber);
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
    children: nodes || []
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
      column: firstNode.loc.start.column
    },
    end: {
      line: lastNode.loc.end.line,
      column: lastNode.loc.end.column
    }
  };
}
