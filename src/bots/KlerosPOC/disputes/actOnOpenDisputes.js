import Web3 from 'web3'
import { Kleros } from 'kleros-api'
import {
  DISPUTE_STATES,
  NULL_ADDRESS
} from '../../../../constants'
import { transactionListener } from '../../../helpers'
import childProcess from 'child_process'

/** FIXME memoize disputeId's that have been acted on so that we can more efficiently rip through the array
* Could really use worker threads. Figure out some way to spin up processes to deal with the repartition/execute steps
*/
export const processDisputes = async (
  arbitratorAddress,
  TxController,
  KlerosPOC
) => {
  const session = await KlerosPOC.getSession(arbitratorAddress)

  let disputeId = 0
  let txHash
  while (1) {
    // iterate over all disputes (FIXME inefficient)
    try {
       const dispute = await KlerosPOC.getDispute(arbitratorAddress, disputeId)
       // we have seen all open disputes
       if (dispute.arbitratedContract === NULL_ADDRESS) break
       // skip disputes that have been executed
       if (dispute.state === DISPUTE_STATES.EXECUTED) {
         disputeId++
         continue
       }
       // Start new process to handle tx's for dispute
       // childProcess.fork('./disputeActionsWorker', [dispute, disputeId, arbitratorAddress, ession, TxController])
       // console.log('continuing...')
       await actOnDispute(dispute, disputeId, arbitratorAddress, ession, TxController)
       disputeId++
     } catch (e) {
       throw new Error(e)
     }
   }
}

export const actOnDispute = async (
  dispute,
  disputeId,
  arbitratorAddress,
  session,
  TxController
) => {
  // FIXME use action indicators
  if (dispute.state === DISPUTE_STATES.OPEN && (dispute.firstSession + dispute.numberOfAppeals) <= session) {
    txHash = await TxController.repartitionJurorTokens(arbitratorAddress, disputeId)
    await transactionListener(txHash, 5)
    txHash = await TxController.executeRuling(arbitratorAddress, disputeId)
    await transactionListener(txHash, 5)
  } else if (dispute.state === DISPUTE_STATES.EXECUTABLE) {
    txHash = await TxController.executeRuling(arbitratorAddress, disputeId)
    await transactionListener(txHash, 5)
  }
}
