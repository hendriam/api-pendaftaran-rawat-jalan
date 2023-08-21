const mongoose  = require('mongoose');
const iniParser = require('../libs/iniParser');
var config      = iniParser.get();
var ObjectId    = mongoose.Schema.Types.ObjectId;

const admissionSourceSchema = mongoose.Schema({
    name    : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_admission_source, admissionSourceSchema, config.mongodb.db_admission_source);