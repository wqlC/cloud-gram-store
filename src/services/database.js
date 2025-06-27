// 数据库服务模块
// 提供 D1 数据库操作功能

/**
 * 数据库服务类
 */
export class DatabaseService {
  constructor(db) {
    this.db = db;
  }

  // ================== 文件夹操作 ==================

  /**
   * 根据父目录ID获取文件夹列表
   * @param {number|null} parentId - 父目录ID，null表示根目录
   * @returns {Array} 文件夹列表
   */
  async getFoldersByParent(parentId) {
    try {
      const query = parentId
        ? 'SELECT * FROM folders WHERE parent_id = ? ORDER BY name ASC'
        : 'SELECT * FROM folders WHERE parent_id IS NULL ORDER BY name ASC';

      const params = parentId ? [parentId] : [];
      const result = await this.db.prepare(query).bind(...params).all();
      return result.results || [];
    } catch (error) {
      console.error('Error getting folders by parent:', error);
      throw new Error('Failed to get folders');
    }
  }

  /**
   * 根据ID获取文件夹信息
   * @param {number} id - 文件夹ID
   * @returns {Object|null} 文件夹信息
   */
  async getFolderById(id) {
    try {
      const result = await this.db.prepare('SELECT * FROM folders WHERE id = ?').bind(id).first();
      return result || null;
    } catch (error) {
      console.error('Error getting folder by id:', error);
      throw new Error('Failed to get folder');
    }
  }

  /**
   * 创建文件夹
   * @param {string} name - 文件夹名称
   * @param {number|null} parentId - 父目录ID
   * @returns {Object} 创建的文件夹信息
   */
  async createFolder(name, parentId) {
    try {
      // 检查同级目录下是否已存在同名文件夹
      const existingQuery = parentId
        ? 'SELECT id FROM folders WHERE name = ? AND parent_id = ?'
        : 'SELECT id FROM folders WHERE name = ? AND parent_id IS NULL';

      const existingParams = parentId ? [name, parentId] : [name];
      const existing = await this.db.prepare(existingQuery).bind(...existingParams).first();

      if (existing) {
        throw new Error('Folder with the same name already exists');
      }

      // 创建文件夹
      const insertQuery = 'INSERT INTO folders (name, parent_id) VALUES (?, ?) RETURNING *';
      const result = await this.db.prepare(insertQuery).bind(name, parentId).first();

      return result;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  /**
   * 更新文件夹名称
   * @param {number} id - 文件夹ID
   * @param {string} name - 新名称
   * @returns {Object} 更新后的文件夹信息
   */
  async updateFolder(id, name) {
    try {
      // 检查文件夹是否存在
      const folder = await this.db.prepare('SELECT * FROM folders WHERE id = ?').bind(id).first();
      if (!folder) {
        throw new Error('Folder not found');
      }

      // 检查同级目录下是否已存在同名文件夹
      const existingQuery = folder.parent_id
        ? 'SELECT id FROM folders WHERE name = ? AND parent_id = ? AND id != ?'
        : 'SELECT id FROM folders WHERE name = ? AND parent_id IS NULL AND id != ?';

      const existingParams = folder.parent_id ? [name, folder.parent_id, id] : [name, id];
      const existing = await this.db.prepare(existingQuery).bind(...existingParams).first();

      if (existing) {
        throw new Error('Folder with the same name already exists');
      }

      // 更新文件夹
      const updateQuery = 'UPDATE folders SET name = ? WHERE id = ? RETURNING *';
      const result = await this.db.prepare(updateQuery).bind(name, id).first();

      return result;
    } catch (error) {
      console.error('Error updating folder:', error);
      throw error;
    }
  }

  /**
   * 删除文件夹（级联删除子文件夹和文件）
   * @param {number} id - 文件夹ID
   */
  async deleteFolder(id) {
    try {
      // 检查文件夹是否存在
      const folder = await this.db.prepare('SELECT * FROM folders WHERE id = ?').bind(id).first();
      if (!folder) {
        throw new Error('Folder not found');
      }

      // 删除文件夹（由于设置了外键约束CASCADE，会自动删除相关文件和子文件夹）
      await this.db.prepare('DELETE FROM folders WHERE id = ?').bind(id).run();
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw error;
    }
  }

  // ================== 文件操作 ==================

  /**
   * 根据文件夹ID获取文件列表
   * @param {number|null} folderId - 文件夹ID，null表示根目录
   * @returns {Array} 文件列表
   */
  async getFilesByFolder(folderId) {
    try {
      const query = folderId
        ? 'SELECT * FROM files WHERE folder_id = ? ORDER BY name ASC'
        : 'SELECT * FROM files WHERE folder_id IS NULL ORDER BY name ASC';

      const params = folderId ? [folderId] : [];
      const result = await this.db.prepare(query).bind(...params).all();
      return result.results || [];
    } catch (error) {
      console.error('Error getting files by folder:', error);
      throw new Error('Failed to get files');
    }
  }

  /**
   * 根据ID获取文件信息
   * @param {number} id - 文件ID
   * @returns {Object|null} 文件信息
   */
  async getFileById(id) {
    try {
      const result = await this.db.prepare('SELECT * FROM files WHERE id = ?').bind(id).first();
      return result || null;
    } catch (error) {
      console.error('Error getting file by id:', error);
      throw new Error('Failed to get file');
    }
  }

  /**
   * 创建文件记录
   * @param {string} name - 文件名
   * @param {number|null} folderId - 文件夹ID
   * @param {number} size - 文件大小
   * @param {string} mimeType - 文件类型
   * @returns {Object} 创建的文件信息
   */
  async createFile(name, folderId, size, mimeType) {
    try {
      // 检查同级目录下是否已存在同名文件
      const existingQuery = folderId
        ? 'SELECT id FROM files WHERE name = ? AND folder_id = ?'
        : 'SELECT id FROM files WHERE name = ? AND folder_id IS NULL';

      const existingParams = folderId ? [name, folderId] : [name];
      const existing = await this.db.prepare(existingQuery).bind(...existingParams).first();

      if (existing) {
        throw new Error('File with the same name already exists');
      }

      // 创建文件记录
      const insertQuery = 'INSERT INTO files (name, folder_id, size, mime_type) VALUES (?, ?, ?, ?) RETURNING *';
      const result = await this.db.prepare(insertQuery).bind(name, folderId, size, mimeType).first();

      return result;
    } catch (error) {
      console.error('Error creating file:', error);
      throw error;
    }
  }

  /**
   * 更新文件名称
   * @param {number} id - 文件ID
   * @param {string} name - 新名称
   * @returns {Object} 更新后的文件信息
   */
  async updateFile(id, name) {
    try {
      // 检查文件是否存在
      const file = await this.db.prepare('SELECT * FROM files WHERE id = ?').bind(id).first();
      if (!file) {
        throw new Error('File not found');
      }

      // 检查同级目录下是否已存在同名文件
      const existingQuery = file.folder_id
        ? 'SELECT id FROM files WHERE name = ? AND folder_id = ? AND id != ?'
        : 'SELECT id FROM files WHERE name = ? AND folder_id IS NULL AND id != ?';

      const existingParams = file.folder_id ? [name, file.folder_id, id] : [name, id];
      const existing = await this.db.prepare(existingQuery).bind(...existingParams).first();

      if (existing) {
        throw new Error('File with the same name already exists');
      }

      // 更新文件
      const updateQuery = 'UPDATE files SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *';
      const result = await this.db.prepare(updateQuery).bind(name, id).first();

      return result;
    } catch (error) {
      console.error('Error updating file:', error);
      throw error;
    }
  }

  /**
   * 删除文件
   * @param {number} id - 文件ID
   */
  async deleteFile(id) {
    try {
      // 检查文件是否存在
      const file = await this.db.prepare('SELECT * FROM files WHERE id = ?').bind(id).first();
      if (!file) {
        throw new Error('File not found');
      }

      // 删除文件（由于设置了外键约束CASCADE，会自动删除相关分片记录）
      await this.db.prepare('DELETE FROM files WHERE id = ?').bind(id).run();
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  // ================== 文件分片操作 ==================

  /**
   * 创建文件分片记录
   * @param {number} fileId - 文件ID
   * @param {number} chunkIndex - 分片索引
   * @param {string} telegramFileId - Telegram文件ID
   * @param {number} size - 分片大小
   * @returns {Object} 创建的分片信息
   */
  async createFileChunk(fileId, chunkIndex, telegramFileId, size) {
    try {
      const insertQuery = 'INSERT INTO file_chunks (file_id, chunk_index, telegram_file_id, size) VALUES (?, ?, ?, ?) RETURNING *';
      const result = await this.db.prepare(insertQuery).bind(fileId, chunkIndex, telegramFileId, size).first();

      return result;
    } catch (error) {
      console.error('Error creating file chunk:', error);
      throw error;
    }
  }

  /**
   * 获取文件的所有分片
   * @param {number} fileId - 文件ID
   * @returns {Array} 分片列表，按索引排序
   */
  async getFileChunks(fileId) {
    try {
      const query = 'SELECT * FROM file_chunks WHERE file_id = ? ORDER BY chunk_index ASC';
      const result = await this.db.prepare(query).bind(fileId).all();
      return result.results || [];
    } catch (error) {
      console.error('Error getting file chunks:', error);
      throw new Error('Failed to get file chunks');
    }
  }

  /**
   * 删除文件的所有分片
   * @param {number} fileId - 文件ID
   */
  async deleteFileChunks(fileId) {
    try {
      await this.db.prepare('DELETE FROM file_chunks WHERE file_id = ?').bind(fileId).run();
    } catch (error) {
      console.error('Error deleting file chunks:', error);
      throw error;
    }
  }

  // ================== 工具方法 ==================

  /**
   * 获取文件夹路径
   * @param {number} folderId - 文件夹ID
   * @returns {Array} 路径数组，从根目录到当前文件夹
   */
  async getFolderPath(folderId) {
    try {
      const path = [];
      let currentId = folderId;

      while (currentId) {
        const folder = await this.db.prepare('SELECT * FROM folders WHERE id = ?').bind(currentId).first();
        if (!folder) break;

        path.unshift(folder);
        currentId = folder.parent_id;
      }

      return path;
    } catch (error) {
      console.error('Error getting folder path:', error);
      throw new Error('Failed to get folder path');
    }
  }
}
