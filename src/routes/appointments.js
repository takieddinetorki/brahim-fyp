/**
 * @fileoverview Appointment management routes for the healthcare system
 * @module routes/appointments
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, checkRole } = require('../middleware/auth');
const db = require('../config/database');

/**
 * @route GET /api/appointments
 * @desc Get all appointments for the authenticated user
 * @access Private
 * @returns {Object} List of appointments
 */
router.get('/', auth, async (req, res) => {
  try {
    const query = req.user.role === 'doctor' 
      ? 'SELECT * FROM appointments WHERE doctor_id = ?'
      : 'SELECT * FROM appointments WHERE patient_id = ?';
    
    db.all(query, [req.user.id], (err, appointments) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(appointments);
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/appointments
 * @desc Create a new appointment
 * @access Private
 * @param {Object} req.body.appointment_date - Date and time of the appointment
 * @param {Object} req.body.doctor_id - ID of the doctor
 * @param {string} [req.body.notes] - Optional notes for the appointment
 * @returns {Object} Created appointment details
 */
router.post('/',
  auth,
  checkRole(['patient']),
  [
    body('appointment_date').isISO8601().toDate(),
    body('doctor_id').isInt(),
    body('notes').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { appointment_date, doctor_id, notes } = req.body;

      // Check if doctor exists
      db.get('SELECT * FROM users WHERE id = ? AND role = "doctor"', [doctor_id], (err, doctor) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        if (!doctor) {
          return res.status(404).json({ message: 'Doctor not found' });
        }

        // Check for appointment conflicts
        const sql = `SELECT * FROM appointments 
                    WHERE doctor_id = ? 
                    AND appointment_date = ? 
                    AND status != 'cancelled'`;
        
        db.get(sql, [doctor_id, appointment_date], (err, conflict) => {
          if (err) {
            return res.status(500).json({ message: 'Database error' });
          }
          if (conflict) {
            return res.status(400).json({ message: 'Time slot is already booked' });
          }

          // Create appointment
          const insertSql = `INSERT INTO appointments 
                            (patient_id, doctor_id, appointment_date, status, notes) 
                            VALUES (?, ?, ?, 'scheduled', ?)`;
          
          db.run(insertSql, [req.user.id, doctor_id, appointment_date, notes], function(err) {
            if (err) {
              return res.status(500).json({ message: 'Error creating appointment' });
            }

            res.status(201).json({
              message: 'Appointment created successfully',
              appointment: {
                id: this.lastID,
                patient_id: req.user.id,
                doctor_id,
                appointment_date,
                status: 'scheduled',
                notes
              }
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
 * @route PUT /api/appointments/:id
 * @desc Update an appointment's status or details
 * @access Private
 * @param {string} id - Appointment ID
 * @param {string} [req.body.status] - New status (scheduled/completed/cancelled)
 * @param {string} [req.body.notes] - Updated notes
 * @returns {Object} Updated appointment details
 */
router.put('/:id',
  auth,
  [
    body('status').optional().isIn(['scheduled', 'completed', 'cancelled']),
    body('notes').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { status, notes } = req.body;
      const appointmentId = req.params.id;

      // Check if appointment exists and user has permission
      const checkSql = `SELECT * FROM appointments 
                       WHERE id = ? 
                       AND (patient_id = ? OR doctor_id = ?)`;
      
      db.get(checkSql, [appointmentId, req.user.id, req.user.id], (err, appointment) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        if (!appointment) {
          return res.status(404).json({ message: 'Appointment not found or access denied' });
        }

        // Update appointment
        const updateSql = `UPDATE appointments 
                          SET status = COALESCE(?, status),
                              notes = COALESCE(?, notes)
                          WHERE id = ?`;
        
        db.run(updateSql, [status, notes, appointmentId], function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error updating appointment' });
          }

          res.json({
            message: 'Appointment updated successfully',
            appointment: {
              ...appointment,
              status: status || appointment.status,
              notes: notes || appointment.notes
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
 * @route DELETE /api/appointments/:id
 * @desc Cancel an appointment
 * @access Private
 * @param {string} id - Appointment ID
 * @returns {Object} Success message
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const appointmentId = req.params.id;

    // Check if appointment exists and user has permission
    const checkSql = `SELECT * FROM appointments 
                     WHERE id = ? 
                     AND (patient_id = ? OR doctor_id = ?)`;
    
    db.get(checkSql, [appointmentId, req.user.id, req.user.id], (err, appointment) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found or access denied' });
      }

      // Cancel appointment
      const updateSql = `UPDATE appointments 
                        SET status = 'cancelled' 
                        WHERE id = ?`;
      
      db.run(updateSql, [appointmentId], function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error cancelling appointment' });
        }

        res.json({
          message: 'Appointment cancelled successfully'
        });
      });
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 