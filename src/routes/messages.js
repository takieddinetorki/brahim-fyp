/**
 * @fileoverview Secure messaging system routes for the healthcare system
 * @module routes/messages
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, checkRole } = require('../middleware/auth');
const db = require('../config/database');

/**
 * @route GET /api/messages
 * @desc Get all messages for the authenticated user
 * @access Private
 * @param {string} [req.query.conversation] - Filter messages by conversation ID
 * @returns {Object} List of messages
 */
router.get('/', auth, async (req, res) => {
  try {
    const { conversation } = req.query;
    let query, params;

    if (conversation) {
      query = `SELECT m.*, 
               u1.first_name as sender_first_name, u1.last_name as sender_last_name,
               u2.first_name as receiver_first_name, u2.last_name as receiver_last_name
               FROM messages m
               JOIN users u1 ON m.sender_id = u1.id
               JOIN users u2 ON m.receiver_id = u2.id
               WHERE (m.sender_id = ? OR m.receiver_id = ?)
               AND (m.sender_id = ? OR m.receiver_id = ?)
               ORDER BY m.created_at DESC`;
      params = [req.user.id, req.user.id, conversation, conversation];
    } else {
      query = `SELECT m.*, 
               u1.first_name as sender_first_name, u1.last_name as sender_last_name,
               u2.first_name as receiver_first_name, u2.last_name as receiver_last_name
               FROM messages m
               JOIN users u1 ON m.sender_id = u1.id
               JOIN users u2 ON m.receiver_id = u2.id
               WHERE m.sender_id = ? OR m.receiver_id = ?
               ORDER BY m.created_at DESC`;
      params = [req.user.id, req.user.id];
    }

    db.all(query, params, (err, messages) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(messages);
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/messages
 * @desc Send a new message
 * @access Private
 * @param {Object} req.body.receiver_id - ID of the message recipient
 * @param {string} req.body.content - Message content
 * @returns {Object} Created message details
 */
router.post('/',
  auth,
  [
    body('receiver_id').isInt(),
    body('content').notEmpty().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { receiver_id, content } = req.body;

      // Check if receiver exists
      db.get('SELECT * FROM users WHERE id = ?', [receiver_id], (err, receiver) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        if (!receiver) {
          return res.status(404).json({ message: 'Recipient not found' });
        }

        // Create message
        const sql = `INSERT INTO messages (sender_id, receiver_id, content) 
                    VALUES (?, ?, ?)`;
        
        db.run(sql, [req.user.id, receiver_id, content], function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error sending message' });
          }

          res.status(201).json({
            message: 'Message sent successfully',
            messageData: {
              id: this.lastID,
              sender_id: req.user.id,
              receiver_id,
              content,
              is_read: false,
              created_at: new Date().toISOString()
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
 * @route PUT /api/messages/:id/read
 * @desc Mark a message as read
 * @access Private
 * @param {string} id - Message ID
 * @returns {Object} Success message
 */
router.put('/:id/read', auth, async (req, res) => {
  try {
    const messageId = req.params.id;

    // Check if message exists and user is the receiver
    const checkSql = `SELECT * FROM messages 
                     WHERE id = ? AND receiver_id = ?`;
    
    db.get(checkSql, [messageId, req.user.id], (err, message) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      if (!message) {
        return res.status(404).json({ message: 'Message not found or access denied' });
      }

      // Mark message as read
      const updateSql = `UPDATE messages 
                        SET is_read = 1 
                        WHERE id = ?`;
      
      db.run(updateSql, [messageId], function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error updating message' });
        }

        res.json({
          message: 'Message marked as read'
        });
      });
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/messages/unread
 * @desc Get count of unread messages
 * @access Private
 * @returns {Object} Count of unread messages
 */
router.get('/unread', auth, async (req, res) => {
  try {
    const sql = `SELECT COUNT(*) as count 
                FROM messages 
                WHERE receiver_id = ? AND is_read = 0`;
    
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