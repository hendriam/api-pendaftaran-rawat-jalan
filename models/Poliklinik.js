const mongoose  = require('mongoose');
const iniParser = require('../libs/iniParser');
var config      = iniParser.get();

const polyclinicsSchema = mongoose.Schema({
    kode            : String,
    nama            : String,
    keterangan      : String,
    waktu_pelayanan : String,
    createdAt       : String,
    updatedAt       : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_polyclinics, polyclinicsSchema, config.mongodb.db_polyclinics);