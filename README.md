# ZenOS Always On Display

GNOME Shell 50 extension for a live, dim display without locking, logging out,
pausing agents, or taking screenshots. All monitors turn black behind live window
clones. The contrast filter preserves filled foreground strokes, filled progress
bars and thin window frames. Content refreshes once a second; a small pixel shift
runs every minute, choosing a random offset without consecutive repeats. First pointer, keyboard, scroll or touch input wakes the display
and consumes that event so it cannot accidentally activate an underlying control.

The moon menu provides Preview and Settings. Idle delay defaults to five minutes;
brightness and pixel-shift interval are adjustable. Automatic activation respects
GNOME session idle inhibitors. Locking manually remains available.

This is a visual filter, not semantic UI extraction. Pictures and other bright
content may remain visible; it cannot reliably identify every app's text or
progress controls. It reduces lit area/brightness, not the need for monitor
firmware protection. No credentials, screenshots or window contents are persisted.

The ZenOS GNOME profile enables AOD by default; set
`desktops.gnome.aod.enable = false` to keep native idle/automatic lock defaults.
Both styles preserve colors by default, with an optional **Grayscale** switch.
The ZenOS user option `users.<name>.theming.gnome.aod.enable` installs/enables the
extension and selects AOD in place of native session idle blanking/automatic
locking. Dark mode is requested only while AOD is active; the previous explicit
or unset theme preference is saved and restored on wake, disable, or recovery
after a Shell restart. Applications that ignore GNOME's color-scheme preference
may retain their own theme.

AOD Settings offers **Live windows** and **GNOME lockscreen**. The second mode
uses GNOME's actual screen-shield dialog and clock, including installed
lockscreen extension customizations, with the wallpaper hidden and content dimmed.
It activates the native curtain without setting the authenticated locked state;
first input returns to the desktop. A subsequent manual lock remains a real lock
and is never dismissed by AOD cleanup.

Removing that selection returns native policy to its other configured
values. Disabling only the extension at runtime leaves the declared AOD policy
selected; turn the user option off to return to native blanking.

## Development

`gjs -m tests/model.js` verifies idle/inhibitor/lock and window selection rules.
`python3 tools/preview.py` starts a private headless native GNOME test and writes
its result and synthetic screenshots below `.private/State/zenos-aod/preview`.
`python3 tools/preview.py --interactive` opens the MDK with a live sample progress
screen. It uses isolated HOME, settings, bus and runtime directories. Production
code never writes preview screenshots. Running Steam in the MDK is a separate,
explicit manual test using the user's normal client profile.

Native tests cover pointer and keyboard wake, live updates, cleanup, window
geometry and responsiveness. Visual acceptance is recorded separately from tests.
