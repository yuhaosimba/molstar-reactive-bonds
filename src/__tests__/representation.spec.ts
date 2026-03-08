import { describe, it, expect } from 'vitest';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { DynamicCovalentParams } from '../representation';

describe('dynamic-covalent params', () => {
    it('uses ball-and-stick-like defaults', () => {
        const defaults = PD.getDefaultValues(DynamicCovalentParams as any) as any;
        expect(defaults.includeHydrogens).toBe(true);
        expect(defaults.style).toBe('solid');
        expect(defaults.adjustCylinderLength).toBe(false);
        expect(defaults.colorMode).toBe('default');
        expect(defaults.visuals).toContain('element-sphere');
        expect(defaults.visuals).toContain('dynamic-bond');
    });
});
