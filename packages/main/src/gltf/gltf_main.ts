/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
	ParameterSet,
	User,
	AttachPoint,
	Transform,
	Vector3,
	Quaternion,
	DegreesToRadians,
	Actor
} from "@microsoft/mixed-reality-extension-sdk";

import Applet from "../Applet";

import { ContextLike } from "../frameworks/context/types";

export default class ShowGLTF extends Applet {
	private initialized = false;
	private attachPoint: AttachPoint = "none";
	private attachUser: string = null;
	private offset: Partial<Transform> = { position: new Vector3(0.0, 0.0, 0.0 ) };

	public init(context: ContextLike, params: ParameterSet, baseUrl: string) {
		super.init(context, params, baseUrl);

		if (params.attach) this.attachPoint = params.attach as AttachPoint;
		if (params.user) this.attachUser = params.user as string;
		if (params.x) this.offset.position.x = +params.x;
		if (params.y) this.offset.position.y = +params.y;
		if (params.z) this.offset.position.z = +params.z;

		if (params.rx || params.ry || params.rz) {
			const euler = new Vector3(0.0, 0.0, 0.0);
			if (params.rx) euler.x = +params.rx;
			if (params.ry) euler.y = +params.ry;
			if (params.rz) euler.z = +params.rz;

			this.offset.rotation = Quaternion.RotationYawPitchRoll(
				euler.y * DegreesToRadians,
				euler.x * DegreesToRadians,
				euler.z * DegreesToRadians);
		}

		this.context.onUserJoined(this.userjoined);
	}

	private userjoined = (user: User) => {
		console.debug(`Connection request by ${user.name} from ${user.properties.remoteAddress}`);
		this.started(user);
	}

	private started = (user: User) => {
		if (this.initialized) return;

		if (this.attachUser && this.attachUser !== user.name) return;

		if (this.attachPoint === "none") this.initialized = true;

		let model: Actor = null;

		const anim = this.parameter.animate !== undefined;

		if (this.parameter.gltf !== undefined) {
			const gltfName = this.parameter.gltf as string;
			model = this.context.CreateFromGLTF({
				uri: gltfName,
				actor: {
					name: `Model URL: ${gltfName}`,
					transform: { local: this.offset }
				}
			});
		} else if (this.parameter.kit !== undefined) {
			const kitObjId = this.parameter.kit as string;
			model = this.context.CreateFromLibrary({
				resourceId: kitObjId,
				actor: {
					name: `Kit Model Id: ${kitObjId}`,
					transform: { local: this.offset }
				}
			});
		}

		if (anim) {
			const animName = (this.parameter.animate === null) ? 'animation:0' : this.parameter.animate as string;
			model.targetingAnimationsByName.get(animName).play();
		}

		if (this.attachPoint !== "none") model.attach(user, this.attachPoint);
	}
}
