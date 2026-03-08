import type { StructureComponentRef, StructureRef } from 'molstar/lib/mol-plugin-state/manager/structure/hierarchy-state';
import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import { DynamicCovalentRepresentationProvider } from './representation';
import { ReactiveBondsProvider } from './property';

export type RegisterReactiveBondsOptions = {
    autoAttach?: boolean
};

export type AddDynamicCovalentRepresentationOptions = {
    tag?: string
    maxRadius?: number
    includeHydrogens?: boolean
    includeInterUnit?: boolean
    distanceScale?: number
    bondSizeFactor?: number
};

function isDynamicCovalentRepresentation(component: StructureComponentRef) {
    for (const repr of component.representations) {
        const params = repr.cell.transform.params as any;
        if (params?.type?.name === 'dynamic-covalent' || params?.type === 'dynamic-covalent') {
            return true;
        }
    }
    return false;
}

export function getComponentsNeedingDynamicCovalent(structures: ReadonlyArray<StructureRef>) {
    const targets: StructureComponentRef[] = [];
    for (const structure of structures) {
        for (const component of structure.components) {
            if (!isDynamicCovalentRepresentation(component)) {
                targets.push(component);
            }
        }
    }
    return targets;
}

function hasReactiveBondsProvider(plugin: PluginContext) {
    try {
        plugin.customStructureProperties.get(ReactiveBondsProvider.descriptor.name);
        return true;
    } catch {
        return false;
    }
}

export function registerReactiveBonds(plugin: PluginContext, options: RegisterReactiveBondsOptions = {}) {
    const autoAttach = options.autoAttach ?? false;

    if (!hasReactiveBondsProvider(plugin)) {
        plugin.customStructureProperties.register(ReactiveBondsProvider, autoAttach);
    }
    plugin.customStructureProperties.setDefaultAutoAttach(ReactiveBondsProvider.descriptor.name, autoAttach);

    const existing = plugin.representation.structure.registry.get(DynamicCovalentRepresentationProvider.name);
    if (existing.name !== DynamicCovalentRepresentationProvider.name) {
        plugin.representation.structure.registry.add(DynamicCovalentRepresentationProvider);
    }
}

export async function addDynamicCovalentRepresentation(plugin: PluginContext, options: AddDynamicCovalentRepresentationOptions = {}) {
    const provider = plugin.representation.structure.registry.get(DynamicCovalentRepresentationProvider.name);
    if (provider.name !== DynamicCovalentRepresentationProvider.name) {
        throw new Error('Dynamic covalent provider is not registered. Call registerReactiveBonds(plugin) first.');
    }

    const structures = plugin.managers.structure.hierarchy.current.structures;
    const targets = getComponentsNeedingDynamicCovalent(structures);
    const tag = options.tag ?? 'dynamic-covalent';

    const typeParams: Record<string, unknown> = {};
    if (options.maxRadius !== void 0) typeParams.maxRadius = options.maxRadius;
    if (options.includeHydrogens !== void 0) typeParams.includeHydrogens = options.includeHydrogens;
    if (options.includeInterUnit !== void 0) typeParams.includeInterUnit = options.includeInterUnit;
    if (options.distanceScale !== void 0) typeParams.distanceScale = options.distanceScale;
    if (options.bondSizeFactor !== void 0) typeParams.bondSizeFactor = options.bondSizeFactor;

    for (const component of targets) {
        await plugin.builders.structure.representation.addRepresentation(component.cell, {
            type: DynamicCovalentRepresentationProvider,
            typeParams,
        }, { tag });
    }

    return { componentCount: targets.length };
}
