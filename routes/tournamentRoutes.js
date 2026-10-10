const express = require("express");
const router = express.Router();
const tournamentService = require("../tournamentService");
const PlayerStatsService = require("../playerStatsService");

router.post("/", async (req, res) => {
    try {
        const { name, maxPlayers } = req.body;
        const tournament = await tournamentService.createTournament(name, maxPlayers);
        res.status(201).json({
            success: true,
            tournament
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.post("/players", async (req, res) => {
    try {
        const players = await tournamentService.createPlayer(req.body);
        res.status(201).json({
            success: true,
            players
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.get("/players/all", async (req, res) => {
    try {
        const players = await tournamentService.getAllPlayers();
        res.json({
            success: true,
            totalPlayers: players.length,
            players
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.get("/", async (req, res) => {
    try {
        const tournaments = await tournamentService.getAllTournaments();
        res.json({
            success: true,
            totalTournaments: tournaments.length,
            tournaments
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.get("/:tournamentId/players", async (req, res) => {
    try {
        const players = await tournamentService.getTournamentPlayers(
            Number(req.params.tournamentId)
        );
        res.json({
            success: true,
            totalPlayers: players.length,
            players
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            message: error.message
        });
    }
});

router.post("/:tournamentId/start", async (req, res) => {
    try {
        const tournament = await tournamentService.startTournament(
            Number(req.params.tournamentId)
        );
        res.status(200).json({
            success: true,
            tournament
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.post("/:tournamentId/advance", async (req, res) => {
    try {
        const fixtures = await tournamentService.advanceToKnockouts(
            Number(req.params.tournamentId)
        );
        res.json({
            success: true,
            fixtures
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.post("/:tournamentId/knockout/advance", async (req, res) => {
    try {
        const result = await tournamentService.advanceKnockoutRound(
            Number(req.params.tournamentId)
        );
        res.json({
            success: true,
            result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.post("/:tournamentId/players", async (req, res) => {
    try {
        const { playerIds } = req.body;
        const ids = Array.isArray(playerIds)
            ? playerIds.map(Number)
            : Number(playerIds);
        const registrations = await tournamentService.registerPlayer(
            Number(req.params.tournamentId),
            ids
        );
        res.status(201).json({
            success: true,
            registrations
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.get("/:tournamentId", async (req, res) => {
    try {
        const tournament = await tournamentService.getTournament(
            Number(req.params.tournamentId)
        );
        res.json({
            success: true,
            ...tournament
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            message: error.message
        });
    }
});

router.get("/:tournamentId/players/:playerId/stats", async (req, res) => {
    try {
        const tournamentId = Number(req.params.tournamentId);
        const playerId = Number(req.params.playerId);
        const data = await PlayerStatsService.getPlayerOverallStats(
            tournamentId,
            playerId
        );
        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Fetch overall career stats across ALL tournaments for a player
router.get("/players/:playerId/stats", async (req, res) => {
    try {
        const playerId = Number(req.params.playerId);
        const data = await PlayerStatsService.getPlayerOverallStats(null, playerId);
        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.get("/:tournamentId/players/:playerId/stats/group", async (req, res) => {
    try {
        const { tournamentId, playerId } = req.params;
        const data = await PlayerStatsService.getPlayerGroupStageStats(
            tournamentId,
            playerId
        );
        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.get("/:tournamentId/players/:playerId/stats/knockout", async (req, res) => {
    try {
        const { tournamentId, playerId } = req.params;
        const data = await PlayerStatsService.getPlayerKnockoutStats(
            tournamentId,
            playerId
        );
        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.get("/:tournamentId/summary", async (req, res) => {
    try {
        const summary = await tournamentService.getLiveSummary(
            Number(req.params.tournamentId)
        );
        res.json({
            success: true,
            summary
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.patch("/:tournamentId/group/matches", async (req, res) => {
    try {
        const fixtures = await tournamentService.recordGroupMatch(
            Number(req.params.tournamentId),
            req.body
        );
        res.json({
            success: true,
            totalRecorded: fixtures.length,
            fixtures
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.patch("/:tournamentId/knockout/matches", async (req, res) => {
    try {
        const fixtures = await tournamentService.recordKnockoutMatch(
            Number(req.params.tournamentId),
            req.body
        );
        res.json({
            success: true,
            totalRecorded: fixtures.length,
            fixtures
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.patch("/:tournamentId/group/matches/:fixtureId", async (req, res) => {
    try {
        const fixture = await tournamentService.recordGroupMatch(
            Number(req.params.tournamentId),
            {
                fixtureId: req.params.fixtureId,
                homeGoals: Number(req.body.homeGoals),
                awayGoals: Number(req.body.awayGoals)
            }
        );
        res.json({
            success: true,
            fixture: fixture[0]
        });
    } catch (error) {
        console.error("GROUP RESULT ERROR:", error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.patch("/:tournamentId/knockout/matches/:fixtureId", async (req, res) => {
    try {
        const fixture = await tournamentService.recordKnockoutMatch(
            Number(req.params.tournamentId),
            {
                fixtureId: req.params.fixtureId,
                p1Goals: Number(req.body.p1Goals),
                p2Goals: Number(req.body.p2Goals),
                penaltyWinnerId: req.body.penaltyWinnerId
                    ? Number(req.body.penaltyWinnerId)
                    : null
            }
        );
        res.json({
            success: true,
            fixture: fixture[0]
        });
    } catch (error) {
        console.error("KNOCKOUT RESULT ERROR:", error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;