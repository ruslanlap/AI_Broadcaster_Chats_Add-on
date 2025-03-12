// Фоновий скрипт для додаткової функціональності

// Слухаємо повідомлення від popup.js або content.js
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Обробка різних типів повідомлень
  
  if (message.action === 'logEvent') {
    // Детальне логування з часовою міткою
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] Подія з розширення:`, message.data);
    
    // Якщо це помилка, показуємо детальніше в консолі
    if (message.data && message.data.type === 'error') {
      console.error(`[${timestamp}] ПОМИЛКА:`, message.data.message);
      
      // Можна додати збереження помилок для подальшого аналізу
      const errors = JSON.parse(localStorage.getItem('aiChatErrors') || '[]');
      errors.push({
        timestamp: new Date().toISOString(),
        message: message.data.message,
        sender: sender.tab ? `Tab ${sender.tab.id}: ${sender.tab.url}` : 'popup'
      });
      // Зберігаємо останні 20 помилок
      localStorage.setItem('aiChatErrors', JSON.stringify(errors.slice(-20)));
    }
    
    sendResponse({ received: true });
  }
  
  // Додано функціональність для отримання діагностичної інформації
  if (message.action === 'getDiagnostics') {
    const diagnosticInfo = {
      browserInfo: navigator.userAgent,
      errors: JSON.parse(localStorage.getItem('aiChatErrors') || '[]'),
      extensionVersion: browser.runtime.getManifest().version
    };
    sendResponse(diagnosticInfo);
  }
  
  // Додано функціональність для підготовки вкладки
  if (message.action === 'prepareTab') {
    const tabId = message.tabId;
    
    // Переконуємося, що вкладка готова до роботи
    browser.tabs.get(tabId).then(tab => {
      if (tab.status === 'complete') {
        sendResponse({ status: 'ready' });
      } else {
        // Якщо вкладка не повністю завантажена, чекаємо
        setTimeout(() => {
          browser.tabs.get(tabId).then(updatedTab => {
            sendResponse({ status: updatedTab.status === 'complete' ? 'ready' : 'waiting' });
          }).catch(err => {
            sendResponse({ status: 'error', error: err.message });
          });
        }, 500);
      }
    }).catch(err => {
      sendResponse({ status: 'error', error: err.message });
    });
    
    return true; // Для асинхронної відповіді
  }
  
  return true; // Для асинхронної відповіді
});

// Функція для перевірки наявності відкритих чатів
async function checkForOpenAIChats() {
  const aiDomains = [
    'chat.openai.com',
    'chatgpt.com',
    'claude.ai',
    'gemini.google.com',
    'grok.com'
  ];
  
  const tabs = await browser.tabs.query({});
  const aiTabs = tabs.filter(tab => {
    return aiDomains.some(domain => tab.url.includes(domain));
  });
  
  return aiTabs.length > 0;
}

// Необов'язково: можна додати обробник встановлення розширення
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // При першому встановленні розширення
    const hasAIChats = await checkForOpenAIChats();
    
    if (!hasAIChats) {
      // Можна показати повідомлення або відкрити сторінку з інструкціями
      browser.tabs.create({
        url: 'welcome-uk.html'
      });
    }
  }
});
