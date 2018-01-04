import Web3 from 'web3'
import { Kleros } from 'kleros-api'
import {
  ETH_PROVIDER
} from '../constants'

const web3Provider = new Web3.providers.HttpProvider(ETH_PROVIDER)
const web3 = new Web3(web3Provider)

/** Crude method for seeing when tx's have been mined. INFURA does not support event watching
* and as far as I can tell MetaMasks ZeroClientProvider only works client side FIXME
*/
export const transactionListener = async (txHash) => {
  // try again every 10 seconds
  let txReceipt = await getTxReceipt(txHash)
  while (!txReceipt) {
    txReceipt = await getTxReceipt(txHash)
  }

  return txReceipt
}

const getTxReceipt = async (txHash) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(web3.eth.getTransactionReceipt(txHash))
    }, 10000)
  })
}
