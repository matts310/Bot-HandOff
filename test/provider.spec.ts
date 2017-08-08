import * as Promise from 'bluebird';
import { InMemoryProvider } from './../src/provider/prebuilt/InMemoryProvider';
import { providerTest } from './providerTest';

describe('built in providers', () => {
    providerTest(() => Promise.resolve(new InMemoryProvider()), 'in memory provider');
});
