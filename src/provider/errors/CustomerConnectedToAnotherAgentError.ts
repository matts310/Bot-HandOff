export class CustomerConnectedToAnotherAgentError extends Error {
    constructor(msg: string = 'customer is connected to a different agent') {
        super(msg);

        this.name = 'CustomerConnectedToAnotherAgentError';

        Object.setPrototypeOf(this, CustomerConnectedToAnotherAgentError.prototype);
    }
}
