const mongoose  = require('mongoose');
const iniParser = require('../libs/iniParser');
var ObjectId    = mongoose.Schema.Types.ObjectId;
var config      = iniParser.get();

const dataDokterSchema = mongoose.Schema({
    nip             : String,
    nama            : String,
    tanggal_lahir   : String,
    tempat_lahir    : String,
    jenis_kelamin   : String,
    alamat          : String,
    agama           : String,
    phone           : String,
    posisi          : String,
    str             : String,
    sip             : String,
    poliklinik_id   : ObjectId,
    spesialis_id    : ObjectId,
    createdAt       : String,
    updatedAt       : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_data_dokters, dataDokterSchema, config.mongodb.db_data_dokters);