/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import RS from 'restify';
import SGAddressing, { SGLocationData } from './stargate/addressing';
import { SGDB, SGDBLocationEntry } from './stargate/database';
import SGLocator from './stargate/locator';

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
    const location = SGLocator.translateToURL(req.params.location, gid);
    res.send(location);
    next();
}

export function initReSTServer(port: number): RS.Server {
    const restServer = RS.createServer();
    restServer.get('/rest/locate_id/:base/:galaxy/:sgaddress', locateSGperID);
    restServer.get('/rest/locate_loc/:base/:galaxy/:sglocation', locateSGperLoc);
    restServer.get('/rest/toURL/:galaxy/:location', translateToURL);
    restServer.listen(port, () => {
        // console.debug("%s listening at %s", restServer.name, restServer.url);
    });
    return restServer;
}
