const express = require('express'),
    app = express(),
    port = process.env.PORT || 7072,
    bodyParser = require('body-parser');

const logging = require('./libs/logging');
const iniParser = require('./libs/iniParser');
const args = require('minimist')(process.argv.slice(2));
require('custom-env').env(true);

process.env.TZ = 'Asia/Jakarta';
let config = {
    log: {
        path: "var/log/",
        level: "debug"
    }
};

if (args.h || args.help) {
    // TODO: print USAGE
    console.log("Usage: node " + __filename + " --config");
    process.exit(-1);
}

configFile = args.c || args.config || './configs/config.ini';
config = iniParser.init(config, configFile, args);
config.log.level = args.logLevel || config.log.level;

// Initialize logging
logging.init({
    path: config.log.path,
    level: config.log.level
});

const dbConfig = require('./configs/database.js');
const mongoose = require('mongoose');
mongoose.set('useUnifiedTopology', true);

mongoose.Promise = global.Promise;

// Connecting to the database
mongoose.connect(dbConfig.url, {
    useNewUrlParser: true
}).then(() => {
    logging.debug(`[MongoDB] Successfully connected to the database`);
}).catch(err => {
    logging.error(`[MongoDB] Could not connect to the database. Exiting now...`);
    process.exit();
});

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

var routes = require('./routes/route');
routes(app);

app.listen(port);
logging.info(`[PENDAFTARAN_RJ] READY => PORT ${JSON.stringify(port)}`);