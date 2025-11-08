const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Wallet = require('../models/Wallet');

// Registration page
router.get('/register', (req, res) => {
  res.render('register');
});

// Handle registration
router.post('/register', (req, res) => {
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
      const parent = User.findByEmail(parent_email);
      if (!parent) {
        return res.status(400).render('register', { error: 'Parent account not found' });
      }
      if (parent.account_type !== 'father') {
        return res.status(400).render('register', { error: 'Parent must be a father account' });
      }
      parent_id = parent.id;
    }

    // Check if user already exists
    const existingUser = User.findByEmail(email);
    if (existingUser) {
      return res.status(400).render('register', { error: 'Email already registered' });
    }

    // Create user
    const userId = User.create({
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

    // Create wallet for user
    Wallet.create(userId);

    res.redirect('/auth/login?registered=true');
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
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    const user = User.findByEmail(email);
    if (!user) {
      return res.status(401).render('login', { error: 'Invalid credentials' });
    }

    if (!User.verifyPassword(password, user.password)) {
      return res.status(401).render('login', { error: 'Invalid credentials' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.accountType = user.account_type;

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).render('login', { error: 'Login failed' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

module.exports = router;
