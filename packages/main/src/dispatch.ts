/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
	DegreesToRadians,
	ParameterSet,
	Quaternion,
} from "@willneedit/mixed-reality-extension-sdk";

import Applet from "./Applet";
import { singleParam } from "./helpers";


import BlastDoor from "./blastdoor/blastdoor_main";
import DemonGate from "./demongate/demongate_main";
import HelloWorld from "./helloworld";
import SGDCDHD from "./stargate/dc_dhd";
import StargateSG1 from "./stargate/sg_sg1";

import ShowGLTF from "./gltf/gltf_main";

import SGDCElven from "./stargate/dc_elven";
import StargateElven from "./stargate/sg_elven";

import { ProxyContext } from "./frameworks/context/proxycontext";
import { ContextLike } from "./frameworks/context/types";

import got from "got";
import DragNDropTest from "./dragndrop-test/dragndrop_main";

import Doorbell from "./doorbell/doorbell_main";
import GenericDoor from "./doors/generic";
import Earthquake from "./earthquake/earthquake_main";
import { SGDB } from "./stargate/database";

/**
 * Contains the names and the factories for the given applets
 */
const registry: { [key: string]: () => Applet } = {
	/* eslint-disable @typescript-eslint/camelcase */
	dragndrop: (): Applet => new DragNDropTest(),
	doorbell: (): Applet => new Doorbell(),
	helloworld: (): Applet => new HelloWorld(),
	stargate: (): Applet => new StargateSG1(),
	sg_elven: (): Applet => new StargateElven(),
	sgdialcomp: (): Applet => new SGDCDHD(),
	sg_elven_dhd: (): Applet => new SGDCElven(),
	gltf: (): Applet => new ShowGLTF(),
	kit: (): Applet => new ShowGLTF(), // Legacy, unified with the glTF object
	demongate: (): Applet => new DemonGate(),
	blastdoor: (): Applet => new BlastDoor(),
	door: (): Applet => new GenericDoor(),
	earthquake: (): Applet => new Earthquake(),
};

/**
 * Contains a list of functions needed to call before the service goes online.
 */
const registryStartup: { [key: string]: () => Promise<void> } = {
	sgnetwork: async () => await SGDB.init(),
};

function reportDispatchError(context: ContextLike, baseUrl: string, errortxt: string) {
	console.error(errortxt);
	const applet = registry.helloworld;
	const parameter = { error: errortxt };
	applet().init(context, parameter, baseUrl);
}

function parseDispatchMulti(context: ContextLike, baseUrl: string, initData: any[]) {

	initData.forEach((elem, index) => {
		const applet = registry[elem.name];
		const params = elem.params || { };
		const transform = elem.transform || { };

		// Replace name in parameters
		params.name = elem.name;

		// Replace the rotation (if given) from YXZ Euler to Quaternion
		if (transform.rotation) {
			transform.rotation = Quaternion.RotationYawPitchRoll(
				transform.rotation.y * DegreesToRadians,
				transform.rotation.x * DegreesToRadians,
				transform.rotation.z * DegreesToRadians);
		}

		const subContext = new ProxyContext(context.baseContext, index, transform);

		applet().init(subContext, params, baseUrl);
	});
}

function dispatchMulti(context: ContextLike, parameter: ParameterSet, baseUrl: string) {
	got(parameter.url as string, {responseType: 'json', resolveBodyOnly: true})
	.then(response => {
		parseDispatchMulti(context, baseUrl, response as any[]);

		// Do this because we at least missed the OnStarted() since we run asynchronously.
		context.announceSelf();
	})
	.catch(error => {
		reportDispatchError(context, baseUrl, `Cannot load definitions - Error: ${error.message}`);

		// Do this because we at least missed the OnStarted() since we run asynchronously.
		context.announceSelf();
	});
}

/**
 * Dispatch the instantiation to distinct applets.
 * @param context The context of the WebSession
 * @param parameter The parameter set of the WebSession, URLdecoded and split along key=value lines
 * @param baseUrl The base URL of the system, useful for backreferences
 */
export function dispatch(context: ContextLike, parameter: ParameterSet, baseUrl: string): void {
	let name = singleParam(parameter.name);

	if (!name) {
		name = "helloworld";
		parameter.error = `No name given: Use an URL like ${baseUrl}/app?name=yourappname to select an app`;
	}

	if (name === 'multi') return dispatchMulti(context, parameter, baseUrl);

	try {
		let applet = registry[name];
		if (!applet) {
			parameter.error = `Unrecognized applet: ${name}`;
			applet = registry.helloworld;
		}

		applet().init(context, parameter, baseUrl);

	} catch (e) {
		console.error(e.message);
	}
}

export async function dispatchStartup() {
	for ( const key in registryStartup) {
		console.debug(`Starting ${key}...`);
		await registryStartup[key]()
		.then(() => {
			console.debug(`Startup ${key} succeeded`);
		})
		.catch((err) => {
			console.debug(`Startup ${key} failed, err=${err}`);
		});
	}
}
