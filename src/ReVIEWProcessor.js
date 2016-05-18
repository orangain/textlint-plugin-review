// LICENSE : MIT
'use strict';
import { parse } from './review-to-ast';
export default class ReVIEWProcessor {
  constructor(config) {
    this.config = config;
  }

  static availableExtensions() {
    return [
        '.re',
    ];
  }

  processor(ext) {
    return {
      preProcess(text, filePath) {
        return parse(text);
      },

      postProcess(messages, filePath) {
        return {
          messages,
          filePath: filePath ? filePath : '<text>',
        };
      },
    };
  }
}
