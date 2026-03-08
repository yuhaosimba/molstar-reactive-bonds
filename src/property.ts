/**
 * Copyright (c) 2026 mol* contributors, licensed under MIT, See LICENSE file for more info.
 */

import { DataLocation } from 'molstar/lib/mol-model/location';
import { DataLoci } from 'molstar/lib/mol-model/loci';
import { Unit, Structure, StructureElement } from 'molstar/lib/mol-model/structure';
import { CustomPropertyDescriptor } from 'molstar/lib/mol-model/custom-property';
import { CustomProperty } from 'molstar/lib/mol-model-props/common/custom-property';
import { CustomStructureProperty } from 'molstar/lib/mol-model-props/common/custom-structure-property';
import { CentroidHelper } from 'molstar/lib/mol-math/geometry/centroid-helper';
import { Sphere3D } from 'molstar/lib/mol-math/geometry';
import { Mat4, Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { Interval } from 'molstar/lib/mol-data/int';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { getElementIdx, getElementThreshold, getPairingThreshold, isHydrogen } from 'molstar/lib/mol-model/structure/structure/unit/bonds/common';

export const ReactiveBondsParams = {
    maxRadius: PD.Numeric(4, { min: 0.5, max: 8, step: 0.1 }),
    distanceScale: PD.Numeric(1, { min: 0.5, max: 2, step: 0.05 }),
    includeHydrogens: PD.Boolean(true),
    includeInterUnit: PD.Boolean(true),
};
export type ReactiveBondsParams = typeof ReactiveBondsParams
export type ReactiveBondsProps = PD.Values<ReactiveBondsParams>
export const DefaultReactiveBondsProps = PD.getDefaultValues(ReactiveBondsParams);

export type ReactiveBondEdge = Readonly<{
    unitA: Unit.Atomic,
    indexA: StructureElement.UnitIndex,
    unitB: Unit.Atomic,
    indexB: StructureElement.UnitIndex,
    distance: number,
    isInterUnit: boolean
}>

export type ReactiveBondsValue = Readonly<{ edges: ReadonlyArray<ReactiveBondEdge> }>

const tmpA = Vec3();
const tmpB = Vec3();
const tmpImageA = Vec3();
const tmpImageTransform = Mat4();

function asAtomicUnits(structure: Structure): Unit.Atomic[] {
    const units: Unit.Atomic[] = [];
    for (const unit of structure.units) {
        if (Unit.isAtomic(unit)) units.push(unit);
    }
    return units;
}

function shouldSkipPair(typeA: string, typeB: string, includeHydrogens: boolean) {
    const elemA = getElementIdx(typeA as any);
    const elemB = getElementIdx(typeB as any);
    if (!includeHydrogens && (isHydrogen(elemA) || isHydrogen(elemB))) return true;
    if (isHydrogen(elemA) && isHydrogen(elemB)) return true;
    return false;
}

function isBondedByDistance(typeA: string, typeB: string, distance: number, distanceScale: number) {
    const elemA = getElementIdx(typeA as any);
    const elemB = getElementIdx(typeB as any);
    const thresholdA = getElementThreshold(elemA);
    const thresholdB = getElementThreshold(elemB);
    const threshold = getPairingThreshold(elemA, elemB, thresholdA, thresholdB) * distanceScale;
    return distance <= threshold;
}

export function computeReactiveBonds(structure: Structure, params: ReactiveBondsProps): ReactiveBondsValue {
    const edges: ReactiveBondEdge[] = [];
    const units = asAtomicUnits(structure);

    for (const unit of units) {
        const { elements } = unit;
        const typeSymbol = unit.model.atomicHierarchy.atoms.type_symbol;
        const { x, y, z } = unit.model.atomicConformation;
        const lookup3d = unit.lookup3d;

        for (let indexA = 0 as StructureElement.UnitIndex, il = elements.length; indexA < il; indexA++) {
            const atomA = elements[indexA];
            const typeA = typeSymbol.value(atomA);
            const { indices, count, squaredDistances } = lookup3d.find(x[atomA], y[atomA], z[atomA], params.maxRadius);

            for (let ni = 0; ni < count; ni++) {
                const indexB = indices[ni] as StructureElement.UnitIndex;
                if (indexB <= indexA) continue;
                const atomB = elements[indexB];
                const typeB = typeSymbol.value(atomB);
                if (shouldSkipPair(typeA, typeB, params.includeHydrogens)) continue;

                const distance = Math.sqrt(squaredDistances[ni]);
                if (distance === 0) continue;
                if (!isBondedByDistance(typeA, typeB, distance, params.distanceScale)) continue;

                edges.push({
                    unitA: unit,
                    indexA,
                    unitB: unit,
                    indexB,
                    distance,
                    isInterUnit: false,
                });
            }
        }
    }

    if (params.includeInterUnit) {
        for (let i = 0, il = units.length; i < il; i++) {
            const unitA = units[i];
            const typeACol = unitA.model.atomicHierarchy.atoms.type_symbol;
            const { x: xA, y: yA, z: zA } = unitA.model.atomicConformation;
            const elementsA = unitA.elements;

            for (let j = i + 1; j < il; j++) {
                const unitB = units[j];
                const typeBCol = unitB.model.atomicHierarchy.atoms.type_symbol;
                const elementsB = unitB.elements;
                const lookup3dB = unitB.lookup3d;
                const imageTransform = Mat4.mul(tmpImageTransform, unitB.conformation.operator.inverse, unitA.conformation.operator.matrix);
                const isNotIdentity = !Mat4.isIdentity(imageTransform);

                for (let indexA = 0 as StructureElement.UnitIndex, jl = elementsA.length; indexA < jl; indexA++) {
                    const atomA = elementsA[indexA];
                    Vec3.set(tmpImageA, xA[atomA], yA[atomA], zA[atomA]);
                    if (isNotIdentity) Vec3.transformMat4(tmpImageA, tmpImageA, imageTransform);

                    const { indices, count } = lookup3dB.find(tmpImageA[0], tmpImageA[1], tmpImageA[2], params.maxRadius);
                    const typeA = typeACol.value(atomA);

                    for (let ni = 0; ni < count; ni++) {
                        const indexB = indices[ni] as StructureElement.UnitIndex;
                        const atomB = elementsB[indexB];
                        const typeB = typeBCol.value(atomB);
                        if (shouldSkipPair(typeA, typeB, params.includeHydrogens)) continue;

                        unitA.conformation.position(atomA, tmpA);
                        unitB.conformation.position(atomB, tmpB);
                        const distance = Vec3.distance(tmpA, tmpB);
                        if (!isBondedByDistance(typeA, typeB, distance, params.distanceScale)) continue;

                        edges.push({
                            unitA,
                            indexA,
                            unitB,
                            indexB,
                            distance,
                            isInterUnit: true,
                        });
                    }
                }
            }
        }
    }

    return { edges };
}

const CacheName = '__ReactiveBondsCache__';
function cacheKey(props: ReactiveBondsProps) {
    return `${props.maxRadius}|${props.distanceScale}|${props.includeHydrogens ? 1 : 0}|${props.includeInterUnit ? 1 : 0}`;
}

export function getReactiveBonds(structure: Structure, props: ReactiveBondsProps) {
    const key = cacheKey(props);
    let cache = structure.currentPropertyData[CacheName] as Map<string, ReactiveBondsValue> | undefined;
    if (!cache) {
        cache = new Map<string, ReactiveBondsValue>();
        structure.currentPropertyData[CacheName] = cache;
    }
    const cached = cache.get(key);
    if (cached) return cached;
    const value = computeReactiveBonds(structure, props);
    cache.set(key, value);
    return value;
}

export const ReactiveBondsProvider: CustomStructureProperty.Provider<ReactiveBondsParams, ReactiveBondsValue> = CustomStructureProperty.createProvider({
    label: 'Reactive Bonds',
    descriptor: CustomPropertyDescriptor({
        name: 'molstar-reactive-bonds',
    }),
    type: 'local',
    defaultParams: ReactiveBondsParams,
    getParams: () => ReactiveBondsParams,
    isApplicable: (data: Structure) => data.hasAtomic,
    obtain: async (_ctx: CustomProperty.Context, data: Structure, props: Partial<ReactiveBondsProps>) => {
        const p = { ...DefaultReactiveBondsProps, ...props };
        return { value: getReactiveBonds(data, p) };
    }
});

export namespace ReactiveBonds {
    export const Tag = 'reactive-bonds';
    type Payload = { readonly structure: Structure, readonly reactiveBonds: ReactiveBondsValue }
    export type Element = number
    export interface Location extends DataLocation<Payload, Element> {}
    export interface Loci extends DataLoci<Payload, Element> {}

    export function Location(reactiveBonds: ReactiveBondsValue, structure: Structure, index?: number): Location {
        return DataLocation(Tag, { structure, reactiveBonds }, index as any);
    }

    export function Loci(structure: Structure, reactiveBonds: ReactiveBondsValue, elements: ReadonlyArray<Element>): Loci {
        return DataLoci(Tag, { structure, reactiveBonds }, elements,
            (boundingSphere) => getBoundingSphere(reactiveBonds, elements, boundingSphere),
            () => `Dynamic Covalent Bonds (${elements.length})`);
    }

    export function isLoci(x: any): x is Loci {
        return !!x && x.kind === 'data-loci' && x.tag === Tag;
    }

    function getBoundingSphere(reactiveBonds: ReactiveBondsValue, elements: ReadonlyArray<Element>, boundingSphere: Sphere3D) {
        return CentroidHelper.fromPairProvider(elements.length, (i, pA, pB) => {
            const edge = reactiveBonds.edges[elements[i]];
            edge.unitA.conformation.position(edge.unitA.elements[edge.indexA], pA);
            edge.unitB.conformation.position(edge.unitB.elements[edge.indexB], pB);
        }, boundingSphere);
    }

    export function each(loci: Loci, structure: Structure, reactiveBonds: ReactiveBondsValue, apply: (interval: Interval) => boolean) {
        let changed = false;
        if (!isLoci(loci)) return false;
        if (!Structure.areEquivalent(loci.data.structure, structure)) return false;
        if (loci.data.reactiveBonds !== reactiveBonds) return false;
        for (const e of loci.elements) {
            if (apply(Interval.ofSingleton(e))) changed = true;
        }
        return changed;
    }

    export function isApplicable(structure: Structure) {
        return structure.hasAtomic;
    }
}
