import Web3 from 'web3'
import Web3Abi from 'web3-eth-abi'
import { CALL_VALIDATOR } from './constants/arbitrator'

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

/**
 * Creates a JS enum.
 * @param {string[]} arr - An array with the enum string values in order.
 * @returns {object} - A JS enum object.
 */
export function createEnum(arr) {
  return Object.freeze(
    arr.reduce((acc, value, i) => {
      acc[value] = i
      acc[i] = value
      if (acc.values) acc.values.push(value)
      else acc.values = [value]
      if (acc.indexes) acc.indexes.push(i)
      else acc.indexes = [i]
      return acc
    }, {})
  )
}

/**
 * Chain promises so that they are evaluated in order.
 * @returns {object} - The promise queue object.
 */
export const PromiseQueue = () => {
  let promise = Promise.resolve()

  return {
    push: fn => {
      promise = promise.then(fn, fn)
    },
    fetch: fn => {
      let returnResolver
      let returnRejecter
      const returnPromise = new Promise((resolve, reject) => {
        returnResolver = resolve
        returnRejecter = reject
      })
      promise = promise
        .then(fn, fn)
        .then(res => returnResolver(res), err => returnRejecter(err))

      return returnPromise
    }
  }
}
