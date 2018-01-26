// TEST HELPERS. PASS EACH AN INSTANCE OF KLEROS
import Web3 from 'web3'
// global web3 for conversions and such
const web3 = new Web3()

export const deployKlerosPOC = async KlerosInstance => {
  // Deploy Kleros Contract
  const rngInstance = await KlerosInstance.blockHashRng.deploy(
    undefined
  )
  const pinakionInstance = await KlerosInstance.pinakion.deploy()
  const klerosCourt = await KlerosInstance.klerosPOC.deploy(
    rngInstance.address,
    pinakionInstance.address,
    [0,0,0,0,0]
  )
  await KlerosInstance.pinakion.setKleros(
    pinakionInstance.address,
    klerosCourt.address
  )
  await KlerosInstance.pinakion.transferOwnership(
    pinakionInstance.address,
    klerosCourt.address
  )

  return klerosCourt.address
}

export const createArbitrableContract = async (KlerosInstance, arbitratorAddress, partyA, partyB) => {
  // deploy a contract and create dispute
  const mockHash = 'mock-hash-contract'
  const mockTimeout = 1
  const mockArbitratorExtraData = ''
  const mockEmail = 'test@kleros.io'
  const mockDescription = 'test description'
  const contractPaymentAmount = 100000
  const arbitrableContract = await KlerosInstance.arbitrableContract
    .deployContract(
      partyA,
      contractPaymentAmount, // use default value (0)
      mockHash,
      arbitratorAddress,
      mockTimeout,
      partyB,
      mockArbitratorExtraData,
      mockEmail,
      mockDescription
    )

  return arbitrableContract.address
}

export const raiseDisputeForContract = async (
  KlerosInstance,
  arbitrableContractAddress,
  arbitratorAddress,
  partyA,
  partyB
) => {
  const arbitrableContractInstance = await KlerosInstance.arbitrableTransaction.load(arbitrableContractAddress)
  const partyAFeeContractInstance = await arbitrableContractInstance
    .partyAFee()
  const extraDataContractInstance = await arbitrableContractInstance
    .arbitratorExtraData()
  const arbitrationCost = await KlerosInstance.klerosPOC
    .getArbitrationCost(arbitratorAddress, extraDataContractInstance)

  // raise dispute party A
  const txHashRaiseDisputeByPartyA = await KlerosInstance.disputes
    .raiseDisputePartyA(
      partyA,
      arbitrableContractAddress,
      web3.fromWei(
        arbitrationCost - partyAFeeContractInstance.toNumber(), 'ether'
      )
  )
  const partyBFeeContractInstance = await arbitrableContractInstance
    .partyBFee()

  const txHashRaiseDisputeByPartyB = await KlerosInstance.disputes
    .raiseDisputePartyB(
      partyB,
      arbitrableContractAddress,
      web3.fromWei(
        arbitrationCost - partyBFeeContractInstance.toNumber(), 'ether'
      )
   )
}

export const stakeTokensJurors = async (
  KlerosInstance,
  arbitratorAddress,
  juror
) => {
  await KlerosInstance.arbitrator.buyPNK(1, arbitratorAddress, juror)
  await KlerosInstance.arbitrator.activatePNK(1, arbitratorAddress, juror)
}
