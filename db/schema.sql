-- 词典数据库结构（MySQL / TiDB 兼容）
-- 同时支持两类数据：
--   CEDICT  -> 拼音(pinyin)、繁体(traditional)
--   ECDICT  -> 音标(phonetic)、词性(pos)、考试标签(tag)、词形变化(exchange)、音频(audio)
-- 使用方法: mysql -u root -p < db/schema.sql
-- 或: 在 TiDB Cloud 的 SQL Editor / 本地客户端里逐段执行

CREATE DATABASE IF NOT EXISTS dictionary
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE dictionary;

CREATE TABLE IF NOT EXISTS entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  word VARCHAR(255) NOT NULL COMMENT '查询词',
  traditional VARCHAR(255) NOT NULL DEFAULT '' COMMENT '繁体（CEDICT）',
  pinyin VARCHAR(255) NOT NULL DEFAULT '' COMMENT '拼音（CEDICT）',
  phonetic VARCHAR(255) NOT NULL DEFAULT '' COMMENT '音标 IPA（ECDICT）',
  definition MEDIUMTEXT COMMENT '释义（中文+英文，多行）',
  pos VARCHAR(64) NOT NULL DEFAULT '' COMMENT '词性，如 n/v/adj，/ 分隔（ECDICT）',
  tag VARCHAR(128) NOT NULL DEFAULT '' COMMENT '考试标签，如 zk gk cet4 cet6 ky toefl ielts gre（ECDICT）',
  exchange VARCHAR(255) NOT NULL DEFAULT '' COMMENT '词形变化，如 p:did/d:done/i:doing/3:does（ECDICT）',
  audio VARCHAR(255) NOT NULL DEFAULT '' COMMENT '读音音频 URL',
  source VARCHAR(32) NOT NULL DEFAULT '' COMMENT '数据来源：CEDICT / ECDICT',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_word (word)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
