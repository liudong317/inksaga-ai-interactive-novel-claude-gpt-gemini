const { openQinghongLink } = require('../utils/qinghongLinks');

const modalComponent = (function() {
  let modalStyleEl = null;

  function ensureModalStyles() {
    if (modalStyleEl) return;
    modalStyleEl = document.createElement('style');
    modalStyleEl.textContent = `
      .custom-modal {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: modalFadeIn 0.2s ease-out;
      }
      .modal-content {
        background: #fff;
        border-radius: 12px;
        width: 420px;
        max-width: 90vw;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        animation: modalSlideUp 0.3s ease-out;
      }
      .modal-header { padding: 24px 24px 16px; text-align: center; }
      .modal-icon { margin: 0 auto; }
      .modal-body { padding: 0 24px 24px; text-align: center; }
      .modal-title {
        font-size: 20px;
        font-weight: 600;
        color: #2c3e50;
        margin-bottom: 12px;
      }
      .modal-message {
        font-size: 14px;
        color: #7f8c8d;
        line-height: 1.6;
        white-space: pre-line;
      }
      .modal-footer {
        padding: 16px 24px 24px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: center;
      }
      .modal-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s;
      }
      .modal-btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
      }
      .modal-btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102,126,234,0.4);
      }
      .modal-btn-accent {
        background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        color: #fff;
      }
      .modal-btn-accent:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(17,153,142,0.4);
      }
      .modal-btn-cancel {
        background: #e0e0e0;
        color: #666;
      }
      .modal-btn-cancel:hover { background: #d0d0d0; }
      @keyframes modalFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes modalSlideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(modalStyleEl);
  }

  function closeModal(overlay) {
    overlay.remove();
  }

  function showError(message) {
    ensureModalStyles();
    document.querySelectorAll('.custom-modal').forEach(m => m.remove());
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'custom-modal';
    modalOverlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <svg class="modal-icon" width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" fill="#f45c43" opacity="0.1"/>
            <path d="M24 14V26M24 30V34" stroke="#f45c43" stroke-width="3" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="modal-body">
          <h3 class="modal-title">提示</h3>
          <p class="modal-message">${message}</p>
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-btn-primary" id="modalCloseBtn">确定</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);
    document.getElementById('modalCloseBtn').addEventListener('click', () => closeModal(modalOverlay));
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal(modalOverlay);
    });
  }

  function showApiGuide(message, options = {}) {
    const { showRegister = true, showModelNav = true } = options;
    ensureModalStyles();
    document.querySelectorAll('.custom-modal').forEach(m => m.remove());

    let extraBtns = '';
    if (showRegister) {
      extraBtns += `<button class="modal-btn modal-btn-accent" id="modalRegisterBtn">注册晴红API</button>`;
    }
    if (showModelNav) {
      extraBtns += `<button class="modal-btn modal-btn-primary" id="modalModelNavBtn">去模型配置</button>`;
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'custom-modal';
    modalOverlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <svg class="modal-icon" width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" fill="#667eea" opacity="0.1"/>
            <path d="M24 16V24M24 28V28.02" stroke="#667eea" stroke-width="3" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="modal-body">
          <h3 class="modal-title">需要 AI 模型</h3>
          <p class="modal-message">${message}</p>
        </div>
        <div class="modal-footer">
          ${extraBtns}
          <button class="modal-btn modal-btn-cancel" id="modalCloseBtn">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);

    document.getElementById('modalCloseBtn').addEventListener('click', () => closeModal(modalOverlay));
    if (showRegister) {
      document.getElementById('modalRegisterBtn').addEventListener('click', () => {
        closeModal(modalOverlay);
        openQinghongLink('signup');
      });
    }
    if (showModelNav) {
      document.getElementById('modalModelNavBtn').addEventListener('click', () => {
        closeModal(modalOverlay);
        if (window.showModelMenu) window.showModelMenu();
      });
    }
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal(modalOverlay);
    });
  }

  function showConfirm(message, onConfirm, onCancel) {
    ensureModalStyles();
    document.querySelectorAll('.custom-modal').forEach(m => m.remove());
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'custom-modal';
    modalOverlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <svg class="modal-icon" width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" fill="#ff9800" opacity="0.1"/>
            <path d="M24 14V26M24 30H24.02" stroke="#ff9800" stroke-width="3" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="modal-body">
          <h3 class="modal-title">确认操作</h3>
          <p class="modal-message">${message}</p>
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-btn-cancel" id="modalCancelBtn">取消</button>
          <button class="modal-btn modal-btn-primary" id="modalConfirmBtn">确定</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);

    const closeModalFn = () => closeModal(modalOverlay);
    document.getElementById('modalConfirmBtn').addEventListener('click', () => {
      closeModalFn();
      if (onConfirm) onConfirm();
    });
    document.getElementById('modalCancelBtn').addEventListener('click', () => {
      closeModalFn();
      if (onCancel) onCancel();
    });
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeModalFn();
        if (onCancel) onCancel();
      }
    });
  }

  return { showError, showConfirm, showApiGuide };
})();

module.exports = modalComponent;
