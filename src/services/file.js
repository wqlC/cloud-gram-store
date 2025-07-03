// 文件服务模块
// 整合数据库操作和 Telegram 服务，提供完整的文件管理功能

/**
 * 文件服务类
 */
export class FileService {
  constructor(databaseService, telegramService) {
    this.db = databaseService;
    this.telegram = telegramService;
  }

  /**
   * 上传文件
   * @param {File} file - 文件对象
   * @param {number|null} folderId - 文件夹ID
   * @returns {Object} 上传结果
   */
  async uploadFile(file, folderId) {
    console.log(`[INFO] 开始上传文件: ${file.name}, 大小: ${file.size} 字节, 文件夹ID: ${folderId || 'root'}`);
    try {
      // 获取文件数据
      const arrayBuffer = await file.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      // 确定 MIME 类型
      const mimeType = file.type || 'application/octet-stream';
      console.log(`[INFO] 文件 ${file.name} MIME类型: ${mimeType}`);

      // 上传到 Telegram
      console.log(`[INFO] 开始上传文件 ${file.name} 到 Telegram`);
      const telegramChunks = await this.telegram.uploadFile(fileData, file.name);
      console.log(`[INFO] 文件 ${file.name} 上传到 Telegram 完成，共 ${telegramChunks.length} 个分片`);

      // 创建文件记录
      console.log(`[INFO] 为文件 ${file.name} 创建数据库记录`);
      const fileRecord = await this.db.createFile(
        file.name,
        folderId,
        file.size,
        mimeType
      );

      // 创建分片记录
      const chunkRecords = [];
      for (const chunk of telegramChunks) {
        console.log(`[INFO] 为文件 ${file.name} 创建分片记录 ${chunk.index + 1}/${telegramChunks.length}`);
        const chunkRecord = await this.db.createFileChunk(
          fileRecord.id,
          chunk.index,
          chunk.telegramFileId,
          chunk.size
        );
        chunkRecords.push(chunkRecord);
      }

      console.log(`[INFO] 文件 ${file.name} 上传完成，文件ID: ${fileRecord.id}`);
      return {
        ...fileRecord,
        chunks: chunkRecords
      };
    } catch (error) {
      console.error(`[ERROR] 上传文件 ${file.name} 失败:`, error);
      // 提供更详细的错误信息
      const errorMessage = error.message || 'Unknown error';
      const errorDetails = {
        fileName: file.name,
        fileSize: file.size,
        folderId: folderId,
        errorStack: error.stack
      };
      throw new Error(`上传文件失败: ${errorMessage}`, { cause: errorDetails });
    }
  }

  /**
   * 下载文件
   * @param {number} fileId - 文件ID
   * @returns {Object|null} 文件数据和元信息
   */
  async downloadFile(fileId) {
    console.log(`[INFO] 开始下载文件，文件ID: ${fileId}`);
    try {
      // 获取文件信息
      console.log(`[INFO] 获取文件信息，文件ID: ${fileId}`);
      const fileInfo = await this.db.getFileById(fileId);
      if (!fileInfo) {
        console.error(`[ERROR] 文件不存在，文件ID: ${fileId}`);
        return null;
      }
      console.log(`[INFO] 文件信息获取成功: ${fileInfo.name}, 大小: ${fileInfo.size} 字节`);

      // 获取文件分片
      console.log(`[INFO] 获取文件分片，文件ID: ${fileId}`);
      const chunks = await this.db.getFileChunks(fileId);
      if (!chunks || chunks.length === 0) {
        console.error(`[ERROR] 未找到文件分片，文件ID: ${fileId}`);
        throw new Error('未找到文件分片');
      }
      console.log(`[INFO] 文件分片获取成功，共 ${chunks.length} 个分片`);

      // 从 Telegram 下载文件
      console.log(`[INFO] 开始从 Telegram 下载文件 ${fileInfo.name}`);
      const fileData = await this.telegram.downloadFile(chunks);
      console.log(`[INFO] 文件 ${fileInfo.name} 从 Telegram 下载完成，大小: ${fileData.length} 字节`);

      return {
        data: fileData,
        name: fileInfo.name,
        mimeType: fileInfo.mime_type,
        size: fileInfo.size
      };
    } catch (error) {
      console.error(`[ERROR] 下载文件失败，文件ID: ${fileId}:`, error);
      // 提供更详细的错误信息
      const errorMessage = error.message || 'Unknown error';
      const errorDetails = {
        fileId: fileId,
        errorStack: error.stack
      };
      throw new Error(`下载文件失败: ${errorMessage}`, { cause: errorDetails });
    }
  }

  /**
   * 删除文件
   * @param {number} fileId - 文件ID
   */
  async deleteFile(fileId) {
    try {
      // 获取文件分片信息
      const chunks = await this.db.getFileChunks(fileId);

      // 从 Telegram 删除文件
      if (chunks && chunks.length > 0) {
        await this.telegram.deleteFile(chunks);
      }

      // 从数据库删除文件记录（会级联删除分片记录）
      await this.db.deleteFile(fileId);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file');
    }
  }

  /**
   * 获取文件信息和分片详情
   * @param {number} fileId - 文件ID
   * @returns {Object|null} 文件信息
   */
  async getFileInfo(fileId) {
    try {
      const fileInfo = await this.db.getFileById(fileId);
      if (!fileInfo) {
        return null;
      }

      const chunks = await this.db.getFileChunks(fileId);

      return {
        ...fileInfo,
        chunks
      };
    } catch (error) {
      console.error('Error getting file info:', error);
      throw new Error('Failed to get file info');
    }
  }

  /**
   * 更新文件名
   * @param {number} fileId - 文件ID
   * @param {string} newName - 新文件名
   * @returns {Object} 更新后的文件信息
   */
  async updateFileName(fileId, newName) {
    try {
      return await this.db.updateFile(fileId, newName);
    } catch (error) {
      console.error('Error updating file name:', error);
      throw error;
    }
  }

  /**
   * 获取目录内容（文件和文件夹）
   * @param {number|null} parentId - 父目录ID
   * @returns {Object} 目录内容
   */
  async getDirectoryContents(parentId) {
    try {
      const folders = await this.db.getFoldersByParent(parentId);
      const files = await this.db.getFilesByFolder(parentId);

      return {
        folders,
        files
      };
    } catch (error) {
      console.error('Error getting directory contents:', error);
      throw new Error('Failed to get directory contents');
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
      return await this.db.createFolder(name, parentId);
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  /**
   * 更新文件夹名称
   * @param {number} folderId - 文件夹ID
   * @param {string} newName - 新名称
   * @returns {Object} 更新后的文件夹信息
   */
  async updateFolderName(folderId, newName) {
    try {
      return await this.db.updateFolder(folderId, newName);
    } catch (error) {
      console.error('Error updating folder name:', error);
      throw error;
    }
  }

  /**
   * 删除文件夹
   * @param {number} folderId - 文件夹ID
   */
  async deleteFolder(folderId) {
    try {
      // 获取文件夹中的所有文件
      const files = await this.db.getFilesByFolder(folderId);

      // 递归删除子文件夹中的文件
      const subFolders = await this.db.getFoldersByParent(folderId);
      for (const subFolder of subFolders) {
        await this.deleteFolder(subFolder.id);
      }

      // 删除当前文件夹中的所有文件
      for (const file of files) {
        await this.deleteFile(file.id);
      }

      // 删除文件夹记录
      await this.db.deleteFolder(folderId);
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw new Error('Failed to delete folder');
    }
  }

  /**
   * 获取文件夹路径
   * @param {number} folderId - 文件夹ID
   * @returns {Array} 路径数组
   */
  async getFolderPath(folderId) {
    try {
      return await this.db.getFolderPath(folderId);
    } catch (error) {
      console.error('Error getting folder path:', error);
      throw new Error('Failed to get folder path');
    }
  }

  /**
   * 验证文件格式
   * @param {File} file - 文件对象
   * @returns {boolean} 验证结果
   */
  validateFile(file) {
    // 检查文件大小（最大 2GB）
    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
    if (file.size > maxSize) {
      throw new Error('File size exceeds maximum limit (2GB)');
    }

    // 检查文件名
    if (!file.name || file.name.trim() === '') {
      throw new Error('Invalid file name');
    }

    // 检查危险文件类型
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
    const fileExtension = this.getFileExtension(file.name).toLowerCase();

    if (dangerousExtensions.includes(fileExtension)) {
      throw new Error('File type not allowed for security reasons');
    }

    return true;
  }

  /**
   * 获取文件扩展名
   * @param {string} fileName - 文件名
   * @returns {string} 文件扩展名
   */
  getFileExtension(fileName) {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 获取文件类型图标
   * @param {string} mimeType - MIME 类型
   * @returns {string} 图标类名
   */
  getFileIcon(mimeType) {
    if (!mimeType) return 'file-unknown';

    if (mimeType.startsWith('image/')) return 'file-image';
    if (mimeType.startsWith('video/')) return 'file-video';
    if (mimeType.startsWith('audio/')) return 'file-audio';
    if (mimeType.includes('pdf')) return 'file-pdf';
    if (mimeType.includes('word')) return 'file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'file-excel';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'file-powerpoint';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return 'file-zip';
    if (mimeType.startsWith('text/')) return 'file-text';

    return 'file-unknown';
  }
}
