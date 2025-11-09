/**
 * Script COMPLETO para consultar TODAS las transacciones (recibidas y enviadas)
 * Incluye flujo interactivo para outgoing payments
 */


const { isFinalizedGrant, isPendingGrant, OpenPaymentsClientError } = require('@interledger/open-payments');
const User = require('./User');
const Wallet = require('./Wallets');
const readline = require('readline/promises');

const user_id = 'JiHVS1HuhMO2F79vyN5V'

// ═══════════════════════════════════════════════════════════

async function consultarTodasLasTransacciones() {
  try {
    console.log('🔄 Conectando con Open Payments...\n')

    // 1. Crear cliente autenticado
    const client = await Wallet.create(user_id);

    // Resolve user wallet/key getters (they're async) so we don't pass Promises
    const WALLET_ADDRESS_URL = await User.getWalletAddress(user_id);
    const KEY_ID = await User.getIlpKey(user_id);
    const PRIVATE_KEY_PATH = await User.getIlpPrivateKeyPath(user_id);

    // 2. Obtener información de la wallet
    const walletAddress = await client.walletAddress.get({ url: WALLET_ADDRESS_URL })

    console.log('📊 INFORMACIÓN DE LA CUENTA')
    console.log('═'.repeat(60))
    console.log(`Wallet: ${walletAddress.id}`)
    console.log(`Moneda: ${walletAddress.assetCode}`)
    console.log(`Escala: ${walletAddress.assetScale}\n`) 

    // ═══════════════════════════════════════════════════════════
    // PARTE 1: PAGOS RECIBIDOS (sin interacción)
    // ═══════════════════════════════════════════════════════════
    
    console.log('💰 OBTENIENDO PAGOS RECIBIDOS...')
    console.log('═'.repeat(60))

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

    if (incomingPayments.result.length === 0) {
      console.log('No hay pagos recibidos.\n')
    } else {
      incomingPayments.result.forEach((pago, index) => {
        console.log(`\n[${index + 1}] ${pago.completed ? '✅' : '⏳'} Pago Recibido`)
        
        const monto = parseFloat(pago.receivedAmount.value) / Math.pow(10, pago.receivedAmount.assetScale)
        console.log(`    Monto: ${monto.toFixed(pago.receivedAmount.assetScale)} ${pago.receivedAmount.assetCode}`)
        
        if (pago.metadata?.description) {
          console.log(`    Descripción: ${pago.metadata.description}`)
        }
        
        console.log(`    Fecha: ${new Date(pago.createdAt).toLocaleString()}`)
        totalRecibido += parseFloat(pago.receivedAmount.value)
      })
      console.log()
    }

    // ═══════════════════════════════════════════════════════════
    // PARTE 2: PAGOS ENVIADOS (requiere interacción)
    // ═══════════════════════════════════════════════════════════
    
    console.log('💸 OBTENIENDO PAGOS ENVIADOS (requiere autorización)...')
    console.log('═'.repeat(60))

    // Solicitar grant interactivo para outgoing payments
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

    // Verificar que sea un grant pendiente (requiere interacción)
    if (!isPendingGrant(outgoingGrantRequest)) {
      throw new Error('Se esperaba un grant pendiente para outgoing payments')
    }

    console.log('\n⚠  ACCIÓN REQUERIDA:')
    console.log('═'.repeat(60))
    console.log('Para ver tus pagos enviados, debes autorizar el acceso.')
    console.log('\n📱 Abre esta URL en tu navegador y autoriza:')
    console.log(`   ${outgoingGrantRequest.interact.redirect}`)
    console.log()

    // Esperar a que el usuario autorice
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    await rl.question('✅ Presiona ENTER después de autorizar en el navegador...')
    rl.close()

    console.log('\n🔄 Continuando el grant...')

    // Continuar el grant después de la interacción
    const finalizedOutgoingGrant = await client.grant.continue({
      url: outgoingGrantRequest.continue.uri,
      accessToken: outgoingGrantRequest.continue.access_token.value
    })

    if (!isFinalizedGrant(finalizedOutgoingGrant)) {
      throw new Error('Error al finalizar el grant. ¿Autorizaste correctamente?')
    }

    console.log('✅ Autorización exitosa. Obteniendo pagos enviados...\n')

    // Ahora sí, listar los outgoing payments
    const outgoingPayments = await client.outgoingPayment.list({
      url: walletAddress.resourceServer,
      accessToken: finalizedOutgoingGrant.access_token.value,
      walletAddress: walletAddress.id
    })

    let totalEnviado = 0

    if (outgoingPayments.result.length === 0) {
      console.log('No hay pagos enviados.\n')
    } else {
      outgoingPayments.result.forEach((pago, index) => {
        console.log(`\n[${index + 1}] ${pago.failed ? '❌' : '✅'} Pago Enviado`)
        
        const monto = parseFloat(pago.debitAmount.value) / Math.pow(10, pago.debitAmount.assetScale)
        console.log(`    Monto: ${monto.toFixed(pago.debitAmount.assetScale)} ${pago.debitAmount.assetCode}`)
        
        if (pago.metadata?.description) {
          console.log(`    Descripción: ${pago.metadata.description}`)
        }
        
        console.log(`    Destinatario: ${pago.receiver}`)
        console.log(`    Fecha: ${new Date(pago.createdAt).toLocaleString()}`)
        
        totalEnviado += parseFloat(pago.debitAmount.value)
      })
      console.log()
    }

    // ═══════════════════════════════════════════════════════════
    // RESUMEN FINAL
    // ═══════════════════════════════════════════════════════════
    
    console.log('═'.repeat(60))
    console.log('📈 RESUMEN FINANCIERO')
    console.log('═'.repeat(60))
    
    const totalRecibidoFormatted = totalRecibido / Math.pow(10, walletAddress.assetScale)
    const totalEnviadoFormatted = totalEnviado / Math.pow(10, walletAddress.assetScale)
    const balance = totalRecibidoFormatted - totalEnviadoFormatted

    console.log(`💰 Total recibido: ${totalRecibidoFormatted.toFixed(walletAddress.assetScale)} ${walletAddress.assetCode}`)
    console.log(`💸 Total enviado:  ${totalEnviadoFormatted.toFixed(walletAddress.assetScale)} ${walletAddress.assetCode}`)
    console.log(`📊 Balance neto:   ${balance.toFixed(walletAddress.assetScale)} ${walletAddress.assetCode}`)
    console.log()

    if (incomingPayments.pagination?.hasNextPage || outgoingPayments.pagination?.hasNextPage) {
      console.log('ℹ  Nota: Hay más transacciones disponibles (usa paginación)\n')
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message)
    if (error.description) {
      console.error('   Descripción:', error.description)
    }
    if (error.validationErrors) {
      console.error('   Validación:', JSON.stringify(error.validationErrors, null, 2))
    }
    process.exit(1)
  }
}

// Ejecutar
consultarTodasLasTransacciones()