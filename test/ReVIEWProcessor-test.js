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
        textlint.setupRules({
          'no-todo': require('textlint-rule-no-todo'),
        });
      });

      it('should report error', function () {
        var fixturePath = path.join(__dirname, '/fixtures/test.re');
        let results = textlint.lintFile(fixturePath);
        assert(results.messages.length > 0);
        assert(results.filePath === fixturePath);
      });
    });
  });
});
