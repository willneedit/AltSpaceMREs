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

process.on('uncaughtException', err => console.log('uncaughtException', err));
process.on('unhandledRejection', reason => console.log('unhandledRejection', reason));

// The port number we make available. Either use the PORT environment variable
// (Heroku defines one) or take the standard 3901.
const publicPort = Number(process.env.PORT || 3901);
const mrePort = publicPort + 1;
const controlPort = publicPort + 2;

// Initialize the submodules
dispatchStartup();

// Start listening for connections, and serve static files
const server = new WebHost({
    baseDir: resolvePath(__dirname, '../public'),
    port: mrePort
});

// Handle new application sessions
server.adapter.onConnection((context, params) => dispatch(context, params, server.baseUrl));

// Start a remote control server to maintain connection between the server and the Altspace Enclosure items
const controlserver = new WebSocket.Server({ port: controlPort });

controlserver.on('connection', (ws) => {
    ws.on('message', (payload) => dispatchControl(ws, payload as string));
});

// Use a lean HTTP proxy to multiplex the connections onto a single port, as follows:
// http://.* --> localhost:3902 (the MRE WebHost)
// ws://.*/control --> localhost:3903 (the control connection)
// ws://.* --> localhost:3902 (the MRE webHost)
const proxy = HttpProxy.createProxyServer({
});

const proxyServer = Http.createServer(
    (req, res) => {
        proxy.web(req, res, { target: `http://localhost:${mrePort}` });
    }
    );

proxyServer.on('upgrade',
    (req, socket, head) => {
        const query = QueryString.parseUrl(req.url);
        if ((query.url as string) === '/control') {
            proxy.ws(req, socket, head, { target: `ws://localhost:${controlPort}` });
        } else {
            proxy.ws(req, socket, head, { target: `ws://localhost:${mrePort}` });
        }
    });

// Listen to the given port (as defined per environment like Heroku)
// or the usual default one of 3901
proxyServer.listen(publicPort);

// ... now everything's good to go!
