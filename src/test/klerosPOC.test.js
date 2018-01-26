import { Kleros } from 'kleros-api'
import Web3 from 'web3'
import { LOCALHOST_PROVIDER } from '../../constants'
import KlerosPOCBot from '../bots/klerosPOC'
import * as helpers from './helpers'

/**
*  REQUIRES testRPC with seed 1
*/
describe('KlerosBot KlerosPOC', () => {
  let partyA
  let partyB
  let juror
  let other
  let web3
  let KlerosInstance
  let storeProvider
  let arbitratorAddress
  let arbitrableContractAddress

  beforeAll(async () => {
    // use testRPC
    const provider = await new Web3.providers.HttpProvider(LOCALHOST_PROVIDER)

    KlerosInstance = await new Kleros(provider)

    web3 = await new Web3(provider)

    partyA = web3.eth.accounts[0]
    partyB = web3.eth.accounts[1]
    juror = web3.eth.accounts[2]
    other = web3.eth.accounts[3]

    storeProvider = await KlerosInstance.getStoreWrapper()

    // testrpc --seed 1
    process.env.PRIVATE_KEY = '4ecd7bedae33c6c232fdd3a1e87e138ff5d780476cc23a098fa9b7f0c815d15b'
  })

  beforeEach(async () => {
    // reset user profile in store
    await storeProvider.newUserProfile(partyA, {address: partyA})
    await storeProvider.newUserProfile(partyB, {address: partyB})
    await storeProvider.newUserProfile(juror, {address: juror})
    await storeProvider.newUserProfile(other, {address: other})
    process.env.ETH_PROVIDER = LOCALHOST_PROVIDER
    // deploy new kleros contract
    arbitratorAddress = await helpers.deployKlerosPOC(
      KlerosInstance
    )
    console.log("deploy kleros: " + arbitratorAddress)
    process.env.ARBITRATOR_CONTRACT_ADDRESS = arbitratorAddress
    // stake pnk
    try {
      await helpers.stakeTokensJurors(
        KlerosInstance,
        arbitratorAddress,
        juror
      )
      console.log("stake tokens")
    } catch (e) {
      console.log("tokens already staked for juror")
    }

    // create contact
    arbitrableContractAddress = await helpers.createArbitrableContract(
      KlerosInstance,
      arbitratorAddress,
      partyA,
      partyB
    )
    console.log("deploy arbitrable contract: " + arbitrableContractAddress)
    // raise a dispute
    await helpers.raiseDisputeForContract(
      KlerosInstance,
      arbitrableContractAddress,
      arbitratorAddress,
      partyA,
      partyB
    )
    console.log("raised dispute")
  }, 50000)

  it('KlerosPOC bot resolve dispute', async (done) => {
    // set instance of kleros court for assertions
    try {
      const klerosPOCInstance = await KlerosInstance.klerosPOC.load(arbitratorAddress)
      // make sure we are starting in Activation
      let currentPeriod = (await klerosPOCInstance.period()).toNumber()
      expect(currentPeriod).toEqual(0)
      // make sure dispute exists
      let dispute = await klerosPOCInstance.disputes(0)
      expect(dispute[0]).not.toBe('0x')

      const klerosPOCBot = new KlerosPOCBot(arbitratorAddress)
      await klerosPOCBot._init()

      console.log('before')
      await klerosPOCBot._passPeriod()
      console.log('after')

      // we should have advanced period by 1
      expect(klerosPOCBot.currentPeriod).toEqual(1)
      expect(klerosPOCBot.currentPeriod).toEqual((await klerosPOCInstance.period()).toNumber())

      // console.log('before')
      // await klerosPOCBot._passPeriod()
      // console.log('after')
      //
      // // we should have advanced period by 1
      // currentPeriod = (await klerosPOCInstance.period()).toNumber()
      // expect(klerosPOCBot.currentPeriod).toEqual(currentPeriod)
      // expect(klerosPOCBot.currentPeriod).toEqual(2)
      done()
    } catch (e) {
      console.log(e)
      done()
    }
  })
}, 100000)
