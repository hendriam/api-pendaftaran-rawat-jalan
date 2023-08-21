const mongoose = require('mongoose');
const iniParser = require('../libs/iniParser');
var ObjectId = mongoose.Schema.Types.ObjectId;
var config = iniParser.get();

const laporanPengeluaranPerujukSchema = mongoose.Schema({
    patient_id: ObjectId,
    nama: String,
    keterangan: String,
    tarif: String,
    jenis_pembayaran_id: ObjectId,
    faskes_id: ObjectId,
    queue_id: ObjectId,
    temp: String,
    update_by_1: String,
    update_by_2: String,
    update_by_3: String,

    time_in     : String,
    time_out    : String,
    provider_id : ObjectId,

    createdAt: String,
    updatedAt: String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_laporan_pengeluaran_perujuk, laporanPengeluaranPerujukSchema, config.mongodb.db_laporan_pengeluaran_perujuk);