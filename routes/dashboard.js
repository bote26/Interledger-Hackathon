const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/auth/login');
}

// Dashboard
router.get('/', isAuthenticated, (req, res) => {
  try {
    const user = User.findById(req.session.userId);
    const wallet = Wallet.findByUserId(user.id);
    const transactions = Transaction.getByWalletId(wallet.id);

    if (user.account_type === 'father') {
      // Get children accounts
      const children = User.getChildren(user.id);
      const childrenWithWallets = children.map(child => {
        const childWallet = Wallet.findByUserId(child.id);
        return { ...child, wallet: childWallet };
      });

      res.render('dashboard-father', {
        user,
        wallet,
        children: childrenWithWallets,
        transactions
      });
    } else {
      // Child account
      const parent = user.parent_id ? User.findById(user.parent_id) : null;
      res.render('dashboard-child', {
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

// Transfer money (for father accounts)
router.post('/transfer', isAuthenticated, (req, res) => {
  try {
    const user = User.findById(req.session.userId);

    if (user.account_type !== 'father') {
      return res.status(403).json({ error: 'Only father accounts can transfer money' });
    }

    const { from_user_id, to_user_id, amount, description } = req.body;
    const transferAmount = parseFloat(amount);

    if (transferAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    // Verify the father has access to both accounts
    const fromUser = User.findById(parseInt(from_user_id));
    const toUser = User.findById(parseInt(to_user_id));

    if (!fromUser || !toUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Father can transfer from their own account or any child account
    const canAccessFrom = fromUser.id === user.id || fromUser.parent_id === user.id;
    // Father can transfer to their own account or any child account
    const canAccessTo = toUser.id === user.id || toUser.parent_id === user.id;

    if (!canAccessFrom || !canAccessTo) {
      return res.status(403).json({ error: 'You do not have permission to perform this transfer' });
    }

    const fromWallet = Wallet.findByUserId(fromUser.id);
    const toWallet = Wallet.findByUserId(toUser.id);

    Transaction.create(fromWallet.id, toWallet.id, transferAmount, description);

    res.json({ success: true, message: 'Transfer completed successfully' });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
