
// Define selectors for different AI chats
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
  },
  'chat.mistral.ai': {
    inputField: 'textarea',
    submitButton: 'button[type="submit"]',
    alternativeSubmitButton: 'button[aria-label="Send message"]',
    altInputField: 'div[contenteditable="true"]'
  }
};

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'sendMessage') {
    try {
      const result = injectMessageIntoChat(message.message);
      sendResponse(result);
    } catch (error) {
      console.error('Error injecting message:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // For async response
  }
});

// Function to determine which AI chat is open
function getCurrentChatType() {
  const url = window.location.href;
  
  // Check each domain of supported chats
  for (const domain in CHAT_SELECTORS) {
    if (url.includes(domain)) {
      // Additional check to identify interface elements
      const selectors = CHAT_SELECTORS[domain];
      const hasInputField = document.querySelector(selectors.inputField) || 
                           (selectors.alternativeInputField && document.querySelector(selectors.alternativeInputField));
      
      // If input field found, return corresponding chat type
      if (hasInputField) {
        return domain;
      }
    }
  }
  
  // Additional check to determine chat type by interface elements
  // This helps in cases where URL changed but interface remained the same
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

// Function to inject message into chat
function injectMessageIntoChat(messageText) {
  const chatType = getCurrentChatType();
  
  if (!chatType || !CHAT_SELECTORS[chatType]) {
    console.error('Unknown chat type:', chatType);
    return { success: false, error: 'Unknown chat type' };
  }
  
  const selectors = CHAT_SELECTORS[chatType];
  let inputField = document.querySelector(selectors.inputField);
  let submitButton = document.querySelector(selectors.submitButton);
  
  // Try alternative selectors if main ones not found
  if (!inputField) {
    if (selectors.alternativeInputField) {
      inputField = document.querySelector(selectors.alternativeInputField);
      console.log('Using alternative input field');
    }
    
    if (!inputField && selectors.altInputField) {
      inputField = document.querySelector(selectors.altInputField);
      console.log('Using second alternative input field selector');
    }
  }
  
  if (!submitButton) {
    if (selectors.alternativeSubmitButton) {
      submitButton = document.querySelector(selectors.alternativeSubmitButton);
      console.log('Using alternative submit button');
    }
    
    if (!submitButton && selectors.altSubmitButton) {
      submitButton = document.querySelector(selectors.altSubmitButton);
      console.log('Using second alternative submit button selector');
    }
  }
  
  if (!inputField) {
    console.error('Input field not found for', chatType);
    // Additional attempt to find any possible input field
    const possibleInputs = document.querySelectorAll('textarea, [contenteditable="true"], div[role="textbox"], input[type="text"]');
    if (possibleInputs.length > 0) {
      inputField = possibleInputs[0];
      console.log('Found possible input field:', inputField);
    } else {
      return { success: false, error: 'Input field not found' };
    }
  }
  
  if (!submitButton) {
    console.warn('Submit button not found for', chatType, '- trying to use Enter');
    // Try to find any submit button
    const possibleButtons = document.querySelectorAll('button[type="submit"], button[aria-label*="Send"], button[aria-label*="send"], button:has(svg)');
    if (possibleButtons.length > 0) {
      submitButton = possibleButtons[0];
      console.log('Found possible submit button:', submitButton);
    }
  }
  
  // Show that we're attempting to send message
  console.log(`Sending message to ${chatType}`);
  
  try {
    // Clear input field before inserting new text
    if (inputField.value !== undefined) {
      inputField.value = '';
    }
    if (inputField.textContent !== undefined) {
      inputField.textContent = '';
    }
    
    // Focus on input field with small delay
    setTimeout(() => {
      inputField.focus();
      
      // Handle different chat types
      if (chatType === 'claude.ai') {
        // Claude uses ProseMirror - special editor
        handleClaudeMessage(inputField, messageText);
      } else if (chatType === 'grok.com') {
        // For Grok
        handleGrokMessage(inputField, messageText);
      } else if (chatType.includes('chat.openai.com') || chatType.includes('chatgpt.com')) {
        // Special approach for ChatGPT
        handleChatGptMessage(inputField, messageText);
      } else if (chatType === 'chat.deepseek.com') {
        // Special approach for DeepSeek
        handleDeepSeekMessage(inputField, messageText);
      } else if (chatType === 'chat.mistral.ai') {
        // For Mistral, using the same handler as DeepSeek initially
        handleDeepSeekMessage(inputField, messageText);
      } else {
        // For other chats, universal approach
        handleGenericMessage(inputField, messageText);
      }
      
      // Add increased delay before attempting to click button
      setTimeout(() => {
        console.log('Attempting to send message...');
        
        // Check if submit button is active and visible
        if (submitButton && !submitButton.disabled && isElementVisible(submitButton)) {
          console.log('Found active submit button, clicking...');
          
          // Additional check for ChatGPT
          if (chatType.includes('chatgpt') && submitButton.disabled) {
            console.log('ChatGPT button inactive, trying to send with Enter');
            sendEnterKey(inputField);
          } else {
            // First focus on button
            submitButton.focus();
            // Then simulate click through various methods
            submitButton.click();
            // Add additional click simulation methods for greater reliability
            submitButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            submitButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            submitButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            console.log('Button clicked using multiple methods');
            
            // Additional Enter press for backup
            setTimeout(() => {
              sendEnterKey(inputField);
            }, 300);
          }
        } else {
          console.log('Submit button not found or inactive, trying to send with Enter');
          // Try to send through Enter
          sendEnterKey(inputField);
        }
      }, 1000); // Increased delay before button press
      
    }, 500); // Increased delay before focusing and inserting text
    
    return { success: true };
  } catch (error) {
    console.error('General error when inserting message:', error);
    return { success: false, error: error.message };
  }
}

// Function to send Enter key press
function sendEnterKey(element) {
  try {
    // First focus on element
    element.focus();
    
    // Press Enter with multiple methods for greater reliability
    element.dispatchEvent(new KeyboardEvent('keydown', { 
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    }));
    
    // Additional press, sometimes both keydown and keypress needed
    element.dispatchEvent(new KeyboardEvent('keypress', { 
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    }));
    
    // Finish press
    element.dispatchEvent(new KeyboardEvent('keyup', { 
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    }));
    
    console.log('Sent full set of Enter events');
  } catch (error) {
    console.error('Error sending Enter:', error);
  }
}

// Handler for Claude
function handleClaudeMessage(inputField, messageText) {
  try {
    // Attempt 1: through textContent property for contenteditable elements
    if (inputField.getAttribute('contenteditable') === 'true') {
      inputField.textContent = messageText;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('Claude: Set textContent for contenteditable');
    } else {
      // Attempt 2: through paste event
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', messageText);
      
      inputField.dispatchEvent(new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      }));
      console.log('Claude: Used paste event');
    }
  } catch (error) {
    console.log('Error inserting text into Claude, trying execCommand: ', error);
    try {
      // Attempt 3: through execCommand
      document.execCommand('insertText', false, messageText);
      console.log('Claude: Used execCommand');
    } catch (err) {
      console.error('All methods for Claude failed:', err);
    }
  }
}



// Handler for Grok
function handleGrokMessage(inputField, messageText) {
  try {
    // Clear field first to remove any auto-text
    if (inputField.value !== undefined) {
      inputField.value = '';
      // Then set value after short delay
      setTimeout(() => {
        inputField.value = messageText;
        
        // Focus on input field
        inputField.focus();
        
        // Simulate events with short delays
        ['input', 'change', 'keydown'].forEach((eventType, index) => {
          setTimeout(() => {
            try {
              if (eventType === 'keydown') {
                // Simulate pressing any key to activate field
                inputField.dispatchEvent(new KeyboardEvent('keydown', { 
                  key: 'a',
                  bubbles: true,
                  cancelable: true
                }));
              } else {
                // For other events use standard events
                inputField.dispatchEvent(new Event(eventType, { bubbles: true }));
              }
            } catch (error) {
              console.error(`Grok: Error sending event ${eventType}:`, error);
            }
          }, index * 100);
        });
        
        console.log('Grok: Sent all events');
      }, 200);
    }
  } catch (error) {
    console.error('Error handling Grok:', error);
  }
}

// Handler for ChatGPT
function handleChatGptMessage(inputField, messageText) {
  try {
    // Set value with two methods
    if (inputField.value !== undefined) {
      inputField.value = messageText;
    }
    if (inputField.innerHTML !== undefined) {
      inputField.innerHTML = messageText;
    }
    console.log('ChatGPT: Set value');
    
    // Additional check for contenteditable elements
    if (inputField.getAttribute('contenteditable') === 'true') {
      inputField.textContent = messageText;
    }
    
    // Simulate events focusing on specific ChatGPT events
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
          console.error(`ChatGPT: Error sending event ${eventType}:`, error);
        }
      }, index * 50);
    });
    console.log('ChatGPT: Sent events');
  } catch (error) {
    console.error('Error handling ChatGPT:', error);
  }
}

// Universal handler for other chats
function handleGenericMessage(inputField, messageText) {
  try {
    // Different ways to set text depending on element type
    if (inputField.tagName.toLowerCase() === 'textarea' || inputField.tagName.toLowerCase() === 'input') {
      inputField.value = messageText;
      console.log('Generic: Set value for input/textarea element');
    } else if (inputField.getAttribute('contenteditable') === 'true') {
      inputField.textContent = messageText;
      console.log('Generic: Set textContent for contenteditable');
    } else {
      // If nothing fits, try both methods
      if (inputField.value !== undefined) inputField.value = messageText;
      if (inputField.textContent !== undefined) inputField.textContent = messageText;
      if (inputField.innerHTML !== undefined) inputField.innerHTML = messageText;
      console.log('Generic: Attempted to set with multiple methods');
    }
    
    // Simulate more events for reliability
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
          console.error(`Generic: Error sending event ${eventType}:`, error);
        }
      }, index * 50); // Small delay between events
    });
    console.log('Generic: Sent all events');
  } catch (error) {
    console.error('Error handling generic message:', error);
  }
}

// Function to check if element is visible on page
function isElementVisible(element) {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         element.offsetWidth > 0 && 
         element.offsetHeight > 0;
}

// Handler for DeepSeek
function handleDeepSeekMessage(inputField, messageText) {
  try {
    // Clear field first
    if (inputField.value !== undefined) {
      inputField.value = '';
    }
    if (inputField.tagName.toLowerCase() === 'div' && inputField.getAttribute('contenteditable') === 'true') {
      inputField.textContent = '';
    }
    
    // Focus on input field
    inputField.focus();
    
    // Use only one method for setting value with delay
    setTimeout(() => {
      if (inputField.value !== undefined) {
        inputField.value = messageText;
        
        // Send only necessary events with larger delays
        ['input', 'change'].forEach((eventType, index) => {
          setTimeout(() => {
            try {
              const event = new Event(eventType, { bubbles: true });
              inputField.dispatchEvent(event);
            } catch (error) {
              console.error(`DeepSeek: Error sending event ${eventType}:`, error);
            }
          }, index * 150);
        });
      } else if (inputField.tagName.toLowerCase() === 'div' && inputField.getAttribute('contenteditable') === 'true') {
        inputField.textContent = messageText;
        
        // For contenteditable elements need specific events
        try {
          const event = new InputEvent('input', { bubbles: true });
          inputField.dispatchEvent(event);
        } catch (e) {
          console.error('DeepSeek: Error sending input event:', e);
        }
      }
      
      console.log('DeepSeek: Set value and sent events');
    }, 300);
  } catch (error) {
    console.error('Error handling DeepSeek:', error);
  }
}
