-- 词典数据库结构（MySQL / TiDB 兼容）
-- 使用方法: mysql -u root -p < db/schema.sql
-- 或: 在 TiDB Cloud 的 SQL Editor / 本地客户端里逐段执行

CREATE DATABASE IF NOT EXISTS dictionary
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE dictionary;

CREATE TABLE IF NOT EXISTS entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  word VARCHAR(255) NOT NULL COMMENT '查询词（英文/拼音/中文）',
  traditional VARCHAR(255) NOT NULL DEFAULT '' COMMENT '繁体或别名',
  pinyin VARCHAR(255) NOT NULL DEFAULT '' COMMENT '拼音',
  definition MEDIUMTEXT COMMENT '释义',
  source VARCHAR(32) NOT NULL DEFAULT '' COMMENT '数据来源，如 CEDICT',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_word (word)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
