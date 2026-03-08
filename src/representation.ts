/**
 * Copyright (c) 2026 mol* contributors, licensed under MIT, See LICENSE file for more info.
 */

import { Representation, RepresentationContext, RepresentationParamsGetter } from 'molstar/lib/mol-repr/representation';
import { ThemeRegistryContext, Theme } from 'molstar/lib/mol-theme/theme';
import { Structure, StructureElement } from 'molstar/lib/mol-model/structure';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { VisualContext } from 'molstar/lib/mol-repr/visual';
import { Mesh } from 'molstar/lib/mol-geo/geometry/mesh/mesh';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { createLinkCylinderMesh, LinkCylinderParams, LinkStyle } from 'molstar/lib/mol-repr/structure/visual/util/link';
import { ComplexMeshParams, ComplexVisual, ComplexMeshVisual } from 'molstar/lib/mol-repr/structure/complex-visual';
import { PickingId } from 'molstar/lib/mol-geo/geometry/picking';
import { EmptyLoci, Loci } from 'molstar/lib/mol-model/loci';
import { Interval } from 'molstar/lib/mol-data/int';
import { LocationIterator } from 'molstar/lib/mol-geo/util/location-iterator';
import { VisualUpdateState } from 'molstar/lib/mol-repr/util';
import { Sphere3D } from 'molstar/lib/mol-math/geometry';
import { CustomProperty } from 'molstar/lib/mol-model-props/common/custom-property';
import { ComplexRepresentation, StructureRepresentation, StructureRepresentationProvider, StructureRepresentationStateBuilder } from 'molstar/lib/mol-repr/structure/representation';
import { getUnitKindsParam } from 'molstar/lib/mol-repr/structure/params';
import { UnitsRepresentation } from 'molstar/lib/mol-repr/structure/units-representation';
import { ElementSphereParams, ElementSphereVisual } from 'molstar/lib/mol-repr/structure/visual/element-sphere';
import { BaseGeometry } from 'molstar/lib/mol-geo/geometry/base';
import { ReactiveBonds, ReactiveBondsProvider, ReactiveBondsParams, ReactiveBondsProps, getReactiveBonds } from './property';

function getConformationSignature(structure: Structure) {
    return structure.models.map(m => m.atomicConformation.id).join('|');
}

function createReactiveBondsCylinderMesh(ctx: VisualContext, structure: Structure, theme: Theme, props: PD.Values<DynamicCovalentBondParams>, mesh?: Mesh) {
    const reactiveProps: ReactiveBondsProps = {
        maxRadius: props.maxRadius,
        distanceScale: props.distanceScale,
        includeHydrogens: props.includeHydrogens,
        includeInterUnit: props.includeInterUnit,
    };
    const reactiveBonds = getReactiveBonds(structure, reactiveProps);
    const { edges } = reactiveBonds;
    if (!edges.length) return Mesh.createEmpty(mesh);

    const location = StructureElement.Location.create(structure);
    const style = props.style === 'dashed' ? LinkStyle.Dashed : LinkStyle.Solid;
    const delta = Vec3();

    const getEdge = (halfEdgeIndex: number) => edges[Math.floor(halfEdgeIndex / 2)];
    const isForwardHalf = (halfEdgeIndex: number) => (halfEdgeIndex & 1) === 0;

    const builderProps = {
        // link mesh expects 2 directed half-links per logical bond for full length and atom-side coloring
        linkCount: edges.length * 2,
        position: (posA: Vec3, posB: Vec3, edgeIndex: number, adjust: boolean) => {
            const edge = getEdge(edgeIndex);
            if (isForwardHalf(edgeIndex)) {
                edge.unitA.conformation.position(edge.unitA.elements[edge.indexA], posA);
                edge.unitB.conformation.position(edge.unitB.elements[edge.indexB], posB);
            } else {
                edge.unitB.conformation.position(edge.unitB.elements[edge.indexB], posA);
                edge.unitA.conformation.position(edge.unitA.elements[edge.indexA], posB);
            }

            if (adjust && props.adjustCylinderLength) {
                const rA = radiusA(edgeIndex);
                const rB = radiusB(edgeIndex);
                const r = Math.min(rA, rB) * props.sizeAspectRatio;
                const oA = Math.sqrt(Math.max(0, rA * rA - r * r)) - 0.05;
                const oB = Math.sqrt(Math.max(0, rB * rB - r * r)) - 0.05;
                if (oA <= 0.01 && oB <= 0.01) return;

                Vec3.normalize(delta, Vec3.sub(delta, posB, posA));
                Vec3.scaleAndAdd(posA, posA, delta, oA);
                Vec3.scaleAndAdd(posB, posB, delta, -oB);
            }
        },
        style: () => style,
        radius: (edgeIndex: number) => {
            return radius(edgeIndex) * props.sizeAspectRatio;
        },
    };

    const radius = (halfEdgeIndex: number) => {
        const edge = getEdge(halfEdgeIndex);
        const forward = isForwardHalf(halfEdgeIndex);

        location.unit = forward ? edge.unitA : edge.unitB;
        location.element = forward ? edge.unitA.elements[edge.indexA] : edge.unitB.elements[edge.indexB];
        const sizeA = theme.size.size(location);

        location.unit = forward ? edge.unitB : edge.unitA;
        location.element = forward ? edge.unitB.elements[edge.indexB] : edge.unitA.elements[edge.indexA];
        const sizeB = theme.size.size(location);

        return Math.min(sizeA, sizeB) * props.sizeFactor * props.bondSizeFactor;
    };

    const radiusA = (halfEdgeIndex: number) => {
        const edge = getEdge(halfEdgeIndex);
        if (isForwardHalf(halfEdgeIndex)) {
            location.unit = edge.unitA;
            location.element = edge.unitA.elements[edge.indexA];
        } else {
            location.unit = edge.unitB;
            location.element = edge.unitB.elements[edge.indexB];
        }
        return theme.size.size(location) * props.sizeFactor * props.bondSizeFactor;
    };

    const radiusB = (halfEdgeIndex: number) => {
        const edge = getEdge(halfEdgeIndex);
        if (isForwardHalf(halfEdgeIndex)) {
            location.unit = edge.unitB;
            location.element = edge.unitB.elements[edge.indexB];
        } else {
            location.unit = edge.unitA;
            location.element = edge.unitA.elements[edge.indexA];
        }
        return theme.size.size(location) * props.sizeFactor * props.bondSizeFactor;
    };

    const { mesh: m, boundingSphere } = createLinkCylinderMesh(ctx, builderProps, props, mesh);
    if (boundingSphere) {
        m.setBoundingSphere(boundingSphere);
    } else if (m.triangleCount > 0) {
        m.setBoundingSphere(Sphere3D.expand(Sphere3D(), structure.boundary.sphere, 1 * props.sizeFactor));
    }
    return m;
}

const DynamicCovalentVisuals = {
    'element-sphere': (ctx: RepresentationContext, getParams: RepresentationParamsGetter<Structure, ElementSphereParams>) =>
        UnitsRepresentation('Element sphere', ctx, getParams, ElementSphereVisual),
    'dynamic-bond': (ctx: RepresentationContext, getParams: RepresentationParamsGetter<Structure, DynamicCovalentBondParams>) =>
        ComplexRepresentation('Dynamic covalent bond', ctx, getParams, DynamicCovalentBondVisual),
};

export const DynamicCovalentBondParams = {
    ...ComplexMeshParams,
    ...LinkCylinderParams,
    ...ReactiveBondsParams,
    sizeFactor: PD.Numeric(0.15, { min: 0, max: 4, step: 0.01 }),
    bondSizeFactor: PD.Numeric(0.7, { min: 0.1, max: 2, step: 0.01 }),
    sizeAspectRatio: PD.Numeric(2 / 3, { min: 0.01, max: 3, step: 0.01 }),
    adjustCylinderLength: PD.Boolean(false),
    style: PD.Select('solid', PD.arrayToOptions(['dashed', 'solid'] as const)),
    linkCap: PD.Boolean(true),
    colorMode: PD.Select('default', PD.arrayToOptions(['default', 'interpolate'] as const), BaseGeometry.ShadingCategory),
};
export type DynamicCovalentBondParams = typeof DynamicCovalentBondParams

export const DynamicCovalentParams = {
    ...ElementSphereParams,
    ...DynamicCovalentBondParams,
    unitKinds: getUnitKindsParam(['atomic']),
    visuals: PD.MultiSelect(['element-sphere', 'dynamic-bond'], PD.objectToOptions(DynamicCovalentVisuals)),
    bumpFrequency: PD.Numeric(0, { min: 0, max: 10, step: 0.1 }, BaseGeometry.ShadingCategory),
    density: PD.Numeric(0.1, { min: 0, max: 1, step: 0.01 }, BaseGeometry.ShadingCategory),
};
export type DynamicCovalentParams = typeof DynamicCovalentParams

export function DynamicCovalentBondVisual(materialId: number): ComplexVisual<DynamicCovalentBondParams> {
    let currentProps = PD.getDefaultValues(DynamicCovalentBondParams);
    return ComplexMeshVisual<DynamicCovalentBondParams>({
        defaultProps: PD.getDefaultValues(DynamicCovalentBondParams),
        createGeometry: createReactiveBondsCylinderMesh,
        createLocationIterator: (structure, props) => {
            currentProps = props;
            return createReactiveBondsIterator(structure, props);
        },
        getLoci: getReactiveBondLoci,
        eachLocation: eachReactiveBond,
        setUpdateState: (state: VisualUpdateState, newProps: PD.Values<DynamicCovalentBondParams>, currentProps: PD.Values<DynamicCovalentBondParams>, _newTheme: Theme, _currentTheme: Theme, newStructure: Structure, currentStructure: Structure) => {
            state.createGeometry = (
                newProps.maxRadius !== currentProps.maxRadius ||
                newProps.distanceScale !== currentProps.distanceScale ||
                newProps.includeHydrogens !== currentProps.includeHydrogens ||
                newProps.includeInterUnit !== currentProps.includeInterUnit ||
                newProps.sizeFactor !== currentProps.sizeFactor ||
                newProps.bondSizeFactor !== currentProps.bondSizeFactor ||
                newProps.sizeAspectRatio !== currentProps.sizeAspectRatio ||
                newProps.adjustCylinderLength !== currentProps.adjustCylinderLength ||
                newProps.style !== currentProps.style ||
                newProps.dashCount !== currentProps.dashCount ||
                newProps.dashScale !== currentProps.dashScale ||
                newProps.dashCap !== currentProps.dashCap ||
                newProps.radialSegments !== currentProps.radialSegments ||
                newProps.linkCap !== currentProps.linkCap ||
                newProps.colorMode !== currentProps.colorMode
            );

            const newSig = getConformationSignature(newStructure);
            if ((state.info.conformationSignature as string | undefined) !== newSig) {
                state.createGeometry = true;
                state.updateTransform = true;
                state.updateColor = true;
                state.info.conformationSignature = newSig;
            }

            if (newStructure !== currentStructure) {
                state.updateTransform = true;
            }

            if (newProps.colorMode !== currentProps.colorMode) {
                state.updateColor = true;
                state.updateTransform = true;
            }
        }
    }, materialId);

    function getReactiveBondLoci(pickingId: PickingId, structure: Structure, id: number) {
        const { objectId, groupId } = pickingId;
        if (id !== objectId) return EmptyLoci;
        const reactiveBonds = getReactiveBonds(structure, {
            maxRadius: currentProps.maxRadius,
            distanceScale: currentProps.distanceScale,
            includeHydrogens: currentProps.includeHydrogens,
            includeInterUnit: currentProps.includeInterUnit,
        });
        const edgeIndex = Math.floor(groupId / 2);
        if (!reactiveBonds.edges[edgeIndex]) return EmptyLoci;
        return ReactiveBonds.Loci(structure, reactiveBonds, [edgeIndex]);
    }

    function eachReactiveBond(loci: Loci, structure: Structure, apply: (interval: Interval) => boolean) {
        const reactiveBonds = getReactiveBonds(structure, {
            maxRadius: currentProps.maxRadius,
            distanceScale: currentProps.distanceScale,
            includeHydrogens: currentProps.includeHydrogens,
            includeInterUnit: currentProps.includeInterUnit,
        });
        return ReactiveBonds.each(loci as ReactiveBonds.Loci, structure, reactiveBonds, apply);
    }
}

function createReactiveBondsIterator(structure: Structure, props: PD.Values<DynamicCovalentBondParams>): LocationIterator {
    const reactiveBonds = getReactiveBonds(structure, {
        maxRadius: props.maxRadius,
        distanceScale: props.distanceScale,
        includeHydrogens: props.includeHydrogens,
        includeInterUnit: props.includeInterUnit,
    });
    const groupCount = reactiveBonds.edges.length * 2;
    const locationA = StructureElement.Location.create(structure);
    const getEdge = (halfEdgeIndex: number) => reactiveBonds.edges[Math.floor(halfEdgeIndex / 2)];
    const isForwardHalf = (halfEdgeIndex: number) => (halfEdgeIndex & 1) === 0;

    const getLocation = (groupIndex: number) => {
        const edge = getEdge(groupIndex);
        if (isForwardHalf(groupIndex)) {
            locationA.unit = edge.unitA;
            locationA.element = edge.unitA.elements[edge.indexA];
        } else {
            locationA.unit = edge.unitB;
            locationA.element = edge.unitB.elements[edge.indexB];
        }
        return locationA;
    };

    return LocationIterator(groupCount, 1, 1, getLocation, true);
}

export function getDynamicCovalentParams(_ctx: ThemeRegistryContext, _structure: Structure) {
    return PD.clone(DynamicCovalentParams);
}

export type DynamicCovalentRepresentation = StructureRepresentation<DynamicCovalentParams>
export function DynamicCovalentRepresentation(ctx: RepresentationContext, getParams: RepresentationParamsGetter<Structure, DynamicCovalentParams>): DynamicCovalentRepresentation {
    return Representation.createMulti('Dynamic Covalent', ctx, getParams, StructureRepresentationStateBuilder, DynamicCovalentVisuals as unknown as Representation.Def<Structure, DynamicCovalentParams>);
}

export const DynamicCovalentRepresentationProvider = StructureRepresentationProvider({
    name: 'dynamic-covalent',
    label: 'Dynamic Covalent',
    description: 'Displays frame-wise covalent bonds inferred from atomic distances in a ball-and-stick style.',
    factory: DynamicCovalentRepresentation,
    getParams: getDynamicCovalentParams,
    defaultValues: PD.getDefaultValues(DynamicCovalentParams),
    defaultColorTheme: { name: 'element-symbol' },
    defaultSizeTheme: { name: 'physical' },
    isApplicable: ReactiveBonds.isApplicable,
    ensureCustomProperties: {
        attach: (ctx: CustomProperty.Context, structure: Structure) => ReactiveBondsProvider.attach(ctx, structure, void 0, true),
        detach: (data) => ReactiveBondsProvider.ref(data, false)
    }
});
