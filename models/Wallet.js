const db = require('../db/database');

class Wallet {
  static create(userId) {
    const stmt = db.prepare(`
      INSERT INTO wallets (user_id, balance)
      VALUES (?, 100.00)
    `);
    const info = stmt.run(userId);
    return info.lastInsertRowid;
  }

  static findByUserId(userId) {
    const stmt = db.prepare('SELECT * FROM wallets WHERE user_id = ?');
    return stmt.get(userId);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM wallets WHERE id = ?');
    return stmt.get(id);
  }

  static updateBalance(walletId, newBalance) {
    const stmt = db.prepare('UPDATE wallets SET balance = ? WHERE id = ?');
    stmt.run(newBalance, walletId);
  }

  static getBalance(walletId) {
    const wallet = this.findById(walletId);
    return wallet ? wallet.balance : 0;
  }
}

module.exports = Wallet;
