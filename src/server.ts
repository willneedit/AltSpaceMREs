/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { WebHost } from '@microsoft/mixed-reality-extension-sdk';
import { resolve as resolvePath } from 'path';
import { dispatch, dispatchControl } from './dispatch';

import WebSocket from 'ws';

process.on('uncaughtException', err => console.log('uncaughtException', err));
process.on('unhandledRejection', reason => console.log('unhandledRejection', reason));

// Start listening for connections, and serve static files
const server = new WebHost({
    baseDir: resolvePath(__dirname, '../public'),
    // baseUrl: 'http://bdec09ce.ngrok.io'
});

// Handle new application sessions
server.adapter.onConnection((context, params) => dispatch(context, params, server.baseUrl));

// Start a remote control server to maintain connection between the server and the Altspace Enclosure items
const altserver = new WebSocket.Server({ port: 3902 });

altserver.on('connection', (ws) => {
    ws.on('message', (payload) => dispatchControl(ws, payload as string));
});
