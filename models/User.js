const db = require('../db/database');
const bcrypt = require('bcryptjs');

class User {
  static create(userData) {
    const hashedPassword = bcrypt.hashSync(userData.password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (email, password, account_type, parent_id, full_name, date_of_birth, address, phone, id_number, kyc_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      userData.email,
      hashedPassword,
      userData.account_type,
      userData.parent_id || null,
      userData.full_name,
      userData.date_of_birth,
      userData.address,
      userData.phone,
      userData.id_number,
      1 // Auto-verify KYC for demo purposes
    );
    
    return info.lastInsertRowid;
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  }

  static findByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  }

  static verifyPassword(password, hashedPassword) {
    return bcrypt.compareSync(password, hashedPassword);
  }

  static getChildren(parentId) {
    const stmt = db.prepare('SELECT * FROM users WHERE parent_id = ?');
    return stmt.all(parentId);
  }

  static getAllFathers() {
    const stmt = db.prepare("SELECT * FROM users WHERE account_type = 'father'");
    return stmt.all();
  }
}

module.exports = User;
