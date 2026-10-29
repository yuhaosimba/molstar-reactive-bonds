# @xhznezumi/molstar-reactive-bonds

Dynamic covalent bond extension for Mol*. The declared peer versions are Mol* 5.6 and 5.7, plus 5.13.1. CI checks typechecking, building, and the automated test suite against 5.6.0, 5.7.0, and 5.13.1. Other versions are not yet declared compatible.

## Install

```bash
npm i molstar @xhznezumi/molstar-reactive-bonds
```

## Usage

```ts
import { Viewer } from 'molstar/lib/apps/viewer/app';
import { registerReactiveBonds, addDynamicCovalentRepresentation } from '@xhznezumi/molstar-reactive-bonds';

const viewer = await Viewer.create('app', { extensions: ['mvs'] });

registerReactiveBonds(viewer.plugin, { autoAttach: false });

// After structures are loaded
await addDynamicCovalentRepresentation(viewer.plugin, {
  includeHydrogens: true,
  includeInterUnit: true,
  distanceScale: 1.0,
  bondSizeFactor: 0.7,
});
```

## Exported API

- `ReactiveBondsBehavior`
- `ReactiveBondsProvider`
- `DynamicCovalentRepresentationProvider`
- `registerReactiveBonds(plugin, options?)`
- `addDynamicCovalentRepresentation(plugin, options?)`
