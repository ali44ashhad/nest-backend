import { Router } from "express";
import compilerController from "../controllers/compilerController";
import { verifyToken } from "../middleware/authJwt";

const router = Router();

router.use(verifyToken);

router.post("/api/compile", compilerController.compile);
router.get("/api/download/:jobId", compilerController.download); // Add this new route

export default router;