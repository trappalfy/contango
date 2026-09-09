/** §9.2 fragment shader — soft round sprite, no texture. */
export const pointsFrag = /* glsl */ `
uniform vec3  uCold;   // #AFC0FF
uniform vec3  uHot;    // #FCA8E0
uniform vec3  uDeep;   // #C84F88
uniform float uInside; // 0 outside the shell, 1 once the camera is within it
varying float vHot;
varying float vFade;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  float alpha = pow(core, 1.8);

  vec3 hot = mix(uDeep, uHot, core);
  vec3 col = mix(uCold, hot, vHot);

  // Acceptance criterion 9: seen from inside, the frame must read as a large
  // sparse mesh rather than a star field. vFade alone cannot do this — once the
  // camera sits at z = 0.1 the far wall is at -mv.z ~ 1.1, well above the
  // smoothstep's upper bound, so those points stay at full brightness.
  float insideFade = 1.0 - 0.85 * uInside;

  gl_FragColor = vec4(col, alpha * vFade * (0.55 + 0.45 * vHot) * insideFade);
}
`
