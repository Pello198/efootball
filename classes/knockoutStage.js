class KnockoutManager {
    constructor(qualifiers) {
        if (!Array.isArray(qualifiers) || qualifiers.length < 2 || !this.isPowerOfTwo(qualifiers.length)) throw new Error("Qualifiers must be a power of 2 (at least 2).");
        this.qualifiers = [...qualifiers];
        this.currentRoundPlayers = this.seedPlayers(this.qualifiers);
        this.currentFixtures = [];
        this.history = [];
        this.status = "NOT_STARTED";
        this.generateRoundFixtures();
    }
    isPowerOfTwo(n) { return n >= 2 && (n & (n - 1)) === 0; }
    seedPlayers(players) {
        const seeded = [], len = players.length;
        for (let i = 0; i < len / 2; i++) seeded.push(players[i], players[len - 1 - i]);
        return seeded;
    }
    generateRoundFixtures() {
        if (this.currentRoundPlayers.length <= 1) return [];
        const roundName = this.getRoundName(this.currentRoundPlayers.length);
        const roundSlug = roundName.toLowerCase().replace(/\s+/g, "-");
        this.currentFixtures = [];
        for (let i = 0; i < this.currentRoundPlayers.length; i += 2) {
            this.currentFixtures.push({
                id: `${roundSlug}-${(i / 2) + 1}`, roundName,
                p1Id: this.getPlayerId(this.currentRoundPlayers[i]),
                p2Id: this.getPlayerId(this.currentRoundPlayers[i + 1]),
                p1Goals: null, p2Goals: null, penaltyWinnerId: null, winnerId: null, loserId: null, status: "PENDING", played: false
            });
        }
        return this.currentFixtures;
    }
    getPlayerId(p) { return (p && typeof p === "object") ? p.id : p; }
    getFixture(id) { return this.currentFixtures.find(f => f.id === id); }
    recordMatch(fixtureId, p1Goals, p2Goals, penaltyWinnerId = null) {
        if (this.status === "FINISHED") throw new Error("Knockout tournament is finished.");
        const fixture = this.getFixture(fixtureId);
        if (!fixture || fixture.status !== "PENDING") throw new Error("Invalid or completed fixture.");
        if (!Number.isInteger(p1Goals) || !Number.isInteger(p2Goals) || p1Goals < 0 || p2Goals < 0) throw new Error("Invalid goals.");
        if (this.status === "NOT_STARTED") this.status = "IN_PROGRESS";
        let winnerId, loserId;
        if (p1Goals > p2Goals) { winnerId = fixture.p1Id; loserId = fixture.p2Id; }
        else if (p2Goals > p1Goals) { winnerId = fixture.p2Id; loserId = fixture.p1Id; }
        else {
            if (!penaltyWinnerId || (penaltyWinnerId !== fixture.p1Id && penaltyWinnerId !== fixture.p2Id)) throw new Error("Valid penalty winner required for ties.");
            winnerId = penaltyWinnerId;
            loserId = winnerId === fixture.p1Id ? fixture.p2Id : fixture.p1Id;
        }
        Object.assign(fixture, { p1Goals, p2Goals, penaltyWinnerId, winnerId, loserId, status: "COMPLETED", played: true });
        return fixture;
    }
    isCurrentRoundComplete() { return this.currentFixtures.length > 0 && this.currentFixtures.every(f => f.status === "COMPLETED"); }
    advanceRound() {
        if (!this.isCurrentRoundComplete()) throw new Error("Current knockout round is incomplete.");
        const winners = this.currentFixtures.map(f => f.winnerId);
        this.history.push({ round: this.currentFixtures[0].roundName, fixtures: this.currentFixtures.map(f => ({ ...f })) });
        this.currentRoundPlayers = winners;
        if (winners.length === 1) {
            this.status = "FINISHED";
            return { status: "FINISHED", winner: winners[0] };
        }
        this.status = "IN_PROGRESS";
        this.generateRoundFixtures();
        return { status: "CONTINUING", nextRound: this.getRoundName(winners.length), playersRemaining: winners.length, fixtures: this.currentFixtures };
    }
    start() {
        if (this.status !== "NOT_STARTED") throw new Error("Already started.");
        return this.status = "IN_PROGRESS", this.currentFixtures;
    }
    getRoundName(count) {
        return ({ 32: "Round of 32", 16: "Round of 16", 8: "Quarter-Finals", 4: "Semi-Finals", 2: "Final" })[count] || `Round of ${count}`;
    }
    getCurrentFixtures() { return this.currentFixtures; }
    getHistory() { return this.history; }
    getCurrentPlayers() { return this.currentRoundPlayers; }
    getChampion() { return this.status === "FINISHED" ? this.currentRoundPlayers[0] : null; }
}
module.exports = KnockoutManager;