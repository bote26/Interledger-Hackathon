const { createAuthenticatedClient } = require('@interledger/open-payments');
const path = require('path');

let clientInstance = null;

/**
 * Get or create authenticated Interledger Open Payments client
 * @returns {Promise<import('@interledger/open-payments').AuthenticatedClient>}
 */
async function getInterledgerClient() {
  if (clientInstance) return clientInstance;

  const privateKeyPath = process.env.ILP_PRIVATE_KEY_PATH || path.join(__dirname, '..', 'private.key');
  const keyId = process.env.ILP_KEY_ID;
  const walletAddressUrl = process.env.ILP_WALLET_ADDRESS_URL;

  if (!keyId || !walletAddressUrl) {
    throw new Error('ILP_KEY_ID and ILP_WALLET_ADDRESS_URL must be set in environment variables');
  }

  clientInstance = await createAuthenticatedClient({
    walletAddressUrl,
    keyId,
    privateKey: privateKeyPath
  });

  return clientInstance;
}

/**
 * Get wallet address details
 * @param {string} walletAddressUrl - Full URL of the wallet address
 * @returns {Promise<object>}
 */
async function getWalletAddress(walletAddressUrl) {
  const client = await getInterledgerClient();
  return await client.walletAddress.get({ url: walletAddressUrl });
}

/**
 * Create an incoming payment for a wallet address
 * @param {string} walletAddressUrl - URL of the receiving wallet
 * @param {string} amount - Amount to receive (as string)
 * @param {string} accessToken - Grant access token
 * @returns {Promise<object>}
 */
async function createIncomingPayment(walletAddressUrl, amount, accessToken) {
  const client = await getInterledgerClient();
  const walletAddress = await getWalletAddress(walletAddressUrl);

  return await client.incomingPayment.create(
    {
      url: walletAddress.resourceServer,
      accessToken
    },
    {
      walletAddress: walletAddress.id,
      incomingAmount: {
        assetCode: walletAddress.assetCode,
        assetScale: walletAddress.assetScale,
        value: amount
      }
    }
  );
}

/**
 * Create a quote for a payment
 * @param {string} sendingWalletUrl - Sending wallet address URL
 * @param {string} receiverPaymentPointer - Incoming payment ID or wallet address
 * @param {string} accessToken - Quote grant access token
 * @returns {Promise<object>}
 */
async function createQuote(sendingWalletUrl, receiverPaymentPointer, accessToken) {
  const client = await getInterledgerClient();
  const walletAddress = await getWalletAddress(sendingWalletUrl);

  return await client.quote.create(
    {
      url: walletAddress.resourceServer,
      accessToken
    },
    {
      walletAddress: walletAddress.id,
      receiver: receiverPaymentPointer,
      method: 'ilp'
    }
  );
}

/**
 * Request a grant for incoming payments
 * @param {string} walletAddressUrl
 * @returns {Promise<object>}
 */
async function requestIncomingPaymentGrant(walletAddressUrl) {
  const client = await getInterledgerClient();
  const walletAddress = await getWalletAddress(walletAddressUrl);

  return await client.grant.request(
    { url: walletAddress.authServer },
    {
      access_token: {
        access: [
          {
            type: 'incoming-payment',
            actions: ['read', 'complete', 'create']
          }
        ]
      }
    }
  );
}

/**
 * Request a grant for quotes
 * @param {string} walletAddressUrl
 * @returns {Promise<object>}
 */
async function requestQuoteGrant(walletAddressUrl) {
  const client = await getInterledgerClient();
  const walletAddress = await getWalletAddress(walletAddressUrl);

  return await client.grant.request(
    { url: walletAddress.authServer },
    {
      access_token: {
        access: [
          {
            type: 'quote',
            actions: ['create', 'read']
          }
        ]
      }
    }
  );
}

/**
 * Request outgoing payment grant (interactive)
 * @param {string} walletAddressUrl
 * @param {object} debitAmount - {assetCode, assetScale, value}
 * @returns {Promise<object>}
 */
async function requestOutgoingPaymentGrant(walletAddressUrl, debitAmount) {
  const client = await getInterledgerClient();
  const walletAddress = await getWalletAddress(walletAddressUrl);

  return await client.grant.request(
    { url: walletAddress.authServer },
    {
      access_token: {
        access: [
          {
            type: 'outgoing-payment',
            actions: ['read', 'create'],
            limits: { debitAmount },
            identifier: walletAddress.id
          }
        ]
      },
      interact: {
        start: ['redirect']
      }
    }
  );
}

/**
 * Continue an interactive grant
 * @param {string} continueUri
 * @param {string} continueAccessToken
 * @returns {Promise<object>}
 */
async function continueGrant(continueUri, continueAccessToken) {
  const client = await getInterledgerClient();
  return await client.grant.continue({
    url: continueUri,
    accessToken: continueAccessToken
  });
}

/**
 * Create an outgoing payment
 * @param {string} sendingWalletUrl
 * @param {string} quoteId
 * @param {string} accessToken
 * @returns {Promise<object>}
 */
async function createOutgoingPayment(sendingWalletUrl, quoteId, accessToken) {
  const client = await getInterledgerClient();
  const walletAddress = await getWalletAddress(sendingWalletUrl);

  return await client.outgoingPayment.create(
    {
      url: walletAddress.resourceServer,
      accessToken
    },
    {
      walletAddress: walletAddress.id,
      quoteId
    }
  );
}

module.exports = {
  getInterledgerClient,
  getWalletAddress,
  createIncomingPayment,
  createQuote,
  requestIncomingPaymentGrant,
  requestQuoteGrant,
  requestOutgoingPaymentGrant,
  continueGrant,
  createOutgoingPayment
};
