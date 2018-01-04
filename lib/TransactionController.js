import Web3 from 'web3'
import Tx from 'ethereumjs-tx'
import { privateToAddress } from 'ethereumjs-util'
import Web3Abi from 'web3-eth-abi'
import { Kleros } from 'kleros-api'
import {
  ETH_PROVIDER,
  GAS_LIMIT
} from '../constants'

class TransactionController {
  /**
  * Send signed transactions to network with private key
  * @param privateKey hex private key
  * @param provider address of eth network
  */
  constructor(privateKey, provider = ETH_PROVIDER) {
    // make private key buffer
    this._privateKey = Buffer.from(privateKey, 'hex')
    // generate address
    this.address = privateToAddress(this._privateKey).toString('hex')
    // web3
    const web3Provider = new Web3.providers.HttpProvider(ETH_PROVIDER)
    this.web3 = new Web3(web3Provider)
    // kleros
    const KlerosInstance = new Kleros(web3Provider)
    this.KlerosPOC = KlerosInstance.klerosPOC
  }

  _createSignedRawTransaction(paramObject) {
    let tx = new Tx(paramObject)
    tx.sign(this._privateKey)

    return tx.serialize()
  }

  async _sendTransaction (rawTransaction) {
    try {
      const txHash = await this.web3.eth.sendRawTransaction('0x' + rawTransaction.toString('hex'))

      return txHash
    } catch (e) {
      throw new Error(e)
    }
  }

  _getNonce () {
    return this.web3.eth.getTransactionCount('0x' + this.address)
  }

  _getTxParams (
    to,
    from,
    data
  ) {
    const gasPrice = this.web3.eth.gasPrice
    const gasPriceHex = this.web3.toHex(gasPrice)
    const gasLimitHex = this.web3.toHex(GAS_LIMIT)
    const nonce = this._getNonce()

    return {
      nonce: nonce,
      gasPrice: gasPriceHex,
      gasLimit: gasLimitHex,
      data: data,
      from: from,
      to: to
    }
  }

  async passPeriod (arbitratorAddress) {
    const bytecodeData = Web3Abi.encodeFunctionCall({
      name: 'passPeriod',
      type: 'function',
      inputs: []
    })

    const txParams = await this._getTxParams(
      arbitratorAddress,
      this.address,
      bytecodeData
    )

    const tx = await this._createSignedRawTransaction(txParams)

    const txHash = await this._sendTransaction(tx)

    console.log("passPeriod: " + txHash)
    return txHash
  }

  async repartitionJurorTokens (arbitratorAddress, disputeId) {
    const bytecodeData = Web3Abi.encodeFunctionCall({
      name: 'oneShotTokenRepartition',
      type: 'function',
      inputs: [{
        type: 'uint256',
        name: '_disputeId'
      }]
    }, [disputeId])

    const txParams = this._getTxParams(
      arbitratorAddress,
      this.address,
      bytecodeData
    )

    const tx = this._createSignedRawTransaction(txParams)

    const txHash = await this._sendTransaction(tx)

    console.log("repartitionJurorTokens: " + txHash)
    return txHash
  }

  async executeRuling (arbitratorAddress, disputeId) {
    const bytecodeData = Web3Abi.encodeFunctionCall({
      name: 'executeRuling',
      type: 'function',
      inputs: [{
        type: 'uint256',
        name: '_disputeId'
      }]
    }, [disputeId])

    const txParams = this._getTxParams(
      arbitratorAddress,
      this.address,
      bytecodeData
    )

    const tx = this._createSignedRawTransaction(txParams)

    const txHash = await this._sendTransaction(tx)

    console.log("executeRuling: " + txHash)
    return txHash
  }
}

export default TransactionController
