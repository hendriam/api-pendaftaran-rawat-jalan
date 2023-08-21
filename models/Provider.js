const mongoose  = require('mongoose');
const iniParser = require('../libs/iniParser');
var config      = iniParser.get();

const providerSchema = mongoose.Schema({
    name            : String,
    description     : String,
    address     : String,
    phone     : String,
    createdAt       : String,
    updatedAt       : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_provider, providerSchema, config.mongodb.db_provider);