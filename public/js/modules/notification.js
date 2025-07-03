// 通知管理模块
// 负责系统通知的显示和管理

export class NotificationManager {
    constructor() {
        this.container = document.getElementById('notification') || this.createContainer();
        this.notifications = new Map();
        this.nextId = 1;
    }

    /**
     * 创建通知容器
     */
    createContainer() {
        const container = document.createElement('div');
        container.id = 'notification';
        container.className = 'notification';
        document.body.appendChild(container);
        return container;
    }

    /**
     * 显示成功通知
     */
    success(title, message = '', duration = 5000) {
        return this.show('success', title, message, duration);
    }

    /**
   * 显示错误通知，支持可选详情展开
   * @param {string} title - 通知标题
   * @param {string} message - 通知消息
   * @param {number} duration - 显示时长（毫秒）
   * @param {string|Object} details - 错误详情，可以是字符串或对象
   * @returns {number} 通知ID
   */
  error(title, message = '', duration = 8000, details = '') {
    const id = this.show('error', title, message, duration);
    if (details) {
      const notification = this.notifications.get(id);
      if (notification) {
        const content = notification.element.querySelector('.notification-content');
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'notification-details';
        
        // 处理不同类型的详情
        if (typeof details === 'object') {
          try {
            // 格式化JSON对象
            detailsDiv.innerHTML = '<pre>' + this.formatErrorDetails(details) + '</pre>';
          } catch (e) {
            detailsDiv.textContent = JSON.stringify(details, null, 2);
          }
        } else {
          detailsDiv.textContent = details;
        }
        
        content.appendChild(detailsDiv);
        const btn = document.createElement('button');
        btn.className = 'show-details';
        btn.textContent = '查看详情';
        btn.onclick = () => {
          detailsDiv.classList.toggle('show');
          btn.textContent = detailsDiv.classList.contains('show') ? '收起详情' : '查看详情';
        };
        content.appendChild(btn);
      }
    }
    return id;
  }

    /**
     * 显示警告通知
     */
    warning(title, message = '', duration = 6000) {
        return this.show('warning', title, message, duration);
    }

    /**
     * 显示信息通知
     */
    info(title, message = '', duration = 5000) {
        return this.show('info', title, message, duration);
    }

    /**
     * 显示通知
     */
    show(type, title, message = '', duration = 5000) {
        const id = this.nextId++;
        const notification = this.createNotification(id, type, title, message);

        this.notifications.set(id, notification);
        this.container.appendChild(notification.element);

        // 显示动画
        setTimeout(() => {
            notification.element.style.opacity = '1';
            notification.element.style.transform = 'translateX(0)';
        }, 10);

        // 自动关闭
        if (duration > 0) {
            notification.timer = setTimeout(() => {
                this.hide(id);
            }, duration);
        }

        return id;
    }

    /**
     * 创建通知元素
     */
    createNotification(id, type, title, message) {
        const element = document.createElement('div');
        element.className = `notification-item notification-${type}`;
        element.style.cssText = `
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;

        const icon = this.getIcon(type);

        element.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <div class="notification-title">${this.escapeHtml(title)}</div>
                ${message ? `<div class="notification-message">${this.escapeHtml(message)}</div>` : ''}
            </div>
            <button class="notification-close">&times;</button>
        `;

        // 绑定关闭按钮事件
        const closeBtn = element.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.hide(id);
        });

        // 点击通知本身也可以关闭（除了按钮）
        element.addEventListener('click', (e) => {
            if (e.target !== closeBtn) {
                this.hide(id);
            }
        });

        return {
            element,
            timer: null
        };
    }

    /**
     * 隐藏通知
     */
    hide(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        // 清除定时器
        if (notification.timer) {
            clearTimeout(notification.timer);
        }

        // 隐藏动画
        notification.element.style.opacity = '0';
        notification.element.style.transform = 'translateX(100%)';

        // 移除元素
        setTimeout(() => {
            if (notification.element.parentNode) {
                this.container.removeChild(notification.element);
            }
            this.notifications.delete(id);
        }, 300);
    }

    /**
     * 清除所有通知
     */
    clear() {
        this.notifications.forEach((_, id) => {
            this.hide(id);
        });
    }

    /**
     * 获取类型图标
     */
    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    /**
   * 转义 HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * 格式化错误详情
   * @param {Object} details - 错误详情对象
   * @returns {string} 格式化后的HTML
   */
  formatErrorDetails(details) {
    if (!details) return '';
    
    let html = '';
    
    // 处理常见的错误属性
    const commonProps = ['fileName', 'fileId', 'fileSize', 'folderId', 'url', 'method', 'timestamp'];
    for (const prop of commonProps) {
      if (details[prop] !== undefined) {
        html += `<strong>${this.formatPropName(prop)}:</strong> ${this.escapeHtml(String(details[prop]))}<br>`;
      }
    }
    
    // 处理错误堆栈
    if (details.errorStack) {
      html += `<strong>错误堆栈:</strong><br><code>${this.escapeHtml(details.errorStack)}</code>`;
    } else if (details.stack) {
      html += `<strong>错误堆栈:</strong><br><code>${this.escapeHtml(details.stack)}</code>`;
    }
    
    // 处理其他属性
    for (const prop in details) {
      if (!commonProps.includes(prop) && prop !== 'errorStack' && prop !== 'stack') {
        const value = typeof details[prop] === 'object' 
          ? JSON.stringify(details[prop], null, 2)
          : String(details[prop]);
        html += `<strong>${this.formatPropName(prop)}:</strong> ${this.escapeHtml(value)}<br>`;
      }
    }
    
    return html;
  }
  
  /**
   * 格式化属性名称
   * @param {string} prop - 属性名
   * @returns {string} 格式化后的属性名
   */
  formatPropName(prop) {
    // 将驼峰命名转换为空格分隔的单词，并首字母大写
    return prop
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/Id$/, 'ID')
      .replace(/Url$/, 'URL');
  }

    /**
     * 显示加载通知
     */
    loading(title, message = '') {
        const id = this.show('info', title, message, 0);
        const notification = this.notifications.get(id);

        if (notification) {
            // 添加加载动画
            const icon = notification.element.querySelector('.notification-icon');
            icon.innerHTML = '<div class="loading-spinner"></div>';
            icon.style.animation = 'spin 1s linear infinite';
        }

        return id;
    }

    /**
     * 更新通知内容
     */
    update(id, title, message = '') {
        const notification = this.notifications.get(id);
        if (!notification) return;

        const titleElement = notification.element.querySelector('.notification-title');
        const messageElement = notification.element.querySelector('.notification-message');

        if (titleElement) {
            titleElement.textContent = title;
        }

        if (message) {
            if (messageElement) {
                messageElement.textContent = message;
            } else {
                // 添加消息元素
                const content = notification.element.querySelector('.notification-content');
                const newMessage = document.createElement('div');
                newMessage.className = 'notification-message';
                newMessage.textContent = message;
                content.appendChild(newMessage);
            }
        }
    }

    /**
     * 显示进度通知
     */
    progress(title, progress = 0, message = '') {
        const id = this.show('info', title, message, 0);
        const notification = this.notifications.get(id);

        if (notification) {
            // 添加进度条
            const content = notification.element.querySelector('.notification-content');
            const progressBar = document.createElement('div');
            progressBar.className = 'notification-progress';
            progressBar.innerHTML = `
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: ${progress}%"></div>
                </div>
                <div class="progress-text">${Math.round(progress)}%</div>
            `;
            content.appendChild(progressBar);
        }

        return id;
    }

    /**
     * 更新进度
     */
    updateProgress(id, progress, message = '') {
        const notification = this.notifications.get(id);
        if (!notification) return;

        const progressFill = notification.element.querySelector('.progress-bar-fill');
        const progressText = notification.element.querySelector('.progress-text');
        const messageElement = notification.element.querySelector('.notification-message');

        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }

        if (progressText) {
            progressText.textContent = `${Math.round(progress)}%`;
        }

        if (message && messageElement) {
            messageElement.textContent = message;
        }

        // 如果进度完成，自动关闭
        if (progress >= 100) {
            setTimeout(() => {
                this.hide(id);
            }, 2000);
        }
    }

    /**
     * 显示确认通知
     */
    confirm(title, message, onConfirm, onCancel = null) {
        const id = this.show('warning', title, message, 0);
        const notification = this.notifications.get(id);

        if (notification) {
            // 添加确认按钮
            const content = notification.element.querySelector('.notification-content');
            const buttons = document.createElement('div');
            buttons.className = 'notification-buttons';
            buttons.innerHTML = `
                <button class="btn btn-secondary btn-sm confirm-cancel">取消</button>
                <button class="btn btn-primary btn-sm confirm-ok">确认</button>
            `;
            content.appendChild(buttons);

            // 隐藏关闭按钮
            const closeBtn = notification.element.querySelector('.notification-close');
            closeBtn.style.display = 'none';

            // 绑定按钮事件
            const cancelBtn = buttons.querySelector('.confirm-cancel');
            const okBtn = buttons.querySelector('.confirm-ok');

            cancelBtn.addEventListener('click', () => {
                this.hide(id);
                if (onCancel) onCancel();
            });

            okBtn.addEventListener('click', () => {
                this.hide(id);
                onConfirm();
            });
        }

        return id;
    }

    /**
     * 获取当前通知数量
     */
    getCount() {
        return this.notifications.size;
    }

    /**
     * 检查是否有通知
     */
    hasNotifications() {
        return this.notifications.size > 0;
    }
}
