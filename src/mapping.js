// LICENSE : MIT
'use strict';

export const Syntax = {
  // ReVIEW name => textlint name
  Document: 'Document',
  Heading: 'Header',
  Paragraph: 'Paragraph',

  // inline
  Str: 'Str',
  Break: 'Break',
  Code: 'Code',
  Link: 'Link',

  UnorderedList: 'List',
  OrderedList: 'List',
  DefinitionList: 'List',
  ListItem: 'ListItem',
  Table: 'Table',
  TableCell: 'ListItem',

  Footnote: 'Footnote',
  Caption: 'Caption',
};

export const ChunkTypes = {
  Paragraph: 'Paragraph',
  Heading: 'Heading',
  UnorderedList: 'UnorderedList',
  OrderedList: 'OrderedList',
  DefinitionList: 'DefinitionList',
  Block: 'Block',
};
