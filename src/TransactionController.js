import Web3 from 'web3'
import Tx from 'ethereumjs-tx'
import { privateToAddress } from 'ethereumjs-util'
import {
  GAS_LIMIT
} from '../constants'

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
    return this.web3.eth.getTransactionCount('0x' + this.address, 'pending')
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
}

export default TransactionController
