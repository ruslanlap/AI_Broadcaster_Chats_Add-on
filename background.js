
// Background script for additional functionality

// Listen for messages from popup.js or content.js
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle different message types
  
  if (message.action === 'logEvent') {
    // Detailed logging with timestamp
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] Extension event:`, message.data);
    
    // If this is an error, show more details in console
    if (message.data && message.data.type === 'error') {
      console.error(`[${timestamp}] ERROR:`, message.data.message);
      
      // Can add error saving for later analysis
      const errors = JSON.parse(localStorage.getItem('aiChatErrors') || '[]');
      errors.push({
        timestamp: new Date().toISOString(),
        message: message.data.message,
        sender: sender.tab ? `Tab ${sender.tab.id}: ${sender.tab.url}` : 'popup'
      });
      // Save last 20 errors
      localStorage.setItem('aiChatErrors', JSON.stringify(errors.slice(-20)));
    }
    
    sendResponse({ received: true });
  }
  
  // Added functionality for getting diagnostic information
  if (message.action === 'getDiagnostics') {
    const diagnosticInfo = {
      browserInfo: navigator.userAgent,
      errors: JSON.parse(localStorage.getItem('aiChatErrors') || '[]'),
      extensionVersion: browser.runtime.getManifest().version
    };
    sendResponse(diagnosticInfo);
  }
  
  // Added functionality for preparing tab
  if (message.action === 'prepareTab') {
    const tabId = message.tabId;
    
    // Make sure tab is ready to work
    browser.tabs.get(tabId).then(tab => {
      if (tab.status === 'complete') {
        sendResponse({ status: 'ready' });
      } else {
        // If tab is not fully loaded, wait
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
    
    return true; // For async response
  }
  
  return true; // For async response
});

// Function to check for open AI chats
async function checkForOpenAIChats() {
  const aiDomains = [
    'chat.openai.com',
    'chatgpt.com',
    'claude.ai',
    'gemini.google.com',
    'gemini.google.com/app',
    'grok.com',
    'chat.deepseek.com'
  ];
  
  const tabs = await browser.tabs.query({});
  const aiTabs = tabs.filter(tab => {
    return aiDomains.some(domain => tab.url.includes(domain));
  });
  
  return aiTabs.length > 0;
}

// Optional: can add handler for extension installation
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // On first installation of extension
    const hasAIChats = await checkForOpenAIChats();
    
    if (!hasAIChats) {
      // Can show message or open instructions page
      browser.tabs.create({
        url: 'welcome-en.html'
      });
    }
  }
});
