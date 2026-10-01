'use strict';
/*
 * The real DOM form engine (FormValidator.init on a <form>) must give the answers of spec/form-rules.vectors.json,
 * just like the value-only engine. jsdom here; the same runner runs in Chrome, Firefox, WebKit and the phone profiles
 * in browser-tests/browser.spec.js.
 */
require('./helpers/shim.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
// jsdom has no layout: treat every element as rendered
Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() { return [1]; } });
Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, CSS: w.CSS });
globalThis.FileValidator = require('../src/fileValidator.js');
const FormValidator = require('../src/formValidator.js');
const runDomVectors = require('../spec/dom-vectors.js');
const spec = require('../spec/form-rules.vectors.json');

test('every vector gives the same answer through the real DOM form engine (jsdom)', async () => {
    const bad = await runDomVectors(FormValidator, spec.cases);
    assert.equal(bad.length, 0, bad.length + ' of ' + spec.cases.length + ' vectors differ:\n' + bad.slice(0, 30).join('\n'));
});
