import { DurableObject } from "cloudflare:workers";
import { AuthService } from './services/auth.js';
import { DatabaseService } from './services/database.js';
import { FileService } from './services/file.js';
import { TelegramService } from './services/telegram.js';
import { Router } from './utils/router.js';
import { corsHeaders, jsonResponse, errorResponse } from './utils/response.js';

export default {
  async fetch(request, env, ctx) {
    const requestId = crypto.randomUUID();
    const requestStart = Date.now();
    const requestUrl = request.url;
    const requestMethod = request.method;

    console.log(`[REQUEST] ${requestId} - ${requestMethod} ${requestUrl} - 开始处理`);

    try {
      // 处理 CORS 预检请求
      if (request.method === 'OPTIONS') {
        console.log(`[REQUEST] ${requestId} - OPTIONS 预检请求 - 返回CORS头`);
        return new Response(null, { headers: corsHeaders });
      }

      // 初始化服务
      console.log(`[REQUEST] ${requestId} - 初始化服务`);
      const db = new DatabaseService(env.DB);
      const auth = new AuthService(env);
      const telegram = new TelegramService(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID);
      const fileService = new FileService(db, telegram);

      // 创建路由器
      const router = new Router();

      // 静态文件服务
      router.get('/', () => {
        return env.ASSETS.fetch(new Request('https://example.com/index.html'));
      });

      // 认证相关路由
      router.post('/api/login', async (request) => {
        const { username, password } = await request.json();
        const result = await auth.login(username, password);
        return jsonResponse(result);
      });

      router.post('/api/logout', async () => {
        return jsonResponse({ success: true });
      });

      router.get('/api/user', async (request) => {
        const token = auth.extractToken(request);
        if (!auth.verifyToken(token)) {
          return errorResponse('Unauthorized', 401);
        }
        return jsonResponse({ username: env.ADMIN_USERNAME });
      });

      // 目录内容查询
      router.get('/api/entries', async (request) => {
        const token = auth.extractToken(request);
        if (!auth.verifyToken(token)) {
          return errorResponse('Unauthorized', 401);
        }

        const url = new URL(request.url);
        const parentId = url.searchParams.get('parent_id') || null;

        const folders = await db.getFoldersByParent(parentId);
        const files = await db.getFilesByFolder(parentId);

        return jsonResponse({ folders, files });
      });

      // 文件夹操作
      router.post('/api/folders', async (request) => {
        const token = auth.extractToken(request);
        if (!auth.verifyToken(token)) {
          return errorResponse('Unauthorized', 401);
        }

        const { name, parent_id } = await request.json();
        const folder = await db.createFolder(name, parent_id);
        return jsonResponse(folder);
      });

      router.get('/api/folders/:id', async (request, params) => {
        const token = auth.extractToken(request);
        if (!auth.verifyToken(token)) {
          return errorResponse('Unauthorized', 401);
        }

        const folder = await db.getFolderById(params.id);
        if (!folder) {
          return errorResponse('Folder not found', 404);
        }
        return jsonResponse(folder);
      });

      router.patch('/api/folders/:id', async (request, params) => {
        const token = auth.extractToken(request);
        if (!auth.verifyToken(token)) {
          return errorResponse('Unauthorized', 401);
        }

        const { name } = await request.json();
        const folder = await db.updateFolder(params.id, name);
        return jsonResponse(folder);
      });

      router.delete('/api/folders/:id', async (request, params) => {
        const token = auth.extractToken(request);
        if (!auth.verifyToken(token)) {
          return errorResponse('Unauthorized', 401);
        }

        await db.deleteFolder(params.id);
        return jsonResponse({ success: true });
      });

      // 文件操作
      router.post('/api/files', async (request) => {
        const token = auth.extractToken(request);
        if (!auth.verifyToken(token)) {
          return errorResponse('Unauthorized', 401);
        }

        const formData = await request.formData();
        const file = formData.get('file');
        const folderId = formData.get('folder_id') || null;

        if (!file) {
          return errorResponse('No file provided', 400);
        }

        const result = await fileService.uploadFile(file, folderId);
        return jsonResponse(result);
      });

      // 分片上传接口
      router.post('/api/files/chunk', async (request) => {
        const token = auth.extractToken(request);
        if (!auth.verifyToken(token)) {
          return errorResponse('Unauthorized', 401);
        }

        const formData = await request.formData();
        const chunkFile = formData.get('chunk');
        const uploadId = formData.get('upload_id');
        const chunkIndex = parseInt(formData.get('chunk_index'));
        const totalChunks = parseInt(formData.get('total_chunks'));
        const originalFileName = formData.get('original_file_name');
        const originalFileSize = parseInt(formData.get('original_file_size'));
        const folderId = formData.get('folder_id') || null;

        if (!chunkFile) {
          return errorResponse('No chunk file provided', 400);
        }

        if (!uploadId || isNaN(chunkIndex) || isNaN(totalChunks) || !originalFileName || isNaN(originalFileSize)) {
          return errorResponse('Missing required chunk parameters', 400);
        }

        const result = await fileService.uploadFileChunk(
          chunkFile, uploadId, chunkIndex, totalChunks, originalFileName, originalFileSize, folderId
        );
        return jsonResponse(result);
      });

      // 分片合并接口
      router.post('/api/files/merge', async (request) => {
        const token = auth.extractToken(request);
        if (!auth.verifyToken(token)) {
          return errorResponse('Unauthorized', 401);
        }

        const { upload_id, file_name, file_size, mime_type, folder_id, chunks } = await request.json();

        if (!upload_id || !file_name || !file_size || !chunks || !Array.isArray(chunks)) {
          return errorResponse('Missing required merge parameters', 400);
        }

        const result = await fileService.mergeFileChunks(
          upload_id, file_name, file_size, mime_type, folder_id, chunks
        );
        return jsonResponse(result);
      });

      // 清理失败上传接口
      router.delete('/api/files/upload/:uploadId', async (request, params) => {
        const token = auth.extractToken(request);
        if (!auth.verifyToken(token)) {
          return errorResponse('Unauthorized', 401);
        }

        const { uploadId } = params;
        if (!uploadId) {
          return errorResponse('Upload ID is required', 400);
        }

        const result = await fileService.cleanupFailedUpload(uploadId);
        return jsonResponse(result);
      });

      router.get('/api/files/:id', async (request, params) => {
        const token = auth.extractToken(request);
        if (!auth.verifyToken(token)) {
          return errorResponse('Unauthorized', 401);
        }

        const fileInfo = await db.getFileById(params.id);
        if (!fileInfo) {
          return errorResponse('File not found', 404);
        }

        const chunks = await db.getFileChunks(params.id);
        return jsonResponse({ ...fileInfo, chunks });
      });

      router.get('/api/files/:id/download', async (request, params) => {
        const token = auth.extractToken(request);
        if (!auth.verifyToken(token)) {
          return errorResponse('Unauthorized', 401);
        }

        const fileData = await fileService.downloadFile(params.id);
        if (!fileData) {
          return errorResponse('File not found', 404);
        }

        return new Response(fileData.data, {
          headers: {
            'Content-Type': fileData.mimeType || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${fileData.name}"`,
            ...corsHeaders
          }
        });
      });

      router.patch('/api/files/:id', async (request, params) => {
        const token = auth.extractToken(request);
        if (!auth.verifyToken(token)) {
          return errorResponse('Unauthorized', 401);
        }

        const { name } = await request.json();
        const file = await db.updateFile(params.id, name);
        return jsonResponse(file);
      });

      router.delete('/api/files/:id', async (request, params) => {
        const token = auth.extractToken(request);
        if (!auth.verifyToken(token)) {
          return errorResponse('Unauthorized', 401);
        }

        await fileService.deleteFile(params.id);
        return jsonResponse({ success: true });
      });

      // 处理路由
      console.log(`[REQUEST] ${requestId} - 开始路由处理`);
      const response = await router.handle(request);

      if (!response) {
        console.log(`[REQUEST] ${requestId} - 未找到匹配路由 - 返回404`);
        return errorResponse('Not Found', 404);
      }

      const requestDuration = Date.now() - requestStart;
      console.log(`[REQUEST] ${requestId} - ${requestMethod} ${requestUrl} - 处理完成 - 耗时: ${requestDuration}ms - 状态码: ${response.status}`);
      return response;

    } catch (error) {
      const requestDuration = Date.now() - requestStart;
      console.error(`[REQUEST] [ERROR] ${requestId} - ${requestMethod} ${requestUrl} - 处理失败 - 耗时: ${requestDuration}ms`, error);

      // 提取错误详情
      const errorMessage = error.message || 'Unknown error';
      const errorDetails = error.cause ? error.cause : {
        url: requestUrl,
        method: requestMethod,
        stack: error.stack
      };

      // 返回详细的错误信息
      return errorResponse(errorMessage, 500, errorDetails);
    }
  }
};
