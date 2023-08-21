const mongoose  = require('mongoose');
const iniParser = require('../libs/iniParser');
var config      = iniParser.get();
var ObjectId    = mongoose.Schema.Types.ObjectId;

const perujukSchema = mongoose.Schema({
    kode                : String,
    nama                : String,
    tarif               : String,
    keterangan          : String,
    createdAt           : String,
    updatedAt           : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_perujuk, perujukSchema, config.mongodb.db_perujuk);