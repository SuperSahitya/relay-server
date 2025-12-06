import { eq } from "drizzle-orm";
import { db } from "../db/db";
import { user } from "../db/schema";
import logger from "../lib/logger";

export async function searchUser(query: string) {
  try {
    const data = await db
      .selectDistinct()
      .from(user)
      .where(eq(user.email, query));

    return data;
  } catch (error) {
    logger.error(
      error,
      `Error while searching for user based on query ${query}`
    );
    return [];
  }
}
