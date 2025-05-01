const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Assistant = sequelize.define('assistants', {
    asst_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nomor_pengirim: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    timestamps: true,
});

module.exports = { Assistant };