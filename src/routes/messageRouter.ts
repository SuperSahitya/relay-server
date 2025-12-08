import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { getMessagesController } from "../controllers/messageController";

const messageRouter = Router();

messageRouter.get("/messages/:friendId", authMiddleware, getMessagesController);

export default messageRouter;
