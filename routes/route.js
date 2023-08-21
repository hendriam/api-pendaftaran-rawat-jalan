module.exports = (app) => {
    const pendaftaranRawatJalan = require('../controllers/controller.js');

    app.post('/create', pendaftaranRawatJalan.create);

    app.put('/update', pendaftaranRawatJalan.update);
    
    app.put('/pulangkan', pendaftaranRawatJalan.pulangkan);

    app.post('/list', pendaftaranRawatJalan.findAllPost);

    app.post('/list/new', pendaftaranRawatJalan.findAllPostNew);

    app.get('/list/:poli/:status/:priority/:from/:to', pendaftaranRawatJalan.findAllGet);

    app.get('/list/:Id', pendaftaranRawatJalan.findOne);
    
    app.put('/pindah-layanan', pendaftaranRawatJalan.pindahLayanan);
    
    app.get('/admission-source/list', pendaftaranRawatJalan.findAllAdmissionSource);
    
    app.post('/create/bpjs', pendaftaranRawatJalan.createBpjs);

    app.get('/jumlah-pasien/from/:from/to/:to', pendaftaranRawatJalan.getJumlahPasien);

    app.get('/jumlah-pasien-baru/from/:from/to/:to', pendaftaranRawatJalan.getJumlahPasienNew);

    app.put('/buka/:Id', pendaftaranRawatJalan.open);
};