import { defineConfig } from "vitest/config";

function rewriteDateRoute() {
  return (req, _res, next) => {
    if (req.url && /\/\d{4}\/\d{2}\/\d{2}\/?$/.test(req.url.split("?")[0])) {
      req.url = "/index.html";
    }
    next();
  };
}

// Relative base so the site works at /kolam/ on GitHub Pages
// and later at the apex domain kolam.com with no code change.
export default defineConfig({
  base: "./",
  envPrefix: ["VITE_", "SITE_"],
  build: {
    target: "es2022",
    sourcemap: false,
  },
  plugins: [
    {
      name: "kolam-date-routes",
      configureServer(server) {
        server.middlewares.use(rewriteDateRoute());
      },
      configurePreviewServer(server) {
        server.middlewares.use(rewriteDateRoute());
      },
    },
  ],
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
