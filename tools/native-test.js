import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
const delay=ms=>new Promise(r=>GLib.timeout_add_once(GLib.PRIORITY_DEFAULT,ms,r));
const assert=(v,m)=>{if(!v)throw Error(m);};
export async function run(setup,aod){
 const launcher=new Gio.SubprocessLauncher({flags:Gio.SubprocessFlags.NONE});
 launcher.setenv('WAYLAND_DISPLAY',setup.root+'/runtime/wayland-0',true);
 launcher.setenv('GDK_BACKEND','wayland',true);
 const app=launcher.spawnv([GLib.getenv('AOD_GJS'),'-m',setup.dir.get_child('test-window.js').get_path()]);
 let beat=0,last=GLib.get_monotonic_time();const timer=GLib.timeout_add(GLib.PRIORITY_DEFAULT,16,()=>{const now=GLib.get_monotonic_time();beat=Math.max(beat,(now-last)/1000);last=now;return GLib.SOURCE_CONTINUE;});
 try{
  Main.overview.hide();let source;
  for(let i=0;i<60;i++){source=global.get_window_actors().find(a=>a.meta_window.get_title()==='AOD native window');if(source)break;await delay(50);}
  assert(source,'native GTK fixture did not map');await delay(180);await setup.capture('before.png');
  aod._interfaceSettings.set_string('color-scheme','prefer-light');
  const start=GLib.get_monotonic_time();aod.enter();await delay(80);
  assert(aod.active&&aod._clones.has(source),'native window not cloned');
  assert(aod._interfaceSettings.get_string('color-scheme')==='prefer-dark','dark mode not requested');
  assert(GLib.get_monotonic_time()-start<400000,'AOD feedback exceeded400ms');
  const entry=aod._clones.get(source);assert(entry.frame.width>0&&entry.clone.width>0,'missing geometry');
  const initialRect=source.meta_window.get_frame_rect();
  const clip=entry.clone.get_clip();assert(Math.abs(clip[2]-initialRect.width)<2&&Math.abs(clip[3]-initialRect.height)<2,'filter includes shadow outside frame');
  await setup.capture('aod.png');await delay(1100);await setup.capture('progress.png');
  aod._settings.set_boolean('grayscale',true);aod.enter();await delay(100);await setup.capture('grayscale.png');
  aod._settings.set_boolean('grayscale',false);aod.enter();await delay(100);
  const keyboard=global.stage.context.get_backend().get_default_seat().create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
  keyboard.notify_keyval(GLib.get_monotonic_time(),Clutter.KEY_a,Clutter.KeyState.PRESSED);
  keyboard.notify_keyval(GLib.get_monotonic_time(),Clutter.KEY_a,Clutter.KeyState.RELEASED);await delay(80);
  assert(!aod.active&&!aod._clones.size&&!aod._cursorHidden,'keyboard wake/cleanup');
  assert(aod._interfaceSettings.get_string('color-scheme')==='prefer-light','light preference not restored');
  aod.enter();await delay(80);const pointer=global.stage.context.get_backend().get_default_seat().create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
  pointer.notify_absolute_motion(GLib.get_monotonic_time(),30,60);await delay(80);assert(!aod.active,'pointer wake');
  aod.enter();await delay(50);source.meta_window.move_resize_frame(false,300,180,700,430);await delay(180);
  const rect=source.meta_window.get_frame_rect();assert(Math.abs(aod._clones.get(source).frame.width-rect.width)<2,'frame did not follow resize');
  aod.wake();await setup.capture('restored.png');
  const oldIdle=aod._idle;let inhibited=true;
  const service=Gio.DBusExportedObject.wrapJSObject('<node><interface name="org.gnome.SessionManager"><method name="IsInhibited"><arg direction="in" type="u"/><arg direction="out" type="b"/></method><signal name="InhibitorAdded"><arg type="o"/></signal><signal name="InhibitorRemoved"><arg type="o"/></signal></interface></node>',{IsInhibited:()=>inhibited});
  service.export(Gio.DBus.session,'/org/gnome/SessionManager');
  const owner=Gio.bus_own_name_on_connection(Gio.DBus.session,'org.gnome.SessionManager',Gio.BusNameOwnerFlags.NONE,null,null);
  try{
   aod._idle={get_idletime:()=>301000,add_user_active_watch:fn=>oldIdle.add_user_active_watch(fn),remove_watch:id=>oldIdle.remove_watch(id)};
   await delay(80);aod._tryIdle();await delay(100);assert(!aod.active,'idle inhibitor ignored');
   inhibited=false;service.emit_signal('InhibitorRemoved',new GLib.Variant('(o)',['/test/inhibitor']));await delay(120);assert(aod.active,'idle did not activate after inhibitor removed');
   inhibited=true;service.emit_signal('InhibitorAdded',new GLib.Variant('(o)',['/test/inhibitor']));await delay(120);assert(!aod.active,'new inhibitor did not wake AOD');
  }finally{aod.wake();aod._idle=oldIdle;service.unexport();Gio.bus_unown_name(owner);}
  const settingsProcess=new Gio.SubprocessLauncher({flags:Gio.SubprocessFlags.NONE});
  settingsProcess.setenv('GSETTINGS_SCHEMA_DIR',Main.extensionManager.lookup('aod@neg-zero.com').dir.get_child('schemas').get_path(),true);
  const preferences=settingsProcess.spawnv(['gsettings','set','org.gnome.shell.extensions.zenos-aod','mode','lockscreen']);
  await preferences.wait_check_async(null);await delay(150);
  assert(aod._settings.get_string('mode')==='lockscreen','preferences process did not reach Shell settings');
  aod._settings.set_boolean('grayscale',true);aod.enter();await delay(100);
  assert(aod.active&&aod._usingShield,'native lockscreen mode inactive');
  assert(Main.screenShield._dialog?._clock,'actual GNOME lockscreen clock not used');
  assert(!Main.screenShield.locked,'AOD unexpectedly authenticated/locked the session');
  assert(Main.screenShield._dialog._clock.constructor.name==='ModifiedClock','installed lockscreen extension did not customize native clock');
  await setup.capture('lockscreen.png');
  keyboard.notify_keyval(GLib.get_monotonic_time(),Clutter.KEY_a,Clutter.KeyState.PRESSED);
  keyboard.notify_keyval(GLib.get_monotonic_time(),Clutter.KEY_a,Clutter.KeyState.RELEASED);
  await delay(350);assert(!aod.active&&!Main.screenShield.locked,'lockscreen wake');
  assert(aod._interfaceSettings.get_string('color-scheme')==='prefer-light','lockscreen theme restore');
  aod._settings.set_boolean('grayscale',false);aod._settings.set_string('mode','live');
  assert(beat<400,'UI heartbeat exceeded400ms');
  setup.write('result.json',{pass:true,nativeWindow:true,liveUpdates:true,filledText:true,windowFrame:true,shadowClipped:true,themeRestore:true,nativeLockscreen:true,sharedPreferences:true,grayscaleBothModes:true,frameRect:{x:initialRect.x,y:initialRect.y,width:initialRect.width,height:initialRect.height},keyboardWake:true,pointerWake:true,cleanup:true,idleInhibitors:true,maxGap:beat});
 }finally{GLib.source_remove(timer);aod.wake();app.force_exit();}
}
