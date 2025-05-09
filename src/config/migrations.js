/**
 * @fileoverview Database migrations for the healthcare system
 * @module config/migrations
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath);

/**
 * Initialize database tables
 */
function initializeDatabase() {
  db.serialize(() => {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('patient', 'doctor', 'admin', 'biologist')),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      specialization TEXT,
      license_number TEXT,
      emergency_contact TEXT,
      blood_type TEXT,
      allergies TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Appointments table
    db.run(`CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      appointment_date DATETIME NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('scheduled', 'completed', 'cancelled')),
      type TEXT NOT NULL CHECK(type IN ('consultation', 'follow-up', 'emergency')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Medical Records table
    db.run(`CREATE TABLE IF NOT EXISTS medical_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      diagnosis TEXT NOT NULL,
      prescription TEXT,
      symptoms TEXT,
      notes TEXT,
      follow_up_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Test Results table
    db.run(`CREATE TABLE IF NOT EXISTS test_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      biologist_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      test_type TEXT NOT NULL,
      result TEXT NOT NULL,
      reference_range TEXT,
      notes TEXT,
      test_date DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (biologist_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Messages table
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Medications table
    db.run(`CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Health Parameters table
    db.run(`CREATE TABLE IF NOT EXISTS health_parameters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      parameter_type TEXT NOT NULL CHECK(parameter_type IN ('blood_pressure', 'heart_rate', 'blood_sugar', 'temperature', 'weight')),
      value TEXT NOT NULL,
      unit TEXT NOT NULL,
      recorded_at DATETIME NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Emergency Contacts table
    db.run(`CREATE TABLE IF NOT EXISTS emergency_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      relationship TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      is_primary BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Notifications table
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('appointment', 'medication', 'test_result', 'message', 'system')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Create parameter thresholds table
    db.run(`CREATE TABLE IF NOT EXISTS parameter_thresholds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      parameter_type TEXT NOT NULL,
      min_value REAL NOT NULL,
      max_value REAL NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(patient_id, parameter_type)
    )`);

    // Create index for parameter thresholds
    db.run(`CREATE INDEX IF NOT EXISTS idx_parameter_thresholds_patient 
            ON parameter_thresholds(patient_id, parameter_type)`);

    // Create indexes for better query performance
    db.run('CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records(patient_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_test_results_patient ON test_results(patient_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_medications_patient ON medications(patient_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_health_parameters_patient ON health_parameters(patient_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)');
  });
}

// Initialize database
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, table) => {
  if (err) {
    console.error('Error checking database:', err);
  } else if (!table) {
    console.log('Initializing database...');
    initializeDatabase();
  } else {
    console.log('Database already initialized');
  }
});

module.exports = db; 