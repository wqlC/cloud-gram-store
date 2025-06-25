// 认证服务模块
// 提供 JWT 认证功能

/**
 * 认证服务类
 */
export class AuthService {
  constructor(env) {
    this.env = env;
    this.jwtSecret = env.JWT_SECRET;
    this.adminUsername = env.ADMIN_USERNAME;
    this.adminPassword = env.ADMIN_PASSWORD || 'admin123'; // 默认密码，建议在环境变量中设置
  }

  /**
   * 用户登录
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @returns {Object} 登录结果
   */
  async login(username, password) {
    // 验证用户名和密码
    if (username !== this.adminUsername || password !== this.adminPassword) {
      throw new Error('Invalid username or password');
    }

    // 生成 JWT Token
    const token = await this.generateToken(username);

    return {
      success: true,
      token,
      user: {
        username: this.adminUsername
      }
    };
  }

  /**
   * 生成 JWT Token
   * @param {string} username - 用户名
   * @returns {string} JWT Token
   */
  async generateToken(username) {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const payload = {
      username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24小时有效期
    };

    const headerBase64 = this.base64UrlEncode(JSON.stringify(header));
    const payloadBase64 = this.base64UrlEncode(JSON.stringify(payload));

    const signature = await this.sign(`${headerBase64}.${payloadBase64}`);

    return `${headerBase64}.${payloadBase64}.${signature}`;
  }

  /**
   * 验证 JWT Token
   * @param {string} token - JWT Token
   * @returns {boolean} 验证结果
   */
  async verifyToken(token) {
    if (!token) {
      return false;
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }

      const [headerBase64, payloadBase64, signature] = parts;

      // 验证签名
      const expectedSignature = await this.sign(`${headerBase64}.${payloadBase64}`);
      if (signature !== expectedSignature) {
        return false;
      }

      // 验证有效期
      const payload = JSON.parse(this.base64UrlDecode(payloadBase64));
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp < now) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Token verification error:', error);
      return false;
    }
  }

  /**
   * 从请求中提取 Token
   * @param {Request} request - 请求对象
   * @returns {string|null} Token
   */
  extractToken(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * 签名数据
   * @param {string} data - 要签名的数据
   * @returns {string} 签名结果
   */
  async sign(data) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.jwtSecret);
    const messageData = encoder.encode(data);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    return this.base64UrlEncode(new Uint8Array(signature));
  }

  /**
   * Base64 URL 编码
   * @param {string|Uint8Array} data - 要编码的数据
   * @returns {string} 编码结果
   */
  base64UrlEncode(data) {
    let base64;
    if (typeof data === 'string') {
      base64 = btoa(data);
    } else {
      base64 = btoa(String.fromCharCode(...data));
    }

    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Base64 URL 解码
   * @param {string} data - 要解码的数据
   * @returns {string} 解码结果
   */
  base64UrlDecode(data) {
    let base64 = data
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    // 补齐 padding
    while (base64.length % 4) {
      base64 += '=';
    }

    return atob(base64);
  }
}
