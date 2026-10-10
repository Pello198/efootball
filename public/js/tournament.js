let currentTournamentId = Number(localStorage.getItem("tournamentId")) || null;
let currentTournament = null;

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
    await loadAllTournaments();
    await loadAllPlayers();
    if (currentTournamentId) {
        await loadTournament(currentTournamentId);
        await loadTournamentPlayers(currentTournamentId);
    }
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

// DISPLAY ALL TOURNAMENTS
function displayAllTournaments(tournaments) {
    if (!tournaments.length) {
        tournamentsList.innerHTML = `<p class="empty-message">No tournaments found.</p>`;
        return;
    }
    tournamentsList.innerHTML = tournaments.map(tournament => `
        <div class="tournament-item">
            <div>
                <strong>${tournament.name}</strong>
                <p>Maximum Players: ${tournament.max_players}</p>
                <p>Status: ${formatStatus(tournament.status)}</p>
            </div>
            <button type="button" class="button secondary-button" onclick="selectTournament(${tournament.id})">
                Select
            </button>
        </div>
    `).join("");
}

// SELECT TOURNAMENT
async function selectTournament(tournamentId) {
    try {
        currentTournamentId = Number(tournamentId);
        localStorage.setItem("tournamentId", currentTournamentId);
        await loadTournament(currentTournamentId);
        await loadTournamentPlayers(currentTournamentId);
        showMessage("Tournament selected successfully!", "success");
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
    if (!availablePlayersList) return;
    if (!players.length) {
        availablePlayersList.innerHTML = `<p class="empty-message">No players have been created yet.</p>`;
        return;
    }
    availablePlayersList.innerHTML = players.map(player => `
        <div class="player-item" data-player-id="${player.id}">
            <div>
                <strong>${player.username}</strong>
                <span>${player.number || "-"}</span>
            </div>
            <button type="button" class="button secondary-button" onclick="registerExistingPlayer(${player.id})">
                Add To Tournament
            </button>
        </div>
    `).join("");
}

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
        await loadTournamentPlayers(currentTournamentId);
        await loadTournament(currentTournamentId);
        await loadAllPlayers();
    } catch (error) {
        console.error("REGISTER PLAYER ERROR:", error);
        showMessage(`Player registration failed: ${error.message}`, "error");
    }
}

// LOAD TOURNAMENT PLAYERS
async function loadTournamentPlayers(tournamentId) {
    try {
        const data = await apiRequest(`${API_URL}/${tournamentId}/players`);
        const players = data.players || [];
        displayTournamentPlayers(players);
        displayRegisteredPlayers.textContent = players.length;
    } catch (error) {
        console.error("LOAD TOURNAMENT PLAYERS ERROR:", error);
        displayTournamentPlayers([]);
        displayRegisteredPlayers.textContent = "0";
    }
}

// DISPLAY TOURNAMENT PLAYERS
function displayTournamentPlayers(players) {
    playersTableBody.innerHTML = "";
    if (!players.length) {
        playersTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-message">No players registered yet.</td>
            </tr>
        `;
        playerCount.textContent = "0 Players";
        return;
    }
    playerCount.textContent = `${players.length} Players`;
    players.forEach((player, index) => {
        const row = document.createElement("tr");
        row.setAttribute("data-player-id", player.id);
        row.classList.add("clickable-player-row");
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${player.username}</strong></td>
            <td>${player.number || "-"}</td>
            <td>Player #${player.id}</td>
        `;
        playersTableBody.appendChild(row);
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