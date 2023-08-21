const fs        = require('fs');
const Billing     = require('../models/Billing.js');
const Queue     = require('../models/Queue.js');
const Visit     = require('../models/Visit.js');
const User     = require('../models/User.js');
const DataDokters     = require('../models/DataDokters.js');
const VisitType     = require('../models/VisitType.js');
const Pasien     = require('../models/Pasien.js');
const JenisPembayaran     = require('../models/JenisPembayaran.js');
const AdmissionSource     = require('../models/AdmissionSource.js');
const Poliklinik     = require('../models/Poliklinik.js');
const DaftarInformasiLayanan     = require('../models/DaftarInformasiLayanan.js');
const Perujuk     = require('../models/Perujuk.js');
const KelasPelayanan = require('../models/KelasPelayanan.js');
const Ruangan = require('../models/Ruangan.js');
const TempatTidur = require('../models/TempatTidur.js');
const Provider = require('../models/Provider.js');
const LaporanPengeluaranPerujuk = require('../models/LaporanPengeluaranPerujuk.js');
const MonitoringBilling = require('../models/MonitoringBilling.js');
const logging   = require('../libs/logging');
const moment    = require('moment');
const iniParser = require('../libs/iniParser');
const needle    = require('needle');

const validateCreate    = fs.readFileSync('./data/create.json', 'utf-8');
const validateUpdate    = fs.readFileSync('./data/update.json', 'utf-8');
const validatePulangkan = fs.readFileSync('./data/pulangkan.json', 'utf-8');
const validatePindahLayanan = fs.readFileSync('./data/pindah_layanan.json', 'utf-8');

const BILLING_BELUM_LUNAS   = "belum lunas";
const BILLING_LUNAS         = "lunas";
const BILLING_PIUTANG       = "piutang";

const STATUS_MASUK  = "masuk";
const STATUS_PINDAH = "pindah";

const PAYMENT_BPJS = "BPJS";

const ADMISSION_SOURCE_RUJUKAN = "Rujukan";

const KODE_RI = "RI";
const KODE_RJ = "RJ";
const KODE_RP = "RP";
const KODE_RD = "RD";

const STATUS_PULANG_RD = "Pindah Layanan Ke Rawat Darurat";
const STATUS_PULANG_RI = "Pindah Layanan Ke Rawat Inap";
const STATUS_PULANG_RJ = "Pindah Layanan Ke Rawat Jalan";
const STATUS_PULANG_RP = "Pindah Layanan Ke Rawat Penunjang";

const STATUS_PENGUNJUNG_PASIEN_BARU = "Pasien Baru";
const STATUS_PENGUNJUNG_PASIEN_LAMA = "Pasien Lama";

const Ajv = require('ajv');
const { exit } = require('process');
//show All error if data not valid
const ajv = new Ajv({
    allErrors: true,
    loopRequired: Infinity
});

var validateData;

function dataValidate(data) {
    return new Promise((next, reject) => {
        validator = validateData(data);
        validate = validateData;

        if (!validator) {
            logging.error(JSON.stringify(validate.errors));
            reject(validate.errors);
        }
        next();
    });
}

exports.create = async (req, res) => {
    let config   = iniParser.get();
    validateData = ajv.compile(JSON.parse(validateCreate));

    let {
        payment_id,
        poli_id,
        dokter_id,
        admission_source,
        priority,
        patient_id,
        user_id,
        status_pengunjung,
        perujuk_id,
        faskes_id,
        umur,
        time_in,
        no_sep,
        note,
        keterangan_perujuk,
        create_by,
        provider_id
    } = req.body;

    // let resultCheckDate = await checkDate(time_in);
    // if (resultCheckDate == false) {
    //     let stat = {
    //         status  : false,
    //         message : `Tanggal ${time_in} tidak boleh lebih dan kurang 30 hari dari tanggal hari ini.`,
    //         data    : null
    //     };

    //     return res.status(400).send(stat);
    // }

    dataValidate(req.body)
    .then(async function () {
        let dataPasien = await findOnePasien(patient_id);
        logging.debug(`[PENDAFTARAN_RJ] Data Pasien. >>> ${JSON.stringify(dataPasien)}`);

        if (dataPasien == null) {
            logging.debug(`[PENDAFTARAN_RJ] Data Pasien Tidak ditemukan. >>> ${JSON.stringify(dataPasien)}`);

            return res.status(404).send({
                status  : false,
                message : "Data Pasien Tidak ditemukan.",
                data    : null
            });
        } else if(dataPasien == "ERROR") {
            logging.debug(`[PENDAFTARAN_RJ] Internal Server Error. >>> ${JSON.stringify(dataPasien)}`);

            return res.status(500).send({
                status  : false,
                message : "Terjadi kesalahan, silahkan coba beberapa saat lagi.",
                data    : null
            });
        }

        let changePasien = await updatePasien(dataPasien._id, {
            umur: umur,
            updatedAt: moment().format("YYYY-MM-DD HH:mm:ss"),

        });
        logging.debug(`[PENDAFTARAN_RJ] Ubah Data Pasien. >>> ${JSON.stringify(changePasien)}`);

        let checkQueue = await findOneQueueByPasien(patient_id);
        logging.debug(`[PENDAFTARAN_RJ] Data Queue. >>> ${JSON.stringify(checkQueue)}`);

        let tempCheckQueue = 0;
        if (checkQueue.length > 0) {
            checkQueue.forEach(element => {
                if (element.status == "menunggu" || element.status == "dilayani") {
                    tempCheckQueue++;
                }
            });
        }

        if (tempCheckQueue > 0) {
            let namaPoli = '';
            if (checkQueue[0].hasOwnProperty('poli_id')) {
                let dataPoliklinik = await findOnePoliklinik(checkQueue[0].poli_id);
                namaPoli = dataPoliklinik.nama;
            }

            logging.debug(`[PENDAFTARAN_RJ] Pasien dengan nomor rekam medik ${dataPasien.no_rm} masih berada dalam pelayanan ${namaPoli}.`);

            return res.status(400).send({
                status: false,
                message: `Pasien dengan nomor rekam medik ${dataPasien.no_rm} masih berada dalam pelayanan ${namaPoli}.`,
                data: null
            });
        }
        
        let dataVisit = {
            time_in             : time_in,
            time_out            : "-",
            patient_id          : patient_id,
            visit_type_id       : config.visitType.rawatJalan,
            dokter_id           : dokter_id,
            payment_id          : payment_id,
            admission_source    : admission_source,
            user_id             : user_id,
            umur_sekarang       : umur,
            tgl_lahir           : dataPasien.tgl_lahir,
            jenkel              : dataPasien.jenkel,
            alamat              : dataPasien.alamat,
            provider_id         : provider_id || null,
            createdAt           : moment().format("YYYY-MM-DD HH:mm:ss"),
            updatedAt           : moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        let saveVisit = await storeVisit(dataVisit);
        if (saveVisit == "ERROR") {
            return res.status(404).send({
                status  : false,
                message : "Gagal melakukan pendaftaran.",
                data    : null
            });
        }
        logging.debug(`[PENDAFTARAN_RJ] Save Visit. >>> ${JSON.stringify(saveVisit)}`);
        
        let nomorAntri = await getNoAntri();
        let dataQueue = {
            no_register         : "RJ-" + moment().format("YYYYMMDD") + "_" + moment().format("HHmmss"),
            no_antri            : nomorAntri,
            priority            : priority,
            user_id             : user_id,
            dokter_id           : dokter_id,
            visit_id            : saveVisit._id,
            visit_type_id       : config.visitType.rawatJalan,
            patient_id          : patient_id,
            payment_id          : payment_id,
            admission_source    : admission_source,
            poli_id             : poli_id,
            status              : "menunggu",
            status_pengunjung   : status_pengunjung,
            perujuk_id          : perujuk_id,
            no_sep              : no_sep,
            note                : note,
            umur_sekarang       : umur,
            tgl_lahir           : dataPasien.tgl_lahir,
            jenkel              : dataPasien.jenkel,
            alamat              : dataPasien.alamat,
            create_by           : create_by,
            provider_id         : provider_id || null,

            class_id            : null,
            room_id             : null,
            bed_id              : null,

            no_rm               : dataPasien.no_rm,
            nama_pasien         : dataPasien.nama_pasien,
            time_in             : time_in,
            time_out            : "-",

            createdAt           : moment().format("YYYY-MM-DD HH:mm:ss"),
            updatedAt           : moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        let saveQueue = await storeQueue(dataQueue);
        if (saveQueue == "ERROR") {
            deleteVisit(saveVisit._id);
            return res.status(404).send({
                status  : false,
                message : "Gagal melakukan pendaftaran.",
                data    : null
            });
        }
        logging.debug(`[PENDAFTARAN_RJ] Save Queue. >>> ${JSON.stringify(saveQueue)}`);

        let bodyBilling = {
            patient_id  : dataPasien._id,
            visit_id    : saveVisit._id,

            provider_id     : provider_id,
            payment_id      : payment_id,
            time_in         : time_in,
            time_out        : "-",
            no_rm               : dataPasien.no_rm,
            nama_pasien         : dataPasien.nama_pasien,
            visit_type_id       : config.visitType.rawatJalan,
            
            user_id     : user_id
        }

        let createBilling = await requestUrl(config.billing.url, bodyBilling);
        logging.debug(`[PENDAFTARAN_RJ] Create Billing. >>> ${JSON.stringify(createBilling)}`);

        if (createBilling != "ERROR") {
            if (createBilling.status == false) {
                deleteVisit(saveVisit._id);
                deleteQueue(saveQueue._id);

                return res.status(404).send({
                    status  : false,
                    message : "Terjadi kesalahan, tidak dapat membuat billing.",
                    data    : null
                });
            }
        } else {
            deleteVisit(saveVisit._id);
            deleteQueue(saveQueue._id);
            
            return res.status(500).send({
                status  : false,
                message : "Terjadi kesalahan, silahkan coba beberapa saat lagi.",
                data    : null
            });
        }

        if (perujuk_id != null) {
            let dataPerujuk = await findOnePerujuk(req.body.perujuk_id);

            if (dataPerujuk != null) {
                let bodyPerujuk = {
                    patient_id: dataPasien._id,
                    nama: dataPerujuk.nama,
                    keterangan: keterangan_perujuk,
                    tarif: dataPerujuk.tarif,
                    jenis_pembayaran_id: payment_id,
                    faskes_id: faskes_id,
                    queue_id: saveQueue._id,
                    create_by: create_by,
            
                    time_in : time_in,
                    time_out: "-",
                    provider_id     : provider_id,
                }

                let createPerujuk = await requestUrl(config.laporanPengeluaran.url, bodyPerujuk);
                logging.debug(`[PENDAFTARAN_RJ] Create Perujuk. >>> ${JSON.stringify(createPerujuk)}`);
            }
        }
        
        let dataDaftarInformasiLayanan = {
            patient_id      : dataPasien._id,
            visit_id        : saveVisit._id,
            queue_id        : saveQueue._id,
            visit_type_id   : config.visitType.rawatJalan,
            status          : STATUS_MASUK,

            provider_id     : provider_id,
            payment_id      : payment_id,
            time_in         : time_in,
            time_out        : "-",
            no_rm           : dataPasien.no_rm,
            nama_pasien     : dataPasien.nama_pasien,
            
            keterangan      : "Masuk Pelayanan Rawat Jalan.",
            createdAt       : moment().format("YYYY-MM-DD HH:mm:ss"),
            updatedAt       : moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        let createDaftarInformasiLayanan = await storeDaftarInformasiLayanan(dataDaftarInformasiLayanan);
        logging.debug(`[PENDAFTARAN_RJ] Create Daftar Informasi Layanan. >>> ${JSON.stringify(createDaftarInformasiLayanan)}`);

        return res.status(200).send({
            status  : true,
            message : "Berhasil melakukan pendaftaran pasien rawat jalan.",
            data    : null
        });
    })
    .catch(function (err) {
        let stat = {
            status: false,
            rc: "-",
            message: "Validation Form Error",
            data: {
                errors: []
            }
        };
        for (var i = 0; i < err.length; i++) {
            let obj = {
                type: err[i].dataPath.slice(1),
                message: err[i].message
            }
            stat.data.errors.push(obj);
        }

        return res.status(422).send(stat);
    });
};

exports.update = (req, res) => {
    let config = iniParser.get();
    validateData = ajv.compile(JSON.parse(validateUpdate));

    let {
        payment_id,
        admission_source,
        priority,
        queue_id,
        visit_id,
        status_pengunjung,
        note,
        dokter_id,
        time_in,
        update_by,
        provider_id,
        perujuk_id,
        keterangan_perujuk,
        faskes_id,
        poli_id
    } = req.body;

    dataValidate(req.body)
    .then(async function () {
        let dataPerujukId = perujuk_id;
        let dataQueue = await getOneQueue(queue_id);
        let dataPasien = await findOnePasien(dataQueue.patient_id);
        if (perujuk_id != null) {
            let dataLaporanPerujuk = await getOneLaporanPengeluaranPerujuk(dataQueue.patient_id, dataQueue._id);
            if (dataLaporanPerujuk == null) {
                let dataPerujuk = await findOnePerujuk(req.body.perujuk_id);

                if (dataPerujuk != null) {
                    let bodyPerujuk = {
                        patient_id: dataQueue.patient_id,
                        nama: dataPerujuk.nama,
                        keterangan: keterangan_perujuk,
                        tarif: dataPerujuk.tarif,
                        jenis_pembayaran_id: payment_id,
                        faskes_id: faskes_id,
                        queue_id: dataQueue._id,
                        create_by: update_by,
                        time_in : time_in,
                        time_out: "-",
                        provider_id : provider_id,
                    }

                    let createPerujuk = await requestUrl(config.laporanPengeluaran.url, bodyPerujuk);
                    logging.debug(`[PENDAFTARAN_RJ] Create Perujuk. >>> ${JSON.stringify(createPerujuk)}`);
                }
            } else {
                if (parseInt(dataLaporanPerujuk.temp) >= 3) {
                    return res.status(400).send({
                        status: false,
                        message: "Tidak dapat mengubah data perujuk lagi.",
                        data: null
                    });
                }
    
                let tempNow = parseInt(dataLaporanPerujuk.temp) + 1;
                let updateBy1 = "-";
                let updateBy2 = "-";
                let updateBy3 = "-";
                if (tempNow == 1) {
                    updateBy1 = update_by;
                } else if (tempNow == 2) {
                    updateBy2 = update_by;
                } else {
                    updateBy3 = update_by;
                }
    
                let dataPerujuk = await findOnePerujuk(req.body.perujuk_id);
    
                let dataUpdateLaporanPengeluaranPerujuk = {
                    nama: dataPerujuk.nama,
                    tarif: dataPerujuk.tarif,
                    keterangan_perujuk: keterangan_perujuk,
                    faskes_id: faskes_id,
                    temp: tempNow,

                    time_in : time_in,
                    jenis_pembayaran_id: payment_id,
                    provider_id: provider_id,

                    update_by_1: updateBy1,
                    update_by_2: updateBy2,
                    update_by_3: updateBy3
                }
    
                updateLaporanPengeluaranPerujuk(dataLaporanPerujuk._id, dataUpdateLaporanPengeluaranPerujuk);
            }
        }
        
        let dataVisit = {
            payment_id          : payment_id,
            admission_source    : admission_source,
            dokter_id    : dokter_id,
            time_in    : time_in,
            provider_id: provider_id || null,
            updatedAt           : moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        let changeVisit = await updateVisit(visit_id, dataVisit);
        logging.debug(`[PENDAFTARAN_RJ] Update Visit. >>> ${JSON.stringify(changeVisit)}`);

        let dataBilling = await findOneBilling(dataQueue.patient_id, visit_id);
        let dataUpdateBilling = {
            provider_id     : provider_id,
            payment_id      : payment_id,
            time_in         : time_in,
            no_rm           : dataPasien.no_rm,
            nama_pasien     : dataPasien.nama_pasien,
            updatedAt           : moment().format("YYYY-MM-DD HH:mm:ss"),
        }
        let changeBilling = await updateBilling(dataBilling._id, dataUpdateBilling);
        logging.debug(`[PENDAFTARAN_RJ] Update Billing. >>> ${JSON.stringify(changeBilling)}`);

        let dataMonitorBilling = await findOneMonitorBilling(dataBilling._id);
        let dataUpdateMonitorBilling = {
            provider_id     : provider_id,
            payment_id      : payment_id,
            time_in         : time_in,
            no_rm           : dataPasien.no_rm,
            nama_pasien     : dataPasien.nama_pasien,
            updatedAt           : moment().format("YYYY-MM-DD HH:mm:ss"),
        }
        let changeMontorBilling = await updateMonitorBilling(dataMonitorBilling._id, dataUpdateMonitorBilling);
        logging.debug(`[PENDAFTARAN_RJ] Update Monitor Billing. >>> ${JSON.stringify(changeMontorBilling)}`);

        let dataDaftarInformasiLayanan = await findOneDaftarInformasiLayanan(dataQueue.patient_id, dataQueue._id);
        let dataUpdateDaftarInformasiLayanan = {
            provider_id     : provider_id,
            payment_id      : payment_id,
            time_in         : time_in,
            no_rm           : dataPasien.no_rm,
            nama_pasien     : dataPasien.nama_pasien,
            updatedAt           : moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        let changeUpdateDaftarInformasiLayanan = await updateDaftarInformasiLayanan(dataDaftarInformasiLayanan._id, dataUpdateDaftarInformasiLayanan);
        logging.debug(`[PENDAFTARAN_RJ] Update Daftar Informasi Layanan. >>> ${JSON.stringify(changeUpdateDaftarInformasiLayanan)}`);

        let updatedataQueue = {
            priority            : priority,
            payment_id          : payment_id,
            admission_source    : admission_source,
            dokter_id: dokter_id,
            poli_id: poli_id,
            status_pengunjung   : status_pengunjung,
            note   : note,
            update_by   : update_by,
            provider_id: provider_id || null,
            perujuk_id: dataPerujukId,
            updatedAt           : moment().format("YYYY-MM-DD HH:mm:ss"),
            time_in             : time_in,
            tgl_lahir           : dataPasien.tgl_lahir,
            jenkel              : dataPasien.jenkel,
            alamat              : dataPasien.alamat,
            no_rm               : dataPasien.no_rm,
            nama_pasien         : dataPasien.nama_pasien,
        };
        let changeQueue = await updateQueue(queue_id, updatedataQueue);
        logging.debug(`[PENDAFTARAN_RJ] Update Queue. >>> ${JSON.stringify(changeQueue)}`);

        return res.status(200).send({
            status  : true,
            message : "Berhasil melakukan perubahan data pendaftaran rawat jalan.",
            data    : null
        });
    })
    .catch(function (err) {
        logging.error(`ERROR. >>> ${JSON.stringify(err.stack)}`);
        let stat = {
            status: false,
            rc: "-",
            message: "Validation Form Error",
            data: {
                errors: []
            }
        };
        for (var i = 0; i < err.length; i++) {
            let obj = {
                type: err[i].dataPath.slice(1),
                message: err[i].message
            }
            stat.data.errors.push(obj);
        }

        return res.status(422).send(stat);
    });
};

exports.pulangkan = async (req, res) => {
    let config = iniParser.get();
    validateData = ajv.compile(JSON.parse(validatePulangkan));

    let {
        queue_id,
        visit_id,
        patient_id,
        status_pulang,
        pakai_ambulance,
        pulang_by,
        time_out
    } = req.body;

    let dataCheckTimeOut = await checkDateTimeOut(visit_id, time_out);
    if (dataCheckTimeOut == false) {
        let stat = {
            status: false,
            message: `Tanggal Keluar ${time_out} tidak boleh lebih kurang dari tanggal masuk dan tidak boleh lebih banyak dari tanggal hari ini`,
            data: null
        };

        return res.status(400).send(stat);
    }

    dataValidate(req.body)
    .then(async function () {
        // CHECK LAYANAN
        let urlCheckLayanan = config.medicalAction.check_layanan + "/pasien/" + patient_id + "/visit/" + visit_id;
        let checkLayanan = await requestUrlGet(urlCheckLayanan);
        logging.debug(`[PENDAFTARAN_RJ] Data Check Layanan. >>> ${JSON.stringify(checkLayanan.body)}`);
        if (checkLayanan.body.status == true) {
            return res.status(400).send({
                status: false,
                message: "Tidak dapat pulangkan pasien, karena masih ada data pelayanan yang gantung.",
                data: null
            });
        }

        // CHECK RETURN OBAT
        let urlCheckReturnObat = config.medicalAction.check_return_obat + "/" + patient_id;
        let checkReturnObat = await requestUrlGet(urlCheckReturnObat);
        logging.debug(`[PENDAFTARAN_RJ] Data Check Return Obat. >>> ${JSON.stringify(checkReturnObat.body)}`);
        if (checkReturnObat.body.status == true) {
            if (checkReturnObat.body.data != null) {
                return res.status(400).send({
                    status: false,
                    message: "Tidak dapat pulangkan pasien, karena masih ada data retur obat yang gantung.",
                    data: null
                });
            }
        }

        // CHECK RETURN BHP
        let urlCheckReturnBhp = config.medicalAction.check_return_bhp + "/" + patient_id;
        let checkReturnBhp = await requestUrlGet(urlCheckReturnBhp);
        logging.debug(`[PENDAFTARAN_RJ] Data Check Return Bhp. >>> ${JSON.stringify(checkReturnBhp.body)}`);
        if (checkReturnBhp.body.status == true) {
            if (checkReturnBhp.body.data != null) {
                return res.status(400).send({
                    status: false,
                    message: "Tidak dapat pulangkan pasien, karena masih ada data retur bhp yang gantung.",
                    data: null
                });
            }
        }

        // CHECK RETURN ALKES
        let urlCheckReturnAlkes = config.medicalAction.check_return_bhp + "/" + patient_id;
        let checkReturnAlkes = await requestUrlGet(urlCheckReturnAlkes);
        logging.debug(`[PENDAFTARAN_RJ] Data Check Return Alkes. >>> ${JSON.stringify(checkReturnAlkes.body)}`);
        if (checkReturnAlkes.body.status == true) {
            if (checkReturnAlkes.body.data != null) {
                return res.status(400).send({
                    status: false,
                    message: "Tidak dapat pulangkan pasien, karena masih ada data retur alkes yang gantung.",
                    data: null
                });
            }
        }
        
        let getdataQueue = await getOneQueue(queue_id);

        let dataBilling = await findOneBilling(patient_id, visit_id);
        logging.debug(`[PENDAFTARAN_RJ] Data Billing. >>> ${JSON.stringify(dataBilling)}`);

        if (dataBilling == "ERROR" || dataBilling == null) {
            logging.debug(`[PENDAFTARAN_RJ] Internal Server Error. >>> ${JSON.stringify(dataBilling)}`);

            return res.status(500).send({
                status  : false,
                message : "Terjadi kesalahan, silahkan coba beberapa saat lagi.",
                data    : null
            });
        }

        let dataUpdateBilling = {
            time_out         : time_out,
        }
        let changeBilling = await updateBilling(dataBilling._id, dataUpdateBilling);
        logging.debug(`[PENDAFTARAN_RJ] Update Billing. >>> ${JSON.stringify(changeBilling)}`);

        let dataMonitorBilling = await findOneMonitorBilling(dataBilling._id);
        let dataUpdateMonitorBilling = {
            time_out         : time_out,
        }
        let changeMontorBilling = await updateMonitorBilling(dataMonitorBilling._id, dataUpdateMonitorBilling);
        logging.debug(`[PENDAFTARAN_RJ] Update Monitor Billing. >>> ${JSON.stringify(changeMontorBilling)}`);

        let dataDaftarInformasiLayanan = await findOneDaftarInformasiLayanan(getdataQueue.patient_id, getdataQueue._id);
        let dataUpdateDaftarInformasiLayanan = {
            time_out         : time_out,
        };
        let changeUpdateDaftarInformasiLayanan = await updateDaftarInformasiLayanan(dataDaftarInformasiLayanan._id, dataUpdateDaftarInformasiLayanan);
        logging.debug(`[PENDAFTARAN_RJ] Update Daftar Informasi Layanan. >>> ${JSON.stringify(changeUpdateDaftarInformasiLayanan)}`);

        if (getdataQueue.perujuk_id != null) {
            let dataLaporanPerujuk = await getOneLaporanPengeluaranPerujuk(getdataQueue.patient_id, getdataQueue._id);
            let dataUpdateLaporanPengeluaranPerujuk = {
                time_out : time_out,
            }
            let changeLaporanPengeluaranPerujuk = await updateLaporanPengeluaranPerujuk(dataLaporanPerujuk._id, dataUpdateLaporanPengeluaranPerujuk);
            logging.debug(`[PENDAFTARAN_RJ] Update Laporan Perujuk. >>> ${JSON.stringify(changeLaporanPengeluaranPerujuk)}`);
        }

        let dataVisit = {
            time_out: time_out,
            status_pulang   : status_pulang,
            pakai_ambulance   : pakai_ambulance,
            updatedAt       : moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        let changeVisit = await updateVisit(visit_id, dataVisit);
        logging.debug(`[PENDAFTARAN_RJ] Update Visit. >>> ${JSON.stringify(changeVisit)}`);

        let dataQueue = {
            status      : "selesai",
            time_out         : time_out,
            pulang_by: pulang_by,
            status_pulang   : status_pulang,
            pakai_ambulance   : pakai_ambulance,
            updatedAt   : moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        let changeQueue = await updateQueue(queue_id, dataQueue);
        logging.debug(`[PENDAFTARAN_RJ] Update Queue. >>> ${JSON.stringify(changeQueue)}`);

        return res.status(200).send({
            status  : true,
            message : "Berhasil melakukan pulangkan pasien pendaftaran rawat jalan.",
            data    : null
        });
    })
    .catch(function (err) {
        let stat = {
            status: false,
            rc: "-",
            message: "Validation Form Error",
            data: {
                errors: []
            }
        };
        for (var i = 0; i < err.length; i++) {
            let obj = {
                type: err[i].dataPath.slice(1),
                message: err[i].message
            }
            stat.data.errors.push(obj);
        }

        return res.status(422).send(stat);
    });
}

exports.open = async (req, res) => {
    let dataOneQueue = await getOneQueue(req.params.Id);
    if (dataOneQueue == "ERROR" || dataOneQueue == null) {
        logging.debug(`[BUKA_PENDAFTARAN_RJ] Data queue tidak ditemukan. >>> ${JSON.stringify(dataOneQueue)}`);

        return res.status(500).send({
            status  : false,
            message : "Terjadi kesalahan, data queue tidak ditemukan.",
            data    : null
        });
    }

    let dataOneVisit =  await getOneVisit(dataOneQueue.visit_id);
    if (dataOneVisit == "ERROR" || dataOneVisit == null) {
        logging.debug(`[BUKA_PENDAFTARAN_RJ] Data visit tidak ditemukan. >>> ${JSON.stringify(dataOneVisit)}`);

        return res.status(500).send({
            status  : false,
            message : "Terjadi kesalahan, data visit tidak ditemukan.",
            data    : null
        });
    }

    let dataOneBilling = await findOneBilling(dataOneQueue.patient_id, dataOneQueue.visit_id);
    if (dataOneBilling == "ERROR" || dataOneBilling == null) {
        logging.debug(`[BUKA_PENDAFTARAN_RJ] Data billing tidak ditemukan. >>> ${JSON.stringify(dataOneBilling)}`);

        return res.status(500).send({
            status  : false,
            message : "Terjadi kesalahan, data billing tidak ditemukan.",
            data    : null
        });
    }

    // update queue
    let dataQueue = {
        status      : "dilayani",
        pulang_by: '-',
    };
    let changeQueue = await updateQueue(dataOneQueue._id, dataQueue);
    logging.debug(`[BUKA_PENDAFTARAN_RJ] Update Queue. >>> ${JSON.stringify(changeQueue)}`);

    // update visit
    let dataVisit = {
        time_out: '-',
        status_pulang   : '-',
        pakai_ambulance   : '-',
    };
    let changeVisit = await updateVisit(dataOneQueue.visit_id, dataVisit);
    logging.debug(`[BUKA_PENDAFTARAN_RJ] Update Visit. >>> ${JSON.stringify(changeVisit)}`);

    // update billing
    let dataUpdateBilling = {
        status      : "belum lunas",
    };
    let changeBilling = await updateBilling(dataOneBilling._id, dataUpdateBilling);
    logging.debug(`[BUKA_PENDAFTARAN_RJ] Update Billing. >>> ${JSON.stringify(changeBilling)}`);

    return res.status(200).send({
        status  : true,
        message : "Berhasil melakukan buka pendaftaran pasien.",
        data    : null
    });
}

exports.findAllGet = async (req, res) => {
    let config   = iniParser.get();

    let {
        poli,
        status,
        priority
    } = req.params;

    let query = [];
    query.push(
        {
            visit_type_id: config.visitType.rawatJalan
        },
        {
            createdAt : { $gte: req.params.from, $lte: req.params.to }
        }
    );

    if (poli != "-") {
        query.push({
            poli_id : req.params.poli
        });
    }

    if (status != "-") {
        query.push({
            status : req.params.status
        });
    }

    if (priority != "-") {
        query.push({
            priority : req.params.priority
        });
    }

    Queue.find({
        $and: query
    })
    .populate('user_id')
    .populate('dokter_id')
    .populate('visit_type_id')
    .populate('patient_id')
    .populate('payment_id')
    .populate('admission_source')
    .populate('poli_id')
    .populate({
        path: 'visit_id',
        populate: [
            {
                path: 'provider_id'
            }
        ],
    })
    .then(_data => {
        let stat = {
            status: true,
            message: "Data Pendaftaran Rawat Jalan",
            data: _data
        };

        logging.debug(`[PENDAFTARAN_RJ] FindAll Successfull => ${JSON.stringify(_data)}`);

        return res.status(200).send(stat);
    })
    .catch(err => {
        res.status(500).send({
            status: false,
            message: err.message || "Beberapa kesalahan terjadi saat mengambil data.",
            data: {

            }
        });
    });
};

exports.findAllPost = async (req, res) => {
    let config   = iniParser.get();

    let dataTable = {
        search: req.body.search == null ? "" : req.body.search,
        start: parseInt(req.body.start),
        length: parseInt(req.body.length),
        draw: parseInt(req.body.draw),
        order: req.body.order,
        dir: req.body.dir,
        visit_type_id: config.visitType.rawatJalan,
        poli_id: req.body.poli_id == null ? "-" : req.body.poli_id,
        status: req.body.status == null ? "-" : req.body.status,
        priority: req.body.priority == null ? "-" : req.body.priority,
        from: req.body.from,
        to: req.body.to,
        no_register: req.body.no_register == null ? "-" : req.body.no_register,
        patient_id: req.body.patient_id == null ? "-" : req.body.patient_id,
        payment_id: req.body.payment_id == null ? "-" : req.body.payment_id,
        provider_id: req.body.provider_id == null ? "-" : req.body.provider_id,
        dokter_id: req.body.dokter_id == null ? "-" : req.body.dokter_id,
        status_pengunjung: req.body.status_pengunjung == null ? "-" : req.body.status_pengunjung,
    };

    logging.debug(`[PENDAFTARAN_RJ] Data Request => ${JSON.stringify(dataTable)}`);

    let total = await getTotal(dataTable.search, dataTable.visit_type_id, dataTable.poli_id, dataTable.status, dataTable.priority, dataTable.from, dataTable.to, dataTable.no_register, dataTable.patient_id, dataTable.payment_id, dataTable.provider_id, dataTable.dokter_id, dataTable.status_pengunjung);
    let data = await getData(dataTable.search, dataTable.start, dataTable.length, dataTable.order, dataTable.dir, dataTable.visit_type_id, dataTable.poli_id, dataTable.status, dataTable.priority, dataTable.from, dataTable.to, dataTable.no_register, dataTable.patient_id, dataTable.payment_id, dataTable.provider_id, dataTable.dokter_id, dataTable.status_pengunjung);

    let response = {
        data: data,
        draw: dataTable.draw,
        recordsTotal: total,
        recordsFiltered: total
    };

    let stat = {
        status: true,
        rc: "0000",
        message: "Data Pendaftaran Rawat Jalan",
        data: response
    };

    logging.debug(`[PENDAFTARAN_RJ] FindAll Successfull => ${JSON.stringify(response)}`);

    return res.status(200).send(stat);
};

exports.findOne = (req, res) => {
    Queue.findById(req.params.Id)
    .populate('user_id')
    .populate('dokter_id')
    .populate('visit_type_id')
    .populate('patient_id')
    .populate('payment_id')
    .populate('admission_source')
    .populate('poli_id')
    .populate({
        path: 'visit_id',
        populate: [
            {
                path: 'provider_id'
            }
        ],
    })
    .then(_data => {
        if (!_data) {
            let stat = {
                status: false,
                message: "Data tidak ditemukan",
                data: {}
            };
            return res.status(404).send(stat);
        }
        let stat = {
            status: true,
            message: "Data ditemukan",
            data: _data
        };

        logging.debug(`[PENDAFTARAN_RJ] Find Successfull => ${JSON.stringify(_data)}`);
        return res.status(200).send(stat);
    })
    .catch(err => {
        if (err.kind === 'ObjectId') {
            let stat = {
                status: false,
                message: "Data tidak ditemukan",
                data: {}
            };
            return res.status(404).send(stat);
        }
        let stat = {
            status: false,
            message: "Beberapa kesalahan terjadi saat mengambil data",
            data: {}
        };

        logging.debug(`[PENDAFTARAN_RJ] Find Failed => ${JSON.stringify(err)}`);
        return res.status(500).send(stat);
    });
};

exports.pindahLayanan = async (req, res) => {
    let config = iniParser.get();
    validateData = ajv.compile(JSON.parse(validatePindahLayanan));

    let {
        patient_id,
        visit_id,
        queue_id,
        visit_type_id,
        kelas_pelayanan_id,
        ruangan_id,
        tempat_tidur_id,
        priority,
        dokter_id,
        note,
        pindah_layanan_by
    } = req.body;

    dataValidate(req.body)
    .then(async function () {
        // CHECK LAYANAN
        let urlCheckLayanan = config.medicalAction.check_layanan + "/pasien/" + patient_id + "/visit/" + visit_id;
        let checkLayanan = await requestUrlGet(urlCheckLayanan);
        logging.debug(`[PENDAFTARAN_RJ] Data Check Layanan. >>> ${JSON.stringify(checkLayanan.body)}`);
        if (checkLayanan.body.status == true) {
            return res.status(400).send({
                status: false,
                message: "Tidak dapat pindah layanan, karena masih ada data pelayanan yang gantung.",
                data: null
            });
        }

        // CHECK RETURN OBAT
        let urlCheckReturnObat = config.medicalAction.check_return_obat + "/" + patient_id;
        let checkReturnObat = await requestUrlGet(urlCheckReturnObat);
        logging.debug(`[PENDAFTARAN_RJ] Data Check Return Obat. >>> ${JSON.stringify(checkReturnObat.body)}`);
        if (checkReturnObat.body.status == true) {
            if (checkReturnObat.body.data != null) {
                return res.status(400).send({
                    status: false,
                    message: "Tidak dapat pindah layanan, karena masih ada data retur obat yang gantung.",
                    data: null
                });
            }
        }

        // CHECK RETURN BHP
        let urlCheckReturnBhp = config.medicalAction.check_return_bhp + "/" + patient_id;
        let checkReturnBhp = await requestUrlGet(urlCheckReturnBhp);
        logging.debug(`[PENDAFTARAN_RJ] Data Check Return Bhp. >>> ${JSON.stringify(checkReturnBhp.body)}`);
        if (checkReturnBhp.body.status == true) {
            if (checkReturnBhp.body.data != null) {
                return res.status(400).send({
                    status: false,
                    message: "Tidak dapat pindah layanan, karena masih ada data retur bhp yang gantung.",
                    data: null
                });
            }
        }

        // CHECK RETURN ALKES
        let urlCheckReturnAlkes = config.medicalAction.check_return_bhp + "/" + patient_id;
        let checkReturnAlkes = await requestUrlGet(urlCheckReturnAlkes);
        logging.debug(`[PENDAFTARAN_RJ] Data Check Return Alkes. >>> ${JSON.stringify(checkReturnAlkes.body)}`);
        if (checkReturnAlkes.body.status == true) {
            if (checkReturnAlkes.body.data != null) {
                return res.status(400).send({
                    status: false,
                    message: "Tidak dapat pindah layanan, karena masih ada data retur alkes yang gantung.",
                    data: null
                });
            }
        }

        let dataQueue = await getOneQueue(queue_id);
        logging.debug(`[PENDAFTARAN_RJ] Data Queue. >>> ${JSON.stringify(dataQueue)}`);

        if (dataQueue.status == "selesai") {
            return res.status(400).send({
                status: false,
                message: "Tidak dapat melakukan pemindahan layanan, karena status sudah selesai.",
                data: null
            });
        }

        let dataVisit = await getOneVisit(visit_id);
        logging.debug(`[PENDAFTARAN_RJ] Data Visit. >>> ${JSON.stringify(dataVisit)}`);

        if (dataQueue.patient_id != patient_id || dataVisit.patient_id != patient_id) {
            return res.status(400).send({
                status  : false,
                message : "Tidak dapat melakukan pemindahan layanan.",
                data    : null
            });
        }

        let dataVisitType = await getOneVisitType(visit_type_id);
        logging.debug(`[PENDAFTARAN_RJ] Data Visit Type. >>> ${JSON.stringify(dataVisitType)}`);

        if (dataVisitType.kode === KODE_RJ) {
            return res.status(400).send({
                status  : false,
                message : "Tidak dapat melakukan pemindahan layanan, karena pasien sudah berada pada " + dataVisitType.name,
                data    : null
            });
        }

        let newVisit = {
            time_in         : dataVisit.time_in,
            time_out        : dataVisit.time_out,
            patient_id      : dataVisit.patient_id,
            visit_type_id   : dataVisit.visit_type_id,
            dokter_id       : dataVisit.dokter_id,
            payment_id      : dataVisit.payment_id,
            admission_source: dataVisit.admission_source,
            user_id         : dataVisit.user_id,
            umur_sekarang   : dataVisit.umur_sekarang,
            tgl_lahir: dataVisit.tgl_lahir,
            jenkel: dataVisit.jenkel,
            alamat: dataVisit.alamat,
            provider_id   : dataVisit.provider_id,
            createdAt       : moment().format("YYYY-MM-DD HH:mm:ss"),
            updatedAt       : moment().format("YYYY-MM-DD HH:mm:ss"),
        }
        let saveNewVisit = await storeVisit(newVisit);
        logging.debug(`[PENDAFTARAN_RJ] Save New Visit. >>> ${JSON.stringify(saveNewVisit)}`);

        let newQueue = {
            no_register         : dataQueue.no_register,
            no_antri            : dataQueue.no_antri,
            priority            : dataQueue.priority,
            user_id             : dataQueue.user_id,
            dokter_id           : dataQueue.dokter_id,
            visit_id            : saveNewVisit._id,
            visit_type_id       : dataQueue.visit_type_id,
            patient_id          : dataQueue.patient_id,
            payment_id          : dataQueue.payment_id,
            admission_source    : dataQueue.admission_source,
            poli_id             : dataQueue.poli_id,
            status              : dataQueue.status,
            status_pengunjung   : dataQueue.status_pengunjung,
            perujuk_id          : dataQueue.perujuk_id,
            // note                : dataQueue.note,
            note                : note,
            umur_sekarang       : dataQueue.umur_sekarang,
            jenkel: dataQueue.jenkel,
            alamat: dataQueue.alamat,
            tgl_lahir: dataQueue.tgl_lahir,
            provider_id       : dataQueue.provider_id,

            class_id        : kelas_pelayanan_id,
            room_id         : ruangan_id,
            bed_id          : tempat_tidur_id,

            create_by           : pindah_layanan_by,
            
            no_rm               : dataQueue.no_rm,
            nama_pasien         : dataQueue.nama_pasien,
            time_in             : dataQueue.time_in,
            time_out            : dataQueue.time_out,

            queue_old_id        : queue_id,

            createdAt           : moment().format("YYYY-MM-DD HH:mm:ss"),
            updatedAt           : moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        let saveNewQueue = await storeQueue(newQueue);
        logging.debug(`[PENDAFTARAN_RJ] Save New Queue. >>> ${JSON.stringify(saveNewQueue)}`);

        let dataUpdateQueue = {};
        let dataUpdateVisit = {};
        let statusPulang = "";
        if (dataVisitType.kode === KODE_RI) {
            dataUpdateQueue.no_register     = newQueue.no_register.replace('RJ', 'RI');
            dataUpdateQueue.visit_type_id   = dataVisitType._id;
            dataUpdateQueue.priority        = priority;
            dataUpdateQueue.dokter_id       = dokter_id;
            dataUpdateQueue.pindah_layanan_by       = pindah_layanan_by;

            // dataUpdateQueue.class_id        = kelas_pelayanan_id;
            // dataUpdateQueue.room_id         = ruangan_id;
            // dataUpdateQueue.bed_id          = tempat_tidur_id;

            dataUpdateQueue.updatedAt       = moment().format("YYYY-MM-DD HH:mm:ss");
            
            dataUpdateVisit.visit_type_id   = dataVisitType._id;
            dataUpdateVisit.class_id        = kelas_pelayanan_id;
            dataUpdateVisit.room_id         = ruangan_id;
            dataUpdateVisit.bed_id          = tempat_tidur_id;
            dataUpdateVisit.dokter_id       = dokter_id;
            dataUpdateVisit.updatedAt       = moment().format("YYYY-MM-DD HH:mm:ss");

            statusPulang = STATUS_PULANG_RI;
        } else if (dataVisitType.kode === KODE_RD) {
            dataUpdateQueue.no_register     = newQueue.no_register.replace('RJ', 'RD');
            dataUpdateQueue.visit_type_id   = dataVisitType._id;
            dataUpdateQueue.priority        = priority;
            dataUpdateQueue.dokter_id       = dokter_id;
            dataUpdateQueue.pindah_layanan_by       = pindah_layanan_by;
            dataUpdateQueue.updatedAt       = moment().format("YYYY-MM-DD HH:mm:ss");

            dataUpdateVisit.visit_type_id   = dataVisitType._id;
            dataUpdateVisit.class_id        = kelas_pelayanan_id;
            dataUpdateVisit.room_id         = ruangan_id;
            dataUpdateVisit.bed_id          = tempat_tidur_id;
            dataUpdateVisit.dokter_id       = dokter_id;
            dataUpdateVisit.updatedAt       = moment().format("YYYY-MM-DD HH:mm:ss");

            statusPulang = STATUS_PULANG_RD;
        } else if (dataVisitType.kode === KODE_RP) {
            dataUpdateQueue.no_register     = newQueue.no_register.replace('RJ', 'RP');
            dataUpdateQueue.visit_type_id   = dataVisitType._id;
            dataUpdateQueue.priority        = priority;
            dataUpdateQueue.dokter_id       = dokter_id;
            dataUpdateQueue.pindah_layanan_by       = pindah_layanan_by;
            dataUpdateQueue.updatedAt       = moment().format("YYYY-MM-DD HH:mm:ss");

            dataUpdateVisit.visit_type_id   = dataVisitType._id;
            dataUpdateVisit.dokter_id       = dokter_id;
            dataUpdateVisit.updatedAt       = moment().format("YYYY-MM-DD HH:mm:ss");

            statusPulang = STATUS_PULANG_RP;
        }

        let newChangeQueue = await updateQueue(saveNewQueue._id, dataUpdateQueue);
        logging.debug(`[PENDAFTARAN_RJ] New Update Queue. >>> ${JSON.stringify(newChangeQueue)}`);

        let newChangeVisit = await updateVisit(saveNewVisit._id, dataUpdateVisit);
        logging.debug(`[PENDAFTARAN_RJ] New Update Visit. >>> ${JSON.stringify(newChangeVisit)}`);

        let dataBilling = await findOneBilling(patient_id, dataVisit._id);
        logging.debug(`[PENDAFTARAN_RJ] Data Billing. >>> ${JSON.stringify(dataBilling)}`);

        if (dataBilling != null || dataBilling != "ERROR") {
            let changeBilling = await updateBilling(dataBilling._id, {
                patient_id: patient_id,
                visit_id: saveNewVisit._id,
                visit_type_id: visit_type_id,
                updatedAt: moment().format("YYYY-MM-DD HH:mm:ss")
            });
            logging.debug(`[PENDAFTARAN_RJ] Update Billing. >>> ${JSON.stringify(changeBilling)}`);
        }

        let dataMonitorBilling = await findOneMonitorBilling(dataBilling._id);
        logging.debug(`[PENDAFTARAN_RJ] Data Monitoring Billing. >>> ${JSON.stringify(dataMonitorBilling)}`);
        let dataUpdateMonitorBilling = {
            visit_type_id: visit_type_id,
            updatedAt: moment().format("YYYY-MM-DD HH:mm:ss")
        }
        let changeMontorBilling = await updateMonitorBilling(dataMonitorBilling._id, dataUpdateMonitorBilling);
        logging.debug(`[PENDAFTARAN_RJ] Update Monitor Billing. >>> ${JSON.stringify(changeMontorBilling)}`);

        if (dataVisitType.kode === KODE_RI || dataVisitType.kode === KODE_RD) {
            let createBillingDetailKamar = await requestUrl(config.tarifKamar.create, {
                queue_id: saveNewQueue._id
            });
            logging.debug(`[PENDAFTARAN_RJ] Create Billing Detail tarif Kamar. >>> ${JSON.stringify(createBillingDetailKamar)}`);

            if (createBillingDetailKamar != "ERROR") {
                if (createBillingDetailKamar.status == false) {
                    deleteVisit(saveNewVisit._id);
                    deleteQueue(saveNewQueue._id);
                    updateBilling(dataBilling._id, {
                        visit_id: dataVisit._id,
                    });

                    updateStatusTempatTidur(dataVisit.bed_id, true);

                    return res.status(404).send({
                        status: false,
                        message: createBillingDetailKamar.message,
                        data: null
                    });
                }
            } else {
                deleteVisit(saveNewVisit._id);
                deleteQueue(saveNewQueue._id);
                updateBilling(dataBilling._id, {
                    visit_id: dataVisit._id,
                });

                updateStatusTempatTidur(dataVisit.bed_id, true);

                return res.status(500).send({
                    status: false,
                    message: "Terjadi kesalahan, silahkan coba beberapa saat lagi.",
                    data: null
                });
            }

            updateStatusTempatTidur(tempat_tidur_id, false);
        }

        let changeQueue = await updateQueue(dataQueue._id, {
            status: "selesai",
            status_pulang: statusPulang,
            updatedAt: moment().format("YYYY-MM-DD HH:mm:ss")
        });
        logging.debug(`[PENDAFTARAN_RJ] Update Queue. >>> ${JSON.stringify(changeQueue)}`);

        let changeVisit = await updateVisit(dataVisit._id, {
            status_pulang: statusPulang,
            updatedAt: moment().format("YYYY-MM-DD HH:mm:ss")
        });
        logging.debug(`[PENDAFTARAN_RJ] Update Visit. >>> ${JSON.stringify(changeVisit)}`);

        let dataDaftarInformasiLayanan = await findOneDaftarInformasiLayanan(dataQueue.patient_id, dataQueue._id);
        let dataUpdateDaftarInformasiLayanan = {
            patient_id      : patient_id,
            visit_id        : dataVisit._id,
            queue_id        : dataQueue._id,
            visit_type_id   : visit_type_id,
            status          : STATUS_PINDAH,
            keterangan      : "Pindah Pelayanan Ke " + dataVisitType.name,
            // createdAt       : moment().format("YYYY-MM-DD HH:mm:ss"),
            updatedAt       : moment().format("YYYY-MM-DD HH:mm:ss"),
        };
        // let createDaftarInformasiLayanan = await storeDaftarInformasiLayanan(dataDaftarInformasiLayanan);
        // logging.debug(`[PENDAFTARAN_RJ] Create Daftar Informasi Layanan. >>> ${JSON.stringify(createDaftarInformasiLayanan)}`);
        let changeUpdateDaftarInformasiLayanan = await updateDaftarInformasiLayanan(dataDaftarInformasiLayanan._id, dataUpdateDaftarInformasiLayanan);
        logging.debug(`[PENDAFTARAN_RJ] Update Daftar Informasi Layanan. >>> ${JSON.stringify(changeUpdateDaftarInformasiLayanan)}`);
        
        let newDataDaftarInformasiLayanan = {
            patient_id      : patient_id,
            visit_id        : saveNewVisit._id,
            queue_id        : saveNewQueue._id,
            visit_type_id   : visit_type_id,
            status          : STATUS_MASUK,
            keterangan      : "Masuk Pelayanan " + dataVisitType.name,

            no_rm           : dataQueue.no_rm,
            nama_pasien     : dataQueue.nama_pasien,
            provider_id     : dataQueue.provider_id,
            payment_id      : dataQueue.payment_id,
            time_in         : dataQueue.time_in,
            time_out        : "-",

            createdAt       : moment().format("YYYY-MM-DD HH:mm:ss"),
            updatedAt       : moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        let newCreateDaftarInformasiLayanan = await storeDaftarInformasiLayanan(newDataDaftarInformasiLayanan);
        logging.debug(`[PENDAFTARAN_RJ] New Create Daftar Informasi Layanan. >>> ${JSON.stringify(newCreateDaftarInformasiLayanan)}`);

        if (dataQueue.perujuk_id != null) {
            let dataLaporanPerujuk = await getOneLaporanPengeluaranPerujuk(dataQueue.patient_id, dataQueue._id);
            let dataUpdateLaporanPengeluaranPerujuk = {
                queue_id        : saveNewQueue._id,
                updatedAt       : moment().format("YYYY-MM-DD HH:mm:ss"),
            }
            let changeLaporanPengeluaranPerujuk = await updateLaporanPengeluaranPerujuk(dataLaporanPerujuk._id, dataUpdateLaporanPengeluaranPerujuk);
            logging.debug(`[PENDAFTARAN_RJ] Update Laporan Perujuk. >>> ${JSON.stringify(changeLaporanPengeluaranPerujuk)}`);            
        }

        return res.status(200).send({
            status  : true,
            message : "Berhasil melakukan pemindahan layanan.",
            data    : null
        });
    })
    .catch (function (err) {
        console.log(err)
        let stat = {
            status: false,
            rc: "-",
            message: "Validation Form Error",
            data: {
                errors: []
            }
        };
        for (var i = 0; i < err.length; i++) {
            let obj = {
                type: err[i].dataPath.slice(1),
                message: err[i].message
            }
            stat.data.errors.push(obj);
        }

        return res.status(422).send(stat);
    });
};

function getTotal(search, _visit_type_id, _poli_id, _status, _priority, _from, _to, _no_register, _patient_id, _payment_id, provider_id, dokter_id, status_pengunjung) {
    let query = [];
    query.push(
        {
            visit_type_id: _visit_type_id
        }
    );

    if (_poli_id != "-") {
        query.push({
            poli_id : _poli_id
        });
    }

    if (_status != "-") {
        query.push({
            status : _status
        });
    }

    if (_priority != "-") {
        query.push({
            priority : _priority
        });
    }

    if (_no_register != "-") {
        query.push({
            no_register : _no_register
        });
    }

    if (_patient_id != "-") {
        query.push({
            patient_id : _patient_id
        });
    }

    if (_payment_id != "-") {
        query.push({
            payment_id: _payment_id
        });
    }

    if (provider_id != "-") {
        query.push({
            provider_id: provider_id
        });
    }

    if (dokter_id != "-") {
        query.push({
            dokter_id: dokter_id
        });
    }

    if (status_pengunjung != "-") {
        query.push({
            status_pengunjung: status_pengunjung
        });
    }

    return new Promise(async function (resolve, reject) {
        try {
            await Queue.find({
                    $or: [{
                            no_register: new RegExp(search, 'i')
                        }
                    ],
                    $and: query
                })
                .populate({
                    path: 'visit_id',
                    populate: [
                        {
                            path: 'provider_id'
                        }
                    ],
                })
                .then(_data => {
                    let newData = [];

                    for (var key in _data) {
                        if (_data[key].visit_id.time_in >= moment(_from).format("YYYY-MM-DD HH:mm:ss") && _data[key].visit_id.time_in <= moment(_to).format("YYYY-MM-DD HH:mm:ss")) {
                            newData.push(_data[key])
                        }
                    }

                    resolve(newData.length);
                })
                .catch(err => {
                    if (err.kind === 'ObjectId') {
                        resolve('Data tidak ditemukan');
                    }
                });
        } catch (err) {
            if (err) reject(err);
        }
    });
}

function getData(search, start, limit, key, value, _visit_type_id, _poli_id, _status, _priority, _from, _to, _no_register, _patient_id, _payment_id, provider_id, dokter_id, status_pengunjung) {
    let query = [];
    query.push(
        {
            visit_type_id: _visit_type_id
        }
    );

    if (_poli_id != "-") {
        query.push({
            poli_id: _poli_id
        });
    }

    if (_status != "-") {
        query.push({
            status: _status
        });
    }

    if (_priority != "-") {
        query.push({
            priority: _priority
        });
    }

    if (_no_register != "-") {
        query.push({
            no_register: _no_register
        });
    }

    if (_patient_id != "-") {
        query.push({
            patient_id: _patient_id
        });
    }

    if (_payment_id != "-") {
        query.push({
            payment_id: _payment_id
        });
    }

    if (provider_id != "-") {
        query.push({
            provider_id: provider_id
        });
    }

    if (dokter_id != "-") {
        query.push({
            dokter_id: dokter_id
        });
    }

    if (status_pengunjung != "-") {
        query.push({
            status_pengunjung: status_pengunjung
        });
    }

    return new Promise(async function (resolve, reject) {
        try {
            await Queue.find({
                    $or: [{
                            no_register: new RegExp(search, 'i')
                        }
                    ],
                    $and: query
                })
                .sort({
                    [key]: value
                })
                .populate('user_id')
                .populate('dokter_id')
                .populate('visit_type_id')
                .populate('patient_id')
                .populate('payment_id')
                .populate('admission_source')
                .populate('poli_id')
                .populate({
                    path: 'visit_id',
                    populate: [
                        {
                            path: 'provider_id'
                        }
                    ],
                })
                .then(_data => {
                    let newData = [];

                    for (var key in _data) {
                        if (_data[key].visit_id.time_in >= moment(_from).format("YYYY-MM-DD HH:mm:ss") && _data[key].visit_id.time_in <= moment(_to).format("YYYY-MM-DD HH:mm:ss")) {
                            newData.push(_data[key])
                        }
                    }

                    resolve(newData.slice(start, start + limit));
                })
                .catch(err => {
                    if (err.kind === 'ObjectId') {
                        resolve('Data tidak ditemukan');
                    }
                });
        } catch (err) {
            if (err) reject(err);
        }
    });
}

exports.findAllPostNew = async (req, res) => {
    let config   = iniParser.get();

    let dataTable = {
        search: req.body.search == null ? "" : req.body.search,
        start: parseInt(req.body.start),
        length: parseInt(req.body.length),
        draw: parseInt(req.body.draw),
        order: req.body.order,
        dir: req.body.dir,
        visit_type_id: config.visitType.rawatJalan,
        poli_id: req.body.poli_id == null ? "-" : req.body.poli_id,
        status: req.body.status == null ? "-" : req.body.status,
        priority: req.body.priority == null ? "-" : req.body.priority,
        from: req.body.from,
        to: req.body.to,
        no_register: req.body.no_register == null ? "-" : req.body.no_register,
        patient_id: req.body.patient_id == null ? "-" : req.body.patient_id,
        payment_id: req.body.payment_id == null ? "-" : req.body.payment_id,
        provider_id: req.body.provider_id == null ? "-" : req.body.provider_id,
        dokter_id: req.body.dokter_id == null ? "-" : req.body.dokter_id,
        status_pengunjung: req.body.status_pengunjung == null ? "-" : req.body.status_pengunjung,
    };

    logging.debug(`[PENDAFTARAN_RJ] Data Request => ${JSON.stringify(dataTable)}`);

    let total = await getTotalNew(dataTable.search, dataTable.visit_type_id, dataTable.poli_id, dataTable.status, dataTable.priority, dataTable.from, dataTable.to, dataTable.no_register, dataTable.patient_id, dataTable.payment_id, dataTable.provider_id, dataTable.dokter_id, dataTable.status_pengunjung);
    let data = await getDataNew(dataTable.search, dataTable.start, dataTable.length, dataTable.order, dataTable.dir, dataTable.visit_type_id, dataTable.poli_id, dataTable.status, dataTable.priority, dataTable.from, dataTable.to, dataTable.no_register, dataTable.patient_id, dataTable.payment_id, dataTable.provider_id, dataTable.dokter_id, dataTable.status_pengunjung);

    let response = {
        data: data,
        draw: dataTable.draw,
        recordsTotal: total,
        recordsFiltered: total
    };

    let stat = {
        status: true,
        rc: "0000",
        message: "Data Pendaftaran Rawat Jalan",
        data: response
    };

    logging.debug(`[PENDAFTARAN_RJ] FindAll Successfull => ${JSON.stringify(response)}`);

    return res.status(200).send(stat);
};

function getTotalNew(search, _visit_type_id, _poli_id, _status, _priority, _from, _to, _no_register, _patient_id, _payment_id, provider_id, dokter_id, status_pengunjung) {
    let query = [{
        time_in: { $gte: _from, $lte: _to }
    }];

    query.push(
        {
            visit_type_id: _visit_type_id
        }
    );

    if (_poli_id != "-") {
        query.push({
            poli_id : _poli_id
        });
    }

    if (_status != "-") {
        query.push({
            status : _status
        });
    }

    if (_priority != "-") {
        query.push({
            priority : _priority
        });
    }

    if (_no_register != "-") {
        query.push({
            no_register : _no_register
        });
    }

    if (_patient_id != "-") {
        query.push({
            patient_id : _patient_id
        });
    }

    if (_payment_id != "-") {
        query.push({
            payment_id: _payment_id
        });
    }

    if (provider_id != "-") {
        query.push({
            provider_id: provider_id
        });
    }

    if (dokter_id != "-") {
        query.push({
            dokter_id: dokter_id
        });
    }

    if (status_pengunjung != "-") {
        query.push({
            status_pengunjung: status_pengunjung
        });
    }

    return new Promise(async function (resolve, reject) {
        try {
            await Queue.find({
                    $or: [
                        {
                            nama_pasien: new RegExp(search, 'i')
                        },
                        {
                            no_rm: new RegExp(search, 'i')
                        }
                    ],
                    $and: query
                })
                .countDocuments()
                .then(_data => {
                    resolve(_data);
                })
                .catch(err => {
                    if (err.kind === 'ObjectId') {
                        resolve('Data tidak ditemukan');
                    }
                });
        } catch (err) {
            if (err) reject(err);
        }
    });
}

function getDataNew(search, start, limit, key, value, _visit_type_id, _poli_id, _status, _priority, _from, _to, _no_register, _patient_id, _payment_id, provider_id, dokter_id, status_pengunjung) {
    let query = [{
        time_in: { $gte: _from, $lte: _to }
    }];
    query.push(
        {
            visit_type_id: _visit_type_id
        }
    );

    if (_poli_id != "-") {
        query.push({
            poli_id: _poli_id
        });
    }

    if (_status != "-") {
        query.push({
            status: _status
        });
    }

    if (_priority != "-") {
        query.push({
            priority: _priority
        });
    }

    if (_no_register != "-") {
        query.push({
            no_register: _no_register
        });
    }

    if (_patient_id != "-") {
        query.push({
            patient_id: _patient_id
        });
    }

    if (_payment_id != "-") {
        query.push({
            payment_id: _payment_id
        });
    }

    if (provider_id != "-") {
        query.push({
            provider_id: provider_id
        });
    }

    if (dokter_id != "-") {
        query.push({
            dokter_id: dokter_id
        });
    }

    if (status_pengunjung != "-") {
        query.push({
            status_pengunjung: status_pengunjung
        });
    }

    return new Promise(async function (resolve, reject) {
        try {
            await Queue.find({
                    $or: [{
                        nama_pasien: new RegExp(search, 'i')
                        },
                        {
                            no_rm: new RegExp(search, 'i')
                        }
                    ],
                    $and: query
                })
                .sort({
                    [key]: value
                })
                .limit(limit).skip(start)
                .populate('user_id')
                .populate('dokter_id')
                .populate('visit_type_id')
                .populate('patient_id')
                .populate('payment_id')
                .populate('admission_source')
                .populate('poli_id')
                .populate({
                    path: 'visit_id',
                    populate: [
                        {
                            path: 'provider_id'
                        }
                    ],
                })
                .populate('provider_id')
                .then(_data => {
                    resolve(_data);
                })
                .catch(err => {
                    if (err.kind === 'ObjectId') {
                        resolve('Data tidak ditemukan');
                    }
                });
        } catch (err) {
            if (err) reject(err);
        }
    });
}

function findOnePasien(_id) {
    return new Promise(async function (resolve, reject) {
        await Pasien.findById(_id)
        .then(data => {
            resolve(data);
        })
        .catch(err => {
            resolve("ERROR");
        })
    });
}

function findOneQueueByPasien(_pasien_id) {
    return new Promise(async function (resolve, reject) {
        Queue.find({
            $and: [
                {
                    patient_id: _pasien_id
                }
            ]
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function requestUrl(_url, _body) {
    return new Promise(async function (resolve, reject) {
        let options = {
            timeout : 60000,
            json    : true
        }

        needle.post(_url, _body, options, function(err, resp) {
            if (err) 
                reject('ERROR');

            resolve(resp.body)
        });
    });
}

function storeVisit(_data) {
    return new Promise(async function (resolve, reject) {
        const visit = new Visit(_data);
        
        visit.save()
        .then(_dataRes => {
            resolve(_dataRes);
        }).catch(err => {
            resolve("ERROR");
        });
    });
}

function storeQueue(_data) {
    return new Promise(async function (resolve, reject) {
        const queue = new Queue(_data);

        queue.save()
        .then(_dataRes => {
            resolve(_dataRes);
        }).catch(err => {
            resolve("ERROR");
        });
    });
}

function updateVisit(_id, _data) {
    return new Promise(async function (resolve, reject) {
        Visit.findByIdAndUpdate(_id, _data, {
            new: true
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function updateQueue(_id, _data) {
    return new Promise(async function (resolve, reject) {
        Queue.findByIdAndUpdate(_id, _data, {
            new: true
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function updateBilling(_id, _data) {
    return new Promise(async function (resolve, reject) {
        Billing.findByIdAndUpdate(_id, _data, {
            new: true
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function updateMonitorBilling(_id, _data) {
    return new Promise(async function (resolve, reject) {
        MonitoringBilling.findByIdAndUpdate(_id, _data, {
            new: true
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function updateDaftarInformasiLayanan(_id, _data) {
    return new Promise(async function (resolve, reject) {
        DaftarInformasiLayanan.findByIdAndUpdate(_id, _data, {
            new: true
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function deleteVisit(_id){
    return new Promise(async function (resolve, reject) {
        Visit.findByIdAndRemove(_id)
        .then(_data => {
            if (!_data) {
                resolve(false);
            }

            resolve(true);
        })
        .catch(err => {
            resolve(false);
        });
    });
}

function deleteQueue(_id){
    return new Promise(async function (resolve, reject) {
        Queue.findByIdAndRemove(_id)
        .then(_data => {
            if (!_data) {
                resolve(false);
            }

            resolve(true);
        })
        .catch(err => {
            resolve(false);
        });
    });
}

function deleteBilling(_visitId) {
    return new Promise(async function (resolve, reject) {
        Billing.remove({
            visit_id: _visitId
        })
            .then(_data => {
                if (!_data) {
                    resolve(false);
                }
                resolve(true);
            })
            .catch(err => {
                resolve(false);
            });
    });
}

function findOneBilling(_patient_id, _visit_id) {
    return new Promise(async function (resolve, reject) {
        await Billing.findOne({
            patient_id  : _patient_id,
            visit_id    : _visit_id,
        })
        .then(data => {
            resolve(data);
        })
        .catch(err => {
            resolve("ERROR");
        })
    });
}

function findOneMonitorBilling(_billing_id) {
    return new Promise(async function (resolve, reject) {
        await MonitoringBilling.findOne({
            billing_id  : _billing_id,
        })
        .then(data => {
            resolve(data);
        })
        .catch(err => {
            resolve("ERROR");
        })
    });
}

function findOneDaftarInformasiLayanan(_patient_id, _queue_id) {
    return new Promise(async function (resolve, reject) {
        await DaftarInformasiLayanan.findOne({
            patient_id  : _patient_id,
            queue_id    : _queue_id,
        })
        .then(data => {
            resolve(data);
        })
        .catch(err => {
            resolve("ERROR");
        })
    });
}

function storeDaftarInformasiLayanan(_data) {
    return new Promise(async function (resolve, reject) {
        const daftarInformasiLayanan = new DaftarInformasiLayanan(_data);
        
        daftarInformasiLayanan.save()
        .then(_dataRes => {
            resolve(_dataRes);
        }).catch(err => {
            resolve("ERROR");
        });
    });
}

function getOneQueue(_id) {
    return new Promise(async function (resolve, reject) {
        Queue.findOne({
            _id: _id
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function getOneVisit(_id) {
    return new Promise(async function (resolve, reject) {
        Visit.findOne({
            _id: _id
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function getOneVisitType(_id) {
    return new Promise(async function (resolve, reject) {
        VisitType.findOne({
            _id: _id
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function findOnePerujuk(_id) {
    return new Promise(async function (resolve, reject) {
        await Perujuk.findOne({
            _id  : _id
        })
        .then(data => {
            resolve(data);
        })
        .catch(err => {
            resolve("ERROR");
        })
    });
}

exports.findAllAdmissionSource = async (req, res) => {
    AdmissionSource.find()
    .then(_data => {
        let stat = {
            status: true,
            rc: "0000",
            message: "Data Admission Source",
            data: _data
        };

        logging.debug(`[PENDAFTARAN_RJ] FindAll Successfull => ${JSON.stringify(_data)}`);

        return res.status(200).send(stat);
    })
    .catch(err => {
        res.status(500).send({
            status: false,
            rc: "-",
            message: err.message || "Beberapa kesalahan terjadi saat mengambil data.",
            data: {

            }
        });
    });
};

function updatePasien(_id, _data) {
    return new Promise(async function (resolve, reject) {
        Pasien.findByIdAndUpdate(_id, _data, {
            new: true
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

exports.createBpjs = async (req, res) => {
    let config = iniParser.get();
    let dataBody = req.body;

    let dataPayment         = await getOneJenisPembayaranByName(PAYMENT_BPJS);
    let dataProvider         = await getOneJenisProviderByName(PAYMENT_BPJS);
    let dataPoli            = await getOnePoliklinikByKode(dataBody.request.t_sep.poli.tujuan);
    // let dataAdmissionSource = await getOneAdmissionSourceByName(ADMISSION_SOURCE_RUJUKAN);
    let dataAdmissionSource = await getOneAdmissionSourceByID(dataBody.admission_source);
    let dataPriority        = "normal";
    
    let bodyPendaftaran = {
        payment_id          : dataPayment._id,
        provider_id         : dataProvider._id,
        poli_id             : dataPoli._id,
        dokter_id           : dataBody.dokter_id,
        admission_source    : dataAdmissionSource._id,
        priority            : dataPriority,
        patient_id          : dataBody.patient_id,
        user_id             : dataBody.user_id,
        status_pengunjung   : dataBody.status_pengunjung,
        perujuk_id          : dataBody.perujuk_id,
        keterangan_perujuk  : '-',
        faskes_id           : dataBody.faskes_id,
        umur                : dataBody.umur,
        time_in             : dataBody.time_in,
        no_sep              : dataBody.no_sep,
        create_by           : dataBody.create_by,
        note                : dataBody.note,
    }

    let createPendaftaranRj = await requestUrl(config.pendaftaranRJ.url, bodyPendaftaran);
    logging.debug(`[PENDAFTARAN_RJ] Create Penjadaftaran RJ. >>> ${JSON.stringify(createPendaftaranRj)}`);

    return res.status(200).send({
        status  : createPendaftaranRj.status,
        code    : createPendaftaranRj.status === true ? "200" : "201",
        message : createPendaftaranRj.message,
    });
}

function getOneJenisPembayaranByName(_name) {
    return new Promise(async function (resolve, reject) {
        JenisPembayaran.findOne({
            name: _name
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function getOneJenisProviderByName(_name) {
    return new Promise(async function (resolve, reject) {
        Provider.findOne({
            name: _name
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function getOnePoliklinikByKode(_kode) {
    return new Promise(async function (resolve, reject) {
        Poliklinik.findOne({
            kode: _kode
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function getOneAdmissionSourceByName(_name) {
    return new Promise(async function (resolve, reject) {
        AdmissionSource.findOne({
            name: _name
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function getOneAdmissionSourceByID(_id) {
    return new Promise(async function (resolve, reject) {
        AdmissionSource.findOne({
            _id: _id
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

async function getNoAntri() {
    let from = moment().subtract(1, 'days').format("YYYY-MM-DD HH:mm:ss");
    let to = moment().add(1, 'days').format("YYYY-MM-DD HH:mm:ss");

    let dataQueue = await getQueueByTimeFrame(from, to);

    let pelayanan = "PL";
    let tanggalPerHari = moment().format("DD");
    let nomorUrut = dataQueue.length + 1;

    let nomorAntri = `${pelayanan}${tanggalPerHari}-${nomorUrut}`;

    return nomorAntri;
}

function getQueueByTimeFrame(_from, _to) {
    return new Promise(async function (resolve, reject) {
        Queue.find({
            createdAt: { $gte: _from, $lte: _to }
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function updateStatusTempatTidur(_id_tempat_tidur, _status) {
    return new Promise(async function (resolve, reject) {
        TempatTidur.findOneAndUpdate({
            $and: [{
                    _id: _id_tempat_tidur
                }
            ]
        }, {
            status: _status
        })
        .then(_data => {
            if (!_data) {
                resolve(false);
            } else {
                resolve(true);
            }
        })
        .catch(err => {
            resolve(false);
        });
    });
}

function findOneBilling(_patient_id, _visit_id) {
    return new Promise(async function (resolve, reject) {
        await Billing.findOne({
            patient_id: _patient_id,
            visit_id: _visit_id,
        })
        .then(data => {
            resolve(data);
        })
        .catch(err => {
            resolve("ERROR");
        })
    });
}

function updateBilling(_id, _data) {
    return new Promise(async function (resolve, reject) {
        Billing.findByIdAndUpdate(_id, _data, {
            new: true
        })
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function requestUrlGet(_url) {
    return new Promise(async function (resolve, reject) {
        needle('get', _url)
            .then(function (resp) {
                resolve(resp);
            })
            .catch(function (err) {
                resolve("ERROR");
            });
    });
}

function getOneLaporanPengeluaranPerujuk(_patient_id, _queue_id) {
    return new Promise(async function (resolve, reject) {
        LaporanPengeluaranPerujuk.findOne({
            patient_id: _patient_id,
            queue_id: _queue_id
        })
            .then(_data => {
                resolve(_data);
            })
            .catch(err => {
                resolve("ERROR");
            });
    });
}

function updateLaporanPengeluaranPerujuk(_id, _data) {
    return new Promise(async function (resolve, reject) {
        LaporanPengeluaranPerujuk.findByIdAndUpdate(_id, _data, {
            new: true
        })
            .then(_data => {
                resolve(_data);
            })
            .catch(err => {
                resolve("ERROR");
            });
    });
}

exports.getJumlahPasien = async (req, res) => {
    req.setTimeout(2000000);
    let from = req.params.from;
    let to = req.params.to;

    // let dataQueuePasienLama = await getDataQueuePasienLama(from, to);
    // logging.debug(`[PENDAFTARAN_RJ] Pasien Lama ${dataQueuePasienLama}.`);
    
    // let dataQueuePasienBaru = await getDataQueuePasienBaru(from, to);
    // logging.debug(`[PENDAFTARAN_RJ] Pasien Baru ${dataQueuePasienBaru}.`);

    // return res.status(200).send({
    //     status: true,
    //     message: `Jumlah Pasien Rawat Jalan dari tanggal ${from} sampai tanggal ${to}.`,
    //     data: {
    //         jumlah_pasien_lama: dataQueuePasienLama,
    //         jumlah_pasien_baru: dataQueuePasienBaru,
    //         total_pasien: dataQueuePasienLama + dataQueuePasienBaru
    //     }
    // });

    let dataRekap = await getdataRekap(from, to);

    let totalRekap = [];
    let dataQueuePasienLama = [];
    let dataQueuePasienBaru = [];
    let dataQueuePasienBatal = [];

    for (var key in dataRekap) {
        if (dataRekap[key].visit_id.time_in >= moment(from).format("YYYY-MM-DD HH:mm:ss") && dataRekap[key].visit_id.time_in <= moment(to).format("YYYY-MM-DD HH:mm:ss")) {
            totalRekap.push(dataRekap[key]);
            
            if (dataRekap[key].status_pengunjung == STATUS_PENGUNJUNG_PASIEN_LAMA) {
                dataQueuePasienLama.push(dataRekap[key]);
            }
    
            if (dataRekap[key].status_pengunjung == STATUS_PENGUNJUNG_PASIEN_BARU) {
                dataQueuePasienBaru.push(dataRekap[key]);
            }
    
            if (dataRekap[key].status == "selesai" && dataRekap[key].visit_id.status_pulang == "Batal") {
                dataQueuePasienBatal.push(dataRekap[key]);
            }
        }
    }

    logging.debug(`[PENDAFTARAN_RJ] Rekap Pendaftaran ${totalRekap.length}.`);
    logging.debug(`[PENDAFTARAN_RJ] Rekap Pasien Baru ${dataQueuePasienBaru.length}.`);
    logging.debug(`[PENDAFTARAN_RJ] Rekap Pasien Lama ${dataQueuePasienLama.length}.`);
    logging.debug(`[PENDAFTARAN_RJ] Rekap Pasien Batal ${dataQueuePasienBatal.length}.`);

    return res.status(200).send({
        status: true,
        message: `Jumlah Pasien Rawat Jalan dari tanggal ${from} sampai tanggal ${to}.`,
        data: {
            jumlah_pasien_lama: dataQueuePasienLama.length,
            jumlah_pasien_baru: dataQueuePasienBaru.length,
            jumlah_pasien_batal: dataQueuePasienBatal.length,
            // total_pasien: dataQueuePasienLama + dataQueuePasienBaru
            total_pasien: totalRekap.length
        }
    });
};

function getdataRekap(_from, _to) {
    let config = iniParser.get();

    return new Promise(async function (resolve, reject) {
        Queue.find({
            visit_type_id: config.visitType.rawatJalan
        })
        .populate("visit_id")
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function getDataQueuePasienLama(_from, _to) {
    let config = iniParser.get();

    return new Promise(async function (resolve, reject) {
        Queue.find({
            status_pengunjung: STATUS_PENGUNJUNG_PASIEN_LAMA,
            visit_type_id: config.visitType.rawatJalan
        })
        .populate("visit_id")
        .then(_data => {
            let newData = [];
            
            for (var key in _data) {
                if (_data[key].visit_id.time_in >= moment(_from).format("YYYY-MM-DD HH:mm:ss") && _data[key].visit_id.time_in <= moment(_to).format("YYYY-MM-DD HH:mm:ss")) {
                    newData.push(_data[key]);
                }
            }

            resolve(newData.length);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

function getDataQueuePasienBaru(_from, _to) {
    let config = iniParser.get();

    return new Promise(async function (resolve, reject) {
        Queue.find({
            status_pengunjung: STATUS_PENGUNJUNG_PASIEN_BARU,
            visit_type_id: config.visitType.rawatJalan
        })
        .populate("visit_id")
        .then(_data => {
            let newData = [];
            
            for (var key in _data) {
                if (_data[key].visit_id.time_in >= moment(_from).format("YYYY-MM-DD HH:mm:ss") && _data[key].visit_id.time_in <= moment(_to).format("YYYY-MM-DD HH:mm:ss")) {
                    newData.push(_data[key]);
                }
            }

            resolve(newData.length);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}

async function checkDate(date_input) {
    let dateNow = moment();
    let dateInput = moment(date_input);

    let dataTimeBefore = moment(dateNow).subtract(30, 'days');
    let dataTimeAfter = moment(dateNow).add(30, 'days');

    console.log("DATE NOW           >>> " + dateNow.format("YYYY-MM-DD HH:mm:ss"));
    console.log("DATE INPUT         >>> " + dateInput.format("YYYY-MM-DD HH:mm:ss"));
    console.log("DATE TIME BEFORE   >>> " + dataTimeBefore.format("YYYY-MM-DD HH:mm:ss"));
    console.log("DATE TIME AFTER    >>> " + dataTimeAfter.format("YYYY-MM-DD HH:mm:ss"));

    console.log("CHECK SEBELUM      >>> " + dataTimeBefore.isBefore(dateInput));
    console.log("CHECK SESUDAH      >>> " + dataTimeAfter.isAfter(dateInput));

    let result = false;
    if (dataTimeBefore.isBefore(dateInput) == true && dataTimeAfter.isAfter(dateInput) == true) {
        result = true;
    }

    console.log("RESULT CHECK       >>> " + result);

    return result;
}

async function checkDateTimeOut(visit_id, timeOut) {
    let dataVisit = await getOneVisit(visit_id);

    let dateTimeIn = moment(dataVisit.time_in);
    let dateTimeOut = moment(timeOut);
    let dateNow = moment();

    console.log("DATE TIME IN   >>> " + dateTimeIn.format("YYYY-MM-DD HH:mm:ss"));
    console.log("DATE TIME OUT  >>> " + dateTimeOut.format("YYYY-MM-DD HH:mm:ss"));
    console.log("DATE TIME NOW  >>> " + dateNow.format("YYYY-MM-DD HH:mm:ss"));

    console.log("CHECK MASUK    >>> " + dateTimeIn.isBefore(dateTimeOut));
    console.log("CHECK KELUAR   >>> " + dateNow.isAfter(dateTimeOut));

    let result = false;
    if (dateTimeOut.format("YYYY-MM-DD") == dateNow.format("YYYY-MM-DD")) {
        result = true;
    } else {
        if (dateTimeIn.isBefore(dateTimeOut) == true && dateNow.isAfter(dateTimeOut) == true) {
            result = true;
        }
    }

    return result;
}

exports.getJumlahPasienNew = async (req, res) => {
    let from = req.params.from;
    let to = req.params.to;

    let dataRekapNew = await getdataRekapNew(from, to);
    
    let dataQueuePasienLama = [];
    let dataQueuePasienBaru = [];
    let dataQueuePasienBatal = [];

    for (var key in dataRekapNew) {
        if (dataRekapNew[key].status_pengunjung == STATUS_PENGUNJUNG_PASIEN_LAMA) {
            dataQueuePasienLama.push(dataRekapNew[key]);
        }

        if (dataRekapNew[key].status_pengunjung == STATUS_PENGUNJUNG_PASIEN_BARU) {
            dataQueuePasienBaru.push(dataRekapNew[key]);
        }

        if (dataRekapNew[key].status == "selesai" && dataRekapNew[key].status_pulang == "Batal") {
            dataQueuePasienBatal.push(dataRekapNew[key]);
        }
    }

    logging.debug(`[PENDAFTARAN_RJ] Rekap Pendaftaran ${dataRekapNew.length}.`);
    logging.debug(`[PENDAFTARAN_RJ] Rekap Pasien Baru ${dataQueuePasienBaru.length}.`);
    logging.debug(`[PENDAFTARAN_RJ] Rekap Pasien Lama ${dataQueuePasienLama.length}.`);
    logging.debug(`[PENDAFTARAN_RJ] Rekap Pasien Batal ${dataQueuePasienBatal.length}.`);

    return res.status(200).send({
        status: true,
        message: `Jumlah Pasien Rawat Jalan dari tanggal ${from} sampai tanggal ${to}.`,
        data: {
            jumlah_pasien_lama: dataQueuePasienLama.length,
            jumlah_pasien_baru: dataQueuePasienBaru.length,
            jumlah_pasien_batal: dataQueuePasienBatal.length,
            // total_pasien: dataQueuePasienLama + dataQueuePasienBaru
            total_pasien: dataRekapNew.length
        }
    });
};

function getdataRekapNew(_from, _to) {
    let config = iniParser.get();

    return new Promise(async function (resolve, reject) {
        Queue.find({
            time_in: { $gte: _from, $lte: _to },
            visit_type_id: config.visitType.rawatJalan
        })
        .populate("visit_id")
        .then(_data => {
            resolve(_data);
        })
        .catch(err => {
            resolve("ERROR");
        });
    });
}