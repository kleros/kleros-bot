import { isCallValid } from '../../helpers'
import Web3Abi from 'web3-eth-abi'

/** Implements methods to call klerosPOC methods pass period, repartition tokens and execute ruling
*/
class KlerosPOCTxController {
  constructor(transactionController) {
    this.transactionController = transactionController
  }

  async passPeriod (arbitratorAddress) {
    const bytecodeData = await Web3Abi.encodeFunctionCall({
      name: 'passPeriod',
      type: 'function',
      inputs: []
    })

    const isValid = await isCallValid(arbitratorAddress, bytecodeData)
    if (isValid) {
      const txHash = await this.transactionController._sendTransactionWithBackoff(
        arbitratorAddress,
        this.address,
        bytecodeData
      )
      console.log("passPeriod: " + txHash)
      return txHash
    }
  }

  // FIXME use multi shot if it would fail
  async repartitionJurorTokens (arbitratorAddress, disputeId) {
    const bytecodeData = await Web3Abi.encodeFunctionCall({
      name: 'oneShotTokenRepartition',
      type: 'function',
      inputs: [{
        type: 'uint256',
        name: '_disputeId'
      }]
    }, [disputeId])

    const isValid = await isCallValid(arbitratorAddress, bytecodeData)

    if (isValid) {
      const txHash = await this.transactionController._sendTransactionWithBackoff(
        arbitratorAddress,
        this.address,
        bytecodeData
      )
      console.log(`repartitioning dispute ${disputeId}:  ${txHash}`)
      return txHash
    }
  }

  async executeRuling (arbitratorAddress, disputeId) {
    const bytecodeData = await Web3Abi.encodeFunctionCall({
      name: 'executeRuling',
      type: 'function',
      inputs: [{
        type: 'uint256',
        name: '_disputeId'
      }]
    }, [disputeId])

    // FIXME: We don't want to check if call is valid because this is called directly after repartition so call will not be valid at time of submission
    const txHash = await this.transactionController._sendTransactionWithBackoff(
      arbitratorAddress,
      this.address,
      bytecodeData
    )
    console.log(`executing dispute ${disputeId}:  ${txHash}`)
    return txHash
  }
}

export default KlerosPOCTxController
