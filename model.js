// Logical-pixel offsets stay close to the original layout and move the lit pixels.
export const SHIFTS = [[0,0],[2,0],[2,2],[0,2],[-2,2],[-2,0],[-2,-2],[0,-2],[2,-2]];
export function visibleWindows(actors,workspace) {
    return actors.filter(actor=>actor.meta_window&&!actor.meta_window.minimized&&
        actor.meta_window.showing_on_its_workspace()&&actor.meta_window.located_on_workspace(workspace));
}
export function shouldActivate(idle,seconds,inhibited,locked) {
    return idle>=seconds*1000&&!inhibited&&!locked;
}

export function nextShift(current,random=Math.random) {
    return (current+1+Math.floor(random()*(SHIFTS.length-1)))%SHIFTS.length;
}
