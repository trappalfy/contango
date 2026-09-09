/** §9.2 vertex shader — perspective sizing, breathing, twinkle, hot-band test. */
export const pointsVert = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform vec3  uBandAxis;   // axis of the magenta band, rotates with the object
attribute float aSeed;
attribute float aSize;
varying float vHot;
varying float vFade;

void main() {
  vec3 p = position;

  // faint breathing of the shell
  p *= 1.0 + 0.015 * sin(uTime * 0.7 + aSeed * 12.0);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  // 0..1 — how far the point sits inside the magenta band
  float d = dot(normalize(position), normalize(uBandAxis));
  vHot = smoothstep(0.35, 0.9, d);

  // twinkle
  float twinkle = 0.55 + 0.45 * sin(uTime * 1.6 + aSeed * 40.0);

  // fade out points that sweep right past the camera
  vFade = smoothstep(0.15, 0.8, -mv.z) * twinkle;

  gl_PointSize = aSize * (2.6 + 1.6 * vHot) * uPixelRatio * (3.0 / -mv.z);
}
`
