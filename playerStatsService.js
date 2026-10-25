const PlayerStatsDAO = require("./tournamentDAO");
const createEmptyStats = () => ({
    scheduledGames: 0, gamesPlayed: 0, pendingGames: 0, cancelledGames: 0,
    wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0
});
function calculateStats(matches, playerId) {
    const stats = createEmptyStats();
    for (const match of matches) {
        if (match.status === "cancelled" || !match.player_2_id) { stats.cancelledGames++; continue; }
        
        if (match.status === "scheduled" || match.player_1_score === null || match.player_2_score === null) { stats.scheduledGames++; continue; }
        stats.gamesPlayed++;
        const isP1 = match.player_1_id === Number(playerId);
        const [pScore, oScore] = [isP1 ? match.player_1_score : match.player_2_score, isP1 ? match.player_2_score : match.player_1_score];
        stats.goalsFor += pScore; stats.goalsAgainst += oScore;
        if (pScore > oScore) { stats.wins++; stats.points += 3; }
        else if (pScore === oScore) { stats.draws++; stats.points += 1; }
        else { stats.losses++; }
    }
    stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
    return stats;
}
function formatMatch(match, playerId) {
    const isP1 = match.player_1_id === Number(playerId);
    const base = {
        id: match.id, fixtureCode: match.fixture_code, fixtureId: match.id, tournamentId: match.tournament_id,
        opponentId: isP1 ? match.player_2_id : match.player_1_id, opponent: (isP1 ? match.player_2_name : match.player_1_name) || "N/A",
        stage: match.stage, round: match.round_number, roundName: match.round_name, group: match.group_letter, result_screenshot: match.result_screenshot,overrides: match.overrides || []
    };
    if (match.status === "cancelled" || !match.player_2_id) return { ...base, status: "CANCELLED", result: "CANCELLED", score: "N/A" };
    if (match.status === "scheduled" || match.player_1_score === null || match.player_2_score === null) return { ...base, status: "SCHEDULED", goalsFor: null, goalsAgainst: null, score: null };
    const [gFor, gAg] = [isP1 ? match.player_1_score : match.player_2_score, isP1 ? match.player_2_score : match.player_1_score];
    const result = gFor > gAg ? "WIN" : gFor === gAg ? "DRAW" : "LOSS";
    return { ...base, status: "PLAYED", result, goalsFor: gFor, goalsAgainst: gAg, score: `${gFor}-${gAg}` };
}
async function getPlayerOverallStats(tournamentId, playerId) {
    const [numPlayerId, numTournId] = [Number(playerId), tournamentId ? Number(tournamentId) : null];
    const player = await PlayerStatsDAO.getPlayer(numPlayerId);
    if (!player) throw new Error("Player not found");
    const matches = numTournId ? await PlayerStatsDAO.getPlayerMatches(numTournId, numPlayerId) : await PlayerStatsDAO.getPlayerCareerMatches(numPlayerId);
    const stats = calculateStats(matches, numPlayerId);
    const formattedMatches = matches.map(m => formatMatch(m, numPlayerId));
    const tournamentsMap = {};
    for (const match of matches) {
        const tId = match.tournament_id || numTournId;
        if (!tournamentsMap[tId]) tournamentsMap[tId] = { id: tId, name: match.tournament_name || `Tournament #${tId}`, highestStage: "Group Stage", group: match.group_letter || null, matches: [] };
        if (match.stage === "knockout") tournamentsMap[tId].highestStage = match.round_name || `Round ${match.round_number}`;
        tournamentsMap[tId].matches.push(formatMatch(match, numPlayerId));
    }
    return {
        player: { id: player.id, username: player.username, teamName: player.team_name || `${player.username} FC`, number: player.number },
        tournamentId: numTournId, totalTournamentsParticipated: Object.keys(tournamentsMap).length,
        tournaments: Object.values(tournamentsMap), stats, matches: formattedMatches
    };
}
module.exports = { getPlayerOverallStats };