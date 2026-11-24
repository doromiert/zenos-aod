import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
const app=new Gtk.Application({application_id:'com.negzero.AodNativeTest'});
app.connect('activate',()=>{
 const window=new Gtk.ApplicationWindow({application:app,title:'AOD native window',default_width:640,default_height:360});
 window.set_titlebar(new Gtk.HeaderBar());
 const box=new Gtk.Box({orientation:Gtk.Orientation.VERTICAL,spacing:24,margin_top:30,margin_bottom:30,margin_start:30,margin_end:30});
 const title=new Gtk.Label({label:'Downloading — live native window',xalign:0});box.append(title);
 const progress=new Gtk.ProgressBar({fraction:0.2});box.append(progress);
 const status=new Gtk.Label({label:'Background agent: 12 of 40 items complete',xalign:0});box.append(status);
 const provider=new Gtk.CssProvider();provider.load_from_string('window {background:#303034;color:white;} progressbar progress {background:#67a7e8;} label {font-size:20px;}');Gtk.StyleContext.add_provider_for_display(window.get_display(),provider,600);
 window.set_child(box);window.present();let n=0;
 GLib.timeout_add(GLib.PRIORITY_DEFAULT,500,()=>{n++;progress.set_fraction((n%8+1)/10);status.set_label(`Background agent: ${n} of 40 items complete`);return GLib.SOURCE_CONTINUE;});
});
app.run([]);
