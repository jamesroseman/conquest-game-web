import type { CodegenConfig } from "@graphql-codegen/cli";

/**
 * Run with `pnpm codegen` against a running API. Until you do, src/api/types.ts
 * and src/api/operations.ts are hand-written mirrors of the schema.
 */
const config: CodegenConfig = {
  schema: `${process.env.VITE_API_URL ?? "http://localhost:8000"}/graphql`,
  documents: ["src/**/*.ts", "src/**/*.tsx"],
  generates: {
    "./src/api/__generated__/": {
      preset: "client",
      config: { useTypeImports: true },
    },
  },
  ignoreNoDocuments: true,
};

export default config;
