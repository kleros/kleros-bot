import Web3 from 'web3'
import MongoClient from 'mongodb'
import contract from 'truffle-contract'
import ZeroClientProvider from 'web3-provider-engine/zero'
import sgMail from '@sendgrid/mail'
import AWS from 'aws-sdk'

import * as dogeConstants from '../../constants/doge'
import arbitablePermissionListArtifact from '../../constants/arbitrablePermissionList'
import { transactionListener } from '../../helpers'

import DogeTxController from './DogeTxController'

/**
 * The Doge Bot will pass periods and execute transactions on the arbitrator
 * as well as execute doge disputes and send emails
 */
class DogeBot {
  constructor(arbitrablePermissionListAddress, transactionController) {
    // instantiate KlerosPOC Bot
    this.transactionController = new DogeTxController(transactionController)
    // set env with contract address
    this.contractAddress = arbitrablePermissionListAddress
    // timing params
    this.dogeEventsCycleStop = false
    this.timer
    this.executeTimeouts = {}
    // web3
    this.web3Provider = ZeroClientProvider({
      rpcUrl: process.env.ETH_PROVIDER
    })
    this.web3 = new Web3(this.web3Provider)
    // arbitrable permission list
    this.timeToChallenge
    // truffle contract instance
    this.contractInstance
    // mongo
    this.mongoClient
    this.db
    // last block checked
    this.lastBlock = 0
    // setup sendgrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    sgMail.setSubstitutionWrappers('{{', '}}')
    // dynamoDB
    AWS.config.update({
      region: "us-east-2",
      endpoint: "https://dynamodb.us-east-2.amazonaws.com"
    })
    this.dynamoClient = new AWS.DynamoDB.DocumentClient()
    this.addressEmailCache = {}
  }

  _init = async () => {
    // initialize doge contract instance
    this.contractInstance = await this.instantiateContract(
      arbitablePermissionListArtifact,
      this.contractAddress
    )
    // the number of seconds until a doge can be executed
    this.timeToChallenge = (await this.contractInstance.timeToChallenge()).toNumber() * 1000

    // initialize mongo and fetch starting point
    this.mongoClient = await MongoClient.connect(dogeConstants.MONGO_URI)
    const _db = this.mongoClient.db(dogeConstants.MONGO_DB_NAME)
    await _db.createCollection(dogeConstants.MONGO_DB_COLLECTION)
    this.db = _db.collection(dogeConstants.MONGO_DB_COLLECTION)

    // get last processed block
    const botData = await this.db.findOne({'item': '0x0'})
    if (botData)
      this.lastBlock = botData.lastBlock
    else
      await this._updateMongo('0x0', {'lastBlock': this.lastBlock})

    // get pending doges and start timeouts
    const pendingDoges = await this.db.find({'status': 'pending'})
    pendingDoges.forEach(async doge => {
      await this.setDogeExecuteTimeout(doge.item)
    })
  }

  _updateMongo = (item, changes) => new Promise((resolve, reject) => {
    const mongoCallback = (err, data) => {
      if (err) reject(err)

      resolve(data)
    }

    this.db.update({ item }, { item, ...changes }, {'upsert': true}, mongoCallback)
  })


  start = async () => {
    await this._init()
    // start cycle
    this.checkForEvents()
    // run on a cycle to keep alive
    this.fetchDogeEvents()
  }

  stop = () => {
    // will not stop child processes
    this.cycle_stop = true
    clearTimeout(this.timer)
  }

  setDogeExecuteTimeout = async (itemHash) => {
    const item = await this.contractInstance.items(itemHash)
    // if item was disputed we should catch it in the events
    if (!item[5]) {
      // put into milliseconds
      const lastAction = item[1].toNumber() * 1000

      let timeBeforeExecute = (this.timeToChallenge - (new Date() - lastAction))
      if (timeBeforeExecute < 0) timeBeforeExecute = 0
      this.executeTimeouts[itemHash] = await this.executePendingDogeTimeout(itemHash, timeBeforeExecute)
    }
  }

  fetchDogeEvents = async () => {
    this.timer = setTimeout(async () => {
      await this.checkForEvents()

      if (!this.cycle_stop) this.fetchDogeEvents()
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
      const dogeEvents = this.contractInstance.ItemStatusChange(
        {},
        {fromBlock: nextBlock, toBlock: lastBlock}
      )
      // make sure all messages are sent before we update the blocks
      await new Promise((resolve, reject) => {
        dogeEvents.get(async (err, results) => {
          if (err)
            reject(err)

          try {
            // process in block order
            for (let i=0; i<results.length; i++) {
              const event = results[i]
              // see if we have already processed this event
              const eventProcessed = await this.db.findOne(
                { 'item': `${event.blockNumber}-${event.logIndex}` }
              )
              if (eventProcessed) {
                continue
              }

              const item = event.args.value
              const submitter = event.args.submitter
              const challenger = event.args.challenger
              let submitterMessage
              let challengerMessage

              let message
              switch (Number(event.args.status)) {
                case dogeConstants.IN_CONTRACT_STATUS_ENUM.Submitted:
                  if (event.args.disputed === true) {
                    submitterMessage = 'Your image has been challenged. Sit tight and wait for the jury to make a decision.'
                    challengerMessage = 'You have challenged an image. Sit tight and wait for the jury to make a decision.'
                    // cancel pending timeout
                    clearTimeout(this.executeTimeouts[item])
                    // execute will be handled in dispute resolution
                    await this._updateMongo(item, {'status': 'none'})
                  } else {
                    submitterMessage = 'Your image has been submitted and is pending acceptance to the list.'
                    // start a pending doge timeout
                    this.setDogeExecuteTimeout(item)
                    // insert new item into db so we can restart timeout on failure
                    await this._updateMongo(item, {'status': 'pending'})
                  }
                  break
                case dogeConstants.IN_CONTRACT_STATUS_ENUM.Registered:
                  if (event.args.disputed === false) {
                    submitterMessage = 'Congratulations! Your image been accepted into the list. Your deposit has been returned.'
                    challengerMessage = 'The image you challenged has been accepted into the list. You lost your deposit.'
                    await this._updateMongo(item, {'status': 'none'})
                  }
                  break
                case dogeConstants.IN_CONTRACT_STATUS_ENUM.Cleared:
                  if (event.args.disputed === false) {
                    submitterMessage = 'The image you submitted has been rejected from the list. You have lost your deposit.'
                    challengerMessage = 'The image you challenged has been rejected from the list. Your deposit has been returned. You have also collected the deposit of the Submitter’.'
                    await this._updateMongo(item, {'status': 'none'})
                  }
                  break
                case dogeConstants.IN_CONTRACT_STATUS_ENUM.Absent:
                  if (submitter && challenger) {
                    submitterMessage = 'Your image could not ruled on. You may resubmit the image if you wish.'
                    challengerMessage = 'The image you challenged could not be ruled on.'
                    await this._updateMongo(item, {'status': 'none'})
                  }
                default:
                  break
              }

              // send emails
              if (challenger) {
                const challengerEmail = await this._fetchEmailAddressAWS(challenger)
                if (challengerEmail) this.sendUpdateEmail(challengerEmail, challengerMessage, item)
              }

              const submitterEmail = await this._fetchEmailAddressAWS(submitter)
              if (submitterEmail) this.sendUpdateEmail(submitterEmail, submitterMessage, item)

              this._updateMongo({ 'item': `${event.blockNumber}-${event.logIndex}` })
            }
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })

      await this._updateMongo('0x0', {'lastBlock': lastBlock})
      this.lastBlock = lastBlock
    }
  }

  /**
   * Set a timeout to execute a doge if it is not disputed in timeToChallenge
   */
  executePendingDogeTimeout = async (item, ms) => setTimeout(async () => {
    // TODO retry on fail
    await this.executeDogeRequest(item)
  }, ms)

  /**
   * Execute a pending doge in the arbitable permission list
   */
  executeDogeRequest = async item => {
    const txHash = await this.transactionController.executeRequest(this.contractAddress, item)
    if (txHash) {
      // block until tx has been mined. this works for timing as well as for executing/repartitioning
      const txReceipt = await transactionListener(txHash)
      // if tx failed
      if (txReceipt.status === '0x0') {
        throw new Error('tx failed')
      }
    }
  }

  sendUpdateEmail = (emailAddress, message, item) => {
    const msg = {
      to: emailAddress,
      from: {
        name: 'Kleros',
        email: 'contact@kleros.io'
      },
      subject: 'Doges On Trial Update',
      templateId: process.env.SENDGRID_TEMPLATE_ID,
      substitutions: {
        message,
        item
      },
    }
    sgMail.send(msg)
    console.log(`Sent confirmation to: ${emailAddress} - Item ${item}`)
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

  _fetchEmailAddressAWS = async address => {
    if (this.addressEmailCache[address]) return this.addressEmailCache[address]

    const challengerEmail = await new Promise((resolve, reject) => {
      this.dynamoClient.get({
        TableName: 'user-settings',
        Key: {
          "address": this.web3.utils.toChecksumAddress(address)
        }
      }, (err, data) => {
        if (err) reject(err)

        resolve(data)
      })
    })

    if (challengerEmail.Item) {
      const email = challengerEmail.Item.email
      this.addressEmailCache[address] = email
      return email
    }
  }
}

export default DogeBot
