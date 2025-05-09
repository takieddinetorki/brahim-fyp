/**
 * @fileoverview Test results management routes for the healthcare system
 * @module routes/test-results
 */

const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { auth, checkRole } = require('../middleware/auth');
const db = require('../config/database');

/**
 * @route POST /api/test-results/order
 * @desc Order a new test for a patient
 * @access Private - Doctors only
 * @param {number} req.body.patient_id - Patient ID
 * @param {string} req.body.test_type - Type of test
 * @param {string} [req.body.notes] - Additional notes for the test
 * @returns {Object} New test order details
 */
router.post('/order',
  auth,
  checkRole(['doctor']),
  [
    body('patient_id').isInt().withMessage('Valid patient ID is required'),
    body('test_type').notEmpty().withMessage('Test type is required'),
    body('notes').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { patient_id, test_type, notes } = req.body;

      // Verify patient exists
      db.get('SELECT * FROM users WHERE id = ? AND role = ?', [patient_id, 'patient'], (err, patient) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        if (!patient) {
          return res.status(404).json({ message: 'Patient not found' });
        }

        // Create test order
        const sql = `INSERT INTO test_results 
                    (patient_id, doctor_id, test_type, notes, test_date, result, status)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`;
        
        db.run(sql, [
          patient_id,
          req.user.id,
          test_type,
          notes,
          null, // result initially null
          'pending' // initial status
        ], function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error creating test order' });
          }

          // Create notification for patient
          const notificationSql = `INSERT INTO notifications 
                                 (user_id, type, title, content)
                                 VALUES (?, ?, ?, ?)`;
          
          db.run(notificationSql, [
            patient_id,
            'test_result',
            'New Test Ordered',
            `Dr. ${req.user.last_name} has ordered a ${test_type} test for you.`
          ]);

          res.status(201).json({
            message: 'Test ordered successfully',
            test_id: this.lastID
          });
        });
      });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route PUT /api/test-results/:id
 * @desc Update test result (for biologists)
 * @access Private - Biologists only
 * @param {string} req.params.id - Test result ID
 * @param {string} req.body.result - Test result
 * @param {string} req.body.reference_range - Reference range for the test
 * @param {string} [req.body.notes] - Additional notes
 * @returns {Object} Updated test result
 */
router.put('/:id',
  auth,
  checkRole(['biologist']),
  [
    body('result').notEmpty().withMessage('Test result is required'),
    body('reference_range').notEmpty().withMessage('Reference range is required'),
    body('notes').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { result, reference_range, notes } = req.body;
      const testId = req.params.id;

      // Update test result
      const sql = `UPDATE test_results 
                  SET result = ?, 
                      reference_range = ?,
                      notes = ?,
                      biologist_id = ?,
                      status = 'completed',
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?`;

      db.run(sql, [result, reference_range, notes, req.user.id, testId], function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error updating test result' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Test result not found' });
        }

        // Get test details for notification
        db.get(`SELECT tr.*, u.first_name, u.last_name, p.id as patient_id
                FROM test_results tr
                JOIN users u ON tr.doctor_id = u.id
                JOIN users p ON tr.patient_id = p.id
                WHERE tr.id = ?`, [testId], (err, test) => {
          if (!err && test) {
            // Notify doctor
            db.run(`INSERT INTO notifications (user_id, type, title, content)
                   VALUES (?, ?, ?, ?)`,
                   [test.doctor_id, 'test_result', 'Test Results Ready',
                    `Results for ${test.test_type} test are now available.`]);

            // Notify patient
            db.run(`INSERT INTO notifications (user_id, type, title, content)
                   VALUES (?, ?, ?, ?)`,
                   [test.patient_id, 'test_result', 'Test Results Ready',
                    `Your ${test.test_type} test results are now available.`]);
          }
        });

        res.json({
          message: 'Test result updated successfully',
          test_id: testId
        });
      });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route GET /api/test-results
 * @desc Get test results (filtered by role)
 * @access Private
 * @param {string} [req.query.patient_id] - Patient ID (required for doctors)
 * @param {string} [req.query.status] - Test status filter
 * @returns {Array} List of test results
 */
router.get('/',
  auth,
  [
    query('patient_id').optional().isInt(),
    query('status').optional().isIn(['pending', 'completed', 'cancelled'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      let { patient_id, status } = req.query;
      let query = `SELECT tr.*,
                         d.first_name as doctor_first_name,
                         d.last_name as doctor_last_name,
                         b.first_name as biologist_first_name,
                         b.last_name as biologist_last_name
                  FROM test_results tr
                  LEFT JOIN users d ON tr.doctor_id = d.id
                  LEFT JOIN users b ON tr.biologist_id = b.id
                  WHERE 1=1`;
      const params = [];

      // Role-based filters
      switch (req.user.role) {
        case 'patient':
          query += ' AND tr.patient_id = ?';
          params.push(req.user.id);
          break;
        case 'doctor':
          if (patient_id) {
            query += ' AND tr.patient_id = ?';
            params.push(patient_id);
          }
          query += ' AND tr.doctor_id = ?';
          params.push(req.user.id);
          break;
        case 'biologist':
          if (status === 'pending') {
            query += ' AND tr.biologist_id IS NULL';
          } else if (status === 'completed') {
            query += ' AND tr.biologist_id = ?';
            params.push(req.user.id);
          }
          break;
        case 'admin':
          if (patient_id) {
            query += ' AND tr.patient_id = ?';
            params.push(patient_id);
          }
          break;
      }

      if (status && status !== 'pending') {
        query += ' AND tr.status = ?';
        params.push(status);
      }

      query += ' ORDER BY tr.created_at DESC';

      db.all(query, params, (err, results) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        res.json(results);
      });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route GET /api/test-results/:id
 * @desc Get specific test result
 * @access Private
 * @param {string} req.params.id - Test result ID
 * @returns {Object} Test result details
 */
router.get('/:id',
  auth,
  async (req, res) => {
    try {
      const testId = req.params.id;
      const query = `SELECT tr.*,
                           d.first_name as doctor_first_name,
                           d.last_name as doctor_last_name,
                           b.first_name as biologist_first_name,
                           b.last_name as biologist_last_name,
                           p.first_name as patient_first_name,
                           p.last_name as patient_last_name
                    FROM test_results tr
                    LEFT JOIN users d ON tr.doctor_id = d.id
                    LEFT JOIN users b ON tr.biologist_id = b.id
                    LEFT JOIN users p ON tr.patient_id = p.id
                    WHERE tr.id = ?`;

      db.get(query, [testId], (err, result) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        if (!result) {
          return res.status(404).json({ message: 'Test result not found' });
        }

        // Check permission
        const canAccess = 
          req.user.role === 'admin' ||
          (req.user.role === 'doctor' && result.doctor_id === req.user.id) ||
          (req.user.role === 'biologist' && 
           (result.biologist_id === req.user.id || !result.biologist_id)) ||
          (req.user.role === 'patient' && result.patient_id === req.user.id);

        if (!canAccess) {
          return res.status(403).json({ message: 'Access denied' });
        }

        res.json(result);
      });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router; 