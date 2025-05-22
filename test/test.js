process.env.NODE_ENV = 'test';
process.env.DAEMON_RPC_HOST = 'dummy-host';
process.env.IPINFO_TOKEN = 'dummy-token';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;

import { app, setClient, startServer, shutdownServer } from '../src/server/server.js';
import mockData from './mockData.js';

chai.use(chaiHttp);

const mockClient = {
    command: async (cmd) => {
        if (cmd === 'getpeerinfo') {
            return mockData.peerInfo;
        } else if (cmd === 'getnetworkinfo') {
            return mockData.networkInfo;
        } else if (cmd === 'getmininginfo') {
            return mockData.miningInfo;
        }
    }
};

setClient(mockClient);

describe('API tests', function() {
    this.timeout(10000);
    
    let server;
    
    // Start the server before tests
    before(function() {
        server = startServer();
    });
    
    // Clean up resources after tests
    after(function(done) {
        console.log('All tests done, cleaning up resources...');
        shutdownServer().then(() => {
            console.log('Resources cleaned up successfully');
            done();
        });
    });

    it('should respond with HTTP status 200', function(done) {
        chai.request(app)
            .get('/peer-locations')
            .end((err, res) => {
                if (err) {
                    console.error('Test failed with error:', err);
                    return done(err);
                } else {
                    console.log('Response status:', res.status);
                    console.log('Response body:', res.body);
                    expect(res).to.have.status(200);
                    done();
                }
            });
    });
});

after(function(done) {
    console.log('All tests done, exiting process.');
    done();
});