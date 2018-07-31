import TransactionController from './TransactionController'
import KlerosPOCBot from './bots/KlerosPOC'
import BidBot from './bots/Bid'
import DogeBot from './bots/Doge'
import dotenv from 'dotenv'
// to get it to play nice with webpack we need to import like this

// use enviornment variables in .env. Do this before anything else
dotenv.config()

let Bot
const args = require('minimist')(process.argv.slice(2))
let botType = args.type

if (!botType) {
  console.log('Missing parameter bot_type')
  console.log('Usage: node ./index.js --bot_type=<bot type>')
  console.log('bot types can be one of: KlerosPOC, BidBot')
  // FIXME bable-watch isn't playing well with yargs
  console.log('Defaulting to DogeBot')
  botType = 'DogeBot'
}

process.on('SIGTERM', function () {
    console.log('Got SIGTERM signal.')
    Bot.stop()
})

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

const transactionController = new TransactionController(process.env.PRIVATE_KEY)

switch (botType) {
  case 'KlerosPOC':
    const arbitratorAddress = process.env.ARBITRATOR_CONTRACT_ADDRESS
    Bot = new KlerosPOCBot(arbitratorAddress, transactionController)
    break
  case 'BidBot':
    const iicoAddress = process.env.IICO_CONTRACT_ADDRESS
    Bot = new BidBot(iicoAddress)
    break
  case 'DogeBot':
    const arbitrablePermissionListAddress = process.env.ARBITRABLE_PERMISSION_LIST_ADDRESS
    Bot = new DogeBot(arbitrablePermissionListAddress, transactionController)
    break
  default:
    throw new Error("Unrecognized bot type: " + botType)
}

Bot.start()
