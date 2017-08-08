export class AgentConnectingIsNotSameAsWatching extends Error {
    constructor(msg: string) {
        super(msg);

        this.name = 'AgentConnectingIsNotSameAsWatching';

        Object.setPrototypeOf(this, AgentConnectingIsNotSameAsWatching.prototype);
    }
}
