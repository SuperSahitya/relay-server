import { response, Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  addFriendController,
  getFriendsController,
} from "../controllers/friendController";

const friendRouter = Router();

friendRouter.post("/friends", authMiddleware, addFriendController);
friendRouter.get("/friends", authMiddleware, getFriendsController);

export default friendRouter;
