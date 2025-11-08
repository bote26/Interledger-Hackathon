const express = require('express');
const router = express.Router();
const User = require('../models/User');

let Wallet;
try { Wallet = require('../models/Wallet'); } catch (e) { console.warn('Wallet model unavailable', e.message); }
const { sendVerificationEmail, generateEmailVerificationToken } = require('../services/sendVerificationEmail');


router.get('/register', (req, res) => {
  res.render('register');
});

// Handle registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, account_type, parent_email, full_name, date_of_birth, address, phone, id_number } = req.body;

    // Validate required fields
    if (!email || !password || !account_type || !full_name || !date_of_birth || !address || !phone || !id_number) {
      return res.status(400).render('register', { error: 'All fields are required for KYC verification' });
    }

    // If child account, verify parent exists
    let parent_id = null;
    if (account_type === 'child') {
      if (!parent_email) {
        return res.status(400).render('register', { error: 'Parent email is required for child accounts' });
      }
      const parent = await User.findByEmail(parent_email);
      if (!parent) {
        return res.status(400).render('register', { error: 'Parent account not found' });
      }
      if (parent.account_type !== 'father') {
        return res.status(400).render('register', { error: 'Parent must be a father account' });
      }
      parent_id = parent.id;
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).render('register', { error: 'Email already registered' });
    }

    // Create user
    const userId = await User.create({
      email,
      password,
      account_type,
      parent_id,
      full_name,
      date_of_birth,
      address,
      phone,
      id_number
    });

    // Generate email verification token & save
    const { token, expires } = generateEmailVerificationToken();
    await User.setEmailVerification(userId, token, expires);

    // Fire off email (non-blocking but awaited here for simplicity)
    await sendVerificationEmail({ id: userId, email }, token);

    // Create wallet entry (user must configure wallet_address_url separately)
    // For demo: you can auto-generate wallet addresses or require manual setup
    if (Wallet && Wallet.create) {
      try {
        // Placeholder: In production, integrate with your ILP provider to create/assign wallet addresses
        const walletAddressUrl = process.env.ILP_BASE_WALLET_URL 
          ? `${process.env.ILP_BASE_WALLET_URL}/${userId}`
          : null;
        
        if (walletAddressUrl) {
          await Wallet.create(userId, walletAddressUrl);
          await User.setWalletAddress(userId, walletAddressUrl);
        } else {
          console.warn('ILP_BASE_WALLET_URL not set; wallet address not created');
        }
      } catch (walletErr) {
        console.warn('Wallet creation warning:', walletErr.message);
      }
    }

    res.redirect('/auth/login?registered=true&verifyPending=true');
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).render('register', { error: 'Registration failed: ' + error.message });
  }
});

// Login page
router.get('/login', (req, res) => {
  const registered = req.query.registered === 'true';
  res.render('login', { registered });
});

// Handle login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).render('login', { error: 'Invalid credentials' });
    }

    if (!User.verifyPassword(password, user.password)) {
      return res.status(401).render('login', { error: 'Invalid credentials' });
    }

    if (!user.email_verified) {
      return res.status(403).render('login', { error: 'Email not verified. Please check your inbox.' });
    }

    req.session.userId = user.id;
    req.session.accountType = user.account_type;

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).render('login', { error: 'Login failed' });
  }
});

// Email verification endpoint
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token');
  try {
    const result = await User.verifyEmailByToken(token);
    if (!result.success) {
      if (result.reason === 'expired') return res.status(400).send('Verification link expired. Please register again.');
      return res.status(400).send('Invalid verification token.');
    }
    res.send('Email verified! You can now log in.');
  } catch (err) {
    console.error('Verify email error:', err.message);
    res.status(500).send('Verification failed');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

module.exports = router;
