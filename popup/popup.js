document.addEventListener("DOMContentLoaded", () => {
  // --- Function Declarations (IMPORTANT: Declare these FIRST) ---
  // Function to display status messages
  function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.style.color = isError ? "#ff6b6b" : "#9e9e9e"; // Red for errors, grey otherwise
    // Clear status after a few seconds
    setTimeout(() => {
        if (statusMessage.textContent === message) { // Clear only if message hasn't changed
            statusMessage.textContent = '';
        }
    }, 3000);
  }

  // Function to send messages to content script
  function sendMessageToContentScript(message, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0 || !tabs[0].id) {
        showStatus("Error: Could not find active tab.", true);
        return;
      }
      // Check if the tab is the correct URL (optional but good practice)
      if (!tabs[0].url || !tabs[0].url.startsWith("https://www.pond0x.com/mining")) {
           showStatus("Error: Not on Pond0x mining page.", true);
           return;
      }

      chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
        if (chrome.runtime.lastError) {
          // Handle potential errors like content script not ready
          console.error("Message sending error:", chrome.runtime.lastError.message);
          showStatus(`Error: ${chrome.runtime.lastError.message}. Try reloading the page?`, true);
        } else if (callback) {
          callback(response); // Process the response if a callback is provided
        }
      });
    });
  }

  // --- Get references to UI elements ---
  const timerInput = document.getElementById("pig-timer-input");
  const setTimerBtn = document.getElementById("pig-set-timer");
  const amountInput = document.getElementById("pig-amount-input");
  const amountSelect = document.getElementById("pig-amount-select");
  const setAmountBtn = document.getElementById("pig-set-amount");
  const triggerClaimBtn = document.getElementById("pig-trigger-claim");
  const statusMessage = document.getElementById("status-message");
  const initialDelayInput = document.getElementById("pig-initial-delay-input");
  const setInitialDelayBtn = document.getElementById("pig-set-initial-delay");

  // --- Load current settings from storage when popup opens ---
  chrome.storage.local.get(["pigTimerSeconds", "pigAutoClaimAmount", "pigInitialClaimDelay"], (data) => {
    const savedSeconds = data.pigTimerSeconds || 0;
    const savedAmount = data.pigAutoClaimAmount || 0;
    const savedInitialDelay = data.pigInitialClaimDelay !== undefined ? data.pigInitialClaimDelay : 15;

    timerInput.value = savedSeconds;

    // Deconstruct saved amount for display (e.g., 1500000 -> 1.5 M)
    if (savedAmount >= 1_000_000_000 && savedAmount % 1_000_000_000 === 0) {
        amountInput.value = savedAmount / 1_000_000_000;
        amountSelect.value = 'B';
    } else if (savedAmount >= 1_000_000 && savedAmount % 1_000_000 === 0) {
        amountInput.value = savedAmount / 1_000_000;
        amountSelect.value = 'M';
    } else {
        amountInput.value = savedAmount;
        amountSelect.value = 'raw';
    }

    initialDelayInput.value = savedInitialDelay;

    showStatus("Settings loaded.");
  });

  // --- Event Listeners ---
  // Set Timer Button
  setTimerBtn.addEventListener("click", () => {
    const seconds = parseInt(timerInput.value, 10);
    if (isNaN(seconds) || seconds < 0) {
      showStatus("Invalid seconds value. Must be 0 or greater.", true);
      return;
    }
    showStatus(`Setting timer to ${seconds}s...`);
    sendMessageToContentScript({ action: "setTimer", seconds: seconds }, (response) => {
        if (response && response.success) {
            showStatus(`Timer set to ${response.timerSet} seconds.`);
        } else {
            showStatus(response?.error || "Failed to set timer.", true);
        }
    });
  });

  // Set Amount Trigger Button
  setAmountBtn.addEventListener("click", () => {
    const amount = parseFloat(amountInput.value);
    const unit = amountSelect.value;
    let fullAmount = 0;

    if (isNaN(amount) || amount < 0) {
       showStatus("Invalid amount value. Must be 0 or greater.", true);
       return;
    }

    switch (unit) {
      case "M":
        fullAmount = amount * 1_000_000;
        break;
      case "B":
        fullAmount = amount * 1_000_000_000;
        break;
      default: // 'raw'
        fullAmount = amount;
    }

    showStatus(`Setting amount trigger to ${fullAmount.toLocaleString()}...`);
    sendMessageToContentScript({ action: "setAmount", amount: fullAmount }, (response) => {
        if (response && response.success) {
             showStatus(`Amount trigger set to ${response.amountSet.toLocaleString()}.`);
        } else {
             showStatus(response?.error || "Failed to set amount trigger.", true);
        }
    });
  });

  // Trigger Claim Now Button
  triggerClaimBtn.addEventListener("click", () => {
      showStatus("Triggering manual claim...");
      sendMessageToContentScript({ action: "triggerClaimNow" }, (response) => {
          if (response && response.success) {
              showStatus(response.message || "Claim triggered!");
              // Maybe close the popup after manual trigger?
              // setTimeout(() => window.close(), 1000);
          } else {
              showStatus(response?.error || "Failed to trigger claim.", true);
          }
      });
  });

  // --- Initial Delay Button ---
  setInitialDelayBtn.addEventListener("click", () => {
    const delaySeconds = parseInt(initialDelayInput.value, 10);
    if (isNaN(delaySeconds) || delaySeconds < 0) {
      showStatus("Invalid delay value. Must be 0 or greater.", true);
      return;
    }
    showStatus(`Setting initial claim delay to ${delaySeconds} seconds...`);
    sendMessageToContentScript({ action: "setInitialDelay", seconds: delaySeconds }, (response) => {
      if (response && response.success) {
        showStatus(`Initial claim delay set to ${response.delaySet} seconds.`);
      } else {
        showStatus(response?.error || "Failed to set initial delay.", true);
      }
    });
  });
}); // End DOMContentLoaded