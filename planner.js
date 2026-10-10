/**
 * StudyTrack (planner.js)
 *
 * Terminal application for study time planning and persistent study session logging.
 *
 * Supports:
 * - Project 1 Calculator: node planner.js <totalHours> <weeklyHours>
 * - Project 2 Session Logging: node planner.js add <minutes> <note>
 * - Project 2 Progress Summary: node planner.js summary <goalHours> <weeklyHours>
 * - Project 2 Session History: node planner.js log
 */

const { runCli } = require('./src/cli');

runCli(process.argv.slice(2));
