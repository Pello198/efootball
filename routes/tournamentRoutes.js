const express = require("express");
const router = express.Router();
const multer = require('multer');
const path = require('path');
const tournamentService = require("../tournamentService");
const PlayerStatsService = require("../playerStatsService");
const { verifyToken, verifyAdmin } = require("../middleware/auth");
const dao = require("../tournamentDao");
const upload = multer({ storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads/')),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
})});
// --- PUBLIC VIEW ROUTES ---
router.get("/", async (req, res) => {
    try {
        const tournaments = await tournamentService.getAllTournaments();
        res.json({ success: true, totalTournaments: tournaments.length, tournaments });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
router.get("/players/all", async (req, res) => {
    try {
        const players = await tournamentService.getAllPlayers();
        res.json({ success: true, totalPlayers: players.length, players });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
router.get("/:tournamentId", async (req, res) => {
    try {
        const tournament = await tournamentService.getTournament(Number(req.params.tournamentId));
        res.json({ success: true, ...tournament });
    } catch (error) { res.status(404).json({ success: false, message: error.message }); }
});
router.get("/:tournamentId/players", async (req, res) => {
    try {
        const players = await tournamentService.getTournamentPlayers(Number(req.params.tournamentId));
        res.json({ success: true, totalPlayers: players.length, players });
    } catch (error) { res.status(404).json({ success: false, message: error.message }); }
});
router.get("/:tournamentId/summary", async (req, res) => {
    try {
        const summary = await tournamentService.getLiveSummary(Number(req.params.tournamentId));
        res.json({ success: true, summary });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
router.get("/:tournamentId/players/:playerId/stats", async (req, res) => {
    try {
        const data = await PlayerStatsService.getPlayerOverallStats(Number(req.params.tournamentId), Number(req.params.playerId));
        res.status(200).json({ success: true, data });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
router.get("/players/:playerId/stats", async (req, res) => {
    try {
        const data = await PlayerStatsService.getPlayerOverallStats(null, Number(req.params.playerId));
        res.status(200).json({ success: true, data });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
// --- PUBLIC REGISTRATION / CREATION ROUTES ---
router.post("/players", upload.single("avatar"),async (req, res) => {
    try {
        const {username,number, password}= req.body;
        const avatarPath = req.file ? `/uploads/${req.file.filename}` : null;
        const players = await tournamentService.createPlayer({username,number,password,avatar:avatarPath});
        res.status(201).json({ success: true, players });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
router.post("/:tournamentId/players", async (req, res) => {
    try {
        const { playerIds } = req.body;
        const ids = Array.isArray(playerIds) ? playerIds.map(Number) : Number(playerIds);
        const registrations = await tournamentService.registerPlayer(Number(req.params.tournamentId), ids);
        res.status(201).json({ success: true, registrations });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
// --- ADMIN ONLY MANAGEMENT ROUTES ---
router.post("/", verifyAdmin, async (req, res) => {
    try {
        const { name, maxPlayers } = req.body;
        const tournament = await tournamentService.createTournament(name, maxPlayers);
        res.status(201).json({ success: true, tournament });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
router.post("/:tournamentId/start", verifyAdmin, async (req, res) => {
    try {
        const tournament = await tournamentService.startTournament(Number(req.params.tournamentId));
        res.status(200).json({ success: true, tournament });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
router.post("/:tournamentId/advance", verifyAdmin, async (req, res) => {
    try {
        const fixtures = await tournamentService.advanceToKnockouts(Number(req.params.tournamentId));
        res.json({ success: true, fixtures });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
router.delete("/:tournamentId", verifyAdmin, async (req, res) => {
    try {
        await tournamentService.deleteTournament(Number(req.params.tournamentId));
        res.json({ success: true, message: "Tournament deleted successfully." });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
router.delete("/:tournamentId/players/:playerId", verifyAdmin, async (req, res) => {
    try {
        await tournamentService.removePlayerFromTournament(Number(req.params.tournamentId), Number(req.params.playerId));
        res.json({ success: true, message: "Player removed from tournament successfully." });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
router.delete("/players/:playerId", verifyAdmin, async (req, res) => {
    try {
        await tournamentService.deletePlayer(Number(req.params.playerId));
        res.json({ success: true, message: "Player deleted successfully." });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
// --- MATCH UPDATE ROUTES (Admin or Participating Player) ---
router.patch("/:tournamentId/group/matches/:fixtureId", verifyToken, upload.single("screenshot"), async (req, res) => {
    try {
        const { id: userId, role: userRole } = req.user;
        const tournamentId = Number(req.params.tournamentId);
        const fixtureId = req.params.fixtureId;
        if (userRole !== 'admin' && !await tournamentService.verifyMatchParticipant(tournamentId, fixtureId, userId, 'group')) {
            return res.status(403).json({ success: false, message: "Access denied. You can only update matches you participated in." });
        }
        const screenshotPath = req.file ? `/uploads/${req.file.filename}` : null;
        const fixture = await tournamentService.recordGroupMatch(tournamentId, { fixtureId, homeGoals: Number(req.body.homeGoals), awayGoals: Number(req.body.awayGoals), screenshotPath });
        res.json({ success: true, fixture: fixture[0] });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
router.patch("/:tournamentId/knockout/matches/:fixtureId", verifyToken, upload.single("screenshot"), async (req, res) => {
    try {
        const { id: userId, role: userRole } = req.user;
        const tournamentId = Number(req.params.tournamentId);
        const fixtureId = req.params.fixtureId;
        if (userRole !== 'admin' && !await tournamentService.verifyMatchParticipant(tournamentId, fixtureId, userId, 'knockout')) {
            return res.status(403).json({ success: false, message: "Access denied. You can only update knockout matches you participated in." });
        }
        const screenshotPath = req.file ? `/uploads/${req.file.filename}` : null;
        const fixture = await tournamentService.recordKnockoutMatch(tournamentId, {
            fixtureId, p1Goals: Number(req.body.p1Goals), p2Goals: Number(req.body.p2Goals), screenshotPath,
            penaltyWinnerId: req.body.penaltyWinnerId ? Number(req.body.penaltyWinnerId) : null
        });
        res.json({ success: true, fixture: fixture[0] });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
router.post("/:tournamentId/knockout/advance", verifyAdmin, async (req, res) => {
    try {
        const result = await tournamentService.advanceKnockoutRound(Number(req.params.tournamentId));
        res.json({ success: true, ...result });
    } catch (error) { 
        res.status(400).json({ success: false, message: error.message }); 
    }
});
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: "Username and password are required." });
        const result = await dao.loginPlayer(username, password);
        res.status(200).json({ success: true, token: result.token, user: result.user });
    } catch (error) { res.status(401).json({ success: false, message: error.message }); }
});
// --- ADMIN MATCH OVERRIDE ROUTE ---
router.patch("/:tournamentId/admin/matches/:fixtureId", verifyAdmin, upload.single("screenshot"), async (req, res) => {
    try {
        const tournamentId = Number(req.params.tournamentId);
        const fixtureId = req.params.fixtureId;
        const homeGoals = Number(req.body.homeGoals);
        const awayGoals = Number(req.body.awayGoals);
        const screenshotPath = req.file ? `/uploads/${req.file.filename}` : null;

        const result = await tournamentService.adminCorrectMatchResult(tournamentId, fixtureId, {
            homeGoals,
            awayGoals,
            screenshotPath
        });

        res.json({ success: true, ...result });
    } catch (error) { 
        res.status(400).json({ success: false, message: error.message }); 
    }
});
module.exports = router;