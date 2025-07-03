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
   * @returns {Array} 上传的telegramFileId列表
   */
  async uploadFile(fileData, fileName) {
    console.log(`[TELEGRAM] 开始上传文件到 Telegram: ${fileName}, 大小: ${fileData.length} 字节`);
    try {
      const chunks = this.splitFileIntoChunks(fileData);
      console.log(`[TELEGRAM] 文件 ${fileName} 已分割为 ${chunks.length} 个分片`);
      const messageIds = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkFileName = chunks.length > 1
          ? `${fileName}.part${i.toString().padStart(3, '0')}`
          : fileName;

        console.log(`[TELEGRAM] 上传分片 ${i+1}/${chunks.length}: ${chunkFileName}, 大小: ${chunk.length} 字节`);
        const startTime = Date.now();
        const telegramFileId = await this.uploadChunk(chunk, chunkFileName);
        const duration = Date.now() - startTime;
        console.log(`[TELEGRAM] 分片 ${i+1}/${chunks.length} 上传完成，用时: ${duration}ms, 文件ID: ${telegramFileId.substring(0, 10)}...`);
        
        messageIds.push({
          index: i,
          telegramFileId,
          size: chunk.length
        });
      }

      console.log(`[TELEGRAM] 文件 ${fileName} 上传到 Telegram 完成，共 ${chunks.length} 个分片`);
      return messageIds;
    } catch (error) {
      console.error(`[TELEGRAM] [ERROR] 上传文件 ${fileName} 到 Telegram 失败:`, error);
      // 提供更详细的错误信息
      const errorMessage = error.message || 'Unknown error';
      const errorDetails = {
        fileName: fileName,
        fileSize: fileData.length,
        errorStack: error.stack
      };
      throw new Error(`上传文件到 Telegram 失败: ${errorMessage}`, { cause: errorDetails });
    }
  }

  /**
   * 从 Telegram 下载文件
   * @param {Array} chunks - 文件分片信息数组 [{ telegram_file_id, chunk_index, size }]
   * @returns {Uint8Array} 合并后的文件数据
   */
  async downloadFile(chunks) {
    console.log(`[TELEGRAM] 开始从 Telegram 下载文件，共 ${chunks.length} 个分片`);
    try {
      // 按索引排序分片
      const sortedChunks = chunks.sort((a, b) => a.chunk_index - b.chunk_index);
      console.log(`[TELEGRAM] 分片已排序，准备下载`);
      const chunkDataArray = [];

      for (let i = 0; i < sortedChunks.length; i++) {
        const chunk = sortedChunks[i];
        console.log(`[TELEGRAM] 下载分片 ${i+1}/${sortedChunks.length}, 文件ID: ${chunk.telegram_file_id.substring(0, 10)}...`);
        const startTime = Date.now();
        const chunkData = await this.downloadChunk(chunk.telegram_file_id);
        const duration = Date.now() - startTime;
        console.log(`[TELEGRAM] 分片 ${i+1}/${sortedChunks.length} 下载完成，大小: ${chunkData.length} 字节，用时: ${duration}ms`);
        chunkDataArray.push(chunkData);
      }

      // 合并所有分片
      console.log(`[TELEGRAM] 所有分片下载完成，开始合并`);
      const mergedData = this.mergeChunks(chunkDataArray);
      console.log(`[TELEGRAM] 分片合并完成，总大小: ${mergedData.length} 字节`);
      return mergedData;
    } catch (error) {
      console.error(`[TELEGRAM] [ERROR] 从 Telegram 下载文件失败:`, error);
      // 提供更详细的错误信息
      const errorMessage = error.message || 'Unknown error';
      const errorDetails = {
        chunksCount: chunks.length,
        errorStack: error.stack
      };
      throw new Error(`从 Telegram 下载文件失败: ${errorMessage}`, { cause: errorDetails });
    }
  }

  /**
   * 删除 Telegram 中的文件
   * @param {Array} chunks - 文件分片信息数组
   */
  async deleteFile(chunks) {
    try {
      for (const chunk of chunks) {
        await this.deleteTelegramFileById(chunk.telegram_file_id);
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
   * @returns {string} telegramFile的ID
   */
  async uploadChunk(chunkData, fileName) {
    try {
      const formData = new FormData();
      formData.append('chat_id', this.chatId);
      formData.append('document', new Blob([chunkData]), fileName);

      console.log(`[TELEGRAM] 发送请求到 Telegram API: /sendDocument, 文件名: ${fileName}, 大小: ${chunkData.length} 字节`);
      const response = await fetch(`${this.apiBaseUrl}/sendDocument`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        console.error(`[TELEGRAM] [ERROR] Telegram API 响应错误: ${response.status} ${response.statusText}`);
        throw new Error(`Telegram API HTTP error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.ok) {
        console.error(`[TELEGRAM] [ERROR] Telegram API 返回错误: ${result.description}`);
        throw new Error(`Telegram API error: ${result.description}`);
      }

      return result.result.document.file_id;
    } catch (error) {
      console.error(`[TELEGRAM] [ERROR] 上传分片到 Telegram 失败:`, error);
      // 提供更详细的错误信息
      const errorMessage = error.message || 'Unknown error';
      const errorDetails = {
        fileName: fileName,
        chunkSize: chunkData.length,
        errorStack: error.stack
      };
      throw new Error(`上传分片到 Telegram 失败: ${errorMessage}`, { cause: errorDetails });
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
      console.log(`[TELEGRAM] 获取文件信息，文件ID: ${messageId.substring(0, 10)}...`);
      const fileInfo = await this.getFileInfo(messageId);
      console.log(`[TELEGRAM] 文件信息获取成功，文件路径: ${fileInfo.file_path}`);

      // 然后下载文件
      console.log(`[TELEGRAM] 开始下载文件: ${fileInfo.file_path}`);
      const response = await fetch(`https://api.telegram.org/file/bot${this.botToken}/${fileInfo.file_path}`);

      if (!response.ok) {
        console.error(`[TELEGRAM] [ERROR] 下载文件失败: ${response.status} ${response.statusText}`);
        throw new Error(`下载文件失败: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      console.log(`[TELEGRAM] 文件下载成功，大小: ${data.length} 字节`);
      return data;
    } catch (error) {
      console.error(`[TELEGRAM] [ERROR] 从 Telegram 下载分片失败:`, error);
      // 提供更详细的错误信息
      const errorMessage = error.message || 'Unknown error';
      const errorDetails = {
        messageId: messageId,
        errorStack: error.stack
      };
      throw new Error(`从 Telegram 下载分片失败: ${errorMessage}`, { cause: errorDetails });
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
   * 删除 Telegram 文件
   * @param {string} telegram_file_id - 文件id
   */
	// todo telegram 是否支持直接删除文件
  async deleteTelegramFileById(telegram_file_id) {
    try {
      // const response = await fetch(`${this.apiBaseUrl}/deleteMessage`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({
      //     chat_id: this.chatId,
      //     message_id: parseInt(telegram_file_id)
      //   })
      // });
			//
      // const result = await response.json();
			//
      // if (!result.ok) {
      //   console.warn(`Failed to delete message ${telegram_file_id}: ${result.description}`);
      // }
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
