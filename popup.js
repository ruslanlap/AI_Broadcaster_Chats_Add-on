
// Define supported AI chats
const AI_CHAT_URLS = {
  'ChatGPT': ['https://chat.openai.com', 'https://chatgpt.com'],
  'Claude': 'https://claude.ai',
  'Grok': 'https://grok.com',
  'DeepSeek': 'https://chat.deepseek.com',
  'Mistral': 'https://chat.mistral.ai'
};

// When popup loads
document.addEventListener('DOMContentLoaded', async () => {
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const statusMessage = document.getElementById('status-message');
  const chatTabsContainer = document.getElementById('chat-tabs');
  const noChatsMessage = document.getElementById('no-chats-message');
  
  // Find open tabs with AI chats
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
  
  // Display found chats or message if none
  if (aiChatTabs.length > 0) {
    noChatsMessage.style.display = 'none';
    
    // Create list of chats with checkboxes
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
      ) || 'Unknown AI Chat';
      
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
  
  // Send button handler
  sendButton.addEventListener('click', async () => {
    const message = messageInput.value.trim();
    
    if (!message) {
      showStatus('Please enter a message to send', 'error');
      return;
    }
    
    // Get selected tabs
    const selectedCheckboxes = document.querySelectorAll('#chat-tabs input[type="checkbox"]:checked');
    
    if (selectedCheckboxes.length === 0) {
      showStatus('Please select at least one chat to send to', 'error');
      return;
    }
    
    // For each selected tab, send message with increased delay between sends
    const sendPromises = Array.from(selectedCheckboxes).map((checkbox, index) => {
      const tabId = parseInt(checkbox.dataset.tabId);
      // Significantly increase delay between sends to different chats
      return new Promise(resolve => setTimeout(() => {
        console.log(`Sending message to tab ${tabId}...`);
        
        // First activate tab to ensure it's in focus
        browser.tabs.update(tabId, { active: true }).then(() => {
          // Increase delay after tab activation
          setTimeout(() => {
            browser.tabs.sendMessage(tabId, {
              action: 'sendMessage',
              message: message
            }).then(response => {
              console.log(`Successfully sent to tab ${tabId}:`, response);
              resolve(response || { success: true });
            }).catch(error => {
              console.error(`Error sending to tab ${tabId}:`, error);
              resolve({ tabId, success: false, error: error.message || "Unknown error" });
            });
          }, 2000); // Increased delay after tab activation to 2 seconds
        }).catch(error => {
          console.error(`Error activating tab ${tabId}:`, error);
          resolve({ tabId, success: false, error: "Tab activation error" });
        });
      }, index * 3000)); // Significantly increased delay between sends (3000ms per tab)
    });
    
    // Wait for all sends to complete
    const results = await Promise.all(sendPromises);
    
    // Check results
    const successCount = results.filter(result => result.success !== false).length;
    const errorCount = results.length - successCount;
    
    if (errorCount === 0) {
      showStatus(`Successfully sent message to ${successCount} chat(s)!`, 'success');
    } else if (successCount === 0) {
      showStatus(`Failed to send message to any chat. Check console for details.`, 'error');
    } else {
      showStatus(`Sent to ${successCount} chat(s), error in ${errorCount} chat(s).`, 'error');
    }
  });
  
  // Function to show status with option to display details
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
    statusMessage.style.display = 'block';
    
    // When error occurs, send detailed info to background script for logging
    if (type === 'error') {
      browser.runtime.sendMessage({
        action: 'logEvent',
        data: {
          type: 'error',
          message: message,
          timestamp: new Date().toISOString()
        }
      }).catch(err => console.error('Logging error:', err));
    }
    
    // Automatically hide after 15 seconds for errors, 5 seconds for success
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, type === 'error' ? 15000 : 5000);
  }
});
