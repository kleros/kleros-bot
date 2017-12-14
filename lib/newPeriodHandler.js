import Web3 from 'web3'
import { Kleros } from 'kleros-api'
import TransactionController from './TransactionController'
import dotenv from 'dotenv'

const {
  ETH_PROVIDER,
  ARBITRATOR_CONTRACT_ADDRESS,
  PERIODS,
  DISPUTE_OPEN,
  DISPUTE_RESOLVING,
  DISPUTE_EXECUTABLE
} = require('../constants')

// use enviornment variables in .env
dotenv.config()

const main = async () => {
  const web3Provider = new Web3.providers.HttpProvider(ETH_PROVIDER)
  // don't care about store
  const KlerosInstance = new Kleros(web3Provider)
  const KlerosPOC = await KlerosInstance.klerosPOC
  // make new tx controller with private key
  console.log(typeof(TransactionController))
  const TransactionController = new TransactionController(process.env.PRIVATE_KEY)
  // get instance of contract
  const contractInstance = await KlerosPOC.load(ARBITRATOR_CONTRACT_ADDRESS)
  const newPeriodEvent = contractInstance.NewPeriod()
  
  await newPeriodEvent.watch(async (error, result) => {
    console.log("ballin")
    switch (result.args._period) {
      case PERIODS.EXECUTE:
        const contractData = await KlerosPOC.getData(ARBITRATOR_CONTRACT_ADDRESS)
        let dispute
        let disputeId = 0
        // loop through disputes
        while (1) {
          dispute = await KlerosPOC.getDispute(disputeId)
          // no more need to loop
          if (dispute.arbitratedContract === '0x') break
          
          if (dispute.state === DISPUTE_OPEN) {
            // make sure we can repartition
            if ((dispute.firstSession + dispute.numberOfAppeals) === contractData.session) {
              const repartitionTxHash = await KlerosPOC.repartitionJurorTokens(ARBITRATOR_CONTRACT_ADDRESS, disputeId)
              // if errored skip for now FIXME
              if (!repartitionTxHash) {
                disputeId++
                continue
              }
              dispute = await KlerosPOC.getDispute(disputeId)
            }
          }
          
          if (dispute.state === DISPUTE_EXECUTABLE) {
            // is there a possible race condition here? should we watch for tx to be mined?
            const executeTxHash = await KlerosPOC.executeRuling(ARBITRATOR_CONTRACT_ADDRESS, disputeId)
            if (!executeTxHash) {
              disputeId++
              continue
            }
          }
          
          disputeId++
        }
        break
      default:
        break
    }
  })
}

console.log('hm')
main()