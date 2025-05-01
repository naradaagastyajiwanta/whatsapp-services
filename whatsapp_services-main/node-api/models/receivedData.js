const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ReceivedData = sequelize.define('receivedData', {
    data_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    account_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    typeProject: {
        type: DataTypes.STRING,
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    totalSuccess: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    totalFailed: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    totalMessages: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    timestamps: true,
    tableName: 'receivedData'
});

module.exports = { ReceivedData };