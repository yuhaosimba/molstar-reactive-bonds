import { describe, it, expect, vi } from 'vitest';
import { addDynamicCovalentRepresentation, registerReactiveBonds } from '../helpers';
import { DynamicCovalentRepresentationProvider } from '../representation';
import { ReactiveBondsProvider } from '../property';

function createPluginMock() {
    const registered = new Set<string>();
    const reprRegistered = new Set<string>();

    const addRepresentation = vi.fn(async () => ({}));

    const plugin = {
        customStructureProperties: {
            get: (name: string) => {
                if (!registered.has(name)) throw new Error('not registered');
                return {};
            },
            register: vi.fn((provider: any) => registered.add(provider.descriptor.name)),
            setDefaultAutoAttach: vi.fn(),
        },
        representation: {
            structure: {
                registry: {
                    get: (name: string) => reprRegistered.has(name) ? ({ name } as any) : ({ name: '' } as any),
                    add: vi.fn((provider: any) => reprRegistered.add(provider.name)),
                }
            }
        },
        managers: {
            structure: {
                hierarchy: {
                    current: {
                        structures: [
                            {
                                components: [
                                    {
                                        cell: { id: 'A' },
                                        representations: [{ cell: { transform: { params: { type: { name: 'ball-and-stick' } } } } }]
                                    },
                                    {
                                        cell: { id: 'B' },
                                        representations: [{ cell: { transform: { params: { type: { name: 'dynamic-covalent' } } } } }]
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        },
        builders: {
            structure: {
                representation: {
                    addRepresentation
                }
            }
        }
    } as any;

    return { plugin, addRepresentation, registered, reprRegistered };
}

describe('helper api', () => {
    it('registerReactiveBonds is idempotent', () => {
        const { plugin } = createPluginMock();

        registerReactiveBonds(plugin, { autoAttach: true });
        registerReactiveBonds(plugin, { autoAttach: true });

        expect(plugin.customStructureProperties.register).toHaveBeenCalledTimes(1);
        expect(plugin.customStructureProperties.register).toHaveBeenCalledWith(ReactiveBondsProvider, true);
        expect(plugin.representation.structure.registry.add).toHaveBeenCalledTimes(1);
        expect(plugin.representation.structure.registry.add).toHaveBeenCalledWith(DynamicCovalentRepresentationProvider);
    });

    it('addDynamicCovalentRepresentation adds only missing components', async () => {
        const { plugin, addRepresentation } = createPluginMock();
        registerReactiveBonds(plugin);

        const result = await addDynamicCovalentRepresentation(plugin, { bondSizeFactor: 0.7 });

        expect(result.componentCount).toBe(1);
        expect(addRepresentation).toHaveBeenCalledTimes(1);
        expect(addRepresentation.mock.calls[0][0]).toEqual({ id: 'A' });
        expect(addRepresentation.mock.calls[0][1].type).toBe(DynamicCovalentRepresentationProvider);
        expect(addRepresentation.mock.calls[0][1].typeParams.bondSizeFactor).toBe(0.7);
    });
});
