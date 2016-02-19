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
        it("text should be Paragraph", function () {
            var result = parse(`test`);
            let paragraph = result.children[0];
            assert.equal(paragraph.type, "Paragraph");
        });
        it("consecutive lines should form a Paragraph", function () {
            var result = parse(`test\nparagraph`);
            let paragraph = result.children[0];
            assert.equal(paragraph.type, "Paragraph");
            assert.equal(paragraph.children.length, 2);
            paragraph.children.forEach(str => {
              assert.equal(str.type, 'Str');
            });
        });
        it("separated lines should form each Paragraph splited by Break", function () {
            var result = parse(`test\nparagraph\n\nanother paragraph`);
            assert.equal(result.children.length, 3);
            assert.deepEqual(result.children.map(node => node.type),
                             ['Paragraph', 'Break', 'Paragraph']);
        });
        it("equal signs should be headings", function () {
            var result = parse(`={ch01} Test\n\n== Headings`);
            let heading1 = result.children[0];
            assert.equal(heading1.type, 'Header');
            assert.equal(heading1.depth, 1);
            assert.equal(heading1.children[0].type, 'Str');
            assert.equal(heading1.children[0].raw, 'Test');
            let heading2 = result.children[result.children.length - 1];
            assert.equal(heading2.type, 'Header');
            assert.equal(heading2.depth, 2);
            assert.equal(heading2.children[0].type, 'Str');
            assert.equal(heading2.children[0].raw, 'Headings');
        });
        it("@<code>{} should be Code", function () {
            var result = parse(`@<code>{var a = 1}`);
            let script = result.children[0];
            script.children.forEach(code => {
                assert.equal(code.type, "Code");
            });
        });
        it("#@# should be ignored", function () {
            let result = parse(`#@# ???\ntest\nparagraph\n#@# !!!\n\nanother paragraph`);
            assert.equal(result.children.length, 3);
            assert(!result.children[0].raw.includes('???'));
            assert.deepEqual(result.children.map(node => node.type),
                             ['Paragraph', 'Break', 'Paragraph']);
        });
        it("#@warn should be ignored", function () {
            let result = parse(`test\nparagraph\n\n#@warn(TODO: should be fixed)\nanother paragraph`);
            assert(!result.children[2].raw.includes('TODO'));
            assert.deepEqual(result.children.map(node => node.type),
                             ['Paragraph', 'Break', 'Paragraph']);
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
