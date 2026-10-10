const PlayerStatsDAO = require("./tournamentDAO");
function createEmptyStats() {
    return {
        scheduledGames: 0,
        gamesPlayed: 0,
        pendingGames: 0,
        cancelledGames: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0
    };
}
function calculateStats(matches, playerId) {
    const stats = createEmptyStats();
    for (const match of matches) {
        if (match.status === "cancelled" || !match.player_2_id) {
            stats.cancelledGames++;
            continue;
        }
        stats.scheduledGames++;
        if (
            match.status === "scheduled" ||
            match.player_1_score === null ||
            match.player_2_score === null
        ) {
            stats.pendingGames++;
            continue;
        }
        stats.gamesPlayed++;
        const playerIsPlayer1 = match.player_1_id === Number(playerId);
        const playerScore = playerIsPlayer1 ? match.player_1_score : match.player_2_score;
        const opponentScore = playerIsPlayer1 ? match.player_2_score : match.player_1_score;
        stats.goalsFor += playerScore;
        stats.goalsAgainst += opponentScore;
        if (playerScore > opponentScore) {
            stats.wins++;
            stats.points += 3;
        } else if (playerScore === opponentScore) {
            stats.draws++;
            stats.points += 1;
        } else {
            stats.losses++;
        }
    }
    stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
    return stats;
}
function formatMatch(match, playerId) {
    const playerIsPlayer1 = match.player_1_id === Number(playerId);
    const opponentId = playerIsPlayer1 ? match.player_2_id : match.player_1_id;
    const opponent = playerIsPlayer1 ? match.player_2_name : match.player_1_name;
    if (match.status === "cancelled" || !match.player_2_id) {
        return {
            fixtureId: match.id,
            fixtureCode: match.fixture_code,
            tournamentId: match.tournament_id,
            opponentId,
            opponent: opponent || "N/A",
            stage: match.stage,
            round: match.round_number,
            roundName: match.round_name,
            group: match.group_letter,
            status: "CANCELLED",
            result: "CANCELLED",
            score: "N/A"
        };
    }
    if (
        match.status === "scheduled" ||
        match.player_1_score === null ||
        match.player_2_score === null
    ) {
        return {
            fixtureId: match.id,
            fixtureCode: match.fixture_code,
            tournamentId: match.tournament_id,
            opponentId,
            opponent,
            stage: match.stage,
            round: match.round_number,
            roundName: match.round_name,
            group: match.group_letter,
            status: "SCHEDULED",
            goalsFor: null,
            goalsAgainst: null,
            score: null
        };
    }
    const goalsFor = playerIsPlayer1 ? match.player_1_score : match.player_2_score;
    const goalsAgainst = playerIsPlayer1 ? match.player_2_score : match.player_1_score;
    let result;
    if (goalsFor > goalsAgainst) {
        result = "WIN";
    } else if (goalsFor === goalsAgainst) {
        result = "DRAW";
    } else {
        result = "LOSS";
    }
    return {
        fixtureId: match.id,
        fixtureCode: match.fixture_code,
        tournamentId: match.tournament_id,
        opponentId,
        opponent,
        stage: match.stage,
        round: match.round_number,
        roundName: match.round_name,
        group: match.group_letter,
        status: "PLAYED",
        result,
        goalsFor,
        goalsAgainst,
        score: `${goalsFor}-${goalsAgainst}`
    };
}
// playerStatsService_4.js
async function getPlayerOverallStats(tournamentId, playerId) {
    const numericPlayerId = Number(playerId);
    const numericTournamentId = tournamentId ? Number(tournamentId) : null;
    const player = await PlayerStatsDAO.getPlayer(numericPlayerId);
    if (!player) {
        throw new Error("Player not found");
    }
    // Check whether to fetch tournament-specific or all-time career matches
    const matches = numericTournamentId
        ? await PlayerStatsDAO.getPlayerMatches(numericTournamentId, numericPlayerId)
        : await PlayerStatsDAO.getPlayerCareerMatches(numericPlayerId);
    const stats = calculateStats(matches, numericPlayerId);
    const formattedMatches = matches.map(match => formatMatch(match, numericPlayerId));
    // Calculate progression per tournament
    const tournamentsMap = {};
    for (const match of matches) {
        const tId = match.tournament_id || numericTournamentId;
        if (!tournamentsMap[tId]) {
            tournamentsMap[tId] = {
                id: tId,
                name: match.tournament_name || `Tournament #${tId}`,
                highestStage: "Group Stage",
                group: match.group_letter || null,
                matches: []
            };
        }
        if (match.stage === "knockout") {
            tournamentsMap[tId].highestStage = match.round_name || `Round ${match.round_number}`;
        }
        tournamentsMap[tId].matches.push(formatMatch(match, numericPlayerId));
    }
    const tournamentsParticipated = Object.values(tournamentsMap);
    return {
        player: {
            id: player.id,
            username: player.username,
            teamName: player.team_name || player.team || player.username + " FC",
            number: player.number
        },
        tournamentId: numericTournamentId,
        totalTournamentsParticipated: tournamentsParticipated.length,
        tournaments: tournamentsParticipated,
        stats,
        matches: formattedMatches
    };
}
module.exports = {
    getPlayerOverallStats
};