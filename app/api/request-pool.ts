export function requestPool(limit=4) {
  let active=0;
  const pending:(()=>void)[]=[];
  const acquire=()=>new Promise<void>(resolve=>{const start=()=>{active++;resolve();};if(active<limit)start();else pending.push(start);});
  return async <T>(work:()=>Promise<T>):Promise<T>=>{
    await acquire();
    try{return await work();}finally{active--;pending.shift()?.();}
  };
}
