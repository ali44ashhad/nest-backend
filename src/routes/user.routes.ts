import { Router } from "express";
import UserController from "../controllers/userController";
import { verifyToken } from "../middleware/authJwt";

const userRoutes = Router();
userRoutes.use(verifyToken);
const userController = new UserController();

userRoutes.get("/users", userController.getIndex);
userRoutes.post("/users", userController.createUser);
userRoutes.post("/usersTransaction", userController.createUserTransaction);
userRoutes.get("/users/:id", userController.getUserById);
userRoutes.put("/users/:id", userController.updateUser);
userRoutes.delete("/users/:id", userController.deleteUser);

export default userRoutes;
