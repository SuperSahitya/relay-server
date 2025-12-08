import type { Request, Response } from "express";
import { fetchMessages } from "../services/messageService";

export async function getMessagesController(req: Request, res: Response) {
  const userId = req.user!.id;
  const { friendId } = req.params;
  const { limit, beforeTime } = req.query;

  if (!friendId) {
    return res.status(400).json({
      success: false,
      message: "Friend ID is required.",
    });
  }

  const limitNum = limit ? parseInt(limit as string) : 50;
  const beforeDate = beforeTime ? new Date(beforeTime as string) : undefined;

  const result = await fetchMessages(userId, friendId, limitNum, beforeDate);

  if (result.success) {
    return res.status(200).json(result);
  } else {
    return res.status(400).json(result);
  }
}
