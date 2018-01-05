import {
  DISPUTE_STATES
} from '../../constants'
import { actOnDispute } from '../transactions/actOnOpenDisputes'

const main = async (dispute, disputeId, arbitratorAddress, session, TxController) => {
  console.log("starting new worker for dispute " + disputeId)
  await actOnDispute(dispute, disputeId, arbitratorAddress, session, TxController)
  console.log("worker closing for dispute " + disputeId)
}

// get args for process
const [dispute, disputeId, arbitratorAddress, session, TxController, ...rest] = process.argv
main(dispute, disputeId, arbitratorAddress, session, TxController)
