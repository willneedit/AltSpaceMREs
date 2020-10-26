/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import RS from 'restify';
import SGAddressing, { SGLocationData } from './stargate/addressing';
import { SGDB, SGDBLocationEntry } from './stargate/database';
import SGLocator from './stargate/locator';
import SGNetwork from './stargate/network';
import SGHTTP from './stargate/sg_http';

function wrapAsync(fn: (req: RS.Request, res: RS.Response, next: RS.Next) => Promise<void>) {
    return (req: RS.Request, res: RS.Response, next: RS.Next) => {
        return fn(req, res, next).catch((err: any) => {
            res.send(500, err);
            next();
        });
    };
}

function locateSGperID(req: RS.Request, res: RS.Response, next: RS.Next) {
    SGAddressing.lookupDialedTarget(
        req.params.sgaddress, +req.params.base, req.params.galaxy
    ).then((le: SGLocationData) => {
        res.send(le);
        next();
    }).catch((err: any) => {
        res.send(404, err);
        next();
    });
}

function locateSGperLoc(req: RS.Request, res: RS.Response, next: RS.Next) {
    SGAddressing.lookupGateAddress(
        req.params.sglocation, +req.params.base, req.params.galaxy
    ).then((le: SGLocationData) => {
        res.send(le);
        next();
    }).catch((err: any) => {
        res.send(404, err);
        next();
    });
}

function translateToURL(req: RS.Request, res: RS.Response, next: RS.Next) {
    const gid = SGAddressing.getGalaxyDigit(req.params.galaxy);
    const location = SGLocator.translateToURL(req.params.sglocation, gid);
    res.send(location);
    next();
}

function postEvent(req: RS.Request, res: RS.Response, next: RS.Next) {
    SGNetwork.postEvent(req.params.fqlid, req.query);
    res.send("OK");
    next();
}

function httpGateCtrl(req: RS.Request, res: RS.Response, next: RS.Next) {
    const command = req.params.command as string;
    if (command !== 'wait') SGHTTP.control(req);

    let tmo = +req.params.tmo;
    if (tmo < 500) tmo = 500;

    SGNetwork.waitEvent(req.params.fqlid, tmo).then((payload) => {
        res.send(payload);
        next();
    }).catch((err) => {
        res.send(500, "Internal server error, err=" + err);
        next();
    });
}

export function initReSTServer(port: number): RS.Server {
    const restServer = RS.createServer();
    restServer.use(RS.plugins.queryParser({ mapParams: true }));
    restServer.get('/rest/locate_id/:base/:galaxy/:sgaddress', locateSGperID);

    // ?sglocation=<sglocation>
    restServer.get('/rest/locate_loc/:base/:galaxy', locateSGperLoc);

    // ?sqlocation=<sglocation>
    restServer.get('/rest/toURL/:galaxy', translateToURL);

    // ?fqlid=<fqlid>
    restServer.get('/rest/post', postEvent);

    // ?base=<base>&fqlid=<fqlid>&tmo=<timeout>
    restServer.get('/rest/httpctrl', httpGateCtrl);

    restServer.listen(port, () => {
        // console.debug("%s listening at %s", restServer.name, restServer.url);
    });
    return restServer;
}
