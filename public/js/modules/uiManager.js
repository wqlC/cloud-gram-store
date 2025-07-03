// UI 管理模块
// 负责用户界面交互管理

export class UIManager {
    constructor() {
        this.modals = new Map();
        this.initializeModals();
    }

    /**
     * 初始化模态框
     */
    initializeModals() {
        const modalIds = [
            'uploadModal',
            'createFolderModal',
            'renameModal',
            'deleteModal'
        ];

        modalIds.forEach(id => {
            const modal = document.getElementById(id);
            if (modal) {
                this.modals.set(id, modal);
                this.bindModalEvents(modal);
            }
        });
    }

    /**
     * 绑定模态框事件
     */
    bindModalEvents(modal) {
        // 点击背景关闭模态框
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modal.id);
            }
        });

        // ESC 键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display !== 'none') {
                this.closeModal(modal.id);
            }
        });
    }

    /**
     * 显示模态框
     */
    showModal(modalId) {
        const modal = this.modals.get(modalId) || document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';

            // 聚焦到第一个输入框
            const firstInput = modal.querySelector('input[type="text"], input[type="password"], textarea');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    /**
     * 关闭模态框
     */
    closeModal(modalId) {
        const modal = this.modals.get(modalId) || document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';

            // 清空表单
            const form = modal.querySelector('form');
            if (form) {
                form.reset();
            }

            // 清空输入框
            const inputs = modal.querySelectorAll('input[type="text"], input[type="password"], textarea');
            inputs.forEach(input => {
                input.value = '';
            });
        }
    }

    /**
     * 显示创建文件夹模态框
     */
    showCreateFolderModal() {
        this.showModal('createFolderModal');
    }

    /**
     * 显示上传进度模态框
     */
    showUploadModal() {
        this.showModal('uploadModal');
    }

    /**
     * 隐藏上传进度模态框
     */
    hideUploadModal() {
        this.closeModal('uploadModal');
    }

    /**
     * 更新上传进度
     */
    updateUploadProgress(fileName, progress) {
        const fileNameElement = document.getElementById('uploadFileName');
        const percentElement = document.getElementById('uploadPercent');
        const progressFill = document.getElementById('progressBarFill');

        if (fileNameElement) {
            fileNameElement.textContent = fileName;
        }

        if (percentElement) {
            percentElement.textContent = `${Math.round(progress)}%`;
        }

        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }

        // 显示上传模态框
        this.showUploadModal();

        // 如果上传完成，延迟关闭模态框
        if (progress >= 100) {
            setTimeout(() => {
                this.hideUploadModal();
            }, 1500);
        }
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        const loading = document.getElementById('loading');
        const emptyState = document.getElementById('emptyState');

        if (loading) {
            loading.style.display = 'block';
        }

        if (emptyState) {
            emptyState.style.display = 'none';
        }

        // 隐藏文件项
        const fileItems = document.querySelectorAll('.file-item');
        fileItems.forEach(item => {
            item.style.display = 'none';
        });
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    /**
     * 显示空状态
     */
    showEmptyState() {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'block';
        }
    }

    /**
     * 隐藏空状态
     */
    hideEmptyState() {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
    }

    /**
     * 切换按钮加载状态
     */
    toggleButtonLoading(button, isLoading) {
        if (!button) return;

        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.innerHTML = '<span class="loading-spinner"></span> 处理中...';
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || button.textContent;
        }
    }

    /**
     * 显示确认对话框
     */
    showConfirm(title, message, onConfirm, onCancel = null) {
        // 创建确认对话框
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary confirm-cancel">取消</button>
                    <button class="btn btn-primary confirm-ok">确认</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';

        // 绑定事件
        const cancelBtn = modal.querySelector('.confirm-cancel');
        const okBtn = modal.querySelector('.confirm-ok');

        const cleanup = () => {
            document.body.removeChild(modal);
        };

        cancelBtn.addEventListener('click', () => {
            cleanup();
            if (onCancel) onCancel();
        });

        okBtn.addEventListener('click', () => {
            cleanup();
            onConfirm();
        });

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cleanup();
                if (onCancel) onCancel();
            }
        });

        // ESC 键关闭
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                document.removeEventListener('keydown', escHandler);
                if (onCancel) onCancel();
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * 显示提示信息
     */
    showTooltip(element, message, duration = 3000) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip-popup';
        tooltip.textContent = message;
        tooltip.style.cssText = `
            position: absolute;
            background: #333;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
        `;

        document.body.appendChild(tooltip);

        // 定位
        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';

        // 显示
        setTimeout(() => {
            tooltip.style.opacity = '1';
        }, 10);

        // 隐藏并移除
        setTimeout(() => {
            tooltip.style.opacity = '0';
            setTimeout(() => {
                if (tooltip.parentNode) {
                    document.body.removeChild(tooltip);
                }
            }, 300);
        }, duration);
    }

    /**
     * 设置页面标题
     */
    setPageTitle(title) {
        document.title = title ? `${title} - CloudGramStore` : 'CloudGramStore';
    }

    /**
     * 滚动到顶部
     */
    scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    /**
     * 复制文本到剪贴板
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.error('复制到剪贴板失败:', error);

            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();

            try {
                const success = document.execCommand('copy');
                document.body.removeChild(textArea);
                return success;
            } catch (fallbackError) {
                document.body.removeChild(textArea);
                return false;
            }
        }
    }

    /**
     * 获取设备类型
     */
    getDeviceType() {
        const width = window.innerWidth;
        if (width < 480) return 'mobile';
        if (width < 768) return 'tablet';
        return 'desktop';
    }

    /**
     * 检查是否为移动设备
     */
    isMobile() {
        return this.getDeviceType() === 'mobile';
    }

    /**
     * 防抖函数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * 节流函数
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * 显示全局加载中遮罩
     */
    showLoading(message = '加载中...') {
        let loadingMask = document.getElementById('globalLoadingMask');
        if (!loadingMask) {
            loadingMask = document.createElement('div');
            loadingMask.id = 'globalLoadingMask';
            loadingMask.style.cssText = `
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.3);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            spinner.style.cssText = `
                border: 6px solid #f3f3f3;
                border-top: 6px solid #3498db;
                border-radius: 50%;
                width: 48px;
                height: 48px;
                animation: spin 1s linear infinite;
            `;
            const text = document.createElement('div');
            text.innerText = message;
            text.style.cssText = 'color: #fff; margin-top: 16px; font-size: 18px;';
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display: flex; flex-direction: column; align-items: center;';
            wrap.appendChild(spinner);
            wrap.appendChild(text);
            loadingMask.appendChild(wrap);
            document.body.appendChild(loadingMask);
        } else {
            loadingMask.style.display = 'flex';
        }
    }

    /**
     * 隐藏全局加载中遮罩
     */
    hideLoading() {
        const loadingMask = document.getElementById('globalLoadingMask');
        if (loadingMask) {
            loadingMask.style.display = 'none';
        }
    }
}

/* 在全局样式中添加：
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
*/
