// Warm code on intent, without fetching health data or starting analysis.
// Once loaded, the component is kept so the sheet can render it straight away:
// React.lazy would still wait one round before its first render.
type WorkoutView=typeof import('./analytics')['WorkoutDetails'];
let loaded:WorkoutView|null=null;
export const loadWorkoutView=()=>import('./analytics').then(module=>{loaded=module.WorkoutDetails;return {default:module.WorkoutDetails}});
export const warmWorkoutView=()=>{void loadWorkoutView().catch(()=>{})};
export const loadedWorkoutView=()=>loaded;
