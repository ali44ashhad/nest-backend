import { Router } from "express";
import projectController from "../controllers/projectController";
import { verifyToken } from "../middleware/authJwt";

const router = Router();

router.use(verifyToken);

router.get("/api/projects", projectController.getProjects);
router.post("/api/projects", projectController.createProject);
router.get("/api/projects/:id", projectController.getProjectById);
router.put("/api/projects/:id", projectController.updateProject);
router.delete("/api/projects/:id", projectController.deleteProject);

export default router;
