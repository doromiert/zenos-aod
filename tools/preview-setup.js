import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
const delay=ms=>new Promise(r=>GLib.timeout_add_once(GLib.PRIORITY_DEFAULT,ms,r));
export default class Setup extends Extension {
 enable(){
  this.root=GLib.getenv('AOD_PREVIEW_ROOT');
  this.timer=GLib.timeout_add(GLib.PRIORITY_DEFAULT,100,()=>{
   const aod=Main.extensionManager.lookup('aod@neg-zero.com')?.stateObj;
   if(aod?._enabled){this.run(aod).catch(e=>this.write('result.json',{pass:false,error:String(e),stack:e.stack}));return GLib.SOURCE_REMOVE;}
   return GLib.SOURCE_CONTINUE;
  });
 }
 write(name,data){GLib.file_set_contents(this.root+'/'+name,JSON.stringify(data));}
 async capture(name){const stream=Gio.File.new_for_path(this.root+'/'+name).replace(null,false,Gio.FileCreateFlags.NONE,null);try{await new Shell.Screenshot().screenshot(false,stream);}finally{stream.close(null);}}
 async run(aod){
  if(GLib.getenv('AOD_INTERACTIVE')!=='1'){
   const test=await import(this.dir.get_child('native-test.js').get_uri());await test.run(this,aod);return;
  }
  Main.overview.hide();await delay(500);
  // A shell actor fixture exercises filtering without reading the user's windows.
  this.fixture=new St.BoxLayout({vertical:true,width:700,height:420,x:200,y:150,style:'background-color:#303034;padding:30px;spacing:20px;'});
  this.fixture.add_child(new St.Label({text:'AOD preview — downloading',style:'font-size:24px;color:white;'}));
  this.progress=new St.Widget({width:420,height:20,x_align:Clutter.ActorAlign.START,style:'background-color:#67a7e8;'});this.fixture.add_child(this.progress);
  this.fixture.add_child(new St.Label({text:'Agent working in the background…\n12 of 40 items complete',style:'font-size:18px;color:#eeeeee;'}));
  Main.uiGroup.add_child(this.fixture);await delay(150);
  if(GLib.getenv('AOD_INTERACTIVE')==='1'){
   const {OutlineEffect}=await import(Main.extensionManager.lookup('aod@neg-zero.com').dir.get_child('effect.js').get_uri());
   const enter=aod.enter.bind(aod);
   aod.enter=()=>{
    enter();if(!aod.active)return;
    const clone=new Clutter.Clone({source:this.fixture,x:200,y:150,width:700,height:420});
    const effect=new OutlineEffect(0.25);clone.add_effect(effect);aod._layer.add_child(clone);effect.update(700,420,1);
    aod._layer.add_child(new St.Widget({x:200,y:150,width:700,height:420,style:'border:1px solid rgba(255,255,255,0.25);border-radius:12px;'}));
    this.fixtureEffect=effect;
   };
   let fraction=0.2;
   this.progressTimer=GLib.timeout_add(GLib.PRIORITY_DEFAULT,500,()=>{
    fraction=(fraction+0.025)%1;this.progress.width=100+fraction*480;
    if(aod.active)this.fixtureEffect?.queue_repaint();return GLib.SOURCE_CONTINUE;
   });
   aod.enter();
   this.commandTimer=GLib.timeout_add(GLib.PRIORITY_DEFAULT,100,()=>{
    const f=Gio.File.new_for_path(this.root+'/command.json');
    if(f.query_exists(null)){const [,data]=f.load_contents(null);f.delete(null);const command=JSON.parse(new TextDecoder().decode(data));if(command.action==='enter')aod.enter();else if(command.action==='wake')aod.wake();else if(command.action==='capture')this.capture('current.png');}
    return GLib.SOURCE_CONTINUE;
   });
   this.write('ready.json',{pid:Gio.Credentials.new().get_unix_pid(),bus:GLib.getenv('DBUS_SESSION_BUS_ADDRESS'),display:GLib.getenv('DISPLAY'),xauthority:GLib.getenv('XAUTHORITY')});return;
  }
  await this.capture('before.png');
  aod.enter();await delay(180);
  // Fixture clone uses the same effect/geometry code as actual windows.
  const {OutlineEffect}=await import(Main.extensionManager.lookup('aod@neg-zero.com').dir.get_child('effect.js').get_uri());
  const clone=new Clutter.Clone({source:this.fixture,x:200,y:150,width:700,height:420});
  const effect=new OutlineEffect(0.25);clone.add_effect(effect);aod._layer.add_child(clone);effect.update(700,420,1);
    aod._layer.add_child(new St.Widget({x:200,y:150,width:700,height:420,style:'border:1px solid rgba(255,255,255,0.25);border-radius:12px;'}));
  await delay(200);await this.capture('aod.png');
  this.progress.width=560;effect.queue_repaint();await delay(300);await this.capture('progress.png');
  const active=aod.active;const pointer=global.stage.context.get_backend().get_default_seat().create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
  pointer.notify_absolute_motion(GLib.get_monotonic_time(),100,100);await delay(100);
  if(!active||aod.active)throw Error('Input did not wake AOD');
  aod.enter();await delay(50);aod.wake();if(aod.active||aod._clones.size)throw Error('AOD cleanup failed');
  await this.capture('restored.png');this.write('result.json',{pass:true,liveFilter:true,pointerWake:true,cleanup:true,pid:Gio.Credentials.new().get_unix_pid(),bus:GLib.getenv('DBUS_SESSION_BUS_ADDRESS'),display:GLib.getenv('DISPLAY'),xauthority:GLib.getenv('XAUTHORITY')});
 }
 disable(){if(this.commandTimer)GLib.source_remove(this.commandTimer);if(this.progressTimer)GLib.source_remove(this.progressTimer);this.fixture?.destroy();}
}
