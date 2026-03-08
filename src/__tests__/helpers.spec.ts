import { describe, it, expect } from 'vitest';
import { getComponentsNeedingDynamicCovalent } from '../helpers';

describe('helpers', () => {
    it('filters out components already containing dynamic-covalent repr', () => {
        const compA = { representations: [{ cell: { transform: { params: { type: { name: 'ball-and-stick' } } } } }] } as any;
        const compB = { representations: [{ cell: { transform: { params: { type: { name: 'dynamic-covalent' } } } } }] } as any;
        const structures = [{ components: [compA, compB] }] as any;

        const result = getComponentsNeedingDynamicCovalent(structures);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(compA);
    });
});
