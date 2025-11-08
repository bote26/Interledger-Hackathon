const { db } = require('../db/firebase');
const { FieldValue } = require('firebase-admin/firestore');
const Wallet = require('./Wallet');
const {
  requestIncomingPaymentGrant,
  requestQuoteGrant,
  requestOutgoingPaymentGrant,
  createIncomingPayment,
  createQuote,
  createOutgoingPayment,
  continueGrant
} = require('../services/interledgerClient');
const { isFinalizedGrant } = require('@interledger/open-payments');

class Transaction {
  static collection() {
    return db.collection('transactions');
  }

  /**
   * Create a transaction using Interledger Open Payments
   * @param {string} fromWalletId - Sender's user ID
   * @param {string} toWalletId - Receiver's user ID
   * @param {number} amount - Amount to transfer
   * @param {string} description - Transaction description
   * @returns {Promise<object>} Transaction result with grant interaction URL if needed
   */
  static async create(fromWalletId, toWalletId, amount, description) {
    if (amount <= 0) throw new Error('Amount must be positive');

    const fromWallet = await Wallet.findById(fromWalletId);
    const toWallet = await Wallet.findById(toWalletId);

    if (!fromWallet || !toWallet) {
      throw new Error('Wallet not found');
    }

    if (!fromWallet.wallet_address_url || !toWallet.wallet_address_url) {
      throw new Error('Wallet addresses not configured for ILP payments');
    }

    try {
      // Step 1: Get incoming payment grant for receiver
      const incomingGrant = await requestIncomingPaymentGrant(toWallet.wallet_address_url);
      if (!isFinalizedGrant(incomingGrant)) {
        throw new Error('Failed to get incoming payment grant');
      }

      // Step 2: Create incoming payment on receiver's wallet
      const incomingPayment = await createIncomingPayment(
        toWallet.wallet_address_url,
        amount.toString(),
        incomingGrant.access_token.value
      );

      // Step 3: Get quote grant for sender
      const quoteGrant = await requestQuoteGrant(fromWallet.wallet_address_url);
      if (!isFinalizedGrant(quoteGrant)) {
        throw new Error('Failed to get quote grant');
      }

      // Step 4: Create quote
      const quote = await createQuote(
        fromWallet.wallet_address_url,
        incomingPayment.id,
        quoteGrant.access_token.value
      );

      // Step 5: Request outgoing payment grant (interactive)
      const outgoingGrant = await requestOutgoingPaymentGrant(
        fromWallet.wallet_address_url,
        quote.debitAmount
      );

      // Store pending transaction in Firestore
      const txRef = this.collection().doc();
      await txRef.set({
        from_wallet_id: fromWalletId,
        to_wallet_id: toWalletId,
        amount,
        description: description || '',
        status: 'pending_grant',
        incoming_payment_id: incomingPayment.id,
        quote_id: quote.id,
        grant_continue_uri: outgoingGrant.continue.uri,
        grant_continue_token: outgoingGrant.continue.access_token.value,
        grant_interact_url: outgoingGrant.interact.redirect,
        created_at: FieldValue.serverTimestamp(),
      });

      return {
        success: false,
        requiresInteraction: true,
        interactUrl: outgoingGrant.interact.redirect,
        transactionId: txRef.id,
        message: 'Please authorize the payment by visiting the provided URL'
      };
    } catch (err) {
      console.error('ILP transaction error:', err.message);
      throw new Error(`Payment failed: ${err.message}`);
    }
  }

  /**
   * Complete a pending transaction after grant approval
   * @param {string} transactionId - Firestore transaction document ID
   * @returns {Promise<boolean>}
   */
  static async completePendingTransaction(transactionId) {
    const txDoc = await this.collection().doc(transactionId).get();
    if (!txDoc.exists) throw new Error('Transaction not found');

    const txData = txDoc.data();
    if (txData.status !== 'pending_grant') {
      throw new Error('Transaction is not pending grant approval');
    }

    try {
      // Continue the grant
      const finalizedGrant = await continueGrant(
        txData.grant_continue_uri,
        txData.grant_continue_token
      );

      if (!isFinalizedGrant(finalizedGrant)) {
        throw new Error('Grant not approved');
      }

      // Get sender wallet
      const fromWallet = await Wallet.findById(txData.from_wallet_id);

      // Create outgoing payment
      const outgoingPayment = await createOutgoingPayment(
        fromWallet.wallet_address_url,
        txData.quote_id,
        finalizedGrant.access_token.value
      );

      // Update transaction status
      await txDoc.ref.update({
        status: 'completed',
        outgoing_payment_id: outgoingPayment.id,
        completed_at: FieldValue.serverTimestamp()
      });

      return true;
    } catch (err) {
      await txDoc.ref.update({
        status: 'failed',
        error_message: err.message
      });
      throw err;
    }
  }

  static async getByWalletId(walletId) {
    // Firestore doesn't support OR in a single query; merge two queries
    const fromSnap = await this.collection().where('from_wallet_id', '==', walletId).orderBy('created_at', 'desc').get();
    const toSnap = await this.collection().where('to_wallet_id', '==', walletId).orderBy('created_at', 'desc').get();
    const items = [];
    fromSnap.forEach(d => items.push({ id: d.id, ...d.data() }));
    toSnap.forEach(d => items.push({ id: d.id, ...d.data() }));
    // Sort by created_at desc (serverTimestamp can be null for very recent writes; place them first)
    items.sort((a, b) => {
      const at = a.created_at?.toMillis?.() || 0;
      const bt = b.created_at?.toMillis?.() || 0;
      return bt - at;
    });
    return items;
  }

  static async getAll() {
    const snap = await this.collection().orderBy('created_at', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

module.exports = Transaction;
