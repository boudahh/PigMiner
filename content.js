function autoPauseAnimation() {
    try {
        const pauseBtn = [...document.querySelectorAll('button')]
            .find(btn => btn.getAttribute('aria-label') === 'Pause Animation');

        if (pauseBtn) {
            pauseBtn.click();
            console.log("[PigMiner] Animation paused automatically.");
        } else {
            console.warn("[PigMiner] Pause Animation button not found.");
        }
    } catch (err) {
        console.error("[PigMiner] Failed to auto-pause animation:", err);
    }
}



function injectCenterCountdownOverlay() {
    if (document.getElementById("pig-delay-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "pig-delay-overlay";
    overlay.style.cssText = `
        position: fixed;
        top: calc(50% + 5px);
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.85);
        padding: 20px 30px;
        color: hotpink;
        font-size: 32px;
        font-weight: bold;
        border-radius: 12px;
        box-shadow: 0 0 15px hotpink;
        z-index: 99999;
        text-align: center;
        transition: opacity 0.5s ease, transform 0.5s ease;
    `;

    overlay.innerHTML = `
        Starting in: <span id="pig-delay-overlay-count">...</span>s<br/>
        <button id="pig-sound-toggle" style="
            margin-top: 10px;
            font-size: 14px;
            padding: 5px 10px;
            background: #444;
            color: white;
            border: 1px solid #999;
            border-radius: 5px;
            cursor: pointer;
            transition: all 0.3s ease;
        ">🔇 Sound OFF</button>
    `;

    document.body.appendChild(overlay);
}


// === RIGHT PANEL: Main UI ===
const rightPanelHTML = `
    <div class="pigminer-panel" id="pig-claims-panel" style="
        position: fixed; top: 50px; right: 20px; width: 220px; background-color: #111;
        padding: 12px; color: #eee; z-index: 10000; font-family: monospace; font-size: 12px;
        border: 1px solid #555;
    ">
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px; text-align: center;"><span style="font-size: 1.6em; color: pink;">PigMiner</span>🫵🐽</div>
        <div id="pig-status" style="position: relative; padding-left: 24px;">Status: <span style="font-weight: bold;">Initializing...</span></div>
        <div>Hash Rate: <span id="pig-hashrate">--</span> h/s</div>
        <div>Unclaimed (R): <span id="pig-unclaimed-display">N/A</span></div>
        <div>Next Claim In: <span id="pig-timer">Waiting</span></div>
        <button id="pig-pause" class="pig-button" style="
            margin-top: 10px; padding: 8px; width: 100%;
            background: linear-gradient(to bottom, #ffca28, #ffb300); border-radius: 5px;
            box-shadow: 0 2px 0 #c69700; transition: all 0.2s ease-in-out;
            color: black; border: none; font-weight: bold; cursor: pointer;
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 0 #c69700';"
          onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 0 #c69700';">
            STOP & CLAIM NOW
        </button>
        <div id="pig-error" style="color: hotpink; font-size: 10px; margin-top: 6px; min-height: 12px;"></div>
    </div>
`;

// === CLAIM LOGGER ===
function logClaim(tokenString) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[PigMiner] Claimed: ${timestamp} - ${tokenString}`);

    const lastClaimedEl = document.getElementById('last-claimed');
    if (lastClaimedEl) lastClaimedEl.textContent = tokenString;
}

// *** UPDATED FUNCTION BASED ON amount claimed script.txt ***
function extractUnclaimedValueDetails() {
    try {
        const boxes = document.querySelectorAll('.lcdbox > div');
        if (!boxes || boxes.length === 0) {
            return null;
        }

        let label = '';
        let numStr = '';
        let foundUnclaimed = false;

        for (let i = 0; i < boxes.length; i++) {
            const char = boxes[i].textContent.trim();

            if (!foundUnclaimed) {
                label += char;
                if (label.toLowerCase().includes('unclaimed:')) {
                    foundUnclaimed = true;
                    i += 1;
                }
            } else {
                if (char.toUpperCase() === 'M') {
                    const raw = parseFloat(numStr) * 1_000_000;
                    if (isNaN(raw)) return null;
                    return { raw: raw, formatted: raw.toLocaleString() };
                } else if (char.toUpperCase() === 'B') {
                    const raw = parseFloat(numStr) * 1_000_000_000;
                    if (isNaN(raw)) return null;
                    return { raw: raw, formatted: raw.toLocaleString() };
                } else if (char !== ':') {
                    numStr += char.replace(/,/g, '');
                }
            }
        }

        if (foundUnclaimed && numStr) {
            const raw = parseFloat(numStr);
            if (!isNaN(raw)) {
                return { raw: raw, formatted: raw.toLocaleString() };
            }
        }

        return null;

    } catch (error) {
        console.error('[PigMiner] Error extracting unclaimed value:', error);
        return null;
    }
}

// *** CACHED SELECTORS ***
const selectors = {
    claimButton: "button.start-action",
    statusElement: "#pig-status",
    hashrateElement: "#pig-hashrate",
    unclaimedDisplayElement: "#pig-unclaimed-display",
    timerElement: "#pig-timer",
    errorElement: "#pig-error",
    allDivs: "div",
    lcdBoxes: ".lcdbox > div",
    pigPauseButton: "#pig-pause",
    queuedButton: 'button.start-action[disabled]'
};

let twentyOneMinutes = 21 * 60 * 1000; // 21 minutes in milliseconds
let refreshTimer = null; // To store the setTimeout ID
let lastMineClickTime = 0; // Timestamp of the last Mine button click
let queuedButtonDetected = false;

function triggerStopAndClaim() {
    const claimBtn = document.querySelector(selectors.claimButton);
    if (claimBtn) {
        claimBtn.click();
        console.log("[PigMiner] STOP & CLAIM triggered.");
        const statusEl = document.querySelector(selectors.statusElement);
        if (statusEl) statusEl.textContent = "Claiming...";
        lastClaimTimestamp = Date.now();
        timerCountdown = timerSeconds;

        setTimeout(() => {
            try {
                const result = extractUnclaimedValueDetails();
                if (result) {
                    logClaim(result.formatted);
                } else {
                    logClaim("Claimed (value N/A)");
                    console.warn('[PigMiner] Could not extract unclaimed amount post-claim trigger.');
                }
            } catch (err) {
                console.error('[PigMiner] Error in post-claim value extraction/logging:', err);
            }
        }, 500);

    } else {
        console.warn("[PigMiner] Claim button not found.");
        const statusEl = document.querySelector(selectors.statusElement);
        if (statusEl) statusEl.textContent = "Error: Claim Btn missing";
    }
}

function getLiveHashRate() {
    try {
        const hashDivs = [...document.querySelectorAll(selectors.allDivs)];
        const hashDiv = hashDivs.find(div =>
            div.textContent?.toLowerCase().includes("h/s") && !div.textContent?.toLowerCase().includes("th/s")
        );

        if (!hashDiv) {
            return null;
        }

        const match = hashDiv.textContent.match(/([\d,.]+)\s*h\/s/i);
        if (match && match[1]) {
            const rate = parseFloat(match[1].replace(/,/g, ''));
            return isNaN(rate) ? null : rate;
        }
        return null;
    } catch (error) {
        console.error('[PigMiner] Error getting hash rate:', error);
        return null;
    }
}

let uiPanelsInjected = false;  // Flag to track injection

function injectUIPanels() {
    if (uiPanelsInjected) {
        console.warn("[PigMiner] UI panels already injected. Skipping.");
        return;
    }

    try {
        if (document.body) {
            document.body.insertAdjacentHTML('beforeend', rightPanelHTML);

            const pauseButton = document.querySelector(selectors.pigPauseButton); //  was pig-pause
            if (pauseButton) {
                pauseButton.addEventListener("click", triggerStopAndClaim);
            } else {
                console.warn('[PigMiner] STOP & CLAIM button element not found after injection.');
            }
            uiPanelsInjected = true;  // Set the flag
        } else {
            console.error("[PigMiner] Could not find document.body to inject UI panels.");
            // Consider a more robust error handling mechanism here
        }
    } catch (e) {
        console.error("[PigMiner] UI injection failed:", e);
        // Consider a more robust error handling mechanism here
    }
}

// === State Variables ===
let zeroHashCountdown = 0;
let lastClaimTimestamp = 0;
let autoClaimEnabled = false;
let timerSeconds = 0;
let timerCountdown = 0;
let autoClaimAmount = 0;
let currentHashRate = null;
let currentUnclaimed = { raw: 0, formatted: 'N/A' };
let pigMinerIntervalId = null;
let initialClaimDelay = 15; // Default value

// === Core Logic ===


let queuedDetectionCount = 0;
const maxQueuedDetections = 30;

function checkForQueuedButton() {
    try {
        const queuedButton = document.querySelector(selectors.queuedButton);
        if (queuedButton && queuedButton.textContent === 'QUEUED') {
            queuedDetectionCount++;
            if (!queuedButtonDetected) {
                console.log("[PigMiner] 'QUEUED' button detected. Starting detection count.");
                queuedButtonDetected = true;
            }

            if (queuedDetectionCount >= maxQueuedDetections) {
                console.warn("[PigMiner] QUEUED detected 30 times — reloading page.");
                queuedButtonDetected = false;
                queuedDetectionCount = 0;
                location.reload();
            }
        } else {
            if (queuedButtonDetected) {
                console.log("[PigMiner] 'QUEUED' disappeared — resetting counter.");
                queuedButtonDetected = false;
                queuedDetectionCount = 0;
            }
        }
    } catch (error) {
        console.error("[PigMiner] Error checking for 'QUEUED' button:", error);
    }
}


function triggerMine() {
    const mineButton = document.querySelector(selectors.claimButton);
    if (mineButton) {
        mineButton.click();
        console.log("[PigMiner] Mine button clicked (initial delay).");
        lastMineClickTime = Date.now(); // Record the click time
        queuedButtonDetected = false; // Reset the flag
        checkForQueuedButton(); // Check for "QUEUED" button immediately
    } else {
        console.warn("[PigMiner] Mine button not found (initial delay).");
    }
}

function performInitialClaim() {  // STEP 6: Add this function
    triggerMine();
    console.log(`[PigMiner] Initial claim triggered after ${initialClaimDelay} seconds.`);
}

function startAutoClaimTimer() {
    chrome.storage.local.get(
        ["pigTimerSeconds", "pigAutoClaimAmount", "pigInitialClaimDelay"],
        (data) => {
            if (chrome.runtime.lastError) {
                console.error("Storage Error:", chrome.runtime.lastError);
                // Handle the error appropriately (e.g., display an error message)
                return; // Very important to stop execution if there's an error
            }

            timerSeconds = parseInt(data.pigTimerSeconds || "0", 10);
            autoClaimAmount = parseFloat(data.pigAutoClaimAmount || "0");
            initialClaimDelay = parseInt(data.pigInitialClaimDelay !== undefined ? data.pigInitialClaimDelay : "15", 10); // Load or default

            if (isNaN(timerSeconds)) timerSeconds = 0;
            if (isNaN(autoClaimAmount)) autoClaimAmount = 0;
            if (isNaN(initialClaimDelay)) initialDelay = 15; // Ensure valid default

            autoClaimEnabled = timerSeconds > 0 || autoClaimAmount > 0;
            timerCountdown = timerSeconds > 0 ? timerSeconds : 0;

            console.log(`[PigMiner DEBUG] Settings Loaded - Timer: ${timerSeconds}s, Amount: ${autoClaimAmount}, Initial Delay: ${initialClaimDelay}s, AutoClaim Active: ${autoClaimEnabled}`);

            updateUI();

            // Schedule initial claim if delay is set
            if (initialClaimDelay > 0) {
                setTimeout(performInitialClaim, initialClaimDelay * 1000);
            }
        }
    );
}

function updateUI() {
    // Check if panels exist before trying to update them
    const hashrateEl = document.querySelector(selectors.hashrateElement);
    const statusEl = document.querySelector(selectors.statusElement);
    const timerEl = document.querySelector(selectors.timerElement);
    const errorEl = document.querySelector(selectors.errorElement);
    const unclaimedDisplayEl = document.querySelector(selectors.unclaimedDisplayElement);

    // If essential panels aren't injected yet, bail out
    if (!statusEl || !unclaimedDisplayEl) {
        console.debug("[PigMiner] UI elements not ready in updateUI(), skipping.");
        return;
    }

    // Clear previous errors displayed in UI
    if (errorEl && errorEl.textContent) errorEl.textContent = '';

    // Update Hashrate
    if (hashrateEl) {
        hashrateEl.textContent = (currentHashRate !== null && currentHashRate !== undefined)
            ? currentHashRate.toLocaleString()
            : "--";
    }

    // *** UPDATE UNCLAIMED DISPLAYS (BOTH PANELS) ***
    const unclaimedText = currentUnclaimed.formatted || 'N/A';
    if (unclaimedDisplayEl) {
        unclaimedDisplayEl.textContent = unclaimedText;
    }

    // Determine Status and Timer Text (in right panel)
    let statusText = "Idle";
    let timerText = "Waiting";

    if (currentHashRate === null) {
        statusText = "Initializing...";
    } else if (currentHashRate === 0) {
        statusText = "Waiting (Hash 0)";
    } else {
        if (autoClaimEnabled) {
            statusText = "Running (Auto)";
            if (timerSeconds > 0) {
                timerText = timerCountdown + "s";
                if (autoClaimAmount > 0) {
                    timerText += ` / Amount > ${autoClaimAmount.toLocaleString()}`;
                }
            } else if (autoClaimAmount > 0) {
                timerText = `Amount > ${autoClaimAmount.toLocaleString()}`;
                statusText = "Running (Amount Trigger)";
            } else {
                statusText = "Running (Error State?)";
                timerText = "Config Error";
            }
        } else {
            statusText = "0 Hash Claim"; // Note: This seems like a potential display bug/typo in original code
        }
    }

    // Update Status and Timer elements
    if (statusEl) statusEl.textContent = statusText;
    if (timerEl) timerEl.textContent = timerText;

    console.debug("[PigMiner] UI updated successfully.");
}

function mainLoop() {
    try {
        // 1. Get current data
        currentHashRate = getLiveHashRate();
        const unclaimedResult = extractUnclaimedValueDetails();
        if (unclaimedResult) {
            currentUnclaimed = unclaimedResult;
        } else {
            currentUnclaimed = { raw: 0, formatted: 'N/A (Error)' };
            console.warn("[PigMiner] Failed to extract unclaimed value in main loop.");
        }

        
        // === Safer dual-claim logic (amount OR hash 0) ===
        let shouldClaimByZeroHash = false;
        let shouldClaimByAmount = false;

        // Check Zero Hash condition
        if (currentHashRate === 0) {
            zeroHashCountdown++;
            // Claim if hash rate is 0 for 10 checks AND it's been > 15s since last claim
            if (zeroHashCountdown >= 10 && Date.now() - lastClaimTimestamp > 15000) {
                shouldClaimByZeroHash = true;
                console.log("[PigMiner] Hash rate 0 condition met.");
            }
             // Reset timer countdown if hash rate is 0 but timer is active
             if (autoClaimEnabled && timerSeconds > 0 && timerCountdown !== timerSeconds) {
                timerCountdown = timerSeconds;
            }
        } else {
            // Reset zero hash counter if hash rate is positive
            zeroHashCountdown = 0;

             // Process Timer condition only if hash rate is positive
            if (autoClaimEnabled && timerSeconds > 0) {
                 timerCountdown--;
                if (timerCountdown <= 0) {
                    console.log("[PigMiner] Timer condition met.");
                    shouldClaimByAmount = true; // Use shouldClaimByAmount for timer too for simplicity
                }
            }

            // Process Amount condition only if hash rate is positive and timer hasn't triggered claim
             if (!shouldClaimByAmount && autoClaimEnabled && autoClaimAmount > 0 && currentUnclaimed.raw > 0) {
                if (currentUnclaimed.raw >= autoClaimAmount) {
                    console.log(`[PigMiner] Amount condition met (${currentUnclaimed.raw} >= ${autoClaimAmount}).`);
                    shouldClaimByAmount = true;
                 }
             }
        }


        // 3. Update UI with latest data and status
        updateUI();

        // 4. Trigger Claim if needed
        if (shouldClaimByZeroHash || shouldClaimByAmount) {
             // Reset countdowns immediately before triggering claim
             if(shouldClaimByAmount && timerSeconds > 0) timerCountdown = timerSeconds;
             zeroHashCountdown = 0; // Reset zero hash counter on any claim
            triggerStopAndClaim();
        }
    } catch (err) {
        console.error("[PigMiner] Main loop error:", err);
        const errorEl = document.querySelector(selectors.errorElement);
        if (errorEl) errorEl.textContent = "Main loop error!";
    } finally {
        checkForQueuedButton(); // Check for QUEUED button in mainLoop
    }
}

// OPTIMIZED FUNCTION:
function startVisualDelayCountdown() {
    chrome.storage.local.get(["pigInitialClaimDelay", "pigSoundEnabled"], (data) => {
        let delay = parseInt(data.pigInitialClaimDelay, 10);
        if (isNaN(delay)) delay = 15;

        const countEl = document.getElementById("pig-delay-overlay-count");
        const container = document.getElementById("pig-delay-overlay");
        const toggleButton = document.getElementById("pig-sound-toggle");

        if (!countEl || !container || !toggleButton) return;

        const soundState = {
            enabled: data.pigSoundEnabled === true
        };

        // --- Optimization: Create Audio object ONCE ---
        let beepSound = null;
        if (soundState.enabled) {
             try {
                 beepSound = new Audio(chrome.runtime.getURL("assets/countdown-beep-deep.mp3"));
                 beepSound.volume = 0.5; // Set volume once
                 // Optional: Preload the audio slightly, may improve responsiveness on first play
                 // beepSound.load();
             } catch (err) {
                  console.error("[PigMiner] Failed to create countdown audio:", err);
                  soundState.enabled = false; // Disable sound if creation fails
             }
        }
        // ---------------------------------------------

        const updateButtonStyle = () => {
            toggleButton.textContent = soundState.enabled ? "🔊 Sound ON" : "🔇 Sound OFF";
            toggleButton.style.background = soundState.enabled ? "green" : "#444";
            toggleButton.style.borderColor = soundState.enabled ? "#0f0" : "#999";
        };

        updateButtonStyle();

        toggleButton.addEventListener("click", () => {
            soundState.enabled = !soundState.enabled;
            chrome.storage.local.set({ pigSoundEnabled: soundState.enabled }, () => {
                updateButtonStyle();
                // --- Optimization: Update audio object based on toggle ---
                if (soundState.enabled && !beepSound) {
                     try {
                         beepSound = new Audio(chrome.runtime.getURL("assets/countdown-beep-deep.mp3"));
                         beepSound.volume = 0.5;
                         // beepSound.load();
                     } catch (err) {
                         console.error("[PigMiner] Failed to create countdown audio on toggle:", err);
                         soundState.enabled = false;
                         updateButtonStyle(); // Reflect failed state
                     }
                } else if (!soundState.enabled && beepSound) {
                    // Optional: pause if playing, release resources? May not be needed.
                    // beepSound.pause();
                    // beepSound = null; // Or keep it loaded if they might re-enable
                }
                // ---------------------------------------------------------
            });
        });

        countEl.textContent = `${delay}`;
        const interval = setInterval(() => {
            delay--;

            if (delay <= 0) {
                clearInterval(interval);
                container.style.opacity = "0";
                container.style.transform = "scale(0.9)";
                setTimeout(() => container.remove(), 400);
            } else {
                countEl.textContent = `${delay}`;
                // --- Optimization: Use the preloaded object ---
                if (delay <= 10 && soundState.enabled && beepSound) {
                    // Reset playback to start if it was already playing (optional but good practice)
                    beepSound.currentTime = 0;
                    beepSound.play().catch(error => console.error("[PigMiner] Beep play error:", error));
                }
                // ---------------------------------------------
            }
        }, 1000);
    });
}


function initializeExtension(observer) {
    injectCenterCountdownOverlay(); // Inject overlay first
    startVisualDelayCountdown(); // Then start its countdown logic
    console.log("[PigMiner] Initializing Extension...");
    injectUIPanels();
    autoPauseAnimation(); 
    // Removed duplicate injectCenterCountdownOverlay and startVisualDelayCountdown calls
    try {
        startAutoClaimTimer(); // Load settings and schedule initial mine click

        if (pigMinerIntervalId) {
            clearInterval(pigMinerIntervalId);
        }
        pigMinerIntervalId = setInterval(mainLoop, 1000); // Start main monitoring loop
        console.log("[PigMiner] Extension Initialized and main loop started.");
    } catch (e) {
        console.error('[PigMiner] Extension initialization failed:', e);
        const errorEl = document.querySelector(selectors.errorElement);
        if (errorEl) errorEl.textContent = "Initialization error!";
    } finally {
        if (observer) {
            observer.disconnect(); // Stop observing once initialized
            console.log("[PigMiner] MutationObserver disconnected.");
        }
    }
}

// === Initialization Trigger ===

// Use a flag to prevent multiple initializations if observer fires rapidly
let initializationStarted = false;

const observer = new MutationObserver((mutations, obs) => {
    // Check for body and ensure panel isn't already there AND initialization hasn't started
    if (document.body && !document.getElementById('pig-claims-panel') && !initializationStarted) {
         initializationStarted = true; // Set flag
        console.log("[PigMiner] Body element found, initializing...");
        initializeExtension(obs); // Pass observer to disconnect it inside
    }
});

// Observe the document root for changes
observer.observe(document.documentElement || document, {
    childList: true,
    subtree: true
});

// === Message Listener ===
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("[PigMiner] Message received:", msg);
    let isAsync = false; // Required for async responses like storage access

    if (msg.action === "setTimer" && msg.seconds !== undefined) {
        isAsync = true;
        const newTimerSeconds = parseInt(msg.seconds, 10);
        if (!isNaN(newTimerSeconds) && newTimerSeconds >= 0) {
            chrome.storage.local.set({ pigTimerSeconds: newTimerSeconds }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Storage Error:", chrome.runtime.lastError);
                    sendResponse({ success: false, error: "Failed to save timer setting" });
                    return;
                }
                timerSeconds = newTimerSeconds;
                // Reset countdown immediately if timer is active, otherwise set to 0
                timerCountdown = newTimerSeconds > 0 ? newTimerSeconds : 0;
                autoClaimEnabled = timerSeconds > 0 || autoClaimAmount > 0;
                console.log(`[PigMiner] Timer setting updated: ${timerSeconds}s. AutoClaim Active: ${autoClaimEnabled}`);
                updateUI(); // Update UI to reflect new settings
                sendResponse({ success: true, timerSet: timerSeconds });
            });
        } else {
            sendResponse({ success: false, error: "Invalid seconds value" });
            isAsync = false; // Not async if input validation fails early
        }
    } else if (msg.action === "setAmount" && msg.amount !== undefined) {
        isAsync = true;
        const newAmount = parseFloat(msg.amount);
        if (!isNaN(newAmount) && newAmount >= 0) {
            chrome.storage.local.set({ pigAutoClaimAmount: newAmount }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Storage Error:", chrome.runtime.lastError);
                    sendResponse({ success: false, error: "Failed to save amount setting" });
                    return;
                }
                autoClaimAmount = newAmount;
                autoClaimEnabled = autoClaimAmount > 0 || timerSeconds > 0;
                console.log(`[PigMiner] Amount setting updated: ${autoClaimAmount}. AutoClaim Active: ${autoClaimEnabled}`);
                updateUI(); // Update UI
                sendResponse({ success: true, amountSet: autoClaimAmount });
            });
        } else {
            sendResponse({ success: false, error: "Invalid amount value" });
            isAsync = false;
        }
    } else if (msg.action === "getSettings") {
        // This doesn't need to be async
        sendResponse({
            timerSeconds: timerSeconds,
            autoClaimAmount: autoClaimAmount,
            autoClaimEnabled: autoClaimEnabled,
            initialClaimDelay: initialClaimDelay // Also return initial delay if popup needs it
        });
    } else if (msg.action === "triggerClaimNow") {
        // Not async
        console.log("[PigMiner] Manual claim triggered from popup.");
        triggerStopAndClaim();
        sendResponse({ success: true, message: "Claim triggered" });
    } else if (msg.action === "setInitialDelay" && msg.seconds !== undefined) {
        isAsync = true;
        const newDelay = parseInt(msg.seconds, 10);
        if (!isNaN(newDelay) && newDelay >= 0) {
            chrome.storage.local.set({ pigInitialClaimDelay: newDelay }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Storage Error:", chrome.runtime.lastError);
                    sendResponse({ success: false, error: "Failed to save initial delay" });
                    return;
                }
                initialClaimDelay = newDelay;
                console.log(`[PigMiner] Initial delay set to ${initialClaimDelay} seconds.`);
                // No immediate action needed in content script besides storing it
                sendResponse({ success: true, delaySet: initialClaimDelay });
            });
        } else {
            sendResponse({ success: false, error: "Invalid initial delay value" });
            isAsync = false;
        }
    } else {
        // Not async
        console.warn("[PigMiner] Unknown message action received:", msg.action);
        sendResponse({ success: false, error: "Unknown action" });
    }

    // IMPORTANT: Return true to indicate you will send a response asynchronously
    // Only return true if isAsync was set to true for the handled message.
    return isAsync;
});