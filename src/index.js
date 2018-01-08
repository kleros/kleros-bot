import KlerosPOCBot from './bots/KlerosPOC'
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
  botType = 'KlerosPOC'
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
  default:
    throw new Error("Unrecognized bot type: " + botType)
}

Bot.start()
