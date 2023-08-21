'use strict'

const winston = require('winston')
const {
    createLogger,
    format,
    transports
} = require('winston');
const {
    combine,
    timestamp,
    prettyPrint,
    printf,
    colorize
} = format;

process.env.TZ = 'Asia/Jakarta'

let filename = 'pendaftaranRawatJalanLog'
let path = 'var/log/'
let level = 'info'
let errorSufix = '-error'

const myFormat = printf(info => {
    return `${info.timestamp} ${info.level}: ${info.message}`;
});

var logger = null

function createLogging(args) {
    logger = winston.createLogger({
        level: args.level,
        //timestamp: function() {
        //  return new Date()
        //},
        format: combine(
            colorize(),
            timestamp(),
            myFormat
        ),
        transports: [
            //
            // - Write to all logs with level `info` and below to `combined.log`
            // - Write all logs error (and below) to `error.log`.
            //
            // new winston.transports.File({
            //     filename: args.path + args.filename + args.errorSufix + '.log',
            //     level: 'error'
            // }),
            // new winston.transports.File({
            //     filename: args.path + args.filename + '.log'
            // })
            // new winston.transports.Console({
            //     format: winston.format.simple()
            // })
        ]
    })

    // DEBUG:
    // if (process.env.NODE_ENV !== 'production') {
    //   logger.add(new winston.transports.Console({
    //     format: winston.format.simple()
    //   }));
    // }

    // Call exceptions.handle with a transport to handle exceptions
    // logger.exceptions.handle(
    //   new transports.File({ filename: args.path + args.filename + '-exceptions.log' })
    // );
}

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//

function init(args = {}) {
    createLogging({
        filename: args.filename || filename,
        path: args.path || path,
        level: args.level || level,
        errorSufix: args.errorSufix || errorSufix
    })
}

function logInfo(message) {
    logger.info(message)
}

function logError(message) {
    logger.error(message)
}

function logDebug(message) {
    logger.debug(message)
}

function logSilly(message) {
    logger.silly(message)
}

module.exports = {
    init: init,
    info: logInfo,
    error: logError,
    debug: logDebug,
    silly: logSilly
}
