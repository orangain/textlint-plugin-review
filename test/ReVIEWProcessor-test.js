// LICENSE : MIT
'use strict';
import assert from 'power-assert';
import ReVIEWPlugin from '../src/index';
import { TextlintKernel } from "@textlint/kernel";
import fs from "fs";
import path from 'path';

const lintFile = (filePath, filterRules, options = true) => {
    const kernel = new TextlintKernel();
    const text = fs.readFileSync(filePath, "utf-8");
    return kernel.lintText(text, {
        filePath,
        ext: ".re",
        plugins: [
            {
                pluginId: "review",
                plugin: ReVIEWPlugin,
                options
            }
        ],
        rules: [
          { ruleId: "no-todo", rule: require("textlint-rule-no-todo").default }
        ],
        filterRules: filterRules
    });
};

describe('ReVIEWPlugin', function () {
  context('when target file is a ReVIEW', function () {
    it('should report error', function () {
      const fixturePath = path.join(__dirname, '/fixtures/test.re');
      return lintFile(fixturePath, []).then(results => {
        assert(results.messages.length === 1);
        assert(results.messages[0].line === 11);
        assert(results.filePath === fixturePath);
      });
    });

    it('should not report error inside magic comments', function () {
      const fixturePath = path.join(__dirname, '/fixtures/test.re');
      const filterRules = [
        { ruleId: "filter", rule: require("textlint-filter-rule-comments") }
      ];
      return lintFile(fixturePath, filterRules).then(results => {
        assert(results.messages.length === 0);
        assert(results.filePath === fixturePath);
      });
    });
  });
});
