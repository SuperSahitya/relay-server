import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response, NextFunction } from "express";
import { auth } from "../auth/authConfig";
import logger from "../lib/logger";

import "express";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      email: string;
      emailVerified: boolean;
      name: string;
      createdAt: Date;
      updatedAt: Date;
      image?: string | null | undefined;
      banned: boolean | null | undefined;
      role?: string | null | undefined;
      banReason?: string | null | undefined;
      banExpires?: Date | null | undefined;
    };
    session?: {
      id: string;
      userId: string;
      expiresAt: Date;
      createdAt: Date;
      updatedAt: Date;
      token: string;
      ipAddress?: string | null | undefined;
      userAgent?: string | null | undefined;
      impersonatedBy?: string | null | undefined;
    };
  }
}

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
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    authLogger.debug(
      { userId: session.user.id, email: session.user.email },
      "User authenticated successfully"
    );
    req.session = session.session;
    req.user = session.user;
    next();
  } catch (err) {
    authLogger.error({ err }, "Authentication error");
    res.status(401).json({ success: false, error: "Invalid session" });
  }
}
