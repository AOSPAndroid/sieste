import {sqliteTable,text,real,primaryKey} from 'drizzle-orm/sqlite-core';
export const connections=sqliteTable('athlete_connections',{
 owner:text('owner').primaryKey(),revision:text('revision').notNull(),token:text('token_ciphertext').notNull(),snapshot:text('snapshot_key').notNull(),updated:text('updated_at').notNull()
});
export const corosConnections=sqliteTable('coros_connections',{
 owner:text('owner').primaryKey(),revision:text('revision').notNull(),credentials:text('credentials').notNull(),region:text('region').notNull(),snapshot:text('snapshot_key'),updated:text('updated_at').notNull(),refreshLock:real('refresh_lock').notNull().default(0)
});
export const corosOauthStates=sqliteTable('coros_oauth_states',{
 state:text('state').primaryKey(),owner:text('owner').notNull(),payload:text('payload').notNull(),expires:text('expires').notNull()
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
