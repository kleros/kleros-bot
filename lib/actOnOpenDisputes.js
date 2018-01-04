import Web3 from 'web3'
import { Kleros } from 'kleros-api'
import {
  DISPUTE_STATES,
  NULL_ADDRESS
} from '../constants'

/** FIXME memoize disputeId's that have been acted on so that we can more efficiently rip through the array
* Could really use worker threads. Figure out some way to spin up processes to deal with the repartition/execute steps
*/
export const actOnOpenDisputes = async (
  arbitratorAddress,
  TxController
) => {
  const web3Provider = new Web3.providers.HttpProvider(process.env.ETH_PROVIDER)
  const KlerosInstance = new Kleros(web3Provider)
  const KlerosPOC = await KlerosInstance.klerosPOC

  const session = KlerosPOC.getSession(arbitratorAddress)

  let disputeId = 0
  let txHash

  while (1) {
    // iterate over all disputes (FIXME inefficient)
    try {
       const dispute = await KlerosPOC.getDispute(arbitratorAddress, disputeId)
       if (dispute.arbitratedContract === NULL_ADDRESS) break

       // FIXME use action indicators
       if (dispute.state === DISPUTE_STATES.OPEN && (dispute.firstSession + dispute.numberOfAppeals) === session) {
         txHash = await TxController.repartitionJurorTokens(arbitratorAddress, disputeId)
         // just do it directly after. Nonce should keep them in order?
         txHash = await TxController.executeRuling(arbitratorAddress, disputeId)
       } else if (dispute.state === DISPUTE_STATES.EXECUTABLE) {
         txHash = await TxController.executeRuling(arbitratorAddress, disputeId)
       }

       disputeId++
     } catch (e) {
       throw new Error(e)
     }
   }
}
