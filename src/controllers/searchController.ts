import type { Request, Response } from "express";
import { searchUser } from "../services/searchService";

export async function searchUserController(req: Request, res: Response) {
  const { query } = req.query;

  if (!query || typeof query !== "string") {
    return res.status(400).json({
      success: false,
      message: "Search query is required.",
    });
  }

  const users = await searchUser(query);
  return res.status(200).json({ success: true, data: users });
}
