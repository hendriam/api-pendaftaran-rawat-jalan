const mongoose      = require('mongoose');
const iniParser     = require('../libs/iniParser');
var ObjectId        = mongoose.Schema.Types.ObjectId;
var config          = iniParser.get();

const visitSchema = mongoose.Schema({
    time_in                 : String,
    time_out                : String,
    patient_id              : {
        type    : ObjectId,
        ref     : config.mongodb.db_pasien,
        required: true
    },
    visit_type_id           : {
        type    : ObjectId,
        ref     : config.mongodb.db_visit_type,
        required: true
    },
    dokter_id               : {
        type    : ObjectId,
        ref     : config.mongodb.db_data_dokters,
        required: true
    },
    payment_id              : {
        type    : ObjectId,
        ref     : config.mongodb.db_jenis_pembayaran,
        required: true
    },
    admission_source        : {
        type    : ObjectId,
        ref     : config.mongodb.db_admission_source,
        required: true
    },
    provider_id: {
        type: ObjectId,
        ref: config.mongodb.db_provider,
        required: false
    },
    class_id                : ObjectId,
    room_id                 : ObjectId,
    bed_id                  : ObjectId,
    user_id                 : ObjectId,
    pakai_ambulance: String,
    status_pulang           : String,
    umur_sekarang           : String,
    tgl_lahir: String,
    jenkel: String,
    alamat: String,
    createdAt               : String,
    updatedAt               : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_visit, visitSchema, config.mongodb.db_visit);