import { assertEquals } from 'https://deno.land/std@0.200.0/testing/asserts.ts';
import { computeCosts } from './r2_costs.ts';

const DEBUG = false;

Deno.test({
    name: 'r2.computeCosts',
    fn: () => {
        {
            const { classAOperationsCost, classBOperationsCost, storageGbMo, storageCost, totalCost } = computeCosts({ classAOperations: 499751, classBOperations: 430084, storageGb: 500, excludeFreeUsage: false });
            if (DEBUG) console.log({ classAOperationsCost, classBOperationsCost, storageGbMo, storageCost, totalCost });
            assertEquals(Math.round(totalCost * 100) / 100, 2.65)
        }
        {
            const { classAOperationsCost, classBOperationsCost, storageGbMo, storageCost, totalCost } = computeCosts({ classAOperations: 499751, classBOperations: 430084, storageGb: 500, excludeFreeUsage: true });
            if (DEBUG) console.log({ classAOperationsCost, classBOperationsCost, storageGbMo, storageCost, totalCost });
            assertEquals(Math.round(totalCost * 100) / 100, 0.1);
        }
    }
});
