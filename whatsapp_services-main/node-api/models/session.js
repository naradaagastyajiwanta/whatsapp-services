const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Session = sequelize.define('sessions', {
    session_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false
    },
    account_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false
    },
    whatsapp_number: {
        type: DataTypes.STRING,
        allowNull: false
    },
}, {
    timestamps: true,
    tableName: 'sessions'
});


module.exports = { Session };
