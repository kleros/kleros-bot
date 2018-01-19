import Web3 from 'web3'
import Web3Abi from 'web3-eth-abi'
import { CALL_VALIDATOR } from '../constants'

/** Crude method for seeing when tx's have been mined. INFURA does not support event watching
* and as far as I can tell MetaMasks ZeroClientProvider only works client side FIXME
*/
export const transactionListener = async (txHash, secondsToWait=10) => {
  const web3Provider = new Web3.providers.HttpProvider(process.env.ETH_PROVIDER)
  const web3 = new Web3(web3Provider)
  // try again every 10 seconds
  let txReceipt = await getTxReceipt(txHash, secondsToWait, web3)
  while (!txReceipt) {
    txReceipt = await getTxReceipt(txHash, secondsToWait, web3)
  }

  return txReceipt
}

// try to fetch tx receipt every 10 seconds
const getTxReceipt = async (txHash, secondsToWait, web3) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(web3.eth.getTransactionReceipt(txHash))
    }, secondsToWait * 1000)
  })
}

/**
* @param {object} targetAddress address of contract=
* @param {hex string} encodedTestFunctionCall encoded function call
* @return bool
*/
export const isCallValid = async (targetAddress, encodedTestFunctionCall) => {
  const web3Provider = new Web3.providers.HttpProvider(process.env.ETH_PROVIDER)
  const web3 = new Web3(web3Provider)
  let gasEstimate
  try {
    gasEstimate = await web3.eth.estimateGas({
      to: targetAddress,
      data: encodedTestFunctionCall
    })
  } catch (e) {
    gasEstimate = 0
  }

  return !!gasEstimate
}
