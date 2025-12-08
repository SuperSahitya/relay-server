import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { searchUserController } from "../controllers/searchController";

const searchRouter = Router();

searchRouter.get("/search", authMiddleware, searchUserController);

export default searchRouter;
