import { cloneDeep } from 'lodash-es';
import type { PatientStatus } from '../../../models/utils/patient-status';
import type { ResourceDescription } from '../../../models/utils/resource-description';
import type { UUID } from '../../../utils';
import { areVehiclesLeft } from './helpers';
import { transportablePatients } from './constants';

export function calculateVehicleAllocationForHospitalTransport(
    assumedPatientsNotTransportedInRegions: {
        [simulatedRegionId: UUID]: ResourceDescription<PatientStatus>;
    },
    availableVehicles: ResourceDescription
): {
    [simulatedRegionId: UUID]: ResourceDescription;
} {
    const remainingAvailableVehicles = cloneDeep(availableVehicles);
    const assumedRemainingPatientsNotTransportedInRegions = cloneDeep(
        assumedPatientsNotTransportedInRegions
    );
    const allocatedVehicles: {
        [simulatedRegionId: UUID]: ResourceDescription;
    } = {};
    for (const patientStatus of ['red', 'yellow', 'green'] as PatientStatus[]) {
        const usableVehicles = Object.entries(transportablePatients)
            .filter(([_type, patients]) => patients[patientStatus] > 0)
            .map(([type, _patients]) => type);

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const assumedPatientsOfCategoryNotTransportedInRegions = Object.entries(
            assumedRemainingPatientsNotTransportedInRegions
        ).map(([region, patients]) => [region, patients[patientStatus]]) as [
            UUID,
            number
        ][];

        while (
            areVehiclesLeft(new Set(usableVehicles), remainingAvailableVehicles)
        ) {
            // TODO: Regions with no personnel have highest need
            assumedPatientsOfCategoryNotTransportedInRegions.sort(
                ([_a, a], [_b, b]) => b - a
            );
            if (
                !assumedPatientsOfCategoryNotTransportedInRegions[0] ||
                assumedPatientsOfCategoryNotTransportedInRegions[0][1] <= 0
            ) {
                break;
            }
            const region =
                assumedPatientsOfCategoryNotTransportedInRegions[0][0];
            // TODO: use vehicle that fits best
            const wantedVehicle = Object.entries(
                remainingAvailableVehicles
            ).filter(
                ([vehicleType, vehicleCount]) =>
                    usableVehicles.includes(vehicleType) && vehicleCount > 0
            )[0]![0];

            if (!allocatedVehicles[region]) {
                allocatedVehicles[region] = {};
            }
            if (!allocatedVehicles[region]![wantedVehicle]) {
                allocatedVehicles[region]![wantedVehicle] = 1;
            } else {
                allocatedVehicles[region]![wantedVehicle]++;
            }
            remainingAvailableVehicles[wantedVehicle]--;
            // TODO: 2x es können auch pats niedriegerer sks abtransportiert werden (underflow)
            assumedPatientsOfCategoryNotTransportedInRegions[0][1] -=
                transportablePatients[wantedVehicle]![patientStatus];
        }
    }

    return allocatedVehicles;
}
