// Визначаємо підтримувані AI-чати
const AI_CHAT_URLS = {
  'ChatGPT': ['https://chat.openai.com', 'https://chatgpt.com'],
  'Claude': 'https://claude.ai',
  'Gemini': 'https://gemini.google.com',
  'Grok': 'https://grok.com',
  'DeepSeek': 'https://chat.deepseek.com'
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
    return Object.entries(AI_CHAT_URLS).some(([key, urls]) => {
      if (Array.isArray(urls)) {
        return urls.some(url => tab.url.startsWith(url));
      } else {
        return tab.url.startsWith(urls);
      }
    });
  });
  
  // Показуємо знайдені чати або повідомлення, якщо їх немає
  if (aiChatTabs.length > 0) {
    noChatsMessage.style.display = 'none';
    
    // Створюємо список чатів з чекбоксами
    aiChatTabs.forEach(tab => {
      const chatType = Object.keys(AI_CHAT_URLS).find(
        key => {
          const urls = AI_CHAT_URLS[key];
          if (Array.isArray(urls)) {
            return urls.some(url => tab.url.startsWith(url));
          } else {
            return tab.url.startsWith(urls);
          }
        }
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
    
    // Для кожної вибраної вкладки відправляємо повідомлення з більшою затримкою між відправками
    const sendPromises = Array.from(selectedCheckboxes).map((checkbox, index) => {
      const tabId = parseInt(checkbox.dataset.tabId);
      // Збільшуємо затримку між відправками в різні чати
      return new Promise(resolve => setTimeout(() => {
        console.log(`Відправляємо повідомлення у вкладку ${tabId}...`);
        
        // Спочатку активуємо вкладку, щоб гарантувати, що вона в фокусі
        browser.tabs.update(tabId, { active: true }).then(() => {
          // Збільшена затримка після активації вкладки
          setTimeout(() => {
            browser.tabs.sendMessage(tabId, {
              action: 'sendMessage',
              message: message
            }).then(response => {
              console.log(`Успішно відправлено в tab ${tabId}:`, response);
              resolve(response || { success: true });
            }).catch(error => {
              console.error(`Помилка при відправці в tab ${tabId}:`, error);
              resolve({ tabId, success: false, error: error.message || "Невідома помилка" });
            });
          }, 1000); // Збільшена затримка після активації вкладки до 1 секунди
        }).catch(error => {
          console.error(`Помилка при активації вкладки ${tabId}:`, error);
          resolve({ tabId, success: false, error: "Помилка активації вкладки" });
        });
      }, index * 1500)); // Значно збільшена затримка між відправками (1500мс на кожну вкладку)
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
  
  // Функція показу статусу з можливістю відображення деталей
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
    statusMessage.style.display = 'block';
    
    // При помилці надсилаємо детальну інформацію в фоновий скрипт для логування
    if (type === 'error') {
      browser.runtime.sendMessage({
        action: 'logEvent',
        data: {
          type: 'error',
          message: message,
          timestamp: new Date().toISOString()
        }
      }).catch(err => console.error('Помилка логування:', err));
    }
    
    // Автоматично ховаємо через 15 секунд для помилок, 5 секунд для успіху
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, type === 'error' ? 15000 : 5000);
  }
});
