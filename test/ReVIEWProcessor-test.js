// LICENSE : MIT
"use strict";
import assert from "power-assert";
import ReVIEWProcessor from "../src/ReVIEWProcessor";
import {parse} from "../src/review-to-ast";
import {tagNameToType} from "../src/mapping";
import {TextLintCore} from "textlint";
import path from "path";
describe("ReVIEWProcessor-test", function () {
    describe("#parse", function () {
        it("should return AST", function () {
            var result = parse(`= Text\n\naaaa`);
            assert(result.type === "Document");
        });
        it("@<code>{} should be Code", function () {
            var result = parse(`@<code>{var a = 1}`);
            let script = result.children[0];
            script.children.forEach(code => {
                assert.equal(code.type, "Code");
            });
        });
        it("text should be Paragraph", function () {
            var result = parse(`test`);
            let pTag = result.children[0];
            assert.equal(pTag.type, "Paragraph");
        });
    });
    describe("ReVIEWPlugin", function () {
        let textlint;
        context("when target file is a ReVIEW", function () {
            beforeEach(function () {
                textlint = new TextLintCore();
                textlint.addProcessor(ReVIEWProcessor);
                textlint.setupRules({
                    "no-todo": require("textlint-rule-no-todo")
                });
            });
            it("should report error", function () {
                var fixturePath = path.join(__dirname, "/fixtures/test.re");
                let results = textlint.lintFile(fixturePath);
                assert(results.messages.length > 0);
                assert(results.filePath === fixturePath);
            });
        });
    });
});
