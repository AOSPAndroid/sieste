import type {Workout} from './analytics';
import {localDate} from './week-overview';

/** Build once per calculation rather than parsing full history for every day. */
export function activitiesByDay(activities:Workout[],now:Date){
 const days=new Map<string,Workout[]>();
 for(const activity of activities){
  const date=new Date(activity.date);
  if(!(date<=now))continue;
  const key=localDate(date),rows=days.get(key);
  if(rows)rows.push(activity);else days.set(key,[activity]);
 }
 return days;
}
