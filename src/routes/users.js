/**
 * @fileoverview User management routes for the healthcare system
 * @module routes/users
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { auth, checkRole } = require('../middleware/auth');
const db = require('../config/database');

/**
 * @route GET /api/users
 * @desc Get all users (admin only)
 * @access Private/Admin
 * @returns {Object} List of users
 */
router.get('/', auth, checkRole(['admin']), async (req, res) => {
  try {
    const sql = `SELECT id, email, role, first_name, last_name, phone, 
                 specialization, license_number, created_at 
                 FROM users`;
    
    db.all(sql, [], (err, users) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(users);
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Private
 * @param {string} id - User ID
 * @returns {Object} User details
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Check if user has permission
    if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const sql = `SELECT id, email, role, first_name, last_name, phone, 
                 specialization, license_number, emergency_contact, 
                 blood_type, allergies, created_at 
                 FROM users WHERE id = ?`;
    
    db.get(sql, [userId], (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route PUT /api/users/:id
 * @desc Update user profile
 * @access Private
 * @param {string} id - User ID
 * @param {Object} req.body - Updated user data
 * @returns {Object} Updated user details
 */
router.put('/:id',
  auth,
  [
    body('first_name').optional().notEmpty(),
    body('last_name').optional().notEmpty(),
    body('phone').optional().isMobilePhone(),
    body('emergency_contact').optional().isMobilePhone(),
    body('blood_type').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    body('allergies').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.params.id;
      
      // Check if user has permission
      if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { first_name, last_name, phone, emergency_contact, blood_type, allergies } = req.body;

      // Update user
      const sql = `UPDATE users 
                  SET first_name = COALESCE(?, first_name),
                      last_name = COALESCE(?, last_name),
                      phone = COALESCE(?, phone),
                      emergency_contact = COALESCE(?, emergency_contact),
                      blood_type = COALESCE(?, blood_type),
                      allergies = COALESCE(?, allergies),
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?`;
      
      db.run(sql, [first_name, last_name, phone, emergency_contact, blood_type, allergies, userId], function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error updating user' });
        }

        // Get updated user
        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
          if (err) {
            return res.status(500).json({ message: 'Database error' });
          }
          res.json({
            message: 'User updated successfully',
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              first_name: user.first_name,
              last_name: user.last_name,
              phone: user.phone,
              emergency_contact: user.emergency_contact,
              blood_type: user.blood_type,
              allergies: user.allergies
            }
          });
        });
      });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route DELETE /api/users/:id
 * @desc Delete user (admin only)
 * @access Private/Admin
 * @param {string} id - User ID
 * @returns {Object} Success message
 */
router.delete('/:id', auth, checkRole(['admin']), async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if user exists
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Delete user
      db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error deleting user' });
        }

        res.json({
          message: 'User deleted successfully'
        });
      });
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 