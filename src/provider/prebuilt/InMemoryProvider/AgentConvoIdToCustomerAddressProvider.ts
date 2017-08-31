import { IAddress } from 'botbuilder';

export class AgentConvoIdToCustomerAddressProvider {
    private agentToCustomerAddressMap: {[s: string]: IAddress};

    constructor() {
        this.agentToCustomerAddressMap = {};
    }

    public getCustomerAddress(agentConvoId: string | IAddress): IAddress {
        if (typeof(agentConvoId) === 'string') {
            return this.agentToCustomerAddressMap[agentConvoId];
        } else {
            return this.agentToCustomerAddressMap[agentConvoId.conversation.id];
        }
    }

    public linkCustomerAddressToAgentConvoId(agentConvoId: string, customerAddress: IAddress): void {
        this.agentToCustomerAddressMap[agentConvoId] = customerAddress;
    }

    public removeAgentConvoId(agentConvoId: string): void {
        delete this.agentToCustomerAddressMap[agentConvoId];
    }
}
