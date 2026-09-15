
const calculateWeeks = (totalHours, hoursPerWeek) =>{
    return totalHours / hoursPerWeek;
}

const calculateHoursLeft = (totalHours, hoursPerWeek) =>{
    return totalHours % hoursPerWeek;
}

const main = (totalHours, hoursPerWeek) =>{
    const weeks = calculateWeeks(totalHours, hoursPerWeek);
    const lastWeek = calculateHoursLeft(totalHours, hoursPerWeek);
    //TODO:validation
    //format output to integers only
    console.log(totalHours, hoursPerWeek, weeks, lastWeek);
}
main(process.argv[2], process.argv[3]);