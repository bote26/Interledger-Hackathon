const db = require('../db/database');
const Wallet = require('./Wallet');

class Transaction {
  static create(fromWalletId, toWalletId, amount, description) {
    // Start transaction
    const transfer = db.transaction(() => {
      // Get current balances
      const fromWallet = Wallet.findById(fromWalletId);
      const toWallet = Wallet.findById(toWalletId);

      if (!fromWallet || !toWallet) {
        throw new Error('Wallet not found');
      }

      if (fromWallet.balance < amount) {
        throw new Error('Insufficient funds');
      }

      // Update balances
      Wallet.updateBalance(fromWalletId, fromWallet.balance - amount);
      Wallet.updateBalance(toWalletId, toWallet.balance + amount);

      // Record transaction
      const stmt = db.prepare(`
        INSERT INTO transactions (from_wallet_id, to_wallet_id, amount, description)
        VALUES (?, ?, ?, ?)
      `);
      const info = stmt.run(fromWalletId, toWalletId, amount, description || '');
      return info.lastInsertRowid;
    });

    return transfer();
  }

  static getByWalletId(walletId) {
    const stmt = db.prepare(`
      SELECT t.*, 
             fw.user_id as from_user_id,
             tw.user_id as to_user_id
      FROM transactions t
      JOIN wallets fw ON t.from_wallet_id = fw.id
      JOIN wallets tw ON t.to_wallet_id = tw.id
      WHERE t.from_wallet_id = ? OR t.to_wallet_id = ?
      ORDER BY t.created_at DESC
    `);
    return stmt.all(walletId, walletId);
  }

  static getAll() {
    const stmt = db.prepare(`
      SELECT t.*,
             fw.user_id as from_user_id,
             tw.user_id as to_user_id
      FROM transactions t
      JOIN wallets fw ON t.from_wallet_id = fw.id
      JOIN wallets tw ON t.to_wallet_id = tw.id
      ORDER BY t.created_at DESC
    `);
    return stmt.all();
  }
}

module.exports = Transaction;
