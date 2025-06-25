// Telegram 服务模块
// 提供 Telegram Bot API 文件存储功能

/**
 * Telegram 服务类
 */
export class TelegramService {
  constructor(botToken, chatId) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.apiBaseUrl = `https://api.telegram.org/bot${botToken}`;
    this.chunkSize = 20 * 1024 * 1024; // 20MB，Telegram 文件上传限制
  }

  /**
   * 上传文件到 Telegram
   * @param {Uint8Array} fileData - 文件数据
   * @param {string} fileName - 文件名
   * @returns {Array} 上传的消息ID列表
   */
  async uploadFile(fileData, fileName) {
    try {
      const chunks = this.splitFileIntoChunks(fileData);
      const messageIds = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkFileName = chunks.length > 1
          ? `${fileName}.part${i.toString().padStart(3, '0')}`
          : fileName;

        const messageId = await this.uploadChunk(chunk, chunkFileName);
        messageIds.push({
          index: i,
          messageId,
          size: chunk.length
        });
      }

      return messageIds;
    } catch (error) {
      console.error('Error uploading file to Telegram:', error);
      throw new Error('Failed to upload file to Telegram');
    }
  }

  /**
   * 从 Telegram 下载文件
   * @param {Array} chunks - 文件分片信息数组 [{ messageId, index, size }]
   * @returns {Uint8Array} 合并后的文件数据
   */
  async downloadFile(chunks) {
    try {
      // 按索引排序分片
      const sortedChunks = chunks.sort((a, b) => a.chunk_index - b.chunk_index);
      const chunkDataArray = [];

      for (const chunk of sortedChunks) {
        const chunkData = await this.downloadChunk(chunk.telegram_msg_id);
        chunkDataArray.push(chunkData);
      }

      // 合并所有分片
      return this.mergeChunks(chunkDataArray);
    } catch (error) {
      console.error('Error downloading file from Telegram:', error);
      throw new Error('Failed to download file from Telegram');
    }
  }

  /**
   * 删除 Telegram 中的文件
   * @param {Array} chunks - 文件分片信息数组
   */
  async deleteFile(chunks) {
    try {
      for (const chunk of chunks) {
        await this.deleteMessage(chunk.telegram_msg_id);
      }
    } catch (error) {
      console.error('Error deleting file from Telegram:', error);
      // 不抛出错误，因为删除失败不应该阻止数据库操作
    }
  }

  /**
   * 将文件分割成分片
   * @param {Uint8Array} fileData - 文件数据
   * @returns {Array} 分片数组
   */
  splitFileIntoChunks(fileData) {
    const chunks = [];
    let offset = 0;

    while (offset < fileData.length) {
      const chunkSize = Math.min(this.chunkSize, fileData.length - offset);
      const chunk = fileData.slice(offset, offset + chunkSize);
      chunks.push(chunk);
      offset += chunkSize;
    }

    return chunks;
  }

  /**
   * 合并文件分片
   * @param {Array} chunkDataArray - 分片数据数组
   * @returns {Uint8Array} 合并后的文件数据
   */
  mergeChunks(chunkDataArray) {
    // 计算总大小
    const totalSize = chunkDataArray.reduce((sum, chunk) => sum + chunk.length, 0);

    // 创建新的 Uint8Array
    const mergedData = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of chunkDataArray) {
      mergedData.set(chunk, offset);
      offset += chunk.length;
    }

    return mergedData;
  }

  /**
   * 上传单个分片到 Telegram
   * @param {Uint8Array} chunkData - 分片数据
   * @param {string} fileName - 文件名
   * @returns {string} 消息ID
   */
  async uploadChunk(chunkData, fileName) {
    try {
      const formData = new FormData();
      formData.append('chat_id', this.chatId);
      formData.append('document', new Blob([chunkData]), fileName);

      const response = await fetch(`${this.apiBaseUrl}/sendDocument`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(`Telegram API error: ${result.description}`);
      }

      return result.result.message_id.toString();
    } catch (error) {
      console.error('Error uploading chunk to Telegram:', error);
      throw error;
    }
  }

  /**
   * 从 Telegram 下载单个分片
   * @param {string} messageId - 消息ID
   * @returns {Uint8Array} 分片数据
   */
  async downloadChunk(messageId) {
    try {
      // 首先获取文件信息
      const fileInfo = await this.getFileInfo(messageId);

      // 然后下载文件
      const response = await fetch(`https://api.telegram.org/file/bot${this.botToken}/${fileInfo.file_path}`);

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.error('Error downloading chunk from Telegram:', error);
      throw error;
    }
  }

  /**
   * 获取文件信息
   * @param {string} messageId - 消息ID
   * @returns {Object} 文件信息
   */
  async getFileInfo(messageId) {
    try {
      // 首先获取消息信息
      const messageResponse = await fetch(`${this.apiBaseUrl}/getMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          message_id: parseInt(messageId)
        })
      });

      const messageResult = await messageResponse.json();

      if (!messageResult.ok) {
        throw new Error(`Failed to get message: ${messageResult.description}`);
      }

      const document = messageResult.result.document;
      if (!document) {
        throw new Error('No document found in message');
      }

      // 获取文件详细信息
      const fileResponse = await fetch(`${this.apiBaseUrl}/getFile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_id: document.file_id
        })
      });

      const fileResult = await fileResponse.json();

      if (!fileResult.ok) {
        throw new Error(`Failed to get file info: ${fileResult.description}`);
      }

      return fileResult.result;
    } catch (error) {
      console.error('Error getting file info from Telegram:', error);
      throw error;
    }
  }

  /**
   * 删除 Telegram 消息
   * @param {string} messageId - 消息ID
   */
  async deleteMessage(messageId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/deleteMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          message_id: parseInt(messageId)
        })
      });

      const result = await response.json();

      if (!result.ok) {
        console.warn(`Failed to delete message ${messageId}: ${result.description}`);
      }
    } catch (error) {
      console.warn('Error deleting message from Telegram:', error);
    }
  }

  /**
   * 测试 Bot 连接
   * @returns {boolean} 连接是否成功
   */
  async testConnection() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/getMe`);
      const result = await response.json();
      return result.ok;
    } catch (error) {
      console.error('Error testing Telegram connection:', error);
      return false;
    }
  }
}
