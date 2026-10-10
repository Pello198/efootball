const GroupStage = require("./groupStage");
const KnockoutManager = require("./knockoutStage");
class TournamentManager {
    constructor(playersNumber) {
        if (
            !Number.isInteger(playersNumber) ||
            playersNumber < 2
        ) {
            throw new Error(
                "The tournament must have at least 2 players."
            );
        }
        this.playersNumber = playersNumber;
        this.status = null;
        this.groupMap = null;
        this.groupStage = null;
        this.knockoutStage = null;
        /*
         * Determine how many players qualify
         * from the group stage.
         */
        this.advanceCount =
            this.getAdvanceCount(playersNumber);
        if (playersNumber <= 8) {
            this.status = "KNOCKOUT_STAGE";
        } else {
            this.status = "GROUP_STAGE";
        }
    }
    getAdvanceCount(totalPlayers) {
        if (totalPlayers >= 33) {
            return 32;
        }
        if (totalPlayers >= 17) {
            return 16;
        }
        if (totalPlayers >= 9) {
            return 8;
        }
        if (totalPlayers >= 5) {
            return 4;
        }
        if (totalPlayers >= 3) {
            return 2;
        }
        return 1;
    }
    get activeStage() {
        if (this.status === "GROUP_STAGE") {
            return this.groupStage;
        }
        if (this.status === "KNOCKOUT_STAGE") {
            return this.knockoutStage;
        }
        return null;
    }
    createGroups(playerIds) {
        if (!Array.isArray(playerIds)) {
            throw new Error(
                "playerIds must be an array."
            );
        }
        if (playerIds.length !== this.playersNumber) {
            throw new Error(
                `Expected ${this.playersNumber} players but received ${playerIds.length}.`
            );
        }
        const uniquePlayers =
            new Set(playerIds);
        if (
            uniquePlayers.size !== playerIds.length
        ) {
            throw new Error(
                "Duplicate players are not allowed."
            );
        }
        const groups = {
            A: [],
            B: [],
            C: [],
            D: []
        };
        const groupNames =
            Object.keys(groups);
        playerIds.forEach(
            (playerId, index) => {
                const groupIndex =
                    index % groupNames.length;
                const groupName =
                    groupNames[groupIndex];
                groups[groupName].push(
                    playerId
                );
            }
        );
        this.groupMap = groups;
        return this.groupMap;
    }
    startGroupStage(playerIds) {
        if (this.status !== "GROUP_STAGE") {
            throw new Error(
                "This tournament does not start with the group stage."
            );
        }
        const groupMap =this.createGroups(playerIds);
        this.groupStage =
            new GroupStage(groupMap);
        return this.groupStage;
    }
    startKnockoutStage(playerIds) {
        if (this.status !== "KNOCKOUT_STAGE") {
            throw new Error(
                "This tournament does not start directly in the knockout stage."
            );
        }
        if (!Array.isArray(playerIds)) {
            throw new Error(
                "playerIds must be an array."
            );
        }
        if (playerIds.length !== this.playersNumber) {
            throw new Error(
                `Expected ${this.playersNumber} players but received ${playerIds.length}.`
            );
        }
        this.knockoutStage =
            new KnockoutManager(playerIds);
        this.knockoutStage.start();
        return this.knockoutStage;
    }
    start(playerIds) {
        if (!Array.isArray(playerIds)) {
            throw new Error(
                "playerIds must be an array."
            );
        }
        if (this.status === "GROUP_STAGE") {
            return this.startGroupStage(
                playerIds
            );
        }
        if (this.status === "KNOCKOUT_STAGE") {
            return this.startKnockoutStage(
                playerIds
            );
        }
    }
    recordGroupMatch(
        fixtureId,
        homeGoals,
        awayGoals
    ) {
        if (
            this.status !== "GROUP_STAGE"
        ) {
            throw new Error(
                "The tournament is not currently in the group stage."
            );
        }
        if (!this.groupStage) {
            throw new Error(
                "The group stage has not been started."
            );
        }
        return this.groupStage.recordMatch(
            fixtureId,
            homeGoals,
            awayGoals
        );
    }
    advanceToKnockouts() {
        if (
            this.status !== "GROUP_STAGE"
        ) {
            throw new Error(
                "The tournament is not in the group stage."
            );
        }
        if (!this.groupStage) {
            throw new Error(
                "The group stage has not been started."
            );
        }
        if (!this.groupStage.isComplete()) {
            throw new Error(
                "Cannot advance. The group stage still has pending fixtures."
            );
        }
        const qualifiedPlayerIds =
            this.groupStage.getQualifiers(
                this.advanceCount
            );
        this.knockoutStage =
            new KnockoutManager(
                qualifiedPlayerIds
            );
        this.status ="KNOCKOUT_STAGE";
        this.knockoutStage.start();
        return this.knockoutStage;
    }
    getGroupMap() {
        if (!this.groupMap) {
            return null;
        }
        return {
            A: [...this.groupMap.A],
            B: [...this.groupMap.B],
            C: [...this.groupMap.C],
            D: [...this.groupMap.D]
        };
    }
    getGroupStandings(groupName) {
        if (!this.groupStage) {
            throw new Error(
                "The group stage has not been started."
            );
        }
        return this.groupStage.getGroupStandings(
            groupName
        );
    }
    getAllStandings() {
        if (!this.groupStage) {
            throw new Error(
                "The group stage has not been started."
            );
        }
        return this.groupStage.getAllStandings();
    }
    getGroupFixtures(groupName) {
        if (!this.groupStage) {
            throw new Error(
                "The group stage has not been started."
            );
        }
        return this.groupStage.getFixtures({
            group: groupName
        });
    }
    getCurrentFixtures() {
        if (!this.activeStage) {
            return [];
        }
        if (
            this.status === "GROUP_STAGE"
        ) {
            return this.groupStage.getFixtures({
                status: "PENDING"
            });
        }
        if (
            this.status === "KNOCKOUT_STAGE"
        ) {
            return this.knockoutStage.getCurrentFixtures();
        }
        return [];
    }
    getSummary() {
        return {
            playersNumber:
                this.playersNumber,
            currentStatus:
                this.status,
            advanceCount:
                this.advanceCount,
            groupMap:
                this.groupMap,
            groupStageStarted:
                this.groupStage !== null,
            groupStageFinished:
                this.groupStage
                    ? this.groupStage.isComplete()
                    : false,
            knockoutStageStarted:
                this.knockoutStage !== null,
            activeMatches:
                this.getCurrentFixtures()
        };
    }
}
module.exports = TournamentManager;