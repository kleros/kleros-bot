import dotenv from 'dotenv'
// use enviornment variables in .env. Do this before anything else
dotenv.config()

import Web3 from 'web3'
import { Kleros } from 'kleros-api'
import {
  PERIODS
} from './constants'
import TransactionController from './lib/TransactionController'
import { transactionListener } from './lib/transactionListener'
import { actOnOpenDisputes } from './lib/actOnOpenDisputes'

let transactionController
let botAddress

// FIXME once more stable don't hard code
let PERIOD_INTERVALS = [300, 0, 300, 300, 300]
let CURRENT_PERIOD

let cycle_stop = false
let daemon = false
let timer
let KlerosPOC

const init = async () => {
  const web3Provider = new Web3.providers.HttpProvider(process.env.ETH_PROVIDER)
  // don't care about store
  const KlerosInstance = new Kleros(web3Provider)
  const web3 = new Web3(web3Provider)
  KlerosPOC = await KlerosInstance.klerosPOC

  // FIXME acting unstable for now so we will hardcode this
  // for (let i=0;i<5;i++) {
  //   const time = await KlerosPOC.getTimeForPeriod(process.env.ARBITRATOR_CONTRACT_ADDRESS, i)
  //   PERIOD_INTERVALS.push(time)
  // }
  CURRENT_PERIOD = await KlerosPOC.getPeriod(process.env.ARBITRATOR_CONTRACT_ADDRESS)

  transactionController = new TransactionController(process.env.PRIVATE_KEY)
  botAddress = transactionController.address
  console.log("bot address: " + botAddress)
  process.env.ADDRESS = botAddress
}

const passPeriodCycle = async () => {
  // check if it is time to repartition/execute
  if (CURRENT_PERIOD === PERIODS.EXECUTE) {
    await actOnOpenDisputes(process.env.ARBITRATOR_CONTRACT_ADDRESS, transactionController)
  }

  timer = setTimeout(async () => {
    const txHash = await transactionController.passPeriod(process.env.ARBITRATOR_CONTRACT_ADDRESS)
    // block until tx has been mined. this works for timing as well as for executing/repartitioning
    await transactionListener(txHash)

    CURRENT_PERIOD = await KlerosPOC.getPeriod(process.env.ARBITRATOR_CONTRACT_ADDRESS)

    // start another cycle
    if (!cycle_stop) passPeriodCycle()
  }, PERIOD_INTERVALS[CURRENT_PERIOD] * 1000)
}

const start = async () => {
  await init()

  // pass period
  passPeriodCycle()
}


const stop = () => {
    cycle_stop = true
    clearTimeout(timer)
}

process.argv.forEach(function (arg) {
    if (arg === '-d') daemon = true
})

process.on('SIGTERM', function () {
    console.log('Got SIGTERM signal.')
    stop()
})


start()

if (daemon) require('daemon')()
