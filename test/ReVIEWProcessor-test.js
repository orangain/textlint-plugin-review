// LICENSE : MIT
'use strict';
import assert from 'power-assert';
import ReVIEWProcessor from '../src/ReVIEWProcessor';
import { TextLintCore } from 'textlint';
import path from 'path';

describe('ReVIEWProcessor', function () {
  describe('ReVIEWPlugin', function () {
    let textlint;
    context('when target file is a ReVIEW', function () {
      beforeEach(function () {
        textlint = new TextLintCore();
        textlint.addProcessor(ReVIEWProcessor);
      });

      it('should report error', function () {
        textlint.setupRules({
          'no-todo': require('textlint-rule-no-todo'),
        });

        const fixturePath = path.join(__dirname, '/fixtures/test.re');
        return textlint.lintFile(fixturePath).then(results => {
          assert(results.messages.length === 1);
          assert(results.messages[0].line === 10);
          assert(results.filePath === fixturePath);
        });
      });

      it('should not report error inside magic comments', function () {
        textlint.setupRules({
          'no-todo': require('textlint-rule-no-todo'),
          'ignore-comments': require('textlint-rule-ignore-comments'),
        });

        const fixturePath = path.join(__dirname, '/fixtures/test.re');
        return textlint.lintFile(fixturePath).then(results => {
          assert(results.messages.length === 0);
          assert(results.filePath === fixturePath);
        });
      });
    });
  });
});
