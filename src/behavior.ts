/**
 * Copyright (c) 2026 mol* contributors, licensed under MIT, See LICENSE file for more info.
 */

import { PluginBehavior } from 'molstar/lib/mol-plugin/behavior/behavior';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { ReactiveBondsProvider } from './property';
import { DynamicCovalentRepresentationProvider } from './representation';

export const ReactiveBonds = PluginBehavior.create<{ autoAttach: boolean }>({
    name: 'reactive-bonds-prop',
    category: 'custom-props',
    display: { name: 'Reactive Bonds' },
    ctor: class extends PluginBehavior.Handler<{ autoAttach: boolean }> {
        register(): void {
            this.ctx.customStructureProperties.register(ReactiveBondsProvider, this.params.autoAttach);
            this.ctx.representation.structure.registry.add(DynamicCovalentRepresentationProvider);
        }

        update(params: { autoAttach: boolean }) {
            const updated = this.params.autoAttach !== params.autoAttach;
            this.params.autoAttach = params.autoAttach;
            this.ctx.customStructureProperties.setDefaultAutoAttach(ReactiveBondsProvider.descriptor.name, this.params.autoAttach);
            return updated;
        }

        unregister(): void {
            this.ctx.customStructureProperties.unregister(ReactiveBondsProvider.descriptor.name);
            this.ctx.representation.structure.registry.remove(DynamicCovalentRepresentationProvider);
        }
    },
    params: () => ({
        autoAttach: PD.Boolean(false),
    })
});

