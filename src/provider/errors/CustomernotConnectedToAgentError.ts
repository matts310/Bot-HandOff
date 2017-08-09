export class CustomerNotConnectedToAgentError extends Error {
    constructor(msg: string = 'customer is not connected to an agent') {
        super(msg);

        this.name = 'CustomernotConnectedToAgentError';

        Object.setPrototypeOf(this, CustomerNotConnectedToAgentError.prototype);
    }
}
