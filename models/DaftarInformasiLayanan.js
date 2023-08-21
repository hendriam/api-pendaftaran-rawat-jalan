const mongoose      = require('mongoose');
const iniParser     = require('../libs/iniParser');
var ObjectId        = mongoose.Schema.Types.ObjectId;
var config          = iniParser.get();

const daftarInformasiLayananSchema = mongoose.Schema({
    patient_id              : {
        type    : ObjectId,
        ref     : config.mongodb.db_pasien,
        required: true
    },
    visit_id    : {
        type    : ObjectId,
        ref     : config.mongodb.db_visit,
        required: true
    },
    queue_id    : {
        type    : ObjectId,
        ref     : config.mongodb.db_queue,
        required: true
    },
    visit_type_id   : {
        type        : ObjectId,
        ref         : config.mongodb.db_visit_type,
        required    : true
    },
    
    provider_id: {
        type: ObjectId,
        ref: config.mongodb.db_provider,
        required: false
    },
    payment_id          : {
        type    : ObjectId,
        ref     : config.mongodb.db_jenis_pembayaran,
        required: true
    },
    time_in             : String,
    time_out            : String,
    no_rm           : String,
    nama_pasien     : String,
    
    status      : String,
    keterangan  : String,
    createdAt   : String,
    updatedAt   : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_daftar_informasi_layanan, daftarInformasiLayananSchema, config.mongodb.db_daftar_informasi_layanan);