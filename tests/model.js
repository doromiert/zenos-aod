import {SHIFTS,nextShift,shouldActivate,visibleWindows,hasFullscreenWindow} from '../model.js';
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

assert(!shouldActivate(900000,300,false,false,'gamescope'),'Gamescope blocks automatic AOD after long controller-only idle');
assert(!shouldActivate(900000,300,false,false,'Gamescope'),'case-insensitive Gamescope identity');
assert(shouldActivate(900000,300,false,false,'com.neg-zero.Gnosis'),'ordinary apps still idle');
assert(shouldActivate(900000,300,false,false,null),'no focused window still idles');
assert(shouldActivate(900000,300,false,false,'steam'),'ordinary Steam window is not the Gamescope session');
print('Gamescope focus guard checks passed');

const fullscreen={meta_window:{...a.meta_window,is_fullscreen:()=>true}};
const ordinary={meta_window:{...a.meta_window,is_fullscreen:()=>false}};
assert(hasFullscreenWindow([ordinary,fullscreen],{}),'any visible fullscreen window blocks, regardless of focus');
for(const hidden of [
 {meta_window:{...fullscreen.meta_window,minimized:true}},
 {meta_window:{...fullscreen.meta_window,showing_on_its_workspace:()=>false}},
 {meta_window:{...fullscreen.meta_window,located_on_workspace:()=>false}},
 {},ordinary,
])assert(!hasFullscreenWindow([hidden],{}),'hidden/other-workspace/non-fullscreen windows do not block');
for(const focus of [null,'com.neg-zero.Tubefin','ordinary-app'])
 assert(!shouldActivate(900000,300,false,false,focus,true),'fullscreen blocks even without focus');
assert(shouldActivate(900000,300,false,false,'ordinary-app',false),'leaving fullscreen permits idle activation');
print('Fullscreen idle guard checks passed');
