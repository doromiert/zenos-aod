import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
const root=ARGV[0];
const [,data]=GLib.file_get_contents(root+'/result.json');
const result=JSON.parse(new TextDecoder().decode(data));
if(!result.pass)throw Error(result.error);
const rect=result.frameRect;
const pixbuf=GdkPixbuf.Pixbuf.new_from_file(root+'/aod.png');
const pixels=pixbuf.get_pixels(),stride=pixbuf.rowstride,channels=pixbuf.n_channels;
let outside=0,colored=0;
for(let y=0;y<pixbuf.height;y++)for(let x=0;x<pixbuf.width;x++){
 const i=y*stride+x*channels,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
 if((x<rect.x||x>=rect.x+rect.width||y<rect.y||y>=rect.y+rect.height)&&(r||g||b))outside++;
 if(b>r+10&&b>g+5)colored++;
}
if(outside)throw Error(`${outside} pixels lit outside window frame`);
if(!colored)throw Error('Blue progress lost its color');
print(JSON.stringify({outsideFrameBlack:true,coloredProgressPixels:colored}));
