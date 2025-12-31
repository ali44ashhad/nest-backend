import { Request, Response } from "express";
import pool, { DB_SCHEMA } from "../db";
import bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Get JWT settings from environment variables with reasonable defaults
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_development_only";
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "24h";

// Ensure JWT secret is set
if (!process.env.JWT_SECRET) {
  console.error("CRITICAL ERROR: JWT_SECRET is not defined in environment variables");
  process.exit(1);
}

const USERS_TABLE = `${DB_SCHEMA}.users`;
const USER_ACTIVITY_TABLE = `${DB_SCHEMA}.user_activity`;

// --- START: Reusable Cookie Options ---
const getCookieOptions = (): import("express").CookieOptions => ({
  httpOnly: true,
  secure: true,
  sameSite: "none",
  domain: process.env.COOKIE_DOMAIN || undefined,
});
// --- END: Reusable Cookie Options ---

class AuthController {
  // Helper function to calculate age from date of birth
  private calculateAge(dateOfBirth: string): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  // Helper function to convert database roles to JWT role format
  private convertRolesToJWTFormat(dbRoles: string[] | null | undefined): string[] {
    if (!dbRoles || !Array.isArray(dbRoles)) {
      return ['ROLE_USER'];
    }

    return dbRoles.map((role) => {
      // If already in ROLE_ format, return as is
      if (role.startsWith('ROLE_')) {
        return role;
      }
      // Convert lowercase role to ROLE_ format
      const roleUpper = role.toUpperCase();
      return `ROLE_${roleUpper}`;
    });
  }

  // User registration
  signup = async (req: Request, res: Response): Promise<void> => {
    const { 
      username, 
      email, 
      password, 
      role,
      age: ageInput,
      dateOfBirth,
      parentEmail,
      country,
      city
    } = req.body;

    const parentConsentProvided = req.body.__parentConsent === true;
    delete req.body.__parentConsent;

    try {
      // Validation: role is required
      if (!role || !['student', 'parent', 'teacher'].includes(role)) {
        res.status(400).json({ 
          message: "Role is required and must be one of: student, parent, teacher",
          errors: { role: ["Role must be student, parent, or teacher"] }
        });
        return;
      }

      // Validation for students
      let calculatedAge: number | null = null;
      if (role === 'student') {
        // dateOfBirth is required for students
        if (!dateOfBirth) {
          res.status(400).json({ 
            message: "Date of birth is required for students",
            errors: { dateOfBirth: ["Date of birth is required for students"] }
          });
          return;
        }

        // Calculate age from dateOfBirth
        calculatedAge = this.calculateAge(dateOfBirth);
        
        // Validate age range
        if (calculatedAge < 3 || calculatedAge > 150) {
          res.status(400).json({ 
            message: "Age must be between 3 and 150 years",
            errors: { dateOfBirth: [`Invalid date of birth: calculated age is ${calculatedAge}`] }
          });
          return;
        }

        // For students under 18, parent email and consent are required
        if (calculatedAge < 18) {
          if (!parentEmail) {
            res.status(400).json({ 
              message: "Parent email is required for students under 18",
              errors: { parentEmail: ["Parent email is required for students under 18"] }
            });
            return;
          }
          if (!parentConsentProvided) {
            res.status(400).json({ 
              message: "Parent consent is required for students under 18",
              errors: { parentConsent: ["Parent consent must be true for students under 18"] }
            });
            return;
          }
        }
      }

      // Check if a user with the same username or email already exists
      const existingUser = await pool.query(
        `SELECT * FROM ${USERS_TABLE} WHERE name = $1 OR email = $2`,
        [username, email]
      );

      // If a user is found, return a 409 Conflict error
      if (existingUser.rows.length > 0) {
        res.status(409).json({ message: "Username or email is already taken." });
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Determine roles array (default to user role)
      // Note: Roles are stored in database as lowercase ['user'], converted to JWT format on token creation
      const roles = ['user'];

      // Insert new user with all fields
      const result = await pool.query(
        `INSERT INTO ${USERS_TABLE} (
          name, email, password, roles, role, age, date_of_birth, 
          parent_email, country, city
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          username,
          email,
          hashedPassword,
          roles,
          role,
          calculatedAge,
          dateOfBirth || null,
          parentEmail || null,
          country ?? null,
          city ?? null
        ]
      );
      const user = result.rows[0];

      // Automatically sign in the user by creating a JWT and setting the cookie
      // Convert database roles to JWT format
      const jwtRoles = this.convertRolesToJWTFormat(user.roles);
      const payload = {
        id: user.id,
        roles: jwtRoles,
      };
      
      const accessToken = jwt.sign(
        payload, 
        JWT_SECRET, 
        { expiresIn: JWT_EXPIRATION }
      );

      res.cookie("accessToken", accessToken, getCookieOptions());

      // Format response according to requirements
      const response: any = {
        id: user.id.toString(),
        username: user.name,
        email: user.email,
        roles: jwtRoles,
        role: user.role,
        accessToken: accessToken,
        createdAt: user.created_at
      };

      // Add student-specific fields
      if (role === 'student') {
        response.age = user.age;
        response.dateOfBirth = user.date_of_birth;
        if (user.age && user.age < 18) {
          response.parentEmail = user.parent_email;
        }
      }

      // Add location fields
      if (user.country) response.country = user.country;
      if (user.city) response.city = user.city;

      res.status(201).json(response);
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Internal server error", message: (error as Error).message });
    }
  };

  // User login
  signin = async (req: Request, res: Response): Promise<void> => {
    const { username, password, country, city } = req.body;

    if (!username || !password) {
      res.status(400).json({ message: "Username and password are required" });
      return;
    }

    try {
      const result = await pool.query(
        `SELECT * FROM ${USERS_TABLE} WHERE name = $1`,
        [username]
      );

      const user = result.rows[0];

      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        res.status(401).json({ message: "Credentials are incorrect" });
        return;
      }

      // Update last login timestamp and location
      const now = new Date();
      await pool.query(
        `UPDATE ${USERS_TABLE} 
         SET last_login_at = $1, 
             last_known_country = COALESCE($2, last_known_country),
             last_known_city = COALESCE($3, last_known_city)
         WHERE id = $4`,
        [now, country || null, city || null, user.id]
      );

      // Track login activity
      try {
        await pool.query(
          `INSERT INTO ${USER_ACTIVITY_TABLE} (user_id, activity_type, country, city, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            user.id,
            'login',
            country || null,
            city || null,
            JSON.stringify({ loginTime: now.toISOString() })
          ]
        );
      } catch (activityError) {
        // Log but don't fail login if activity tracking fails
        console.error("Failed to track login activity:", activityError);
      }

      // Convert database roles to JWT format
      const jwtRoles = this.convertRolesToJWTFormat(user.roles);
      const accessToken = jwt.sign(
        {
          id: user.id,
          roles: jwtRoles,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRATION }
      );
      
      res.cookie("accessToken", accessToken, getCookieOptions());

      // Format response according to requirements
      const response: any = {
        id: user.id.toString(),
        username: user.name,
        email: user.email,
        roles: jwtRoles,
        role: user.role || null,
        accessToken: accessToken,
      };

      // Add location fields from user profile or login location
      if (user.country || country) {
        response.country = country || user.country;
      }
      if (user.city || city) {
        response.city = city || user.city;
      }

      res.status(200).json(response);
    } catch (error) {
      console.error("Signin error:", error);
      res.status(500).json({ error: "Internal server error", message: (error as Error).message });
    }
  };

  // User logout
  signout = (req: Request, res: Response): void => {
    res.clearCookie("accessToken", getCookieOptions());
    res.status(200).json({ message: "Signed out successfully" });
  };

  // Check authentication status
  checkAuth = async (req: Request, res: Response): Promise<void> => {
    const token = req.cookies.accessToken;

    if (!token) {
      res.status(401).json({ isAuthenticated: false });
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as unknown as { id: string };
      const result = await pool.query(`SELECT * FROM ${USERS_TABLE} WHERE id = $1`, [
        decoded.id,
      ]);
      const user = result.rows[0];

      if (!user) {
        res.status(401).json({ isAuthenticated: false });
        return;
      }

      // Convert database roles to JWT format
      const jwtRoles = this.convertRolesToJWTFormat(user.roles);
      
      res.status(200).json({
        isAuthenticated: true,
        user: {
          id: user.id,
          username: user.name,
          role: user.role,
          email: user.email,
          roles: jwtRoles,
        },
      });
    } catch (error) {
      res.status(401).json({ isAuthenticated: false });
    }
  };
}

export default new AuthController();