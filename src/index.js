import KlerosPOCBot from './bots/KlerosPOC'
import BidBot from './bots/Bid'
import dotenv from 'dotenv'
// to get it to play nice with webpack we need to import like this

// use enviornment variables in .env. Do this before anything else
dotenv.config()

let Bot
const args = require('minimist')(process.argv.slice(2))
let botType = args.bot_type

if (!botType) {
  console.log('Missing parameter bot_type')
  console.log('Usage: node ./index.js --bot_type=<bot type>')
  console.log('bot types can be one of: KlerosPOC')
  // FIXME bable-watch isn't playing well with yargs
  console.log('Defaulting to KlerosPOC')
  botType = 'BidBot'
}

process.on('SIGTERM', function () {
    console.log('Got SIGTERM signal.')
    Bot.stop()
})

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

switch (botType) {
  case 'KlerosPOC':
    const arbitratorAddress = process.env.ARBITRATOR_CONTRACT_ADDRESS
    Bot = new KlerosPOCBot(arbitratorAddress)
    break
  case 'BidBot':
    const iicoAddress = '0xa7763af85440446a4d1a93ef512a0feeec61b8e7'
    Bot = new BidBot(iicoAddress)
    break
  default:
    throw new Error("Unrecognized bot type: " + botType)
}

Bot.start()
