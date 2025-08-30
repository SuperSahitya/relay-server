import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response, NextFunction } from "express";
import { auth } from "../auth/authConfig";
import logger from "../lib/logger";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authLogger = logger.child({
    module: "authMiddleware",
    url: req.originalUrl,
    method: req.method,
  });

  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      authLogger.warn("Authentication failed: no session found");
      return res.status(401).json({ error: "Unauthorized" });
    }

    authLogger.debug(
      { userId: session.user.id, email: session.user.email },
      "User authenticated successfully"
    );
    (req as any).session = session.session;
    (req as any).user = session.user;
    next();
  } catch (err) {
    authLogger.error({ err }, "Authentication error");
    res.status(401).json({ error: "Invalid session" });
  }
}
