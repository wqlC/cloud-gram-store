import { DurableObject } from "cloudflare:workers";
import { AuthService } from './services/auth.js';
import { DatabaseService } from './services/database.js';
import { FileService } from './services/file.js';
import { TelegramService } from './services/telegram.js';
import { Router } from './utils/router.js';
import { corsHeaders, jsonResponse, errorResponse } from './utils/response.js';

/**
 * Welcome to Cloudflare Workers! This is your first Durable Objects application.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your Durable Object in action
 * - Run `npm run deploy` to publish your application
 *
 * Learn more at https://developers.cloudflare.com/durable-objects
 */

/**
 * Env provides a mechanism to reference bindings declared in wrangler.jsonc within JavaScript
 *
 * @typedef {Object} Env
 * @property {DurableObjectNamespace} MY_DURABLE_OBJECT - The Durable Object namespace binding
 */

/** A Durable Object's behavior is defined in an exported Javascript class */
export class MyDurableObject extends DurableObject {
	/**
	 * The constructor is invoked once upon creation of the Durable Object, i.e. the first call to
	 * 	`DurableObjectStub::get` for a given identifier (no-op constructors can be omitted)
	 *
	 * @param {DurableObjectState} ctx - The interface for interacting with Durable Object state
	 * @param {Env} env - The interface to reference bindings declared in wrangler.jsonc
	 */
	constructor(ctx, env) {
		super(ctx, env);
	}

	/**
	 * The Durable Object exposes an RPC method sayHello which will be invoked when when a Durable
	 *  Object instance receives a request from a Worker via the same method invocation on the stub
	 *
	 * @param {string} name - The name provided to a Durable Object instance from a Worker
	 * @returns {Promise<string>} The greeting to be sent back to the Worker
	 */
	async sayHello(name) {
		return `Hello, ${name}!`;
	}
}

export default {
  async fetch(request, env, ctx) {
    try {
      // 处理 CORS 预检请求
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      // 初始化服务
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
      const response = await router.handle(request);
      return response || errorResponse('Not Found', 404);

    } catch (error) {
      console.error('Error:', error);
      return errorResponse('Internal Server Error', 500);
    }
  }
};
