import { describe, it, expect } from 'vitest';
import { parsePDB } from 'molstar/lib/mol-io/reader/pdb/parser';
import { trajectoryFromPDB } from 'molstar/lib/mol-model-formats/structure/pdb';
import { Structure } from 'molstar/lib/mol-model/structure';
import { computeReactiveBonds, DefaultReactiveBondsProps } from '../property';

const PDB = `\
HETATM    1  C1  UNL A   1       0.000   0.000   0.000  1.00  0.00           C  
HETATM    2  H1  UNL A   1       1.090   0.000   0.000  1.00  0.00           H  
HETATM    3  C2  UNL B   1       1.400   0.000   0.000  1.00  0.00           C  
END\
`;

async function createStructure() {
    const parsed = await parsePDB(PDB, 'reactive-test').run();
    if (parsed.isError) throw new Error(parsed.message);
    const traj = await trajectoryFromPDB(parsed.result).run();
    const model = traj.representative;
    return Structure.ofModel(model);
}

describe('reactive bonds', () => {
    it('computes inter-unit bond when hydrogens are excluded explicitly', async () => {
        const structure = await createStructure();
        const bonds = await computeReactiveBonds(structure, { ...DefaultReactiveBondsProps, includeHydrogens: false });
        expect(bonds.edges.length).toBe(1);
        expect(bonds.edges[0].isInterUnit).toBe(true);
    });
});
