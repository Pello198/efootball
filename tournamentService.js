const TournamentManager = require("./classes/tournamentManager");
const GroupStage = require("./classes/groupStage");
const KnockoutManager = require("./classes/knockoutStage");
const dao = require("./tournamentDAO");
class TournamentService {
    constructor() { this.tournaments = new Map(); }
    async createTournament(name, maxPlayers = 20) {
        if (!name) throw new Error("Tournament name is required.");
        if (maxPlayers <= 8 && maxPlayers % 2 !== 0) throw new Error("Tournaments with 8 or fewer players must have an even number of max players.");
        return await dao.createTournament(name, maxPlayers);
    }
    async createPlayer(players) {
        const playerList = Array.isArray(players) ? players : [players];
        if (!playerList.length) throw new Error("At least one player is required.");
        const createdPlayers = [];
        for (const player of playerList) {
            if (!player.username) throw new Error("Every player must have a username.");
            createdPlayers.push(await dao.createPlayer(player.username, player.number || null,player.password,player.avatar||null));
        }
        return createdPlayers;
    }
    async registerPlayer(tournamentId, playerIds) {
        const tournament = await dao.getTournament(tournamentId);
        if (!tournament) throw new Error("Tournament not found.");
        if (tournament.status !== "registration") throw new Error("Tournament registration is closed.");
        const playerIdList = Array.isArray(playerIds) ? playerIds : [playerIds];
        if (!playerIdList.length) throw new Error("At least one player is required.");
        const currentPlayers = await dao.getPlayers(tournamentId);
        if (currentPlayers.length + playerIdList.length > tournament.max_players) throw new Error("Adding these players exceeds the tournament capacity.");
        const registrations = [];
        for (const playerId of playerIdList) {
            const player = await dao.getPlayer(playerId);
            if (!player) throw new Error(`Player ${playerId} not found.`);
            if (await dao.isPlayerRegistered(tournamentId, playerId)) throw new Error(`${player.username} is already registered in this tournament.`);
            registrations.push(await dao.registerPlayer(tournamentId, playerId));
        }
        return registrations;
    }
    async removePlayerFromTournament(tournamentId, playerId) {
        const tournament = await dao.getTournament(tournamentId);
        if (!tournament) throw new Error("Tournament not found.");
        if (tournament.status !== "registration") throw new Error("Cannot remove players after tournament registration has closed.");
        return await dao.removePlayerFromTournament(tournamentId, playerId);
    }
    async loadTournament(tournamentId) {
        if (this.tournaments.has(tournamentId)) return this.tournaments.get(tournamentId);
        const tournament = await dao.getTournament(tournamentId);
        if (!tournament) throw new Error("Tournament not found.");
        const players = await dao.getPlayers(tournamentId);
        const manager = new TournamentManager(players.length);
        if (tournament.status === "group_stage") await this.restoreGroupStage(tournamentId, manager);
        else if (tournament.status === "knockout" || tournament.status === "completed") await this.restoreKnockoutStage(tournamentId, manager);
        this.tournaments.set(tournamentId, manager);
        return manager;
    }
    async restoreGroupStage(tournamentId, manager) {
        const [groupMembers, matches] = await Promise.all([dao.getGroupMembers(tournamentId), dao.getMatches(tournamentId, "group")]);
        const groupMap = {};
        for (const m of groupMembers) {
            (groupMap[m.group_letter] ||= []).push(m.player_id);
        }
        const groupStage = new GroupStage(groupMap);
        for (const m of groupMembers) {
            groupStage.standings[m.player_id] = { id: m.player_id, group: m.group_letter, played: m.matches_played, wins: m.wins, draws: m.draws, losses: m.losses, points: m.points, goalsFor: m.goals_for, goalsAgainst: m.goals_against, goalDifference: m.goal_difference };
        }
        groupStage.fixtures = matches.map(m => ({ id: m.fixture_code, group: m.group_letter, round: m.round_number, home: m.player_1_id, away: m.player_2_id, homeGoals: m.player_1_score, awayGoals: m.player_2_score, status: m.status === "completed" ? "COMPLETED" : "PENDING", cancellationReason: m.cancellation_reason }));
        Object.assign(manager, { groupMap, groupStage, knockoutStage: null, status: "GROUP_STAGE" });
        return manager;
    }
    async restoreKnockoutStage(tournamentId, manager) {
        const matches = await dao.getMatches(tournamentId, "knockout");
        if (!matches.length) throw new Error("No knockout matches found.");
        const pending = matches.filter(m => m.status === "scheduled");
        const currentRound = pending.length ? pending[0].round_name : matches[matches.length - 1].round_name;
        const currentMatches = matches.filter(m => m.round_name === currentRound);
        const firstRoundMatches = matches.filter(m => m.round_name === matches[0].round_name);
        const qualifiers = [...new Set(firstRoundMatches.flatMap(m => [m.player_1_id, m.player_2_id]))];
        const knockout = new KnockoutManager(qualifiers);
        knockout.history = [];
        const roundNames = [...new Set(matches.map(m => m.round_name))];
        for (const rName of roundNames) {
            if (rName === currentRound && pending.length) continue;
            const rMatches = matches.filter(m => m.round_name === rName);
            if (rMatches.every(m => m.status === "completed") && rMatches.length) {
                knockout.history.push({ round: rName, fixtures: rMatches.map(m => ({ id: m.fixture_code, roundName: m.round_name, p1Id: m.player_1_id, p2Id: m.player_2_id, p1Goals: m.player_1_score, p2Goals: m.player_2_score, penaltyWinnerId: null, winnerId: m.winner_id, loserId: m.winner_id === m.player_1_id ? m.player_2_id : m.player_1_id, status: "COMPLETED" })) });
            }
        }
        knockout.currentFixtures = currentMatches.map(m => ({ id: m.fixture_code, roundName: m.round_name, p1Id: m.player_1_id, p2Id: m.player_2_id, p1Goals: m.player_1_score, p2Goals: m.player_2_score, penaltyWinnerId: null, winnerId: m.winner_id, loserId: m.winner_id ? (m.winner_id === m.player_1_id ? m.player_2_id : m.player_1_id) : null, status: m.status === "completed" ? "COMPLETED" : "PENDING" }));
        knockout.currentRoundPlayers = currentMatches.flatMap(m => [m.player_1_id, m.player_2_id]);
        knockout.status = matches.every(m => m.status === "completed") && currentRound.toLowerCase().includes("final") ? (knockout.currentRoundPlayers = [matches[matches.length - 1].winner_id], "FINISHED") : "IN_PROGRESS";
        Object.assign(manager, { groupStage: null, knockoutStage: knockout, status: knockout.status === "FINISHED" ? "COMPLETED" : "KNOCKOUT_STAGE" });
        return manager;
    }
    async getAllPlayers() { return await dao.getAllPlayers(); }
    async getTournamentPlayers(tournamentId) {
        if (!await dao.getTournament(tournamentId)) throw new Error("Tournament not found.");
        return await dao.getPlayers(tournamentId);
    }
    async startTournament(tournamentId) {
        const tournament = await dao.getTournament(tournamentId);
        if (!tournament) throw new Error("Tournament not found.");
        if (tournament.status !== "registration") throw new Error("Tournament has already started.");
        const players = await dao.getPlayers(tournamentId);
        if (players.length < 2) throw new Error("At least 2 players are required.");
        const manager = new TournamentManager(players.length);
        const stage = manager.start(players.map(p => p.id));
        this.tournaments.set(tournamentId, manager);
        if (manager.status === "GROUP_STAGE") {
            await dao.createGroupMembers(tournamentId, manager.getGroupMap());
            await dao.saveGroupFixtures(tournamentId, stage.fixtures);
            await dao.updateTournamentStatus(tournamentId, "group_stage");
        } else {
            await dao.saveKnockoutFixtures(tournamentId, stage.getCurrentFixtures());
            await dao.updateTournamentStatus(tournamentId, "knockout");
            manager.status = "KNOCKOUT_STAGE";
        }
        return manager.getSummary();
    }
    async getManager(tournamentId) { return this.tournaments.get(tournamentId) || await this.loadTournament(tournamentId); }
    async recordGroupMatch(tournamentId, results) {
        const tournament = await dao.getTournament(tournamentId);
        if (!tournament) throw new Error("Tournament not found.");
        if (tournament.status === "completed") throw new Error("Cannot modify matches in a completed tournament.");

        const manager = await this.getManager(tournamentId);
        if (manager.status !== "GROUP_STAGE") throw new Error("Tournament is not in group stage.");
        const matchResults = Array.isArray(results) ? results : [results];
        const recordedFixtures = [];
        for (const res of matchResults) {
            if (!res.fixtureId || res.homeGoals === undefined || res.awayGoals === undefined) throw new Error("Fixture ID and scores are required.");
            const [hG, aG] = [Number(res.homeGoals), Number(res.awayGoals)];
            if (!Number.isInteger(hG) || !Number.isInteger(aG) || hG < 0 || aG < 0) throw new Error("Scores must be valid non-negative numbers.");
            const fixture = manager.recordGroupMatch(res.fixtureId, hG, aG);
            if (!fixture) throw new Error(`Fixture ${res.fixtureId} not found.`);
            await dao.updateGroupMatch(tournamentId, fixture, res.screenshotPath || null);
            recordedFixtures.push(fixture);
        }
        await dao.updateGroupStandings(tournamentId, manager.getAllStandings());
        return recordedFixtures;
    }
    async advanceToKnockouts(tournamentId) {
        const tournament = await dao.getTournament(tournamentId);
        if (!tournament) throw new Error("Tournament not found.");
        if (tournament.status !== "group_stage") throw new Error("Tournament is not in group stage.");
        const manager = await this.getManager(tournamentId);
        const fixtures= manager.advanceToKnockouts();
        
        if (!fixtures || !fixtures.length) throw new Error("Failed to generate knockout fixtures.");
        await dao.saveKnockoutFixtures(tournamentId, fixtures);
        await dao.updateTournamentStatus(tournamentId, "knockout");
        manager.status="KNOCKOUT_STAGE";
        return fixtures;
    }
    async recordKnockoutMatch(tournamentId, results) {
        const tournament = await dao.getTournament(tournamentId);
        if (!tournament) throw new Error("Tournament not found.");
        if (tournament.status === "completed") throw new Error("Cannot modify matches in a completed tournament.");
        const manager = await this.getManager(tournamentId);
        if (manager.status !== "KNOCKOUT_STAGE") throw new Error("Tournament is not in knockout stage.");
        const knockout = manager.knockoutStage;
        const matchResults = Array.isArray(results) ? results : [results];
        const recordedFixtures = [];
        for (const res of matchResults) {
            const fixture = knockout.recordMatch(res.fixtureId, res.p1Goals, res.p2Goals, res.penaltyWinnerId || null);
            await dao.updateKnockoutMatch(tournamentId, fixture, res.screenshotPath || null);
            recordedFixtures.push(fixture);
        }
        
        return recordedFixtures;
    }
    async advanceKnockoutRound(tournamentId) {
        const manager = await this.getManager(tournamentId);
        const result = manager.knockoutStage.advanceRound();
        if (result.status === "FINISHED") {
            await dao.updateTournamentStatus(tournamentId, "completed");
            manager.status = "COMPLETED";
            return result;
        }
        await dao.saveKnockoutFixtures(tournamentId, result.fixtures);
        await dao.updateTournamentStatus(tournamentId, "knockout");
        this.tournaments.delete(tournamentId);
        return result;
    }
    async getTournament(tournamentId) {
        const tournament = await dao.getTournament(tournamentId);
        if (!tournament) throw new Error("Tournament not found.");
        
        // Fetch matches, players, manager, and overrides concurrently
        const [matches, players, manager, overrides] = await Promise.all([
            dao.getMatches(tournamentId), 
            dao.getPlayers(tournamentId), 
            this.getManager(tournamentId),
            dao.getMatchOverrides(tournamentId) // <-- Added this
        ]);

        const overrideMap = {};
        for (const ov of overrides) {
            if (!overrideMap[ov.fixture_code]) overrideMap[ov.fixture_code] = [];
            overrideMap[ov.fixture_code].push(ov);
        }

        // Attach overrides array to each match
        const enrichedMatches = matches.map(m => ({
            ...m,
            overrides: overrideMap[m.fixture_code] || []
        }));

        let standings = manager.status === "GROUP_STAGE" ? 
            (manager.groupStage || await this.restoreGroupStage(tournamentId, manager), manager.getAllStandings().map(r => ({ ...r, username: players.find(p => Number(p.id) === Number(r.id))?.username || `Player ${r.id}` }))) : 
            await dao.getGroupStandings(tournamentId);

        return { tournament, standings, matches: enrichedMatches, totalPlayers: players.length, advanceCount: manager.advanceCount };
    }
    async getAllTournaments() { return await dao.getAllTournaments(); }
    async getLiveSummary(tournamentId) { return (await this.getManager(tournamentId)).getSummary(); }
    async deleteTournament(tournamentId) {
        if (!await dao.getTournament(tournamentId)) throw new Error("Tournament not found.");
        this.tournaments.delete(tournamentId);
        return await dao.deleteTournament(tournamentId);
    }
    async deletePlayer(playerId) {
        if (!await dao.getPlayer(playerId)) throw new Error("Player not found.");
        return await dao.deletePlayer(playerId);
    }
   async adminCorrectMatchResult(tournamentId, fixtureId, { homeGoals, awayGoals, screenshotPath }) {
        const tournament = await dao.getTournament(tournamentId);
        if (!tournament) throw new Error("Tournament not found.");
        if (tournament.status === "completed") throw new Error("Cannot modify matches in a completed tournament.");
        
        const allMatches = await dao.getMatches(tournamentId);
        const targetMatch = allMatches.find(m => m.fixture_code === fixtureId || m.id == fixtureId);
        if (!targetMatch) throw new Error("Fixture not found.");
        
        if (targetMatch.stage === "group" && tournament.status !== "group_stage") {
            throw new Error("Cannot edit group stage matches after the tournament has moved to knockouts.");
        }
        if (targetMatch.stage === "knockout") {
            const knockoutMatches = allMatches.filter(m => m.stage === "knockout");
            
            const finalMatch = knockoutMatches.find(m => m.round_name && m.round_name.toLowerCase().includes("final") && !m.round_name.toLowerCase().includes("semi") && !m.round_name.toLowerCase().includes("quarter") && !m.round_name.toLowerCase().includes("16"));
            if (finalMatch && finalMatch.status === "completed") {
                throw new Error("Cannot modify matches after the tournament final has been completed.");
            }

            // Get unique rounds in chronological order
            const uniqueRounds = [...new Set(knockoutMatches.map(m => m.round_name))];
            const targetRoundIndex = uniqueRounds.findIndex(r => r.toLowerCase() === targetMatch.round_name.toLowerCase());
            
            // Find highest round index that has ANY matches generated (scheduled or completed)
            let currentActiveRoundIndex = 0;
            uniqueRounds.forEach((rName, idx) => {
                const rMatches = knockoutMatches.filter(m => m.round_name === rName);
                if (rMatches.length > 0) {
                    currentActiveRoundIndex = idx;
                }
            });

            // If the stage has advanced to a higher round, block modification of previous rounds
            if (targetRoundIndex < currentActiveRoundIndex) {
                throw new Error(`Cannot modify ${targetMatch.round_name} results because the tournament has already advanced to ${uniqueRounds[currentActiveRoundIndex]}.`);
            }
        }
        // 1. Direct update in DAO
        const success = await dao.adminOverrideMatch(tournamentId, fixtureId, homeGoals, awayGoals, screenshotPath);
        if (!success) throw new Error("Fixture not found.");

        // 2. Clear cache to force a fresh reload from DB
        this.tournaments.delete(tournamentId);
        
        // 3. Reload manager and recalculate standings if group stage
       
        const manager = await this.getManager(tournamentId);
        if (tournament.status === "group_stage" && manager.groupStage) {
            const matches = await dao.getMatches(tournamentId, "group");
            
            manager.groupStage.initializeStandings();
            for (const m of matches) {
                if (m.status === "completed" && m.player_1_score !== null && m.player_2_score !== null) {
                    const home = manager.groupStage.standings[String(m.player_1_id)];
                    const away = manager.groupStage.standings[String(m.player_2_id)];
                    if (home && away) {
                        home.played++; away.played++;
                        home.goalsFor += m.player_1_score; home.goalsAgainst += m.player_2_score;
                        away.goalsFor += m.player_2_score; away.goalsAgainst += m.player_1_score;
                        home.goalDifference = home.goalsFor - home.goalsAgainst;
                        away.goalDifference = away.goalsFor - away.goalsAgainst;
                        if (m.player_1_score > m.player_2_score) {
                            home.wins++; home.points += 3; away.losses++;
                        } else if (m.player_1_score < m.player_2_score) {
                            away.wins++; away.points += 3; home.losses++;
                        } else {
                            home.draws++; home.points += 1; away.draws++; away.points += 1;
                        }
                    }
                } 
            }
            await dao.updateGroupStandings(tournamentId, manager.getAllStandings());
        }

        return { fixtureId, homeGoals, awayGoals, status: "CORRECTED" };
    }
    async verifyMatchParticipant(tournamentId, fixtureId, userId, stage) {
        const fixture = (await dao.getMatches(tournamentId, stage)).find(m => m.fixture_code === fixtureId || m.id === fixtureId);
        if (!fixture) throw new Error("Fixture not found.");
        return Number(fixture.player_1_id) === Number(userId) || Number(fixture.player_2_id) === Number(userId);
    }
}
module.exports = new TournamentService();