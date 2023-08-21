const mongoose      = require('mongoose');
const iniParser     = require('../libs/iniParser');
var ObjectId        = mongoose.Schema.Types.ObjectId;
var config          = iniParser.get();

const visitTypeSchema = mongoose.Schema({
    kode        : String,
    name        : String,
    keterangan  : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_visit_type, visitTypeSchema, config.mongodb.db_visit_type);