import { Pool } from "pg";
import logger from "../lib/logger";
import { drizzle } from "drizzle-orm/node-postgres";

const dbLogger = logger.child({ module: "database" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  dbLogger.error({ err }, "Unexpected error on idle PostgreSQL client");
  process.exit(-1);
});

pool.on("connect", () => {
  dbLogger.debug("New PostgreSQL client connected to pool");
});

export const db = drizzle({ client: pool });
