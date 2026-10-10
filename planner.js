/**
 * Study-Time Calculator (planner.js)
 *
 * Terminal calculator that calculates required study duration in weeks
 * and hours needed in the final week for a given study goal.
 */

const { pluralize, isPositiveInteger, calculateStudyPlan } = require('./src/calculation');

/**
 * Prints the calculated study plan to standard output.
 */
function printStudyPlan(plan) {
  console.log(`Total hours: ${pluralize(plan.totalHours, 'hour')}`);
  console.log(`Weekly hours: ${pluralize(plan.weeklyHours, 'hour')}`);
  console.log(`Required weeks: ${pluralize(plan.totalWeeks, 'week')}`);
  console.log(`Final-week hours: ${pluralize(plan.finalWeekHours, 'hour')}`);
}

/**
 * Prints usage instructions and an optional error message.
 */
function printUsage(errorMessage) {
  if (errorMessage) {
    console.error(`Error: ${errorMessage}\n`);
  }
  console.log('Usage: node planner.js <totalHours> <weeklyHours>');
  console.log('  totalHours:  Total required study hours (positive whole number)');
  console.log('  weeklyHours: Available study hours per week (positive whole number)');
  console.log('\nExample:');
  console.log('  node planner.js 30 12');
}

/**
 * Main application entry point: parses CLI arguments, validates inputs, and triggers calculation.
 */
function main() {
  const args = process.argv.slice(2);

  // Stretch goal: Support --help / -h
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    printUsage();
    process.exit(0);
  }

  // Reject missing or extra arguments
  if (args.length !== 2) {
    printUsage(`Expected exactly 2 arguments, but received ${args.length}.`);
    process.exit(1);
  }

  const [rawTotalHours, rawWeeklyHours] = args;

  // Validate total hours
  if (!isPositiveInteger(rawTotalHours)) {
    printUsage(`Total hours must be a positive whole number. Received: "${rawTotalHours}".`);
    process.exit(1);
  }

  // Validate weekly hours
  if (!isPositiveInteger(rawWeeklyHours)) {
    printUsage(`Weekly hours must be a positive whole number. Received: "${rawWeeklyHours}".`);
    process.exit(1);
  }

  const totalHours = Number(rawTotalHours);
  const weeklyHours = Number(rawWeeklyHours);

  const plan = calculateStudyPlan(totalHours, weeklyHours);
  printStudyPlan(plan);
}

main();
