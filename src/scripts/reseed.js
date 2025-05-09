/**
 * @fileoverview Script to reseed the database
 * @module scripts/reseed
 */

const seedDatabase = require('../config/seed');
const db = require('../config/database');

// Clear existing data
function clearDatabase() {
  return new Promise((resolve, reject) => {
    // Disable foreign keys temporarily
    db.run('PRAGMA foreign_keys = OFF', (err) => {
      if (err) return reject(err);
      
      // Get all tables
      db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, tables) => {
        if (err) return reject(err);
        
        // Delete all data from each table
        const deletePromises = tables.map(table => {
          return new Promise((resolve, reject) => {
            db.run(`DELETE FROM ${table.name}`, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        });
        
        Promise.all(deletePromises)
          .then(() => {
            // Reset autoincrement counters
            db.run('DELETE FROM sqlite_sequence', (err) => {
              if (err) return reject(err);
              
              // Re-enable foreign keys
              db.run('PRAGMA foreign_keys = ON', (err) => {
                if (err) reject(err);
                else {
                  console.log('Database cleared successfully');
                  resolve();
                }
              });
            });
          })
          .catch(reject);
      });
    });
  });
}

// Main function
async function reseed() {
  try {
    console.log('Clearing existing data...');
    await clearDatabase();
    
    console.log('Seeding new data...');
    await seedDatabase();
    
    console.log('Database reseeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error reseeding database:', err);
    process.exit(1);
  }
}

// Run the reseed
reseed(); 