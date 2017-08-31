export class CustomerAlreadyConnectedException extends Error {
    constructor(msg: string) {
        super(msg);

        this.name = 'CustomerAlreadyConnectedException';

        Object.setPrototypeOf(this, CustomerAlreadyConnectedException.prototype);
    }
}
