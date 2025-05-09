const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');

// Register route
router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['patient', 'doctor', 'admin', 'biologist']),
    body('first_name').notEmpty(),
    body('last_name').notEmpty(),
    body('phone').optional()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, role, first_name, last_name, phone } = req.body;

      // Check if user already exists
      db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        if (user) {
          return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert new user
        const sql = `INSERT INTO users (email, password, role, first_name, last_name, phone) 
                    VALUES (?, ?, ?, ?, ?, ?)`;
        
        db.run(sql, [email, hashedPassword, role, first_name, last_name, phone], function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error creating user' });
          }

          // Create JWT token
          const token = jwt.sign(
            { id: this.lastID, email, role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
          );

          res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
              id: this.lastID,
              email,
              role,
              first_name,
              last_name
            }
          });
        });
      });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Login route
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').exists()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        if (!user) {
          return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create JWT token
        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.json({
          message: 'Login successful',
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            first_name: user.first_name,
            last_name: user.last_name
          }
        });
      });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router; 