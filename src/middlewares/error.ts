import type { NextFunction, Request, Response } from "express";
import logger from "../lib/logger";

function errorMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const errorLogger = logger.child({ module: "errorMiddleware" });
  const status = err.statusCode || 500;

  errorLogger.error(
    {
      err,
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params,
    },
    "Unhandled error"
  );

  const response = {
    success: false,
    message:
      status === 500
        ? "Internal server error"
        : err.message || "Something went wrong",
    ...(err.details ? { details: err.details } : {}),
  };

  res.status(status).json(response);
}
