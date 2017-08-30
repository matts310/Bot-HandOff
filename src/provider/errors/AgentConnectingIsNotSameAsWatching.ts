export class ConnectingAgentIsNotWatching extends Error {
    constructor(msg: string) {
        super(msg);

        this.name = 'AgentConnectingIsNotSameAsWatching';

        Object.setPrototypeOf(this, ConnectingAgentIsNotWatching.prototype);
    }
}
