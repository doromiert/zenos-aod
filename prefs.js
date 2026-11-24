import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
export default class AodPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings=this.getSettings();
        const page=new Adw.PreferencesPage({title:'Always on display',icon_name:'weather-clear-night-symbolic'});
        const group=new Adw.PreferencesGroup({title:'Idle display',description:'Live window edges on black across all displays. Move the pointer or press a key to return. This is a visual filter, not a screen lock.'});
        for(const [key,title,min,max,step] of [['idle-seconds','Idle delay (seconds)',10,86400,30],
            ['brightness','Outline brightness',0.03,0.5,0.01],['pixel-shift-seconds','Pixel shift interval (seconds)',10,600,10]]){
            const row=new Adw.SpinRow({title,adjustment:new Gtk.Adjustment({lower:min,upper:max,step_increment:step,page_increment:step*5}),digits:key==='brightness'?2:0});
            settings.bind(key,row,'value',0);group.add(row);
        }
        page.add(group);window.add(page);
    }
}
