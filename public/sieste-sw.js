// Notifications only. Private dashboards and provider responses are never cached.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let payload={};try{const decoded=event.data?.json();if(decoded&&typeof decoded==='object'&&!Array.isArray(decoded))payload=decoded}catch{/* Always show a generic notification for a delivered push. */}
 const test=payload.type==='sieste-sync-test'||payload.type==='sync-test';
 const partial=payload.status==='partial';
 event.waitUntil(self.registration.showNotification(test?'Sieste notifications enabled':partial?'Sieste partly synced':'Sieste synced',{
  body:test?'You’ll be notified when new data has synced.':partial?'New data was saved. Some readings could not refresh yet.':'New data has synced. Your dashboard is up to date.',
  icon:'/sieste-icon-180.png',badge:'/sieste-icon-32.png',tag:test?'sieste-sync-test':'sieste-background-sync',
  data:{url:'/',type:test?'sieste-sync-test':'sieste-sync-completed'}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const homepage=new URL('/',self.location.origin).href;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  let existing=windows.find(client=>new URL(client.url).origin===self.location.origin);
  if(existing){if(new URL(existing.url).pathname!=='/')existing=await existing.navigate(homepage)??existing;await existing.focus()}
  else existing=await self.clients.openWindow(homepage);
  if(existing&&event.notification.data?.type==='sieste-sync-completed')existing.postMessage({type:'sieste-sync-completed'});
 })());
});
