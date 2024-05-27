const {
  format
} = require('date-fns')
const fs = require('fs')
const fsPromises = require('fs').promises
const path = require('path')
const {
  v4
} = require('uuid')
const logEvents = async (message, logName) => {
  const dateTime = `${format(new Date(),'yyyyMMdd\tHH:mm:ss')}`
  const logItem = `${dateTime}\t${v4()}\t${message}`
  // console.log(logItem)
  try {
    if (!fs.existsSync(path.join(__dirname, 'logs'))) {
      await fsPromises.mkdir(path.join(__dirname, 'logs'))
    }
    await fsPromises.appendFile(path.join(__dirname, 'logs', logName), logItem) //create file if not exist
  } catch (err) {
    console.log(err.message)
  }
}
const logger = (req, res, next) => {
  logEvents(`${req.method}\t${req.headers.origin}\t${req.url}`, 'reqLog.txt')
  console.log(`${req.method}\t${req.url}`)
  next()
}
module.exports = {
  logEvents,
  logger
}