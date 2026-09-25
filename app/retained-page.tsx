"use client";
import {useEffect,useState,useRef,type ReactNode} from 'react';

// Visit once, then hide rather than unmount: filters, previews and requests survive navigation.
export default function RetainedPage({active,children}:{active:boolean;children:ReactNode}){
 const [visited,setVisited]=useState(active);
 const retained=useRef(children);
 // Preserve the element identity of hidden trees: sync and dock updates must
 // not recompute every chart and analysis on all previously visited pages.
 if(active)retained.current=children;
 useEffect(()=>{if(active)setVisited(true)},[active]);
 return <div hidden={!active} style={active?undefined:{display:'none'}}>{(active||visited)&&retained.current}</div>;
}
