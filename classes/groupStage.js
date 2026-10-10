class GroupStage {
    constructor(groupMap) {
        this.groupMap = this.validateGroups(groupMap);
        this.standings = {};
        this.fixtures = [];
        this.initializeStandings();
        this.generateAllFixtures();
    }
    validateGroups(groupMap) {
        if (!groupMap || typeof groupMap !== "object") {
            throw new Error("groupMap must be an object.");
        }
        const groups = {};
        for (const [groupName, players] of Object.entries(groupMap)) {
            if (!Array.isArray(players)) throw new Error(`Group ${groupName} must contain an array.`);
            if (players.length === 0) throw new Error(`Group ${groupName} cannot be empty.`);
            const uniquePlayers = new Set(players);
            if (uniquePlayers.size !== players.length) {
                throw new Error(`Group ${groupName} contains duplicate players.`);
            }
            groups[groupName] = [...players];
        }
        return groups;
    }
    initializeStandings() {
        for (const [groupName, players] of Object.entries(this.groupMap)) {
            for (const playerId of players) {
                const key = String(playerId);
                if (this.standings[key]) {
                    throw new Error(`Player ${playerId} appears in multiple groups.`);
                }
                this.standings[key] = {
                    id: playerId, group: groupName, played: 0, wins: 0, draws: 0, losses: 0,
                    points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0
                };
            }
        }
    }
    generateAllFixtures() {
        for (const groupName of Object.keys(this.groupMap)) {
            this.fixtures.push(...this.generateGroupFixtures(groupName));
        }
    }
    generateGroupFixtures(groupName) {
        let players = [...this.groupMap[groupName]];
        if (players.length < 2) return [];
        if (players.length % 2 !== 0) players.push(null);
        const fixtures = [];
        const numPlayers = players.length;
        const numRounds = numPlayers - 1;
        for (let round = 1; round <= numRounds; round++) {
            for (let i = 0; i < numPlayers / 2; i++) {
                const player1 = players[i];
                const player2 = players[numPlayers - 1 - i];
                if (player1 === null || player2 === null) continue;
                fixtures.push({
                    id: `${groupName}-R${round}-M${i + 1}`,
                    group: groupName,
                    round: round,
                    home: player1,
                    away: player2,
                    homeGoals: null,
                    awayGoals: null,
                    status: "PENDING",
                    cancellationReason: null
                });
            }
            // Efficient round-robin rotation without massive array recreation
            players.splice(1, 0, players.pop());
        }
        return fixtures;
    }
    getFixture(fixtureId) {
        return this.fixtures.find(
        f => String(f.id) === String(fixtureId)
    );}
    recordMatch(fixtureId, homeGoals, awayGoals) {
        const fixture = this.getFixture(fixtureId);
        if (!fixture) throw new Error(`Fixture ${fixtureId} does not exist.`);
        if (fixture.status !== "PENDING") throw new Error(`Fixture ${fixtureId} is already ${fixture.status}.`);
        if (!Number.isInteger(homeGoals) || !Number.isInteger(awayGoals) || homeGoals < 0 || awayGoals < 0) {
            throw new Error("Goals must be non-negative integers.");
        }
        const home = this.standings[fixture.home];
        const away = this.standings[fixture.away];
        fixture.homeGoals = homeGoals;
        fixture.awayGoals = awayGoals;
        fixture.status = "COMPLETED";
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
    getAllStandings() {
        return Object.keys(this.groupMap)
            .flatMap(groupName => this.rankGroupStandings(groupName));
    }
    // Consolidated filtering helper API
    getFixtures({ group, round, status } = {}) {
        return this.fixtures.filter(f => {
            if (group && f.group !== group) return false;
            if (round && f.round !== round) return false;
            if (status && f.status !== status) return false;
            return true;
        });
    }
    isGroupComplete(groupName) {
        return this.getFixtures({ group: groupName, status: "PENDING" }).length === 0;
    }
    isComplete() {
        return this.fixtures.length > 0 && this.getFixtures({ status: "PENDING" }).length === 0;
    }
    rankGroupStandings(groupName) {
        if (!this.groupMap[groupName]) throw new Error(`Group ${groupName} does not exist.`);

        const players = this.groupMap[groupName]
            .map(playerId => this.standings[String(playerId)])
            .filter(Boolean);

        // 1. Primary sort: points
        const sortedOverall = [...players].sort((a, b) => {
            if (b.points !== a.points) {
                return b.points - a.points;
            }
            if (b.goalDifference !== a.goalDifference) {
                return b.goalDifference - a.goalDifference;
            }
            if (b.goalsFor !== a.goalsFor) {
                return b.goalsFor - a.goalsFor;
            }
            return 0;
        });

        const ranked = [];

        // 2. Isolate every player tied on points for head-to-head processing
        for (let index = 0; index < sortedOverall.length;) {
            let end = index + 1;
            while (
                end < sortedOverall.length &&
                sortedOverall[end].points === sortedOverall[index].points &&
                sortedOverall[end].goalDifference === sortedOverall[index].goalDifference &&
                sortedOverall[end].goalsFor === sortedOverall[index].goalsFor

            ) {
                end++;
            }

            const tiedChunk = sortedOverall.slice(index, end);
            if (tiedChunk.length === 1) {
                ranked.push(tiedChunk[0]);
            } else {
                ranked.push(...this.rankTiedPlayers(tiedChunk));
            }
            index = end;
        }

        return ranked;
    }

    rankTiedPlayers(players) {
        if (players.length <= 1) return players;

        const playerIds = new Set(players.map(p => String(p.id)));
        const headToHead = new Map(
            players.map(p => [String(p.id), { points: 0, goalsFor: 0, goalsAgainst: 0 }])
        );

        // Build mini-table stats among tied players
        for (const fixture of this.fixtures) {
            if (String(fixture.status).toUpperCase() !== "COMPLETED") continue;

            const homeId = String(fixture.home);
            const awayId = String(fixture.away);

            if (playerIds.has(homeId) && playerIds.has(awayId)) {
                const homeGoals = Number(fixture.homeGoals);
                const awayGoals = Number(fixture.awayGoals);

                const homeStats = headToHead.get(homeId);
                const awayStats = headToHead.get(awayId);

                homeStats.goalsFor += homeGoals;
                homeStats.goalsAgainst += awayGoals;
                awayStats.goalsFor += awayGoals;
                awayStats.goalsAgainst += homeGoals;

                if (homeGoals > awayGoals) {
                    homeStats.points += 3;
                } else if (awayGoals > homeGoals) {
                    awayStats.points += 3;
                } else {
                    homeStats.points += 1;
                    awayStats.points += 1;
                }
            }
        }

        // Mini-table comparator: Points -> Goal Difference -> Goals For
        const compareH2H = (a, b) => {
            const aStats = headToHead.get(String(a.id));
            const bStats = headToHead.get(String(b.id));

            if (bStats.points !== aStats.points) {
                return bStats.points - aStats.points;
            }
            const aGD = aStats.goalsFor - aStats.goalsAgainst;
            const bGD = bStats.goalsFor - bStats.goalsAgainst;
            if (bGD !== aGD) {
                return bGD - aGD;
            }
            return bStats.goalsFor - aStats.goalsFor;
        };

        const sorted = [...players].sort(compareH2H);
        const ranked = [];

        for (let index = 0; index < sorted.length;) {
            let end = index + 1;
            while (
                end < sorted.length &&
                compareH2H(sorted[index], sorted[end]) === 0
            ) {
                end++;
            }

            const tiedSubgroup = sorted.slice(index, end);
            if (tiedSubgroup.length === 1) {
                ranked.push(tiedSubgroup[0]);
            } else if (tiedSubgroup.length < players.length) {
                // Re-evaluate reduced subgroup mini-table recursively
                ranked.push(...this.rankTiedPlayers(tiedSubgroup));
            } else {
                // Mini-table failed to resolve tie; apply overall fallback comparison
                ranked.push(...[...tiedSubgroup].sort((a, b) => this._compareStandings(a, b)));
            }
            index = end;
        }

        return ranked;
    }
    _compareStandings(a, b) {
        if (a.group !== b.group) {
            return String(a.group).localeCompare(String(b.group));
        }
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
        return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
    }
    getGroupStatus(groupName) {
        const total = this.getFixtures({ group: groupName });
        const completed = total.filter(f => f.status === "COMPLETED").length;
        const pending = total.filter(f => f.status === "PENDING").length;
        return {
            group: groupName,
            status: pending === 0 ? "COMPLETED" : "IN_PROGRESS",
            totalFixtures: total.length,
            completedFixtures: completed,
            pendingFixtures: pending
        };
    }
   getQualifiers(advanceCount) {
    if (!this.isComplete()) {
        throw new Error("Group stage is not complete.");
    }
    const groupNames = Object.keys(this.groupMap);
    const numberOfGroups = groupNames.length;
    if (advanceCount > Object.keys(this.standings).length) {
        throw new Error( "Advance count cannot be greater than the number of players." );
    }
    if (advanceCount % numberOfGroups !== 0) {
        throw new Error( `Cannot evenly distribute ${advanceCount} qualifiers across ${numberOfGroups} groups.` );
    }
    const qualifiersPerGroup = advanceCount / numberOfGroups;
    const qualifiers = [];
    for (const groupName of groupNames) {
        const groupStandings = this.getGroupStandings(groupName);
        qualifiers.push( ...groupStandings.slice(0,qualifiersPerGroup ));
    }
    return qualifiers;
}
    getCurrentRound() {
        const pending = this.getFixtures({ status: "PENDING" });
        return pending.length === 0 ? null : Math.min(...pending.map(f => f.round));
    }
}
module.exports = GroupStage;