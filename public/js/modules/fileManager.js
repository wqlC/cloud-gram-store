// 文件管理模块
// 负责文件和文件夹的操作管理

export class FileManager {
    constructor(apiClient) {
        this.apiClient = apiClient;
    }

    /**
     * 获取目录内容
     */
    async getDirectoryContents(folderId = null) {
        try {
            return await this.apiClient.getEntries(folderId);
        } catch (error) {
            console.error('获取目录内容失败:', error);
            throw new Error('获取目录内容失败：' + error.message);
        }
    }

    /**
     * 创建文件夹
     */
    async createFolder(name, parentId = null) {
        try {
            return await this.apiClient.createFolder(name, parentId);
        } catch (error) {
            console.error('创建文件夹失败:', error);
            throw new Error('创建文件夹失败：' + error.message);
        }
    }

    /**
     * 更新文件夹名称
     */
    async updateFolderName(folderId, newName) {
        try {
            return await this.apiClient.updateFolder(folderId, newName);
        } catch (error) {
            console.error('重命名文件夹失败:', error);
            throw new Error('重命名文件夹失败：' + error.message);
        }
    }

    /**
     * 删除文件夹
     */
    async deleteFolder(folderId) {
        try {
            return await this.apiClient.deleteFolder(folderId);
        } catch (error) {
            console.error('删除文件夹失败:', error);
            throw new Error('删除文件夹失败：' + error.message);
        }
    }

    /**
     * 上传文件
     */
    async uploadFile(file, folderId = null, onProgress = null) {
        try {
            // 验证文件
            this.validateFile(file);

            // 使用 API 客户端上传文件
            const result = await this.apiClient.uploadFile(file, folderId, onProgress);

            return result;
        } catch (error) {
            console.error('上传文件失败:', error);
            throw new Error('上传文件失败：' + error.message);
        }
    }

    /**
     * 获取文件信息
     */
    async getFileInfo(fileId) {
        try {
            return await this.apiClient.getFileInfo(fileId);
        } catch (error) {
            console.error('获取文件信息失败:', error);
            throw new Error('获取文件信息失败：' + error.message);
        }
    }

    /**
     * 更新文件名称
     */
    async updateFileName(fileId, newName) {
        try {
            return await this.apiClient.updateFile(fileId, newName);
        } catch (error) {
            console.error('重命名文件失败:', error);
            throw new Error('重命名文件失败：' + error.message);
        }
    }

    /**
     * 删除文件
     */
    async deleteFile(fileId) {
        try {
            return await this.apiClient.deleteFile(fileId);
        } catch (error) {
            console.error('删除文件失败:', error);
            throw new Error('删除文件失败：' + error.message);
        }
    }

    /**
     * 下载文件
     */
    async downloadFile(fileId, fileName) {
        try {
            const response = await this.apiClient.downloadFile(fileId);

            // 创建下载链接
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            // 触发下载
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();

            // 清理
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error('下载文件失败:', error);
            throw new Error('下载文件失败：' + error.message);
        }
    }

    /**
     * 获取文件夹路径
     */
    async getFolderPath(folderId) {
			console.log('获取文件夹路径 folderId=' + folderId);
        try {
            // 由于后端没有直接提供路径API，这里使用递归方式构建路径
            // 实际项目中可以在后端实现一个专门的路径API
            const path = [];
            let currentId = folderId;

            while (currentId) {
                // 这里需要后端提供获取单个文件夹信息的API
                // 或者从目录列表中查找
                const folderInfo = await this.getFolderInfo(currentId);
                if (!folderInfo) break;

                path.unshift(folderInfo);
                currentId = folderInfo.parent_id;
            }

            return path;
        } catch (error) {
            console.error('获取文件夹路径失败:', error);
            return [];
        }
    }

    /**
     * 获取文件夹信息（辅助方法）
     */
    async getFolderInfo(folderId) {
        try {
            // 调用 API 客户端获取单个文件夹信息
            return await this.apiClient.getFolderInfo(folderId);
        } catch (error) {
            console.error('获取文件夹信息失败:', error);
            return null;
        }
    }

    /**
     * 验证文件
     */
    validateFile(file) {
        // 检查文件大小（最大 2GB）
        const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
        if (file.size > maxSize) {
            throw new Error('文件大小超过限制（最大 2GB）');
        }

        // 检查文件名
        if (!file.name || file.name.trim() === '') {
            throw new Error('文件名无效');
        }

        // 检查危险文件类型
        const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
        const fileExtension = this.getFileExtension(file.name).toLowerCase();

        if (dangerousExtensions.includes(fileExtension)) {
            throw new Error('出于安全考虑，不允许上传此类型的文件');
        }

        return true;
    }

    /**
     * 获取文件扩展名
     */
    getFileExtension(fileName) {
        const lastDotIndex = fileName.lastIndexOf('.');
        return lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 获取文件类型图标
     */
    getFileIcon(mimeType) {
        if (!mimeType) return '📄';

        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎥';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType.includes('pdf')) return '📕';
        if (mimeType.includes('word')) return '📘';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📗';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📙';
        if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return '🗜️';
        if (mimeType.startsWith('text/')) return '📝';

        return '📄';
    }

    /**
     * 批量上传文件
     */
    async uploadMultipleFiles(files, folderId = null, onProgress = null) {
        const results = [];
        const errors = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            try {
                const progressCallback = onProgress ? (progress) => {
                    onProgress(i, file.name, progress);
                } : null;

                const result = await this.uploadFile(file, folderId, progressCallback);
                results.push({ file: file.name, result, success: true });
            } catch (error) {
                console.error(`上传文件 ${file.name} 失败:`, error);
                errors.push({ file: file.name, error: error.message });
                results.push({ file: file.name, error: error.message, success: false });
            }
        }

        return {
            results,
            errors,
            successCount: results.filter(r => r.success).length,
            errorCount: errors.length
        };
    }
}
