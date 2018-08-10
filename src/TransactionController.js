import Web3 from 'web3'
import Tx from 'ethereumjs-tx'
import { privateToAddress } from 'ethereumjs-util'
import {
  GAS_LIMIT
} from './constants/arbitrator'
import { PromiseQueue } from './helpers'

class TransactionController {
  /**
  * Send signed transactions to network with private key
  * @param privateKey hex private key
  * @param provider address of eth network
  */
  constructor(privateKey, provider = process.env.ETH_PROVIDER) {
    // make private key buffer
    this._privateKey = Buffer.from(privateKey, 'hex')
    // generate address
    this.address = privateToAddress(this._privateKey).toString('hex')
    // web3
    const web3Provider = new Web3.providers.HttpProvider(process.env.ETH_PROVIDER)
    this.web3 = new Web3(web3Provider)
    this.getNoncePromiseQueue = new PromiseQueue()
    // local nonce counter
    this.nonce
  }

  _createSignedRawTransaction = paramObject => {
    let tx = new Tx(paramObject)
    tx.sign(this._privateKey)

    return tx.serialize()
  }

  _sendTransaction = async rawTransaction => {
    const txHash = (await this.web3.eth.sendSignedTransaction('0x' + rawTransaction.toString('hex'))).transactionHash
    return txHash
  }

  /** Get nonce from blockchain if we don't have a counter in memory
  * NOTE we are assuming that each bot will be using a different pub key so nonce will not be effected by external tx's
  */
  _getNonce = async () => {
    if (!this.nonce) {
      // if nonce isn't set get from blockchain
      this.nonce = await this.web3.eth.getTransactionCount('0x' + this.address, 'pending')
    }
    const currentNonce = this.nonce
    this.nonce++

    return currentNonce
  }

  _getTxParams = async (
    to,
    from,
    data
  ) => {
    const gasPrice = await this.web3.eth.getGasPrice()
    const gasPriceHex = this.web3.utils.toHex(gasPrice)
    const gasLimitHex = this.web3.utils.toHex(GAS_LIMIT)
    const nonce = await this.getNoncePromiseQueue.fetch(this._getNonce)

    return {
      nonce: nonce,
      gasPrice: gasPriceHex,
      gas: gasLimitHex,
      data: data,
      from: from,
      to: to
    }
  }

  _sendTransactionWithBackoff = async (to, from, data) => {
    let txHash

    let txParams = await this._getTxParams(to, from, data)
    let tx = this._createSignedRawTransaction(txParams)
    try {
      txHash = await this._sendTransaction(tx)
    } catch (e) {
      // retry once. Usually a nonce issue TODO make this better
      txParams = await this._getTxParams(to, from, data)
      tx = this._createSignedRawTransaction(txParams)
      txHash = await this._sendTransaction(tx)
    }
    return txHash
  }

  _call = async (to, data, from=undefined) => {
    const result = await this.web3.eth.call({
      to: to,
      data: data,
      from: from
    })

    return result
  }
}

export default TransactionController
