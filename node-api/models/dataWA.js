const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const WASession = sequelize.define('WASession', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    session_data: {
        type: DataTypes.TEXT('long'),
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'wa_sessions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = WASession;