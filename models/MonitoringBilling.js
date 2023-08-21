const mongoose  = require('mongoose');
const iniParser = require('../libs/iniParser');
var config      = iniParser.get();
var ObjectId    = mongoose.Schema.Types.ObjectId;

const monitoringBillingSchema = mongoose.Schema({
    batas_billing   : String,
    status          : String,
    billing_id      : ObjectId,
    provider_id     : ObjectId,
    payment_id      : ObjectId,
    visit_type_id   : ObjectId,
    time_in         : String,
    time_out        : String,
    no_rm           : String,
    nama_pasien     : String,

    createdAt       : String,
    updatedAt       : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_monitoring_billing, monitoringBillingSchema, config.mongodb.db_monitoring_billing);