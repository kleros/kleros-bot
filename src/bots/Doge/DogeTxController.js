import { isCallValid } from '../../helpers'
import Web3Abi from 'web3-eth-abi'

/** Implements methods to call klerosPOC methods pass period, repartition tokens and execute ruling
*/
class DogeTxController {
  constructor(transactionController) {
    this.transactionController = transactionController
  }

  executeRequest = async (contractAddress, value) => {
    const bytecodeData = await Web3Abi.encodeFunctionCall({
      name: 'executeRequest',
      type: 'function',
      inputs: [{
        type: 'bytes32',
        name: '_value'
      }]
    }, [value])

    const isValid = await isCallValid(contractAddress, bytecodeData)
    if (isValid) {
      const txHash = await this.transactionController._sendTransactionWithBackoff(
        contractAddress,
        this.transactionController.address,
        bytecodeData,
      )
      console.log(txHash)
      console.log("DOGE - executeRequest: " + txHash)
      return txHash
    }
  }
}

export default DogeTxController
