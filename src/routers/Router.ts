import * as Promise from 'bluebird';
import { Session, UniversalBot } from 'botbuilder';
import { IProvider } from './../provider/IProvider';

export abstract class Router {
    protected readonly provider: IProvider;
    protected readonly bot: UniversalBot;

    constructor(bot: UniversalBot, provider: IProvider) {
        this.bot = bot;
        this.provider = provider;
    }

    //tslint:disable
    public abstract route(session: Session, next: Function): Promise<any>;
    //tslint:enable
}
