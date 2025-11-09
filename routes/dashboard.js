const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const WalletTest = require('../models/wallet_test');
const WalletModel = require('../models/Wallet');
const ILP = require('../services/interledgerClient');

function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/auth/login');
}

// RUTA 1: Dashboard original
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).send('User not found');
    
    let wallet = await Wallet.findByUserId(user.id);
    if (!wallet) {
      wallet = { id: null, wallet_address_url: null, balance: 0 };
    } else {
      const bal = await Wallet.getBalance(wallet.id);
      wallet.balance = typeof bal === 'number' ? bal : 0;
    }

    // Get all transactions for this wallet
    const transactions = wallet.id ? await Transaction.getByWalletId(wallet.id) : [];
    
    // Format transactions for display
    const formattedTransactions = transactions.map(t => ({
      name: t.description || 'Transaction',
      date: new Date(t.timestamp).toLocaleDateString(),
      amount: t.amount.toFixed(2),
      type: t.to_user_id === user.id ? 'received' : 'sent',
      icon: t.to_user_id === user.id ? '🪙' : '💸',
      iconBg: t.to_user_id === user.id ? '#22c55e' : '#ea580c'
    }));

    if (user.account_type === 'father') {
      const children = await User.getChildren(user.id);
      const childrenWithWallets = await Promise.all(children.map(async child => {
        let childWallet = await Wallet.findByUserId(child.id);
        if (!childWallet) {
          childWallet = { id: null, wallet_address_url: null, balance: 0 };
        } else {
          const cb = await Wallet.getBalance(childWallet.id);
          childWallet.balance = typeof cb === 'number' ? cb : 0;
        }
        return { ...child, wallet: childWallet };
      }));

      res.render('dashboard-father', {
        user,
        wallet,
        children: childrenWithWallets,
        transactions
      });
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

// RUTA 2: KIDBANK - NUEVA
router.get('/kidbank', isAuthenticated, async (req, res) => {
  try {
    console.log('✅ KidBank route hit!'); // DEBUG
    
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).send('User not found');

    // Only allow children to access KidBank
    if (user.account_type !== 'child') {
      return res.redirect('/dashboard');
    }

    let wallet = await Wallet.findByUserId(user.id);
    if (!wallet) {
      wallet = { id: null, wallet_address_url: null, balance: 0 };
    } else {
      const bal = await Wallet.getBalance(wallet.id);
      wallet.balance = typeof bal === 'number' ? bal : 0;
    }

    const allTransactions = wallet.id ? await Transaction.getByWalletId(wallet.id) : [];
    
    // Prepare example data for the dashboard
    const mockData = {
      userName: user.full_name || user.name || 'User',
      userStars: 245,
      userBalance: wallet.balance || 0,
      monthGain: 23.50,
      transactions: [
        {
          name: "Weekly Allowance",
          date: "Today",
          amount: "10.00",
          type: "received",
          icon: "🪙",
          iconBg: "#22c55e"
        }
      ],
      savingsGoals: [
        {
          name: "New Video Game",
          icon: "🎮",
          color: "linear-gradient(135deg, #3b82f6, #06b6d4)",
          saved: 45,
          target: 60
        }
      ],
      tasks: [
        {
          id: "task-1",
          name: "Clean my room",
          icon: "🏠",
          color: "linear-gradient(135deg, #fbbf24, #f59e0b)",
          reward: 5,
          stars: 10,
          completed: false
        }
      ],
      investmentBalance: 85.75,
      investmentEarnings: 5.75,
      gameLevel: 12,
      totalCoins: 1250,
      achievementsUnlocked: 8,
      dayStreak: 5
    };

    // Render the dashboard with the mock data
    res.render('kidbank-dashboard', mockData);
  } catch (error) {
    console.error('KidBank error:', error);
    res.status(500).send('Error loading KidBank: ' + error.message);
  }
});

// RUTA 3: Transfer (original)
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
    const toWallet = await User.getWalletAddress(to_user_id);

    const fromWallet = await User.getWalletAddress(from_user_id);
    console.log(`Transferring ${transferAmount} from ${fromWallet} to ${toWallet}`);
    console.log(await User.getIlpPrivateKeyPath(from_user_id));

    await WalletTest.pay(from_user_id, 'https://ilp.interledger-test.dev/alice_chapulines', transferAmount);

    const canAccessFrom = fromUser.id === user.id || fromUser.parent_id === user.id;
    const canAccessTo = toUser.id === user.id || toUser.parent_id === user.id;

    if (!canAccessFrom || !canAccessTo) {
      return res.status(403).json({ error: 'You do not have permission to perform this transfer' });
    }

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


module.exports = router;

