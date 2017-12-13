import Daemonize from 'daemonize2'

const processes = []

// process for period changes
const NewPeriodHandler = Daemonize.setup(
  main: "./lib/newPeriodHandler.js",
  name: "newPeriodHandler",
)
processes.push(NewPeriodHandler)

switch (process.argv[2]) {
  
  /**
  * start all of our processes
  */ 
  case "start":
    processes.map(daemon => {
      daemon.start()
    })
    break
  
  /**
  * kill all processes
  */ 
  case "stop":
    processes.map(daemon => {
      daemon.stop()
    })
    break

  default:
    console.log("Usage: [start|stop]")
}
