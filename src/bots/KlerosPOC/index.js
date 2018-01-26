import Web3 from 'web3'
import { Kleros } from 'kleros-api'
import {
  PERIODS
} from '../../../constants'
import TransactionController from './transactions/Controller'
import { transactionListener } from '../../helpers'
import { processDisputes } from './disputes/actOnOpenDisputes'

/** This Bot watches a KlerosPOC contract, passes periods, redistributes tokens and executes rulings
*/
class KlerosPOCBot {
  constructor(arbitratorAddress) {
    // set env with contract address
    process.env.ARBITRATOR_CONTRACT_ADDRESS = arbitratorAddress
    // timing params
    this.cycleStop = false
    this.timer
    // kleros params
    this.transactionController
    this.currentPeriod
    this.botAddress
    // default to 5 min per session
    this.periodIntervals = [300,0,300,300,300]
    const web3Provider = new Web3.providers.HttpProvider(process.env.ETH_PROVIDER)
    // don't care about store
    const KlerosInstance = new Kleros(web3Provider)
    const web3 = new Web3(web3Provider)
    this.KlerosPOC = KlerosInstance.klerosPOC
  }

  _init = async () => {
    this.periodIntervals = []
    for (let i=0;i<5;i++) {
      const time = await this.KlerosPOC.getTimeForPeriod(process.env.ARBITRATOR_CONTRACT_ADDRESS, i)
      this.periodIntervals.push(time)
    }
    this.currentPeriod = await this.KlerosPOC.getPeriod(process.env.ARBITRATOR_CONTRACT_ADDRESS)

    this.transactionController = new TransactionController(process.env.PRIVATE_KEY)
    this.botAddress = this.transactionController.address
    console.log("bot address: " + this.botAddress)
    process.env.ADDRESS = this.botAddress
    this.cycleStop = false
  }

  /** Entry Point
  */
  start = async () => {
    await this._init()
    // start cycle
    this.passPeriodCycle()
  }

  stop = () => {
    // will not stop child processes
    this.cycle_stop = true
    clearTimeout(this.timer)
  }

  passPeriodCycle = async () => {
    // check if it is time to repartition/execute
    if (this.currentPeriod === PERIODS.EXECUTE) {
      // this starts child processes to handle dispute actions
      await processDisputes(process.env.ARBITRATOR_CONTRACT_ADDRESS, this.transactionController, this.KlerosPOC)
    }
    await this._passPeriod()

    this.timer = setTimeout(async () => {
      await this._passPeriod()
      // start another cycle
      if (!this.cycle_stop) this.passPeriodCycle()
    }, this.periodIntervals[this.currentPeriod] * 1000)
  }

  _passPeriod  = async () => {
    console.log("passing period...")
    const txHash = await this.transactionController.passPeriod(process.env.ARBITRATOR_CONTRACT_ADDRESS)
    if (txHash) {
      // block until tx has been mined. this works for timing as well as for executing/repartitioning
      console.log("waiting...")
      // await transactionListener(txHash)
      console.log("done")
    }
    console.log("changing period")
    this.currentPeriod = await this.KlerosPOC.getPeriod(process.env.ARBITRATOR_CONTRACT_ADDRESS)
    console.log(this.currentPeriod)
  }
}

export default KlerosPOCBot
