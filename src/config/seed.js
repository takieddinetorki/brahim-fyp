/**
 * @fileoverview Seed data for the healthcare system
 * @module config/seed
 */

const bcrypt = require('bcryptjs');
const db = require('./database');

/**
 * Initialize seed data
 */
function seedDatabase() {
  return new Promise(async (resolve, reject) => {
    try {
      // Create test users first and store their IDs
      const users = [
        {
          email: 'admin@healthcare.com',
          password: await bcrypt.hash('admin123', 10),
          role: 'admin',
          first_name: 'Admin',
          last_name: 'User',
          phone: '+1234567890'
        },
        {
          email: 'doctor1@healthcare.com',
          password: await bcrypt.hash('doctor123', 10),
          role: 'doctor',
          first_name: 'John',
          last_name: 'Smith',
          phone: '+1234567891',
          specialization: 'Cardiology',
          license_number: 'DOC123456'
        },
        {
          email: 'doctor2@healthcare.com',
          password: await bcrypt.hash('doctor123', 10),
          role: 'doctor',
          first_name: 'Sarah',
          last_name: 'Johnson',
          phone: '+1234567892',
          specialization: 'Pediatrics',
          license_number: 'DOC789012'
        },
        {
          email: 'biologist1@healthcare.com',
          password: await bcrypt.hash('biologist123', 10),
          role: 'biologist',
          first_name: 'Michael',
          last_name: 'Brown',
          phone: '+1234567893',
          specialization: 'Clinical Laboratory',
          license_number: 'BIO123456'
        },
        {
          email: 'patient1@healthcare.com',
          password: await bcrypt.hash('patient123', 10),
          role: 'patient',
          first_name: 'Alice',
          last_name: 'Wilson',
          phone: '+1234567894',
          blood_type: 'A+',
          allergies: 'Penicillin'
        },
        {
          email: 'patient2@healthcare.com',
          password: await bcrypt.hash('patient123', 10),
          role: 'patient',
          first_name: 'Robert',
          last_name: 'Davis',
          phone: '+1234567895',
          blood_type: 'O-',
          allergies: 'None'
        }
      ];

      // Insert users one by one and store their IDs
      const userIds = {};
      for (const user of users) {
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO users (email, password, role, first_name, last_name, phone, 
              specialization, license_number, blood_type, allergies) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [user.email, user.password, user.role, user.first_name, user.last_name, user.phone,
             user.specialization, user.license_number, user.blood_type, user.allergies],
            function(err) {
              if (err) reject(err);
              else {
                userIds[user.email] = this.lastID;
                resolve();
              }
            }
          );
        });
      }

      // Create test appointments
      const appointments = [
        {
          patient_id: userIds['patient1@healthcare.com'],
          doctor_id: userIds['doctor1@healthcare.com'],
          appointment_date: new Date(Date.now() + 86400000).toISOString(),
          status: 'scheduled',
          type: 'consultation',
          notes: 'Regular checkup'
        },
        {
          patient_id: userIds['patient2@healthcare.com'],
          doctor_id: userIds['doctor2@healthcare.com'],
          appointment_date: new Date(Date.now() + 172800000).toISOString(),
          status: 'scheduled',
          type: 'follow-up',
          notes: 'Follow-up after treatment'
        }
      ];

      // Insert appointments
      for (const appointment of appointments) {
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO appointments (patient_id, doctor_id, appointment_date, status, type, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [appointment.patient_id, appointment.doctor_id, appointment.appointment_date,
             appointment.status, appointment.type, appointment.notes],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Create test health parameters
      const healthParameters = [
        {
          patient_id: userIds['patient1@healthcare.com'],
          parameter_type: 'blood_pressure',
          value: '120/80',
          unit: 'mmHg',
          notes: 'Normal reading',
          recorded_at: new Date().toISOString()
        },
        {
          patient_id: userIds['patient1@healthcare.com'],
          parameter_type: 'heart_rate',
          value: '72',
          unit: 'bpm',
          notes: 'Resting heart rate',
          recorded_at: new Date().toISOString()
        },
        {
          patient_id: userIds['patient2@healthcare.com'],
          parameter_type: 'blood_sugar',
          value: '95',
          unit: 'mg/dL',
          notes: 'Fasting glucose',
          recorded_at: new Date().toISOString()
        }
      ];

      // Insert health parameters
      for (const param of healthParameters) {
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO health_parameters (patient_id, parameter_type, value, unit, notes, recorded_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [param.patient_id, param.parameter_type, param.value, param.unit, param.notes, param.recorded_at],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Create test notifications
      const notifications = [
        {
          user_id: userIds['patient1@healthcare.com'],
          type: 'appointment',
          title: 'Upcoming Appointment',
          content: 'You have an appointment with Dr. Smith tomorrow at 10:00 AM'
        },
        {
          user_id: userIds['patient2@healthcare.com'],
          type: 'medication',
          title: 'Medication Reminder',
          content: 'Time to take your prescribed medication'
        }
      ];

      // Insert notifications
      for (const notification of notifications) {
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO notifications (user_id, type, title, content)
             VALUES (?, ?, ?, ?)`,
            [notification.user_id, notification.type, notification.title, notification.content],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Create test medical records
      const medicalRecords = [
        {
          patient_id: userIds['patient1@healthcare.com'],
          doctor_id: userIds['doctor1@healthcare.com'],
          diagnosis: 'Hypertension',
          prescription: 'Lisinopril 10mg daily',
          symptoms: 'High blood pressure, occasional headaches',
          notes: 'Monitor blood pressure regularly'
        },
        {
          patient_id: userIds['patient2@healthcare.com'],
          doctor_id: userIds['doctor2@healthcare.com'],
          diagnosis: 'Type 2 Diabetes',
          prescription: 'Metformin 500mg twice daily',
          symptoms: 'Increased thirst, frequent urination',
          notes: 'Follow up in 3 months'
        }
      ];

      // Insert medical records
      for (const record of medicalRecords) {
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO medical_records (patient_id, doctor_id, diagnosis, prescription, symptoms, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [record.patient_id, record.doctor_id, record.diagnosis, record.prescription,
             record.symptoms, record.notes],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      console.log('Seed data inserted successfully');
      resolve();
    } catch (err) {
      console.error('Error seeding database:', err);
      reject(err);
    }
  });
}

// Run seed if database is empty
db.get("SELECT COUNT(*) as count FROM users", (err, result) => {
  if (err) {
    console.error('Error checking database:', err);
  } else if (result.count === 0) {
    console.log('Seeding database...');
    seedDatabase().catch(err => console.error('Error during seeding:', err));
  } else {
    console.log('Database already contains data');
  }
});

module.exports = seedDatabase; 