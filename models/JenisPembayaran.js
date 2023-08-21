const mongoose  = require('mongoose');
const iniParser = require('../libs/iniParser');
var ObjectId    = mongoose.Schema.Types.ObjectId;
var config      = iniParser.get();

const jenisPembayaranSchema = mongoose.Schema({
    name        : String,
    discount    : String,
    status      : Boolean,
    createAt    : String,
    updateAt    : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_jenis_pembayaran, jenisPembayaranSchema, config.mongodb.db_jenis_pembayaran);