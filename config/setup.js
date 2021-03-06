require('babel-register')({
    ignore: function (path) {
        if (/node_modules\/d2-ui/.test(path)) {
            return false;
        }

        if (/node_modules/.test(path)) {
            return true;
        }
        return false;
    }
});

/* istanbul ignore next */
global.chai = require('chai');
global.sinon = require('sinon');

// Chai plugins
global.chai.use(require('sinon-chai'));
global.chai.use(require('chai-enzyme')());

global.expect = global.chai.expect;
