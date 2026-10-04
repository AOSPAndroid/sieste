import {useCallback,useEffect,useRef} from 'react';
// Scroll chrome is visual state, not dashboard data: never rerender charts to hide it.
export function useScrollChrome(){
 const holdUntil=useRef(0);
 const show=useCallback((_visible=true)=>{holdUntil.current=performance.now()+700;document.documentElement.classList.remove('chrome-is-scrolling')},[]);
 useEffect(()=>{let idle:ReturnType<typeof setTimeout>|undefined,lastY=window.scrollY;const root=document.documentElement;
  const displayMode=matchMedia('(display-mode: standalone)'),ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
  const appMode=()=>root.classList.toggle('sieste-ios-app',ios&&(displayMode.matches||(navigator as Navigator&{standalone?:boolean}).standalone===true));
  appMode();displayMode.addEventListener('change',appMode);
  const reveal=()=>root.classList.remove('chrome-is-scrolling');
  const scroll=()=>{const y=window.scrollY,delta=Math.abs(y-lastY);lastY=y;if(delta<5||performance.now()<holdUntil.current)return;root.classList.add('chrome-is-scrolling');clearTimeout(idle);idle=setTimeout(reveal,180)};
  const pointer=(e:PointerEvent)=>{if(e.target instanceof Element&&e.target.closest('.mini-dock,.floating-sync')){holdUntil.current=performance.now()+1200;clearTimeout(idle);reveal()}};
  window.addEventListener('scroll',scroll,{passive:true});document.addEventListener('pointerdown',pointer,{passive:true});document.addEventListener('focusin',reveal);
  return()=>{clearTimeout(idle);window.removeEventListener('scroll',scroll);document.removeEventListener('pointerdown',pointer);document.removeEventListener('focusin',reveal);displayMode.removeEventListener('change',appMode);root.classList.remove('sieste-ios-app');reveal()};
 },[]);return show;
}
