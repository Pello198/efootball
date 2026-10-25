// Tab Switching Logic
function switchTab(tab) {
    const loginSection = document.getElementById("loginSection");
    const registerSection = document.getElementById("registerSection");
    const showLoginBtn = document.getElementById("showLoginBtn");
    const showRegisterBtn = document.getElementById("showRegisterBtn");

    if (tab === 'login') {
        loginSection.classList.remove("hidden");
        registerSection.classList.add("hidden");
        showLoginBtn.className = "button primary-button";
        showRegisterBtn.className = "button secondary-button";
    } else {
        loginSection.classList.add("hidden");
        registerSection.classList.remove("hidden");
        showRegisterBtn.className = "button primary-button";
        showLoginBtn.className = "button secondary-button";
    }
}

// Handle Login Submission
document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
        const data = await apiRequest(`${API_URL}/login`, "POST", { username, password });
        
        // Save auth data to localStorage
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("currentPlayerId", data.user.id); // Helpful for player profile redirects

        showMessage("Login successful! Redirecting...", "success");
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1000);
    } catch (error) {
        showMessage(error.message, "error");
    }
});
// Universal Show/Password Toggle for any input ID
function togglePassword(fieldId, btn) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    if (field.type === "password") {
        field.type = "text";
        btn.textContent = "Hide password";
    } else {
        field.type = "password";
        btn.textContent = "Show password";
    }
}
// Toggle both password and confirm password fields together
function toggleBothPasswords(btn) {
    const passField = document.getElementById('regPassword');
    const confirmField = document.getElementById('regConfirmPassword');
    if (!passField || !confirmField) return;

    if (passField.type === "password") {
        passField.type = "text";
        confirmField.type = "text";
        btn.textContent = "Hide Password";
    } else {
        passField.type = "password";
        confirmField.type = "password";
        btn.textContent = "Show Password";
    }
}
window.toggleBothPasswords = toggleBothPasswords;
window.togglePassword = togglePassword;



// Handle Registration Submission
document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("regUsername").value.trim();
    const number = document.getElementById("regNumber").value.trim();
    const password = document.getElementById("regPassword").value;
    const confirmPasword = document.getElementById("regConfirmPassword").value;
    const avatar = document.getElementById("regAvatar").files[0];
   
    if (password !== confirmPasword){
        showMessage("passwords do not match.","error");
        return;
    }
    const formData = new FormData();
    formData.append("username",username);
    formData.append("number",number);
    formData.append("password",password);
    if(avatar){
        formData.append("avatar",avatar);
    }

    try {
        // This calls your existing backend player creation route which includes password hashing
        await apiRequest(`${API_URL}/players`, "POST", formData);
        
        showMessage("Registration successful! Please log in.", "success");
        document.getElementById("registerForm").reset();
        switchTab('login');
    } catch (error) {
        showMessage(error.message, "error");
    }
});