import { Request, Response } from "express";
import pool, { DB_SCHEMA } from "../db";

const PROJECTS_TABLE = `${DB_SCHEMA}.projects`;
const USERS_TABLE = `${DB_SCHEMA}.users`;
const USER_ACTIVITY_TABLE = `${DB_SCHEMA}.user_activity`;

class ProjectController {
  getProjects = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;
    try {
      const result = await pool.query(
        `SELECT * FROM ${PROJECTS_TABLE} WHERE user_id = $1 ORDER BY updated_at DESC`,
        [userId]
      );
      res.status(200).json(result.rows);
    } catch (error) {
      console.error("Get projects error:", error);
      res.status(500).json({ error: "Error fetching projects" });
    }
  };

  getProjectById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const result = await pool.query(`SELECT * FROM ${PROJECTS_TABLE} WHERE id = $1`, [id]);
      if (result.rows.length === 0) {
        res.status(404).json({ message: "Project not found" });
        return;
      }
      // We don't check for user ID here, so anyone can import any project
      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error("Get project by id error:", error);
      res.status(500).json({ error: `Error fetching project ${id}` });
    }
  };

  createProject = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).userId;
    const { name, description, blocks } = req.body;

    try {
      // Get user location for activity tracking
      const userResult = await pool.query(
        `SELECT country, city, last_known_country, last_known_city FROM ${USERS_TABLE} WHERE id = $1`,
        [userId]
      );
      const user = userResult.rows[0];
      const country = user?.country || user?.last_known_country || null;
      const city = user?.city || user?.last_known_city || null;

      const result = await pool.query(
        `INSERT INTO ${PROJECTS_TABLE} (user_id, name, description, blocks, created_at) 
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING *`,
        [userId, name, description, JSON.stringify(blocks)]
      );
      const project = result.rows[0];

      // Track project creation activity
      try {
        await pool.query(
          `INSERT INTO ${USER_ACTIVITY_TABLE} (user_id, activity_type, country, city, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            'project_created',
            country,
            city,
            JSON.stringify({ project_id: project.id, project_name: name })
          ]
        );
      } catch (activityError) {
        console.error("Failed to track project creation activity:", activityError);
      }

      res.status(201).json(project);
    } catch (error) {
      console.error("Create project error:", error);
      res.status(500).json({ error: "Internal server error", message: (error as Error).message });
    }
  };

  updateProject = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, description, blocks } = req.body;
    const userId = (req as any).userId;

    try {
      const result = await pool.query(
        `UPDATE ${PROJECTS_TABLE} 
         SET name = $1, description = $2, blocks = $3, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4 AND user_id = $5 RETURNING *`,
        [name, description, JSON.stringify(blocks), id, userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ message: "Project not found or User not authorized" });
        return;
      }

      // const project = result.rows[0];

      // Get user location for activity tracking
      const userResult = await pool.query(
        `SELECT country, city, last_known_country, last_known_city FROM ${USERS_TABLE} WHERE id = $1`,
        [userId]
      );
      const user = userResult.rows[0];
      const country = user?.country || user?.last_known_country || null;
      const city = user?.city || user?.last_known_city || null;

      // Track project modification activity
      try {
        await pool.query(
          `INSERT INTO ${USER_ACTIVITY_TABLE} (user_id, activity_type, country, city, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            'project_modified',
            country,
            city,
            JSON.stringify({ project_id: result.rows[0].id, project_name: name })
          ]
        );
      } catch (activityError) {
        console.error("Failed to track project modification activity:", activityError);
      }

      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error("Update project error:", error);
      res.status(500).json({ error: "Failed to update project", message: (error as Error).message });
    }
  };

  deleteProject = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = (req as any).userId;

    try {
      // Get project info before deletion for activity tracking
      const projectResult = await pool.query(
        `SELECT id, name FROM ${PROJECTS_TABLE} WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (projectResult.rows.length === 0) {
        res.status(404).json({ message: "Project not found or user not authorized" });
        return;
      }

      const project = projectResult.rows[0];

      // Delete the project
      const result = await pool.query(
        `DELETE FROM ${PROJECTS_TABLE} WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ message: "Project not found or user not authorized" });
        return;
      }

      // Get user location for activity tracking
      const userResult = await pool.query(
        `SELECT country, city, last_known_country, last_known_city FROM ${USERS_TABLE} WHERE id = $1`,
        [userId]
      );
      const user = userResult.rows[0];
      const country = user?.country || user?.last_known_country || null;
      const city = user?.city || user?.last_known_city || null;

      // Track project deletion activity
      try {
        await pool.query(
          `INSERT INTO ${USER_ACTIVITY_TABLE} (user_id, activity_type, country, city, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            'project_deleted',
            country,
            city,
            JSON.stringify({ project_id: project.id, project_name: project.name })
          ]
        );
      } catch (activityError) {
        console.error("Failed to track project deletion activity:", activityError);
      }

      res.status(204).send();
    } catch (error) {
      console.error("Delete project error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

export default new ProjectController();