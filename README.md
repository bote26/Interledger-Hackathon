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
APP_BASE_URL=http://localhost:3000
EMAIL_SERVICE=Gmail
EMAIL_USER=your.email@example.com
EMAIL_PASS=your-app-password
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase_conn.json
ILP_PRIVATE_KEY_PATH=./private.key
ILP_KEY_ID=your-key-id-from-wallet-provider
ILP_WALLET_ADDRESS_URL=https://ilp.interledger-test.dev/your_wallet
ILP_BASE_WALLET_URL=https://ilp.interledger-test.dev
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
- **Database**: Firebase Firestore (via firebase-admin)
- **Template Engine**: EJS
- **Authentication**: bcryptjs, express-session
- **Frontend**: HTML, CSS, JavaScript

## Security Features

- Password hashing with bcryptjs
- Session-based authentication
- SQL injection prevention with prepared statements
- Input validation

**Note**: This is a demo application. See [SECURITY.md](SECURITY.md) for production security requirements including rate limiting, HTTPS/SSL, and CSRF protection.

### Firebase Setup

1. Create a Firebase project and a service account with Firestore access.
2. Download the service account JSON to the project root as `firebase_conn.json` (or set `FIREBASE_SERVICE_ACCOUNT_PATH` to its location).
3. Ensure Firestore is in Native/GA mode and security rules allow your server access via Admin SDK.

### Email Setup

Set `EMAIL_USER` and `EMAIL_PASS` (e.g., Gmail App Password) and optionally `EMAIL_SERVICE`. The app sends a verification email on registration and requires email verification to log in.

### Interledger Open Payments Setup

This application uses the Interledger Protocol for real payments between wallet addresses.

**Prerequisites:**
1. Create wallet addresses on an Interledger test network (e.g., https://ilp.interledger-test.dev/)
2. Generate an authentication key pair for your wallet:
   ```bash
   openssl genrsa -out private.key 4096
   openssl rsa -in private.key -pubout -out public.key
   ```
3. Register the public key with your wallet provider and obtain a Key ID.

**Configuration:**
- `ILP_PRIVATE_KEY_PATH`: Path to your private key file (default: `./private.key`)
- `ILP_KEY_ID`: The key ID provided by your wallet provider
- `ILP_WALLET_ADDRESS_URL`: Your main wallet address URL (e.g., `https://ilp.interledger-test.dev/alice`)
- `ILP_BASE_WALLET_URL`: Base URL for auto-generating user wallet addresses (optional)

**Payment Flow:**
1. When a father account initiates a transfer, the system creates an Interledger payment using the Open Payments API.
2. The user must approve the outgoing payment grant by clicking the authorization link.
3. After approval, the payment is completed automatically.

**Note:** For testing, use the Interledger test network. For production, register with a production-grade wallet provider.

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
