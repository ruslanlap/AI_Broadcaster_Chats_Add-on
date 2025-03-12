// Визначаємо підтримувані AI-чати
const AI_CHAT_URLS = {
  'ChatGPT': 'https://chat.openai.com',
  'Claude': 'https://claude.ai',
  'Gemini': 'https://gemini.google.com'
};

// При завантаженні popup
document.addEventListener('DOMContentLoaded', async () => {
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const statusMessage = document.getElementById('status-message');
  const chatTabsContainer = document.getElementById('chat-tabs');
  const noChatsMessage = document.getElementById('no-chats-message');
  
  // Знаходимо відкриті вкладки з AI-чатами
  const tabs = await browser.tabs.query({});
  const aiChatTabs = tabs.filter(tab => {
    return Object.values(AI_CHAT_URLS).some(url => tab.url.startsWith(url));
  });
  
  // Показуємо знайдені чати або повідомлення, якщо їх немає
  if (aiChatTabs.length > 0) {
    noChatsMessage.style.display = 'none';
    
    // Створюємо список чатів з чекбоксами
    aiChatTabs.forEach(tab => {
      const chatType = Object.keys(AI_CHAT_URLS).find(
        key => tab.url.startsWith(AI_CHAT_URLS[key])
      ) || 'Невідомий AI-чат';
      
      const chatItem = document.createElement('div');
      chatItem.className = 'chat-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.dataset.tabId = tab.id;
      
      const label = document.createElement('label');
      label.textContent = `${chatType}: ${tab.title.substring(0, 40)}${tab.title.length > 40 ? '...' : ''}`;
      
      chatItem.appendChild(checkbox);
      chatItem.appendChild(label);
      chatTabsContainer.appendChild(chatItem);
    });
  }
  
  // Обробник кнопки відправки
  sendButton.addEventListener('click', async () => {
    const message = messageInput.value.trim();
    
    if (!message) {
      showStatus('Будь ласка, введіть повідомлення для відправки', 'error');
      return;
    }
    
    // Отримуємо вибрані вкладки
    const selectedCheckboxes = document.querySelectorAll('#chat-tabs input[type="checkbox"]:checked');
    
    if (selectedCheckboxes.length === 0) {
      showStatus('Будь ласка, виберіть хоча б один чат для відправки', 'error');
      return;
    }
    
    // Для кожної вибраної вкладки відправляємо повідомлення
    const sendPromises = Array.from(selectedCheckboxes).map(checkbox => {
      const tabId = parseInt(checkbox.dataset.tabId);
      // Додаємо затримку між відправками в різні чати
      return new Promise(resolve => setTimeout(() => {
        browser.tabs.sendMessage(tabId, {
          action: 'sendMessage',
          message: message
        }).then(response => {
          console.log(`Успішно відправлено в tab ${tabId}`);
          resolve(response || { success: true });
        }).catch(error => {
          console.error(`Помилка при відправці в tab ${tabId}:`, error);
          resolve({ tabId, success: false, error: error.message });
        });
      }, 100)); // Затримка 100мс між відправками
    });
    
    // Чекаємо завершення всіх відправок
    const results = await Promise.all(sendPromises);
    
    // Перевіряємо результати
    const successCount = results.filter(result => result.success !== false).length;
    const errorCount = results.length - successCount;
    
    if (errorCount === 0) {
      showStatus(`Успішно відправлено повідомлення в ${successCount} чат(ів)!`, 'success');
    } else if (successCount === 0) {
      showStatus(`Не вдалося відправити повідомлення в жоден чат. Перевірте консоль для деталей.`, 'error');
    } else {
      showStatus(`Відправлено в ${successCount} чат(ів), помилка в ${errorCount} чат(ах).`, 'error');
    }
  });
  
  // Функція показу статусу
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
    statusMessage.style.display = 'block';
    
    // Автоматично ховаємо через 5 секунд
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 5000);
  }
});
