/** Latent Image shaders, ported verbatim from docs/direction-2/prototype.html. */
export const VS = `#version 300 es
  in vec2 a; out vec2 uv; void main(){ uv = a*.5+.5; gl_Position = vec4(a,0,1); }`;

/** r = developer liquid, g = wake, b = development (0..2; above 1 the print burns). */
export const SIM = `#version 300 es
  precision highp float; in vec2 uv; out vec4 o;
  uniform sampler2D prev; uniform vec2 m, mp, res, sweep; uniform float t, press, reset, sweepOn, pOn, prog;
  float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
  void main(){
    vec2 px = 1./res, asp = vec2(res.x/res.y,1.);
    vec2 vel = m - mp;
    float dm = length((uv-m)*asp);
    vec2 flow = vec2(n(uv*3.+t*.1)-.5, n(uv*3.+7.3-t*.08)-.5)*.0018 - vel*exp(-dm*dm*50.)*.4;
    vec4 c = texture(prev, uv - flow);
    vec4 s = texture(prev, uv+vec2(px.x,0))+texture(prev, uv-vec2(px.x,0))+texture(prev, uv+vec2(0,px.y))+texture(prev, uv-vec2(0,px.y));
    c.rg = mix(c.rg, s.rg*.25, .2);
    c.b = texture(prev, uv).b;
    float agit = clamp(length(vel)*50., 0., 1.);
    float brush = exp(-dm*dm*(press>.5?40.:120.)) * pOn;
    float ds = length((uv-sweep)*asp);
    float sw = exp(-ds*ds*7.) * sweepOn;
    c.r = c.r*.985 + brush*(.04 + agit*.18) + sw*.25;
    c.g = max(c.g*.95, brush*agit);
    // liquid develops up to a full print; only holding the pointer burns past it
    if (c.b < 1.) c.b = min(c.b + c.r*.05, 1.);
    c.b += press*brush*.03;
    // the developing front crosses the sheet in a fixed time, with a ragged chemical edge
    float front = clamp((prog*1.5 - uv.x - (n(uv*vec2(5.,3.))-.5)*.35 - .12) * 3., 0., 1.);
    c.b = max(c.b, front);
    c.b = min(c.b, 2.);
    if (reset > .5) c = vec4(0);
    o = c;
  }`;

export const OUT = `#version 300 es
  precision highp float; in vec2 uv; out vec4 o;
  uniform sampler2D field, text; uniform vec2 res; uniform float t;
  float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
  void main(){
    vec4 f = texture(field, uv);
    vec2 tuv = vec2(uv.x, 1.-uv.y);
    tuv += f.g * vec2(.006*sin(uv.y*90.+t*7.), .003*cos(uv.x*70.-t*5.));   // distortion only in the wake
    float ink = texture(text, tuv).r;
    float dev = smoothstep(.05, .7, f.b);
    float burn = smoothstep(1.1, 2., f.b);
    vec3 col = mix(vec3(.035,.022,.018), vec3(.86,.55,.44), dev);        // tray to print paper under the safelight
    col = mix(col, vec3(.2,.06,.04), burn*.85);                          // over-exposed: the print burns
    col = mix(col, vec3(.10,.035,.025), ink*smoothstep(.25,.8,dev));
    col += vec3(1.,.66,.4) * f.r * .10 + f.g * vec3(1.,.7,.5) * .06;
    col += (h(uv*res + fract(t)*91.) - .5) * .035;
    vec2 q = (uv-.5)*vec2(1.,.8); col *= 1. - dot(q,q)*.55;
    o = vec4(col,1.);
  }`;
