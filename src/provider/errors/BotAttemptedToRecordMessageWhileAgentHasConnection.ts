export class BotAttemptedToRecordMessageWhileAgentHasConnection extends Error {
    constructor(customerConversationId: string) {
        super(`A bot attempted to record a message on customer conversation ${customerConversationId}, which is connected to an agent`);

        this.name = 'BotAttemptedToRecordMessageWhileAgentHasConnection';

        Object.setPrototypeOf(this, BotAttemptedToRecordMessageWhileAgentHasConnection.prototype);
    }
}
