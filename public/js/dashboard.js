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
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).send('User not found');
    // Ensure we always pass a wallet object with a numeric balance to the views
    let wallet = await Wallet.findByUserId(user.id);
    if (!wallet) {
      wallet = { id: null, wallet_address_url: null, balance: 0 };
    } else {
      const bal = await Wallet.getBalance(wallet.id);
      wallet.balance = typeof bal === 'number' ? bal : 0;
    }

    const transactions = wallet.id ? await Transaction.getByWalletId(wallet.id) : [];

    if (response.ok) {
      showMessage('Transfer successful! Reloading...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      const parent = user.parent_id ? await User.findById(user.parent_id) : null;
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

function showMessage(message, type) {
  const messageDiv = document.getElementById('transfer-message');
  messageDiv.textContent = message;
  messageDiv.className = type;
  messageDiv.style.display = 'block';

  if (type === 'success') {
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
  }
});

// Helper function to format dates
function formatDate(date) {
  const now = new Date();
  const txDate = new Date(date);
  const diffTime = Math.abs(now - txDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return txDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ========================================
// 🎯 API ENDPOINTS para KidBank
// ========================================

// Complete a task
router.post('/api/complete-task', isAuthenticated, async (req, res) => {
  try {
    const { taskId } = req.body;
    const user = await User.findById(req.session.userId);
    
    // TODO: Implement task completion logic
    // 1. Mark task as completed in database
    // 2. Add reward to user's wallet
    // 3. Add stars to user
    
    // Placeholder response
    res.json({
      success: true,
      message: 'Task completed!',
      earnedMoney: 5,
      earnedStars: 10
    });
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add money to account
router.post('/api/add-money', isAuthenticated, async (req, res) => {
  try {
    const { amount } = req.body;
    const transferAmount = parseFloat(amount);
    
    if (transferAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }
    
    const user = await User.findById(req.session.userId);
    
    // TODO: Implement add money logic
    // This might involve creating a transaction from parent to child
    // or recording an external deposit
    
    res.json({
      success: true,
      message: `Added $${transferAmount} successfully!`,
      newBalance: 0 // TODO: return actual new balance
    });
  } catch (error) {
    console.error('Add money error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// RUTAS ORIGINALES (sin cambios)
// ========================================

// Transfer money (for father accounts)
router.post('/transfer', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    if (user.account_type !== 'father') {
      return res.status(403).json({ error: 'Only father accounts can transfer money' });
    }

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

    const canAccessFrom = fromUser.id === user.id || fromUser.parent_id === user.id;
    const canAccessTo = toUser.id === user.id || toUser.parent_id === user.id;

    if (!canAccessFrom || !canAccessTo) {
      return res.status(403).json({ error: 'You do not have permission to perform this transfer' });
    }

    // Create ILP transaction (returns interactive grant URL if needed)
    const result = await Transaction.create(fromUser.id, toUser.id, transferAmount, description);

    if (result.requiresInteraction) {
      return res.json({ 
        success: false,
        requiresInteraction: true,
        interactUrl: result.interactUrl,
        transactionId: result.transactionId,
        message: result.message
      });
    }

    res.json({ success: true, message: 'Transfer completed successfully' });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete pending transaction after grant approval
router.post('/complete-transfer/:transactionId', isAuthenticated, async (req, res) => {
  try {
    const { transactionId } = req.params;
    await Transaction.completePendingTransaction(transactionId);
    res.json({ success: true, message: 'Transfer completed successfully' });
  } catch (error) {
    console.error('Complete transfer error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
