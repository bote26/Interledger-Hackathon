const express = require('express');
const router = express.Router();
const User = require('../models/User');
// const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallets');
const { db } = require('../db/firebase');
const Transaction = require('../models/Transaction');



// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/auth/login');
}

// Dashboard
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).send('User not found');

    // Avoid heavy provider operations on page render. Use cached Firestore aggregation.
    const walletAddressUrl = await User.getWalletAddress(user.id);
    let wallet = { id: walletAddressUrl || null, wallet_address_url: walletAddressUrl || null, balance: 0 };
    try {
      const bal = await Transaction.getCachedBalance(user.id);
      if (bal && bal.balanceHuman) wallet.balance = parseFloat(bal.balanceHuman);
    } catch (err) {
      console.warn('Could not compute cached balance for dashboard:', err.message || err);
    }

    // Load persisted transactions for this user from Firestore for display.
    let transactions = [];
    try {
      const snap = await db.collection('transactions')
        .where('userId', '==', user.id)
        .orderBy('updatedAt', 'desc')
        .limit(50)
        .get();
      transactions = snap.docs.map(d => {
        const t = d.data();
        // Normalize fields expected by the view
        const createdAt = t.updatedAt && t.updatedAt.toDate ? t.updatedAt.toDate() : (t.updatedAt || new Date());
        const amount = t.amountRaw ? Number(t.amountRaw.toString()) : 0;
        return {
          id: d.id,
          from_wallet_id: t.raw && t.raw.fromWallet ? t.raw.fromWallet : (t.from_wallet_id || null),
          to_user_id: t.raw && t.raw.toUserId ? t.raw.toUserId : (t.to_user_id || null),
          from_user_id: t.raw && t.raw.fromUserId ? t.raw.fromUserId : (t.from_user_id || null),
          amount: amount,
          description: t.raw && t.raw.description ? t.raw.description : (t.description || ''),
          created_at: createdAt
        };
      });
    } catch (err) {
      console.error('Error loading persisted transactions for dashboard:', err);
      transactions = [];
    }

    if (user.account_type === 'father') {
      const childrenRaw = await User.getChildren(user.id);
      // Normalize childrenRaw into an array. Some implementations may return a
      // Firestore QuerySnapshot or an object; ensure we have an array to iterate.
      let children = [];
      if (Array.isArray(childrenRaw)) {
        children = childrenRaw;
      } else if (childrenRaw && Array.isArray(childrenRaw.docs)) {
        children = childrenRaw.docs.map(d => ({ id: d.id, ...d.data() }));
      } else if (childrenRaw && typeof childrenRaw === 'object') {
        // If it's an object keyed by id, convert to array
        children = Object.keys(childrenRaw).map(k => ({ id: k, ...(childrenRaw[k] || {}) }));
      }

      const childrenWithWallets = await Promise.all(children.map(async child => {
        const childWalletAddress = await User.getWalletAddress(child.id);
        const childWallet = { id: childWalletAddress || null, wallet_address_url: childWalletAddress || null, balance: 0 };
        try {
          const cb = await Transaction.getCachedBalance(child.id);
          if (cb && cb.balanceHuman) childWallet.balance = parseFloat(cb.balanceHuman);
        } catch (err) {
          console.warn('Could not compute cached balance for child', child.id, err.message || err);
        }
        return { ...child, wallet: childWallet };
      }));

      res.render('parentbank.ejs', {
        user,
        wallet,
        children: childrenWithWallets,
        transactions
      });
    } else {
      const parent = user.parent_id ? await User.findById(user.parent_id) : null;
      res.render('kidbank.ejs', {
        user,
        wallet,
        parent,
        transactions
      });
    }
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// Transfer money
router.post('/transfer', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);


    const { from_user_id, to_user_id, amount, description } = req.body;
    const transferAmount = parseFloat(amount);

    if (transferAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    const fromUser = await User.findById(from_user_id);
    const toUser = await User.findById(to_user_id);

    if (!fromUser || !toUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // // Permission checks: make sure the logged-in father can operate on these users
    // const canAccessFrom = fromUser.id === user.id || fromUser.parent_id === user.id;
    // const canAccessTo = toUser.id === user.id || toUser.parent_id === user.id;

    // if (!canAccessFrom || !canAccessTo) {
    //   return res.status(403).json({ error: 'You do not have permission to perform this transfer' });
    // }

    // Resolve wallet addresses
    const toWallet = await User.getWalletAddress(to_user_id);
    const fromWallet = await User.getWalletAddress(from_user_id);

    // Determine asset information from cached balance if available
    let assetCode = null;
    let assetScale = 0;
    try {
      const cached = await Transaction.getCachedBalance(from_user_id);
      if (cached && cached.asset) {
        assetCode = cached.asset.assetCode || null;
        assetScale = cached.asset.assetScale ?? 0;
      }
    } catch (e) {
      // ignore and fallback to defaults
    }

    // Attempt the provider payment flow. Wallet.pay now returns provider artifacts.
    let payResult = null;
    try {
      console.debug('Transfer requested', { from_user_id, to_user_id, transferAmount, assetCode, assetScale, toWallet });
      payResult = await Wallet.pay(from_user_id, toWallet, transferAmount);
      console.debug('Wallet.pay result', { payResult });
    } catch (err) {
      console.error('Provider payment failed:', err && err.message ? err.message : err);
      // If provider payment failed, we *could* fall back to recording a local transfer.
      // However the user prefers avoiding local entries when possible; return error so
      // the caller can retry or inspect logs. If you prefer a fallback, we can record
      // a local transfer here instead.
      return res.status(500).json({ error: 'Provider payment failed: ' + (err && err.message ? err.message : String(err)) });
    }

    // If provider returned payment objects (incoming/outgoing), do NOT create a local transfer
    // because provider-backed transactions will be synced into Firestore by the sync flow.
    const providerHasRecorded = payResult && (payResult.incomingPayment || payResult.outgoingPayment);
    if (!providerHasRecorded) {
      try {
        console.debug('Provider did not return payment artifacts; recording local transfer', { from_user_id, to_user_id, transferAmount, assetCode, assetScale });
        const transferResult = await Transaction.recordLocalTransfer(from_user_id, to_user_id, transferAmount, { assetCode, assetScale, description });
        console.log('Recorded local transfer (provider did not return payment):', transferResult);
      } catch (err) {
        console.warn('Failed to record local transfer in Firestore:', err && err.message ? err.message : err);
        // do not fail the request; provider didn't record a transaction and local write failed — caller can retry
      }
    } else {
      console.log('Provider created payment; skipping local record for transfer between', from_user_id, '->', to_user_id);
    }

    return res.json({ success: true, message: 'Transfer completed successfully' });
  } catch (err) {
    console.error('Transfer handler error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Transfer failed: ' + (err && err.message ? err.message : String(err)) });
  }
});

module.exports = router;

// API: fetch transactions for a user (from persisted Firestore `transactions` collection)
router.get('/api/user/:userId/transactions', isAuthenticated, async (req, res) => {
  try {
    const requester = await User.findById(req.session.userId);
    if (!requester) return res.status(401).json({ error: 'Unauthorized' });

    const userId = req.params.userId;
    console.debug('[API] transactions request by', requester.id, 'for user', userId);
    if (requester.id !== userId && requester.account_type !== 'father') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const direction = req.query.direction || 'all';
    const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 500);

    let q = db.collection('transactions').where('userId', '==', userId).orderBy('updatedAt', 'desc').limit(limit);
    if (direction === 'incoming') q = q.where('direction', '==', 'incoming');
    else if (direction === 'outgoing') q = q.where('direction', '==', 'outgoing');

    const snap = await q.get();
    const items = snap.docs.map(d => {
      const data = d.data();
      // Normalize updatedAt to an ISO string for safe JSON transport
      let updatedAt = null;
      if (data && data.updatedAt && typeof data.updatedAt.toDate === 'function') {
        try { updatedAt = data.updatedAt.toDate().toISOString(); } catch (e) { updatedAt = null; }
      } else if (data && data.updatedAt && data.updatedAt._seconds) {
        updatedAt = new Date(data.updatedAt._seconds * 1000).toISOString();
      } else if (data && data.updatedAt) {
        try { updatedAt = new Date(data.updatedAt).toISOString(); } catch (e) { updatedAt = null; }
      }
      return { id: d.id, updatedAt, ...data };
    });
    res.json({ items });
  } catch (err) {
    console.error('API transactions error:', err && err.message ? err.message : err);
    // Return detailed error in development to help debugging
    const payload = { error: err && err.message ? err.message : 'Internal error' };
    if (process.env.NODE_ENV !== 'production') payload.stack = err && err.stack ? err.stack : undefined;
    res.status(500).json(payload);
  }
});

// API: fetch balance for a user (from balances/{userId} doc, fallback to cached aggregation)
router.get('/api/user/:userId/balance', isAuthenticated, async (req, res) => {
  try {
    const requester = await User.findById(req.session.userId);
    if (!requester) return res.status(401).json({ error: 'Unauthorized' });

    const userId = req.params.userId;
    console.debug('[API] balance request by', requester.id, 'for user', userId);
    if (requester.id !== userId && requester.account_type !== 'father') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const snap = await db.collection('balances').doc(String(userId)).get();
    if (snap.exists) {
      const data = snap.data();
      // Normalize updatedAt
      if (data && data.updatedAt && typeof data.updatedAt.toDate === 'function') {
        try { data.updatedAt = data.updatedAt.toDate().toISOString(); } catch (e) { /* ignore */ }
      }
      return res.json({ balance: data });
    }

    // Fallback: compute cached aggregation from transactions
    try {
      const bal = await Transaction.getCachedBalance(userId);
      return res.json({ balance: { asset: bal.asset, balanceHuman: bal.balanceHuman, balanceAtomic: bal.balanceAtomic } });
    } catch (e) {
      return res.status(404).json({ error: 'Balance not found' });
    }
  } catch (err) {
    console.error('API balance error:', err && err.message ? err.message : err);
    const payload = { error: err && err.message ? err.message : 'Internal error' };
    if (process.env.NODE_ENV !== 'production') payload.stack = err && err.stack ? err.stack : undefined;
    res.status(500).json(payload);
  }
});

// Debug: trigger a sync for a user (protected: same user or father)
router.post('/debug/sync/:userId', isAuthenticated, async (req, res) => {
  try {
    const requester = await User.findById(req.session.userId);
    if (!requester) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.params.userId;
    if (requester.id !== userId && requester.account_type !== 'father') return res.status(403).json({ error: 'Forbidden' });

    const result = await Transaction.syncUser(userId);
    res.json({ result });
  } catch (err) {
    console.error('Debug sync error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err && err.message ? err.message : 'Internal error' });
  }
});


