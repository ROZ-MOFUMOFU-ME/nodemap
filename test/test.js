process.env.NODE_ENV = 'test';
process.env.DAEMON_RPC_HOST = 'dummy-host';
process.env.IPINFO_TOKEN   = 'dummy-token';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { app, setClient } = require('../app');
const mockData = require('./mockData');

chai.use(chaiHttp);
const expect = chai.expect;

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

after((done) => {
    console.log('All tests done, exiting process.');
    done();
    process.exit();
});