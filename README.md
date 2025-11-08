# Interledger-Hackathon
Team "Los Chapulines" hackathon project

## Open Payments Application with Father/Child Account Management

A web-based open payments application built with Node.js that allows parent accounts (fathers) to manage child accounts and transfer money between wallets.

## Features

- **Two Account Types**:
  - **Father Account**: Parent account with full control over child accounts
  - **Child Account**: Managed account linked to a father account

- **Account Management**:
  - User registration with KYC (Know Your Customer) verification
  - Email-based authentication
  - Session management

- **Wallet System**:
  - Each user has a wallet with USD balance
  - Initial balance of $100 for new accounts
  - Real-time balance updates

- **Transfer Functionality**:
  - Father accounts can transfer money between any wallets they control
  - Transfer from own wallet to child wallets
  - Transfer from child wallets to own wallet
  - Transfer between child wallets
  - Transaction history tracking

- **Database**:
  - SQLite database with proper schema
  - User data storage
  - Wallet management
  - Transaction logging

- **KYC Implementation**:
  - Full name verification
  - Date of birth
  - Address
  - Phone number
  - ID number (Driver's License, Passport, etc.)
  - Auto-verification for demo purposes

## Installation

1. Clone the repository:
```bash
git clone https://github.com/bote26/Interledger-Hackathon.git
cd Interledger-Hackathon
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Edit `.env` file and set your configuration (optional):
```
PORT=3000
SESSION_SECRET=your-secret-key-change-in-production
NODE_ENV=development
```

## Usage

1. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Register a new account:
   - Choose account type (Father or Child)
   - Fill in KYC information
   - If creating a child account, provide parent's email

4. Login with your credentials

5. Use the dashboard to:
   - View your wallet balance
   - See child accounts (for father accounts)
   - Transfer money between wallets
   - View transaction history

## Project Structure

```
Interledger-Hackathon/
├── db/
│   └── database.js          # Database setup and schema
├── models/
│   ├── User.js              # User model
│   ├── Wallet.js            # Wallet model
│   └── Transaction.js       # Transaction model
├── routes/
│   ├── auth.js              # Authentication routes
│   └── dashboard.js         # Dashboard and transfer routes
├── views/
│   ├── login.ejs            # Login page
│   ├── register.ejs         # Registration page with KYC
│   ├── dashboard-father.ejs # Dashboard for father accounts
│   └── dashboard-child.ejs  # Dashboard for child accounts
├── public/
│   ├── css/
│   │   └── style.css        # Styles
│   └── js/
│       └── dashboard.js     # Frontend JavaScript
├── server.js                # Main server file
├── package.json             # Dependencies
└── README.md                # This file
```

## Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: SQLite (better-sqlite3)
- **Template Engine**: EJS
- **Authentication**: bcryptjs, express-session
- **Frontend**: HTML, CSS, JavaScript

## Security Features

- Password hashing with bcryptjs
- Session-based authentication
- SQL injection prevention with prepared statements
- CSRF protection through session validation
- Input validation

## Demo Flow

1. **Create a Father Account**:
   - Register with email: father@example.com
   - Fill in KYC details
   - Login and view dashboard

2. **Create Child Accounts**:
   - Register new accounts with account type "Child"
   - Use father@example.com as parent email
   - Login to see child dashboard

3. **Transfer Money**:
   - Login as father account
   - Use transfer form to move money between accounts
   - View updated balances and transaction history

## License

MIT

## Team

Los Chapulines
