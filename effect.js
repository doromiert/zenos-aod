import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
export const OutlineEffect = GObject.registerClass(class OutlineEffect extends Shell.GLSLEffect {
    _init(brightness,grayscale=false) {super._init();this._brightness=brightness;this._grayscale=grayscale;}
    vfunc_build_pipeline() {
        this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, `
            uniform float aod_brightness;
            uniform float aod_grayscale;
            float aod_luma(vec2 p) {
                return dot(texture2D(cogl_sampler0,p).rgb,vec3(0.2126,0.7152,0.0722));
            }
        `, `
            vec2 p=cogl_tex_coord_in[0].xy;
            float c=aod_luma(p);
            float background=(aod_luma(vec2(0.20,0.40))+aod_luma(vec2(0.80,0.40))+
                              aod_luma(vec2(0.20,0.80))+aod_luma(vec2(0.80,0.80)))*0.25;
            // Preserve filled foreground pixels instead of tracing glyph edges.
            if(background>0.5){c=1.0-c;background=1.0-background;}
            float ink=smoothstep(0.02,0.28,max(0.0,c-background));
            vec4 source=texture2D(cogl_sampler0,p);
            float alpha=source.a;
            vec3 color=source.rgb/max(alpha,0.0001);
            float peak=max(color.r,max(color.g,color.b));
            // Preserve the original hue; dark glyphs on light surfaces need light ink.
            vec3 hue=peak>0.04?color/peak:vec3(1.0);
            hue=mix(hue,vec3(dot(hue,vec3(0.2126,0.7152,0.0722))),aod_grayscale);
            cogl_color_out=vec4(hue*ink*aod_brightness*alpha,alpha);
        `,false);
    }
    update(_width,_height,_scale=1) {
        this.set_uniform_float(this.get_uniform_location('aod_brightness'),1,[this._brightness]);
        this.set_uniform_float(this.get_uniform_location('aod_grayscale'),1,[this._grayscale?1:0]);
    }
});
