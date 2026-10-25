const db = require("./db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./middleware/auth");
db.query("SELECT 1")
    .then(() => console.log("Connected to SQL Database."))
    .catch(err => { console.error("SQL Database connection failed:", err.message); process.exit(1); });
class TournamentDAO {
    async createTournament(name, maxPlayers = 20) {
        const [result] = await db.query(`INSERT INTO tournaments (name, max_players) VALUES (?, ?)`, [name, maxPlayers]);
        return { id: result.insertId, name, maxPlayers };
    }
    async createPlayer(username, number, password, avatar) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.query(`INSERT INTO players (username, number, password, avatar, role) VALUES (?, ?, ?, ?, 'user')`, [username, number || null, hashedPassword, avatar || null]);
        return { id: result.insertId, username, role: 'user' };
    }
    async loginPlayer(username, password) {
        const [rows] = await db.query(`SELECT * FROM players WHERE username = ?`, [username]);
        const user = rows[0];
        if (!user || !(await bcrypt.compare(password, user.password))) throw new Error("Invalid username or password.");
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        return { token, user: { id: user.id, username: user.username, role: user.role } };
    }
    async getPlayer(playerId) {
        const [rows] = await db.query(`SELECT * FROM players WHERE id = ?`, [playerId]);
        return rows[0] || null;
    }
    async registerPlayer(tournamentId, playerId) {
        await db.query(`INSERT INTO tournament_players (tournament_id, player_id) VALUES (?, ?)`, [tournamentId, playerId]);
        return { tournamentId, playerId };
    }
    async getAllPlayers() {
        const [rows] = await db.query(`SELECT * FROM players ORDER BY id`);
        return rows;
    }
    async getPlayers(tournamentId) {
        const [rows] = await db.query(`SELECT p.* FROM players p JOIN tournament_players tp ON p.id = tp.player_id WHERE tp.tournament_id = ?`, [tournamentId]);
        return rows;
    }
    async getTournament(tournamentId) {
        const [rows] = await db.query(`SELECT * FROM tournaments WHERE id = ?`, [tournamentId]);
        return rows[0] || null;
    }
    async getAllTournaments() {
        const [rows] = await db.query(`SELECT * FROM tournaments ORDER BY created_at DESC`);
        return rows;
    }
    async getGroupMembers(tournamentId, groupLetter = null) {
        let sql = `SELECT gm.player_id, p.username, gm.group_letter, gm.matches_played, gm.wins, gm.draws, gm.losses, gm.goals_for, gm.goals_against, gm.goal_difference, gm.points FROM group_members gm JOIN players p ON p.id = gm.player_id WHERE gm.tournament_id = ?`;
        const params = [tournamentId];
        if (groupLetter) { sql += ` AND gm.group_letter = ?`; params.push(groupLetter); }
        sql += ` ORDER BY gm.group_letter, gm.points DESC, gm.goal_difference DESC, gm.goals_for DESC, gm.player_id ASC`;
        const [rows] = await db.query(sql, params);
        return rows;
    }
    async removePlayerFromTournament(tournamentId, playerId) {
        await db.query(`DELETE FROM group_members WHERE tournament_id = ? AND player_id = ?`, [tournamentId, playerId]);
        const [result] = await db.query(`DELETE FROM tournament_players WHERE tournament_id = ? AND player_id = ?`, [tournamentId, playerId]);
        return result.affectedRows > 0;
    }
    async getTournamentPlayers(tournamentId) {
        const [rows] = await db.query(`SELECT p.* FROM players p JOIN matches m ON p.id = m.player_1_id OR p.id = m.player_2_id WHERE m.tournament_id = ? UNION SELECT p.* FROM players p JOIN group_members gm ON gm.player_id = p.id WHERE gm.tournament_id = ?`, [tournamentId, tournamentId]);
        return rows;
    }
    async createGroupMembers(tournamentId, groupMap) {
        const values = Object.entries(groupMap).flatMap(([group, players]) => players.map(playerId => [tournamentId, playerId, group]));
        if (values.length) await db.query(`INSERT INTO group_members (tournament_id, player_id, group_letter) VALUES ?`, [values]);
    }
    async saveGroupFixtures(tournamentId, fixtures) {
        if (!fixtures.length) return;
        const values = fixtures.map(f => [tournamentId, "group", f.round, f.group, f.home, f.away, f.id, "scheduled"]);
        await db.query(`INSERT INTO matches (tournament_id, stage, round_number, group_letter, player_1_id, player_2_id, fixture_code, status) VALUES ?`, [values]);
    }
    async updateGroupMatch(tournamentId, fixture, screenshotPath = null) {
        await db.query(`UPDATE matches SET player_1_score = ?, player_2_score = ?, result_screenshot = ?, status = 'completed' WHERE tournament_id = ? AND fixture_code = ?`, [fixture.homeGoals, fixture.awayGoals, screenshotPath, tournamentId, fixture.id]);
    }
    async updateGroupStandings(tournamentId, standings) {
        if (!Array.isArray(standings)) return;
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            for (const player of standings) {
                if (!player) continue;
                const playerId = player.id ?? player.player_id;
                if (!playerId) continue;
                await connection.query(`UPDATE group_members SET matches_played = ?, wins = ?, draws = ?, losses = ?, goals_for = ?, goals_against = ?, goal_difference = ?, points = ? WHERE tournament_id = ? AND player_id = ?`, [
                    player.played ?? player.matches_played ?? 0, player.wins ?? 0, player.draws ?? 0, player.losses ?? 0,
                    player.goalsFor ?? player.goals_for ?? 0, player.goalsAgainst ?? player.goals_against ?? 0, player.goalDifference ?? player.goal_difference ?? 0, player.points ?? 0,
                    tournamentId, playerId
                ]);
            }
            await connection.commit();
        } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    }
    async saveKnockoutFixtures(tournamentId, fixtures) {
        if (!fixtures.length) return;
        const values = fixtures.map(f => [tournamentId, "knockout", f.roundName, f.p1Id, f.p2Id, f.id, "scheduled"]);
        await db.query(`INSERT INTO matches (tournament_id, stage, round_name, player_1_id, player_2_id, fixture_code, status) VALUES ?`, [values]);
    }
    async updateKnockoutMatch(tournamentId, fixture, screenshotPath = null) {
        await db.query(`UPDATE matches SET player_1_score = ?, player_2_score = ?, winner_id = ?, result_screenshot = ?, status = 'completed' WHERE tournament_id = ? AND fixture_code = ?`, [fixture.p1Goals, fixture.p2Goals, fixture.winnerId, screenshotPath, tournamentId, fixture.id]);
    }
    async updateTournamentStatus(tournamentId, status) {
        await db.query(`UPDATE tournaments SET status = ? WHERE id = ?`, [status, tournamentId]);
    }
    async getMatches(tournamentId, stage = null) {
        let sql = `SELECT m.*, p1.username AS player_1_name, p2.username AS player_2_name FROM matches m LEFT JOIN players p1 ON m.player_1_id = p1.id LEFT JOIN players p2 ON m.player_2_id = p2.id WHERE m.tournament_id = ?`;
        const params = [tournamentId];
        if (stage) { sql += ` AND m.stage = ?`; params.push(stage); }
        sql += ` ORDER BY m.stage, m.round_number, m.id`;
        const [rows] = await db.query(sql, params);
        return rows;
    }
    async getGroupStandings(tournamentId) {
        const [rows] = await db.query(`SELECT gm.*, p.username FROM group_members gm JOIN players p ON p.id = gm.player_id WHERE gm.tournament_id = ? ORDER BY gm.group_letter, gm.points DESC, gm.goal_difference DESC, gm.goals_for DESC`, [tournamentId]);
        return rows;
    }
    async getPlayerMatches(tournamentId, playerId) {
        const [rows] = await db.query(
            `SELECT m.*, p1.username AS player_1_name,
             p2.username AS player_2_name FROM matches m 
             LEFT JOIN players p1 ON m.player_1_id = p1.id
            LEFT JOIN players p2 ON m.player_2_id = p2.id
             WHERE m.tournament_id = ? AND (m.player_1_id = ? OR m.player_2_id = ?)
              ORDER BY m.round_number ASC, m.id ASC`, [tournamentId, playerId, playerId]);
      if(!rows.length) return rows;
      const [overrides] = await db.query(
            `SELECT fixture_code, previous_p1_score, previous_p2_score, new_p1_score, new_p2_score, created_at 
             FROM match_overrides WHERE tournament_id = ?`,
            [tournamentId]
        );

        const overrideMap = {};
        for (const ov of overrides) {
            if (!overrideMap[ov.fixture_code]) overrideMap[ov.fixture_code] = [];
            overrideMap[ov.fixture_code].push(ov);
        }return rows.map(m => ({
            ...m,
            overrides: overrideMap[m.fixture_code] || []
        }));
    }
    async isPlayerRegistered(tournamentId, playerId) {
        const [rows] = await db.execute(`SELECT 1 FROM group_members WHERE tournament_id = ? AND player_id = ? LIMIT 1`, [tournamentId, playerId]);
        return rows.length > 0;
    }
    async getPlayerCareerMatches(playerId) {
        const [rows] = await db.query(`SELECT m.*, p1.username AS player_1_name, p2.username AS player_2_name, t.name AS tournament_name FROM matches m LEFT JOIN players p1 ON m.player_1_id = p1.id LEFT JOIN players p2 ON m.player_2_id = p2.id LEFT JOIN tournaments t ON m.tournament_id = t.id WHERE m.player_1_id = ? OR m.player_2_id = ? ORDER BY m.tournament_id DESC, m.round_number ASC, m.id ASC`, [playerId, playerId]);
        if (!rows.length) return rows;

        // Fetch all overrides across all tournaments for this player's matches
        const [overrides] = await db.query(
            `SELECT tournament_id, fixture_code, previous_p1_score, previous_p2_score, new_p1_score, new_p2_score, created_at 
             FROM match_overrides`
        );

        const overrideMap = {};
        for (const ov of overrides) {
            const key = `${ov.tournament_id}-${ov.fixture_code}`;
            if (!overrideMap[key]) overrideMap[key] = [];
            overrideMap[key].push(ov);
        }

        return rows.map(m => ({
            ...m,
            overrides: overrideMap[`${m.tournament_id}-${m.fixture_code}`] || []
        }));
    }
    async getGroupPlayer(tournamentId, playerId) {
        const [rows] = await db.query(`SELECT p.id, p.username, p.number, gm.group_letter FROM players p INNER JOIN group_members gm ON gm.player_id = p.id WHERE gm.tournament_id = ? AND gm.player_id = ?`, [tournamentId, playerId]);
        return rows[0] || null;
    }
    async getGroupMatches(tournamentId, playerId) {
        const [rows] = await db.query(`SELECT m.*, p1.username AS player_1_name, p2.username AS player_2_name FROM matches m LEFT JOIN players p1 ON m.player_1_id = p1.id LEFT JOIN players p2 ON m.player_2_id = p2.id WHERE m.tournament_id = ? AND m.stage = 'group' AND (m.player_1_id = ? OR m.player_2_id = ?) ORDER BY m.round_number ASC, m.id ASC`, [tournamentId, playerId, playerId]);
        return rows;
    }
    async getKnockoutMatches(tournamentId, playerId) {
        const [rows] = await db.query(`SELECT m.*, p1.username AS player_1_name, p2.username AS player_2_name FROM matches m LEFT JOIN players p1 ON m.player_1_id = p1.id LEFT JOIN players p2 ON m.player_2_id = p2.id WHERE m.tournament_id = ? AND m.stage = 'knockout' AND (m.player_1_id = ? OR m.player_2_id = ?) ORDER BY m.round_number ASC, m.id ASC`, [tournamentId, playerId, playerId]);
        return rows;
    }
    async deleteTournament(tournamentId) {
        await db.query(`DELETE FROM matches WHERE tournament_id = ?`, [tournamentId]);
        await db.query(`DELETE FROM group_members WHERE tournament_id = ?`, [tournamentId]);
        await db.query(`DELETE FROM tournament_players WHERE tournament_id = ?`, [tournamentId]);
        const [result] = await db.query(`DELETE FROM tournaments WHERE id = ?`, [tournamentId]);
        return result.affectedRows > 0;
    }
    async deletePlayer(playerId) {
        await db.query(`DELETE FROM tournament_players WHERE player_id = ?`, [playerId]);
        await db.query(`DELETE FROM group_members WHERE player_id = ?`, [playerId]);
        const [result] = await db.query(`DELETE FROM players WHERE id = ?`, [playerId]);
        return result.affectedRows > 0;
    }

   async adminOverrideMatch(tournamentId, fixtureId, homeGoals, awayGoals, screenshotPath, adminUsername = 'Admin') {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Fetch current match state for fallback logging
        const [rows] = await connection.query(
            `SELECT player_1_score, player_2_score, stage, player_1_id, player_2_id FROM matches WHERE tournament_id = ? AND fixture_code = ?`, 
            [tournamentId, fixtureId]
        );
        if (!rows.length) throw new Error("Fixture not found.");
        const currentMatch = rows[0];

        // 2. Save previous result to match_overrides table as a backup/fallback
        await connection.query(
            `INSERT INTO match_overrides (tournament_id, fixture_code, previous_p1_score, previous_p2_score, new_p1_score, new_p2_score, overridden_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [tournamentId, fixtureId, currentMatch.player_1_score, currentMatch.player_2_score, homeGoals, awayGoals, adminUsername]
        );

        
        let winnerId = null;
        if (currentMatch.stage === 'knockout'||currentMatch.stage === 'group') {
            if (homeGoals > awayGoals) winnerId = currentMatch.player_1_id;
            else if (awayGoals > homeGoals) winnerId = currentMatch.player_2_id;
        }

       
        await connection.query(
            `UPDATE matches SET player_1_score = ?, player_2_score = ?, winner_id = COALESCE(?, winner_id), 
             result_screenshot = COALESCE(?, result_screenshot), status = 'completed' WHERE tournament_id = ? AND fixture_code = ?`,
            [homeGoals, awayGoals, winnerId, screenshotPath, tournamentId, fixtureId]
        );

        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}
async getMatchOverrides(tournamentId) {
    const [rows] = await db.query(
        `SELECT fixture_code, previous_p1_score, previous_p2_score, new_p1_score, new_p2_score, created_at 
         FROM match_overrides 
         WHERE tournament_id = ? 
         ORDER BY created_at ASC`,
        [tournamentId]
    );
    return rows;
}
}
module.exports = new TournamentDAO();