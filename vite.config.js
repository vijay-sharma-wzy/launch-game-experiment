import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Every page that gets built: the game list, then one page per game.
const GAMES = ["constellations", "ink-trail", "orbit-sort", "odd-lens", "night-window", "toss-catch"];
const page = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // Relative asset paths, so the built pages work from any host or sub-path.
  base: "./",
  build: {
    rollupOptions: {
      input: {
        index: page("index.html"),
        ...Object.fromEntries(GAMES.map((game) => [game, page(`games/${game}/index.html`)])),
      },
    },
  },
});
