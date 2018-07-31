import Web3 from 'web3'
import { Kleros } from 'kleros-api'
import {
  PERIODS
} from '../../constants/arbitrator'
import KlerosPOCTxController from './KlerosPOCTxController'
import { transactionListener } from '../../helpers'
import { processDisputes } from './disputes/actOnOpenDisputes'

/** This Bot watches a KlerosPOC contract, passes periods, redistributes tokens and executes rulings
*/
class KlerosPOCBot {
  constructor(arbitratorAddress, transactionController) {
    // set env with contract address
    process.env.ARBITRATOR_CONTRACT_ADDRESS = arbitratorAddress
    // timing params
    this.cycleStop = false
    this.timer
    // kleros params
    this.currentPeriod
    this.botAddress
    this.periodIntervals
    const web3Provider = new Web3.providers.HttpProvider(process.env.ETH_PROVIDER)
    this.transactionController = new KlerosPOCTxController(
      process.env.PRIVATE_KEY,
      process.env.ETH_PROVIDER,
      transactionController
    )
    const KlerosInstance = new Kleros(web3Provider)
    const web3 = new Web3(web3Provider)
    this.KlerosPOC = KlerosInstance.klerosPOC
  }

  _init = async () => {
    // FIXME acting unstable for now so we will hardcode this
    // this.periodIntervals = [300,0,300,300,300]
    this.periodIntervals = []
    for (let i=0;i<5;i++) {
      const time = await this.KlerosPOC.getTimeForPeriod(process.env.ARBITRATOR_CONTRACT_ADDRESS, i)
      this.periodIntervals.push(time)
    }
    console.log("TIME PER PERIOD: " + this.periodIntervals)
    this.currentPeriod = await this.KlerosPOC.getPeriod(process.env.ARBITRATOR_CONTRACT_ADDRESS)

    this.botAddress = this.transactionController.address
    console.log("bot address: " + this.botAddress)
    process.env.ADDRESS = this.botAddress
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

    // FIXME use passPeriod event to trigger timer once events are supported
    this.timer = setTimeout(async () => {
      await this._passPeriod()
      // start another cycle
      if (!this.cycle_stop) this.passPeriodCycle()
    }, this.periodIntervals[this.currentPeriod] * 1000)
  }

  _passPeriod  = async () => {
    const txHash = await this.transactionController.passPeriod(process.env.ARBITRATOR_CONTRACT_ADDRESS)
    if (txHash) {
      // block until tx has been mined. this works for timing as well as for executing/repartitioning
      await transactionListener(txHash)
    }
    this.currentPeriod = await this.KlerosPOC.getPeriod(process.env.ARBITRATOR_CONTRACT_ADDRESS)
  }
}

export default KlerosPOCBot
