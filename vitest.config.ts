import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@isopleth/core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "@isopleth/data": path.resolve(__dirname, "packages/data/src/client.ts"),
      "@isopleth/llm": path.resolve(__dirname, "packages/llm/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "reference", "research", "apps/web/.next"],
  },
});
