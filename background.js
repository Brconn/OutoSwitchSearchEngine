// 默认搜索引擎设置
const GOOGLE_SEARCH_URL = 'https://www.google.com/search?q=';
const BING_SEARCH_URL = 'https://www2.bing.com/search?q='; // 修改为www2.bing.com
let currentSearchEngine = BING_SEARCH_URL; // 默认为 Bing

// 检查 Google 是否可访问
async function checkGoogleConnection() {
  try {
    // 尝试访问一个小的、快速加载的 Google 资源
    // 注意：直接 fetch 'https://www.google.com' 可能会因 CORS 或重定向策略而失败
    // 使用 Google 的一个已知 favicon 或一个小的静态资源进行测试更可靠
    // 或者，如果扩展有更广泛的 host_permissions，可以尝试 fetch 一个特定的 API 端点
    // 这里我们简单地尝试 fetch Google 首页，但在实际场景中可能需要更鲁棒的方法
    const response = await fetch('https://www.google.com/favicon.ico', { method: 'HEAD', mode: 'no-cors' });
    // 'no-cors' 模式下，我们无法直接检查 response.ok 或 status
    // 但如果请求成功发出（即使是 opaque response），通常表示网络可达
    // 对于更精确的检测，可能需要服务器端配合或更复杂的客户端策略
    return true; // 假设能发出请求就代表可连接
  } catch (error) {
    console.error('无法连接到 Google:', error);
    return false;
  }
}

// 更新搜索引擎规则
// 在updateSearchEngineRules函数中添加更新地址栏搜索引擎的逻辑
async function updateSearchEngineRules(useGoogle) {
  const newEngineUrl = useGoogle ? GOOGLE_SEARCH_URL : BING_SEARCH_URL;
  if (currentSearchEngine === newEngineUrl) {
    return; // 搜索引擎未改变，无需更新
  }

  currentSearchEngine = newEngineUrl;
  const newRule = {
    id: 1,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { transform: { queryTransform: { removeParams: ['q'], addOrReplaceParams: [{ key: 'q', value: '{q}' }] } } }
    },
    condition: {
      urlFilter: '*://www.google.com/search*|*://www.bing.com/search*',
      resourceTypes: ['main_frame']
    }
  };

  if (useGoogle) {
    newRule.action.redirect.url = GOOGLE_SEARCH_URL;
    newRule.condition.urlFilter = '*://www.bing.com/search*';
    newRule.action.redirect.transform.queryTransform.addOrReplaceParams[0].value = '{q}';
    
    // 更新manifest中的search_provider配置（这只是逻辑上的，实际上manifest不会被动态修改）
    // 但我们可以通过chrome.declarativeNetRequest来实现类似的效果
  } else {
    newRule.action.redirect.url = BING_SEARCH_URL;
    newRule.condition.urlFilter = '*://www.google.com/search*';
    newRule.action.redirect.transform.queryTransform.addOrReplaceParams[0].value = '{q}';
    
    // 同上，逻辑上更新search_provider
  }

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1], // 移除旧规则
      addRules: [newRule]
    });
    
    // 添加一个新规则，用于处理来自地址栏的搜索请求
    const addressBarRule = {
      id: 2,
      priority: 2,
      action: {
        type: 'redirect',
        redirect: { url: useGoogle ? GOOGLE_SEARCH_URL + '{searchTerms}' : BING_SEARCH_URL + '{searchTerms}' }
      },
      condition: {
        urlFilter: '*://智能搜索/*',  // 这里匹配的是扩展定义的搜索提供者
        resourceTypes: ['main_frame']
      }
    };
    
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [2],
      addRules: [addressBarRule]
    });
    
    console.log(`搜索引擎已切换为: ${useGoogle ? 'Google' : 'Bing'}`);
    showNotification(`搜索引擎已切换为: ${useGoogle ? 'Google' : 'Bing'}`);
    // 将当前状态保存到 storage
    chrome.storage.local.set({ searchEngine: useGoogle ? 'google' : 'bing' });
    
    // 更新扩展图标
    updateExtensionIcon(useGoogle);
    
  } catch (e) {
    console.error('更新规则失败:', e);
  }
}

// 定期检查连接状态
async function checkAndSwitch() {
  const googleConnected = await checkGoogleConnection();
  const storedState = await chrome.storage.local.get('searchEngine');
  const currentEngineIsGoogle = storedState.searchEngine === 'google' || storedState.searchEngine === undefined; // 默认是 Google

  if (googleConnected && !currentEngineIsGoogle) {
    console.log('检测到 Google 连接恢复，切换到 Google');
    await updateSearchEngineRules(true);
  } else if (!googleConnected && currentEngineIsGoogle) {
    console.log('检测到 Google 连接断开，切换到 Bing');
    await updateSearchEngineRules(false);
  }
}

// 显示通知
function showNotification(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon48.png', // 确保你有这个图标
    title: '搜索引擎切换',
    message: message
  });
}

// 更新扩展图标
async function updateExtensionIcon(useGoogle) {
  // 我们仍然需要一些基本的图标作为备用
  // 这里我们使用简单的颜色区分
  const canvas = new OffscreenCanvas(48, 48);
  const ctx = canvas.getContext('2d');
  
  // 清除画布
  ctx.clearRect(0, 0, 48, 48);
  
  // 设置背景色
  ctx.fillStyle = useGoogle ? '#4285F4' : '#00809D'; // Google蓝 vs Bing蓝
  ctx.fillRect(0, 0, 48, 48);
  
  // 绘制搜索图标
  ctx.fillStyle = 'white';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(useGoogle ? 'G' : 'B', 24, 24);
  
  // 将canvas转换为ImageData
  const imageData = ctx.getImageData(0, 0, 48, 48);
  
  // 设置图标
  chrome.action.setIcon({ imageData });
}

// 扩展安装或启动时运行
chrome.runtime.onInstalled.addListener(() => {
  console.log('扩展已安装或更新。');
  // 初始化检查
  checkAndSwitch();
  // 设置定期检查的闹钟，例如每5分钟检查一次
  chrome.alarms.create('checkConnectionAlarm', {
    delayInMinutes: 1, // 首次延迟1分钟执行
    periodInMinutes: 5 // 每5分钟执行一次
  });
  // 默认设置为 Bing
  chrome.storage.local.set({ searchEngine: 'bing' });
  // 初始化规则，确保有一个默认规则
  updateSearchEngineRules(false); // 初始设置为 Bing
});

// 监听闹钟事件
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkConnectionAlarm') {
    checkAndSwitch();
  }
});

// 监听来自 popup 的消息 (如果需要)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStatus') {
    checkGoogleConnection().then(connected => {
      chrome.storage.local.get('searchEngine', (data) => {
        sendResponse({ googleConnected: connected, currentEngine: data.searchEngine || 'google' });
      });
    });
    return true; // 异步响应
  }
});

// 初始化：确保首次加载时，如果Google无法连接，则切换到Bing
// 这部分逻辑也可以放在 onInstalled 中
(async () => {
  const googleConnected = await checkGoogleConnection();
  if (googleConnected) {
    console.log('初始检测：Google可连接，设置为Google');
    await updateSearchEngineRules(true);
  } else {
    console.log('初始检测：Google无法连接，切换到Bing');
    await updateSearchEngineRules(false);
  }
})();

// 添加搜索框点击检测功能
chrome.webNavigation.onCommitted.addListener(async (details) => {
  // 检测用户是否正在访问搜索页面
  if (details.url.includes('search?q=') || 
      details.url.includes('智能搜索') || 
      details.transitionType === 'generated') {
    console.log('检测到搜索操作，即时检查连通性');
    await checkAndSwitch(); // 即时检查并切换搜索引擎
  }
});