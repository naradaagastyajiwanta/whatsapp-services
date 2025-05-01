const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const User = sequelize.define('users', {
    user_id: { 
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING(100),
        allowNull: false
    }
}, {
    timestamps: true, 
    tableName: 'users'
});

module.exports = { User };