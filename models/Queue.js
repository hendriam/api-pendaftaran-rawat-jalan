const mongoose      = require('mongoose');
const iniParser     = require('../libs/iniParser');
var ObjectId        = mongoose.Schema.Types.ObjectId;
var config          = iniParser.get();

const queueSchema = mongoose.Schema({
    no_register         : String,
    no_antri            : String,
    no_sep              : String,
    priority            : String,
    time_in             : String,
    time_out            : String,
    user_id             : {
        type    : ObjectId,
        ref     : config.mongodb.db_users,
        required: true
    },
    dokter_id           : {
        type    : ObjectId,
        ref     : config.mongodb.db_data_dokters,
        required: true
    },
    visit_type_id       : {
        type    : ObjectId,
        ref     : config.mongodb.db_visit_type,
        required: true
    },
    patient_id          : {
        type    : ObjectId,
        ref     : config.mongodb.db_pasien,
        required: true
    },
    payment_id          : {
        type    : ObjectId,
        ref     : config.mongodb.db_jenis_pembayaran,
        required: true
    },
    admission_source    : {
        type    : ObjectId,
        ref     : config.mongodb.db_admission_source,
        required: true
    },
    poli_id             : {
        type    : ObjectId,
        ref     : config.mongodb.db_polyclinics,
        required: true
    },
    visit_id            : {
        type    : ObjectId,
        ref     : config.mongodb.db_visit,
        required: true
    },
    perujuk_id            : {
        type    : ObjectId,
        ref     : config.mongodb.db_perujuk,
        required: false
    },
    provider_id: {
        type: ObjectId,
        ref: config.mongodb.db_provider,
        required: false
    },

    class_id                : {
        type    : ObjectId,
        ref     : config.mongodb.db_kelas_pelayanan,
        required: false
    },
    room_id                 : {
        type    : ObjectId,
        ref     : config.mongodb.db_ruangan,
        required: false
    },
    bed_id                  : {
        type    : ObjectId,
        ref     : config.mongodb.db_tempat_tidur,
        required: false
    },
    
    status              : String,
    status_pengunjung   : String,
    note   : String,
    umur_sekarang: String,
    tgl_lahir: String,
    jenkel: String,
    alamat: String,
    no_rm           : String,
    nama_pasien     : String,

    create_by                : String,
    pindah_layanan_by                : String,
    pindah_by                : String,
    pulang_by                : String,
    update_by                : String,
    pakai_ambulance: String,
    status_pulang           : String,

    queue_old_id: {
        type    : ObjectId,
        ref     : config.mongodb.db_queue,
        required: false
    },

    createdAt           : String,
    updatedAt           : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_queue, queueSchema, config.mongodb.db_queue);