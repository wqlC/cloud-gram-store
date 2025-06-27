// 响应工具模块
// 提供统一的响应格式和 CORS 头部设置

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * 创建 JSON 响应
 * @param {any} data - 响应数据
 * @param {number} status - HTTP 状态码
 * @returns {Response} Response 对象
 */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

/**
 * 创建错误响应
 * @param {string} message - 错误消息
 * @param {number} status - HTTP 状态码
 * @returns {Response} Response 对象
 */
export function errorResponse(message, status = 400) {
  return jsonResponse({
    error: true,
    message
  }, status);
}
