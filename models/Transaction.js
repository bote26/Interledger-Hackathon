/**
 * Script COMPLETO para consultar TODAS las transacciones (recibidas y enviadas)
 * Incluye flujo interactivo para outgoing payments
 */

const { isFinalizedGrant, isPendingGrant, OpenPaymentsClientError } = require('@interledger/open-payments');
const User = require('./User');
const Wallet = require('./Wallets');
const readline = require('readline/promises');
const { exec } = require('child_process');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const user_id = 'JiHVS1HuhMO2F79vyN5V'

// ═══════════════════════════════════════════════════════════

class Transaction {
  
  static async get_incomingPayments(userId) {
    const client = await Wallet.create(userId);

    // Resolve user wallet/key getters (they're async) so we don't pass Promises
    const WALLET_ADDRESS_URL = await User.getWalletAddress(userId);

    const walletAddress = await client.walletAddress.get({ url: WALLET_ADDRESS_URL })

    const incomingGrant = await client.grant.request(
      { url: walletAddress.authServer },
      {
        access_token: {
          access: [{
            type: 'incoming-payment',
            actions: ['list', 'read', 'read-all']
          }]
        }
      }
    )

    if (!isFinalizedGrant(incomingGrant)) {
      throw new Error('Grant para incoming payments no finalizado')
    }

    const incomingPayments = await client.incomingPayment.list({
      url: walletAddress.resourceServer,
      accessToken: incomingGrant.access_token.value,
      walletAddress: walletAddress.id
    })

    let totalRecibido = 0

    if (!incomingPayments || !Array.isArray(incomingPayments.result) || incomingPayments.result.length === 0) {
      // Return an empty consistent shape when there are no incoming payments
      return { list: [], totalRecibido: 0 };
    } else {

      const list = incomingPayments.result.map((pago, index) => {
        totalRecibido += parseFloat(pago.receivedAmount.value)

        return {
          index: index + 1,
          status: pago.completed ? 'Completed' : 'Pending',
          amount: parseFloat(pago.receivedAmount.value) / Math.pow(10, pago.receivedAmount.assetScale),
          assetCode: pago.receivedAmount.assetCode,
          description: pago.metadata?.description,
          date: new Date(pago.createdAt).toLocaleString()
        }
      })

      return { list, totalRecibido };
    }
  }

  static async get_outgoingPayments(userId) {
    const client = await Wallet.create(userId);

    // Resolve user wallet/key getters (they're async) so we don't pass Promises
    const WALLET_ADDRESS_URL = await User.getWalletAddress(userId);

    const walletAddress = await client.walletAddress.get({ url: WALLET_ADDRESS_URL })

    const outgoingGrantRequest = await client.grant.request(
      { url: walletAddress.authServer },
      {
        access_token: {
          access: [{
            type: 'outgoing-payment',
            actions: ['list', 'list-all', 'read', 'read-all'],
            identifier: walletAddress.id
          }]
        },
        interact: {
          start: ['redirect']
        }
      }
    )

  
    if (!isPendingGrant(outgoingGrantRequest)) {
      throw new Error('Se esperaba un grant pendiente para outgoing payments')
    }
    // open the interact URL in the default browser (acts like a popup)
    const url = outgoingGrantRequest.interact.redirect;

    const cmd =
        process.platform === 'win32'
            ? `start "" "${url}"`
            : process.platform === 'darwin'
            ? `open "${url}"`
            : `xdg-open "${url}"`;

    exec(cmd, (err) => {
        if (err) {
            console.error('Could not open browser. Please open this URL manually:', url);
        } else {
            console.log('Opened browser to approve grant:', url);
        }
    });

    console.log('\nPlease accept grant in the browser. This script will automatically continue in 20 seconds...');

  // Wait for 20,000 milliseconds
  await wait(20000);

  console.log('20-second wait complete. Continuing script...');

    const finalizedOutgoingGrant = await client.grant.continue({
      url: outgoingGrantRequest.continue.uri,
      accessToken: outgoingGrantRequest.continue.access_token.value
    })

    if (!isFinalizedGrant(finalizedOutgoingGrant)) {
      throw new Error('There was an error continuing the grant. You probably have not accepted the grant at the url (or it has already been used up, in which case, rerun the script).')
    }

  
    
    const outgoingPayments = await client.outgoingPayment.list({
      url: walletAddress.resourceServer,
      accessToken: finalizedOutgoingGrant.access_token.value,
      walletAddress: walletAddress.id
    })

    let totalEnviado = 0

    if (!outgoingPayments || !Array.isArray(outgoingPayments.result) || outgoingPayments.result.length === 0) {
      // Return an empty consistent shape when there are no outgoing payments
      return { list: [], totalEnviado: 0 };
    } else {
      const list = outgoingPayments.result.map((pago, index) => {
        totalEnviado += parseFloat(pago.debitAmount.value)
        return {
          index: index + 1,
          status: pago.failed ? 'Failed' : 'Completed',
          amount: parseFloat(pago.debitAmount.value) / Math.pow(10, pago.debitAmount.assetScale),
          assetCode: pago.debitAmount.assetCode,
          description: pago.metadata?.description,
          date: new Date(pago.createdAt).toLocaleString()
        }
      })

      return { list, totalEnviado };
    }
    }
}

module.exports = Transaction;