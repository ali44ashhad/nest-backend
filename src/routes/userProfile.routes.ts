import { Router } from "express";
import userProfileController from "../controllers/userProfileController";
import { verifyToken } from "../middleware/authJwt";

const router = Router();

// All routes in this file will require a valid token
router.use(verifyToken);

router.post("/api/user/change-password", userProfileController.changePassword);

export default router;