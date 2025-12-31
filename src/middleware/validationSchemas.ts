import { body, param, query } from 'express-validator';

/**
 * Validation schemas for auth-related endpoints
 */
export const authValidation = {
  register: [
    body('username')
      .notEmpty().withMessage('Username is required')
      .isLength({ min: 3, max: 20 }).withMessage('Username must be between 3 and 20 characters')
      .trim()
      .escape(),
    body('email')
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Must be a valid email address')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6, max: 40 }).withMessage('Password must be between 6 and 40 characters')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[0-9]/).withMessage('Password must contain at least one number'),
    body('role')
      .notEmpty().withMessage('Role is required')
      .isIn(['student', 'parent', 'teacher']).withMessage('Role must be one of: student, parent, teacher'),
    body('age')
      .optional()
      .custom((value, { req }) => {
        // Age validation only applies to students
        if (req.body.role !== 'student') {
          // For non-students, ignore this field
          return true;
        }
        // For students, validate age if provided
        if (value !== undefined && value !== null) {
          const ageNum = typeof value === 'string' ? parseInt(value, 10) : value;
          if (isNaN(ageNum) || ageNum < 3 || ageNum > 150) {
            throw new Error('Age must be between 3 and 150');
          }
        }
        return true;
      }),
    body('dateOfBirth')
      .optional()
      .custom((value, { req }) => {
        // For non-students, ignore this field completely
        if (req.body.role !== 'student') {
          return true;
        }
        // dateOfBirth is required for students
        if (!value || value === '') {
          throw new Error('Date of birth is required for students');
        }
        // Validate ISO date format
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
        if (!isoDateRegex.test(value)) {
          throw new Error('Date of birth must be a valid ISO date (YYYY-MM-DD)');
        }
        // Validate it's a real date
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new Error('Date of birth must be a valid date');
        }
        return true;
      }),
    body('parentEmail')
      .optional()
      .custom((value, { req }) => {
        // For non-students, ignore this field (allow it but don't validate)
        if (req.body.role !== 'student') {
          return true;
        }
        // For students, validate email format if provided
        if (value !== undefined && value !== null && value !== '') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            throw new Error('Parent email must be a valid email address');
          }
        }
        return true;
      })
      .normalizeEmail(),
    body('parentConsent')
      .optional({ nullable: true })
      .custom((value, { req }) => {
        // For non-students, ignore this field entirely (allow any value)
        if (req.body.role !== 'student') {
          req.body.__parentConsent = undefined;
          return true;
        }
        if (value === undefined || value === null) {
          req.body.__parentConsent = undefined;
          return true;
        }
        if (typeof value !== 'boolean') {
          throw new Error('Parent consent must be a boolean');
        }
        req.body.__parentConsent = value;
        return true;
      })
      .customSanitizer(() => undefined),
    body('country')
      .optional({ nullable: true })
      .isString().withMessage('Country must be a string')
      .isLength({ max: 100 }).withMessage('Country must be at most 100 characters')
      .trim(),
    body('city')
      .optional({ nullable: true })
      .isString().withMessage('City must be a string')
      .isLength({ max: 100 }).withMessage('City must be at most 100 characters')
      .trim()
  ],
  login: [
    body('username')
      .notEmpty().withMessage('Username is required')
      .trim()
      .escape(),
    body('password')
      .notEmpty().withMessage('Password is required'),
    body('country')
      .optional({ nullable: true })
      .isString().withMessage('Country must be a string')
      .isLength({ max: 100 }).withMessage('Country must be at most 100 characters')
      .trim(),
    body('city')
      .optional({ nullable: true })
      .isString().withMessage('City must be a string')
      .isLength({ max: 100 }).withMessage('City must be at most 100 characters')
      .trim()
  ],
};

/**
 * Validation schemas for user-related endpoints
 */
export const userValidation = {
  getUserById: [
    param('id').isInt().withMessage('User ID must be an integer')
  ],
  updateUser: [
    param('id').isInt().withMessage('User ID must be an integer'),
    body('name').optional()
      .isString().withMessage('Name must be a string')
      .isLength({ min: 1, max: 255 }).withMessage('Name must be between 1 and 255 characters')
      .trim()
      .escape(),
    body('email').optional()
      .isEmail().withMessage('Must be a valid email address')
      .normalizeEmail(),
    body('roles').optional()
      .isArray().withMessage('Roles must be an array')
  ],
};

/**
 * Validation schemas for project-related endpoints
 */
export const projectValidation = {
  createProject: [
    body('name')
      .notEmpty().withMessage('Project name is required')
      .isString().withMessage('Project name must be a string')
      .isLength({ min: 3, max: 100 }).withMessage('Project name must be between 3 and 100 characters')
      .trim(),
    body('description').optional()
      .isString().withMessage('Description must be a string')
      .trim(),
    body('userId')
      .notEmpty().withMessage('User ID is required')
      .isInt().withMessage('User ID must be an integer')
  ],
  getProjectById: [
    param('id').isInt().withMessage('Project ID must be an integer')
  ],
};