// Визначаємо селектори для різних AI-чатів
const CHAT_SELECTORS = {
  'chat.openai.com': {
    inputField: '#prompt-textarea',
    submitButton: '#prompt-textarea + button'
  },
  'claude.ai': {
    inputField: '.ProseMirror',
    submitButton: 'button[aria-label="Send message"]'
  },
  'gemini.google.com': {
    inputField: 'textarea[aria-label="Ask Gemini"]',
    submitButton: 'button[aria-label="Send message"]'
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
  
  for (const domain in CHAT_SELECTORS) {
    if (url.includes(domain)) {
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
  const inputField = document.querySelector(selectors.inputField);
  const submitButton = document.querySelector(selectors.submitButton);
  
  if (!inputField) {
    return { success: false, error: 'Не знайдено поле вводу' };
  }
  
  if (!submitButton) {
    return { success: false, error: 'Не знайдено кнопку відправки' };
  }
  
  // Різні підходи для різних чатів (залежно від типу елементу вводу)
  if (chatType === 'claude.ai') {
    // Claude використовує ProseMirror - спеціальний редактор
    inputField.focus();
    // Симулюємо ввід тексту
    const setText = function(element, text) {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', text);
      
      element.dispatchEvent(new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      }));
    };
    
    setText(inputField, messageText);
  } else {
    // Для інших чатів, які використовують стандартні textarea/input
    // Встановлюємо значення та симулюємо події, щоб чат розпізнав зміни
    inputField.value = messageText;
    
    // Симулюємо події, щоб активувати будь-які слухачі подій
    inputField.dispatchEvent(new Event('input', { bubbles: true }));
    inputField.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  // Перевіряємо, чи кнопка submit активна (для деяких чатів)
  if (!submitButton.disabled) {
    // Відправляємо повідомлення, імітуючи клік
    submitButton.click();
    return { success: true };
  } else {
    // Якщо кнопка неактивна, повертаємо успіх без відправки
    // Користувач може натиснути Enter самостійно
    return { 
      success: true, 
      message: 'Текст вставлено, але автоматична відправка недоступна. Можливо, потрібно натиснути Enter.'
    };
  }
}
