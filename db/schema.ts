import {sqliteTable,text,real,primaryKey,uniqueIndex,index} from 'drizzle-orm/sqlite-core';
export const activityMergeMembers=sqliteTable('activity_merge_members',{
 owner:text('owner').notNull(),activityId:text('activity_id').notNull(),mergeId:text('merge_id').notNull(),timeZone:text('time_zone').notNull()
},table=>[primaryKey({columns:[table.owner,table.activityId]})]);
export const connections=sqliteTable('athlete_connections',{
 owner:text('owner').primaryKey(),revision:text('revision').notNull(),token:text('token_ciphertext').notNull(),snapshot:text('snapshot_key').notNull(),updated:text('updated_at').notNull()
});
export const corosConnections=sqliteTable('coros_connections',{
 owner:text('owner').primaryKey(),revision:text('revision').notNull(),credentials:text('credentials').notNull(),region:text('region').notNull(),snapshot:text('snapshot_key'),updated:text('updated_at').notNull(),refreshLock:real('refresh_lock').notNull().default(0)
});
export const corosOauthStates=sqliteTable('coros_oauth_states',{
 state:text('state').primaryKey(),owner:text('owner').notNull(),payload:text('payload').notNull(),expires:text('expires').notNull()
});
export const garminAccountState=sqliteTable('garmin_account_state',{
 owner:text('owner').primaryKey(),generation:text('generation').notNull(),intent:text('intent').notNull()
});
export const garminConnections=sqliteTable('garmin_connections',{
 owner:text('owner').primaryKey(),revision:text('revision').notNull(),userId:text('user_id').notNull(),credentials:text('credentials').notNull(),permissions:text('permissions').notNull(),updated:text('updated_at').notNull(),refreshLock:real('refresh_lock').notNull().default(0)
},table=>[uniqueIndex('garmin_connections_user_id_unique').on(table.userId)]);
export const garminOauthStates=sqliteTable('garmin_oauth_states',{
 state:text('state').primaryKey(),owner:text('owner').notNull(),payload:text('payload').notNull(),expires:text('expires').notNull()
},table=>[index('garmin_oauth_states_owner').on(table.owner),index('garmin_oauth_states_expires').on(table.expires)]);
export const garminOauthOperations=sqliteTable('garmin_oauth_operations',{
 id:text('id').primaryKey(),leaseToken:text('lease_token').notNull(),expires:real('expires').notNull()
});
export const corosFitUsage=sqliteTable('coros_fit_usage',{
 owner:text('owner').notNull(),day:text('day').notNull(),count:real('count').notNull().default(0)
},table=>[primaryKey({columns:[table.owner,table.day]})]);
export const profiles=sqliteTable('athlete_profiles',{
 owner:text('owner').primaryKey(),weight:real('weight'),height:real('height'),savedAt:text('saved_at').notNull()
});
export const sessionLabels=sqliteTable('athlete_session_labels',{
 owner:text('owner').notNull(),identity:text('identity').notNull(),activityId:text('activity_id').notNull(),label:text('label').notNull()
},table=>[primaryKey({columns:[table.owner,table.identity,table.activityId]})]);
export const analyses=sqliteTable('athlete_analyses',{
 owner:text('owner').notNull(),identity:text('identity').notNull(),activityId:text('activity_id').notNull(),signature:text('signature').notNull(),data:text('data').notNull()
},table=>[primaryKey({columns:[table.owner,table.identity,table.activityId]})]);
export const backgroundSync=sqliteTable('background_sync',{
 owner:text('owner').primaryKey(),enabled:real('enabled').notNull().default(0),timeZone:text('time_zone').notNull(),intervalMinutes:real('interval_minutes').notNull().default(30),nextRun:real('next_run').notNull(),lease:text('lease'),leaseUntil:real('lease_until').notNull().default(0),lastCompleted:text('last_completed'),lastStatus:text('last_status'),lastError:text('last_error'),lastFingerprint:text('last_fingerprint')
},table=>[index('background_sync_due').on(table.enabled,table.nextRun)]);
export const syncPushSubscriptions=sqliteTable('sync_push_subscriptions',{
 owner:text('owner').notNull(),id:text('id').notNull(),subscription:text('subscription').notNull()
},table=>[primaryKey({columns:[table.owner,table.id]})]);
export const syncNotificationJobs=sqliteTable('sync_notification_jobs',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),subscriptionId:text('subscription_id').notNull(),payload:text('payload').notNull(),createdAt:real('created_at').notNull(),attempts:real('attempts').notNull().default(0),claim:text('claim'),leaseUntil:real('lease_until').notNull().default(0)
},table=>[index('sync_notification_jobs_due').on(table.leaseUntil,table.createdAt)]);
export const syncWorkerHealth=sqliteTable('sync_worker_health',{
 id:text('id').primaryKey(),updatedAt:real('updated_at').notNull()
});
export const activityRecords=sqliteTable('activity_records',{
 owner:text('owner').notNull(),snapshotKey:text('snapshot_key').notNull(),activityId:text('activity_id').notNull(),data:text('data').notNull()
},table=>[primaryKey({columns:[table.owner,table.snapshotKey,table.activityId]})]);
export const activityRecordSets=sqliteTable('activity_record_sets',{
 owner:text('owner').notNull(),snapshotKey:text('snapshot_key').notNull()
},table=>[primaryKey({columns:[table.owner,table.snapshotKey]})]);
export const workoutExclusions=sqliteTable('workout_exclusions',{
 owner:text('owner').notNull(),activityId:text('activity_id').notNull(),date:text('date').notNull()
},table=>[primaryKey({columns:[table.owner,table.activityId]})]);
export const workoutExclusionMigrations=sqliteTable('workout_exclusion_migrations',{
 owner:text('owner').primaryKey()
});
export const athenaJobs=sqliteTable('athena_jobs',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),thread:text('thread').notNull(),message:text('message').notNull(),created:real('created').notNull(),status:text('status').notNull(),claim:text('claim'),answer:text('answer'),context:text('context'),model:text('model'),scope:text('scope')
},table=>[index('athena_jobs_owner_created').on(table.owner,table.created),index('athena_jobs_status_created').on(table.status,table.created),index('athena_jobs_created').on(table.created),index('athena_jobs_thread_history').on(table.owner,table.thread,table.status,table.created)]);
export const athenaQueueState=sqliteTable('athena_queue_state',{
 id:text('id').primaryKey(),heartbeat:real('heartbeat').notNull().default(0),model:text('model'),legacyMigrated:real('legacy_migrated').notNull().default(0)
});
export const corosBackfillJobs=sqliteTable('coros_backfill_jobs',{
 owner:text('owner').primaryKey(),revision:text('revision').notNull(),timeZone:text('time_zone').notNull(),nextRun:real('next_run').notNull(),lease:text('lease'),leaseUntil:real('lease_until').notNull().default(0),attempts:real('attempts').notNull().default(0)
},table=>[index('coros_backfill_due').on(table.nextRun,table.leaseUntil)]);
export const dashboardRevisions=sqliteTable('dashboard_revisions',{
 owner:text('owner').primaryKey(),version:text('version').notNull(),updatedAt:text('updated_at').notNull()
});
