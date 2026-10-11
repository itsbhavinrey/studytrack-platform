/**
 * src/calculation.js - CommonJS bridge to the shared calculation module.
 *
 * Since Project 5 the pure P1/P2 functions live in web/js/calculation.mjs so
 * the browser can load the very same file. Node 22.12+ can require() an ES
 * module synchronously; the result is its namespace object, so existing code
 * keeps writing `const { calculateStudyPlan } = require('./calculation')`.
 */

module.exports = require('../web/js/calculation.mjs');
