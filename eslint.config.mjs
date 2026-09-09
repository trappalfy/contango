import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local tooling, not application code.
    ".shots/**",
  ]),

  {
    // The WebGL scene is imperative by design: docs/hero-brief.md §13 requires
    // "no setState in useFrame, only ref mutation", and every frame writes
    // directly to the camera, materials and uniforms. The React Compiler
    // immutability rules describe a model this code deliberately sits outside
    // of, so they are switched off here and nowhere else.
    files: ["components/hero/HeroCanvas.tsx", "components/hero/Sphere/**/*.tsx"],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      // Mount and breakpoint flags have to be set after hydration, because the
      // server has no window to measure.
      "react-hooks/set-state-in-effect": "off",
    },
  },

  {
    // Wallet UI carries a post-hydration mount flag for the same reason: wagmi
    // runs with ssr: true, so the server never sees a connected account and
    // rendering one during hydration would mismatch. Everything else in these
    // files derives from props and state rather than syncing through effects.
    files: ["components/wallet/**/*.tsx", "components/rotate/**/*.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
