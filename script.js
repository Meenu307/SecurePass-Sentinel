// ==========================================================================
// SecurePass Sentinel - Frontend Controller & Real-Time Engine
// ==========================================================================

// Global State & API Configuration
function resolveApiBase() {
  // If explicitly served on Flask port (5000), use same-origin relative paths
  if (window.location.port === "5000") {
    return "";
  }
  // If opened via file:// or any local dev/preview server (PyCharm :63342, Live Server :5500, Vite :5173, etc.)
  if (
    window.location.protocol === "file:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return "http://127.0.0.1:5000";
  }
  // Production deployment (e.g. Render, Vercel)
  return "";
}

const API_BASE = resolveApiBase();
const EVALUATE_API_URL = `${API_BASE}/api/evaluate`;
const HISTORY_API_URL = `${API_BASE}/api/history`;
const HEALTH_API_URL = `${API_BASE}/health`;

// Local Evaluation Cache (enables audit log even if backend server is offline)
function saveLocalEvaluation(record) {
  try {
    const raw = localStorage.getItem("securepass_local_history");
    const history = raw ? JSON.parse(raw) : [];
    history.unshift(record);
    if (history.length > 30) history.pop();
    localStorage.setItem("securepass_local_history", JSON.stringify(history));
  } catch (e) {
    // Fail silently if localStorage is restricted
  }
}

function getLocalEvaluations() {
  try {
    const raw = localStorage.getItem("securepass_local_history");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// Navigation Control
function showSection(sectionId) {
  document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));

  const targetSec = document.getElementById(sectionId);
  const targetLink = document.getElementById('nav-' + sectionId);

  if (targetSec) targetSec.classList.add('active');
  if (targetLink) targetLink.classList.add('active');

  // If opening history section, load fresh data
  if (sectionId === 'history') {
    loadEvaluationHistory();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Toast Notification
function showToast(message) {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toastMsg");
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2400);
}

// Backend Health Indicator
async function checkBackendHealth() {
  const statusPill = document.getElementById("backendStatusPill");
  const statusText = document.getElementById("backendStatusText");
  if (!statusPill || !statusText) return;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(HEALTH_API_URL, { method: "GET", signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      statusText.textContent = "API Active";
      statusPill.style.background = "rgba(16, 185, 129, 0.15)";
      statusPill.style.borderColor = "rgba(16, 185, 129, 0.4)";
      statusPill.title = "Connected to SecurePass SQLite API";
    } else {
      statusText.textContent = "Client Shield";
      statusPill.style.background = "rgba(6, 182, 212, 0.1)";
      statusPill.style.borderColor = "rgba(6, 182, 212, 0.3)";
      statusPill.title = "Client-safe mode active. Run 'python app.py' to enable database sync.";
    }
  } catch (err) {
    statusText.textContent = "Client Shield";
    statusPill.style.background = "rgba(6, 182, 212, 0.1)";
    statusPill.style.borderColor = "rgba(6, 182, 212, 0.3)";
    statusPill.title = "Client-safe mode active. Run 'python app.py' to enable database sync.";
  }
}

// Password Visibility Toggle
const checkPasswordInput = document.getElementById("checkPasswordInput");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const eyeIcon = document.getElementById("eyeIcon");
const eyeOffIcon = document.getElementById("eyeOffIcon");

if (togglePasswordBtn && checkPasswordInput) {
  togglePasswordBtn.addEventListener("click", () => {
    const isPassword = checkPasswordInput.type === "password";
    checkPasswordInput.type = isPassword ? "text" : "password";

    if (isPassword) {
      eyeIcon.style.display = "none";
      eyeOffIcon.style.display = "block";
    } else {
      eyeIcon.style.display = "block";
      eyeOffIcon.style.display = "none";
    }
  });
}

// ==========================================================================
// Password Generator (Cryptographically Secure via CSPRNG)
// ==========================================================================
const lengthRange = document.getElementById("lengthRange");
const lengthVal = document.getElementById("lengthVal");
const generatedPasswordInput = document.getElementById("generatedPassword");
const generateBtn = document.getElementById("generateBtn");
const copyBtn = document.getElementById("copyBtn");
const includeUppercase = document.getElementById("includeUppercase");
const includeNumbers = document.getElementById("includeNumbers");
const includeSymbols = document.getElementById("includeSymbols");
const excludeSimilar = document.getElementById("excludeSimilar");

if (lengthRange && lengthVal) {
  lengthRange.addEventListener("input", (e) => {
    lengthVal.textContent = e.target.value;
  });
}

function applyPreset(presetType) {
  if (!lengthRange || !lengthVal) return;

  if (presetType === 'strong') {
    lengthRange.value = 16;
    lengthVal.textContent = 16;
    includeUppercase.checked = true;
    includeNumbers.checked = true;
    includeSymbols.checked = true;
    if (excludeSimilar) excludeSimilar.checked = false;
  } else if (presetType === 'max') {
    lengthRange.value = 24;
    lengthVal.textContent = 24;
    includeUppercase.checked = true;
    includeNumbers.checked = true;
    includeSymbols.checked = true;
    if (excludeSimilar) excludeSimilar.checked = true;
  } else if (presetType === 'pin') {
    lengthRange.value = 6;
    lengthVal.textContent = 6;
    includeUppercase.checked = false;
    includeNumbers.checked = true;
    includeSymbols.checked = false;
    if (excludeSimilar) excludeSimilar.checked = false;
  }

  generatePassword();
}

function generatePassword() {
  const length = parseInt(lengthRange.value);
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const ambiguousChars = /[l1IO0]/g;

  let validChars = "";
  if (presetIsPin()) {
    validChars = numbers;
  } else {
    validChars += lower;
    if (includeUppercase && includeUppercase.checked) validChars += upper;
    if (includeNumbers && includeNumbers.checked) validChars += numbers;
    if (includeSymbols && includeSymbols.checked) validChars += symbols;
  }

  if (excludeSimilar && excludeSimilar.checked) {
    validChars = validChars.replace(ambiguousChars, "");
  }

  if (!validChars) {
    validChars = lower + numbers;
  }

  // Use window.crypto for cryptographically strong randomness
  const randomValues = new Uint32Array(length);
  window.crypto.getRandomValues(randomValues);

  let password = "";
  for (let i = 0; i < length; i++) {
    password += validChars[randomValues[i] % validChars.length];
  }

  generatedPasswordInput.value = password;
  showToast("New secure key generated!");
}

function presetIsPin() {
  return (!includeUppercase?.checked && !includeSymbols?.checked && includeNumbers?.checked);
}

// Resilient Clipboard Copy
async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fall through to fallback
    }
  }
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textArea);
    return success;
  } catch (err) {
    return false;
  }
}

if (generateBtn) {
  generateBtn.addEventListener("click", generatePassword);
}

if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    if (!generatedPasswordInput || !generatedPasswordInput.value) return;
    const ok = await copyToClipboard(generatedPasswordInput.value);
    if (ok) {
      showToast("Password copied to clipboard! 📋");
    } else {
      showToast("Copied via manual selection.");
    }
  });
}

// ==========================================================================
// Real-Time Security Assessment & Entropy Calculation
// ==========================================================================
const strengthText = document.getElementById("strengthText");
const strengthImage = document.getElementById("strengthImage");
const scoreVal = document.getElementById("scoreVal");
const suggestionsContainer = document.getElementById("suggestionsContainer");
const suggestionsHeader = document.getElementById("suggestionsHeader");
const suggestionsList = document.getElementById("suggestionsList");
const crackTimeBadge = document.getElementById("crackTimeBadge");
const entropyVal = document.getElementById("entropyVal");

const indicatorImages = {
  empty: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='8' x2='12' y2='12'/%3E%3Cline x1='12' y1='16' x2='12.01' y2='16'/%3E%3C/svg%3E",
  weak: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23f43f5e' stroke-width='2'%3E%3Cpath d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/%3E%3Cline x1='12' y1='9' x2='12' y2='13'/%3E%3Cline x1='12' y1='17' x2='12.01' y2='17'/%3E%3C/svg%3E",
  medium: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23f59e0b' stroke-width='2'%3E%3Crect x='3' y='11' width='18' height='11' rx='2' ry='2'/%3E%3Cpath d='M7 11V7a5 5 0 0 1 10 0v4'/%3E%3C/svg%3E",
  strong: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%2310b981' stroke-width='2'%3E%3Cpath d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/%3E%3Cpath d='M9 12l2 2 4-4'/%3E%3C/svg%3E"
};

function updateRequirementUI(id, isValid) {
  const el = document.getElementById(`req-${id}`);
  const icon = document.getElementById(`icon-${id}`);
  if (!el || !icon) return;

  if (isValid) {
    el.className = "checklist-item valid";
    icon.textContent = "✓";
  } else {
    el.className = "checklist-item invalid";
    icon.textContent = "✗";
  }
}

function updateMeterBar(score, status) {
  for (let i = 1; i <= 5; i++) {
    const seg = document.getElementById(`seg-${i}`);
    if (!seg) continue;

    seg.className = "meter-segment";
    if (i <= score) {
      if (status === "WEAK") {
        seg.classList.add("active-weak");
      } else if (status === "MEDIUM") {
        seg.classList.add("active-medium");
      } else {
        seg.classList.add("active-strong");
      }
    }
  }
}

function calculateEntropyAndCrackTime(password, checks) {
  let poolSize = 0;
  if (checks.has_lower) poolSize += 26;
  if (checks.has_upper) poolSize += 26;
  if (checks.has_digit) poolSize += 10;
  if (checks.has_special) poolSize += 33;

  if (poolSize === 0 || password.length === 0) {
    return { entropy: 0, crackTime: "Not Available" };
  }

  // Shannon Entropy: E = L * log2(poolSize)
  const entropy = Math.round(password.length * (Math.log(poolSize) / Math.log(2)));

  // Estimate Brute Force: 100 Billion (1e11) guesses per second
  const combinations = Math.pow(poolSize, password.length);
  const seconds = combinations / 1e11;

  let crackTime = "Instant";
  if (seconds < 1) crackTime = "Instant (< 1 sec)";
  else if (seconds < 60) crackTime = `${Math.round(seconds)} seconds`;
  else if (seconds < 3600) crackTime = `${Math.round(seconds / 60)} minutes`;
  else if (seconds < 86400) crackTime = `${Math.round(seconds / 3600)} hours`;
  else if (seconds < 31536000) crackTime = `${Math.round(seconds / 86400)} days`;
  else if (seconds < 3153600000) crackTime = `${Math.round(seconds / 31536000)} years`;
  else if (seconds < 3153600000000) crackTime = `${Math.round(seconds / 3153600000)} centuries`;
  else crackTime = "> 1 Trillion Centuries 🛡️";

  return { entropy, crackTime };
}

// Client-Side Real-time Assessment
if (checkPasswordInput) {
  checkPasswordInput.addEventListener("input", (e) => {
    const password = e.target.value;

    if (!password) {
      strengthText.textContent = "None";
      strengthText.style.color = "var(--text-primary)";
      strengthImage.src = indicatorImages.empty;
      scoreVal.textContent = "0";
      if (crackTimeBadge) crackTimeBadge.textContent = "Est. Crack Time: Not Available";
      if (entropyVal) entropyVal.textContent = "0 bits";

      ["upper", "lower", "digit", "special", "length"].forEach(id => updateRequirementUI(id, false));
      updateMeterBar(0, "");
      suggestionsContainer.style.display = "none";
      return;
    }

    // 1. Local Rule Checks
    const checks = {
      has_upper: /[A-Z]/.test(password),
      has_lower: /[a-z]/.test(password),
      has_digit: /[0-9]/.test(password),
      has_special: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/\\'`~]/.test(password),
      has_length: password.length >= 8
    };

    // 2. Score Calculation
    const score = Object.values(checks).filter(Boolean).length;

    // 3. Status determination
    let status = "WEAK";
    if (score <= 2) status = "WEAK";
    else if (score <= 4) status = "MEDIUM";
    else status = "STRONG";

    // 4. Entropy & Crack-Time
    const { entropy, crackTime } = calculateEntropyAndCrackTime(password, checks);
    if (entropyVal) entropyVal.textContent = `${entropy} bits`;
    if (crackTimeBadge) crackTimeBadge.textContent = `Est. Crack Time: ${crackTime}`;

    // 5. Dynamic Suggestions
    const suggestions = [];
    if (!checks.has_upper) suggestions.push("Add at least one uppercase letter (A-Z).");
    if (!checks.has_lower) suggestions.push("Add at least one lowercase letter (a-z).");
    if (!checks.has_digit) suggestions.push("Include at least one number (0-9).");
    if (!checks.has_special) suggestions.push("Add special characters like !@#$%^&*.");
    if (!checks.has_length) suggestions.push("Make the password at least 8 characters long.");
    if (password.length >= 8 && password.length < 14) suggestions.push("Target 14-16+ characters for maximum brute-force resistance.");

    // 6. Update Checklist UI, Meter Bar & Score
    scoreVal.textContent = score;
    updateRequirementUI("upper", checks.has_upper);
    updateRequirementUI("lower", checks.has_lower);
    updateRequirementUI("digit", checks.has_digit);
    updateRequirementUI("special", checks.has_special);
    updateRequirementUI("length", checks.has_length);
    updateMeterBar(score, status);

    // 7. Update Indicator & Text
    if (status === "WEAK") {
      strengthText.textContent = "Weak";
      strengthText.style.color = "var(--weak-color)";
      strengthImage.src = indicatorImages.weak;
    } else if (status === "MEDIUM") {
      strengthText.textContent = "Medium";
      strengthText.style.color = "var(--medium-color)";
      strengthImage.src = indicatorImages.medium;
    } else {
      strengthText.textContent = "Strong";
      strengthText.style.color = "var(--strong-color)";
      strengthImage.src = indicatorImages.strong;
    }

    // 8. Render Suggestions
    suggestionsContainer.style.display = "block";
    suggestionsList.innerHTML = "";

    if (suggestions.length > 0) {
      suggestionsHeader.textContent = "Security Recommendations:";
      suggestionsHeader.style.color = "var(--cyan-400)";
      suggestions.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        suggestionsList.appendChild(li);
      });
    } else {
      suggestionsHeader.textContent = "Excellent! Your password meets all elite security standards.";
      suggestionsHeader.style.color = "var(--strong-color)";
    }

    // 9. Save evaluation to local history (immediate client session availability)
    saveLocalEvaluation({
      score: score,
      status: status,
      has_upper: checks.has_upper ? 1 : 0,
      has_lower: checks.has_lower ? 1 : 0,
      has_digit: checks.has_digit ? 1 : 0,
      has_special: checks.has_special ? 1 : 0,
      has_length: checks.has_length ? 1 : 0,
      suggestions: suggestions.join(", "),
      created_at: new Date().toLocaleTimeString()
    });
  });
}

// ==========================================================================
// Flask Backend Sync (Debounced for optimal network performance)
// ==========================================================================
let debounceTimer;

if (checkPasswordInput) {
  checkPasswordInput.addEventListener("input", (e) => {
    const password = e.target.value;
    if (!password) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        const response = await fetch(EVALUATE_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ password: password })
        });

        if (response.ok) {
          // Refresh audit log if user is currently viewing the history tab
          const historySection = document.getElementById("history");
          if (historySection && historySection.classList.contains("active")) {
            loadEvaluationHistory();
          }
        }
      } catch (error) {
        // Handled silently: local session history was already captured
      }
    }, 400);
  });
}

// ==========================================================================
// Audit Log / History Loader (Hybrid: Server SQLite with Local Session Fallback)
// ==========================================================================
async function loadEvaluationHistory() {
  const tbody = document.getElementById("historyTableBody");
  if (!tbody) return;

  let evaluations = [];
  let isFromBackend = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(HISTORY_API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      evaluations = await res.json();
      isFromBackend = true;
    } else {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
  } catch (err) {
    evaluations = getLocalEvaluations();
    isFromBackend = false;
  }

  // Manage Notice Banner Above History Table
  const noticeId = "historyStatusNotice";
  let noticeEl = document.getElementById(noticeId);
  const cardHeader = document.querySelector("#history .card-header-bar");

  if (!isFromBackend) {
    if (!noticeEl && cardHeader) {
      noticeEl = document.createElement("div");
      noticeEl.id = noticeId;
      noticeEl.style.cssText = "background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25); color: var(--text-secondary); padding: 10px 16px; border-radius: var(--radius-sm); margin: 12px 0 16px 0; font-size: 0.85rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;";
      noticeEl.innerHTML = `
        <div>
          <span style="color: var(--cyan-400); font-weight: 600;">⚡ Client Mode:</span>
          <span> Showing local session evaluations. Run <code style="color: var(--cyan-400); background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">python app.py</code> to sync with SQLite.</span>
        </div>
        <button type="button" onclick="loadEvaluationHistory()" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.78rem;">🔄 Retry Server</button>
      `;
      cardHeader.insertAdjacentElement("afterend", noticeEl);
    }
  } else if (noticeEl) {
    noticeEl.remove();
  }

  tbody.innerHTML = "";

  if (!evaluations || evaluations.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
          No evaluation records found yet. Type a password in the <a href="#" onclick="showSection('checker')" style="color: var(--cyan-400); text-decoration: underline;">Checker</a> to see audit entries!
        </td>
      </tr>`;
    return;
  }

  // Display recent 15 records
  evaluations.slice(0, 15).forEach(row => {
    const tr = document.createElement("tr");

    let badgeColor = "var(--weak-color)";
    if (row.status === "STRONG") badgeColor = "var(--strong-color)";
    else if (row.status === "MEDIUM") badgeColor = "var(--medium-color)";

    const checksCount = [row.has_upper, row.has_lower, row.has_digit, row.has_special, row.has_length].filter(Boolean).length;

    tr.innerHTML = `
      <td style="font-weight: 700; font-family: var(--font-mono); color: ${badgeColor};">${row.score} / 5</td>
      <td><span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.78rem; font-weight: 700; color: ${badgeColor}; border: 1px solid ${badgeColor};">${row.status}</span></td>
      <td>${checksCount} / 5 passed</td>
      <td style="color: var(--text-muted); font-size: 0.82rem;">${row.created_at || "Recent"}</td>
      <td style="color: var(--text-secondary); font-size: 0.82rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${row.suggestions || "Meets all standards"}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Initial Bootstrapping
document.addEventListener("DOMContentLoaded", () => {
  checkBackendHealth();
  if (generatedPasswordInput && !generatedPasswordInput.value) {
    generatePassword();
  }
});