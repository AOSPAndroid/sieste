// Warm code on intent, without fetching health data or starting analysis.
export const loadWorkoutView=()=>import('./analytics').then(module=>({default:module.WorkoutDetails}));
export const warmWorkoutView=()=>{void loadWorkoutView().catch(()=>{})};
