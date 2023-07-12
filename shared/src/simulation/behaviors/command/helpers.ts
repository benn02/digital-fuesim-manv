import { cloneDeep } from 'lodash-es';
import type { SimulatedRegion } from '../../../models/simulated-region';
import type { TransferPoint } from '../../../models/transfer-point';
import { PatientTransferOccupation } from '../../../models/utils/occupations/patient-transfer-occupation';
import type { PatientStatus } from '../../../models/utils/patient-status';
import type { PersonnelType } from '../../../models/utils/personnel-type';
import { isInSpecificSimulatedRegion } from '../../../models/utils/position/position-helpers';
import type { ResourceDescription } from '../../../models/utils/resource-description';
import {
    addPartialResourceDescriptions,
    addResourceDescription,
    ceilResourceDescription,
    scaleResourceDescription,
} from '../../../models/utils/resource-description';
import type { ExerciseState } from '../../../state';
import { getElement } from '../../../store/action-reducers/utils/get-element';
import type { Mutable } from '../../../utils/immutability';
import { StrictObject } from '../../../utils/strict-object';
import type { UUID } from '../../../utils/uuid';
import { IssueCommandActivityState } from '../../activities/issue-command';
import { addActivity } from '../../activities/utils';
import type { ExerciseSimulationEvent } from '../../events/exercise-simulation-event';
import { TransferVehiclesCommandEvent } from '../../events/transfer-vehicle-command';
import { nextUUID } from '../../utils/randomness';
import type { CommandBehaviorState } from './command';
import {
    assumedPatientPersonnelNeeds,
    personnelInVehicles,
    transportablePatients,
} from './constants';

export function totalPatientsInRegion(
    simulatedRegionId: UUID,
    commandBehaviorState: CommandBehaviorState
): number {
    return Object.values(
        commandBehaviorState.patientsExpectedInRegions[simulatedRegionId] ?? {}
    ).reduce(
        (totalPatients, patientsOfCategory) =>
            totalPatients + patientsOfCategory,
        0
    );
}

export function totalResources(
    resourceDescription: ResourceDescription
): number {
    return Object.values(resourceDescription).reduce(
        (total, current) => total + current,
        0
    );
}

export function personnelNeedsFromPatients(
    patients: ResourceDescription<PatientStatus>
): ResourceDescription<PersonnelType> {
    return ceilResourceDescription(
        StrictObject.entries(patients).reduce(
            (totalPersonnelNeeds, [category, patientsOfCategory]) =>
                addResourceDescription(
                    totalPersonnelNeeds,
                    scaleResourceDescription(
                        assumedPatientPersonnelNeeds[category],
                        patientsOfCategory
                    )
                ),
            {
                gf: 0,
                notarzt: 0,
                notSan: 0,
                rettSan: 0,
                san: 0,
            }
        )
    );
}

export function isRegionExpectedToNOTGetALeader(
    commandBehaviorState: CommandBehaviorState,
    simulatedRegionId: UUID
): boolean {
    return (
        (commandBehaviorState.vehiclesExpectedInRegions[simulatedRegionId] ===
            undefined ||
            !Object.values(
                commandBehaviorState.vehiclesExpectedInRegions[
                    simulatedRegionId
                ]!
            ).some((amount) => amount > 0)) &&
        (commandBehaviorState.vehiclesOnTheWayToRegions[simulatedRegionId] ===
            undefined ||
            !Object.values(
                commandBehaviorState.vehiclesOnTheWayToRegions[
                    simulatedRegionId
                ]!
            ).some((amount) => amount > 0))
    );
}

export function personnelExpectedToGetToRegion(
    simulatedRegionId: UUID,
    commandBehaviorState: CommandBehaviorState
): ResourceDescription<PersonnelType> {
    const vehiclesExpectedToBeInRegion = addPartialResourceDescriptions([
        commandBehaviorState.vehiclesExpectedInRegions[simulatedRegionId] ?? {},
        commandBehaviorState.vehiclesOnTheWayToRegions[simulatedRegionId] ?? {},
    ]) as ResourceDescription;
    return vehiclesToPersonnel(vehiclesExpectedToBeInRegion);
}

export function vehiclesToPersonnel(
    vehicles: ResourceDescription
): ResourceDescription<PersonnelType> {
    return Object.entries(vehicles).reduce(
        (totalPersonnel, [vehicleType, vehicleCount]) =>
            addResourceDescription(
                totalPersonnel,
                scaleResourceDescription(
                    personnelInVehicles[vehicleType] ?? {
                        gf: 0,
                        notarzt: 0,
                        notSan: 0,
                        rettSan: 0,
                        san: 0,
                    },
                    vehicleCount
                )
            ),
        {
            gf: 0,
            notarzt: 0,
            notSan: 0,
            rettSan: 0,
            san: 0,
        }
    );
}

export function areVehiclesLeft(
    vehicleTypes: Set<string>,
    vehicles: ResourceDescription
): boolean {
    return Object.entries(vehicles).some(
        ([vehicleType, vehicleCount]) =>
            vehicleTypes.has(vehicleType) && vehicleCount > 0
    );
}

export function noMorePersonnelNeeded(
    personnel: ResourceDescription<PersonnelType>
): boolean {
    let n = 0;
    for (const personnelType of [
        'notarzt',
        'notSan',
        'rettSan',
        'san',
    ] as PersonnelType[]) {
        n += personnel[personnelType];
        if (n > 0) {
            return false;
        }
    }
    return true;
}

export function canStartTransport(
    commandBehaviorState: Mutable<CommandBehaviorState>,
    assignedPersonnel: {
        [region: UUID]: ResourceDescription<PersonnelType>;
    }
): boolean {
    return (
        Object.values(assignedPersonnel).every(noMorePersonnelNeeded) &&
        Object.keys(commandBehaviorState.patientTraysWithInformation).length ===
            Object.keys(commandBehaviorState.patientTrays).length
    );
}

export function displayAnyPerRegion(
    value: {
        [simulatedRegionId: UUID]: any;
    },
    draftState: Mutable<ExerciseState>
): string {
    let s = '';
    Object.entries(value).forEach(([simulatedRegionId, val]) => {
        const simulatedRegionName = getElement(
            draftState,
            'simulatedRegion',
            simulatedRegionId
        ).name;
        s += ` [${simulatedRegionName}]: ${JSON.stringify(val)}`;
    });
    return s;
}

export function nameOfSimulatedRegion(
    simulatedRegionId: UUID,
    draftState: Mutable<ExerciseState>
): string {
    return getElement(draftState, 'simulatedRegion', simulatedRegionId).name;
}

export function sendVehiclesToRegion(
    simulatedRegionId: UUID,
    vehicles: ResourceDescription,
    simulatedRegion: Mutable<SimulatedRegion>,
    commandBehaviorState: Mutable<CommandBehaviorState>,
    draftState: Mutable<ExerciseState>,
    isTransportToHospital: boolean = false
) {
    issueCommand(
        simulatedRegion,
        draftState,
        TransferVehiclesCommandEvent.create(
            Object.keys(commandBehaviorState.stagingAreas)[0]!,
            vehicles,
            getTransferPointOfSimulatedRegion(simulatedRegionId, draftState).id,
            isTransportToHospital
                ? PatientTransferOccupation.create(simulatedRegion.id)
                : undefined
        )
    );

    commandBehaviorState.vehiclesOnTheWayToRegions[simulatedRegionId] =
        addPartialResourceDescriptions([
            commandBehaviorState.vehiclesOnTheWayToRegions[simulatedRegionId] ??
                {},
            vehicles,
        ]) as ResourceDescription;
}

export function getTransferPointOfSimulatedRegion(
    simulatedRegionId: UUID,
    draftState: Mutable<ExerciseState>
): TransferPoint {
    return Object.values(draftState.transferPoints).find((transferPoint) =>
        isInSpecificSimulatedRegion(transferPoint, simulatedRegionId)
    )!;
}

export function issueCommand(
    simulatedRegion: Mutable<SimulatedRegion>,
    draftState: Mutable<ExerciseState>,
    event: ExerciseSimulationEvent
) {
    addActivity(
        simulatedRegion,
        IssueCommandActivityState.create(nextUUID(draftState), event)
    );
}

/**
 * This does assume that vehicles can transport arbitrary patients
 * @param patients
 * @param transportingVehicles
 */
export function patientsAfterTransport(
    patients: ResourceDescription<PatientStatus>,
    transportingVehicles: ResourceDescription
): ResourceDescription<PatientStatus> {
    const remainingPatients = cloneDeep(patients);
    const transportedPatients = Object.entries(transportingVehicles).reduce(
        (total, [vehicleType, amount]) =>
            total + amount * (transportablePatients[vehicleType]?.red ?? 0),
        0
    );
    remainingPatients.red -= transportedPatients;
    if (remainingPatients.red < 0) {
        remainingPatients.red = 0;
        remainingPatients.yellow += remainingPatients.red;
        if (remainingPatients.yellow < 0) {
            remainingPatients.yellow = 0;
            remainingPatients.green += remainingPatients.yellow;
            if (remainingPatients.green < 0) {
                remainingPatients.green = 0;
            }
        }
    }
    return remainingPatients;
}


