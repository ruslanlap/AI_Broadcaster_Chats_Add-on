// Визначаємо селектори для різних AI-чатів
const CHAT_SELECTORS = {
  'chat.openai.com': {
    inputField: '#prompt-textarea',
    submitButton: '#prompt-textarea + button',
    alternativeSubmitButton: 'button[data-testid="send-button"]',
    altInputField: 'div[role="textbox"]'
  },
  'chatgpt.com': {
    inputField: '#prompt-textarea',
    submitButton: '#prompt-textarea + button',
    alternativeSubmitButton: 'button[data-testid="send-button"]',
    altInputField: 'div[role="textbox"]'
  },
  'claude.ai': {
    inputField: '.ProseMirror',
    submitButton: 'button[aria-label="Send message"]',
    alternativeInputField: '[contenteditable="true"]'
  },
  'gemini.google.com': {
    inputField: 'textarea[aria-label="Ask Gemini"]',
    submitButton: 'button[aria-label="Send message"]',
    alternativeInputField: 'textarea',
    altSubmitButton: 'button[type="submit"]'
  },
  'gemini.google.com/app': {
    inputField: 'textarea[aria-label="Запитайте Gemini"]',
    submitButton: 'button[aria-label="Надіслати повідомлення"]',
    alternativeInputField: 'textarea',
    altSubmitButton: 'button[type="submit"]'
  },
  'grok.com': {
    inputField: 'textarea.resize-none',
    submitButton: 'button[aria-label="Send message"]',
    alternativeSubmitButton: 'button[type="submit"]',
    altInputField: 'textarea'
  },
  'chat.deepseek.com': {
    inputField: 'textarea',
    submitButton: 'button[type="submit"]',
    alternativeSubmitButton: 'button[aria-label="Send message"]',
    altInputField: 'div[contenteditable="true"]'
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
  
  // Спеціальна обробка для Gemini, оскільки вона має кілька URL-форматів
  if (url.includes('gemini.google.com/app')) {
    const selectors = CHAT_SELECTORS['gemini.google.com/app'];
    const hasInputField = document.querySelector(selectors.inputField) || 
                         (selectors.alternativeInputField && document.querySelector(selectors.alternativeInputField));
    if (hasInputField) {
      return 'gemini.google.com/app';
    }
  }
  
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
  if (!inputField) {
    if (selectors.alternativeInputField) {
      inputField = document.querySelector(selectors.alternativeInputField);
      console.log('Використовуємо альтернативне поле вводу');
    }
    
    if (!inputField && selectors.altInputField) {
      inputField = document.querySelector(selectors.altInputField);
      console.log('Використовуємо другий альтернативний селектор поля вводу');
    }
  }
  
  if (!submitButton) {
    if (selectors.alternativeSubmitButton) {
      submitButton = document.querySelector(selectors.alternativeSubmitButton);
      console.log('Використовуємо альтернативну кнопку відправки');
    }
    
    if (!submitButton && selectors.altSubmitButton) {
      submitButton = document.querySelector(selectors.altSubmitButton);
      console.log('Використовуємо другий альтернативний селектор кнопки відправки');
    }
  }
  
  if (!inputField) {
    console.error('Не знайдено поле вводу для', chatType);
    // Додаткова спроба знайти будь-яке можливе поле вводу
    const possibleInputs = document.querySelectorAll('textarea, [contenteditable="true"], div[role="textbox"], input[type="text"]');
    if (possibleInputs.length > 0) {
      inputField = possibleInputs[0];
      console.log('Знайдено можливе поле вводу:', inputField);
    } else {
      return { success: false, error: 'Не знайдено поле вводу' };
    }
  }
  
  if (!submitButton) {
    console.warn('Не знайдено кнопку відправки для', chatType, '- спробуємо використати Enter');
    // Спробуємо знайти будь-яку кнопку відправки
    const possibleButtons = document.querySelectorAll('button[type="submit"], button[aria-label*="Send"], button[aria-label*="send"], button:has(svg)');
    if (possibleButtons.length > 0) {
      submitButton = possibleButtons[0];
      console.log('Знайдено можливу кнопку відправки:', submitButton);
    }
  }
  
  // Показуємо, що ми намагаємось відправити повідомлення
  console.log(`Відправляємо повідомлення в ${chatType}`);
  
  try {
    // Очищаємо поле вводу перед вставкою нового тексту
    if (inputField.value !== undefined) {
      inputField.value = '';
    }
    if (inputField.textContent !== undefined) {
      inputField.textContent = '';
    }
    
    // Фокус на полі вводу з невеликою затримкою
    setTimeout(() => {
      inputField.focus();
      
      // Обробка різних типів чатів
      if (chatType === 'claude.ai') {
        // Claude використовує ProseMirror - спеціальний редактор
        handleClaudeMessage(inputField, messageText);
      } else if (chatType === 'gemini.google.com') {
        // Для Gemini специфічний підхід
        handleGeminiMessage(inputField, messageText);
      } else if (chatType === 'grok.com') {
        // Для Grok
        handleGrokMessage(inputField, messageText);
      } else if (chatType.includes('chat.openai.com') || chatType.includes('chatgpt.com')) {
        // Спеціальний підхід для ChatGPT
        handleChatGptMessage(inputField, messageText);
      } else if (chatType === 'chat.deepseek.com') {
        // Спеціальний підхід для DeepSeek
        handleDeepSeekMessage(inputField, messageText);
      } else {
        // Для інших чатів, універсальний підхід
        handleGenericMessage(inputField, messageText);
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
            sendEnterKey(inputField);
          } else {
            // Спочатку фокусуємося на кнопці
            submitButton.focus();
            // Потім імітуємо клік через різні методи
            submitButton.click();
            // Додаємо додаткові методи імітації кліка для більшої надійності
            submitButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            submitButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            submitButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            console.log('Кнопку натиснуто кількома методами');
            
            // Додаткове натискання Enter для підстраховки
            setTimeout(() => {
              sendEnterKey(inputField);
            }, 300);
          }
        } else {
          console.log('Кнопка відправки не знайдена або неактивна, спробуємо відправити через Enter');
          // Спробуємо відправити через Enter
          sendEnterKey(inputField);
        }
      }, 1000); // Збільшена затримка перед натисканням кнопки
      
    }, 500); // Збільшена затримка перед фокусуванням та вставкою тексту
    
    return { success: true };
  } catch (error) {
    console.error('Загальна помилка при вставці повідомлення:', error);
    return { success: false, error: error.message };
  }
}

// Функція для відправки Enter натискання
function sendEnterKey(element) {
  try {
    // Спочатку фокус на елементі
    element.focus();
    
    // Натискання Enter кількома методами для більшої надійності
    element.dispatchEvent(new KeyboardEvent('keydown', { 
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    }));
    
    // Додаткове натискання, іноді потрібно обидва keydown і keypress
    element.dispatchEvent(new KeyboardEvent('keypress', { 
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    }));
    
    // Завершення натискання
    element.dispatchEvent(new KeyboardEvent('keyup', { 
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    }));
    
    console.log('Відправлено повний набір Enter подій');
  } catch (error) {
    console.error('Помилка при відправці Enter:', error);
  }
}

// Обробник для Claude
function handleClaudeMessage(inputField, messageText) {
  try {
    // Спроба 1: через властивість textContent для contenteditable елементів
    if (inputField.getAttribute('contenteditable') === 'true') {
      inputField.textContent = messageText;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('Claude: Встановлено textContent для contenteditable');
    } else {
      // Спроба 2: через paste event
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', messageText);
      
      inputField.dispatchEvent(new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      }));
      console.log('Claude: Використано paste event');
    }
  } catch (error) {
    console.log('Помилка при вставці тексту в Claude, спробуємо execCommand: ', error);
    try {
      // Спроба 3: через execCommand
      document.execCommand('insertText', false, messageText);
      console.log('Claude: Використано execCommand');
    } catch (err) {
      console.error('Всі методи для Claude зазнали невдачі:', err);
    }
  }
}

// Обробник для Gemini
function handleGeminiMessage(inputField, messageText) {
  try {
    // Спочатку активно фокусуємося на полі вводу
    inputField.focus();
    
    // Очищаємо поле перед встановленням нового значення
    if (inputField.value !== undefined) {
      inputField.value = '';
    }
    
    // Використовуємо затримку перед встановленням значення
    setTimeout(() => {
      // Для Gemini спочатку перевіряємо чи це правильний елемент
      if (inputField.tagName.toLowerCase() === 'textarea') {
        // Для textarea використовуємо прямий метод
        inputField.value = messageText;
        
        // Симулюємо натискання клавіш для активації поля
        inputField.dispatchEvent(new KeyboardEvent('keydown', { 
          key: 'a',
          code: 'KeyA',
          bubbles: true,
          cancelable: true 
        }));
        
        // Відправляємо кілька подій input для надійності
        for (let i = 0; i < 2; i++) {
          setTimeout(() => {
            try {
              const inputEvent = new Event('input', { bubbles: true });
              inputField.dispatchEvent(inputEvent);
            } catch (e) {
              console.error('Помилка при відправці input event:', e);
            }
          }, i * 200);
        }
        
        // Також спробуємо встановити значення через element.setAttribute
        try {
          inputField.setAttribute('value', messageText);
        } catch (e) {
          console.error('Помилка при встановленні значення через setAttribute:', e);
        }
      } else {
        // Для інших типів елементів
        if (inputField.value !== undefined) {
          inputField.value = messageText;
        }
        if (inputField.textContent !== undefined) {
          inputField.textContent = messageText;
        }
      }
      
      console.log('Gemini: Встановлено значення та відправлено події');
    }, 300);
  } catch (error) {
    console.error('Помилка при обробці Gemini:', error);
  }
}

// Обробник для Grok
function handleGrokMessage(inputField, messageText) {
  try {
    // Очищаємо поле спочатку, щоб видалити будь-який авто-текст
    if (inputField.value !== undefined) {
      inputField.value = '';
      // Потім встановлюємо значення після короткої затримки
      setTimeout(() => {
        inputField.value = messageText;
        
        // Фокусуємося на полі вводу
        inputField.focus();
        
        // Симулюємо події з короткими затримками
        ['input', 'change', 'keydown'].forEach((eventType, index) => {
          setTimeout(() => {
            try {
              if (eventType === 'keydown') {
                // Симулюємо натискання будь-якої клавіші для активації поля
                inputField.dispatchEvent(new KeyboardEvent('keydown', { 
                  key: 'a',
                  bubbles: true,
                  cancelable: true
                }));
              } else {
                // Для інших подій використовуємо стандартні події
                inputField.dispatchEvent(new Event(eventType, { bubbles: true }));
              }
            } catch (error) {
              console.error(`Grok: Помилка при відправці події ${eventType}:`, error);
            }
          }, index * 100);
        });
        
        console.log('Grok: Відправлено всі події');
      }, 200);
    }
  } catch (error) {
    console.error('Помилка при обробці Grok:', error);
  }
}

// Обробник для ChatGPT
function handleChatGptMessage(inputField, messageText) {
  try {
    // Встановлюємо значення двома методами
    if (inputField.value !== undefined) {
      inputField.value = messageText;
    }
    if (inputField.innerHTML !== undefined) {
      inputField.innerHTML = messageText;
    }
    console.log('ChatGPT: Встановлено значення');
    
    // Додаткова перевірка для contenteditable елементів
    if (inputField.getAttribute('contenteditable') === 'true') {
      inputField.textContent = messageText;
    }
    
    // Симулюємо події з фокусом на специфічних для ChatGPT подіях
    const events = ['focus', 'input', 'change', 'keydown', 'input'];
    events.forEach((eventType, index) => {
      setTimeout(() => {
        try {
          if (eventType === 'input') {
            try {
              inputField.dispatchEvent(new InputEvent('input', { 
                bubbles: true,
                data: messageText,
                inputType: 'insertText'
              }));
            } catch (e) {
              inputField.dispatchEvent(new Event('input', { bubbles: true }));
            }
          } else if (eventType === 'keydown') {
            inputField.dispatchEvent(new KeyboardEvent('keydown', { 
              key: 'a',
              code: 'KeyA',
              bubbles: true
            }));
          } else {
            inputField.dispatchEvent(new Event(eventType, { bubbles: true }));
          }
        } catch (error) {
          console.error(`ChatGPT: Помилка при відправці події ${eventType}:`, error);
        }
      }, index * 50);
    });
    console.log('ChatGPT: Відправлено події');
  } catch (error) {
    console.error('Помилка при обробці ChatGPT:', error);
  }
}

// Універсальний обробник для інших чатів
function handleGenericMessage(inputField, messageText) {
  try {
    // Різні способи встановлення тексту в залежності від типу елемента
    if (inputField.tagName.toLowerCase() === 'textarea' || inputField.tagName.toLowerCase() === 'input') {
      inputField.value = messageText;
      console.log('Generic: Встановлено value для елемента input/textarea');
    } else if (inputField.getAttribute('contenteditable') === 'true') {
      inputField.textContent = messageText;
      console.log('Generic: Встановлено textContent для contenteditable');
    } else {
      // Якщо нічого не підходить, спробуємо обидва методи
      if (inputField.value !== undefined) inputField.value = messageText;
      if (inputField.textContent !== undefined) inputField.textContent = messageText;
      if (inputField.innerHTML !== undefined) inputField.innerHTML = messageText;
      console.log('Generic: Спроба встановити кількома методами');
    }
    
    // Симулюємо більшу кількість подій для надійності
    const events = ['focus', 'input', 'change', 'keydown', 'keyup', 'click', 'input'];
    events.forEach((eventType, index) => {
      setTimeout(() => {
        try {
          let event;
          if (eventType.startsWith('key')) {
            event = new KeyboardEvent(eventType, { 
              key: eventType === 'keydown' ? 'a' : 'Enter', 
              bubbles: true,
              cancelable: true
            });
          } else if (eventType === 'input') {
            try {
              event = new InputEvent('input', { 
                bubbles: true,
                data: messageText,
                inputType: 'insertText'
              });
            } catch (e) {
              event = new Event('input', { bubbles: true });
            }
          } else {
            event = new Event(eventType, { bubbles: true });
          }
          inputField.dispatchEvent(event);
        } catch (error) {
          console.error(`Generic: Помилка при відправці події ${eventType}:`, error);
        }
      }, index * 50); // Невелика затримка між подіями
    });
    console.log('Generic: Відправлено всі події');
  } catch (error) {
    console.error('Помилка при обробці універсального повідомлення:', error);
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

// Обробник для DeepSeek
function handleDeepSeekMessage(inputField, messageText) {
  try {
    // Очищаємо поле спочатку
    if (inputField.value !== undefined) {
      inputField.value = '';
    }
    if (inputField.tagName.toLowerCase() === 'div' && inputField.getAttribute('contenteditable') === 'true') {
      inputField.textContent = '';
    }
    
    // Фокусуємо на полі вводу
    inputField.focus();
    
    // Використовуємо тільки один метод для встановлення значення з затримкою
    setTimeout(() => {
      if (inputField.value !== undefined) {
        inputField.value = messageText;
        
        // Відправляємо тільки необхідні події з більшими затримками
        ['input', 'change'].forEach((eventType, index) => {
          setTimeout(() => {
            try {
              const event = new Event(eventType, { bubbles: true });
              inputField.dispatchEvent(event);
            } catch (error) {
              console.error(`DeepSeek: Помилка при відправці події ${eventType}:`, error);
            }
          }, index * 150);
        });
      } else if (inputField.tagName.toLowerCase() === 'div' && inputField.getAttribute('contenteditable') === 'true') {
        inputField.textContent = messageText;
        
        // Для contenteditable елементів потрібні специфічні події
        try {
          const event = new InputEvent('input', { bubbles: true });
          inputField.dispatchEvent(event);
        } catch (e) {
          console.error('DeepSeek: Помилка при відправці input event:', e);
        }
      }
      
      console.log('DeepSeek: Встановлено значення і відправлено події');
    }, 300);
  } catch (error) {
    console.error('Помилка при обробці DeepSeek:', error);
  }
}

