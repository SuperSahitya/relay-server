import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  getUserController,
  getMeController,
} from "../controllers/userController";

const userRouter = Router();

userRouter.get("/users/me", authMiddleware, getMeController);
userRouter.get("/users/:id", authMiddleware, getUserController);

export default userRouter;
