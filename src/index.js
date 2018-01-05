import KlerosPOCBot from './bots/KlerosPOCBot'
import dotenv from 'dotenv'
// use enviornment variables in .env. Do this before anything else
dotenv.config()

let Bot

if (process.argv.length < 3) {
  console.log('Missing parameter bot-type')
  console.log('Usage: node bot.js <bot-type>')
  console.log('bot-types can be one of: KlerosPOC')
  process.exit()
}
const botType = process.argv[2]

process.on('SIGTERM', function () {
    console.log('Got SIGTERM signal.')
    Bot.stop()
})

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});

switch (botType) {
  case 'KlerosPOC':
    Bot = new KlerosPOCBot()
    break
  default:
    throw new Error("Unrecognized bot-type: " + botType)
}

Bot.start()
