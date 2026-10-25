// ==========================================
// PLAYER PROFILE JS
// ==========================================

let allPlayerMatches = [];
let allTournaments = [];
let activeFilter = "ALL";
let selectedTournamentId = "ALL";

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
        const fetchUrl = `${API_URL}/players/${playerId}/stats`;
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
                whatsappLinkElem.style.display="inline-flex";// Ensure it is clickable
            }

        } else {
            // Handle the case where no number is assigned
            setText("playerNumber", "Unassigned");
            if (whatsappLinkElem) {
                whatsappLinkElem.removeAttribute("href"); // Remove link behavior if empty
                whatsappLinkElem.style.display = "none";
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
        populateTournamentDropdown(allTournaments, tournamentId);

        renderTournamentTabs(allTournaments);
        renderTournamentTabs(allTournaments);
        renderGroupedMatches("ALL");
        updateViewForTournament(selectedTournamentId);
    } catch (error) {
        console.error("Error loading player data:", error);
        showPlayerError(error.message);
    }
}
function populateTournamentDropdown(tournaments, defaultTournamentId) {
    const selectElem = document.getElementById("tournamentSelect");
    if (!selectElem) return;

    selectElem.innerHTML = `<option value="ALL">All Tournaments (Career Total)</option>` +
        tournaments.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");

    if (defaultTournamentId && tournaments.some(t => String(t.id) === String(defaultTournamentId))) {
        selectedTournamentId = String(defaultTournamentId);
        selectElem.value = selectedTournamentId;
    } else {
        selectedTournamentId = "ALL";
        selectElem.value = "ALL";
    }

    selectElem.addEventListener("change", (e) => {
        selectedTournamentId = e.target.value;
        updateViewForTournament(selectedTournamentId);
    });
}

function updateViewForTournament(tId) {
    let matchesToAnalyze = allPlayerMatches;
    if (tId !== "ALL") {
        matchesToAnalyze = allPlayerMatches.filter(m => String(m.tournamentId || m.tournament_id) === String(tId));
    }

    // Recalculate stats dynamically for the selected scope
    const stats = calculateLocalStats(matchesToAnalyze, localStorage.getItem("currentPlayerId"));

    setText("totalTournaments", tId === "ALL" ? allTournaments.length : 1);
    setText("overallScheduledGames", stats.scheduledGames);
    setText("overallGamesPlayed", stats.gamesPlayed);
    setText("overallCancelledGames", stats.cancelledGames);
    setText("overallWins", stats.wins);
    setText("overallDraws", stats.draws);
    setText("overallLosses", stats.losses);
    setText("overallGoalsFor", stats.goalsFor);
    setText("overallGoalsAgainst", stats.goalsAgainst);
    setText("overallGoalDifference", stats.goalDifference);
    setText("overallPoints", stats.points);

    renderGroupedMatches(activeFilter);
}

function calculateLocalStats(matches, playerId) {
    const s = { scheduledGames: 0, gamesPlayed: 0, cancelledGames: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
    for (const m of matches) {
        if (m.status === "CANCELLED" || m.status === "cancelled") { s.cancelledGames++; continue; }
        if (m.status === "SCHEDULED" || m.status === "scheduled" || m.goalsFor === null || m.goalsFor === undefined) { s.scheduledGames++; continue; }
        s.gamesPlayed++;
        const gFor = m.goalsFor ?? 0;
        const gAg = m.goalsAgainst ?? 0;
        s.goalsFor += gFor;
        s.goalsAgainst += gAg;
        if (gFor > gAg) { s.wins++; s.points += 3; }
        else if (gFor === gAg) { s.draws++; s.points += 1; }
        else { s.losses++; }
    }
    s.goalDifference = s.goalsFor - s.goalsAgainst;
    return s;
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
                <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 6px;">
                    ${groupMatches.map(m => `
                        <button type="button" class="button secondary-button" style="padding: 10px; font-size: 0.85rem; cursor: pointer;" onclick="jumpToMatch('${m.id || m.fixture_code}', '${tournament.id}')">
                            vs ${escapeHtml(m.opponent)} (${m.score || m.status})
                        </button>
                    `).join("")}
                </div>
            ` : '<p style="font-size: 0.85rem; color: #6c757d;">No group stage matches recorded.</p>'}
        </div>
        <div style="margin-top: 12px;">
            <strong>Knockout Stage Matches:</strong>
            ${knockoutMatches.length ? `
                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 6px;">
                    ${knockoutMatches.map(m => `
                        <button type="button" class="button secondary-button" style="padding: 10px; font-size: 0.85rem; background: #d1e7dd; border-color: #badbcc; cursor: pointer;" onclick="jumpToMatch('${m.id || m.fixture_code}', '${tournament.id}')">
                            ${escapeHtml(m.roundName || 'Knockout')}: vs ${escapeHtml(m.opponent)} (${m.score || m.status})
                        </button>
                    `).join("")}
                </div>
            ` : '<p style="font-size: 0.85rem; color: #6c757d;">Did not reach or play knockout matches.</p>'}
        </div>
    `;
}

// JUMP TO SPECIFIC MATCH AND HIGHLIGHT IT
function jumpToMatch(matchId, tournamentId) {
    // 1. Switch tournament tab button if needed
    const tabBtns = document.querySelectorAll(".t-tab-btn");
    tabBtns.forEach(btn => {
        if (btn.getAttribute("data-tid") === String(tournamentId)) {
            btn.click();
        }
    });

    // 2. Find and highlight the match card in the history view
    setTimeout(() => {
        const matchCard = document.getElementById(`match-card-${matchId}`);
        if (matchCard) {
            matchCard.scrollIntoView({ behavior: "smooth", block: "center" });
            matchCard.style.transition = "all 0.4s ease-in-out";
            matchCard.style.border = "2px solid #007bff";
            matchCard.style.backgroundColor = "#e7f1ff";
            matchCard.style.boxShadow = "0 0 12px rgba(0, 123, 255, 0.4)";

            setTimeout(() => {
                matchCard.style.border = "1px solid #e0e0e0";
                matchCard.style.backgroundColor = "#fff";
                matchCard.style.boxShadow = "none";
            }, 2500);
        } else {
            showMessage("Match card not found in current view filter.", "error");
        }
    }, 100);
}
window.jumpToMatch = jumpToMatch;

// MATCH CARD RENDERER WITH SCREENSHOT OR "NO SCREENSHOT" MESSAGE
// MATCH CARD RENDERER WITH 3-COLUMN LAYOUT AND ACCURATE SCREENSHOT PATHS
function createMatchCard(match) {
    let resultClass = "badge-group";
    let statusText = match.result || match.status || "To Be Determined";

    if (match.status === "PLAYED" || match.status === "completed") {
        resultClass = match.result === "WIN" ? "badge-completed" : match.result === "LOSS" ? "badge-danger" : "badge-registration";
    } else if (match.status === "CANCELLED") {
        resultClass = "badge-danger";
        statusText = "Cancelled";
    } else if (match.status === "SCHEDULED" || !match.status || match.status === "PENDING") {
        resultClass = "badge-group";
        statusText = "Scheduled";
    }

    const matchKey = match.id || match.fixture_code;
    let screenshotPath = match.result_screenshot || match.screenshot;
    
    // Clean up screenshot path format if stored with or without leading slashes
    if (screenshotPath) {
        if (!screenshotPath.startsWith('/') && !screenshotPath.startsWith('http')) {
            screenshotPath = '/' + screenshotPath;
        }
        if (!screenshotPath.startsWith('http')) {
            screenshotPath = `http://localhost:3000${screenshotPath}`;
        }
    }

    const scoreDisplay = match.score || (match.player_1_score !== null && match.player_2_score !== null && match.status !== "SCHEDULED" ? `${match.player_1_score} - ${match.player_2_score}` : 'TBD');

    return `
        <div id="match-card-${matchKey}" class="fixture-card" style="margin-bottom: 15px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fff;">
            <div class="fixture-meta" style="margin-bottom: 8px;">
                <span style="font-size: 0.85rem; color: #666;">${formatStage(match.stage)} ${match.roundName ? `• ${escapeHtml(match.roundName)}` : match.round_number ? `• Round ${match.round_number}` : ''}</span>
            </div>
            
            <!-- 3-Column Layout: Left (Opponent), Middle (Score), Right (Status Badge) -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 10px;">
                <div style="flex: 1; text-align: left;">
                    <span class="fixture-player" style="font-size: 1rem;">vs <strong>${escapeHtml(match.opponent || match.player_2_name || 'TBD')}</strong></span>
                </div>
                <div style="flex: 1; text-align: center;">
                    <span class="vs" style="font-weight: bold; font-size: 1.1rem; color: #333;">${scoreDisplay}</span>
                </div>
                <div style="flex: 1; text-align: right;">
                    <span class="badge ${resultClass}" style="font-size: 0.85rem; padding: 4px 10px;">${statusText}</span>
                </div>
            </div>
            ${renderOverrideHistoryHTML(match.overrides)}
            <!-- Screenshot Section -->
            <div style="border-top: 1px solid #eee; padding-top: 10px; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 0.8rem; color: #555; font-weight: 500;">Screenshot Proof:</span>
                ${screenshotPath ? `
                    <img src="${screenshotPath}" 
                         alt="Match Screenshot" 
                         style="max-width: 100px; max-height: 60px; border-radius: 4px; cursor: pointer; border: 1px solid #ccc; object-fit: cover;"
                         onclick="openScreenshotModal('${screenshotPath}')" />
                ` : `
                    <span style="font-size: 0.8rem; color: #999; font-style: italic;">No screenshot available</span>
                `}
            </div>
        </div>
    `;
}

// FULLSCREEN SCREENSHOT MODAL VIEWER
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



// CLICKABLE STAT FILTERS
function setupStatClickFilters() {
    const cards = document.querySelectorAll(".stat-card.clickable-stat");
    const staticCards=document.querySelectorAll(".stat-card.non-clickable");
    const resetBtn = document.getElementById("resetFilterBtn");
    cards.forEach(card => {
        card.style.cursor = "pointer";
        card.addEventListener("click", () => {
            cards.forEach(c => c.style.border = "1px solid #e0e0e0");
            card.style.border = "2px solid #007bff";
          
            activeFilter = card.getAttribute("data-filter");
            renderGroupedMatches(activeFilter);
            if (resetBtn) resetBtn.style.display = "inline-block";
            const matchSection = document.getElementById("matchListHeader");
            if (matchSection) {
                matchSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    });
    staticCards.forEach(card => {
        card.style.cursor = "pointer";
        card.addEventListener("click", () => {
            card.style.transition = "border 0.2s ease";
            card.style.border = "2px solid #007bff";

            setTimeout(() => {
                card.style.border = "1px solid #e0e0e0";
            }, 600); // Fades back to normal after 0.6 seconds
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

