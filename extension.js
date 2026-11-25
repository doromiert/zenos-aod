import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Shell from 'gi://Shell';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {OutlineEffect} from './effect.js';
import {SHIFTS,nextShift,visibleWindows,shouldActivate,hasFullscreenWindow} from './model.js';

export default class AodExtension extends Extension {
    enable() {
        this._enabled=true;this._generation=0;this._clones=new Map();this._signals=[];
        this._settings=this.getSettings();
        this._interfaceSettings=new Gio.Settings({schema_id:'org.gnome.desktop.interface'});
        this._restoreTheme();
        this._idle=global.backend.get_core_idle_monitor();
        this._indicator=new QuickSettings.SystemIndicator();
        this._toggle=new QuickSettings.QuickMenuToggle({
            title:'AOD',accessible_name:'Always On Display',iconName:'weather-clear-night-symbolic',toggleMode:true,
            menuButtonAccessibleName:'Always On Display options',
        });
        this._settings.bind('automatic',this._toggle,'checked',Gio.SettingsBindFlags.DEFAULT);
        this._toggle.menu.setHeader('weather-clear-night-symbolic','Always On Display');
        this._toggle.menu.addAction('Preview',()=>this.enter());
        this._toggle.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._toggle.menu.addAction('Settings',()=>{
            Main.panel.statusArea.quickSettings.menu.close();this.openPreferences();
        });
        this._indicator.quickSettingsItems.push(this._toggle);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
        this._syncToggle();
        this._connect(this._settings,'changed',(_settings,key)=>{if(key==='original-color-scheme')return;this.wake();this._syncToggle();this._watchIdle();});
        this._connect(global.display,'restacked',()=>this._syncWindows());
        this._connect(global.display,'notify::focus-window',()=>this._tryIdle());
        this._connect(global.display,'in-fullscreen-changed',()=>this._tryIdle());
        this._connect(global.window_manager,'map',()=>this._syncWindows());
        this._connect(global.window_manager,'destroy',()=>this._syncWindows());
        this._connect(global.workspace_manager,'active-workspace-changed',()=>{this._syncWindows();this._tryIdle();});
        this._connect(Main.layoutManager,'monitors-changed',()=>{
            this._overlay?.set_size(global.stage.width,global.stage.height);
            this._shieldState?.input.set_size(global.stage.width,global.stage.height);this._syncWindows();
        });
        this._connect(Main.uiGroup,'child-added',()=>this._raiseAod());
        this._connect(global.stage,'child-added',()=>this._raiseAod());
        this._connect(global.stage,'before-paint',()=>this._raiseAod());
        this._connect(Main.sessionMode,'updated',()=>{if(Main.sessionMode.isLocked&&!this._usingShield)this.wake();});
        this._connect(global.stage,'captured-event',(_stage,event)=>this._onCapturedEvent(event));
        this._connect(Main.uiGroup,'captured-event',(_group,event)=>this._onCapturedEvent(event));
        this._inhibitorSignal=Gio.DBus.session.signal_subscribe('org.gnome.SessionManager',
            'org.gnome.SessionManager',null,'/org/gnome/SessionManager',null,
            Gio.DBusSignalFlags.NONE,(_connection,_sender,_path,_iface,signal)=>{
                if(['InhibitorAdded','InhibitorRemoved'].includes(signal))this._tryIdle();
            });
        this._connect(Main.screenShield,'locked-changed',()=>{if(Main.screenShield.locked)this.wake();});
        this._watchIdle();
    }
    _connect(object,signal,callback) {this._signals.push([object,object.connect(signal,callback)]);}
    _onCapturedEvent(event) {
        if(!this.active)return Clutter.EVENT_PROPAGATE;
        if(![Clutter.EventType.MOTION,Clutter.EventType.BUTTON_PRESS,Clutter.EventType.KEY_PRESS,
            Clutter.EventType.SCROLL,Clutter.EventType.TOUCH_BEGIN,Clutter.EventType.TOUCH_UPDATE,
            Clutter.EventType.TOUCHPAD_SWIPE,Clutter.EventType.TOUCHPAD_PINCH,Clutter.EventType.TOUCHPAD_HOLD].includes(event.type()))return Clutter.EVENT_PROPAGATE;
        // Surface changes can synthesize pointer motion without any HID activity.
        // Keep the grab until dispatch ends so the wake event cannot reach native gestures.
        if(!(event.get_flags()&Clutter.EventFlags.FLAG_SYNTHETIC)&&!this._inputWake)
            this._inputWake=GLib.idle_add_once(GLib.PRIORITY_DEFAULT,()=>{this._inputWake=0;this.wake();});
        return Clutter.EVENT_STOP;
    }
    _raiseAod() {
        const actor=this._overlay??(this._usingShield?Main.screenShield.actor:null);
        const parent=actor?.get_parent();
        if(parent&&parent.get_last_child()!==actor)parent.set_child_above_sibling(actor,null);
    }
    _syncToggle() {
        this._toggle.subtitle=this._settings.get_boolean('automatic')
            ?(this._settings.get_string('mode')==='lockscreen'?'Lockscreen':'Live windows'):'Off';
    }
    _watchIdle() {
        if(this._idleWatch)this._idle.remove_watch(this._idleWatch);
        this._idleWatch=0;
        if(!this._settings.get_boolean('automatic'))return;
        this._idleWatch=this._idle.add_idle_watch(this._settings.get_uint('idle-seconds')*1000,()=>this._tryIdle());
    }
    _tryIdle() {
        if(!this._enabled||this.active||!this._settings.get_boolean('automatic'))return;
        const generation=this._generation;
        Gio.DBus.session.call('org.gnome.SessionManager','/org/gnome/SessionManager',
            'org.gnome.SessionManager','IsInhibited',new GLib.Variant('(u)',[8]),
            new GLib.VariantType('(b)'),Gio.DBusCallFlags.NONE,1000,null,(connection,result)=>{
                try {
                    const [inhibited]=connection.call_finish(result).deepUnpack();
                    if(this._enabled&&generation===this._generation&&shouldActivate(this._idle.get_idletime(),
                        this._settings.get_uint('idle-seconds'),inhibited,Main.sessionMode.isLocked,
                        global.display.focus_window?.get_wm_class(),
                        hasFullscreenWindow(global.get_window_actors(),global.workspace_manager.get_active_workspace())))this.enter();
                }catch(error){console.warn(`AOD idle check: ${error.message}`);}
            });
    }
    _forceDarkTheme() {
        const value=this._interfaceSettings.get_user_value('color-scheme');
        this._settings.set_string('original-color-scheme',JSON.stringify(value?.deepUnpack()??null));
        this._interfaceSettings.set_string('color-scheme','prefer-dark');
    }
    _restoreTheme() {
        const saved=this._settings?.get_string('original-color-scheme');
        if(!saved)return;
        try {
            const value=JSON.parse(saved);
            if(this._interfaceSettings.get_string('color-scheme')==='prefer-dark'){
                if(value===null)this._interfaceSettings.reset('color-scheme');
                else this._interfaceSettings.set_string('color-scheme',value);
            }
        }finally{this._settings.set_string('original-color-scheme','');}
    }
    _enterShield() {
        const shield=Main.screenShield;
        // Activate GNOME's genuine curtain without changing its authentication state.
        this._usingShield=true;shield.activate(false);
        const dialog=shield._dialog;
        if(!dialog){this._usingShield=false;throw Error('GNOME lockscreen is unavailable');}
        shield._shortLightbox.lightOff();shield._longLightbox.lightOff();
        // GNOME's generic activity and notification wakeups are broader than HID.
        if(shield._becameActiveId){shield.idleMonitor.remove_watch(shield._becameActiveId);shield._becameActiveId=0;}
        GObject.signal_handler_block(dialog,shield._wakeUpScreenId);
        // Capture on a separate actor so native click/swipe gestures never begin.
        const input=new St.Widget({reactive:true});
        input.set_size(global.stage.width,global.stage.height);shield.actor.add_child(input);
        input.connect('captured-event',(_actor,event)=>this._onCapturedEvent(event));
        this._shieldState={dialog,input,opacity:dialog.opacity,style:shield.actor.style,
            wakeSignal:shield._wakeUpScreenId,background:dialog._backgroundGroup?.visible,dialogStyle:dialog.style,groupStyle:shield._lockDialogGroup.style,panelOpacity:Main.layoutManager.panelBox.opacity,translation:[dialog.translation_x,dialog.translation_y]};
        shield.actor.set_style('background-color:black;');
        shield._lockDialogGroup.set_style('background-color:black;');
        dialog.set_style('background-color:black;');
        Main.layoutManager.panelBox.opacity=0;
        dialog._backgroundGroup?.hide();
        dialog.opacity=Math.round(this._settings.get_double('brightness')*255);
        if(this._settings.get_boolean('grayscale'))dialog.add_effect_with_name('zenos-aod-grayscale',new Clutter.DesaturateEffect({factor:1}));
        this._shieldGrab=Main.pushModal(input,{actionMode:Shell.ActionMode.SYSTEM_MODAL});
        this._layer=dialog;
    }
    _leaveShield() {
        const state=this._shieldState;
        this._usingShield=false;this._shieldState=null;
        if(!state)return;
        const shield=Main.screenShield;
        if(this._shieldGrab){Main.popModal(this._shieldGrab);this._shieldGrab=null;}
        state.input.destroy();
        GObject.signal_handler_unblock(state.dialog,state.wakeSignal);
        state.dialog.remove_effect_by_name('zenos-aod-grayscale');
        state.dialog.opacity=state.opacity;
        state.dialog.set_translation(...state.translation,0);
        if(state.background)state.dialog._backgroundGroup?.show();
        shield.actor.set_style(state.style??'');
        shield._lockDialogGroup.set_style(state.groupStyle??'');
        state.dialog.set_style(state.dialogStyle??'');
        Main.layoutManager.panelBox.opacity=state.panelOpacity;
        // Never dismiss a real manual lock or alter GNOME's locked hint.
        if(!shield.locked)shield.deactivate(false);
    }
    get active(){return Boolean(this._overlay||this._usingShield);}
    enter() {
        if(!this._enabled||this.active||Main.sessionMode.isLocked)return;
        this._toggle.menu.close();Main.panel.statusArea.quickSettings.menu.close();this._forceDarkTheme();
        if(this._settings.get_string('mode')==='lockscreen')this._enterShield();
        else {
        this._overlay=new St.Widget({name:'zenos-aod',reactive:true,
            layout_manager:new Clutter.FixedLayout(),style:'background-color: black;'});
        this._overlay.set_size(global.stage.width,global.stage.height);
        this._overlay.connect('captured-event',(_actor,event)=>this._onCapturedEvent(event));
        Main.layoutManager.addTopChrome(this._overlay);
        this._liveGrab=Main.pushModal(this._overlay,{actionMode:Shell.ActionMode.SYSTEM_MODAL});
        this._layer=new Clutter.Actor({layout_manager:new Clutter.FixedLayout()});
        this._overlay.add_child(this._layer);
        }
        this._shiftIndex=0;this._syncWindows();this._raiseAod();
        // Clone effects cache their offscreen texture; refresh live progress at 1Hz.
        this._refreshTimer=GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,1,()=>{
            this._syncWindows();
            for(const entry of this._clones.values())entry.effect.queue_repaint();
            return GLib.SOURCE_CONTINUE;
        });
        // Hidden cursors normally unfocus the pointer, dropping click/scroll events.
        global.stage.context.get_backend().get_default_seat().inhibit_unfocus();
        global.backend.get_cursor_tracker().inhibit_cursor_visibility();this._cursorHidden=true;
        this._shiftTimer=GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
            this._settings.get_uint('pixel-shift-seconds'),()=>{
                this._shiftIndex=nextShift(this._shiftIndex);
                const [x,y]=SHIFTS[this._shiftIndex];this._layer.set_translation(x,y,0);
                return GLib.SOURCE_CONTINUE;
            });
    }
    _syncWindows() {
        this._raiseAod();
        if(!this.active||this._usingShield)return;
        const windows=visibleWindows(global.get_window_actors(),global.workspace_manager.get_active_workspace());
        const wanted=new Set(windows);
        for(const [source,entry] of this._clones)if(!wanted.has(source))this._dropClone(source,entry);
        for(const source of windows){
            let entry=this._clones.get(source);
            if(!entry){
                const clone=new Clutter.Clone({source,visible:false});
                const frame=new St.Widget({visible:false,style:`border:1px solid rgba(255,255,255,${this._settings.get_double('brightness')});border-radius:12px;`});
                const effect=new OutlineEffect(this._settings.get_double('brightness'),this._settings.get_boolean('grayscale'));
                clone.add_effect(effect);this._layer.add_child(clone);this._layer.add_child(frame);
                const sync=()=>{
                    if(!this.active||!this._clones.has(source))return;
                    const [x,y]=source.get_transformed_position(),[width,height]=source.get_size();
                    if(width<=0||height<=0){clone.hide();frame.hide();return;}
                    clone.set_position(x,y);clone.set_size(width,height);
                    const rect=source.meta_window.get_frame_rect();
                    frame.set_position(rect.x,rect.y);frame.set_size(rect.width,rect.height);
                    // Window actors include compositor shadows outside the client frame.
                    clone.set_clip(rect.x-x,rect.y-y,rect.width,rect.height);
                    effect.update(width,height,source.get_resource_scale());clone.show();frame.show();
                };
                entry={clone,frame,effect,signal:source.connect('notify::allocation',sync)};
                this._clones.set(source,entry);sync();
            }
            this._layer.set_child_above_sibling(entry.clone,null);this._layer.set_child_above_sibling(entry.frame,null);
        }
    }
    _dropClone(source,entry) {
        source.disconnect(entry.signal);entry.frame.destroy();entry.clone.destroy();this._clones.delete(source);
    }
    wake() {
        if(this._inputWake){GLib.source_remove(this._inputWake);this._inputWake=0;}
        this._generation++;
        if(this._refreshTimer){GLib.source_remove(this._refreshTimer);this._refreshTimer=0;}
        if(this._shiftTimer){GLib.source_remove(this._shiftTimer);this._shiftTimer=0;}
        this._restoreTheme();
        if(!this.active)return;
        if(this._usingShield)this._leaveShield();
        for(const [source,entry] of this._clones)this._dropClone(source,entry);
        if(this._liveGrab){Main.popModal(this._liveGrab);this._liveGrab=null;}
        this._overlay?.destroy();this._overlay=null;this._layer=null;
        if(this._cursorHidden){
            global.backend.get_cursor_tracker().uninhibit_cursor_visibility();
            global.stage.context.get_backend().get_default_seat().uninhibit_unfocus();this._cursorHidden=false;
        }
    }
    disable() {
        this._enabled=false;this.wake();
        if(this._idleWatch)this._idle.remove_watch(this._idleWatch);
        this._idleWatch=0;
        if(this._inhibitorSignal)Gio.DBus.session.signal_unsubscribe(this._inhibitorSignal);
        for(const [object,id] of this._signals??[])object.disconnect(id);
        this._signals=[];this._toggle?.destroy();this._indicator?.destroy();this._toggle=null;this._indicator=null;
        this._settings=null;this._interfaceSettings=null;this._idle=null;
    }
}
