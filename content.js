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
    console.error('Невідомий тип чату:', chatType);
    return { success: false, error: 'Невідомий тип чату' };
  }
  
  const selectors = CHAT_SELECTORS[chatType];
  let inputField = document.querySelector(selectors.inputField);
  let submitButton = document.querySelector(selectors.submitButton);
  
  // Спробуємо альтернативні селектори, якщо основні не знайдено
  if (!inputField && selectors.alternativeInputField) {
    inputField = document.querySelector(selectors.alternativeInputField);
    console.log('Використовуємо альтернативне поле вводу');
  }
  
  if (!submitButton && selectors.alternativeSubmitButton) {
    submitButton = document.querySelector(selectors.alternativeSubmitButton);
    console.log('Використовуємо альтернативну кнопку відправки');
  }
  
  if (!inputField) {
    console.error('Не знайдено поле вводу для', chatType);
    // Додаткова спроба знайти будь-яке можливе поле вводу
    const possibleInputs = document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"]');
    if (possibleInputs.length > 0) {
      inputField = possibleInputs[0];
      console.log('Знайдено можливе поле вводу:', inputField);
    } else {
      return { success: false, error: 'Не знайдено поле вводу' };
    }
  }
  
  if (!submitButton) {
    console.warn('Не знайдено кнопку відправки для', chatType, '- спробуємо використати Enter');
  }
  
  // Показуємо, що ми намагаємось відправити повідомлення
  console.log(`Відправляємо повідомлення в ${chatType}`);
  
  try {
    // Очищаємо поле вводу перед вставкою нового тексту
    if (inputField.value) {
      inputField.value = '';
    }
    if (inputField.textContent) {
      inputField.textContent = '';
    }
    
    // Фокус на полі вводу з невеликою затримкою
    setTimeout(() => {
      inputField.focus();
      
      // Різні підходи для різних чатів (залежно від типу елементу вводу)
      if (chatType === 'claude.ai') {
        // Claude використовує ProseMirror - спеціальний редактор
        try {
          // Спроба 1: через властивість textContent для contenteditable елементів
          if (inputField.getAttribute('contenteditable') === 'true') {
            inputField.textContent = messageText;
            inputField.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('Метод 1: Встановлено textContent для contenteditable');
          } else {
            // Спроба 2: через paste event
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', messageText);
            
            inputField.dispatchEvent(new ClipboardEvent('paste', {
              clipboardData: dataTransfer,
              bubbles: true,
              cancelable: true
            }));
            console.log('Метод 2: Використано paste event');
          }
        } catch (error) {
          console.log('Помилка при вставці тексту в Claude, спробуємо execCommand: ', error);
          // Спроба 3: через execCommand
          document.execCommand('insertText', false, messageText);
          console.log('Метод 3: Використано execCommand');
        }
      } else if (chatType === 'gemini.google.com') {
        // Для Gemini специфічний підхід
        inputField.value = messageText;
        console.log('Встановлено значення для Gemini');
        
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
        console.log('Відправлено події для Gemini');
      } else if (chatType === 'grok.com') {
        // Для Grok
        inputField.value = messageText;
        console.log('Встановлено значення для Grok');
        
        // Симулюємо події для Grok з більшою кількістю подій
        const events = ['input', 'change', 'focus', 'keydown', 'keyup'];
        events.forEach(eventType => {
          let event;
          if (eventType.startsWith('key')) {
            event = new KeyboardEvent(eventType, { 
              key: eventType === 'keydown' ? 'a' : 'Enter',
              bubbles: true 
            });
          } else {
            event = new Event(eventType, { bubbles: true });
          }
          inputField.dispatchEvent(event);
        });
        console.log('Відправлено події для Grok');
      } else if (chatType.includes('chat.openai.com') || chatType.includes('chatgpt.com')) {
        // Спеціальний підхід для ChatGPT
        inputField.value = messageText;
        console.log('Встановлено значення для ChatGPT');
        
        // Симулюємо події з фокусом на специфічних для ChatGPT подіях
        ['focus', 'input', 'change', 'keydown'].forEach(eventType => {
          inputField.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
        
        // Додаткова симуляція введення тексту
        inputField.dispatchEvent(new InputEvent('input', { 
          bubbles: true,
          data: messageText,
          inputType: 'insertText'
        }));
        console.log('Відправлено події для ChatGPT');
      } else {
        // Для інших чатів, універсальний підхід
        try {
          if (inputField.tagName.toLowerCase() === 'textarea' || inputField.tagName.toLowerCase() === 'input') {
            inputField.value = messageText;
            console.log('Встановлено value для елемента input/textarea');
          } else if (inputField.getAttribute('contenteditable') === 'true') {
            inputField.textContent = messageText;
            console.log('Встановлено textContent для contenteditable');
          } else {
            // Якщо нічого не підходить, спробуємо обидва методи
            inputField.value = messageText;
            inputField.textContent = messageText;
            console.log('Спроба встановити як value, так і textContent');
          }
        } catch (error) {
          console.error('Помилка при встановленні тексту:', error);
        }
        
        // Симулюємо більшу кількість подій для надійності
        const events = ['focus', 'input', 'change', 'keydown', 'keyup', 'click'];
        events.forEach(eventType => {
          try {
            let event;
            if (eventType.startsWith('key')) {
              event = new KeyboardEvent(eventType, { 
                key: eventType === 'keydown' ? 'a' : 'Enter', 
                bubbles: true 
              });
            } else if (eventType === 'input') {
              event = new InputEvent('input', { 
                bubbles: true,
                data: messageText,
                inputType: 'insertText'
              });
            } else {
              event = new Event(eventType, { bubbles: true });
            }
            inputField.dispatchEvent(event);
          } catch (error) {
            console.error(`Помилка при відправці події ${eventType}:`, error);
          }
        });
        console.log('Відправлено всі події для універсального підходу');
      }
      
      // Додаємо збільшену затримку перед спробою натиснути кнопку
      setTimeout(() => {
        console.log('Спроба відправити повідомлення...');
        
        // Перевіряємо, чи кнопка submit активна і видима
        if (submitButton && !submitButton.disabled && isElementVisible(submitButton)) {
          console.log('Знайдено активну кнопку відправки, натискаємо...');
          // Додаткова перевірка для ChatGPT
          if (chatType.includes('chatgpt') && submitButton.disabled) {
            console.log('Кнопка ChatGPT неактивна, спробуємо відправити через Enter');
            inputField.dispatchEvent(new KeyboardEvent('keydown', { 
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true
            }));
          } else {
            // Спочатку фокусуємося на кнопці
            submitButton.focus();
            // Потім імітуємо клік через різні методи
            submitButton.click();
            submitButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            console.log('Кнопку натиснуто');
          }
        } else {
          console.log('Кнопка відправки не знайдена або неактивна, спробуємо відправити через Enter');
          // Спробуємо відправити через Enter - це часто працює в більшості чатів
          try {
            // Спочатку фокус на полі вводу
            inputField.focus();
            // Потім симулюємо Enter
            inputField.dispatchEvent(new KeyboardEvent('keydown', { 
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            }));
            console.log('Відправлено Enter подію');
          } catch (error) {
            console.error('Помилка при відправці Enter:', error);
          }
        }
      }, 500); // Збільшена затримка перед натисканням кнопки
      
    }, 200); // Затримка перед фокусуванням та вставкою тексту
    
    return { success: true };
  } catch (error) {
    console.error('Загальна помилка при вставці повідомлення:', error);
    return { success: false, error: error.message };
  }
}

// Функція для перевірки, чи елемент видимий на сторінці
function isElementVisible(element) {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         element.offsetWidth > 0 && 
         element.offsetHeight > 0;
}
