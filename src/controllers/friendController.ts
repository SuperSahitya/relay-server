import type { Request, Response } from "express";
import { addFriend, getFriends } from "../services/friendService";

export async function addFriendController(req: Request, res: Response) {
  const userId = req.user!.id;
  const { friendId } = req.body;
  const result = await addFriend(userId, friendId);
  if (result.success) {
    return res.status(200).json(result);
  } else {
    return res.status(400).json(result);
  }
}

export async function getFriendsController(req: Request, res: Response) {
  const userId = req.user!.id;
  const result = await getFriends(userId);
  if (result.success) {
    return res.status(200).json(result);
  } else {
    return res.status(400).json(result);
  }
}
