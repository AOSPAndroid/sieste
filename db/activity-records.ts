import {storage,ownerPrefix} from './storage';
import {savedSnapshot} from './snapshot-data';

export async function saveActivityRecords(owner: string, snapshotKey: string, activities: any[]) {
  if (!snapshotKey.startsWith(await ownerPrefix(owner))) throw new Error('Invalid account snapshot.');
  const {db} = storage();
  
  const writes = activities.filter(a => typeof a?.id === 'string').map(a => db.prepare('INSERT INTO activity_records(owner,snapshot_key,activity_id,data) VALUES(?,?,?,?) ON CONFLICT(owner,snapshot_key,activity_id) DO UPDATE SET data=excluded.data').bind(owner,snapshotKey,a.id,JSON.stringify(a)));
  for (let i=0; i<writes.length; i+=80) await db.batch(writes.slice(i,i+80));
  await db.prepare('INSERT INTO activity_record_sets(owner,snapshot_key) VALUES(?,?) ON CONFLICT DO NOTHING').bind(owner,snapshotKey).run();
}

export async function activityRecords(owner: string, snapshotKey: string, ids: string[]) {
  if (!snapshotKey.startsWith(await ownerPrefix(owner))) throw new Error('Invalid account snapshot.');
  const {db} = storage();
  
  const complete = await db.prepare('SELECT snapshot_key FROM activity_record_sets WHERE owner=? AND snapshot_key=?').bind(owner,snapshotKey).first();
  if (!complete) {
    // A legacy generation is migrated once; later opens read only requested IDs.
    const data = await savedSnapshot(owner,snapshotKey);
    if (!data) return [];
    await saveActivityRecords(owner,snapshotKey,data.activities??[]);
  }
  if (!ids.length) return [];
  const rows = await db.prepare(`SELECT activity_id,data FROM activity_records WHERE owner=? AND snapshot_key=? AND activity_id IN (${ids.map(()=>'?').join(',')})`).bind(owner,snapshotKey,...ids).all<{activity_id:string;data:string}>();
  const records = new Map(rows.results.map(row => [row.activity_id,JSON.parse(row.data)]));
  return ids.map(id => records.get(id));
}

// The API boundary supplies connection-owned snapshot keys. Useful for merged
// workouts, which need 2–10 constituents rather than either full history.
export async function selectedActivityRecords(owner:string,ids:string[],snapshots:{tredict?:string|null;coros?:string|null}) {
  const native=ids.filter(id=>id.startsWith('coros_')),training=ids.filter(id=>!id.startsWith('coros_'));
  const [coros,tredict]=await Promise.all([
    native.length&&snapshots.coros?activityRecords(owner,snapshots.coros,native):Promise.resolve([]),
    training.length&&snapshots.tredict?activityRecords(owner,snapshots.tredict,training):Promise.resolve([])
  ]);
  const rows=new Map([...coros,...tredict].filter(Boolean).map(activity=>[activity.id,activity]));
  return ids.map(id=>rows.get(id));
}

export async function removeActivityRecords(owner: string, snapshotKey?: string) {
  const {db} = storage();
  
  const condition = snapshotKey ? 'owner=? AND snapshot_key=?' : 'owner=?';
  const args = snapshotKey ? [owner,snapshotKey] : [owner];
  await db.batch(['activity_records','activity_record_sets'].map(table => db.prepare(`DELETE FROM ${table} WHERE ${condition}`).bind(...args)));
}
