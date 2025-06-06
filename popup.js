document.addEventListener('DOMContentLoaded', () => {
  const googleStatusEl = document.getElementById('statusText');
  const currentEngineEl = document.getElementById('engineText');
  const statusIconEl = document.getElementById('statusIcon');
  const engineIconEl = document.getElementById('engineIcon');

  // 向 background.js 发送消息请求当前状态
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (chrome.runtime.lastError) {
      // 处理错误，例如 background script 未准备好
      googleStatusEl.textContent = '错误';
      currentEngineEl.textContent = '未知';
      statusIconEl.className = 'icon fa-solid fa-exclamation-triangle';
      engineIconEl.className = 'icon fa-solid fa-question-circle';
      console.error(chrome.runtime.lastError.message);
      return;
    }

    if (response) {
      if (response.googleConnected) {
        googleStatusEl.textContent = '已连接';
        googleStatusEl.parentElement.className = 'status google-connected';
        statusIconEl.className = 'icon fa-solid fa-check-circle';
      } else {
        googleStatusEl.textContent = '未连接';
        googleStatusEl.parentElement.className = 'status google-disconnected';
        statusIconEl.className = 'icon fa-solid fa-times-circle';
      }
      
      if (response.currentEngine === 'google') {
        currentEngineEl.textContent = 'Google';
        engineIconEl.className = 'icon fa-brands fa-google';
      } else {
        currentEngineEl.textContent = 'Bing';
        engineIconEl.className = 'icon fa-brands fa-microsoft';
      }
    } else {
        googleStatusEl.textContent = '无法获取状态';
        currentEngineEl.textContent = '未知';
        statusIconEl.className = 'icon fa-solid fa-exclamation-triangle';
        engineIconEl.className = 'icon fa-solid fa-question-circle';
    }
  });
});