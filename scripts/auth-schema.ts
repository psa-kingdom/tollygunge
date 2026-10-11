import { Pool } from "pg";
import { createAuth } from "../src/lib/auth-options";
import { databaseOptions } from "../src/lib/database-options";
export const auth = createAuth(new Pool(databaseOptions()), {
  BETTER_AUTH_SECRET: "schema-generation-only-not-a-runtime-secret-0123456789",
  BETTER_AUTH_URL: "http://127.0.0.1:3000",
});
