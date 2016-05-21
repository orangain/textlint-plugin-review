// LICENSE : MIT
'use strict';
import assert from 'power-assert';
import { Syntax } from './mapping';
import {
  parseBlockArg, findInlineTag, createNodeFromChunk, createCommentNodeFromLine, createStrNode,
  createInlineNode, contextFromLine, offsetContext, contextNeedsUnescapeBraces, unescapeValue
} from './parser-utils';

/**
 * parse a line.
 * @param {Line} line - line to parse
 * @return {[TxtNode]} TxtNodes
 */
export function parseLine(line) {
  if (line.isComment) {
    return [createCommentNodeFromLine(line)];
  }

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

  code:    parseCodeTag,
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
  const strContext = offsetContext(context, tag.content.index);
  const strNode = createStrNode(tag.content.raw, strContext);
  node.children = [strNode];
  return node;
}

/**
 * parse code tag, which has no child.
 * @param {Tag} tag - tag to parse
 * @param {Context} context - context of the node
 * @return {TxtNode}
 */
function parseCodeTag(tag, context) {
  const node = createInlineNode(Syntax.Code, tag.fullText, context);
  node.value = unescapeValue(tag.content.raw, context);
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

  const strContext = offsetContext(context, labelOffset);
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

  const strNode = createStrNode(rubyBase, context);

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
      const node = parser(tag, contextNeedsUnescapeBraces(context));
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

