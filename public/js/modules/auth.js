// 认证管理模块
// 负责用户认证和会话管理

export class AuthManager {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.currentUser = null;
    }

    /**
     * 用户登录
     */
    async login(username, password) {
        try {
            const response = await this.apiClient.login(username, password);

            if (response.success && response.token) {
                this.currentUser = response.user;
                return response;
            } else {
                throw new Error(response.message || '登录失败');
            }
        } catch (error) {
            console.error('登录失败:', error);
            throw new Error(error.message || '登录请求失败');
        }
    }

    /**
     * 用户登出
     */
    async logout() {
        try {
            await this.apiClient.logout();
            this.currentUser = null;
        } catch (error) {
            console.error('登出失败:', error);
            // 即使请求失败，也清除本地状态
            this.currentUser = null;
            this.apiClient.clearAuth();
            throw error;
        }
    }

    /**
     * 获取用户信息
     */
    async getUserInfo() {
        try {
            if (this.currentUser) {
                return this.currentUser;
            }

            const userInfo = await this.apiClient.getUserInfo();
            this.currentUser = userInfo;
            return userInfo;
        } catch (error) {
            console.error('获取用户信息失败:', error);
            // 如果获取用户信息失败，清除认证状态
            this.clearAuth();
            throw new Error('获取用户信息失败，请重新登录');
        }
    }

    /**
     * 检查是否已登录
     */
    isLoggedIn() {
        return this.apiClient.isAuthenticated();
    }

    /**
     * 获取当前用户
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * 清除认证状态
     */
    clearAuth() {
        this.currentUser = null;
        this.apiClient.clearAuth();
    }

    /**
     * 检查会话是否有效
     */
    async validateSession() {
        if (!this.isLoggedIn()) {
            return false;
        }

        try {
            await this.getUserInfo();
            return true;
        } catch (error) {
            console.warn('会话验证失败:', error);
            this.clearAuth();
            return false;
        }
    }

    /**
     * 自动刷新令牌（如果需要）
     */
    async refreshTokenIfNeeded() {
        // 由于使用的是简单的JWT令牌，这里可以添加令牌过期检查逻辑
        // 目前的实现中，如果令牌过期，会在API调用时返回401错误
        // 可以根据需要实现自动刷新机制
        return true;
    }

    /**
     * 处理认证错误
     */
    handleAuthError(error) {
        if (error.status === 401 || error.message.includes('Unauthorized')) {
            this.clearAuth();
            // 可以触发全局的重新登录事件
            window.dispatchEvent(new CustomEvent('auth:required'));
        }
    }
}
