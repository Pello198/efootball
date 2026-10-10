// ==========================================
// PLAYER PROFILE JS
// ==========================================
const API_BASE = "http://localhost:3000";
let allPlayerMatches = [];
let allTournaments = [];
let activeFilter = "ALL";

window.addEventListener("DOMContentLoaded", async () => {
    setupNavigation();
    setupStatClickFilters();
    await initPlayerPage();
});

function getPageParams() {
    const urlParams = new URLSearchParams(window.location.search);
    let playerId = urlParams.get("playerId") || urlParams.get("id");
    let tournamentId = urlParams.get("tournamentId");
    if (!playerId) playerId = localStorage.getItem("currentPlayerId");
    if (!tournamentId) tournamentId = localStorage.getItem("tournamentId") || localStorage.getItem("currentTournamentId");
    return { playerId, tournamentId };
}

async function initPlayerPage() {
    const { playerId, tournamentId } = getPageParams();
    if (!playerId) {
        showPlayerError("No player selected.");
        return;
    }
    localStorage.setItem("currentPlayerId", playerId);
    if (tournamentId) localStorage.setItem("tournamentId", tournamentId);
    await loadAllPlayerData(playerId, tournamentId);
}

// DATA FETCHING
async function loadAllPlayerData(playerId, tournamentId) {
    showLoading();
    try {
        const fetchUrl = `${API_BASE}/tournaments/players/${playerId}/stats`;
        const response = await fetch(fetchUrl);
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Failed to load player details");
        
        const data = result.data;
        setText("playerName", data.player.username || "Unknown Player");
        setText("playerTeamName", data.player.teamName || `${data.player.username} FC`);
        const numberElem = document.getElementById("playerNumber");
        const whatsappLinkElem = document.getElementById("playerWhatsappLink");

        if (data.player.number) {
            // 1. Display the formatted number on screen
            setText("playerNumber", `#${data.player.number}`);
            
            // 2. Remove spaces, dashes, or symbols (+ is okay) so WhatsApp API accepts it
            const cleanNumber = String(data.player.number).replace(/[^0-9]/g, "");
            
            // 3. Optional: Customize a pre-filled template message
            const message = encodeURIComponent(`Hello ${data.player.username}, this is regarding the Tournament , When are you available?`);
            
            // 4. Update the link URL using the universal wa.me format
            if (whatsappLinkElem) {
                whatsappLinkElem.href = `https://wa.me/${cleanNumber}?text=${message}`;
                whatsappLinkElem.style.pointerEvents = "auto"; // Ensure it is clickable
            }
        } else {
            // Handle the case where no number is assigned
            setText("playerNumber", "Unassigned");
            if (whatsappLinkElem) {
                whatsappLinkElem.removeAttribute("href"); // Remove link behavior if empty
                whatsappLinkElem.style.pointerEvents = "none";
            }
        }

        const initialElem = document.getElementById("playerInitial");
        if (initialElem && data.player.username) {
            initialElem.textContent = data.player.username.charAt(0).toUpperCase();
        }

        allPlayerMatches = data.matches || [];
        allTournaments = data.tournaments || [];

        setText("totalTournaments", data.totalTournamentsParticipated || allTournaments.length || 0);
        if (data.stats) {
            setText("overallScheduledGames", data.stats.scheduledGames || 0);
            setText("overallGamesPlayed", data.stats.gamesPlayed || 0);
            setText("overallCancelledGames", data.stats.cancelledGames || 0);
            setText("overallWins", data.stats.wins || 0);
            setText("overallDraws", data.stats.draws || 0);
            setText("overallLosses", data.stats.losses || 0);
            setText("overallGoalsFor", data.stats.goalsFor || 0);
            setText("overallGoalsAgainst", data.stats.goalsAgainst || 0);
            setText("overallGoalDifference", data.stats.goalDifference || 0);
            setText("overallPoints", data.stats.points || 0);
        }

        renderTournamentTabs(allTournaments);
        renderGroupedMatches("ALL");
    } catch (error) {
        console.error("Error loading player data:", error);
        showPlayerError(error.message);
    }
}

// TOURNAMENT PROGRESSION TABS
function renderTournamentTabs(tournaments) {
    const tabContainer = document.getElementById("tournamentTabs");
    const progressionContainer = document.getElementById("tournamentProgressionContainer");
    if (!tabContainer || !progressionContainer) return;
    if (!tournaments || !tournaments.length) {
        tabContainer.innerHTML = "";
        progressionContainer.innerHTML = `<p class="empty-message">No tournament progression available.</p>`;
        return;
    }

    tabContainer.innerHTML = tournaments.map((t, index) => `
        <button type="button" class="button ${index === 0 ? 'primary-button' : 'secondary-button'} t-tab-btn" data-tid="${t.id}">
            ${escapeHtml(t.name)}
        </button>
    `).join("");

    displayTournamentProgression(tournaments[0]);

    const tabBtns = tabContainer.querySelectorAll(".t-tab-btn");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => {
                b.classList.remove("primary-button");
                b.classList.add("secondary-button");
            });
            btn.classList.add("primary-button");
            btn.classList.remove("secondary-button");
            const tId = btn.getAttribute("data-tid");
            const selected = tournaments.find(t => String(t.id) === String(tId));
            displayTournamentProgression(selected);
        });
    });
}

function displayTournamentProgression(tournament) {
    const container = document.getElementById("tournamentProgressionContainer");
    if (!container || !tournament) return;
    const matches = tournament.matches || [];
    const groupMatches = matches.filter(m => m.stage === "group");
    const knockoutMatches = matches.filter(m => m.stage === "knockout");

    container.innerHTML = `
        <div style="margin-bottom: 12px;">
            <h3 style="margin-bottom: 4px;">${escapeHtml(tournament.name)}</h3>
            <span class="badge badge-group">Highest Stage: ${escapeHtml(tournament.highestStage)}</span>
        </div>
        <div style="margin-top: 10px;">
            <strong>Group Stage Matches:</strong>
            ${groupMatches.length ? `
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
                    ${groupMatches.map(m => `
                        <span style="padding: 4px 8px; border-radius: 4px; background: #e9ecef; font-size: 0.85rem;">
                            vs ${escapeHtml(m.opponent)} (${m.score || m.status})
                        </span>
                    `).join("")}
                </div>
            ` : '<p style="font-size: 0.85rem; color: #6c757d;">No group stage matches recorded.</p>'}
        </div>
        <div style="margin-top: 12px;">
            <strong>Knockout Stage Matches:</strong>
            ${knockoutMatches.length ? `
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
                    ${knockoutMatches.map(m => `
                        <span style="padding: 4px 8px; border-radius: 4px; background: #d1e7dd; font-size: 0.85rem;">
                            ${escapeHtml(m.roundName || 'Knockout')}: vs ${escapeHtml(m.opponent)} (${m.score || m.status})
                        </span>
                    `).join("")}
                </div>
            ` : '<p style="font-size: 0.85rem; color: #6c757d;">Did not reach or play knockout matches.</p>'}
        </div>
    `;
}

// CLICKABLE STAT FILTERS
function setupStatClickFilters() {
    const cards = document.querySelectorAll(".stat-card.clickable-stat");
    const resetBtn = document.getElementById("resetFilterBtn");
    cards.forEach(card => {
        card.style.cursor = "pointer";
        card.addEventListener("click", () => {
            cards.forEach(c => c.style.border = "1px solid #e0e0e0");
            card.style.border = "2px solid #007bff";
            activeFilter = card.getAttribute("data-filter");
            renderGroupedMatches(activeFilter);
            if (resetBtn) resetBtn.style.display = "inline-block";
        });
    });

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            cards.forEach(c => c.style.border = "1px solid #e0e0e0");
            activeFilter = "ALL";
            renderGroupedMatches("ALL");
            resetBtn.style.display = "none";
        });
    }
}

// MATCH LIST GROUPED BY TOURNAMENT
function renderGroupedMatches(filterType) {
    const container = document.getElementById("overallMatchHistory");
    const header = document.getElementById("matchListHeader");
    if (!container) return;

    let filteredMatches = [...allPlayerMatches];
    switch (filterType) {
        case "WINS":
            filteredMatches = allPlayerMatches.filter(m => m.result === "WIN");
            if (header) header.textContent = "Match History (Wins)";
            break;
        case "LOSSES":
            filteredMatches = allPlayerMatches.filter(m => m.result === "LOSS");
            if (header) header.textContent = "Match History (Losses)";
            break;
        case "DRAWS":
            filteredMatches = allPlayerMatches.filter(m => m.result === "DRAW");
            if (header) header.textContent = "Match History (Draws)";
            break;
        case "SCHEDULED":
            filteredMatches = allPlayerMatches.filter(m => m.status === "SCHEDULED");
            if (header) header.textContent = "Match History (Scheduled)";
            break;
        case "CANCELLED":
            filteredMatches = allPlayerMatches.filter(m => m.status === "CANCELLED");
            if (header) header.textContent = "Match History (Cancelled)";
            break;
        case "PLAYED":
            filteredMatches = allPlayerMatches.filter(m => m.status === "PLAYED");
            if (header) header.textContent = "Match History (Played)";
            break;
        default:
            if (header) header.textContent = "Match History (All Tournaments)";
            break;
    }

    if (!filteredMatches.length) {
        container.innerHTML = `<p class="empty-message">No matches found for selected criteria.</p>`;
        return;
    }

    const tournamentGroups = {};
    filteredMatches.forEach(match => {
        const tId = match.tournamentId || "Unknown";
        const tObj = allTournaments.find(t => String(t.id) === String(tId));
        const tName = tObj ? tObj.name : `Tournament #${tId}`;
        if (!tournamentGroups[tName]) tournamentGroups[tName] = [];
        tournamentGroups[tName].push(match);
    });

    container.innerHTML = Object.keys(tournamentGroups).map(tName => `
        <div class="tournament-match-block" style="margin-bottom: 25px;">
            <h3 style="background: #e9ecef; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 1.1rem; color: #333;">
                🏆 ${escapeHtml(tName)}
            </h3>
            <div class="matches-list">
                ${tournamentGroups[tName].map(m => createMatchCard(m)).join("")}
            </div>
        </div>
    `).join("");
}

function createMatchCard(match) {
    let resultClass = "badge-group";
    if (match.status === "PLAYED") {
        resultClass = match.result === "WIN" ? "badge-completed" : match.result === "LOSS" ? "badge-danger" : "badge-registration";
    } else if (match.status === "CANCELLED") {
        resultClass = "badge-danger";
    }
    return `
        <div class="fixture-card" style="margin-bottom: 10px;">
            <div class="fixture-meta">
                <span>${formatStage(match.stage)} ${match.roundName ? `• ${escapeHtml(match.roundName)}` : ''}</span>
                <span class="badge ${resultClass}">${match.result || match.status}</span>
            </div>
            <div class="fixture-players">
                <span class="fixture-player">vs <strong>${escapeHtml(match.opponent || 'TBD')}</strong></span>
                <span class="vs">${match.score || 'VS'}</span>
            </div>
        </div>
    `;
}

// HELPERS & NAVIGATION
function setupNavigation() {
    const backButton = document.getElementById("backButton");
    if (backButton) {
        backButton.addEventListener("click", () => {
            if (document.referrer) window.history.back();
            else window.location.href = "index.html";
        });
    }
}

function formatStage(stage) {
    if (!stage) return "N/A";
    const map = { group: "Group Stage", knockout: "Knockout Stage", registration: "Registration" };
    return map[stage] || stage;
}

function showLoading() {
    setText("playerName", "Loading...");
}

function showPlayerError(msg) {
    setText("playerName", "Error");
    const container = document.getElementById("overallMatchHistory");
    if (container) container.innerHTML = `<p class="empty-message">${msg}</p>`;
}

function setText(id, val) {
    const elem = document.getElementById(id);
    if (elem) elem.textContent = val;
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}