import {SHIFTS,nextShift,shouldActivate,visibleWindows} from '../model.js';
const assert=(v,m)=>{if(!v)throw Error(m);};
assert(shouldActivate(300000,300,false,false),'idle threshold');
assert(!shouldActivate(299999,300,false,false),'before threshold');
assert(!shouldActivate(300000,300,true,false),'inhibitor');
assert(!shouldActivate(300000,300,false,true),'locked');
assert(new Set(SHIFTS.map(p=>p.join(','))).size===SHIFTS.length,'distinct shifts');
assert(SHIFTS.every(p=>p.every(n=>Math.abs(n)<=2)),'bounded shift');
const a={meta_window:{minimized:false,showing_on_its_workspace:()=>true,located_on_workspace:()=>true}};
assert(visibleWindows([a,{meta_window:{...a.meta_window,minimized:true}}],{}).length===1,'visible windows only');
print('Idle/inhibitor/lock/workspace/pixel-shift checks passed');

for(let current=0;current<SHIFTS.length;current++){
 const candidates=Array.from({length:SHIFTS.length-1},(_,i)=>nextShift(current,()=>i/(SHIFTS.length-1)));
 assert(!candidates.includes(current),"no repeated position");
 assert(new Set(candidates).size===SHIFTS.length-1,"all other positions reachable");
}
