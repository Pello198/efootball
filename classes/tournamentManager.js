const GroupStage = require("./groupStage");
const KnockoutManager = require("./knockoutStage");
class TournamentManager {
    constructor(playersNumber) {
        if (!Number.isInteger(playersNumber) || playersNumber < 2) throw new Error("The tournament must have at least 2 players.");
        this.playersNumber = playersNumber;
        this.status = playersNumber <= 8 ? "KNOCKOUT_STAGE" : "GROUP_STAGE";
        this.groupMap = null;
        this.groupStage = null;
        this.knockoutStage = null;
        this.advanceCount = this.getAdvanceCount(playersNumber);
    }
    getAdvanceCount(total) {
        return total >= 33 ? 32 : total >= 17 ? 16 : total >= 9 ? 8 : total >= 5 ? 4 : total >= 3 ? 2 : 1;
    }
    get activeStage() {
        return this.status === "GROUP_STAGE" ? this.groupStage : this.status === "KNOCKOUT_STAGE" ? this.knockoutStage : null;
    }
    createGroups(playerIds) {
        if (!Array.isArray(playerIds) || playerIds.length !== this.playersNumber) throw new Error(`Expected ${this.playersNumber} players.`);
        if (new Set(playerIds).size !== playerIds.length) throw new Error("Duplicate players are not allowed.");
        const groups = { A: [], B: [], C: [], D: [] };
        const keys = Object.keys(groups);
        playerIds.forEach((id, idx) => groups[keys[idx % keys.length]].push(id));
        return this.groupMap = groups;
    }
    startGroupStage(playerIds) {
        if (this.status !== "GROUP_STAGE") throw new Error("Tournament does not start with group stage.");
        return this.groupStage = new GroupStage(this.createGroups(playerIds));
    }
    startKnockoutStage(playerIds) {
        if (this.status !== "KNOCKOUT_STAGE") throw new Error("Tournament does not start in knockout stage.");
        if (!Array.isArray(playerIds) || playerIds.length !== this.playersNumber) throw new Error(`Expected ${this.playersNumber} players.`);
        return (this.knockoutStage = new KnockoutManager(playerIds)).start();
    }
    start(playerIds) {
        if (!Array.isArray(playerIds)) throw new Error("playerIds must be an array.");
        return this.status === "GROUP_STAGE" ? this.startGroupStage(playerIds) : this.startKnockoutStage(playerIds);
    }
    recordGroupMatch(fixtureId, homeGoals, awayGoals) {
        if (this.status !== "GROUP_STAGE" || !this.groupStage) throw new Error("Tournament is not in group stage.");
        return this.groupStage.recordMatch(fixtureId, homeGoals, awayGoals);
    }
    advanceToKnockouts() {
        if (this.status !== "GROUP_STAGE" || !this.groupStage) throw new Error("Tournament is not in group stage.");
        if (!this.groupStage.isComplete()) throw new Error("Group stage still has pending fixtures.");
        this.knockoutStage = new KnockoutManager(this.groupStage.getQualifiers(this.advanceCount));
        this.status = "KNOCKOUT_STAGE";
        return this.knockoutStage.start();
    }
    getGroupMap() {
        return this.groupMap ? { A: [...this.groupMap.A], B: [...this.groupMap.B], C: [...this.groupMap.C], D: [...this.groupMap.D] } : null;
    }
    getGroupStandings(groupName) {
        if (!this.groupStage) throw new Error("Group stage not started.");
        return this.groupStage.getGroupStandings(groupName);
    }
    getAllStandings() {
        if (!this.groupStage) throw new Error("Group stage not started.");
        return this.groupStage.getAllStandings();
    }
    getGroupFixtures(groupName) {
        if (!this.groupStage) throw new Error("Group stage not started.");
        return this.groupStage.getFixtures({ group: groupName });
    }
    getCurrentFixtures() {
        if (!this.activeStage) return [];
        return this.status === "GROUP_STAGE" ? this.groupStage.getFixtures({ status: "PENDING" }) : this.knockoutStage.getCurrentFixtures();
    }
    getSummary() {
        return {
            playersNumber: this.playersNumber, currentStatus: this.status, advanceCount: this.advanceCount,
            groupMap: this.groupMap, groupStageStarted: !!this.groupStage,
            groupStageFinished: this.groupStage ? this.groupStage.isComplete() : false,
            knockoutStageStarted: !!this.knockoutStage, activeMatches: this.getCurrentFixtures()
        };
    }
}
module.exports = TournamentManager;