Contains a set of AltspaceVR MRE's, multiplexed and spawned from a single service, most prominently the 'Gate'.

The list of apps is configured in `src/dispatch.ts` and a single app is instantiated in Altspace using `ws://location.of.the.mre.org/app?name=<nameofapplet>`, additional parameters in key/value URL encoded notation optional.

## Editing

* Open this folder in VSCode.

## Building

* From inside VSCode: `Shift+Ctrl+B`
* From command line: `npm run build`

## Running

* From inside VSCode: `F5`
* From command line: `npm start`
