import type { Request, Response } from "express";
import { getUserById } from "../services/userService";

export async function getUserController(req: Request, res: Response) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "User ID is required.",
    });
  }

  const user = await getUserById(id);
  if (user && user.length > 0) {
    return res.status(200).json({ success: true, data: user[0] });
  } else {
    return res.status(404).json({ success: false, message: "User not found." });
  }
}

export async function getMeController(req: Request, res: Response) {
  const userId = req.user!.id;
  const user = await getUserById(userId);

  if (user && user.length > 0) {
    return res.status(200).json({ success: true, data: user[0] });
  } else {
    return res.status(404).json({ success: false, message: "User not found." });
  }
}
