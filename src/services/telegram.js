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
    // 降低分片大小以适应 Cloudflare Workers 的内存限制
    // 原来是 19MB，现在改为 5MB 以确保内存安全
    this.chunkSize = 5 * 1024 * 1024; // 5MB，在内存限制下更安全
  }

  /**
   * 上传文件到 Telegram
   * @param {Uint8Array} fileData - 文件数据
   * @param {string} fileName - 文件名
   * @returns {Array} 上传的telegramFileId列表
   */
  async uploadFile(fileData, fileName) {
    console.log(`[TELEGRAM] 开始上传文件到 Telegram: ${fileName}, 大小: ${fileData.length} 字节`);

    // 添加文件大小检查，避免超出内存限制
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB 限制
    if (fileData.length > MAX_FILE_SIZE) {
      throw new Error(`文件大小超出限制: ${fileData.length} 字节，最大允许: ${MAX_FILE_SIZE} 字节`);
    }

    try {
      // 计算分片数量和大小，但不创建所有分片
      const totalChunks = Math.ceil(fileData.length / this.chunkSize);
      console.log(`[TELEGRAM] 文件 ${fileName} 将分割为 ${totalChunks} 个分片`);

      const messageIds = [];

      // 流式处理：一次只处理一个分片
      for (let i = 0; i < totalChunks; i++) {
        const startOffset = i * this.chunkSize;
        const endOffset = Math.min(startOffset + this.chunkSize, fileData.length);

        // 创建单个分片，避免同时保存所有分片
        const chunk = fileData.slice(startOffset, endOffset);

        const chunkFileName = totalChunks > 1
          ? `${fileName}.part${i.toString().padStart(3, '0')}`
          : fileName;

        console.log(`[TELEGRAM] 上传分片 ${i+1}/${totalChunks}: ${chunkFileName}, 大小: ${chunk.length} 字节`);
        const startTime = Date.now();

        try {
          const telegramFileId = await this.uploadChunk(chunk, chunkFileName);
          const duration = Date.now() - startTime;
          console.log(`[TELEGRAM] 分片 ${i+1}/${totalChunks} 上传完成，用时: ${duration}ms, 文件ID: ${telegramFileId.substring(0, 10)}...`);

          messageIds.push({
            index: i,
            telegramFileId,
            size: chunk.length
          });
        } catch (chunkError) {
          console.error(`[TELEGRAM] [ERROR] 上传分片 ${i+1}/${totalChunks} 失败:`, chunkError);
          throw new Error(`上传分片 ${i+1}/${totalChunks} 失败: ${chunkError.message}`);
        }

        // 手动释放分片内存引用（虽然 JS 有垃圾回收，但显式释放有助于减少内存压力）
        // chunk 变量会在循环结束时自动超出作用域
      }

      console.log(`[TELEGRAM] 文件 ${fileName} 上传到 Telegram 完成，共 ${totalChunks} 个分片`);
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
        chunkIds: chunks.map(chunk => chunk.telegram_file_id).join(','),
        errorStack: error.stack,
        timestamp: new Date().toISOString()
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
   * 将文件分割成分片（已弃用，使用流式处理替代）
   * @deprecated 使用流式处理替代，避免内存溢出
   * @param {Uint8Array} fileData - 文件数据
   * @returns {Array} 分片数组
   */
  splitFileIntoChunks(fileData) {
    // 这个方法已经在 uploadFile 中用流式处理替代
    // 保留此方法以确保向后兼容，但不建议直接使用
    console.warn('[TELEGRAM] [DEPRECATED] splitFileIntoChunks 方法已弃用，建议使用流式处理');

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
    const chunkUploadStartTime = Date.now();
    console.log(`[TELEGRAM] [PERF] 开始上传分片到 Telegram: ${fileName}, 大小: ${chunkData.length} 字节`);

    try {
      // 步骤1: 创建 Blob 对象
      const blobStartTime = Date.now();
      console.log(`[TELEGRAM] [PERF] 步骤1: 开始创建 Blob 对象...`);

      const blob = new Blob([chunkData]);
      const blobTime = Date.now() - blobStartTime;
      console.log(`[TELEGRAM] [PERF] 步骤1: Blob 创建完成，耗时: ${blobTime}ms`);

      // 步骤2: 构建 FormData
      const formDataStartTime = Date.now();
      console.log(`[TELEGRAM] [PERF] 步骤2: 开始构建 FormData...`);

      const formData = new FormData();
      formData.append('chat_id', this.chatId);
      formData.append('document', blob, fileName);

      const formDataTime = Date.now() - formDataStartTime;
      console.log(`[TELEGRAM] [PERF] 步骤2: FormData 构建完成，耗时: ${formDataTime}ms`);

      // 步骤3: 发送网络请求
      const fetchStartTime = Date.now();
      console.log(`[TELEGRAM] [PERF] 步骤3: 开始发送 HTTP 请求到 Telegram API...`);
      console.log(`[TELEGRAM] [PERF] 请求URL: ${this.apiBaseUrl}/sendDocument`);
      console.log(`[TELEGRAM] [PERF] 请求方法: POST, Content-Type: multipart/form-data`);

      const response = await fetch(`${this.apiBaseUrl}/sendDocument`, {
        method: 'POST',
        body: formData
      });

      const fetchTime = Date.now() - fetchStartTime;
      console.log(`[TELEGRAM] [PERF] 步骤3: HTTP 请求完成，耗时: ${fetchTime}ms, 状态码: ${response.status}`);

      if (!response.ok) {
        console.error(`[TELEGRAM] [PERF] [ERROR] Telegram API 响应错误: ${response.status} ${response.statusText}`);
        throw new Error(`Telegram API HTTP error: ${response.status} ${response.statusText}`);
      }

      // 步骤4: 解析响应
      const jsonStartTime = Date.now();
      console.log(`[TELEGRAM] [PERF] 步骤4: 开始解析 JSON 响应...`);

      const result = await response.json();

      const jsonTime = Date.now() - jsonStartTime;
      console.log(`[TELEGRAM] [PERF] 步骤4: JSON 解析完成，耗时: ${jsonTime}ms`);

      if (!result.ok) {
        console.error(`[TELEGRAM] [PERF] [ERROR] Telegram API 返回错误: ${result.description}`);
        throw new Error(`Telegram API error: ${result.description}`);
      }

      // 总体性能统计
      const totalTime = Date.now() - chunkUploadStartTime;
      console.log(`[TELEGRAM] [PERF] === Telegram 上传性能统计 ===`);
      console.log(`[TELEGRAM] [PERF] Blob创建: ${blobTime}ms (${(blobTime/totalTime*100).toFixed(1)}%)`);
      console.log(`[TELEGRAM] [PERF] FormData构建: ${formDataTime}ms (${(formDataTime/totalTime*100).toFixed(1)}%)`);
      console.log(`[TELEGRAM] [PERF] HTTP请求: ${fetchTime}ms (${(fetchTime/totalTime*100).toFixed(1)}%)`);
      console.log(`[TELEGRAM] [PERF] JSON解析: ${jsonTime}ms (${(jsonTime/totalTime*100).toFixed(1)}%)`);
      console.log(`[TELEGRAM] [PERF] 总耗时: ${totalTime}ms`);
      console.log(`[TELEGRAM] [PERF] 网络传输速率: ${(chunkData.length / 1024 / 1024 / (fetchTime/1000)).toFixed(2)} MB/s`);
      console.log(`[TELEGRAM] [PERF] 整体传输速率: ${(chunkData.length / 1024 / 1024 / (totalTime/1000)).toFixed(2)} MB/s`);

      return result.result.document.file_id;
    } catch (error) {
      const totalTime = Date.now() - chunkUploadStartTime;
      console.error(`[TELEGRAM] [PERF] [ERROR] 上传分片到 Telegram 失败，总耗时: ${totalTime}ms:`, error);
      // 提供更详细的错误信息
      const errorMessage = error.message || 'Unknown error';
      const errorDetails = {
        fileName: fileName,
        chunkSize: chunkData.length,
        totalTime: totalTime,
        errorStack: error.stack
      };
      throw new Error(`上传分片到 Telegram 失败: ${errorMessage}`, { cause: errorDetails });
    }
  }

  /**
   * 从 Telegram 下载单个分片
   * @param {string} telegram_file_id - Telegram文件ID
   * @returns {Uint8Array} 分片数据
   */
  async downloadChunk(telegram_file_id) {
    try {
      // 首先获取文件信息
      console.log(`[TELEGRAM] 获取文件信息，文件ID: ${telegram_file_id.substring(0, 10)}...`);
      const fileInfo = await this.getFileInfo(telegram_file_id);
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
        telegram_file_id: telegram_file_id,
        errorStack: error.stack
      };
      throw new Error(`从 Telegram 下载分片失败: ${errorMessage}`, { cause: errorDetails });
    }
  }

  /**
   * 获取文件信息
   * @param {string} telegramFileId - Telegram文件ID
   * @returns {Object} 文件信息
   */
  async getFileInfo(telegramFileId) {
    try {
      console.log(`[TELEGRAM] 直接通过文件ID获取文件信息: ${telegramFileId.substring(0, 10)}...`);
      // 直接通过文件ID获取文件详细信息
      const fileResponse = await fetch(`${this.apiBaseUrl}/getFile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_id: telegramFileId
        })
      });

      const fileResult = await fileResponse.json();

      if (!fileResult.ok) {
        console.error(`[TELEGRAM] [ERROR] 获取文件信息失败: ${fileResult.description}`);
        throw new Error(`获取文件信息失败: ${fileResult.description}`);
      }

      return fileResult.result;
    } catch (error) {
      console.error(`[TELEGRAM] [ERROR] 获取文件信息失败:`, error);
      // 提供更详细的错误信息
      const errorMessage = error.message || 'Unknown error';
      const errorDetails = {
        telegram_file_id: telegramFileId,
        errorStack: error.stack
      };
      throw new Error(`获取文件信息失败: ${errorMessage}`, { cause: errorDetails });
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
