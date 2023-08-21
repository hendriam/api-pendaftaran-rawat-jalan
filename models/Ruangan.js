const mongoose  = require('mongoose');
const iniParser = require('../libs/iniParser');
var config      = iniParser.get();
var ObjectId    = mongoose.Schema.Types.ObjectId;

const ruanganSchema = mongoose.Schema({
    kode_ruangan    : String,
    nama_ruangan    : String,
    status: Boolean,
    kelas_pelayanan : {
        type    : ObjectId,
        ref     : config.mongodb.db_kelas_pelayanan,
        required: true
    },
    createdAt   : String,
    updatedAt   : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_ruangan, ruanganSchema, config.mongodb.db_ruangan);