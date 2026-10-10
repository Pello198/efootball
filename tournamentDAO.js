const db = require("./db");
db.query("SELECT 1")
    .then(() => {
        console.log("Connected to SQL Database.");
    })
    .catch((err) => {
        console.error(" SQL Database connection failed:", err.message);
        process.exit(1);
    });
class TournamentDAO {
     async createTournament(name, maxPlayers = 20) {
        const [result] = await db.query(`
            INSERT INTO tournaments (name, max_players)
            VALUES (?, ?)
        `, [name, maxPlayers]);
        return {
            id: result.insertId,
            name,
            maxPlayers
        };
    }
    async createPlayer(username, number = null) {
        const [result] = await db.query(`
            INSERT INTO players (username, number)
            VALUES (?, ?)
        `, [username, number]);
        return {
            id: result.insertId,
            username,
            number
        };
    }
    async getPlayer(playerId) {
        const [rows] = await db.query(`SELECT * FROM players
            WHERE id = ?
        `, [playerId]);
        return rows[0] || null;
    }
    async registerPlayer(tournamentId, playerId) {
        await db.query(`
            INSERT INTO tournament_players
            (tournament_id, player_id)
            VALUES (?, ?)
        `, [tournamentId, playerId]);
        return {
            tournamentId,
            playerId
        };
    }
    async getAllPlayers() {
    const [rows] = await db.query(`
        SELECT *
        FROM players
        ORDER BY id
    `);
    return rows;
}
    async getPlayers(tournamentId) {
        const [rows] = await db.query(`
            SELECT p.*
            FROM players p
            JOIN tournament_players tp
                ON p.id = tp.player_id
            WHERE tp.tournament_id = ?
        `, [tournamentId]);
        return rows;
    }
    async getTournament(tournamentId) {
        const [rows] = await db.query(
            `SELECT * FROM tournaments WHERE id = ?`,
            [tournamentId]
        );
        return rows[0] || null;
    }
    async getAllTournaments() {
    const [rows] = await db.query(`
        SELECT *
        FROM tournaments
        ORDER BY created_at DESC
    `);
    return rows;
}
async getGroupMembers(tournamentId, groupLetter = null) {
    let sql = `
        SELECT 
            gm.player_id,
            p.username,
            gm.group_letter,
            gm.matches_played,
            gm.wins,
            gm.draws,
            gm.losses,
            gm.goals_for,
            gm.goals_against,
            gm.goal_difference,
            gm.points
        FROM group_members gm
        JOIN players p
            ON p.id = gm.player_id
        WHERE gm.tournament_id = ?
    `;
    const params = [tournamentId];
    if (groupLetter) {
        sql += ` AND gm.group_letter = ?`;
        params.push(groupLetter);
    }
    sql += `
        ORDER BY 
            gm.group_letter,
            gm.points DESC,
            gm.goal_difference DESC,
            gm.goals_for DESC,
            gm.player_id ASC
    `;
    const [rows] = await db.query(sql, params);
    return rows;
}
    async getTournamentPlayers(tournamentId) {
        const [rows] = await db.query(`
            SELECT p.*
            FROM players p
            JOIN matches m
                ON p.id = m.player_1_id
                OR p.id = m.player_2_id
            WHERE m.tournament_id = ?
            UNION
            SELECT p.*
            FROM players p
            JOIN group_members gm
                ON gm.player_id = p.id
            WHERE gm.tournament_id = ?
        `, [tournamentId, tournamentId]);
        return rows;
    }
    async createGroupMembers(tournamentId, groupMap) {
        // const values = [];
        for (const [group, players] of Object.entries(groupMap)) {
            for (const playerId of players) {
                values.push([
                    tournamentId,
                    playerId,
                    group
                ]);
            }
        }
        if (!values.length) return;
        await db.query(`
            INSERT INTO group_members
            (tournament_id, player_id, group_letter)
            VALUES ?
        `, [values]);
    }
    async saveGroupFixtures(tournamentId, fixtures) {
        if (!fixtures.length) return;
        const values = fixtures.map(f => [
            tournamentId,
            "group",
            f.round,
            f.group,
            f.home,
            f.away,
            f.id,
            "scheduled"
        ]);
        await db.query(`
            INSERT INTO matches (
                tournament_id,
                stage,
                round_number,
                group_letter,
                player_1_id,
                player_2_id,
                fixture_code,
                status
            )
            VALUES ?
        `, [values]);
    }
    async updateGroupMatch(tournamentId, fixture) {
        await db.query(`
            UPDATE matches
            SET
                player_1_score = ?,
                player_2_score = ?,
                status = 'completed'
            WHERE tournament_id = ?
            AND fixture_code = ?
        `, [
            fixture.homeGoals,
            fixture.awayGoals,
            tournamentId,
            fixture.id
        ]);
    }
    async updateGroupStandings(tournamentId, standings) {
    if (!Array.isArray(standings)) return;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        for (const player of standings) {
            // Guard clause: skip if player is undefined/null or missing an ID
            if (!player) continue;
            const playerId = player.id ?? player.player_id;
            if (!playerId) continue;
            await connection.query(`
                UPDATE group_members
                SET
                    matches_played = ?,
                    wins = ?,
                    draws = ?,
                    losses = ?,
                    goals_for = ?,
                    goals_against = ?,
                    goal_difference = ?,
                    points = ?
                WHERE tournament_id = ?
                AND player_id = ?
            `, [
                player.played ?? player.matches_played ?? 0,
                player.wins ?? 0,
                player.draws ?? 0,
                player.losses ?? 0,
                player.goalsFor ?? player.goals_for ?? 0,
                player.goalsAgainst ?? player.goals_against ?? 0,
                player.goalDifference ?? player.goal_difference ?? 0,
                player.points ?? 0,
                tournamentId,
                playerId
            ]);
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}
    async saveKnockoutFixtures(tournamentId, fixtures) {
        if (!fixtures.length) return;
        const values = fixtures.map(f => [
            tournamentId,
            "knockout",
            f.roundName,
            f.p1Id,
            f.p2Id,
            f.id,
            "scheduled"
        ]);
        await db.query(`
            INSERT INTO matches (
                tournament_id,
                stage,
                round_name,
                player_1_id,
                player_2_id,
                fixture_code,
                status
            )
            VALUES ?
        `, [values]);
    }
    async updateKnockoutMatch(tournamentId, fixture) {
        await db.query(`
            UPDATE matches
            SET
                player_1_score = ?,
                player_2_score = ?,
                winner_id = ?,
                status = 'completed'
            WHERE tournament_id = ?
            AND fixture_code = ?
        `, [
            fixture.p1Goals,
            fixture.p2Goals,
            fixture.winnerId,
            tournamentId,
            fixture.id
        ]);
    }
    async updateTournamentStatus(tournamentId, status) {
        await db.query(`
            UPDATE tournaments
            SET status = ?
            WHERE id = ?
        `, [status, tournamentId]);
    }
    async getMatches(tournamentId, stage = null) {
    let sql = `
        SELECT
            m.*,
            p1.username AS player_1_name,
            p2.username AS player_2_name
        FROM matches m
        LEFT JOIN players p1
            ON m.player_1_id = p1.id
        LEFT JOIN players p2
            ON m.player_2_id = p2.id
        WHERE m.tournament_id = ?
    `;
    const params = [tournamentId];
    if (stage) {
        sql += ` AND m.stage = ?`;
        params.push(stage);
    }
    sql += `
        ORDER BY
            m.stage,
            m.round_number,
            m.id
    `;
    const [rows] = await db.query(
        sql,
        params
    );
    return rows;
}
    async getGroupStandings(tournamentId) {
        const [rows] = await db.query(`
            SELECT
                gm.*,
                p.username
            FROM group_members gm
            JOIN players p
                ON p.id = gm.player_id
            WHERE gm.tournament_id = ?
            ORDER BY
                gm.group_letter,
                gm.points DESC,
                gm.goal_difference DESC,
                gm.goals_for DESC
        `, [tournamentId]);
        return rows;
    }
    async getPlayerMatches(tournamentId, playerId) {
    const [rows] = await db.query(
        `
        SELECT
            m.id,
            m.tournament_id,
            m.stage,
            m.round_number,
            m.cancellation_reason,
            m.group_letter,
            m.player_1_id,
            m.player_2_id,
            m.player_1_score,
            m.player_2_score,
            m.round_name,
            m.fixture_code,
            m.status,
            m.winner_id,
            p1.username AS player_1_name,
            p2.username AS player_2_name
        FROM matches m
        LEFT JOIN players p1
            ON m.player_1_id = p1.id
        LEFT JOIN players p2
            ON m.player_2_id = p2.id
        WHERE m.tournament_id = ?
        AND (
            m.player_1_id = ?
            OR m.player_2_id = ?
        )
        ORDER BY m.round_number ASC, m.id ASC
        `,
        [tournamentId, playerId, playerId]
    );
    return rows;
}
async isPlayerRegistered(tournamentId, playerId) {
    const [rows] = await db.execute(
        `
        SELECT 1
        FROM group_members
        WHERE tournament_id = ?
        AND player_id = ?
        LIMIT 1
        `,
        [tournamentId, playerId]
    );
    return rows.length > 0;
}
// tournamentDAO_2.js
async getPlayerCareerMatches(playerId) {
    const [rows] = await db.query(
        `
        SELECT
            m.id,
            m.tournament_id,
            m.stage,
            m.round_number,
            m.cancellation_reason,
            m.group_letter,
            m.player_1_id,
            m.player_2_id,
            m.player_1_score,
            m.player_2_score,
            m.round_name,
            m.fixture_code,
            m.status,
            m.winner_id,
            p1.username AS player_1_name,
            p2.username AS player_2_name,
            t.name AS tournament_name
        FROM matches m
        LEFT JOIN players p1 ON m.player_1_id = p1.id
        LEFT JOIN players p2 ON m.player_2_id = p2.id
        LEFT JOIN tournaments t ON m.tournament_id = t.id
        WHERE m.player_1_id = ? OR m.player_2_id = ?
        ORDER BY m.tournament_id DESC, m.round_number ASC, m.id ASC
        `,
        [playerId, playerId]
    );
    return rows;
}
async getGroupPlayer(tournamentId, playerId) {
    const [rows] = await db.query(
        `
        SELECT
            p.id,
            p.username,
            p.number,
            gm.group_letter
        FROM players p
        INNER JOIN group_members gm
            ON gm.player_id = p.id
        WHERE gm.tournament_id = ?
        AND gm.player_id = ?
        `,
        [tournamentId, playerId]
    );
    return rows[0] || null;
}
async getGroupMatches(tournamentId, playerId) {
    const [rows] = await db.query(
        `
        SELECT
            m.id,
            m.tournament_id,
            m.stage,
            m.round_number,
            m.cancellation_reason,
            m.group_letter,
            m.player_1_id,
            m.player_2_id,
            m.player_1_score,
            m.player_2_score,
            m.round_name,
            m.fixture_code,
            m.status,
            m.winner_id,
            p1.username AS player_1_name,
            p2.username AS player_2_name
        FROM matches m
        LEFT JOIN players p1
            ON m.player_1_id = p1.id
        LEFT JOIN players p2
            ON m.player_2_id = p2.id
        WHERE m.tournament_id = ?
        AND m.stage = 'group'
        AND (
            m.player_1_id = ?
            OR m.player_2_id = ?
        )
        ORDER BY m.round_number ASC, m.id ASC
        `,
        [tournamentId, playerId, playerId]
    );
    return rows;
}
async getKnockoutMatches(tournamentId, playerId) {
    const [rows] = await db.query(
        `
        SELECT
            m.id,
            m.tournament_id,
            m.stage,
            m.round_number,
            m.cancellation_reason,
            m.group_letter,
            m.player_1_id,
            m.player_2_id,
            m.player_1_score,
            m.player_2_score,
            m.round_name,
            m.fixture_code,
            m.status,
            m.winner_id,
            p1.username AS player_1_name,
            p2.username AS player_2_name
        FROM matches m
        LEFT JOIN players p1
            ON m.player_1_id = p1.id
        LEFT JOIN players p2
            ON m.player_2_id = p2.id
        WHERE m.tournament_id = ?
        AND m.stage = 'knockout'
        AND (
            m.player_1_id = ?
            OR m.player_2_id = ?
        )
        ORDER BY m.round_number ASC, m.id ASC
        `,
        [tournamentId, playerId, playerId]
    );
    return rows;
}
}
module.exports = new TournamentDAO();