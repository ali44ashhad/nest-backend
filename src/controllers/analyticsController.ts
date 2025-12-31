import { Request, Response } from "express";
import pool, { DB_SCHEMA } from "../db";

const USERS_TABLE = `${DB_SCHEMA}.users`;
const PROJECTS_TABLE = `${DB_SCHEMA}.projects`;

class AnalyticsController {
  private readonly ALLOWED_ROLES = ["ROLE_USER", "ROLE_ADMIN"] as const;

  private convertRolesToDbFormat(roles: string[]): string[] {
    return roles.map((role) => role.replace(/^ROLE_/, "").toLowerCase());
  }

  private convertRolesToResponseFormat(dbRoles: unknown): string[] {
    if (!Array.isArray(dbRoles) || dbRoles.length === 0) {
      return ["ROLE_USER"];
    }

    const formatted = (dbRoles as unknown[])
      .map((role) => (typeof role === "string" ? role.trim() : ""))
      .filter((role) => role.length > 0)
      .map((role) => {
        const normalized = role.toUpperCase();
        return normalized.startsWith("ROLE_") ? normalized : `ROLE_${normalized}`;
      });

    if (!formatted.includes("ROLE_USER")) {
      formatted.push("ROLE_USER");
    }

    return Array.from(new Set(formatted));
  }

  // 2.1 Get All Users
  getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await pool.query(
        `SELECT 
          id,
          name as username,
          email,
          role,
          roles,
          age,
          date_of_birth as "dateOfBirth",
          parent_email as "parentEmail",
          country,
          city,
          created_at as "createdAt",
          last_login_at as "lastLoginAt"
        FROM ${USERS_TABLE}
        ORDER BY created_at DESC`
      );

      const users = result.rows.map((user) => ({
        id: user.id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        roles: user.roles,
        age: user.age,
        dateOfBirth: user.dateOfBirth,
        parentEmail: user.parentEmail,
        country: user.country,
        city: user.city,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      }));

      res.status(200).json(users);
    } catch (error) {
      console.error("Get all users error:", error);
      res.status(500).json({ error: "Internal server error", message: (error as Error).message });
    }
  };

  // 2.2 Get User Statistics
  getUserStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await pool.query(
        `SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'student' THEN 1 END) as students,
          COUNT(CASE WHEN role = 'parent' THEN 1 END) as parents,
          COUNT(CASE WHEN role = 'teacher' THEN 1 END) as teachers,
          COUNT(CASE WHEN last_login_at >= NOW() - INTERVAL '30 days' THEN 1 END) as active_users,
          COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as new_today,
          COUNT(CASE WHEN created_at >= DATE_TRUNC('week', CURRENT_DATE) THEN 1 END) as new_this_week,
          COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as new_this_month
        FROM ${USERS_TABLE}`
      );

      const stats = result.rows[0];
      const response = {
        totalUsers: parseInt(stats.total_users) || 0,
        students: parseInt(stats.students) || 0,
        parents: parseInt(stats.parents) || 0,
        teachers: parseInt(stats.teachers) || 0,
        activeUsers: parseInt(stats.active_users) || 0,
        newUsersToday: parseInt(stats.new_today) || 0,
        newUsersThisWeek: parseInt(stats.new_this_week) || 0,
        newUsersThisMonth: parseInt(stats.new_this_month) || 0,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Get user stats error:", error);
      res.status(500).json({ error: "Internal server error", message: (error as Error).message });
    }
  };

  // 2.3 Get All Projects
  getAllProjects = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await pool.query(
        `SELECT 
          p.id,
          p.name,
          p.description,
          p.blocks,
          p.created_at as "createdAt",
          p.updated_at as "updatedAt",
          u.id as user_id,
          u.name as user_username
        FROM ${PROJECTS_TABLE} p
        LEFT JOIN ${USERS_TABLE} u ON p.user_id = u.id
        ORDER BY p.created_at DESC`
      );

      const projects = result.rows.map((project) => ({
        id: project.id.toString(),
        name: project.name,
        description: project.description,
        owner: {
          id: project.user_id?.toString() || null,
          username: project.user_username || null,
        },
        blocks: typeof project.blocks === 'string' ? JSON.parse(project.blocks) : project.blocks,
        created: project.createdAt,
        lastModified: project.updatedAt,
      }));

      res.status(200).json(projects);
    } catch (error) {
      console.error("Get all projects error:", error);
      res.status(500).json({ error: "Internal server error", message: (error as Error).message });
    }
  };

  // 2.4 Get Project Statistics
  getProjectStats = async (req: Request, res: Response): Promise<void> => {
    try {
      // Get total projects and date-based counts
      const statsResult = await pool.query(
        `SELECT 
          COUNT(*) as total_projects,
          COUNT(CASE WHEN created_at >= DATE_TRUNC('week', CURRENT_DATE) THEN 1 END) as this_week,
          COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as this_month
        FROM ${PROJECTS_TABLE}`
      );

      // Get total users who have projects
      const usersWithProjectsResult = await pool.query(
        `SELECT COUNT(DISTINCT user_id) as users_with_projects FROM ${PROJECTS_TABLE}`
      );

      const stats = statsResult.rows[0];
      const totalProjects = parseInt(stats.total_projects) || 0;
      const usersWithProjects = parseInt(usersWithProjectsResult.rows[0].users_with_projects) || 1; // Avoid division by zero

      const response = {
        totalProjects,
        projectsThisWeek: parseInt(stats.this_week) || 0,
        projectsThisMonth: parseInt(stats.this_month) || 0,
        averageProjectsPerUser: totalProjects > 0 ? (totalProjects / usersWithProjects).toFixed(2) : "0.00",
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Get project stats error:", error);
      res.status(500).json({ error: "Internal server error", message: (error as Error).message });
    }
  };

  // 2.5 Get Location Analytics
  getLocationAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await pool.query(
        `SELECT 
          COALESCE(country, last_known_country) as country,
          COALESCE(city, last_known_city) as city,
          COUNT(*) as user_count
        FROM ${USERS_TABLE}
        WHERE (country IS NOT NULL AND city IS NOT NULL AND country != '' AND city != '')
           OR (last_known_country IS NOT NULL AND last_known_city IS NOT NULL 
               AND last_known_country != '' AND last_known_city != '')
        GROUP BY COALESCE(country, last_known_country), COALESCE(city, last_known_city)
        ORDER BY user_count DESC
        LIMIT 50`
      );

      const locations = result.rows.map((row) => ({
        country: row.country,
        city: row.city,
        userCount: parseInt(row.user_count) || 0,
      }));

      res.status(200).json(locations);
    } catch (error) {
      console.error("Get location analytics error:", error);
      res.status(500).json({ error: "Internal server error", message: (error as Error).message });
    }
  };

  // 2.6 Get Registration Trends
  getRegistrationTrends = async (req: Request, res: Response): Promise<void> => {
    try {
      const days = parseInt(req.query.days as string) || 30;

      const result = await pool.query(
        `WITH date_series AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '${days} days',
            CURRENT_DATE,
            '1 day'::interval
          )::date AS date
        )
        SELECT 
          ds.date::text as date,
          COALESCE(COUNT(u.id), 0)::int as count
        FROM date_series ds
        LEFT JOIN ${USERS_TABLE} u ON DATE(u.created_at) = ds.date
        GROUP BY ds.date
        ORDER BY ds.date ASC`
      );

      const trends = result.rows.map((row) => ({
        date: row.date,
        count: parseInt(row.count) || 0,
      }));

      res.status(200).json(trends);
    } catch (error) {
      console.error("Get registration trends error:", error);
      res.status(500).json({ error: "Internal server error", message: (error as Error).message });
    }
  };

  // 2.7 Get Roles Distribution
  getRolesDistribution = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await pool.query(
        `WITH role_counts AS (
          SELECT 
            role,
            COUNT(*) as count
          FROM ${USERS_TABLE}
          WHERE role IS NOT NULL
          GROUP BY role
        ),
        total_users AS (
          SELECT COUNT(*) as total FROM ${USERS_TABLE}
        )
        SELECT 
          COALESCE(rc.role, roles.role) as role,
          COALESCE(rc.count, 0)::int as count,
          ROUND((COALESCE(rc.count, 0)::numeric / NULLIF(tu.total, 0)) * 100, 2) as percentage
        FROM (VALUES ('student'), ('parent'), ('teacher')) AS roles(role)
        LEFT JOIN role_counts rc ON roles.role = rc.role
        CROSS JOIN total_users tu
        ORDER BY rc.count DESC NULLS LAST`
      );

      const distribution = result.rows.map((row) => ({
        role: row.role,
        count: parseInt(row.count) || 0,
        percentage: parseFloat(row.percentage) || 0,
      }));

      res.status(200).json(distribution);
    } catch (error) {
      console.error("Get roles distribution error:", error);
      res.status(500).json({ error: "Internal server error", message: (error as Error).message });
    }
  };

  // 2.8 Get Active Users
  getActiveUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const days = parseInt(req.query.days as string) || 30;

      const result = await pool.query(
        `SELECT 
          COUNT(CASE WHEN last_login_at >= NOW() - INTERVAL '${days} days' THEN 1 END) as active_users,
          COUNT(*) as total_users
        FROM ${USERS_TABLE}`
      );

      const stats = result.rows[0];
      const activeUsers = parseInt(stats.active_users) || 0;
      const totalUsers = parseInt(stats.total_users) || 0;
      const activePercentage = totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : "0.00";

      const response = {
        activeUsers,
        totalUsers,
        activePercentage: parseFloat(activePercentage),
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Get active users error:", error);
      res.status(500).json({ error: "Internal server error", message: (error as Error).message });
    }
  };

  // 2.9 Get Dashboard Overview
  getDashboardOverview = async (req: Request, res: Response): Promise<void> => {
    try {
      // Get user stats
      const userStatsResult = await pool.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN last_login_at >= NOW() - INTERVAL '30 days' THEN 1 END) as active,
          COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as new_today,
          COUNT(CASE WHEN created_at >= DATE_TRUNC('week', CURRENT_DATE) THEN 1 END) as new_this_week,
          COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as new_this_month
        FROM ${USERS_TABLE}`
      );

      // Get project stats
      const projectStatsResult = await pool.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN created_at >= DATE_TRUNC('week', CURRENT_DATE) THEN 1 END) as this_week,
          COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as this_month,
          COUNT(DISTINCT user_id) as users_with_projects
        FROM ${PROJECTS_TABLE}`
      );

      // Get roles distribution
      const rolesResult = await pool.query(
        `WITH role_counts AS (
          SELECT role, COUNT(*) as count
          FROM ${USERS_TABLE}
          WHERE role IS NOT NULL
          GROUP BY role
        ),
        total_users AS (SELECT COUNT(*) as total FROM ${USERS_TABLE})
        SELECT 
          COALESCE(rc.role, roles.role) as role,
          COALESCE(rc.count, 0)::int as count,
          ROUND((COALESCE(rc.count, 0)::numeric / NULLIF(tu.total, 0)) * 100, 2) as percentage
        FROM (VALUES ('student'), ('parent'), ('teacher')) AS roles(role)
        LEFT JOIN role_counts rc ON roles.role = rc.role
        CROSS JOIN total_users tu
        ORDER BY rc.count DESC NULLS LAST`
      );

      // Get top locations
      const locationsResult = await pool.query(
        `SELECT 
          COALESCE(country, last_known_country) as country,
          COALESCE(city, last_known_city) as city,
          COUNT(*) as user_count
        FROM ${USERS_TABLE}
        WHERE (country IS NOT NULL AND city IS NOT NULL AND country != '' AND city != '')
           OR (last_known_country IS NOT NULL AND last_known_city IS NOT NULL 
               AND last_known_country != '' AND last_known_city != '')
        GROUP BY COALESCE(country, last_known_country), COALESCE(city, last_known_city)
        ORDER BY user_count DESC
        LIMIT 10`
      );

      const userStats = userStatsResult.rows[0];
      const projectStats = projectStatsResult.rows[0];
      const totalProjects = parseInt(projectStats.total) || 0;
      const usersWithProjects = parseInt(projectStats.users_with_projects) || 1;

      const overview = {
        users: {
          total: parseInt(userStats.total) || 0,
          active: parseInt(userStats.active) || 0,
          newToday: parseInt(userStats.new_today) || 0,
          newThisWeek: parseInt(userStats.new_this_week) || 0,
          newThisMonth: parseInt(userStats.new_this_month) || 0,
        },
        projects: {
          total: totalProjects,
          thisWeek: parseInt(projectStats.this_week) || 0,
          thisMonth: parseInt(projectStats.this_month) || 0,
          averagePerUser: totalProjects > 0 ? (totalProjects / usersWithProjects).toFixed(2) : "0.00",
        },
        roles: rolesResult.rows.map((row) => ({
          role: row.role,
          count: parseInt(row.count) || 0,
          percentage: parseFloat(row.percentage) || 0,
        })),
        topLocations: locationsResult.rows.map((row) => ({
          country: row.country,
          city: row.city,
          userCount: parseInt(row.user_count) || 0,
        })),
      };

      res.status(200).json(overview);
    } catch (error) {
      console.error("Get dashboard overview error:", error);
      res.status(500).json({ error: "Internal server error", message: (error as Error).message });
    }
  };

  // 2.10 Update user roles
  updateUserRoles = async (req: Request, res: Response): Promise<void> => {
    const rawUserId = req.params.userId?.trim();

    if (!rawUserId || !/^[a-zA-Z0-9-]+$/.test(rawUserId)) {
      res.status(400).json({ message: "Invalid userId parameter" });
      return;
    }

    const { roles } = req.body ?? {};

    if (roles === undefined) {
      res.status(400).json({ message: "Roles field is required" });
      return;
    }

    if (!Array.isArray(roles)) {
      res.status(400).json({ message: "Roles must be an array" });
      return;
    }

    if (roles.length === 0) {
      res.status(400).json({ message: "Roles array cannot be empty" });
      return;
    }

    if (roles.some((role) => typeof role !== "string" || role.trim().length === 0)) {
      res.status(400).json({
        message: "Invalid roles array",
        errors: ["Role values must be non-empty strings"],
      });
      return;
    }

    const normalizedRoles = Array.from(
      new Set(
        roles
          .map((role: string) => role.trim().toUpperCase())
      )
    );

    const invalidRoles = normalizedRoles.filter(
      (role) => !this.ALLOWED_ROLES.includes(role as (typeof this.ALLOWED_ROLES)[number])
    );

    if (invalidRoles.length > 0) {
      res.status(400).json({
        message: "Invalid roles array",
        errors: invalidRoles.map((role) => `Invalid role value: ${role}`),
      });
      return;
    }

    if (!normalizedRoles.includes("ROLE_USER")) {
      res.status(400).json({ message: "ROLE_USER must always be included" });
      return;
    }

    const requestingUserId = req.userId?.toString();
    const requestingUserRoles = req.userRoles || [];

    if (
      requestingUserId === rawUserId &&
      requestingUserRoles.includes("ROLE_ADMIN") &&
      !normalizedRoles.includes("ROLE_ADMIN")
    ) {
      res.status(400).json({ message: "You cannot remove your own admin access" });
      return;
    }

    try {
      const userResult = await pool.query(
        `SELECT id, name as username, email, roles, role 
         FROM ${USERS_TABLE} 
         WHERE id = $1`,
        [rawUserId]
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const dbRoles = this.convertRolesToDbFormat(normalizedRoles);

      const updateResult = await pool.query(
        `UPDATE ${USERS_TABLE} 
         SET roles = $2 
         WHERE id = $1
         RETURNING id, name as username, email, roles, role`,
        [rawUserId, dbRoles]
      );

      if (updateResult.rows.length === 0) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const updatedUser = updateResult.rows[0];

      res.status(200).json({
        id: updatedUser.id.toString(),
        username: updatedUser.username,
        email: updatedUser.email,
        roles: this.convertRolesToResponseFormat(updatedUser.roles),
        role: updatedUser.role,
        message: "User roles updated successfully",
      });
    } catch (error) {
      console.error("Update user roles error:", error);
      res.status(500).json({ message: "Failed to update user roles" });
    }
  };
}

export default new AnalyticsController();

