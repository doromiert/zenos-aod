import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
export const OutlineEffect = GObject.registerClass(class OutlineEffect extends Shell.GLSLEffect {
    _init(brightness) {super._init();this._brightness=brightness;}
    vfunc_build_pipeline() {
        this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, `
            uniform float aod_brightness;
            float aod_luma(vec2 p) {
                return dot(texture2D(cogl_sampler0,p).rgb,vec3(0.2126,0.7152,0.0722));
            }
        `, `
            vec2 p=cogl_tex_coord_in[0].xy;
            float c=aod_luma(p);
            float background=(aod_luma(vec2(0.12,0.12))+aod_luma(vec2(0.88,0.12))+
                              aod_luma(vec2(0.12,0.88))+aod_luma(vec2(0.88,0.88)))*0.25;
            // Preserve filled foreground pixels instead of tracing glyph edges.
            if(background>0.5){c=1.0-c;background=1.0-background;}
            float ink=smoothstep(0.02,0.28,max(0.0,c-background));
            cogl_color_out=vec4(vec3(ink*aod_brightness),1.0);
        `,false);
    }
    update(_width,_height,_scale=1) {
        this.set_uniform_float(this.get_uniform_location('aod_brightness'),1,[this._brightness]);
    }
});
