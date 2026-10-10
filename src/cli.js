/**
 * CLI and Command Handling Module (src/cli.js)
 *
 * Handles CLI arguments, flags, command routing, and formatted terminal output.
 * Preserves exact backward compatibility with Project 1 calculator commands.
 */

const {
  pluralize,
  isPositiveInteger,
  isValidNote,
  calculateStudyPlan,
  calculateSummary,
} = require('./calculation');
const {
  CorruptDataError,
  loadSessions,
  addSession,
} = require('./storage');

/**
 * Parses raw process arguments into flags and positional tokens.
 *
 * Supports:
 * - --file <path> or -f <path>
 * - --file=<path>
 *
 * @param {string[]} rawArgs - Arguments from process.argv.slice(2)
 * @returns {{ dataFile: string|null, positionalArgs: string[] }}
 */
function parseArgs(rawArgs) {
  let dataFile = null;
  const positionalArgs = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (arg === '--file' || arg === '-f') {
      if (i + 1 < rawArgs.length) {
        dataFile = rawArgs[++i];
      } else {
        throw new Error('Flag "--file" requires a file path argument.');
      }
    } else if (arg.startsWith('--file=')) {
      dataFile = arg.slice('--file='.length);
    } else {
      positionalArgs.push(arg);
    }
  }

  return { dataFile, positionalArgs };
}

/**
 * Prints usage instructions and optional error message.
 * Compatible with Project 1 acceptance tests.
 *
 * @param {string} [errorMessage] - Optional error description
 */
function printUsage(errorMessage) {
  if (errorMessage) {
    console.error(`Error: ${errorMessage}\n`);
  }
  console.log('Usage: node planner.js <totalHours> <weeklyHours>');
  console.log('       node planner.js add <minutes> <note> [--file <path>]');
  console.log('       node planner.js summary <goalHours> <weeklyHours> [--file <path>]');
  console.log('       node planner.js log [--file <path>]');
  console.log('\nCommands:');
  console.log('  <totalHours> <weeklyHours>   Calculate required weeks (P1 calculator)');
  console.log('  add <minutes> <note>         Log a completed study session');
  console.log('  summary <goal> <weekly>      Show completed hours and remaining time');
  console.log('  log                          List recent study sessions (latest 5)');
  console.log('\nOptions:');
  console.log('  --file, -f <path>            Path to JSON data file');
  console.log('  --help, -h                   Show this help message');
  console.log('\nExample:');
  console.log('  node planner.js 30 12');
  console.log('  node planner.js add 45 "Learned Node fs module"');
  console.log('  node planner.js summary 30 12');
}

/**
 * Handles the calculator command (Project 1 contract).
 *
 * @param {string[]} args - [totalHours, weeklyHours]
 */
function handleCalculator(args) {
  if (args.length !== 2) {
    printUsage(`Expected exactly 2 arguments, but received ${args.length}.`);
    process.exit(1);
  }

  const [rawTotalHours, rawWeeklyHours] = args;

  if (!isPositiveInteger(rawTotalHours)) {
    printUsage(`Total hours must be a positive whole number. Received: "${rawTotalHours}".`);
    process.exit(1);
  }

  if (!isPositiveInteger(rawWeeklyHours)) {
    printUsage(`Weekly hours must be a positive whole number. Received: "${rawWeeklyHours}".`);
    process.exit(1);
  }

  const totalHours = Number(rawTotalHours);
  const weeklyHours = Number(rawWeeklyHours);

  const plan = calculateStudyPlan(totalHours, weeklyHours);

  console.log(`Total hours: ${pluralize(plan.totalHours, 'hour')}`);
  console.log(`Weekly hours: ${pluralize(plan.weeklyHours, 'hour')}`);
  console.log(`Required weeks: ${pluralize(plan.totalWeeks, 'week')}`);
  console.log(`Final-week hours: ${pluralize(plan.finalWeekHours, 'hour')}`);
}

/**
 * Handles the "add <minutes> <note>" command.
 *
 * @param {string[]} args - Positional arguments after 'add'
 * @param {string|null} dataFile - Optional custom data file path
 */
function handleAdd(args, dataFile) {
  if (args.length < 2) {
    console.error('Error: "add" requires <minutes> and <note>. Usage: node planner.js add <minutes> <note>\n');
    console.log('Example: node planner.js add 45 "Completed array methods exercises"');
    process.exit(1);
  }

  const rawMinutes = args[0];
  // Join remaining arguments in case note was passed without quotes: add 45 note here
  const note = args.slice(1).join(' ').trim();

  if (!isPositiveInteger(rawMinutes)) {
    console.error(`Error: Minutes must be a positive whole number. Received: "${rawMinutes}".`);
    process.exit(1);
  }

  if (!isValidNote(note)) {
    console.error('Error: Note cannot be empty.');
    process.exit(1);
  }

  const minutes = Number(rawMinutes);

  let newSession;
  let allSessions;
  try {
    newSession = addSession(dataFile, { minutes, note });
    allSessions = loadSessions(dataFile);
  } catch (err) {
    if (err instanceof CorruptDataError) {
      console.error(`Error: ${err.message}`);
      console.error('The corrupted file was preserved and not overwritten.');
      process.exit(1);
    }
    throw err;
  }

  const totalMinutes = allSessions.reduce((sum, s) => sum + s.minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(2).replace(/\.?0+$/, '');

  console.log(`Added session #${newSession.id}: ${pluralize(newSession.minutes, 'minute')} - "${newSession.note}"`);
  console.log(`Total study time logged: ${pluralize(totalMinutes, 'minute')} (${totalHours} hours across ${pluralize(allSessions.length, 'session')})`);
}

/**
 * Handles the "summary <goal-hours> <weekly-hours>" command.
 *
 * @param {string[]} args - Positional arguments after 'summary'
 * @param {string|null} dataFile - Optional custom data file path
 */
function handleSummary(args, dataFile) {
  if (args.length !== 2) {
    console.error('Error: "summary" requires <goal-hours> and <weekly-hours>.\n');
    console.log('Usage: node planner.js summary <goal-hours> <weekly-hours>');
    console.log('Example: node planner.js summary 30 12');
    process.exit(1);
  }

  const [rawGoalHours, rawWeeklyHours] = args;

  if (!isPositiveInteger(rawGoalHours)) {
    console.error(`Error: Goal hours must be a positive whole number. Received: "${rawGoalHours}".`);
    process.exit(1);
  }

  if (!isPositiveInteger(rawWeeklyHours)) {
    console.error(`Error: Weekly hours must be a positive whole number. Received: "${rawWeeklyHours}".`);
    process.exit(1);
  }

  const goalHours = Number(rawGoalHours);
  const weeklyHours = Number(rawWeeklyHours);

  let sessions;
  try {
    sessions = loadSessions(dataFile);
  } catch (err) {
    if (err instanceof CorruptDataError) {
      console.error(`Error: ${err.message}`);
      console.error('The corrupted file was preserved and not overwritten.');
      process.exit(1);
    }
    throw err;
  }

  const summary = calculateSummary(sessions, goalHours, weeklyHours);

  console.log(`Goal hours: ${pluralize(summary.goalHours, 'hour')}`);
  console.log(`Weekly hours: ${pluralize(summary.weeklyHours, 'hour')}`);
  console.log(`Logged sessions: ${pluralize(summary.sessionCount, 'session')}`);
  console.log(`Completed time: ${pluralize(summary.accumulatedMinutes, 'minute')} (${summary.completedHours} hours)`);
  console.log(`Remaining hours: ${summary.remainingHours} hours`);

  if (summary.isCompleted) {
    console.log('Status: Goal completed! 0 weeks remaining.');
  } else {
    console.log(`Estimated weeks remaining: ${pluralize(summary.remainingWeeks, 'week')}`);
    console.log(`Final-week hours: ${pluralize(summary.finalWeekHours, 'hour')}`);
  }
}

/**
 * Handles the "log" command (Stretch goal: list latest 5 sessions).
 *
 * @param {string|null} dataFile - Optional custom data file path
 */
function handleLog(dataFile) {
  let sessions;
  try {
    sessions = loadSessions(dataFile);
  } catch (err) {
    if (err instanceof CorruptDataError) {
      console.error(`Error: ${err.message}`);
      console.error('The corrupted file was preserved and not overwritten.');
      process.exit(1);
    }
    throw err;
  }

  if (sessions.length === 0) {
    console.log('No study sessions logged yet.');
    return;
  }

  const limit = 5;
  const latestSessions = sessions.slice(-limit);
  console.log(`Recent study sessions (showing latest ${latestSessions.length} of ${sessions.length}):`);

  for (const session of latestSessions) {
    const timeStr = session.timestamp ? new Date(session.timestamp).toLocaleString() : 'N/A';
    console.log(`  #${session.id} [${timeStr}] ${session.minutes} min - "${session.note}"`);
  }
}

/**
 * Main CLI dispatcher.
 *
 * @param {string[]} rawArgs - CLI arguments without node executable and script
 */
function runCli(rawArgs) {
  let dataFile;
  let positionalArgs;

  try {
    const parsed = parseArgs(rawArgs);
    dataFile = parsed.dataFile;
    positionalArgs = parsed.positionalArgs;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  // Handle help flag
  if (
    positionalArgs.length === 1 &&
    (positionalArgs[0] === '--help' || positionalArgs[0] === '-h')
  ) {
    printUsage();
    process.exit(0);
  }

  // If no arguments provided
  if (positionalArgs.length === 0) {
    printUsage('No command or arguments specified.');
    process.exit(1);
  }

  const command = positionalArgs[0];

  switch (command) {
    case 'add':
      handleAdd(positionalArgs.slice(1), dataFile);
      break;

    case 'summary':
      handleSummary(positionalArgs.slice(1), dataFile);
      break;

    case 'log':
    case 'list':
      handleLog(dataFile);
      break;

    case 'calculate':
      handleCalculator(positionalArgs.slice(1));
      break;

    default:
      // If first argument is not a keyword, treat as direct P1 calculator call:
      // node planner.js <totalHours> <weeklyHours>
      handleCalculator(positionalArgs);
      break;
  }
}

module.exports = {
  parseArgs,
  printUsage,
  handleCalculator,
  handleAdd,
  handleSummary,
  handleLog,
  runCli,
};
