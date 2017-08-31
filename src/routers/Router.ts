import { Session, UniversalBot } from 'botbuilder';
import { IProvider } from '../provider/IProvider';

export abstract class Router {
    protected bot: UniversalBot;
    protected provider: IProvider;

    constructor(bot: UniversalBot, provider: IProvider) {
        this.bot = bot;
        this.provider = provider;
    }

    //tslint:disable
    public abstract Route(session: Session, next?: Function): any;
    //tslint:enable
}
