const API_URL = "http://localhost:3000/tournaments";
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
    const options = {
        method,
        headers: { "Content-Type": "application/json" }
    };
    if (body !== null) {
        options.body = JSON.stringify(body);
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
    console.log("SERVER RESPONSE:", data);
    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }
    return data;
}
function formatStatus(status) {
    const statusMap = {
        registration: "Registration",
        group_stage: "Group Stage",
        knockout: "Knockout Stage",
        completed: "Completed"
    };
    return statusMap[status] || status || "Registration";
}