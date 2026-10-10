const TournamentManager = require("./classes/tournamentManager");
const GroupStage = require("./classes/groupStage");
const KnockoutManager = require("./classes/knockoutStage");
const dao = require("./tournamentDao");
class TournamentService {
    constructor() {
        this.tournaments = new Map();
    }
    async createTournament(name, maxPlayers = 20) {
        if (!name) {
            throw new Error(
                "Tournament name is required."
            );
        }
        if (maxPlayers <= 8 && maxPlayers % 2 !== 0) {
        throw new Error("Tournaments with 8 or fewer players must have an even number of max players.");
    }
        return await dao.createTournament(
            name,
            maxPlayers
        );
    }
    async createPlayer(players) {
    const playerList = Array.isArray(players)
        ? players
        : [players];
    if (playerList.length === 0) {
        throw new Error(
            "At least one player is required."
        );
    }
    const createdPlayers = [];
    for (const player of playerList) {
        if (!player.username) {
            throw new Error(
                "Every player must have a username."
            );
        }
        const createdPlayer =await dao.createPlayer(
                player.username,
                player.number || null
            );
        createdPlayers.push(createdPlayer);
    }
    return createdPlayers;
}
    async registerPlayer(
    tournamentId,
    playerIds
) {
    const tournament = await dao.getTournament(tournamentId);
    if (!tournament) {
        throw new Error(
            "Tournament not found."
        );
    }
    if (tournament.status !== "registration") {
        throw new Error(
            "Tournament registration is closed."
        );
    }
    const playerIdList = Array.isArray(playerIds)
            ? playerIds
            : [playerIds];
    if (playerIdList.length === 0) {
        throw new Error(
            "At least one player is required."
        );
    }
    const currentPlayers = await dao.getPlayers(tournamentId);
    if (
        currentPlayers.length +
        playerIdList.length >
        tournament.max_players
    ) {
        throw new Error(
            "Adding these players exceeds the tournament capacity."
        );
    }
    const registrations = [];
    for (const playerId of playerIdList) {
        const player =await dao.getPlayer(playerId);
        if (!player) {
            throw new Error(
                `Player ${playerId} not found.`
            );
        }
        const alreadyRegistered =
        await dao.isPlayerRegistered(
            tournamentId,
            playerId
        );
    if (alreadyRegistered) {
        throw new Error(
            `${player.username} is already registered in this tournament.`
        );
    }
        const registration =await dao.registerPlayer(
                tournamentId,
                playerId
            );
        registrations.push(registration);
    }
    return registrations;
}
    async loadTournament(tournamentId) {
    if (this.tournaments.has(tournamentId)) {
        return this.tournaments.get(tournamentId);
    }
    const tournament =await dao.getTournament(tournamentId);
    if (!tournament) {
        throw new Error("Tournament not found.");
    }
    const players = await dao.getPlayers(tournamentId);
    const manager =new TournamentManager(players.length);
    if (tournament.status === "registration") {
        this.tournaments.set(
            tournamentId,
            manager
        );
        return manager;
    }
    if (tournament.status === "group_stage") {
        await this.restoreGroupStage(
            tournamentId,
            manager
        );
        this.tournaments.set(
            tournamentId,
            manager
        );
        return manager;
    }
    if (
        tournament.status === "knockout" ||
        tournament.status === "completed"
    ) {
        await this.restoreKnockoutStage(
            tournamentId,
            manager
        );
        this.tournaments.set(
            tournamentId,
            manager
        );
        return manager;
    }
}
    async restoreGroupStage(
    tournamentId,
    manager
) {
    const groupMembers =await dao.getGroupMembers(tournamentId);
    const matches = await dao.getMatches(
            tournamentId,
            "group"
        );
    const groupMap = {};
    for (const member of groupMembers) {
        if (!groupMap[member.group_letter]) {
            groupMap[member.group_letter] = [];
        }
        groupMap[member.group_letter].push(
            member.player_id
        );
    }
    const groupStage =new GroupStage(groupMap);
    for (const member of groupMembers) {
        groupStage.standings[
            member.player_id
        ] = {
            id: member.player_id,
            group: member.group_letter,
            played:  member.matches_played,
            wins:  member.wins,
            draws: member.draws,
            losses:member.losses,
            points:  member.points,
            goalsFor:  member.goals_for,
            goalsAgainst: member.goals_against,
            goalDifference:member.goal_difference
        };
    }
    groupStage.fixtures =
        matches.map(match => ({
            id: match.fixture_code,
            group:
                match.group_letter,
            round:
                match.round_number,
            home:
                match.player_1_id,
            away:
                match.player_2_id,
            homeGoals:
                match.player_1_score,
            awayGoals:
                match.player_2_score,
            status:
                match.status === "completed"
                    ? "COMPLETED"
                    : "PENDING",
            cancellationReason:
                match.cancellation_reason
        }));
    manager.groupMap = groupMap;
    manager.groupStage =groupStage;
    manager.knockoutStage =null;
    manager.status ="GROUP_STAGE";
    return manager;
}async getAllPlayers() {
    return await dao.getAllPlayers();
}
async getTournamentPlayers(tournamentId) {
    const tournament =await dao.getTournament(tournamentId);
    if (!tournament) {
        throw new Error("Tournament not found.");
    }
    const players =await dao.getPlayers(tournamentId);
    return players;
}
async restoreKnockoutStage(tournamentId, manager) {
    const matches = await dao.getMatches(tournamentId, "knockout");
    if (!matches.length) {
        throw new Error("No knockout matches found.");
    }
    // 1. Determine the latest active round name from database fixtures
    const pendingMatches = matches.filter(match => match.status === "scheduled");
    let currentRound;
    if (pendingMatches.length > 0) {
        // If matches are still scheduled, use the round name of the pending matches
        currentRound = pendingMatches[0].round_name;
    } else {
        // If all existing matches are completed, use the round name of the last generated set of matches
        currentRound = matches[matches.length - 1].round_name;
    }
    const currentMatches = matches.filter(match => match.round_name === currentRound);
    const firstRoundName = matches[0].round_name;
    const firstRoundMatches = matches.filter(match => match.round_name === firstRoundName);
    const qualifiers = firstRoundMatches.flatMap(match => [match.player_1_id, match.player_2_id]);
    const uniqueQualifiers = [...new Set(qualifiers)];
    const knockout = new KnockoutManager(uniqueQualifiers);
    const roundNames = [...new Set(matches.map(match => match.round_name))];
    knockout.history = [];
    // 2. Build history for previous rounds (excluding active currentRound)
    for (const roundName of roundNames) {
        if (roundName === currentRound && pendingMatches.length > 0) continue;
        const roundMatches = matches.filter(match => match.round_name === roundName);
        const completed = roundMatches.every(match => match.status === "completed");
        if (completed && roundMatches.length > 0 && roundName !== currentRound) {
            knockout.history.push({
                round: roundName,
                fixtures: roundMatches.map(match => ({
                    id: match.fixture_code,
                    roundName: match.round_name,
                    p1Id: match.player_1_id,
                    p2Id: match.player_2_id,
                    p1Goals: match.player_1_score,
                    p2Goals: match.player_2_score,
                    penaltyWinnerId: null,
                    winnerId: match.winner_id,
                    loserId: match.winner_id === match.player_1_id ? match.player_2_id : match.player_1_id,
                    status: "COMPLETED"
                }))
            });
        }
    }
    // 3. Populate currentFixtures with restored status
    knockout.currentFixtures = currentMatches.map(match => ({
        id: match.fixture_code,
        roundName: match.round_name,
        p1Id: match.player_1_id,
        p2Id: match.player_2_id,
        p1Goals: match.player_1_score,
        p2Goals: match.player_2_score,
        penaltyWinnerId: null,
        winnerId: match.winner_id,
        loserId: match.winner_id ? (match.winner_id === match.player_1_id ? match.player_2_id : match.player_1_id) : null,
        status: match.status === "completed" ? "COMPLETED" : "PENDING"
    }));
    knockout.currentRoundPlayers = currentMatches.flatMap(match => [match.player_1_id, match.player_2_id]);
    if (matches.every(match => match.status === "completed") && currentRound.toLowerCase().includes("final")) {
        const finalMatch = matches[matches.length - 1];
        knockout.status = "FINISHED";
        knockout.currentRoundPlayers = [finalMatch.winner_id];
    } else {
        knockout.status = "IN_PROGRESS";
    }
    manager.groupStage = null;
    manager.knockoutStage = knockout;
    manager.status = knockout.status === "FINISHED" ? "COMPLETED" : "KNOCKOUT_STAGE";
    return manager;
}
    async startTournament(tournamentId) {
        const tournament =await dao.getTournament(tournamentId);
        if (!tournament) {
            throw new Error("Tournament not found.");
        }
        if (tournament.status !== "registration") {
        throw new Error(
            "Tournament has already started."
        );
    }
        const players = await dao.getPlayers(tournamentId);
        if (players.length < 2) {
            throw new Error(
                "At least 2 players are required."
            );
        }
        const playerIds = players.map(player => player.id);
        const manager = new TournamentManager(playerIds.length);
        const stage = manager.start(playerIds);
        this.tournaments.set(
            tournamentId,
            manager
        );
        if (manager.status === "GROUP_STAGE") {
            await dao.createGroupMembers(
                tournamentId,
                manager.getGroupMap()
            );
            await dao.saveGroupFixtures(
                tournamentId,
                stage.fixtures
            );
            await dao.updateTournamentStatus(
                tournamentId,
                "group_stage"
            );
        } else {
            await dao.saveKnockoutFixtures(
                tournamentId,
                stage.getCurrentFixtures()
            );
            await dao.updateTournamentStatus(
                tournamentId,
                "knockout"
            );manager.status = "KNOCKOUT_STAGE";
        }
        return manager.getSummary();
    }
    async getManager(tournamentId) {
    if (this.tournaments.has(tournamentId)) {
        return this.tournaments.get(
            tournamentId
        );
    }
    return await this.loadTournament(
        tournamentId
    );
}
async recordGroupMatch(tournamentId, results) {
    const manager = await this.getManager(tournamentId);
    if (manager.status !== "GROUP_STAGE") {
        throw new Error(
            "Tournament is not in group stage."
        );
    }
    const matchResults = Array.isArray(results)
        ? results
        : [results];
    const recordedFixtures = [];
    for (const result of matchResults) {
        if (!result.fixtureId) {
            throw new Error(
                "Fixture ID is required."
            );
        }
        if (
            result.homeGoals === undefined ||
            result.awayGoals === undefined
        ) {
            throw new Error(
                "Both home and away scores are required."
            );
        }
        const homeGoals = Number(result.homeGoals);
        const awayGoals = Number(result.awayGoals);
        if (
            !Number.isInteger(homeGoals) ||
            !Number.isInteger(awayGoals) ||
            homeGoals < 0 ||
            awayGoals < 0
        ) {
            throw new Error(
                "Scores must be valid non-negative numbers."
            );
        }
        const fixture = manager.recordGroupMatch(
            result.fixtureId,
            homeGoals,
            awayGoals
        );
        if (!fixture) {
            throw new Error(
                `Fixture ${result.fixtureId} was not found or could not be recorded.`
            );
        }
        await dao.updateGroupMatch(
            tournamentId,
            fixture
        );
        recordedFixtures.push(fixture);
    }
    // Save the updated standings AFTER all matches
    await dao.updateGroupStandings(
        tournamentId,
        manager.getAllStandings()
    );
    return recordedFixtures;
}
    async advanceToKnockouts(tournamentId) {
        const manager =await this.getManager(tournamentId);
        const knockout =manager.advanceToKnockouts();
        await dao.saveKnockoutFixtures(
            tournamentId,
            knockout.getCurrentFixtures()
        );
        await dao.updateTournamentStatus(
            tournamentId,
            "knockout"
        );
        return knockout.getCurrentFixtures();
    }
    async recordKnockoutMatch(tournamentId, results) {
    const manager = await this.getManager(tournamentId);
    if (manager.status !== "KNOCKOUT_STAGE") {
        throw new Error("Tournament is not in knockout stage.");
    }
    const knockout = manager.knockoutStage;
    const matchResults = Array.isArray(results) ? results : [results];
    const recordedFixtures = [];
    for (const result of matchResults) {
        const fixture = knockout.recordMatch(
            result.fixtureId,
            result.p1Goals,
            result.p2Goals,
            result.penaltyWinnerId || null
        );
        await dao.updateKnockoutMatch(tournamentId, fixture);
        recordedFixtures.push(fixture);
    }
    // Auto-advance/complete if the final match was just recorded
    if (knockout.isCurrentRoundComplete()) {
        const advanceResult = knockout.advanceRound();
        if (advanceResult.status === "FINISHED") {
            await dao.updateTournamentStatus(tournamentId, "completed");
            manager.status = "COMPLETED";
        }else if (advanceResult.status === "CONTINUING") {
            // CRITICAL: Persist newly generated next-round fixtures to Database
            await dao.saveKnockoutFixtures(tournamentId, advanceResult.fixtures);
        }
    }
    return recordedFixtures;
}
    async advanceKnockoutRound(tournamentId) {
        const manager =await this.getManager(tournamentId);
        const knockout = manager.knockoutStage;
        const result = knockout.advanceRound();
        if (result.status === "FINISHED") {
            await dao.updateTournamentStatus(
                tournamentId,
                "completed"
            );
            manager.status = "COMPLETED";
            return result;
        }
        await dao.saveKnockoutFixtures(
            tournamentId,
            result.fixtures
        );
        await dao.updateTournamentStatus(tournamentId, "knockout");
        return result;
    }
    async getTournament(tournamentId) {
        const tournament = await dao.getTournament(tournamentId);
        if (!tournament) {
            throw new Error("Tournament not found.");
        }
        const matches = await dao.getMatches(tournamentId);
        const players = await dao.getPlayers(tournamentId);
        
        // 1. Hydrate our robust business logic class engine from database snapshots
        const manager = await this.getManager(tournamentId);
        // 2. CRITICAL SYNC FIX: If we are in the group stage, ask our class engine 
        // to compute our rankings using Head-to-Head rules!
        let standings = [];
        if (manager.status === "GROUP_STAGE" ) {
            if (!manager.groupStage) {
                await this.restoreGroupStage(tournamentId, manager);
            }
            const rawEngineStandings = manager.getAllStandings(); 

            // 2. CRITICAL NAME FIX: Map over the standings rows and inject the real username
            // from the tournament's registered players list
            standings = rawEngineStandings.map(engineRow => {
                const matchedPlayer = players.find(p => Number(p.id) === Number(engineRow.id));
                return {
                    ...engineRow,
                    // Inject the database username, or fall back safely
                    username: matchedPlayer ? matchedPlayer.username : `Player ${engineRow.id}`
                };
            }); 
        } else {
            standings = await dao.getGroupStandings(tournamentId);
        }

        return {
            tournament,
            standings, // This array payload is now perfectly pre-sorted by backend rules!
            matches,
            totalPlayers: players.length,
            advanceCount: manager.advanceCount
        };
    }
    async getAllTournaments() {
    return await dao.getAllTournaments();
}
    async getLiveSummary(tournamentId) {
        const manager = await this.getManager(tournamentId);
        return manager.getSummary();
    }
}
module.exports = new TournamentService();