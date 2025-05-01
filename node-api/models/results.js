const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Results = sequelize.define('results', {
    result_id: {
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
    whatsapp_number: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    detail: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    timestamps: true,
    tableName: 'results'
});

module.exports = { Results };
//revisi 200125