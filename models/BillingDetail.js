const mongoose  = require('mongoose');
const iniParser = require('../libs/iniParser');
var config      = iniParser.get();
var ObjectId    = mongoose.Schema.Types.ObjectId;

const billingDetailSchema = mongoose.Schema({
    billing_type        : String,
    note                : String,
    count               : String,
    price               : String,
    total_price         : String,
    laba                : String,
    diskon              : String,
    billing_id          : {
        type    : ObjectId,
        ref     : config.mongodb.db_billing,
        required: true
    },
    product             : String,
    createdAt           : String,
    updatedAt           : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_billing_detail, billingDetailSchema, config.mongodb.db_billing_detail);