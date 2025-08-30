import { ZodObject } from "zod";
import { Request, Response, NextFunction } from "express";

const validate =
  (schema: ZodObject) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (e: any) {
      return res.status(400).json({
        message: "Validation failed",
        errors: e.errors,
      });
    }
  };

export default validate;