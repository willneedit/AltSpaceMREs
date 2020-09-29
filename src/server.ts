/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { WebHost } from '@microsoft/mixed-reality-extension-sdk';
import { resolve as resolvePath } from 'path';
import { dispatch, dispatchControl, dispatchStartup } from './dispatch';

import Http from 'http';
import HttpProxy from 'http-proxy';
import QueryString from 'query-string';
import WebSocket from 'ws';

import DoorGuard from './DoorGuard';

import { RawContext } from './frameworks/context/rawcontext';

import { initReSTServer } from './rest';

/*
import { log } from '@microsoft/mixed-reality-extension-sdk/built/log';

// Enable network logging
log.enable('network');
 */

// tslint:disable-next-line:no-var-requires
const forwarded = require('forwarded-for');

process.on('uncaughtException', err => console.log('uncaughtException', err));
process.on('unhandledRejection', reason => console.log('unhandledRejection', reason));

function initServer() {
    // The port number we make available. Either use the PORT environment variable
    // (Heroku defines one) or take the standard 3901.
    const publicPort = Number(process.env.PORT || 3901);
    const mrePort = publicPort + 1;
    const controlPort = publicPort + 2;
    const banPort = publicPort + 3;
    const restPort = publicPort + 4;

    // Start listening for connections, and serve static files
    const server = new WebHost({
        baseDir: resolvePath(__dirname, '../public'),
        port: mrePort
    });

    // Handle new application sessions
    server.adapter.onConnection((context, params) => dispatch(
        new RawContext(context), params, server.baseUrl));

    // Start a remote control server to maintain connection between the server and the Altspace Enclosure items
    const controlserver = new WebSocket.Server({ port: controlPort });

    controlserver.on('connection', (ws) => {
        ws.on('message', (payload) => dispatchControl(ws, payload as string));
    });

    // Yet another server that delays an incoming request and then denies it.
    const banServer = Http.createServer((req: Http.IncomingMessage, res: Http.ServerResponse) => {
        setTimeout(() => {
            res.writeHead(403, { 'Content-type': 'text/plain'});
            res.write('Banned! Your IP address sent too many bogus requests that it had to be blacklisteed.');
            res.end();
        }, 50000);
    }).listen(banPort);

    const restServer = initReSTServer(restPort);

    // Use a lean HTTP proxy to multiplex the connections onto a single port, as follows:
    // http://rest/.* --> localhost:3905 (the ReST accessor)
    // http://.* --> localhost:3902 (the MRE WebHost)
    // ws://control --> localhost:3903 (the control connection)
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
            DoorGuard.isAdmitted(address.ip).then(() => {
                if ((query.url as string) === '/control') {
                    proxy.ws(req, socket, head, { target: `ws://localhost:${controlPort}` });
                } else {
                    if (!req.headers['x-forwarded-for']) {
                        req.headers['x-forwarded-for'] = address.ip;
                    }
                    DoorGuard.rung(address.ip);
                    proxy.ws(req, socket, head, { target: `ws://localhost:${mrePort}` });
                }
            }).catch(() => {
                proxy.ws(req, socket, head, { target: `http://localhost:${banPort}` });
            });
        });

    // Listen to the given port (as defined per environment like Heroku)
    // or the usual default one of 3901
    proxyServer.listen(publicPort);

    // ... now everything's good to go!
}

// Initialize the submodules
dispatchStartup().then(() => initServer());
