/**
 * @fileoverview Health parameters tracking routes for the healthcare system
 * @module routes/health-parameters
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, checkRole } = require('../middleware/auth');
const db = require('../config/database');

/**
 * @route GET /api/health-parameters
 * @desc Get health parameters for a patient
 * @access Private
 * @param {string} [req.query.patient_id] - Patient ID (required for doctors)
 * @param {string} [req.query.type] - Filter by parameter type
 * @param {string} [req.query.start_date] - Start date for range
 * @param {string} [req.query.end_date] - End date for range
 * @returns {Object} List of health parameters
 */
router.get('/', auth, async (req, res) => {
  try {
    const { patient_id, type, start_date, end_date } = req.query;
    let query = 'SELECT * FROM health_parameters WHERE 1=1';
    const params = [];

    // Set patient_id based on role
    const targetPatientId = req.user.role === 'patient' ? req.user.id : patient_id;
    if (!targetPatientId) {
      return res.status(400).json({ message: 'Patient ID is required for doctors' });
    }

    query += ' AND patient_id = ?';
    params.push(targetPatientId);

    // Add filters
    if (type) {
      query += ' AND parameter_type = ?';
      params.push(type);
    }
    if (start_date) {
      query += ' AND recorded_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND recorded_at <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY recorded_at DESC';

    db.all(query, params, (err, parameters) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(parameters);
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/health-parameters
 * @desc Add a new health parameter record
 * @access Private
 * @param {Object} req.body.patient_id - Patient ID (required for doctors)
 * @param {string} req.body.parameter_type - Type of parameter
 * @param {string} req.body.value - Parameter value
 * @param {string} req.body.unit - Unit of measurement
 * @param {string} [req.body.notes] - Additional notes
 * @returns {Object} Created health parameter record
 */
router.post('/',
  auth,
  [
    body('patient_id').optional().isInt(),
    body('parameter_type').isIn(['blood_pressure', 'heart_rate', 'blood_sugar', 'temperature', 'weight']),
    body('value').notEmpty(),
    body('unit').notEmpty(),
    body('notes').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { patient_id, parameter_type, value, unit, notes } = req.body;
      const targetPatientId = req.user.role === 'patient' ? req.user.id : patient_id;

      if (!targetPatientId) {
        return res.status(400).json({ message: 'Patient ID is required for doctors' });
      }

      // Validate patient exists
      db.get('SELECT * FROM users WHERE id = ?', [targetPatientId], (err, patient) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        if (!patient) {
          return res.status(404).json({ message: 'Patient not found' });
        }

        // Insert health parameter
        const sql = `INSERT INTO health_parameters 
                    (patient_id, parameter_type, value, unit, recorded_at, notes) 
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`;
        
        db.run(sql, [targetPatientId, parameter_type, value, unit, notes], function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error recording health parameter' });
          }

          // Get the created record
          db.get('SELECT * FROM health_parameters WHERE id = ?', [this.lastID], (err, record) => {
            if (err) {
              return res.status(500).json({ message: 'Database error' });
            }

            res.status(201).json({
              message: 'Health parameter recorded successfully',
              record
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
 * @route GET /api/health-parameters/stats
 * @desc Get health parameter statistics
 * @access Private
 * @param {string} [req.query.patient_id] - Patient ID (required for doctors)
 * @param {string} [req.query.type] - Parameter type
 * @param {string} [req.query.period] - Time period (day, week, month, year)
 * @returns {Object} Statistics for the specified parameters
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const { patient_id, type, period = 'month' } = req.query;
    const targetPatientId = req.user.role === 'patient' ? req.user.id : patient_id;

    if (!targetPatientId) {
      return res.status(400).json({ message: 'Patient ID is required for doctors' });
    }

    let dateFilter;
    switch (period) {
      case 'day':
        dateFilter = "datetime('now', '-1 day')";
        break;
      case 'week':
        dateFilter = "datetime('now', '-7 days')";
        break;
      case 'month':
        dateFilter = "datetime('now', '-1 month')";
        break;
      case 'year':
        dateFilter = "datetime('now', '-1 year')";
        break;
      default:
        dateFilter = "datetime('now', '-1 month')";
    }

    const query = `SELECT parameter_type,
                          COUNT(*) as count,
                          AVG(CAST(value AS FLOAT)) as average,
                          MIN(CAST(value AS FLOAT)) as minimum,
                          MAX(CAST(value AS FLOAT)) as maximum
                   FROM health_parameters
                   WHERE patient_id = ?
                   AND recorded_at >= ${dateFilter}
                   ${type ? 'AND parameter_type = ?' : ''}
                   GROUP BY parameter_type`;

    const params = [targetPatientId];
    if (type) params.push(type);

    db.all(query, params, (err, stats) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(stats);
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/health-parameters/trends
 * @desc Get health parameter trends over time
 * @access Private
 * @param {string} [req.query.patient_id] - Patient ID (required for doctors)
 * @param {string} req.query.type - Parameter type
 * @param {string} req.query.period - Time period (day, week, month, year)
 * @returns {Object} Trend analysis data
 */
router.get('/trends', auth, async (req, res) => {
  try {
    const { patient_id, type, period = 'month' } = req.query;
    const targetPatientId = req.user.role === 'patient' ? req.user.id : patient_id;

    if (!targetPatientId || !type) {
      return res.status(400).json({ 
        message: 'Patient ID and parameter type are required' 
      });
    }

    let dateFilter, groupBy;
    switch (period) {
      case 'day':
        dateFilter = "datetime('now', '-1 day')";
        groupBy = "strftime('%H', recorded_at)";
        break;
      case 'week':
        dateFilter = "datetime('now', '-7 days')";
        groupBy = "strftime('%Y-%m-%d', recorded_at)";
        break;
      case 'month':
        dateFilter = "datetime('now', '-1 month')";
        groupBy = "strftime('%Y-%m-%d', recorded_at)";
        break;
      case 'year':
        dateFilter = "datetime('now', '-1 year')";
        groupBy = "strftime('%Y-%m', recorded_at)";
        break;
      default:
        dateFilter = "datetime('now', '-1 month')";
        groupBy = "strftime('%Y-%m-%d', recorded_at)";
    }

    const query = `SELECT 
                    ${groupBy} as time_period,
                    AVG(CAST(value AS FLOAT)) as average_value,
                    MIN(CAST(value AS FLOAT)) as min_value,
                    MAX(CAST(value AS FLOAT)) as max_value,
                    COUNT(*) as readings_count
                  FROM health_parameters
                  WHERE patient_id = ?
                  AND parameter_type = ?
                  AND recorded_at >= ${dateFilter}
                  GROUP BY ${groupBy}
                  ORDER BY time_period`;

    db.all(query, [targetPatientId, type], (err, trends) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      // Calculate trend direction
      const trendAnalysis = analyzeTrend(trends);
      res.json({
        trends,
        analysis: trendAnalysis
      });
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/health-parameters/alerts
 * @desc Get health parameter alerts based on thresholds
 * @access Private
 * @param {string} [req.query.patient_id] - Patient ID (required for doctors)
 * @returns {Object} List of parameter alerts
 */
router.get('/alerts', auth, async (req, res) => {
  try {
    const { patient_id } = req.query;
    const targetPatientId = req.user.role === 'patient' ? req.user.id : patient_id;

    if (!targetPatientId) {
      return res.status(400).json({ message: 'Patient ID is required for doctors' });
    }

    // Get latest readings for each parameter type
    const query = `SELECT h.*, 
                    CASE 
                      WHEN h.parameter_type = 'blood_pressure' AND 
                           CAST(SUBSTR(h.value, 1, INSTR(h.value, '/')-1) AS INTEGER) > 140 THEN 'High'
                      WHEN h.parameter_type = 'blood_pressure' AND 
                           CAST(SUBSTR(h.value, 1, INSTR(h.value, '/')-1) AS INTEGER) < 90 THEN 'Low'
                      WHEN h.parameter_type = 'heart_rate' AND CAST(h.value AS INTEGER) > 100 THEN 'High'
                      WHEN h.parameter_type = 'heart_rate' AND CAST(h.value AS INTEGER) < 60 THEN 'Low'
                      WHEN h.parameter_type = 'blood_sugar' AND CAST(h.value AS INTEGER) > 140 THEN 'High'
                      WHEN h.parameter_type = 'blood_sugar' AND CAST(h.value AS INTEGER) < 70 THEN 'Low'
                      ELSE 'Normal'
                    END as status
                  FROM health_parameters h
                  INNER JOIN (
                    SELECT parameter_type, MAX(recorded_at) as latest
                    FROM health_parameters
                    WHERE patient_id = ?
                    GROUP BY parameter_type
                  ) latest ON h.parameter_type = latest.parameter_type 
                  AND h.recorded_at = latest.latest
                  WHERE h.patient_id = ?`;

    db.all(query, [targetPatientId, targetPatientId], (err, alerts) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      // Filter only abnormal readings
      const abnormalReadings = alerts.filter(reading => reading.status !== 'Normal');
      
      res.json({
        alerts: abnormalReadings,
        total_alerts: abnormalReadings.length
      });
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/health-parameters/thresholds
 * @desc Set custom thresholds for health parameters
 * @access Private
 * @param {Object} req.body.parameter_type - Type of parameter
 * @param {Object} req.body.min_value - Minimum threshold
 * @param {Object} req.body.max_value - Maximum threshold
 * @returns {Object} Updated thresholds
 */
router.post('/thresholds',
  auth,
  [
    body('parameter_type').isIn(['blood_pressure', 'heart_rate', 'blood_sugar', 'temperature', 'weight']),
    body('min_value').isNumeric(),
    body('max_value').isNumeric()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { parameter_type, min_value, max_value } = req.body;

      // Store thresholds in a new table or update existing ones
      const sql = `INSERT OR REPLACE INTO parameter_thresholds 
                  (patient_id, parameter_type, min_value, max_value, updated_at)
                  VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`;
      
      db.run(sql, [req.user.id, parameter_type, min_value, max_value], function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error setting thresholds' });
        }

        res.json({
          message: 'Thresholds updated successfully',
          thresholds: {
            parameter_type,
            min_value,
            max_value
          }
        });
      });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Helper function to analyze trends
function analyzeTrend(trends) {
  if (trends.length < 2) {
    return {
      direction: 'insufficient_data',
      change_percentage: 0,
      recommendation: 'More data points needed for analysis'
    };
  }

  const firstValue = trends[0].average_value;
  const lastValue = trends[trends.length - 1].average_value;
  const changePercentage = ((lastValue - firstValue) / firstValue) * 100;

  let direction, recommendation;
  if (changePercentage > 5) {
    direction = 'increasing';
    recommendation = 'Consider monitoring more frequently';
  } else if (changePercentage < -5) {
    direction = 'decreasing';
    recommendation = 'Consider monitoring more frequently';
  } else {
    direction = 'stable';
    recommendation = 'Continue current monitoring schedule';
  }

  return {
    direction,
    change_percentage: changePercentage.toFixed(2),
    recommendation
  };
}

module.exports = router; 