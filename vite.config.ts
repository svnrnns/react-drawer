import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      entryRoot: "lib",
      outDir: "dist",
      include: ["lib"],
      exclude: ["**/*.css"],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "lib/index.ts"),
      name: "Drawer",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "drawer.js" : "drawer.cjs"),
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "jsxRuntime",
        },
        assetFileNames: "style.[ext]",
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
  },
});
