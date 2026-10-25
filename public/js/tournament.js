let currentTournamentId = Number(localStorage.getItem("tournamentId")) || null;
let currentTournament = null;
let registeredPlayersCache=[];
let currentModalCallback=null;

// DOM ELEMENTS
const createTournamentForm = document.getElementById("createTournamentForm");
const registerPlayerForm = document.getElementById("registerPlayerForm");
const startTournamentButton = document.getElementById("startTournamentButton");
const tournamentDetails = document.getElementById("tournamentDetails");
const displayTournamentName = document.getElementById("displayTournamentName");
const displayMaxPlayers = document.getElementById("displayMaxPlayers");
const displayRegisteredPlayers = document.getElementById("displayRegisteredPlayers");
const displayTournamentStatus = document.getElementById("displayTournamentStatus");
const playersTableBody = document.getElementById("playersTableBody");
const playerCount = document.getElementById("playerCount");
const tournamentsList = document.getElementById("tournamentsList");
const availablePlayersList = document.getElementById("availablePlayersList");

// PAGE LOAD
document.addEventListener("DOMContentLoaded", async () => {
    console.log("Tournament page loaded");
    console.log("API URL:", API_URL);
    const isAdmin = checkIsAdmin();
    const token = localStorage.getItem("token");
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    const createTournamentCard = document.getElementById("createTournamentForm");
    const modal = document.getElementById("customConfirmModal");
    const confirmBtn = document.getElementById("modalConfirmBtn");
    const cancelBtn = document.getElementById("modalCancelBtn");

    if (createTournamentCard) { 
        createTournamentCard.style.display = isAdmin ? "block" : "none";
    }const startTournamentSection = document.getElementById("startTournamentSection");
if (startTournamentSection) {
    if (isAdmin) {
        startTournamentSection.style.display = "block";
    }else{
        startTournamentSection.remove();
    }}
const registerSection = document.getElementById("registerPlayerSection")?.closest(".card, .form-container");

// Delete it completely from the DOM
if (registerSection) {
    registerSection.remove();
}   if (confirmBtn) {
        confirmBtn.addEventListener("click", () => {
            if (modal) modal.style.display = "none";
            if (typeof currentModalCallback === "function") {
                currentModalCallback();
                currentModalCallback = null;
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
            if (modal) modal.style.display = "none";
            currentModalCallback = null;
        });}

    await loadAllTournaments();
    
    if (currentTournamentId) {
        await loadTournament(currentTournamentId);
        await loadTournamentPlayers(currentTournamentId);
    }
    await loadAllPlayers();
    
});

// Delegated click handler for player rows & cards
document.addEventListener("click", (event) => {
    const playerElement = event.target.closest("#playersTableBody tr, .player-item, .clickable-player-row");
    if (!playerElement) return;
    if (event.target.closest("button, input, a")) return;
    const playerId = playerElement.dataset.playerId || playerElement.getAttribute("data-player-id");
    const tournamentId = currentTournamentId || localStorage.getItem("tournamentId");
    if (!tournamentId) {
        showMessage("Please select a tournament first to view player stats.", "error");
        return;
    }
    if (playerId) {
        localStorage.setItem("playerReturnPage", window.location.pathname + window.location.search + `#player-row-${playerId}`);
        window.location.href = `player.html?tournamentId=${tournamentId}&playerId=${playerId}`;
    }
});

// CREATE TOURNAMENT
createTournamentForm.addEventListener("submit", async event => {
    event.preventDefault();
    const name = document.getElementById("tournamentName").value.trim();
    const maxPlayers = Number(document.getElementById("maxPlayers").value);

    if (!name) {
        showMessage("Tournament name is required.", "error");
        return;
    }
    if (!Number.isInteger(maxPlayers) || maxPlayers < 2) {
        showMessage("Maximum players must be at least 2.", "error");
        return;
    }

    try {
        showMessage("Creating tournament...", "success");
        const data = await apiRequest(API_URL, "POST", { name, maxPlayers });
        if (!data.success) {
            throw new Error(data.message || "Tournament creation failed.");
        }
        currentTournament = data.tournament;
        currentTournamentId = Number(currentTournament.id);
        localStorage.setItem("tournamentId", currentTournamentId);
        
        showTournamentDetails(currentTournament);
        createTournamentForm.reset();
        displayTournamentPlayers([]);
        await loadAllTournaments();
        await loadTournamentPlayers(currentTournamentId);
        showMessage(`"${currentTournament.name}" created successfully!`, "success");
    } catch (error) {
        console.error("CREATE TOURNAMENT ERROR:", error);
        showMessage(`Tournament creation failed: ${error.message}`, "error");
    }
});

// LOAD ALL TOURNAMENTS
async function loadAllTournaments() {
    if (!tournamentsList) return;
    try {
        const data = await apiRequest(API_URL);
        const tournaments = data.tournaments || [];
        displayAllTournaments(tournaments);
    } catch (error) {
        console.error("LOAD TOURNAMENTS ERROR:", error);
        tournamentsList.innerHTML = `<p class="empty-message">Failed to load tournaments. ${error.message}</p>`;
    }
}
async function deleteTournament(tournamentId) {
    showCustomConfirm(
        "Delete Tournament",
        "Are you sure you want to delete this tournament? This action cannot be undone.",
        async () => {
            try {
                await apiRequest(`${API_URL}/${tournamentId}`, "DELETE");
                showMessage("Tournament deleted successfully.");
                localStorage.removeItem("tournamentId");
                location.reload();
            } catch (error) {
                showMessage(error.message, "error");
            }
        }
    );
}

window.deleteTournament = deleteTournament;
// DISPLAY ALL TOURNAMENTS
function displayAllTournaments(tournaments) {
    if (!tournaments.length) {
        tournamentsList.innerHTML = `<p class="empty-message">No tournaments found.</p>`;
        return;
    }
    const isAdmin = checkIsAdmin();
    tournamentsList.innerHTML = `
    <div class= "scrollable-card-container">
    
        <div style="display: flex; flex-wrap: wrap; gap: 15px;">
            ${tournaments.map(tournament => {
                const isSelected = Number(tournament.id) === Number(currentTournamentId);
                return `
                    <div class="tournament-card-item" onclick="selectTournament(${tournament.id})"  style="flex: 1 1 240px; border: 2px solid ${isSelected ? '#007bff' : '#e0e0e0'}; background: ${isSelected ? '#e7f1ff' : '#fff'}; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
                        <div>
                            <strong style="font-size: 1.1rem; color: #333;">${escapeHtml(tournament.name)}</strong>
                            <p style="margin: 6px 0 2px 0; font-size: 0.9rem; color: #555;">Max Players: ${tournament.max_players}</p>
                            <p style="margin: 0; font-size: 0.9rem; color: #555;">Status: ${formatStatus(tournament.status)}</p>
                        </div>
                        <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center;">
                            <button type="button" class="button ${isSelected ? 'primary-button' : 'secondary-button'}" style="padding: 6px 12px; font-size: 0.85rem;" onclick="event.stopPropagation();selectTournament(${tournament.id})">
                                ${isSelected ? 'Selected' : 'Select'}
                            </button>
                            ${isAdmin ? `
                                <button type="button" class="button btn-danger" style="padding: 6px 12px; font-size: 0.85rem;" onclick="event.stopPropagation();deleteTournament(${tournament.id})">
                                    Delete
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join("")}
        </div></div>
    `;
}



// SELECT TOURNAMENT
async function selectTournament(tournamentId) {
    try {
        currentTournamentId = Number(tournamentId);
        localStorage.setItem("tournamentId", currentTournamentId);
        await loadAllTournaments();
        await loadTournament(currentTournamentId);
        await loadTournamentPlayers(currentTournamentId);
       
    } catch (error) {
        console.error("SELECT TOURNAMENT ERROR:", error);
        showMessage(error.message, "error");
    }
}
window.selectTournament = selectTournament;

// LOAD SINGLE TOURNAMENT
async function loadTournament(tournamentId) {
    try {
        const data = await apiRequest(`${API_URL}/${tournamentId}`);
        console.log("TOURNAMENT DETAILS:", data);
        if (!data.success) {
            throw new Error(data.message || "Could not load tournament.");
        }
        currentTournament = data.tournament;
        if (!currentTournament) {
            throw new Error("Tournament data was not returned.");
        }
        showTournamentDetails(currentTournament);
        if (typeof data.totalPlayers === "number") {
            displayRegisteredPlayers.textContent = data.totalPlayers;
        }
    } catch (error) {
        console.error("LOAD TOURNAMENT ERROR:", error);
        showMessage(`Could not load tournament: ${error.message}`, "error");
    }
}
// CUSTOM MODAL CONFIRMATION HELPER
function showCustomConfirm(title, message, onConfirm) {
    const modal = document.getElementById("customConfirmModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalMessage = document.getElementById("modalMessage");

    if (!modal) {
        // Fallback if modal HTML is missing from page
        if (confirm(message)) {
            onConfirm();
        }
        return;
    }

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    currentModalCallback = onConfirm; // Store the callback safely
    modal.style.display = "flex";
}
// REMOVE PLAYER FROM TOURNAMENT INSTEAD OF GLOBAL DELETE
async function removePlayerFromTournament(event, playerId) {
    event.stopPropagation(); // Prevent row click redirection to profile
    if (!currentTournamentId) {
        showMessage("No tournament selected.", "error");
        return;
    }
    showCustomConfirm(
        "Remove Player",
        "Are you sure you want to remove this player from this tournament?",
        async () => {
            try {
                await apiRequest(`${API_URL}/${currentTournamentId}/players/${playerId}`, "DELETE");
                showMessage("Player removed from tournament successfully.");
                await loadTournamentPlayers(currentTournamentId);
                await loadTournament(currentTournamentId);
                await loadAllPlayers();
            } catch (error) {
                showMessage(error.message, "error");
            }
        }
    );
}
window.removePlayerFromTournament = removePlayerFromTournament;

// FULLSCREEN SCREENSHOT / AVATAR MODAL VIEWER (matched with player.js)
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
window.openScreenshotModal = openScreenshotModal;
// SHOW TOURNAMENT DETAILS
function showTournamentDetails(tournament) {
    if (!tournament) return;
    tournamentDetails.classList.remove("hidden");
    displayTournamentName.textContent = tournament.name || "-";
    displayMaxPlayers.textContent = tournament.max_players ?? tournament.maxPlayers ?? "-";
    displayTournamentStatus.textContent = formatStatus(tournament.status);
}

// LOAD ALL PLAYERS
async function loadAllPlayers() {
    if (!availablePlayersList) return;
    try {
        const data = await apiRequest(`${API_URL}/players/all`);
        const players = data.players || [];
        displayAvailablePlayers(players);
    } catch (error) {
        console.error("LOAD PLAYERS ERROR:", error);
        availablePlayersList.innerHTML = `<p class="empty-message">Failed to load players. ${error.message}</p>`;
    }
}

// DISPLAY AVAILABLE PLAYERS
function displayAvailablePlayers(players) {
    const isAdmin = checkIsAdmin();
    const token = localStorage.getItem("token");
    let currentUser = {};
    try {
        currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    } catch (e) {}

    if (!availablePlayersList) return;
    if (!players.length) {
        availablePlayersList.innerHTML = `<p class="empty-message">No players have been created yet.</p>`;
        return;
    }
    const registeredIds = new Set(registeredPlayersCache.map(p => Number(p.id)));
    const availablePlayers = players.filter(player => !registeredIds.has(Number(player.id)));
    availablePlayersList.innerHTML = `
        <div class="scrollable-card-container">
            <div class="available-players-grid">
                ${availablePlayers.length === 0 ? `
                    <p class="empty-message">All players have been added to the tournament.</p>
                ` : availablePlayers.map(player => {
                    const isSelf = token && !isAdmin && Number(currentUser.id) === Number(player.id);
                    
                    let actionButtonsHtml = '';
                     const cleanNumber = String(player.number).replace(/[^0-9]/g, "");
                     const message = encodeURIComponent(`Hello ${player.username}, this is regarding the Tournament, When are you available?`);
                   const whatsappUrl = `https://wa.me/${cleanNumber}?text=${message}`;
                   let playerNumber = escapeHtml(player.number || "Unassigned");
                   const playerBadgeHtml = player.number 
                    ? `<a href="${whatsappUrl}" target="_blank" onclick="event.stopPropagation()" class="player-number-badge" style="text-decoration:none">${playerNumber}</a>`
                    : `<span class="player-number-badge">${playerNumber}</span>`;

                    if (isAdmin) {
                        actionButtonsHtml = `
                            <button type="button" class="button secondary-button" onclick="registerExistingPlayer(${player.id})">
                                Add
                            </button>
                            <button type="button" class="button btn-danger" onclick="deletePlayer(event, ${player.id})">
                                Del
                            </button>
                        `;
                    } else if (isSelf) {
                        actionButtonsHtml = `
                            <button type="button" class="button secondary-button" onclick="registerExistingPlayer(${player.id})">
                                Add To Tournament
                            </button>
                        `;
                    }

                    return `
                        <div class="player-item-compact clickable-player-row" data-player-id="${player.id}" style="cursor: pointer;">
                            <div class="player-info-group">
                                <strong style="font-size: 0.95rem; color: #333;">${escapeHtml(player.username)}</strong>
                                <span >${playerBadgeHtml || "Unassigned"}</span>
                            </div>
                            <div style="display: flex; gap: 6px; align-items: center;">
                                ${actionButtonsHtml}
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `;
  
}
async function deletePlayer(event, playerId) {
    event.stopPropagation(); // Prevent row click redirection to profile
    showCustomConfirm(
        "Delete Player",
        "Are you sure you want to delete this player entirely from the system?",
        async () => {
            try {
                await apiRequest(`${API_URL}/players/${playerId}`, "DELETE");
                showMessage("Player deleted successfully.");
                await loadAllPlayers();
                if (currentTournamentId) {
                    await loadTournamentPlayers(currentTournamentId);
                }
            } catch (error) {
                showMessage(error.message, "error");
            }
        }
    );
}
window.deletePlayer = deletePlayer;

// CREATE PLAYER
registerPlayerForm.addEventListener("submit", async event => {
    event.preventDefault();
    const username = document.getElementById("playerUsername").value.trim();
    const number = document.getElementById("playerNumber").value.trim();

    if (!username) {
        showMessage("Player username is required.", "error");
        return;
    }

    try {
        const playerResponse = await apiRequest(`${API_URL}/players`, "POST", { username, number });
        if (!playerResponse.success) {
            throw new Error(playerResponse.message || "Player creation failed.");
        }
        const players = playerResponse.players || [];
        const player = players[0];
        if (!player) {
            throw new Error("Player was not returned by the server.");
        }
        registerPlayerForm.reset();
        await loadAllPlayers();

        if (!currentTournamentId) {
            showMessage(`${username} created successfully. Select a tournament to add the player.`, "success");
            return;
        }
        await registerPlayerToTournament(player.id);
    } catch (error) {
        console.error("CREATE PLAYER ERROR:", error);
        showMessage(`Player creation failed: ${error.message}`, "error");
    }
});
// Example login handler for your frontend
async function handleLogin(username, password) {
    try {
        const data = await apiRequest(`${API_URL}/login`, "POST", { username, password });
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        showMessage("Logged in successfully!");
    } catch (error) {
        showMessage(error.message, "error");
    }
}
// REGISTER EXISTING PLAYER
async function registerExistingPlayer(playerId) {
    if (!currentTournamentId) {
        showMessage("Please create or select a tournament first.", "error");
        return;
    }
    await registerPlayerToTournament(playerId);
}
window.registerExistingPlayer = registerExistingPlayer;

// REGISTER PLAYER TO TOURNAMENT
async function registerPlayerToTournament(playerId) {
    try {
        const data = await apiRequest(`${API_URL}/${currentTournamentId}/players`, "POST", {
            playerIds: Number(playerId)
        });
        if (!data.success) {
            throw new Error(data.message || "Player registration failed.");
        }
        showMessage("Player registered to tournament successfully!", "success");
      const registeredData = await apiRequest(`${API_URL}/${currentTournamentId}/players`);
        registeredPlayersCache = registeredData.players || []; 
        displayTournamentPlayers(registeredPlayersCache);
        if (displayRegisteredPlayers) {
            displayRegisteredPlayers.textContent = registeredPlayersCache.length;
        }
        if (playerCount) {
            playerCount.textContent = `${registeredPlayersCache.length} Players`;
        }

        await loadAllPlayers();
        
        await loadTournament(currentTournamentId);
        
    } catch (error) {
        console.error("REGISTER PLAYER ERROR:", error);
        showMessage(`Player registration failed: ${error.message}`, "error");
    }
}

// LOAD TOURNAMENT PLAYERS
async function loadTournamentPlayers(tournamentId) {
    try {
        const data = await apiRequest(`${API_URL}/${tournamentId}/players`);
        registeredPlayersCache= data.players || [];
        displayTournamentPlayers(registeredPlayersCache);
        displayRegisteredPlayers.textContent = registeredPlayersCache.length;
        scrollToCurrentHash();
    } catch (error) {
        console.error("LOAD TOURNAMENT PLAYERS ERROR:", error);
        registeredPlayersCache=[];
        displayTournamentPlayers([]);

        displayRegisteredPlayers.textContent = "0";
    }
}

// DISPLAY TOURNAMENT PLAYERS
// DISPLAY TOURNAMENT PLAYERS
function displayTournamentPlayers(players) {
    const isAdmin = checkIsAdmin();
    const tableContainer = document.getElementById("playersTableContainer");
    
    if (tableContainer) {
        tableContainer.innerHTML = `
            <table class="players-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Player</th>
                        <th>Number</th>
                        <th>Profile</th>
                        ${isAdmin ? '<th>Actions</th>' : ''}
                    </tr>
                </thead>
                <tbody id="playersTableBody">
                </tbody>
            </table>
        `;
    }
    
    const tbody = document.getElementById("playersTableBody");
    if (!tbody) return;

    if (!players.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="${isAdmin ? 5 : 4}" class="empty-message">No players registered yet.</td>
            </tr>
        `;
        playerCount.textContent = "0 Players";
        return;
    }
    playerCount.textContent = `${players.length} Players`;

    players.forEach((player, index) => {
        const row = document.createElement("tr");
        row.id = `player-row-${player.id}`;
        row.setAttribute("data-player-id", player.id);
        row.classList.add("clickable-player-row");

        // 1. WhatsApp Number Link Formatting
        let numberDisplay = "-";
        if (player.number) {
            const cleanNumber = String(player.number).replace(/[^0-9]/g, "");
            const message = encodeURIComponent(`Hello ${player.username}, this is regarding the Tournament, When are you available?`);
            numberDisplay = `<a href="https://wa.me/${cleanNumber}?text=${message}" target="_blank" onclick="event.stopPropagation()" class="player-number-badge" style ="text-decoration:none" >${escapeHtml(player.number)}</a>`;
        }

        // 2. Avatar or Initial Letter Fallback with Modal Preview
        let avatarHtml = '';
        let avatarPath = player.avatar;
        if (avatarPath) {
            if (!avatarPath.startsWith('/') && !avatarPath.startsWith('http')) {
                avatarPath = '/' + avatarPath;
            }
            if (!avatarPath.startsWith('http')) {
                avatarPath = `http://localhost:3000${avatarPath}`;
            }
            avatarHtml = `
                <img src="${avatarPath}" alt="Avatar" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; cursor: pointer; border: 1px solid #ccc;" onclick="event.stopPropagation(); openScreenshotModal('${avatarPath}')" title="Click to view avatar" />
            `;
        } else {
            const initial = (player.username || "?").charAt(0).toUpperCase();
            avatarHtml = `
                <div style="width: 36px; height: 36px; border-radius: 50%; background: #007bff; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.95rem;" title="${escapeHtml(player.username)}">
                    ${initial}
                </div>
            `;
        }

        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(player.username)}</strong></td>
            <td >${numberDisplay}</td>
            <td>${avatarHtml}</td>
            ${isAdmin ? `
                <td>
                    <button type="button" class="button btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="removePlayerFromTournament(event, ${player.id})">Remove</button>
                </td>
            ` : ''}
        `;
        tbody.appendChild(row);
    });
}

// START TOURNAMENT
startTournamentButton.addEventListener("click", async () => {
    if (!currentTournamentId) {
        showMessage("Please create or select a tournament first.", "error");
        return;
    }
    try {
        startTournamentButton.disabled = true;
        startTournamentButton.textContent = "Starting...";
        const data = await apiRequest(`${API_URL}/${currentTournamentId}/start`, "POST");
        console.log("START TOURNAMENT RESPONSE:", data);
        if (!data.success) {
            throw new Error(data.message || "Tournament could not start.");
        }
        await loadTournament(currentTournamentId);
        await loadTournamentPlayers(currentTournamentId);
        await loadAllTournaments();
        showMessage("Tournament started successfully!", "success");
    } catch (error) {
        console.error("START TOURNAMENT ERROR:", error);
        showMessage(`Tournament could not start: ${error.message}`, "error");
    } finally {
        startTournamentButton.disabled = false;
        startTournamentButton.textContent = "Start Tournament";
    }
});