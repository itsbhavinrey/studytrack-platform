
const calculateWeeks = (totalHours, hoursPerWeek) =>{
    return Math.ceil(totalHours / hoursPerWeek);
}

const calculateHoursLeft = (totalHours, hoursPerWeek) =>{
    return totalHours % hoursPerWeek;
}

const main = (totalHours, hoursPerWeek) =>{
    const weeks = calculateWeeks(totalHours, hoursPerWeek);
    const lastWeek = calculateHoursLeft(totalHours, hoursPerWeek);
    //TODO:validation and positive whole number only, reject extra args and missing args, zero or negative numbers or non numeric text
    //format output to integers only
    console.log(`${weeks} ${weeks > 1 ? 'weeks' : 'week'} ${lastWeek===0 ? '' : `and ${lastWeek} ${lastWeek===1 ? 'hour' : 'hours'}`}`);
}

console.log('Starting planner...', process.argv);
const args = process.argv.slice(2);
const EXPECTED_ARGS = 2;

if(args.length !== EXPECTED_ARGS){
    console.error(`Expected ${EXPECTED_ARGS} arguments, got ${args.length}`);
    process.exit(1);
}

for(let i=0; i<EXPECTED_ARGS; i++){
    const arg = args[i];
    const isPositiveWholeNumber = Number.isInteger(Number(arg)) && Number(arg) > 0;
    console.log('Args:',arg, isPositiveWholeNumber, Number.isInteger(Number(arg)), Number(arg) > 0);
    if(!isPositiveWholeNumber){
        console.error(`Argument ${i+1} is not a positive whole number`);
        process.exit(1);
    }
}

const totalHours = Number(args[0]);
const hoursPerWeek = Number(args[1]);

main(totalHours, hoursPerWeek);
