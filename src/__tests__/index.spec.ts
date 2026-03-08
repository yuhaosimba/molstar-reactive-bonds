import { describe, it, expect } from 'vitest';
import { registerReactiveBonds, addDynamicCovalentRepresentation, DynamicCovalentRepresentationProvider } from '../index';

describe('public api', () => {
    it('exports registration helper and provider', () => {
        expect(typeof registerReactiveBonds).toBe('function');
        expect(typeof addDynamicCovalentRepresentation).toBe('function');
        expect(DynamicCovalentRepresentationProvider.name).toBe('dynamic-covalent');
    });
});
