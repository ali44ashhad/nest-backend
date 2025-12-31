import { Request, Response } from "express";
import pool from "../db";
import bcrypt from "bcryptjs";

class UserProfileController {
  changePassword = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Current and new passwords are required." });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ message: "New password must be at least 6 characters long." });
      return;
    }

    try {
      const result = await pool.query("SELECT password FROM users WHERE id = $1", [userId]);
      const user = result.rows[0];

      if (!user) {
        res.status(404).json({ message: "User not found." });
        return;
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        res.status(401).json({ message: "Invalid current password." });
        return;
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedNewPassword, userId]);

      res.status(200).json({ message: "Password updated successfully." });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  };
}

export default new UserProfileController();