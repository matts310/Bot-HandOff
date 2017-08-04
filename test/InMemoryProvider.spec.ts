import * as Promise from 'bluebird';
import { InMemoryProvider } from './../src/provider/InMemoryProvider';
import { providerTest } from './providerTest';

describe('built in providers', () => {
    providerTest(() => Promise.resolve(new InMemoryProvider()), 'in memory provider');
});
