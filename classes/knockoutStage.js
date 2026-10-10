class KnockoutManager {
    constructor(qualifiers) {
        if (!Array.isArray(qualifiers)) throw new Error("Qualifiers must be an array.");
        if (qualifiers.length < 2) throw new Error("At least 2 players are required.");
        if (!this.isPowerOfTwo(qualifiers.length)) {
            throw new Error("Knockout players must be a power of 2 (2, 4, 8, 16, 32, etc.).");
        }
        this.qualifiers = [...qualifiers];
        // Fixed: Accurately seeds players standard tournament style (1 vs Last, 2 vs Second to Last)
        this.currentRoundPlayers = this.seedPlayers(this.qualifiers);
        this.currentFixtures = [];
        this.history = [];
        this.status = "NOT_STARTED";
        this.generateRoundFixtures();
    }
    isPowerOfTwo(number) {
        return number >= 2 && (number & (number - 1)) === 0;
    }
    // Fixed Standard Bracket Pairing implementation (e.g. 1v8, 2v7, 3v6, 4v5)
    seedPlayers(players) {
        const seeded = [];
        const len = players.length;
        for (let i = 0; i < len / 2; i++) {
            seeded.push(players[i]);
            seeded.push(players[len - 1 - i]);
        }
        return seeded;
    }
    generateRoundFixtures() {
        if (this.currentRoundPlayers.length <= 1) return [];
        const roundName = this.getRoundName(this.currentRoundPlayers.length);
        const roundSlug = roundName.toLowerCase().replace(/\s+/g, "-");
        const fixtures = [];
        for (let i = 0; i < this.currentRoundPlayers.length; i += 2) {
            const p1 = this.currentRoundPlayers[i];
            const p2 = this.currentRoundPlayers[i + 1];
            fixtures.push({
                id: `${roundSlug}-${(i / 2) + 1}`,
                roundName,
                p1Id: this.getPlayerId(p1),
                p2Id: this.getPlayerId(p2),
                p1Goals: null,
                p2Goals: null,
                penaltyWinnerId: null,
                winnerId: null,
                loserId: null,
                status: "PENDING",
                played: false
            });
        }
        this.currentFixtures = fixtures;
        return fixtures;
    }
    getPlayerId(player) {
        return (player && typeof player === "object") ? player.id : player;
    }
    getFixture(fixtureId) {
        return this.currentFixtures.find(f => f.id === fixtureId);
    }
    recordMatch(fixtureId, p1Goals, p2Goals, penaltyWinnerId = null) {
        if (this.status === "FINISHED") throw new Error("Knockout tournament is already finished.");
        const fixture = this.getFixture(fixtureId);
        if (!fixture) throw new Error(`Fixture ${fixtureId} does not exist.`);
        if (fixture.status !== "PENDING") throw new Error(`Fixture ${fixtureId} is already completed.`);
        if (!Number.isInteger(p1Goals) || !Number.isInteger(p2Goals) || p1Goals < 0 || p2Goals < 0) {
            throw new Error("Goals must be non-negative integers.");
        }
        // Force tournament status to update seamlessly if match records begin early
        if (this.status === "NOT_STARTED") this.status = "IN_PROGRESS";
        let winnerId, loserId;
        if (p1Goals > p2Goals) {
            winnerId = fixture.p1Id; loserId = fixture.p2Id;
        } else if (p2Goals > p1Goals) {
            winnerId = fixture.p2Id; loserId = fixture.p1Id;
        } else {
            if (!penaltyWinnerId) throw new Error("A tied knockout match requires a penalty winner.");
            if (penaltyWinnerId !== fixture.p1Id && penaltyWinnerId !== fixture.p2Id) {
                throw new Error("Penalty winner must be one of the match participants.");
            }
            winnerId = penaltyWinnerId;
            loserId = (winnerId === fixture.p1Id) ? fixture.p2Id : fixture.p1Id;
        }
        fixture.p1Goals = p1Goals;
        fixture.p2Goals = p2Goals;
        fixture.penaltyWinnerId = penaltyWinnerId;
        fixture.winnerId = winnerId;
        fixture.loserId = loserId;
        fixture.status = "COMPLETED";
        fixture.played = true;
        return fixture;
    }
    isCurrentRoundComplete() {
        return this.currentFixtures.length > 0 && this.currentFixtures.every(f => f.status === "COMPLETED");
    }
    advanceRound() {
        if (!this.isCurrentRoundComplete()) throw new Error("The current knockout round is not complete.");
        // Cleaned up double array loop into a single structured operation
        const winners = [];
        const previousRoundFixtures = [];
        for (const fixture of this.currentFixtures) {
            winners.push(fixture.winnerId);
            previousRoundFixtures.push({ ...fixture });
        }
        this.history.push({
            round: this.currentFixtures[0].roundName,
            fixtures: previousRoundFixtures
        });
        this.currentRoundPlayers = winners;
        if (winners.length === 1) {
            this.status = "FINISHED";
            return { status: "FINISHED", winner: winners[0] };
        }
        this.status = "IN_PROGRESS";
        this.generateRoundFixtures();
        return {
            status: "CONTINUING",
            nextRound: this.getRoundName(winners.length),
            playersRemaining: winners.length,
            fixtures: this.currentFixtures
        };
    }
    start() {
        if (this.status !== "NOT_STARTED") throw new Error("Knockout stage has already started.");
        this.status = "IN_PROGRESS";
        return this.currentFixtures;
    }
    getRoundName(playerCount) {
        const names = { 32: "Round of 32", 16: "Round of 16", 8: "Quarter-Finals", 4: "Semi-Finals", 2: "Final" };
        return names[playerCount] || `Round of ${playerCount}`;
    }
    getCurrentFixtures() { return this.currentFixtures; }
    getHistory() { return this.history; }
    getCurrentPlayers() { return this.currentRoundPlayers; }
    getChampion() { return this.status === "FINISHED" ? this.currentRoundPlayers[0] : null; }
}
module.exports = KnockoutManager;
