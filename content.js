// Визначаємо селектори для різних AI-чатів
const CHAT_SELECTORS = {
  'chat.openai.com': {
    inputField: '#prompt-textarea',
    submitButton: '#prompt-textarea + button',
    alternativeSubmitButton: 'button[data-testid="send-button"]'
  },
  'chatgpt.com': {
    inputField: '#prompt-textarea',
    submitButton: '#prompt-textarea + button',
    alternativeSubmitButton: 'button[data-testid="send-button"]'
  },
  'claude.ai': {
    inputField: '.ProseMirror',
    submitButton: 'button[aria-label="Send message"]',
    alternativeInputField: '[contenteditable="true"]'
  },
  'gemini.google.com': {
    inputField: 'textarea[aria-label="Ask Gemini"]',
    submitButton: 'button[aria-label="Send message"]',
    alternativeInputField: 'textarea[aria-label*="Gemini"]'
  },
  'grok.com': {
    inputField: 'textarea.resize-none',
    submitButton: 'button[aria-label="Send message"]',
    alternativeSubmitButton: 'button[type="submit"]'
  }
};

// Слухаємо повідомлення від popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'sendMessage') {
    try {
      const result = injectMessageIntoChat(message.message);
      sendResponse(result);
    } catch (error) {
      console.error('Помилка при вставці повідомлення:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Для асинхронної відповіді
  }
});

// Функція для визначення, який AI-чат відкритий
function getCurrentChatType() {
  const url = window.location.href;
  
  // Перевіряємо кожен домен підтримуваних чатів
  for (const domain in CHAT_SELECTORS) {
    if (url.includes(domain)) {
      // Додаткова перевірка для визначення елементів інтерфейсу
      const selectors = CHAT_SELECTORS[domain];
      const hasInputField = document.querySelector(selectors.inputField) || 
                           (selectors.alternativeInputField && document.querySelector(selectors.alternativeInputField));
      
      // Якщо знайдено поле вводу, повертаємо відповідний тип чату
      if (hasInputField) {
        return domain;
      }
    }
  }
  
  // Додаткова перевірка для визначення типу чату за елементами інтерфейсу
  // Це допоможе у випадках, коли URL змінився, але інтерфейс залишився тим самим
  for (const domain in CHAT_SELECTORS) {
    const selectors = CHAT_SELECTORS[domain];
    const hasInputField = document.querySelector(selectors.inputField) || 
                         (selectors.alternativeInputField && document.querySelector(selectors.alternativeInputField));
    const hasSubmitButton = document.querySelector(selectors.submitButton) || 
                           (selectors.alternativeSubmitButton && document.querySelector(selectors.alternativeSubmitButton));
    
    if (hasInputField && hasSubmitButton) {
      return domain;
    }
  }
  
  return null;
}

// Функція для вставки повідомлення в чат
function injectMessageIntoChat(messageText) {
  const chatType = getCurrentChatType();
  
  if (!chatType || !CHAT_SELECTORS[chatType]) {
    return { success: false, error: 'Невідомий тип чату' };
  }
  
  const selectors = CHAT_SELECTORS[chatType];
  let inputField = document.querySelector(selectors.inputField);
  let submitButton = document.querySelector(selectors.submitButton);
  
  // Спробуємо альтернативні селектори, якщо основні не знайдено
  if (!inputField && selectors.alternativeInputField) {
    inputField = document.querySelector(selectors.alternativeInputField);
  }
  
  if (!submitButton && selectors.alternativeSubmitButton) {
    submitButton = document.querySelector(selectors.alternativeSubmitButton);
  }
  
  if (!inputField) {
    return { success: false, error: 'Не знайдено поле вводу' };
  }
  
  if (!submitButton) {
    return { success: false, error: 'Не знайдено кнопку відправки' };
  }
  
  try {
    // Різні підходи для різних чатів (залежно від типу елементу вводу)
    if (chatType === 'claude.ai') {
      // Claude використовує ProseMirror - спеціальний редактор
      inputField.focus();
      
      // Симулюємо ввід тексту через різні підходи
      try {
        // Спроба 1: через властивість textContent для contenteditable елементів
        if (inputField.getAttribute('contenteditable') === 'true') {
          inputField.textContent = messageText;
          inputField.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          // Спроба 2: через paste event
          const dataTransfer = new DataTransfer();
          dataTransfer.setData('text/plain', messageText);
          
          inputField.dispatchEvent(new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true
          }));
        }
      } catch (error) {
        console.log('Помилка при вставці тексту в Claude: ', error);
        // Спроба 3: через execCommand
        document.execCommand('insertText', false, messageText);
      }
      
    } else if (chatType === 'gemini.google.com') {
      // Для Gemini специфічний підхід
      inputField.focus();
      inputField.value = messageText;
      
      // Симулюємо події для Gemini
      const events = ['input', 'change', 'keydown', 'keyup'];
      events.forEach(eventType => {
        let event;
        if (eventType.startsWith('key')) {
          event = new KeyboardEvent(eventType, { key: 'a', bubbles: true });
        } else {
          event = new Event(eventType, { bubbles: true });
        }
        inputField.dispatchEvent(event);
      });
      
    } else if (chatType === 'grok.com') {
      // Для Grok
      inputField.focus();
      inputField.value = messageText;
      
      // Симулюємо події для Grok
      const events = ['input', 'change', 'focus'];
      events.forEach(eventType => {
        inputField.dispatchEvent(new Event(eventType, { bubbles: true }));
      });
      
    } else {
      // Для ChatGPT та інших чатів, які використовують стандартні textarea/input
      inputField.focus();
      inputField.value = messageText;
      
      // Симулюємо всі можливі події, щоб активувати будь-які слухачі
      const events = ['focus', 'input', 'change', 'keydown'];
      events.forEach(eventType => {
        let event;
        if (eventType === 'keydown') {
          event = new KeyboardEvent(eventType, { key: 'a', bubbles: true });
        } else {
          event = new Event(eventType, { bubbles: true });
        }
        inputField.dispatchEvent(event);
      });
    }
    
    // Додаємо затримку перед спробою натиснути кнопку
    setTimeout(() => {
      // Перевіряємо, чи кнопка submit активна
      if (submitButton && !submitButton.disabled) {
        // Спочатку фокусуємося на кнопці, щоб емулювати людські дії
        submitButton.focus();
        // Потім імітуємо клік
        submitButton.click();
      } else {
        // Спробуємо відправити через Enter
        inputField.dispatchEvent(new KeyboardEvent('keydown', { 
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true
        }));
      }
    }, 100);
    
    return { success: true };
  } catch (error) {
    console.error('Помилка при вставці повідомлення:', error);
    return { success: false, error: error.message };
  }
}
