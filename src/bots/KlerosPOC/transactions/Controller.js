import TransactionController from '../../../TransactionController'
import Web3Abi from 'web3-eth-abi'

/** Implements methods to call klerosPOC methods pass period, repartition tokens and execute ruling
*/
class KlerosPOCTxController extends TransactionController {
  constructor(privateKey, provider) {
    super(privateKey, provider)
  }

  async passPeriod (arbitratorAddress) {
    const bytecodeData = Web3Abi.encodeFunctionCall({
      name: 'passPeriod',
      type: 'function',
      inputs: []
    })

    const txHash = await this._sendTransactionWithBackoff(arbitratorAddress, this.address, bytecodeData)
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

    const txHash = await this._sendTransactionWithBackoff(arbitratorAddress, this.address, bytecodeData)
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

    const txHash = await this._sendTransactionWithBackoff(arbitratorAddress, this.address, bytecodeData)
    console.log("executeRuling: " + txHash)
    return txHash
  }
}

export default KlerosPOCTxController
