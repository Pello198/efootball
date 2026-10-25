// API_URL, apiRequest(), showMessage() and formatStatus() come from api.js
let currentTournamentId = Number(localStorage.getItem("tournamentId")) || null;
let currentTournament = null;
let allMatches = [];
let allStandings = [];
let selectedGroup = null;
let currentFixture = null;
let adminTargetFixture = null;

// DOM ELEMENTS
const fixtureTournamentName = document.getElementById("fixtureTournamentName");
const fixtureTournamentStatus = document.getElementById("fixtureTournamentStatus");
const groupStageSection = document.getElementById("groupStageSection");
const groupSelector = document.getElementById("groupSelector");
const groupFixturesContainer = document.getElementById("groupFixturesContainer");
const standingsContainer = document.getElementById("standingsContainer");
const proceedKnockoutSection = document.getElementById("proceedKnockoutSection");
const proceedKnockoutButton = document.getElementById("proceedKnockoutButton");
const knockoutStageSection = document.getElementById("knockoutStageSection");
const knockoutFixturesContainer = document.getElementById("knockoutFixturesContainer");
const tournamentCompleteSection = document.getElementById("tournamentCompleteSection");
const championName = document.getElementById("championName");
const resultModal = document.getElementById("resultModal");
const resultModalTitle = document.getElementById("resultModalTitle");
const closeResultModal = document.getElementById("closeResultModal");
const cancelResultButton = document.getElementById("cancelResultButton");
const resultForm = document.getElementById("resultForm");
const resultFixtureId = document.getElementById("resultFixtureId");
const resultPlayer1Name = document.getElementById("resultPlayer1Name");
const resultPlayer2Name = document.getElementById("resultPlayer2Name");
const player1Score = document.getElementById("player1Score");
const player2Score = document.getElementById("player2Score");
const penaltySection = document.getElementById("penaltySection");
const penaltyWinner = document.getElementById("penaltyWinner");

// PLAYER NAVIGATION HELPER
function goToPlayerPage(playerId) {
    if (!playerId) return;
    localStorage.setItem("currentPlayerId", playerId);
    if (currentTournamentId) {
        localStorage.setItem("tournamentId", currentTournamentId);
    }
    localStorage.setItem("playerReturnPage","fixtures.html"+  window.location.search);
    window.location.href = `player.html?playerId=${playerId}&tournamentId=${currentTournamentId || ''}`;
}
function createPlayerLink(playerId, playerName, cssClass = "", anchorHash = null) {
    if (!playerId) return escapeHtml(playerName || "Unknown");
    const safeName = escapeHtml(playerName || `Player ${playerName || playerId}`);
    let hashString= "";
    if (anchorHash){
        hashString = `#${anchorHash.startsWith('standings-row-') || anchorHash.startsWith('fixture-') ? anchorHash : 'fixture-' + anchorHash}`;
    }
    return `<a href="player.html?playerId=${playerId}&tournamentId=${currentTournamentId || ''}" 
               class="player-link ${cssClass}" 
               onclick="event.stopPropagation(); 
                        localStorage.setItem('currentPlayerId', ${playerId}); 
                        if(${currentTournamentId}) localStorage.setItem('tournamentId', ${currentTournamentId}); 
                        localStorage.setItem('playerReturnPage', 'fixtures.html${hashString}');"
               style="cursor: pointer; text-decoration: underline; color: inherit;">
               ${escapeHtml(playerName)}
            </a>`;
    }

// INITIALIZE
document.addEventListener("DOMContentLoaded", () => {
    if (!currentTournamentId) {
        showMessage("No tournament selected.", "error");
        return;
    }
    loadTournament();
    scrollToCurrentHash();
});

// LOAD TOURNAMENT
async function loadTournament() {
    try {
        const data = await apiRequest(`${API_URL}/${currentTournamentId}`);
        currentTournament = data.tournament;
        allMatches = data.matches || [];
        const rawStandings = data.standings || [];
        allStandings = rawStandings.map(player => ({
            ...player,
            player_id: player.player_id ?? player.id,
            group_letter: player.group_letter ?? player.group,
            matches_played: player.matches_played ?? player.played ?? 0,
            goals_for: player.goals_for ?? player.goalsFor ?? 0,
            goals_against: player.goals_against ?? player.goalsAgainst ?? 0,
            goal_difference: player.goal_difference ?? player.goalDifference ?? 0
        }));
        renderTournamentHeader();
        renderPage();
    } catch (error) {
        console.error("LOAD TOURNAMENT ERROR:", error);
        showMessage(error.message, "error");
    }
}

// TOURNAMENT HEADER
function renderTournamentHeader() {
    fixtureTournamentName.textContent = currentTournament.name;
    fixtureTournamentStatus.textContent = formatStatus(currentTournament.status);
    fixtureTournamentStatus.className = "status-badge " + getStatusClass(currentTournament.status);
}

// STATUS CLASS
function getStatusClass(status) {
    switch (status) {
        case "registration": return "badge-registration";
        case "group_stage": return "badge-group";
        case "knockout": return "badge-knockout";
        case "completed": return "badge-completed";
        default: return "";
    }
}

// RENDER PAGE
function renderPage() {
    if (currentTournament.status === "registration") {
        renderRegistrationState();
        return;
    }
    if (currentTournament.status === "group_stage") {
        renderGroupStage();
        return;
    }
    if (currentTournament.status === "knockout") {
        renderGroupStage();
        renderKnockoutStage();
        return;
    }
    if (currentTournament.status === "completed") {
        renderGroupStage();
        renderKnockoutStage();
        renderTournamentComplete();
        return;
    }
}

// REGISTRATION STATE
function renderRegistrationState() {
    groupStageSection.classList.add("hidden");
    knockoutStageSection.classList.add("hidden");
    proceedKnockoutSection.classList.add("hidden");
    standingsContainer.innerHTML = `
        <div class="empty-state">
            <h3>Tournament has not started</h3>
            <p>Start the tournament from the Tournament page to generate fixtures.</p>
        </div>
    `;
}

// GROUP STAGE
function renderGroupStage() {
    groupStageSection.classList.remove("hidden");
    proceedKnockoutSection.classList.remove("hidden");
    createGroupSelector();
    renderGroupFixtures();
    renderStandings();
    updateProceedButton();
}

// GET GROUPS
function getGroups() {
    const groups = new Set();
    allMatches.filter(match => match.stage === "group").forEach(match => {
        if (match.group_letter) groups.add(match.group_letter);
    });
    allStandings.forEach(player => {
        if (player.group_letter) groups.add(player.group_letter);
    });
    return [...groups].sort();
}

// GROUP SELECTOR
function createGroupSelector() {
    const groups = getGroups();
    groupSelector.innerHTML = "";
    if (!groups.length) {
        groupSelector.innerHTML = `<p class="empty-message">No groups available.</p>`;
        return;
    }
    if (!selectedGroup || !groups.includes(selectedGroup)) {
        selectedGroup = groups[0];
    }
    groups.forEach(group => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button group-button";
        if (group === selectedGroup) button.classList.add("active");
        button.textContent = `Group ${group}`;
        button.addEventListener("click", () => {
            selectedGroup = group;
            createGroupSelector();
            renderGroupFixtures();
        });
        groupSelector.appendChild(button);
    });
}

// GROUP FIXTURES
function renderGroupFixtures() {
    const fixtures = allMatches.filter(match => match.stage === "group" && match.group_letter === selectedGroup);
    if (!fixtures.length) {
        groupFixturesContainer.innerHTML = `
            <div class="empty-state">
                <h3>No Fixtures</h3>
                <p>There are no fixtures for Group ${selectedGroup}.</p>
            </div>
        `;
        return;
    }
    const rounds = {};
    fixtures.forEach(fixture => {
        const round = fixture.round_number || 1;
        if (!rounds[round]) rounds[round] = [];
        rounds[round].push(fixture);
    });
    groupFixturesContainer.innerHTML = "";
    Object.keys(rounds).sort((a, b) => a - b).forEach(round => {
        const roundSection = document.createElement("div");
        roundSection.className = "fixture-round";
        roundSection.innerHTML = `<h3 class="round-title">Round ${round}</h3>`;
        const grid = document.createElement("div");
        grid.className = "fixtures-grid";
        rounds[round].forEach(fixture => {
            grid.appendChild(createGroupFixtureCard(fixture));
        });
        roundSection.appendChild(grid);
        groupFixturesContainer.appendChild(roundSection);
    });
}

// GROUP FIXTURE CARD (WITH CLICKABLE PLAYERS)
function createGroupFixtureCard(fixture) {
    const card = document.createElement("div");
    card.className = "fixture-card";
    card.id = `fixture-${fixture.fixture_code}`;
    const isAdmin = checkIsAdmin();
    const completed = fixture.status === "completed";
    const cancelled = fixture.status === "cancelled";
    let score = "vs";
    if (completed) score = `${fixture.player_1_score} - ${fixture.player_2_score}`;
    if (cancelled) score = "Cancelled";
    
    card.innerHTML = `
        <div class="fixture-meta">
            <span>Round ${fixture.round_number}</span>
            <span class="badge ${completed ? "badge-completed" : cancelled ? "badge-danger" : "badge-group"}">
                ${completed ? "Completed" : cancelled ? "Cancelled" : "Scheduled"}
            </span>
        </div>
        <div class="fixture-players">
            <span class="fixture-player">${createPlayerLink(fixture.player_1_id, fixture.player_1_name,"",fixture.fixture_code)}</span>
            <span class="vs">${completed || cancelled ? score : "VS"}</span>
            <span class="fixture-player right">${createPlayerLink(fixture.player_2_id, fixture.player_2_name,"",fixture.fixture_code)}</span>
        </div>
        
        ${completed || cancelled ? "" : `
            <div class="fixture-actions">
                <button type="button" class="button primary-button" data-fixture-id="${fixture.fixture_code}">
                    Enter Result
                </button>
            </div>
        `}
        ${completed && isAdmin ? `
                <button type="button" class="button btn-warning" data-admin-fix="${fixture.fixture_code}" style="font-size: 0.8rem;">
                    Admin Override
                </button>
            ` : ''}
        ${renderOverrideHistoryHTML(fixture.overrides)}
    `;
    const resultButton = card.querySelector("[data-fixture-id]");
    if (resultButton) {
        resultButton.addEventListener("click", () => openGroupResultModal(fixture));
    }const adminFixButton = card.querySelector("[data-admin-fix]");if (adminFixButton) {
        adminFixButton.addEventListener("click", () => openAdminOverrideModal(fixture));
    }
    return card;
}

// STANDINGS (WITH CLICKABLE PLAYER NAMES)
function renderStandings() {
    const groups = {};
    allStandings.forEach(player => {
        const group = player.group_letter;
        if (!group) return;
        if (!groups[group]) groups[group] = [];
        groups[group].push(player);
    });
    standingsContainer.innerHTML = "";
    const groupNames = Object.keys(groups).sort();
    if (!groupNames.length) {
        standingsContainer.innerHTML = `
            <div class="empty-state">
                <h3>No Standings Yet</h3>
                <p>Standings will appear once the tournament starts.</p>
            </div>
        `;
        return;
    }
    groupNames.forEach(group => {
        const players = groups[group];
        const groupSection = document.createElement("div");
        groupSection.className = "standings-group";
        groupSection.innerHTML = `<h3 class="group-title">Group ${group}</h3>`;
        const tableContainer = document.createElement("div");
        tableContainer.className = "table-container";
        const table = document.createElement("table");
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Pos</th><th>Player</th><th>P</th><th>W</th><th>D</th>
                    <th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
                </tr>
            </thead>
        `;
        const tbody = document.createElement("tbody");
        const qualifiedPerGroup = Math.floor(Number(currentTournament.advanceCount || calculateAdvanceCount()) / 4);
        players.forEach((player, index) => {
            const position = index + 1;
            const qualified = position <= qualifiedPerGroup;
            const row = document.createElement("tr");
            row.id = `standings-row-${group}-${player.player_id}`;
            row.classList.add(qualified ? "qualified-player" : "eliminated-player");
            row.innerHTML = `
                <td class="position">${position}</td>
                <td><strong>${createPlayerLink(player.player_id, player.username,"",row.id)}</strong></td>
                <td>${player.matches_played ?? 0}</td>
                <td>${player.wins ?? 0}</td>
                <td>${player.draws ?? 0}</td>
                <td>${player.losses ?? 0}</td>
                <td>${player.goals_for ?? 0}</td>
                <td>${player.goals_against ?? 0}</td>
                <td>${player.goal_difference ?? 0}</td>
                <td><strong>${player.points ?? 0}</strong></td>
            `;
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        tableContainer.appendChild(table);
        groupSection.appendChild(tableContainer);
        standingsContainer.appendChild(groupSection);
    });
}
// CALCULATE ADVANCE COUNT
function calculateAdvanceCount() {
    const totalPlayers = allStandings.length;
    if (totalPlayers >= 33) return 32;
    if (totalPlayers >= 17) return 16;
    if (totalPlayers >= 9) return 8;
    if (totalPlayers >= 5) return 4;
    if (totalPlayers >= 3) return 2;
    return 1;
}

// CHECK GROUP STAGE COMPLETION
function isGroupStageComplete() {
    const groupFixtures = allMatches.filter(match => match.stage === "group");
    if (!groupFixtures.length) return false;
    return groupFixtures.every(fixture => fixture.status === "completed" || fixture.status === "cancelled");
}

// PROCEED BUTTON
function updateProceedButton() {
    if (currentTournament.status !== "group_stage") {
        proceedKnockoutButton.disabled = true;
        return;
    }
    proceedKnockoutButton.disabled = !isGroupStageComplete();
}

// PROCEED TO KNOCKOUT
proceedKnockoutButton.addEventListener("click", async () => {
    if (!isGroupStageComplete()) {
        showMessage("The group stage is not complete.", "error");
        return;
    }
    try {
        proceedKnockoutButton.disabled = true;
        await apiRequest(`${API_URL}/${currentTournamentId}/advance`, "POST");
        showMessage("Knockout stage created successfully.");
        await loadTournament();
    } catch (error) {
        proceedKnockoutButton.disabled = false;
        showMessage(error.message, "error");
    }
});

// GROUP RESULT MODAL
function openGroupResultModal(fixture) {
    if (currentTournament.status === "completed") return;
    currentFixture = fixture;
    resultModalTitle.textContent = "Enter Group Match Result";
    resultFixtureId.value = fixture.fixture_code;
    resultPlayer1Name.textContent = fixture.player_1_name || `Player ${fixture.player_1_id}`;
    resultPlayer2Name.textContent = fixture.player_2_name || `Player ${fixture.player_2_id}`;
    player1Score.value = "";
    player2Score.value = "";
    penaltySection.classList.add("hidden");
    penaltyWinner.innerHTML = `<option value="">Select winner</option>`;
    resultForm.dataset.stage = "group";
    resultModal.classList.remove("hidden");
    player1Score.focus();
}

// KNOCKOUT RESULT MODAL
function openKnockoutResultModal(fixture) {
    if (currentTournament.status === "completed") return;
    currentFixture = fixture;
    resultModalTitle.textContent = "Enter Knockout Match Result";
    resultFixtureId.value = fixture.fixture_code;
    resultPlayer1Name.textContent = fixture.player_1_name || `Player ${fixture.player_1_id}`;
    resultPlayer2Name.textContent = fixture.player_2_name || `Player ${fixture.player_2_id}`;
    player1Score.value = "";
    player2Score.value = "";
    penaltySection.classList.remove("hidden");
    penaltyWinner.innerHTML = `
        <option value="">Select winner</option>
        <option value="${fixture.player_1_id}">${fixture.player_1_name || `Player ${fixture.player_1_id}`}</option>
        <option value="${fixture.player_2_id}">${fixture.player_2_name || `Player ${fixture.player_2_id}`}</option>
    `;
    resultForm.dataset.stage = "knockout";
    resultModal.classList.remove("hidden");
    player1Score.focus();
}

// SHOW / HIDE PENALTY
player1Score.addEventListener("input", updatePenaltyVisibility);
player2Score.addEventListener("input", updatePenaltyVisibility);

function updatePenaltyVisibility() {
    if (resultForm.dataset.stage !== "knockout") return;
    const score1 = Number(player1Score.value);
    const score2 = Number(player2Score.value);
    if (player1Score.value !== "" && player2Score.value !== "" && score1 === score2) {
        penaltySection.classList.remove("hidden");
        penaltyWinner.required = true;
    } else {
        penaltySection.classList.add("hidden");
        penaltyWinner.required = false;
        penaltyWinner.value = "";
    }
}

// SUBMIT RESULT
resultForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentFixture) {
        showMessage("No fixture selected.", "error");
        return;
    }
    const stage = resultForm.dataset.stage;
    try {
        if (stage === "group") {
            await submitGroupResult();
        } else {
            await submitKnockoutResult();
        }
    } catch (error) {
        console.error("RESULT ERROR:", error);
        showMessage(error.message, "error");
    }
});


// CHECK ROUND COMPLETION AND SHOW POPUP MODAL
function checkRoundCompletionAndPrompt(matches) {
    const currentRound = getCurrentKnockoutRound(matches);
    if (!currentRound) return;

    // Do not show prompt or advance if the current round is the final match
    const roundLower = currentRound.toLowerCase().trim();
    if (roundLower === "final" || roundLower === "finals") return;

    const currentRoundMatches = matches.filter(
        match => (match.round_name || `Round ${match.round_number}`) === currentRound
    );
    const allCompleted = currentRoundMatches.length > 0 && currentRoundMatches.every(match => match.status === "completed");
    
    // Check if modal already exists to prevent duplicate popups
    if (allCompleted && !document.getElementById("roundCompleteModal")) {
        showRoundCompleteModal(currentRound);
    }
}

// POPUP MODAL MATCHING DELETE/RESULT STYLING
function showRoundCompleteModal(roundName) {
    // Reusing standard modal structure (.modal, .modal-content, .hidden classes if applicable)
    const modalHtml = `
        <div id="roundCompleteModal" class="modal" style="display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000;">
            <div class="modal-content" style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; width: 100%; text-align: center;">
                <h3>${escapeHtml(roundName)} Completed!</h3>
                <p style="margin: 15px 0; color: #555;">All matches in this round are finished. Would you like to review/override any results or proceed to the next stage?</p>
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                    <button type="button" class="button secondary-button" onclick="document.getElementById('roundCompleteModal').remove()">Cancel / Review</button>
                    <button type="button" class="button primary-button" onclick="executeAdvanceRound()">Advance to Next Round</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);
}

async function executeAdvanceRound() {
    try {
        const btn = document.querySelector("#roundCompleteModal .primary-button");
        if (btn) btn.disabled = true;
        
        await apiRequest(`${API_URL}/${currentTournamentId}/knockout/advance`, "POST");
        showMessage("Knockout round advanced successfully.");
        document.getElementById("roundCompleteModal")?.remove();
        await loadTournament();
    } catch (error) {
        showMessage(error.message, "error");
        const btn = document.querySelector("#roundCompleteModal .primary-button");
        if (btn) btn.disabled = false;
    }
}


// SUBMIT GROUP RESULT
async function submitGroupResult() {
    const homeGoals = Number(player1Score.value);
    const awayGoals = Number(player2Score.value);
    const screenshotInput = document.getElementById("matchScreenshot");
    if (!Number.isInteger(homeGoals) || !Number.isInteger(awayGoals) || homeGoals < 0 || awayGoals < 0) {
        throw new Error("Scores must be valid non-negative numbers.");
    }
    const fixtureCode = currentFixture?.fixture_code;
    const formData = new FormData();
    formData.append("homeGoals", homeGoals);
    formData.append("awayGoals", awayGoals);
    if(screenshotInput && screenshotInput.files.length > 0) {
        formData.append("screenshot", screenshotInput.files[0]);
    }
    await apiRequest(
        `${API_URL}/${currentTournamentId}/group/matches/${encodeURIComponent(currentFixture.fixture_code)}`,
        "PATCH",
        formData
    );
    closeModal();
    showMessage("Match result recorded successfully.");
    await loadTournament();
    if (fixtureCode) {
        window.location.hash = `fixture-${fixtureCode}`;
        scrollToCurrentHash();
    }
}

// SUBMIT KNOCKOUT RESULT
async function submitKnockoutResult() {
    const p1Goals = Number(player1Score.value);
    const p2Goals = Number(player2Score.value);
    let penaltyWinnerId = null;
    const screenshotInput = document.getElementById("matchScreenshot");
    if (p1Goals === p2Goals) {
        penaltyWinnerId = Number(penaltyWinner.value);
        if (!penaltyWinnerId) throw new Error("Please select the penalty winner.");
    }
    const fixtureCode = currentFixture?.fixture_code;
    const formData = new FormData();
    formData.append("p1Goals", p1Goals);
    formData.append("p2Goals", p2Goals);
    formData.append("penaltyWinnerId", penaltyWinnerId);
    if(screenshotInput && screenshotInput.files.length > 0) {
        formData.append("screenshot", screenshotInput.files[0]);
    }

    await apiRequest(
        `${API_URL}/${currentTournamentId}/knockout/matches/${encodeURIComponent(currentFixture.fixture_code)}`,
        "PATCH",
        formData
    );
    closeModal();
    showMessage("Knockout result recorded successfully.");
    await loadTournament();
    if (fixtureCode) {
        window.location.hash = `fixture-${fixtureCode}`;
        scrollToCurrentHash();
    }
}

// CLOSE MODAL
function closeModal() {
    resultModal.classList.add("hidden");
    currentFixture = null;
    resultForm.reset();
    penaltySection.classList.add("hidden");
    penaltyWinner.required = false;
}
closeResultModal.addEventListener("click", closeModal);
cancelResultButton.addEventListener("click", closeModal);
resultModal.addEventListener("click", event => {
    if (event.target === resultModal) closeModal();
});

// KNOCKOUT STAGE
function renderKnockoutStage() {
    const knockoutMatches = allMatches.filter(match => match.stage === "knockout");
    knockoutStageSection.classList.remove("hidden");
    if (!knockoutMatches.length) {
        knockoutFixturesContainer.innerHTML = `
            <div class="empty-state">
                <h3>No Knockout Fixtures</h3>
                <p>Knockout fixtures have not been generated yet.</p>
            </div>
        `;
        return;
    }
    const rounds = {};
    knockoutMatches.forEach(match => {
        const round = match.round_name || `Round ${match.round_number}`;
        if (!rounds[round]) rounds[round] = [];
        rounds[round].push(match);
    });
    knockoutFixturesContainer.innerHTML = "";
    Object.entries(rounds).forEach(([roundName, matches]) => {
        const round = document.createElement("div");
        round.className = "knockout-round";
        round.innerHTML = `<h3 class="round-title">${escapeHtml(roundName)}</h3>`;
        matches.forEach(match => round.appendChild(createKnockoutCard(match)));
        knockoutFixturesContainer.appendChild(round);
    });
    checkRoundCompletionAndPrompt(knockoutMatches);
    renderKnockoutAdvanceButton(knockoutMatches);
    renderTournamentComplete();
}

// KNOCKOUT CARD (WITH CLICKABLE PLAYERS)
function createKnockoutCard(match) {
    const card = document.createElement("div");
    card.className = "knockout-match";
    card.id = `fixture-${match.fixture_code}`;
    const completed = match.status === "completed";
    let p1Score = completed ? match.player_1_score : "";
    let p2Score = completed ? match.player_2_score : "";
    const isAdmin = checkIsAdmin();
    const cancelled= match.status==="Cancelled";
    
    card.innerHTML = `
        ${completed ? `
            <div class="fixture-status">
                <span class="badge badge-completed">Completed</span>
            </div>`:`
            <span class="badge ${cancelled ? "badge-danger" : "badge-group"}">
                ${cancelled ? "Cancelled" : "Scheduled"}
            </span>
            `}
        <div class="knockout-player ${completed && Number(match.winner_id) === Number(match.player_1_id) ? "winner" : ""}">
            <span>${createPlayerLink(match.player_1_id, match.player_1_name,"",match.fixture_code)}</span>
            <strong>${p1Score}</strong>
        </div>
        <div class="knockout-player ${completed && Number(match.winner_id) === Number(match.player_2_id) ? "winner" : ""}">
            <span>${createPlayerLink(match.player_2_id, match.player_2_name,"",match.fixture_code)}</span>
            <strong>${p2Score}</strong>
        </div>
        
        ${completed ?"": `
            <div class="fixture-actions">
                <button type="button" class="button primary-button">Enter Result</button>
            </div>
        `}
        
        ${completed && isAdmin ? `
    <div class="fixture-actions" style="margin-top: 8px;">
        <button type="button" class="button btn-warning" data-admin-fix="${match.fixture_code}" style="font-size: 0.8rem;">
            Admin Override
        </button>
    </div>
` : ''}
        ${renderOverrideHistoryHTML(match.overrides)}
    `;
    if (!completed) {
        const button = card.querySelector("button");
        button.addEventListener("click", () => openKnockoutResultModal(match));
    }const adminFixBtn = card.querySelector("[data-admin-fix]");
if (adminFixBtn) {
    adminFixBtn.addEventListener("click", () => openAdminOverrideModal(match));
}
    return card;
}

// KNOCKOUT ADVANCE BUTTON
function renderKnockoutAdvanceButton(matches) {
    let existingButton = document.getElementById("advanceKnockoutButton");
    if (existingButton) existingButton.remove();
    if (currentTournament.status === "completed") return;

    const currentRound = getCurrentKnockoutRound(matches);
    if (!currentRound) return;

    const roundLower = currentRound ? currentRound.toLowerCase().trim() : "";
    if (!currentRound || roundLower === "final" || roundLower === "finals") return;

    const currentRoundMatches = matches.filter(
        match => (match.round_name || `Round ${match.round_number}`) === currentRound
    );
    const allCompleted = currentRoundMatches.length > 0 && currentRoundMatches.every(match => match.status === "completed");
    if (!allCompleted) return;

    const button = document.createElement("button");
    button.type = "button";
    button.id = "advanceKnockoutButton";
    button.className = "button primary-button";
    button.textContent = "Advance to Next Round";
    button.addEventListener("click", advanceKnockoutRound);

    const wrapper = document.createElement("div");
    wrapper.className = "proceed-container";
    wrapper.appendChild(button);
    knockoutStageSection.appendChild(wrapper);
}

// GET CURRENT KNOCKOUT ROUND
function getCurrentKnockoutRound(matches) {
    const scheduled = matches.filter(match => match.status === "scheduled");
    if (scheduled.length) {
        return scheduled[0].round_name || `Round ${scheduled[0].round_number}`;
    }
    const last = matches[matches.length - 1];
    if (!last) return null;
    return last.round_name || `Round ${last.round_number}`;
}

// ADVANCE KNOCKOUT ROUND
async function advanceKnockoutRound() {
    try {
        const button = document.getElementById("advanceKnockoutButton");
        if (button) button.disabled = true;
        await apiRequest(`${API_URL}/${currentTournamentId}/knockout/advance`, "POST");
        showMessage("Knockout round advanced successfully.");
        await loadTournament();
    } catch (error) {
        showMessage(error.message, "error");
        const button = document.getElementById("advanceKnockoutButton");
        if (button) button.disabled = false;
    }
}

// TOURNAMENT COMPLETE (WITH CLICKABLE CHAMPION)
function renderTournamentComplete() {
    resultModal.classList.add("hidden");
    tournamentCompleteSection.classList.remove("hidden");
    const knockoutMatches = allMatches.filter(match => match.stage === "knockout");
    if (!knockoutMatches.length) {
        championName.textContent = "-";
        return;
    }
    const finalMatch = knockoutMatches.find(
        match => match.round_name && match.round_name.toLowerCase().includes("final") 
                 && !match.round_name.toLowerCase().includes("quarter") 
                 && !match.round_name.toLowerCase().includes("semi")
    ) || knockoutMatches[knockoutMatches.length - 1];

    if (finalMatch && finalMatch.winner_id) {
        if(finalMatch.round_name.toLowerCase().includes("semi")&& !finalMatch.round_name.toLowerCase()==="final"){
            championName.textContent = "-";
            return;
        }
        const winnerId = finalMatch.winner_id;
        const winnerName = Number(winnerId) === Number(finalMatch.player_1_id)
            ? finalMatch.player_1_name || `Player ${finalMatch.player_1_id}`
            : finalMatch.player_2_name || `Player ${finalMatch.player_2_id}`;
        championName.innerHTML = createPlayerLink(winnerId, winnerName);
        currentTournament.status="completed";
    } 
}


function openAdminOverrideModal(fixture) {
    adminTargetFixture = fixture;
    document.getElementById("adminFixtureCode").value = fixture.fixture_code;
    document.getElementById("adminPlayer1Name").textContent = fixture.player_1_name || `Player ${fixture.player_1_id}`;
    document.getElementById("adminPlayer2Name").textContent = fixture.player_2_name || `Player ${fixture.player_2_id}`;
    document.getElementById("adminPlayer1Score").value = fixture.player_1_score ?? 0;
    document.getElementById("adminPlayer2Score").value = fixture.player_2_score ?? 0;
    
    document.getElementById("adminOverrideModal").classList.remove("hidden");
    const navigate = document.getElementById("adminOverrideModal");
     if (navigate) {
                navigate.scrollIntoView({ behavior: "smooth", block: "start" });
            }
    
}

// Close listeners
document.getElementById("closeAdminModal").addEventListener("click", closeAdminModal);
document.getElementById("cancelAdminButton").addEventListener("click", closeAdminModal);

function closeAdminModal() {
    document.getElementById("adminOverrideModal").classList.add("hidden");
    adminTargetFixture = null;
    document.getElementById("adminOverrideForm").reset();
}

// Submit Override
document.getElementById("adminOverrideForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!adminTargetFixture) return;

    const homeGoals = Number(document.getElementById("adminPlayer1Score").value);
    const awayGoals = Number(document.getElementById("adminPlayer2Score").value);
    const screenshotFile = document.getElementById("adminMatchScreenshot").files[0];
    const fixtureCode = adminTargetFixture.fixture_code;
    const formData = new FormData();
    formData.append("homeGoals", homeGoals);
    formData.append("awayGoals", awayGoals);
    if (screenshotFile) {
        formData.append("screenshot", screenshotFile);
    }

    try {
        await apiRequest(
            `${API_URL}/${currentTournamentId}/admin/matches/${encodeURIComponent(adminTargetFixture.fixture_code)}`,
            "PATCH",
            formData
        );
        closeAdminModal();
        showMessage("Match score corrected successfully by admin.");
        await loadTournament();
        if (fixtureCode) {
            window.location.hash = `fixture-${fixtureCode}`;
            scrollToCurrentHash();
        }
    } catch (error) {
        showMessage(error.message, "error");
        closeAdminModal();
    }
    
});

