// API 客户端模块
// 负责与后端 API 的通信

export class ApiClient {
    constructor() {
        this.baseUrl = '';
        this.token = localStorage.getItem('auth_token');
    }

    /**
     * 设置认证令牌
     */
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    /**
     * 获取认证令牌
     */
    getToken() {
        return this.token;
    }

    /**
     * 创建请求头
     */
    createHeaders(includeAuth = true, contentType = 'application/json') {
        const headers = {};

        if (contentType) {
            headers['Content-Type'] = contentType;
        }

        if (includeAuth && this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    /**
     * 发送 HTTP 请求
     */
    async request(url, options = {}) {
        const config = {
            method: 'GET',
            headers: this.createHeaders(options.includeAuth !== false, options.contentType),
            ...options
        };

        // 删除自定义选项，避免传递给 fetch
        delete config.includeAuth;
        delete config.contentType;

        try {
            const response = await fetch(`${this.baseUrl}${url}`, config);

            // 检查响应状态
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            // 对于下载请求，返回响应对象本身
            if (options.responseType === 'blob') {
                return response;
            }

            // 尝试解析 JSON 响应
            const contentType = response.headers.get('Content-Type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            return await response.text();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    /**
     * GET 请求
     */
    async get(url, options = {}) {
        return this.request(url, {
            method: 'GET',
            ...options
        });
    }

    /**
     * POST 请求
     */
    async post(url, data, options = {}) {
        const config = {
            method: 'POST',
            ...options
        };

        if (data instanceof FormData) {
            // FormData 不需要设置 Content-Type
            config.body = data;
            config.contentType = null;
        } else if (data) {
            config.body = JSON.stringify(data);
        }

        return this.request(url, config);
    }

    /**
     * PUT 请求
     */
    async put(url, data, options = {}) {
        const config = {
            method: 'PUT',
            ...options
        };

        if (data) {
            config.body = JSON.stringify(data);
        }

        return this.request(url, config);
    }

    /**
     * PATCH 请求
     */
    async patch(url, data, options = {}) {
        const config = {
            method: 'PATCH',
            ...options
        };

        if (data) {
            config.body = JSON.stringify(data);
        }

        return this.request(url, config);
    }

    /**
     * DELETE 请求
     */
    async delete(url, options = {}) {
        return this.request(url, {
            method: 'DELETE',
            ...options
        });
    }

    /**
     * 上传文件
     */
    async uploadFile(file, folderId = null, onProgress = null) {
        const formData = new FormData();
        formData.append('file', file);
        if (folderId) {
            formData.append('folder_id', folderId);
        }

        // 如果需要进度回调，使用 XMLHttpRequest
        if (onProgress) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        onProgress(percentComplete);
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const result = JSON.parse(xhr.responseText);
                            resolve(result);
                        } catch (error) {
                            reject(new Error('Invalid JSON response'));
                        }
                    } else {
                        try {
                            const errorData = JSON.parse(xhr.responseText);
                            reject(new Error(errorData.message || `Upload failed: ${xhr.statusText}`));
                        } catch {
                            reject(new Error(`Upload failed: ${xhr.statusText}`));
                        }
                    }
                });

                xhr.addEventListener('error', () => {
                    reject(new Error('Upload failed'));
                });

                xhr.addEventListener('abort', () => {
                    reject(new Error('Upload aborted'));
                });

                xhr.open('POST', `${this.baseUrl}/api/files`);

                if (this.token) {
                    xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
                }

                xhr.send(formData);
            });
        }

        // 没有进度回调，使用普通的 fetch
        return this.post('/api/files', formData);
    }

    /**
     * 下载文件
     */
    async downloadFile(fileId) {
        const response = await this.request(`/api/files/${fileId}/download`, {
            responseType: 'blob'
        });

        return response;
    }

    // ========== 认证相关 API ==========

    /**
     * 用户登录
     */
    async login(username, password) {
        const response = await this.post('/api/login', {
            username,
            password
        }, { includeAuth: false });

        if (response.token) {
            this.setToken(response.token);
        }

        return response;
    }

    /**
     * 用户登出
     */
    async logout() {
        try {
            await this.post('/api/logout');
        } finally {
            this.setToken(null);
        }
    }

    /**
     * 获取用户信息
     */
    async getUserInfo() {
        return this.get('/api/user');
    }

    // ========== 目录和文件 API ==========

    /**
     * 获取目录内容
     */
    async getEntries(parentId = null) {
        const params = parentId ? `?parent_id=${parentId}` : '';
        return this.get(`/api/entries${params}`);
    }

    /**
     * 创建文件夹
     */
    async createFolder(name, parentId = null) {
        return this.post('/api/folders', {
            name,
            parent_id: parentId
        });
    }

    /**
     * 更新文件夹名称
     */
    async updateFolder(folderId, name) {
        return this.patch(`/api/folders/${folderId}`, {
            name
        });
    }

    /**
     * 删除文件夹
     */
    async deleteFolder(folderId) {
        return this.delete(`/api/folders/${folderId}`);
    }

    /**
     * 获取文件信息
     */
    async getFileInfo(fileId) {
        return this.get(`/api/files/${fileId}`);
    }

    /**
     * 更新文件名称
     */
    async updateFile(fileId, name) {
        return this.patch(`/api/files/${fileId}`, {
            name
        });
    }

    /**
     * 删除文件
     */
    async deleteFile(fileId) {
        return this.delete(`/api/files/${fileId}`);
    }

    // ========== 工具方法 ==========

    /**
     * 检查是否已认证
     */
    isAuthenticated() {
        return !!this.token;
    }

    /**
     * 清除认证状态
     */
    clearAuth() {
        this.setToken(null);
    }
}
