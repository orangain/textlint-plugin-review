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

  // inline
  Str: 'Str',
  Break: 'Break',
  Code: 'Code',
  Link: 'Link',

  // specific to review-plugin
  Footnote: 'Footnote',
  Caption: 'Caption',
};
