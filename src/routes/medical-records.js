/**
 * @fileoverview Medical records management routes for the healthcare system
 * @module routes/medical-records
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, checkRole } = require('../middleware/auth');
const db = require('../config/database');

/**
 * @route GET /api/medical-records
 * @desc Get medical records for the authenticated user
 * @access Private
 * @returns {Object} List of medical records
 */
router.get('/', auth, async (req, res) => {
  try {
    const query = req.user.role === 'doctor' 
      ? 'SELECT * FROM medical_records WHERE doctor_id = ?'
      : 'SELECT * FROM medical_records WHERE patient_id = ?';
    
    db.all(query, [req.user.id], (err, records) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(records);
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/medical-records/:id
 * @desc Get a specific medical record
 * @access Private
 * @param {string} id - Medical record ID
 * @returns {Object} Medical record details
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const recordId = req.params.id;
    const query = `SELECT * FROM medical_records 
                  WHERE id = ? 
                  AND (patient_id = ? OR doctor_id = ?)`;
    
    db.get(query, [recordId, req.user.id, req.user.id], (err, record) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      if (!record) {
        return res.status(404).json({ message: 'Medical record not found or access denied' });
      }
      res.json(record);
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/medical-records
 * @desc Create a new medical record
 * @access Private
 * @param {Object} req.body.patient_id - ID of the patient
 * @param {string} req.body.diagnosis - Medical diagnosis
 * @param {string} req.body.prescription - Prescribed treatment
 * @param {string} [req.body.notes] - Additional notes
 * @returns {Object} Created medical record details
 */
router.post('/',
  auth,
  checkRole(['doctor']),
  [
    body('patient_id').isInt(),
    body('diagnosis').notEmpty(),
    body('prescription').notEmpty(),
    body('notes').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { patient_id, diagnosis, prescription, notes } = req.body;

      // Check if patient exists
      db.get('SELECT * FROM users WHERE id = ? AND role = "patient"', [patient_id], (err, patient) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        if (!patient) {
          return res.status(404).json({ message: 'Patient not found' });
        }

        // Create medical record
        const sql = `INSERT INTO medical_records 
                    (patient_id, doctor_id, diagnosis, prescription, notes) 
                    VALUES (?, ?, ?, ?, ?)`;
        
        db.run(sql, [patient_id, req.user.id, diagnosis, prescription, notes], function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error creating medical record' });
          }

          res.status(201).json({
            message: 'Medical record created successfully',
            record: {
              id: this.lastID,
              patient_id,
              doctor_id: req.user.id,
              diagnosis,
              prescription,
              notes
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
 * @route PUT /api/medical-records/:id
 * @desc Update a medical record
 * @access Private
 * @param {string} id - Medical record ID
 * @param {string} [req.body.diagnosis] - Updated diagnosis
 * @param {string} [req.body.prescription] - Updated prescription
 * @param {string} [req.body.notes] - Updated notes
 * @returns {Object} Updated medical record details
 */
router.put('/:id',
  auth,
  checkRole(['doctor']),
  [
    body('diagnosis').optional().notEmpty(),
    body('prescription').optional().notEmpty(),
    body('notes').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { diagnosis, prescription, notes } = req.body;
      const recordId = req.params.id;

      // Check if record exists and doctor has permission
      const checkSql = `SELECT * FROM medical_records 
                       WHERE id = ? AND doctor_id = ?`;
      
      db.get(checkSql, [recordId, req.user.id], (err, record) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        if (!record) {
          return res.status(404).json({ message: 'Medical record not found or access denied' });
        }

        // Update record
        const updateSql = `UPDATE medical_records 
                          SET diagnosis = COALESCE(?, diagnosis),
                              prescription = COALESCE(?, prescription),
                              notes = COALESCE(?, notes)
                          WHERE id = ?`;
        
        db.run(updateSql, [diagnosis, prescription, notes, recordId], function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error updating medical record' });
          }

          res.json({
            message: 'Medical record updated successfully',
            record: {
              ...record,
              diagnosis: diagnosis || record.diagnosis,
              prescription: prescription || record.prescription,
              notes: notes || record.notes
            }
          });
        });
      });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router; 