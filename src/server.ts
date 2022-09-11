/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { WebHost, Permissions } from '@microsoft/mixed-reality-extension-sdk';
import { resolve as resolvePath } from 'path';
import { dispatch, dispatchStartup } from './dispatch';

import Http from 'http';
import HttpProxy from 'http-proxy';
import QueryString from 'query-string';

import { RawContext } from './frameworks/context/rawcontext';

import { initReSTServer } from './rest';

/*
import { log } from '@microsoft/mixed-reality-extension-sdk/built/log';

// Enable network logging
log.enable('network');
 */

// tslint:disable-next-line:no-var-requires
const forwarded = require('forwarded-for');

process.on('uncaughtException', err => console.debug('uncaughtException', err));
process.on('unhandledRejection', reason => console.debug('unhandledRejection', reason));

function initServer() {
    // The port number we make available. Either use the PORT environment variable
    // (Heroku defines one) or take the standard 3901.
    const publicPort = Number(process.env.PORT || 3901);
    const mrePort = publicPort + 1;
    const restPort = publicPort + 2;

    // Start listening for connections, and serve static files
    const server = new WebHost({
        baseDir: resolvePath(__dirname, '../public'),
        port: mrePort,
        permissions: [ Permissions.UserTracking, Permissions.UserInteraction ]
    });

    // Handle new application sessions
    server.adapter.onConnection((context, params) => dispatch(
        new RawContext(context), params, "/"));

    console.debug("Initialized Multipeer server");

    const restServer = initReSTServer(restPort);
    console.debug("Initialized ReST server");

    // Use a lean HTTP proxy to multiplex the connections onto a single port, as follows:
    // http://rest/.* --> localhost:3903 (the ReST accessor)
    // http://.* --> localhost:3902 (the MRE WebHost)
    // ws://.* --> localhost:3902 (the MRE webHost)
    const proxy = HttpProxy.createProxyServer({
    });

    const proxyServer = Http.createServer(
        (req, res) => {
            if (req.url.substr(0, 6) === '/rest/') {
                proxy.web(req, res, { target: `http://localhost:${restPort}`});
            } else {
                proxy.web(req, res, { target: `http://localhost:${mrePort}` });
            }
        });

    proxyServer.on('upgrade',
        (req, socket, head) => {
            const query = QueryString.parseUrl(req.url);
            const address = forwarded(req, req.headers);

            if (!req.headers['x-forwarded-for']) {
                req.headers['x-forwarded-for'] = address.ip;
            }
            proxy.ws(req, socket, head, { target: `ws://localhost:${mrePort}` });

        });

    // Listen to the given port (as defined per environment like Heroku)
    // or the usual default one of 3901
    proxyServer.listen(publicPort);

    console.debug("Initialized proxy server");

    // ... now everything's good to go!
}

console.debug("Server starting up...");

// Initialize the submodules
dispatchStartup().then(() => initServer());
