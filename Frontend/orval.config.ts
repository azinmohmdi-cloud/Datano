import { config } from "dotenv";
import { defineConfig } from "orval";

config();

const openapiUrl = process.env.OPENAPI_JSON_URL;

if (!openapiUrl) {
  throw new Error("OPENAPI_JSON_URL environment variable is required");
}

export default defineConfig({
  "api-v1": {
    input: openapiUrl,
    output: {
      target: "./lib/api/v1/index.ts",
      schemas: "./lib/api/v1/model",
      client: "axios-functions",
      clean: true,
      override: {
        mutator: {
          path: "./lib/fetcher.ts",
          name: "customFetcher",
        },
      },
    },
  },
  "api-v1-hooks": {
    input: openapiUrl,
    output: {
      target: "./lib/api/v1/hooks.ts",
      schemas: "./lib/api/v1/model",
      client: "react-query",
      clean: false,
      override: {
        mutator: {
          path: "./lib/fetcher.ts",
          name: "fetcherHookAdapter",
        },
      },
    },
  },
});
