/**
 * @fileoverview Notification system routes for the healthcare system
 * @module routes/notifications
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, checkRole } = require('../middleware/auth');
const db = require('../config/database');

/**
 * @route GET /api/notifications
 * @desc Get all notifications for the authenticated user
 * @access Private
 * @param {string} [req.query.type] - Filter by notification type
 * @param {boolean} [req.query.unread] - Filter unread notifications
 * @returns {Object} List of notifications
 */
router.get('/', auth, async (req, res) => {
  try {
    const { type, unread } = req.query;
    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [req.user.id];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    if (unread === 'true') {
      query += ' AND is_read = 0';
    }

    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, notifications) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(notifications);
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/notifications
 * @desc Create a new notification
 * @access Private
 * @param {Object} req.body.user_id - User ID to notify
 * @param {string} req.body.type - Notification type
 * @param {string} req.body.title - Notification title
 * @param {string} req.body.content - Notification content
 * @returns {Object} Created notification
 */
router.post('/',
  auth,
  checkRole(['admin', 'doctor']),
  [
    body('user_id').isInt(),
    body('type').isIn(['appointment', 'medication', 'test_result', 'message', 'system']),
    body('title').notEmpty(),
    body('content').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { user_id, type, title, content } = req.body;

      // Check if user exists
      db.get('SELECT * FROM users WHERE id = ?', [user_id], (err, user) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        // Create notification
        const sql = `INSERT INTO notifications 
                    (user_id, type, title, content) 
                    VALUES (?, ?, ?, ?)`;
        
        db.run(sql, [user_id, type, title, content], function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error creating notification' });
          }

          // Get created notification
          db.get('SELECT * FROM notifications WHERE id = ?', [this.lastID], (err, notification) => {
            if (err) {
              return res.status(500).json({ message: 'Database error' });
            }

            res.status(201).json({
              message: 'Notification created successfully',
              notification
            });
          });
        });
      });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route PUT /api/notifications/:id/read
 * @desc Mark a notification as read
 * @access Private
 * @param {string} id - Notification ID
 * @returns {Object} Success message
 */
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notificationId = req.params.id;

    // Check if notification exists and belongs to user
    const checkSql = `SELECT * FROM notifications 
                     WHERE id = ? AND user_id = ?`;
    
    db.get(checkSql, [notificationId, req.user.id], (err, notification) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      if (!notification) {
        return res.status(404).json({ message: 'Notification not found or access denied' });
      }

      // Mark as read
      const updateSql = `UPDATE notifications 
                        SET is_read = 1 
                        WHERE id = ?`;
      
      db.run(updateSql, [notificationId], function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error updating notification' });
        }

        res.json({
          message: 'Notification marked as read'
        });
      });
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route PUT /api/notifications/read-all
 * @desc Mark all notifications as read
 * @access Private
 * @returns {Object} Success message
 */
router.put('/read-all', auth, async (req, res) => {
  try {
    const updateSql = `UPDATE notifications 
                      SET is_read = 1 
                      WHERE user_id = ? AND is_read = 0`;
    
    db.run(updateSql, [req.user.id], function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error updating notifications' });
      }

      res.json({
        message: 'All notifications marked as read',
        updated_count: this.changes
      });
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/notifications/unread-count
 * @desc Get count of unread notifications
 * @access Private
 * @returns {Object} Count of unread notifications
 */
router.get('/unread-count', auth, async (req, res) => {
  try {
    const sql = `SELECT COUNT(*) as count 
                FROM notifications 
                WHERE user_id = ? AND is_read = 0`;
    
    db.get(sql, [req.user.id], (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ unread_count: result.count });
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 