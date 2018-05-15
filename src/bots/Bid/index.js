// kleros-bid-bot@kleros-bid-bot.iam.gserviceaccount.com
import Web3 from 'web3'
import MongoClient from 'mongodb'
import contract from 'truffle-contract'
import ZeroClientProvider from 'web3-provider-engine/zero'
import sgMail from '@sendgrid/mail'

import iicoArtifact from '../../constants/IICO'
import * as bidConstants from '../../constants/bid'
import EmailLookup from './util/EmailLookup'

/** This Bot watches a IICO contract and sends emails to bidders.
*/
class BidBot {
  constructor(iicoAddress) {
    // set env with contract address
    process.env.IICO_CONTRACT_ADDRESS = iicoAddress
    this.contractAddress = iicoAddress
    // timing params
    this.cycleStop = false
    this.timer
    // web3
    this.web3Provider = ZeroClientProvider({
      rpcUrl: "https://kovan.infura.io/cfNRuFKJMNeWhBsn2U4U"
    })
    this.web3 = new Web3(this.web3Provider)
    // truffle contract instance
    this.contractInstance
    // mongo
    this.mongoClient
    this.db
    // last block checked
    this.lastBlock = 0
    // email
    this.emailLookup = new EmailLookup()
    // setup sendgrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    sgMail.setSubstitutionWrappers('{{', '}}')
  }

  _init = async () => {
    // populate email lookup with kyc data
    await this.emailLookup.importKYC()

    // initialize contract instance
    this.contractInstance = await this.instantiateContract(
      iicoArtifact,
      this.contractAddress
    )
    // instantiate mongo
    this.mongoClient = await MongoClient.connect(bidConstants.MONGO_URI)
    const _db = this.mongoClient.db(bidConstants.MONGO_DB_NAME)
    await _db.createCollection(bidConstants.MONGO_DB_COLLECTION)
    this.db = _db.collection(bidConstants.MONGO_DB_COLLECTION)

    // get last processed block
    const botData = await this.db.findOne({'address': '0x0'})
    if (botData)
      this.lastBlock = botData.lastBlock
    else
      await this.db.insertOne({'address': '0x0', 'lastBlock': this.lastBlock})
  }

  /** Entry Point
  */
  start = async () => {
    await this._init()
    // start cycle
    this.checkForEvents()
    // run on a cycle to keep alive
    this.fetchBidsCycle()
    // while (!this.cycle_stop) {}
  }

  stop = () => {
    // will not stop child processes
    this.cycle_stop = true
    clearTimeout(this.timer)
  }

  fetchBidsCycle = async () => {
    this.timer = setTimeout(async () => {
      await this.checkForEvents()

      if (!this.cycle_stop) this.fetchBidsCycle()
    }, 15 * 1000) // every 15 seconds check for new events
  }

  checkForEvents = async () => {
    const nextBlock = this.lastBlock + 1
    const lastBlock = await new Promise(
      (reject, resolve) =>
        this.web3.eth.getBlockNumber((result, err) => {
          if (err) reject(err)
          resolve(result)
        })
      )
    // check for new bid events
    if (nextBlock <= lastBlock) {
      const bidEvent = this.contractInstance.allEvents({fromBlock: nextBlock, toBlock: lastBlock})
      bidEvent.get(async (err, results) => {
        if (err)
          throw new Error(err)

        for (let i=0; i<results.length; i++) {
          const result = results[i]

          if (result.event === 'BidSubmitted') {
            const contributor = result.args.contributor
            const bidId = result.args.bidID.toNumber()
            const time = result.args.time.toNumber()

            // check to make sure we haven't already notified user of bid
            let contributorData = await this.db.findOne({'address': contributor})
            if (!contributorData) {
              contributorData = {
                'address': contributor,
                'seenBids': {}
              }
              await this.db.insertOne(contributorData)
            }
            if (!contributorData.seenBids[bidId]) {
              // send confirm email
              await this.sendConfirmationEmail(contributor, bidId, time)
              // update mongo
              if (!contributorData.seenBids) contributorData.seenBids = {}
              contributorData.seenBids[bidId] = true
              await this.db.findOneAndUpdate({'address': contributor}, contributorData)

            }
          }
        }
      })

      await this.db.findOneAndUpdate({'address': '0x0'}, {'address': '0x0', 'lastBlock': lastBlock})
      this.lastBlock = lastBlock
    }
  }

  sendConfirmationEmail = async (ethAddress, bidId, time) => {
    const emailAddress = await this.emailLookup.fetchEmail(ethAddress)
    const bidData = await this.contractInstance.bids(bidId)
    let personalCap = (await this.web3.fromWei(bidData[2], 'ether')).toNumber()
    if (personalCap === bidConstants.INFINITY)
      personalCap = "No Cap"
    else
      personalCap = `${personalCap} ETH`
    const contribution = (await this.web3.fromWei(bidData[3], 'ether')).toNumber()

    // format time string
    const bidTime = new Date(time * 1000)
    const bidTimeString = `${bidTime.getUTCDate()}/${bidTime.getUTCMonth() + 1}/${bidTime.getUTCFullYear()}`

    const msg = {
      to: emailAddress,
      from: 'contact@kleros.io',
      subject: 'Your Bid Has Been Received',
      templateId: process.env.SENDGRID_TEMPLATE_ID,
      substitutions: {
        bidTime: bidTimeString,
        contribution: contribution,
        personalCap: personalCap
      },
    }

    sgMail.send(msg)
    console.log(`Sent confirmation to: ${emailAddress}`)
  }

  /**
   * Instantiate contract.
   * @param {object} artifact - The contract artifact.
   * @param {string} address - The hex encoded contract Ethereum address
   * @returns {object} - The contract instance.
   */
  instantiateContract = async (artifact, address) => {
    try {
      const c = await contract(artifact)
      await c.setProvider(this.web3Provider)
      const contractInstance = _.isUndefined(address)
        ? await c.deployed()
        : await c.at(address)

      return contractInstance
    } catch (err) {
      console.error(err)
      throw new Error('UNABLE TO LOAD CONTRACT')
    }
  }
}

export default BidBot
