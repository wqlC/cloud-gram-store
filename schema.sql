-- CloudGramStore 数据库结构
-- 用于 Cloudflare D1 数据库

-- 文件夹表
CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- 文件表
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    folder_id INTEGER,
    size INTEGER NOT NULL,
    mime_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- 文件分片表
CREATE TABLE IF NOT EXISTS file_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    telegram_file_id TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE,
    UNIQUE(file_id, chunk_index)
);

-- 临时分片表（用于分片上传过程中暂存分片信息）
CREATE TABLE IF NOT EXISTS temp_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    telegram_file_id TEXT NOT NULL,
    size INTEGER NOT NULL,
    original_file_name TEXT NOT NULL,
    original_file_size INTEGER NOT NULL,
    folder_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    UNIQUE(upload_id, chunk_index)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_file_chunks_file_id ON file_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_file_chunks_telegram_file_id ON file_chunks(telegram_file_id);
CREATE INDEX IF NOT EXISTS idx_temp_chunks_upload_id ON temp_chunks(upload_id);
CREATE INDEX IF NOT EXISTS idx_temp_chunks_created_at ON temp_chunks(created_at);

-- 插入根目录（仅在不存在时插入）
INSERT OR IGNORE INTO folders (id, name, parent_id) VALUES (1, 'Root', NULL);
