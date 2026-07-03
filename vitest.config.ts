import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Types-only package, provided by the Obsidian app at runtime.
      obsidian: new URL("./tests/obsidian-stub.ts", import.meta.url).pathname,
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
