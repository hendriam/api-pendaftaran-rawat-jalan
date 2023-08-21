const mongoose  = require('mongoose');
const iniParser = require('../libs/iniParser');
var ObjectId    = mongoose.Schema.Types.ObjectId;
var config      = iniParser.get();

const userSchema = mongoose.Schema({
    username        : String,
    name            : String,
    email           : String,
    phone           : String,
    status          : String,
    password        : String,
    role_id         : ObjectId,
    datapegawai_id  : ObjectId,
    createdAt       : String,
    updatedAt       : String
}, {
    timestamps: false
});

module.exports = mongoose.model(config.mongodb.db_users, userSchema, config.mongodb.db_users);