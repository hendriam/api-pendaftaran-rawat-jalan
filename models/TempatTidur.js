const mongoose  = require('mongoose');
const iniParser = require('../libs/iniParser');
var config      = iniParser.get();
var ObjectId    = mongoose.Schema.Types.ObjectId;

const tempatTidurSchema = mongoose.Schema({
    kode_bed    : String,
    nama_bed    : String,
    keterangan  : String,
    status: Boolean,
    ruangan     : {
        type    : ObjectId,
        ref     : config.mongodb.db_ruangan,
        required: true
    },
    createdAt   : String,
    updatedAt   : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_tempat_tidur, tempatTidurSchema, config.mongodb.db_tempat_tidur);