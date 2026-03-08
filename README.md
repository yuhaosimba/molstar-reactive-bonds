# @yuhaosimba/molstar-reactive-bonds

Dynamic covalent bond extension for Mol* (`molstar` 5.6/5.7).

## Install

```bash
npm i molstar @yuhaosimba/molstar-reactive-bonds
```

## Usage

```ts
import { Viewer } from 'molstar/lib/apps/viewer/app';
import { registerReactiveBonds, addDynamicCovalentRepresentation } from '@yuhaosimba/molstar-reactive-bonds';

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

