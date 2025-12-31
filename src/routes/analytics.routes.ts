import { Router } from "express";
import analyticsController from "../controllers/analyticsController";
import { hasRoles } from "../middleware/authJwt";

const router = Router();

// All analytics routes require ROLE_ADMIN authentication
router.use(hasRoles(['ROLE_ADMIN']));

// User analytics endpoints
router.get("/api/analytics/users", analyticsController.getAllUsers);
router.get("/api/analytics/users/stats", analyticsController.getUserStats);
router.get("/api/analytics/users/roles", analyticsController.getRolesDistribution);
router.get("/api/analytics/users/active", analyticsController.getActiveUsers);
router.put("/api/analytics/users/:userId/roles", analyticsController.updateUserRoles);

// Project analytics endpoints
router.get("/api/analytics/projects", analyticsController.getAllProjects);
router.get("/api/analytics/projects/stats", analyticsController.getProjectStats);

// Location analytics endpoint
router.get("/api/analytics/location", analyticsController.getLocationAnalytics);

// Registration trends endpoint
router.get("/api/analytics/registrations/trends", analyticsController.getRegistrationTrends);

// Dashboard overview endpoint
router.get("/api/analytics/overview", analyticsController.getDashboardOverview);

export default router;

