// Фоновий скрипт для додаткової функціональності

// Слухаємо повідомлення від popup.js або content.js
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Тут можна додати додаткову логіку, наприклад:
  // - Збереження історії відправлених повідомлень
  // - Додаткова обробка помилок
  // - Інтеграція з іншими API браузера
  
  if (message.action === 'logEvent') {
    console.log('Подія з розширення:', message.data);
    sendResponse({ received: true });
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
