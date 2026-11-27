/** A calendar day as people write it: "Thu 17 Sept". Anything that is not a plain YYYY-MM-DD day is returned unchanged. */
export function dateLabel(day: string | null | undefined, weekday = true): string {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return day ?? '';
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString('en-GB', weekday ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' });
}
