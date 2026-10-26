const API_URL="https://efootball-87pw.onrender.com"

// SHOW MESSAGE

function showMessage(message, type = "success") {
    const messageContainer = document.getElementById("messageContainer");
    if (!messageContainer) {
        alert(message);
        return;
    }
    console.log("MESSAGE:", type, message);
    messageContainer.textContent = message;
    messageContainer.classList.remove("success", "error","show");
    messageContainer.classList.add(type);
    messageContainer.classList.add("show");
    setTimeout(() => {
        messageContainer.classList.remove("show");
    }, 1500);
}
// API REQUEST
async function apiRequest(url, method = "GET", body = null) {
    console.log(`${method} ${url}`);
    const headers = {};
    
    // Only set Content-Type if body is not a FormData object (for file uploads)
    if (!(body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
        if (body !== null) {
            body = JSON.stringify(body);
        }
    }

    // Attach JWT token if available in localStorage
    const token = localStorage.getItem("token");
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const options = { method, headers };
    if (body !== null) {
        options.body = body;
    }

    let response;
    try {
        response = await fetch(url, options);
    } catch (error) {
        console.error("NETWORK ERROR:", error);
        throw new Error("Cannot connect to the server. Make sure the Node.js server is running on port 3000.");
    }

    let data;
    try {
        data = await response.json();
    } catch (error) {
        console.error("INVALID RESPONSE:", error);
        throw new Error("Server returned an invalid response.");
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }
    return data;
}
 function updateNavigationAuth() {
    const token = localStorage.getItem("token");
    const navLinks = document.querySelector(".navigation");
    if (!navLinks) return;

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    
    // Check if logout or login link already exists to prevent duplication
    if (token) {
        if (!navLinks.querySelector("#logoutNavLink")) {
            const authNav = document.createElement("a");
            authNav.id = "logoutNavLink";
            authNav.href = "#";
            authNav.className = "nav-link";
            authNav.textContent = `Logout (${user.username || 'User'})`;
            authNav.onclick = (e) => {
                e.preventDefault();
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                localStorage.removeItem("currentPlayerId");
                window.location.href = "auth.html";
            };
            
            // Replace the auth.html link if it exists, otherwise append it
            const loginLink = navLinks.querySelector('a[href="auth.html"]');
            if (loginLink) {
                loginLink.replaceWith(authNav);
            } else {
                navLinks.appendChild(authNav);
            }
        }
    } else {
        // Ensure the Login/Register link exists if not logged in
        if (!navLinks.querySelector('a[href="auth.html"]')) {
            const loginNav = document.createElement("a");
            loginNav.href = "auth.html";
            loginNav.className = "nav-link";
            loginNav.textContent = "Login / Register";
            navLinks.appendChild(loginNav);
        }
    }
}
// Check if current logged-in user is an admin
function checkIsAdmin() {
    try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const token = localStorage.getItem("token");
        return token && user && user.role === "admin";
    } catch (e) {
        return false;
    }
}
function renderOverrideHistoryHTML(overrides) {
    if (!overrides || !overrides.length) return "";
    
    const historyItems = overrides.map(ov => `
        <div style="font-size: 0.75rem; color: #d97706; margin-top: 4px; background: var(--background); padding: 2px 10px; border-radius: 4px; border: 1px solid var(--border); display: inline-block;">
            Adjusted from <strong>${ov.previous_p1_score ?? 0} - ${ov.previous_p2_score ?? 0}</strong> to <strong>${ov.new_p1_score} - ${ov.new_p2_score}</strong>
        </div>
    `).join("");

    return `<div class="override-history" style="margin-top: 6px; text-align: center; gap:20px">${historyItems}</div>`;
}
function openScreenshotModal(imgUrl) {
    let modal = document.getElementById("playerScreenshotModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "playerScreenshotModal";
        modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 9999; cursor: pointer;";
        modal.innerHTML = `
            <div style="position: relative; max-width: 90%; max-height: 90%; text-align: center;" onclick="event.stopPropagation()">
                <img id="modalScreenshotImg" src="" style="max-width: 100%; max-height: 85vh; border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);" />
                <button type="button" onclick="document.getElementById('playerScreenshotModal').style.display='none'" style="position: absolute; top: -15px; right: -15px; background: #ff4d4f; color: #fff; border: none; border-radius: 50%; width: 32px; height: 32px; font-weight: bold; cursor: pointer; font-size: 1rem;">&times;</button>
            </div>
        `;
        modal.addEventListener("click", () => modal.style.display = "none");
        document.body.appendChild(modal);
    }
    document.getElementById("modalScreenshotImg").src = imgUrl;
    modal.style.display = "flex";
}

function formatStatus(status) {
    const statusMap = {
        registration: "Registration",
        group_stage: "Group Stage",
        knockout: "Knockout Stage",
        completed: "Completed"
    };
    return statusMap[status] || status || "Registration";
}// ESCAPE HTML HELPER
 function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
 function setupNavigation() {
    const backButton = document.getElementById("backButton");
    if (backButton) {
        backButton.addEventListener("click", () => {
            const returnPage = localStorage.getItem("playerReturnPage");
            if (returnPage) {
                localStorage.removeItem("playerReturnPage");
                window.location.href = returnPage;
            } else if (document.referrer && document.referrer.includes(window.location.host)) {
                window.history.back();
            } else {
                window.location.href = "index.html";
            }
        });
    }
}
// Add this helper function to your tournament script
 function scrollToCurrentHash() {
    if (window.location.hash) {
        setTimeout(() => {
            const targetElement = document.querySelector(window.location.hash);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
                targetElement.style.transition = "background-color 0.5s ease";
                targetElement.style.backgroundColor = "#e7f1ff"; // Highlight effect
                setTimeout(() => {
                    targetElement.style.backgroundColor = "";
                }, 2000);
            }
        }, 300); // Small delay to ensure DOM is fully painted
    }
}
function fetchfiles(){
    fetch('/header.html')
            .then(response => response.text())
            .then(data => {
                const placeholder=document.getElementById('header-placeholder')
                if(placeholder){
                    placeholder.innerHTML =data;
                    updateNavigationAuth();
                }
            })
            .catch(error => console.error('Error loading header:', error));
}

window.API_URL = API_URL;
window.apiRequest=apiRequest
window.showMessage = showMessage;
window.fetchfiles = fetchfiles;
window.scrollToCurrentHash = scrollToCurrentHash;
window.escapeHtml= escapeHtml;
window.formatStatus = formatStatus;
window.openScreenshotModal=openScreenshotModal;
window.setupNavigation=setupNavigation;
window.checkIsAdmin=checkIsAdmin;
window.updateNavigationAuth=updateNavigationAuth;
window.renderOverrideHistoryHTML=renderOverrideHistoryHTML;