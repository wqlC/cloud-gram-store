// 路由工具模块
// 提供简单的路由匹配和处理功能

export class Router {
  constructor() {
    this.routes = [];
  }

  /**
   * 添加 GET 路由
   * @param {string} path - 路径，支持参数占位符如 '/api/files/:id'
   * @param {Function} handler - 处理函数
   */
  get(path, handler) {
    this.routes.push({ method: 'GET', path, handler });
  }

  /**
   * 添加 POST 路由
   * @param {string} path - 路径
   * @param {Function} handler - 处理函数
   */
  post(path, handler) {
    this.routes.push({ method: 'POST', path, handler });
  }

  /**
   * 添加 PUT 路由
   * @param {string} path - 路径
   * @param {Function} handler - 处理函数
   */
  put(path, handler) {
    this.routes.push({ method: 'PUT', path, handler });
  }

  /**
   * 添加 PATCH 路由
   * @param {string} path - 路径
   * @param {Function} handler - 处理函数
   */
  patch(path, handler) {
    this.routes.push({ method: 'PATCH', path, handler });
  }

  /**
   * 添加 DELETE 路由
   * @param {string} path - 路径
   * @param {Function} handler - 处理函数
   */
  delete(path, handler) {
    this.routes.push({ method: 'DELETE', path, handler });
  }

  /**
   * 处理请求
   * @param {Request} request - 请求对象
   * @returns {Promise<Response|null>} 响应对象或 null
   */
  async handle(request) {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    for (const route of this.routes) {
      if (route.method === method) {
        const match = this.matchPath(route.path, pathname);
        if (match) {
          try {
            return await route.handler(request, match.params);
          } catch (error) {
            console.error('Route handler error:', error);
            throw error;
          }
        }
      }
    }

    return null;
  }

  /**
   * 匹配路径并提取参数
   * @param {string} routePath - 路由路径模式
   * @param {string} requestPath - 请求路径
   * @returns {Object|null} 匹配结果，包含参数
   */
  matchPath(routePath, requestPath) {
    // 将路由路径转换为正则表达式
    const paramNames = [];
    const regexPattern = routePath
      .replace(/:[^\/]+/g, (match) => {
        paramNames.push(match.slice(1)); // 移除 ':' 前缀
        return '([^/]+)';
      })
      .replace(/\//g, '\\/');

    const regex = new RegExp(`^${regexPattern}$`);
    const match = requestPath.match(regex);

    if (!match) {
      return null;
    }

    // 提取参数值
    const params = {};
    for (let i = 0; i < paramNames.length; i++) {
      params[paramNames[i]] = match[i + 1];
    }

    return { params };
  }
}
