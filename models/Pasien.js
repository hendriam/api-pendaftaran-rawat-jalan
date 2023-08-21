const mongoose      = require('mongoose');
const iniParser     = require('../libs/iniParser');
var config          = iniParser.get();

const patientSchema = mongoose.Schema({
    no_rm           : String,
    no_identitas    : String,
    nama_pasien     : String,
    jenkel          : String,
    gol_darah       : String,
    tempat_lahir    : String,
    tgl_lahir       : String,
    umur            : String,
    no_telepon      : String,
    no_hp           : String,
    alamat          : String,
    kota            : String,
    kecamatan       : String,
    kelurahan       : String,
    rt_rw           : String,
    domisili        : String,
    agama           : String,
    pendidikan      : String,
    pekerjaan       : String,
    status_kawin    : String,
    catatan         : String,
    nama_wali       : String,
    hubungan_wali   : String,
    alamat_wali     : String,
    status          : String,
    createdAt       : String,
    updatedAt       : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_pasien, patientSchema, config.mongodb.db_pasien);