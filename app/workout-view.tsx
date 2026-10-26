"use client";
import {createElement,lazy,type ComponentProps} from 'react';
import {loadWorkoutView,loadedWorkoutView} from './activity-loader';

// The workout sheet: rendered directly once its code is loaded (opened from a preload with no
// loading frame), lazily otherwise so the surrounding Suspense shows the loading sheet.
const LazyWorkout=lazy(loadWorkoutView);
type Props=ComponentProps<typeof LazyWorkout>;
export default function WorkoutView(props:Props){return createElement(loadedWorkoutView()??LazyWorkout,props)}
