'use strict';
// Node 18 has no global File (Node 20+ does): take it from the buffer module so the tests run the same everywhere.
if (typeof globalThis.File === 'undefined') { try { globalThis.File = require('buffer').File; } catch (e) { /* very old Node */ } }
