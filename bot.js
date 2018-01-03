import Web3 from 'web3'
import { Kleros } from 'kleros-api'
import {
  ETH_PROVIDER,
  ARBITRATOR_CONTRACT_ADDRESS
} from './constants'
import TransactionController from './lib/TransactionController'
import dotenv from 'dotenv'

// use enviornment variables in .env
dotenv.config()

let transactionController
let botAddress

let PERIOD_INTERVALS = []
let CURRENT_PERIOD

let cycle_stop = false
let daemon = false
let timer

const init = async () => {
  const web3Provider = new Web3.providers.HttpProvider(ETH_PROVIDER)
  // don't care about store
  const KlerosInstance = new Kleros(web3Provider)
  const web3 = new Web3(web3Provider)
  const KlerosPOC = await KlerosInstance.klerosPOC

  for (let i=0;i<5;i++) {
    const time = await KlerosPOC.getTimeForPeriod(ARBITRATOR_CONTRACT_ADDRESS, i)
    PERIOD_INTERVALS.push(time)
  }
  CURRENT_PERIOD = await KlerosPOC.getPeriod(ARBITRATOR_CONTRACT_ADDRESS)

  transactionController = new TransactionController(process.env.PRIVATE_KEY)
  botAddress = transactionController.address
  console.log(botAddress)
  process.env.ADDRESS = botAddress
}

const passPeriodCycle = () => {
    timer = setTimeout(function () {
        transactionController.passPeriod(ARBITRATOR_CONTRACT_ADDRESS)
        if (!cycle_stop) passPeriodCycle()
    }, PERIOD_INTERVALS[CURRENT_PERIOD] * 1000)

    CURRENT_PERIOD = (CURRENT_PERIOD + 1) % 5
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
