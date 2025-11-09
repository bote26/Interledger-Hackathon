const { db } = require('../db/firebase');
const { FieldValue } = require('firebase-admin/firestore');

class Wallet {
  static collection() {
    return db.collection('wallets');
  }

  static async create(userId, walletAddressUrl = null) {
    const payload = {
      user_id: userId,
      wallet_address_url: walletAddressUrl,
      balance: 0,
      created_at: FieldValue.serverTimestamp()
    };
    const ref = this.collection().doc(userId);
    await ref.set(payload, { merge: true });
    return ref.id;
  }

  static async findByUserId(userId) {
    const doc = await this.collection().doc(userId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  static async findById(id) {
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  static async updateBalance(walletId, newBalance) {
    await this.collection().doc(walletId).set({ balance: newBalance, updated_at: FieldValue.serverTimestamp() }, { merge: true });
  }

  static async getBalance(walletId) {
    const wallet = await this.findById(walletId);
    if (!wallet || !wallet.wallet_address_url) return 0;

    try {
      // Placeholder: querying live balances may not be supported by provider.
      return wallet.balance || 0;
    } catch (err) {
      console.error('Error fetching ILP wallet balance:', err.message);
      return 0;
    }
  }
}

module.exports = Wallet;
