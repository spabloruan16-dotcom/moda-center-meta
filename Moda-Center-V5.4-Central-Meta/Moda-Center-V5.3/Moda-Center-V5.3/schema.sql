CREATE DATABASE IF NOT EXISTS moda_center CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE moda_center;

CREATE TABLE IF NOT EXISTS usuarios (
    id VARCHAR(64) PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    perfil ENUM('cliente', 'comerciante', 'administrador') NOT NULL DEFAULT 'cliente',
    avatar TEXT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;