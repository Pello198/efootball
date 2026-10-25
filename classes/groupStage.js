class GroupStage {
    constructor(groupMap) {
        this.groupMap = this.validateGroups(groupMap);
        this.standings = {};
        this.fixtures = [];
        this.initializeStandings();
        this.generateAllFixtures();
    }
    validateGroups(groupMap) {
        if (!groupMap || typeof groupMap !== "object") throw new Error("groupMap must be an object.");
        const groups = {};
        for (const [groupName, players] of Object.entries(groupMap)) {
            if (!Array.isArray(players)) throw new Error(`Group ${groupName} must contain an array.`);
            if (!players.length) throw new Error(`Group ${groupName} cannot be empty.`);
            if (new Set(players).size !== players.length) throw new Error(`Group ${groupName} contains duplicate players.`);
            groups[groupName] = [...players];
        }
        return groups;
    }
    initializeStandings() {
        this.standings={};
        for (const [groupName, players] of Object.entries(this.groupMap)) {
            for (const playerId of players) {
                const key = String(playerId);
                if (this.standings[key]) throw new Error(`Player ${playerId} appears in multiple groups.`);
                this.standings[key] = { id: playerId, group: groupName, played: 0, wins: 0, draws: 0, losses: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 };
            }
        }
    }
    generateAllFixtures() {
        for (const groupName of Object.keys(this.groupMap)) this.fixtures.push(...this.generateGroupFixtures(groupName));
    }
    generateGroupFixtures(groupName) {
        let players = [...this.groupMap[groupName]];
        if (players.length < 2) return [];
        if (players.length % 2 !== 0) players.push(null);
        const fixtures = [], numPlayers = players.length;
        for (let round = 1; round <= numPlayers - 1; round++) {
            for (let i = 0; i < numPlayers / 2; i++) {
                const [p1, p2] = [players[i], players[numPlayers - 1 - i]];
                if (p1 !== null && p2 !== null) {
                    fixtures.push({ id: `${groupName}-R${round}-M${i + 1}`, group: groupName, round, home: p1, away: p2, homeGoals: null, awayGoals: null, status: "PENDING", cancellationReason: null });
                }
            }
            players.splice(1, 0, players.pop());
        }
        return fixtures;
    }
    getFixture(fixtureId) { return this.fixtures.find(f => String(f.id) === String(fixtureId)); }
    recordMatch(fixtureId, homeGoals, awayGoals) {
        const fixture = this.getFixture(fixtureId);
        if (!fixture) throw new Error(`Fixture ${fixtureId} does not exist.`);
        if (fixture.status !== "PENDING") throw new Error(`Fixture ${fixtureId} is already ${fixture.status}.`);
        if (!Number.isInteger(homeGoals) || !Number.isInteger(awayGoals) || homeGoals < 0 || awayGoals < 0) throw new Error("Goals must be non-negative integers.");
        const [home, away] = [this.standings[fixture.home], this.standings[fixture.away]];
        Object.assign(fixture, { homeGoals, awayGoals, status: "COMPLETED" });
        home.played++; away.played++;
        home.goalsFor += homeGoals; away.goalsFor += awayGoals;
        home.goalsAgainst += awayGoals; away.goalsAgainst += homeGoals;
        home.goalDifference = home.goalsFor - home.goalsAgainst;
        away.goalDifference = away.goalsFor - away.goalsAgainst;
        if (homeGoals > awayGoals) { home.wins++; away.losses++; home.points += 3; }
        else if (awayGoals > homeGoals) { away.wins++; home.losses++; away.points += 3; }
        else { home.draws++; away.draws++; home.points++; away.points++; }
        return fixture;
    }
    getGroupStandings(groupName) {
        if (!this.groupMap[groupName]) throw new Error(`Group ${groupName} does not exist.`);
        return this.rankGroupStandings(groupName);
    }
    getAllStandings() { return Object.keys(this.groupMap).flatMap(groupName => this.rankGroupStandings(groupName)); }
    getFixtures({ group, round, status } = {}) {
        return this.fixtures.filter(f => (!group || f.group === group) && (!round || f.round === round) && (!status || f.status === status));
    }
    isGroupComplete(groupName) { return !this.getFixtures({ group: groupName, status: "PENDING" }).length; }
    isComplete() { return this.fixtures.length > 0 && !this.getFixtures({ status: "PENDING" }).length; }
    rankGroupStandings(groupName) {
        if (!this.groupMap[groupName]) throw new Error(`Group ${groupName} does not exist.`);
        const players = this.groupMap[groupName].map(id => this.standings[String(id)]).filter(Boolean);
        const sortedOverall = [...players].sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
        const ranked = [];
        for (let i = 0; i < sortedOverall.length;) {
            let end = i + 1;
            while (end < sortedOverall.length && sortedOverall[end].points === sortedOverall[i].points && sortedOverall[end].goalDifference === sortedOverall[i].goalDifference && sortedOverall[end].goalsFor === sortedOverall[i].goalsFor) end++;
            const chunk = sortedOverall.slice(i, end);
            ranked.push(...(chunk.length === 1 ? chunk : this.rankTiedPlayers(chunk)));
            i = end;
        }
        return ranked;
    }
    rankTiedPlayers(players) {
        if (players.length <= 1) return players;
        const pSet = new Set(players.map(p => String(p.id)));
        const h2h = new Map(players.map(p => [String(p.id), { points: 0, goalsFor: 0, goalsAgainst: 0 }]));
        for (const f of this.fixtures) {
            if (String(f.status).toUpperCase() !== "COMPLETED") continue;
            const [hId, aId] = [String(f.home), String(f.away)];
            if (pSet.has(hId) && pSet.has(aId)) {
                const [hG, aG] = [Number(f.homeGoals), Number(f.awayGoals)];
                const [hS, aS] = [h2h.get(hId), h2h.get(aId)];
                hS.goalsFor += hG; hS.goalsAgainst += aG;
                aS.goalsFor += aG; aS.goalsAgainst += hG;
                if (hG > aG) hS.points += 3; else if (aG > hG) aS.points += 3; else { hS.points++; aS.points++; }
            }
        }
        const compareH2H = (a, b) => {
            const [aS, bS] = [h2h.get(String(a.id)), h2h.get(String(b.id))];
            return bS.points - aS.points || (bS.goalsFor - bS.goalsAgainst) - (aS.goalsFor - aS.goalsAgainst) || bS.goalsFor - aS.goalsFor;
        };
        const sorted = [...players].sort(compareH2H), ranked = [];
        for (let i = 0; i < sorted.length;) {
            let end = i + 1;
            while (end < sorted.length && compareH2H(sorted[i], sorted[end]) === 0) end++;
            const sub = sorted.slice(i, end);
            ranked.push(...(sub.length === 1 ? sub : sub.length < players.length ? this.rankTiedPlayers(sub) : [...sub].sort((a, b) => this._compareStandings(a, b))));
            i = end;
        }
        return ranked;
    }
    _compareStandings(a, b) {
        return a.group !== b.group ? String(a.group).localeCompare(String(b.group)) : b.wins - a.wins || a.goalsAgainst - b.goalsAgainst || String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
    }
    getGroupStatus(groupName) {
        const total = this.getFixtures({ group: groupName }), completed = total.filter(f => f.status === "COMPLETED").length;
        return { group: groupName, status: completed === total.length ? "COMPLETED" : "IN_PROGRESS", totalFixtures: total.length, completedFixtures: completed, pendingFixtures: total.length - completed };
    }
    getQualifiers(advanceCount) {
        if (!this.isComplete()) throw new Error("Group stage is not complete.");
        const groups = Object.keys(this.groupMap);
        if (advanceCount > Object.keys(this.standings).length || advanceCount % groups.length !== 0) throw new Error("Invalid qualifier distribution.");
        const perGroup = advanceCount / groups.length;
        return groups.flatMap(g => this.getGroupStandings(g).slice(0, perGroup));
    }
    getCurrentRound() {
        const pending = this.getFixtures({ status: "PENDING" });
        return pending.length ? Math.min(...pending.map(f => f.round)) : null;
    }
}
module.exports = GroupStage;