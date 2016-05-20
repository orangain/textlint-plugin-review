// LICENSE : MIT
'use strict';

export const Syntax = {
  // ReVIEW name => textlint name
  Document: 'Document',
  Heading: 'Header',
  Paragraph: 'Paragraph',
  UnorderedList: 'List',
  OrderedList: 'List',
  DefinitionList: 'List',
  ListItem: 'ListItem',
  Table: 'Table',
  TableCell: 'ListItem',
  CodeBlock: 'CodeBlock',
  Image: 'Image',
  Quote: 'BlockQuote',

  // inline
  Str: 'Str',
  Break: 'Break',
  Code: 'Code',
  Link: 'Link',

  // specific to review-plugin
  Footnote: 'Footnote', // footnote
  Caption: 'Caption', // caption text of image, table and code block
  Lead: 'Block', // corespond to review's block having no special meanings
  ShortColumn: 'Block',
};
