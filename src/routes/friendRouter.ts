import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  sendFriendRequestController,
  getFriendsController,
  handleFriendRequestController,
  deleteFriendController,
  getReceivedFriendRequestsController,
  getSentFriendRequestsController,
} from "../controllers/friendController";

const friendRouter = Router();

friendRouter.post("/friends", authMiddleware, sendFriendRequestController);
friendRouter.get("/friends", authMiddleware, getFriendsController);
friendRouter.put(
  "/friends/respond",
  authMiddleware,
  handleFriendRequestController
);
friendRouter.delete(
  "/friends/:friendId",
  authMiddleware,
  deleteFriendController
);
friendRouter.get(
  "/friends/requests",
  authMiddleware,
  getReceivedFriendRequestsController
);

friendRouter.get(
  "/friends/sent",
  authMiddleware,
  getSentFriendRequestsController
);

export default friendRouter;
