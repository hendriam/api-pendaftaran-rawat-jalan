const mongoose  = require('mongoose');
const iniParser = require('../libs/iniParser');
var config      = iniParser.get();

const kelasPelayananSchema = mongoose.Schema({
    kode_kelas  : String,
    nama_kelas  : String,
    keterangan  : String,
    status: Boolean,
    createdAt   : String,
    updatedAt   : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_kelas_pelayanan, kelasPelayananSchema, config.mongodb.db_kelas_pelayanan);