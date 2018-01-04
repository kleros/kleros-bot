import Web3 from 'web3'
import { Kleros } from 'kleros-api'

/** Crude method for seeing when tx's have been mined. INFURA does not support event watching
* and as far as I can tell MetaMasks ZeroClientProvider only works client side FIXME
*/
export const transactionListener = async (txHash) => {
  const web3Provider = new Web3.providers.HttpProvider(process.env.ETH_PROVIDER)
  const web3 = new Web3(web3Provider)
  // try again every 10 seconds
  let txReceipt = await getTxReceipt(txHash, web3)
  while (!txReceipt) {
    txReceipt = await getTxReceipt(txHash, web3)
  }

  return txReceipt
}

const getTxReceipt = async (txHash, web3) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(web3.eth.getTransactionReceipt(txHash))
    }, 10000)
  })
}