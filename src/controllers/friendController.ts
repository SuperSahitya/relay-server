import type { Request, Response } from "express";
import {
  sendFriendRequest,
  getFriends,
  handleFriendRequest,
  deleteFriend,
  getReceivedFriendRequests,
  getSentFriendRequests,
} from "../services/friendService";

export async function sendFriendRequestController(req: Request, res: Response) {
  const userId = req.user!.id;
  const { friendId } = req.body;

  if (!friendId) {
    return res.status(400).json({
      success: false,
      message: "Friend ID is required.",
    });
  }

  const result = await sendFriendRequest(userId, friendId);
  if (result.success) {
    return res.status(200).json(result);
  } else {
    return res.status(400).json(result);
  }
}

export async function handleFriendRequestController(
  req: Request,
  res: Response
) {
  const userId = req.user!.id;
  const { senderId, status } = req.body;

  if (!senderId || !status || !["accepted", "declined"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid request parameters.",
    });
  }

  const result = await handleFriendRequest(senderId, userId, status);
  if (result.success) {
    return res.status(200).json(result);
  } else {
    return res.status(400).json(result);
  }
}

export async function deleteFriendController(req: Request, res: Response) {
  const userId = req.user!.id;
  const { friendId } = req.params;

  if (!friendId) {
    return res.status(400).json({
      success: false,
      message: "Friend ID is required.",
    });
  }

  const result = await deleteFriend(userId, friendId);
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

export async function getReceivedFriendRequestsController(
  req: Request,
  res: Response
) {
  const userId = req.user!.id;
  const result = await getReceivedFriendRequests(userId);
  if (result.success) {
    return res.status(200).json(result);
  } else {
    return res.status(400).json(result);
  }
}

export async function getSentFriendRequestsController(
  req: Request,
  res: Response
) {
  const userId = req.user!.id;
  const result = await getSentFriendRequests(userId);
  if (result.success) {
    return res.status(200).json(result);
  } else {
    return res.status(400).json(result);
  }
}
