import { Router } from "express";
import authController from "../controllers/authController";
import { validate } from "../middleware/validate";
import { authValidation } from "../middleware/validationSchemas";

const router = Router();

// Apply validation middleware before controller methods
router.post("/api/auth/signup", validate(authValidation.register), authController.signup);
router.post("/api/auth/signin", validate(authValidation.login), authController.signin);
router.post("/api/auth/signout", authController.signout);
router.get("/api/auth/check", authController.checkAuth);

export default router;