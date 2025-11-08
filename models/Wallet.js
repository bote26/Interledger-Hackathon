const { db } = require('../db/firebase');
const { FieldValue } = require('firebase-admin/firestore');
const { getWalletAddress } = require('../services/interledgerClient');

class Wallet {
  static collection() {
    return db.collection('wallets');
  }

  /**
   * Create a wallet document linking user to their ILP wallet address
   * @param {string} userId - Firestore user ID
   * @param {string} walletAddressUrl - Full Interledger wallet address URL
   */
  static async create(userId, walletAddressUrl) {
    const ref = this.collection().doc(userId);
    await ref.set({
      user_id: userId,
      wallet_address_url: walletAddressUrl,
      created_at: FieldValue.serverTimestamp(),
    }, { merge: true });
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

  /**
   * Get live balance from Interledger wallet address
   * @param {string} walletId - User ID (wallet document ID)
   * @returns {Promise<number>} Balance as a number
   */
  static async getBalance(walletId) {
    const wallet = await this.findById(walletId);
    if (!wallet || !wallet.wallet_address_url) return 0;

    try {
      const walletAddress = await getWalletAddress(wallet.wallet_address_url);
      // Note: Open Payments wallet addresses don't expose balance directly in the standard API.
      // You may need to query incoming/outgoing payments or maintain local balance tracking.
      // For now, returning 0 as placeholder. Adjust based on your ILP provider's capabilities.
      console.warn('Balance querying not yet implemented for ILP wallet addresses');
      return 0;
    } catch (err) {
      console.error('Error fetching ILP wallet balance:', err.message);
      return 0;
    }
  }
}

module.exports = Wallet;
