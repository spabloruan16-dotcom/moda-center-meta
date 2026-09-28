require("dotenv").config();

const mysql = require("mysql2/promise");

const mysqlEnabled = String(process.env.DB_MODE || "json").toLowerCase() === "mysql";

const pool = mysqlEnabled
    ? mysql.createPool({
        host: process.env.MYSQL_HOST || "localhost",
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || "root",
        password: process.env.MYSQL_PASSWORD || "",
        database: process.env.MYSQL_DATABASE || "moda_center",
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    })
    : null;

async function ensureUsersTable() {
    if (!pool) return;

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id VARCHAR(64) PRIMARY KEY,
            nome VARCHAR(120) NOT NULL,
            email VARCHAR(190) NOT NULL UNIQUE,
            senha VARCHAR(255) NOT NULL,
            perfil ENUM('cliente', 'comerciante', 'administrador') NOT NULL DEFAULT 'cliente',
            avatar TEXT NULL,
            criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
}

async function testConnection() {
    if (!pool) throw new Error("DB_MODE nao esta configurado como mysql");
    const connection = await pool.getConnection();
    try {
        await connection.ping();
        await ensureUsersTable();
        console.log("MySQL conectado e tabela usuarios pronta.");
    } finally {
        connection.release();
    }
}

module.exports = { mysqlEnabled, pool, ensureUsersTable, testConnection };