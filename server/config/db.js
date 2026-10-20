const mysql = require('mysql2/promise');
const config = require('./config');

// Create MySQL connection pool
const pool = mysql.createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    dateStrings: true,
    multipleStatements: true
});

// Helper for single prepared statement execution
async function query(sql, params = []) {
    try {
        const [results] = await pool.execute(sql, params);
        return results;
    } catch (error) {
        console.error('Database Query Error:', error.message);
        console.error('SQL:', sql);
        console.error('Params:', params);
        throw error;
    }
}

// Transaction execution helper
async function withTransaction(callback) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// Test database connection at startup
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log(`[Database] Successfully connected to MySQL (${config.DB_NAME} at ${config.DB_HOST}:${config.DB_PORT})`);
        connection.release();
        return true;
    } catch (error) {
        console.warn(`[Database Warning] Could not connect to MySQL: ${error.message}`);
        console.warn(`[Database Hint] Please ensure MySQL 8 is running and verify DB_PASSWORD in .env`);
        return false;
    }
}

module.exports = {
    pool,
    query,
    withTransaction,
    testConnection
};
