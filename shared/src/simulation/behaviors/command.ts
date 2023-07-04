import { IsUUID, ValidateIf } from 'class-validator';
import cloneDeep from 'lodash-es/cloneDeep';
import { getCreate } from '../../models/utils/get-create';
import type { Mutable } from '../../utils';
import {
    StrictObject,
    UUID,
    UUIDSet,
    cloneDeepMutable,
    uuid,
    uuidValidationOptions,
} from '../../utils';
import { IsUUIDSet, IsValue } from '../../utils/validators';

import {
    type ResourceDescription,
    addPartialResourceDescriptions,
    subtractPartialResourceDescriptions,
    addResourceDescription,
    scaleResourceDescription,
    ceilResourceDescription,
    subtractResourceDescription,
    minResourceDescription,
} from '../../models/utils/resource-description';
import { IsPatientsPerUUID } from '../../utils/validators/is-patients-per-uuid';
import type { PatientStatus } from '../../models/utils/patient-status';
import type { PatientDataReceivedEvent } from '../events/patient-data-received';
import { TransferVehiclesCommandEvent } from '../events/transfer-vehicle-command';
import type { SimulatedRegion } from '../../models/simulated-region';
import type { ExerciseState } from '../../state';
import { isInSpecificSimulatedRegion } from '../../models/utils/position/position-helpers';
import type { TransferPoint } from '../../models/transfer-point';
import type { ExerciseSimulationEvent } from '../events';
import { addActivity } from '../activities/utils';
import { IssueCommandActivityState } from '../activities/issue-command';
import { nextUUID } from '../utils/randomness';
import { PatientDataRequestedCommandEvent } from '../events/patient-data-requested-command';
import { VehicleDataRequestedCommandEvent } from '../events/vehicle-data-requested-command';
import type { VehicleDataReceivedEvent } from '../events/vehicle-data-received';
import { IsResourceDescription } from '../../utils/validators/is-resource-description';
import type { PersonnelType } from '../../models/utils/personnel-type';
import { logBehavior } from '../../store/action-reducers/utils/log';
import { PatientTransferOccupation } from '../../models/utils/occupations/patient-transfer-occupation';
import type {
    SimulationBehavior,
    SimulationBehaviorState,
} from './simulation-behavior';
import { getElement } from '../../store/action-reducers/utils';

const COLLECT_PATIENT_DATA_INTERVAL = 5 * 60 * 1000;
const COLLECT_VEHICLE_DATA_INTERVAL = 5 * 60 * 1000;
const COLLECT_VEHICLE_DATA_INTERVAL_PT = 5 * 60 * 1000;

type stage =
    | 'contactInitiation'
    | 'countingPatients'
    | 'securingPatients'
    | 'transportingPatients';

interface PatientsPerRegion {
    [simulatedRegionId: UUID]: ResourceDescription<PatientStatus>;
}

interface VehiclesPerRegion {
    [simulatedRegionId: UUID]: ResourceDescription;
}

const emptyPatientResourceDescription = {
    red: 0,
    green: 0,
    black: 0,
    blue: 0,
    white: 0,
    yellow: 0,
};

const assumedPatientPersonnelNeeds: {
    [patientStatus in PatientStatus]: ResourceDescription<PersonnelType>;
} = {
    black: {
        gf: 0,
        notarzt: 0,
        notSan: 0,
        rettSan: 0,
        san: 0,
    },
    blue: {
        gf: 0,
        notarzt: 0,
        notSan: 0,
        rettSan: 0,
        san: 1,
    },
    green: {
        gf: 0,
        notarzt: 0,
        notSan: 0,
        rettSan: 0,
        san: 0.5,
    },
    red: {
        gf: 0,
        notarzt: 0.5,
        notSan: 1,
        rettSan: 1,
        san: 0,
    },
    white: {
        gf: 0,
        notarzt: 0,
        notSan: 0,
        rettSan: 0,
        san: 0,
    },
    yellow: {
        gf: 0,
        notarzt: 0.25,
        notSan: 0,
        rettSan: 1,
        san: 0,
    },
};

const personnelInVehicles: {
    [vehicleType: string]: ResourceDescription<PersonnelType>;
} = {
    RTW: {
        gf: 0,
        notarzt: 0,
        notSan: 1,
        rettSan: 1,
        san: 0,
    },
    KTW: {
        gf: 0,
        notarzt: 0,
        notSan: 0,
        rettSan: 1,
        san: 1,
    },
    'KTW (KatSchutz)': {
        gf: 0,
        notarzt: 0,
        notSan: 0,
        rettSan: 1,
        san: 1,
    },
    NEF: {
        gf: 0,
        notarzt: 1,
        notSan: 1,
        rettSan: 0,
        san: 0,
    },
    'GW-San': {
        gf: 1,
        notarzt: 1,
        notSan: 0,
        rettSan: 2,
        san: 2,
    },
    RTH: {
        gf: 0,
        notarzt: 1,
        notSan: 1,
        rettSan: 0,
        san: 0,
    },
};
const transportablePatients: {
    [vehicleType: string]: ResourceDescription<PatientStatus>;
} = {
    RTW: {
        black: 0,
        blue: 0,
        green: 1,
        red: 1,
        white: 0,
        yellow: 1,
    },
    KTW: {
        black: 0,
        blue: 0,
        green: 1,
        red: 0,
        white: 0,
        yellow: 1,
    },
    'KTW (KatSchutz)': {
        black: 0,
        blue: 0,
        green: 2,
        red: 0,
        white: 0,
        yellow: 1,
    },
    NEF: {
        black: 0,
        blue: 0,
        green: 0,
        red: 0,
        white: 0,
        yellow: 0,
    },
    'GW-San': {
        black: 0,
        blue: 0,
        green: 0,
        red: 0,
        white: 0,
        yellow: 0,
    },
    RTH: {
        black: 0,
        blue: 0,
        green: 1,
        red: 1,
        white: 0,
        yellow: 1,
    },
};

export class CommandBehaviorState implements SimulationBehaviorState {
    @IsValue('commandBehavior' as const)
    readonly type = 'commandBehavior';

    @IsUUID(4, uuidValidationOptions)
    public readonly id: UUID = uuid();

    @IsUUIDSet()
    public readonly stagingAreas: UUIDSet = {};

    @IsUUIDSet()
    public readonly patientTrays: UUIDSet = {};

    @IsPatientsPerUUID()
    public readonly patientsExpectedInRegions: PatientsPerRegion = {};

    @IsPatientsPerUUID()
    public readonly patientsTransportedFromRegions: PatientsPerRegion = {};

    @ValidateIf(() => true)
    public readonly vehiclesExpectedInRegions: VehiclesPerRegion = {};

    @ValidateIf(() => true)
    public readonly vehiclesOnTheWayToRegions: VehiclesPerRegion = {};

    @ValidateIf(() => true)
    public readonly vehiclesRequestedByRegions: VehiclesPerRegion = {};

    @IsUUIDSet()
    public readonly patientTraysContacted: UUIDSet = {};

    @IsUUIDSet()
    public readonly stagingAreasContacted: UUIDSet = {};

    @IsUUIDSet()
    public readonly patientTraysWithInformation: UUIDSet = {};

    @IsUUIDSet()
    public readonly patientTraysSecured: UUIDSet = {};

    @IsResourceDescription()
    public readonly totalVehiclesInStagingAreas: ResourceDescription = {};

    static readonly create = getCreate(this);
}

export const commandBehavior: SimulationBehavior<CommandBehaviorState> = {
    behaviorState: CommandBehaviorState,
    handleEvent(draftState, simulatedRegion, behaviorState, event) {
        switch (event.type) {
            case 'debugEvent':
                {
                    console.log(JSON.stringify(behaviorState));
                }
                break;
            case 'tickEvent':
                {
                    Object.keys(behaviorState.patientTrays)
                        .filter(
                            (patientTray) =>
                                !behaviorState.patientTraysContacted[
                                    patientTray
                                ]
                        )
                        .forEach((patientTray) => {
                            issueCommand(
                                simulatedRegion,
                                draftState,
                                PatientDataRequestedCommandEvent.create(
                                    patientTray,
                                    true
                                )
                            );
                            behaviorState.patientTraysContacted[patientTray] =
                                true;
                        });
                    Object.keys(behaviorState.stagingAreas)
                        .filter(
                            (stagingArea) =>
                                !behaviorState.stagingAreasContacted[
                                    stagingArea
                                ]
                        )
                        .forEach((stagingArea) => {
                            issueCommand(
                                simulatedRegion,
                                draftState,
                                VehicleDataRequestedCommandEvent.create(
                                    stagingArea,
                                    true
                                )
                            );
                            issueCommand(
                                simulatedRegion,
                                draftState,
                                VehicleDataRequestedCommandEvent.create(
                                    stagingArea,
                                    false,
                                    COLLECT_VEHICLE_DATA_INTERVAL
                                )
                            );
                            behaviorState.stagingAreasContacted[stagingArea] =
                                true;
                        });
                }
                break;
            case 'patientDataReceivedEvent':
                {
                    logBehavior(
                        draftState,
                        [],
                        `Es wurden Patientendaten erhallten`,
                        simulatedRegion.id,
                        behaviorState.id
                    );
                    handlePatientDataReceived(
                        behaviorState,
                        event,
                        simulatedRegion,
                        draftState
                    );
                    assignVehicleBudgets(
                        behaviorState,
                        draftState,
                        simulatedRegion
                    );
                }
                break;
            case 'vehicleDataReceivedEvent':
                {
                    logBehavior(
                        draftState,
                        [],
                        `Es wurden Fahrzeugdaten erhallten`,
                        simulatedRegion.id,
                        behaviorState.id
                    );
                    handleVehicleDataReceived(behaviorState, event);
                    assignVehicleBudgets(
                        behaviorState,
                        draftState,
                        simulatedRegion
                    );
                }
                break;
            case 'treatmentProgressDataReceivedEvent':
                {
                    if (event.newProgress === 'secured') {
                        behaviorState.patientTraysSecured[
                            event.simulatedRegionId
                        ] = true;
                        behaviorState.vehiclesRequestedByRegions[
                            event.simulatedRegionId
                        ] = {};
                    } else {
                        delete behaviorState.patientTraysSecured[
                            event.simulatedRegionId
                        ];
                    }
                    if (event.newProgress === 'counted') {
                        issueCommand(
                            simulatedRegion,
                            draftState,
                            PatientDataRequestedCommandEvent.create(
                                event.simulatedRegionId,
                                false,
                                COLLECT_PATIENT_DATA_INTERVAL
                            )
                        );
                        issueCommand(
                            simulatedRegion,
                            draftState,
                            PatientDataRequestedCommandEvent.create(
                                event.simulatedRegionId,
                                true
                            )
                        );
                        issueCommand(
                            simulatedRegion,
                            draftState,
                            VehicleDataRequestedCommandEvent.create(
                                event.simulatedRegionId,
                                true
                            )
                        );
                        issueCommand(
                            simulatedRegion,
                            draftState,
                            VehicleDataRequestedCommandEvent.create(
                                event.simulatedRegionId,
                                false,
                                COLLECT_VEHICLE_DATA_INTERVAL_PT
                            )
                        );
                    }
                    logBehavior(
                        draftState,
                        [],
                        `Es wurde ein Behandlugsstatuswechsel erkannt`,
                        simulatedRegion.id,
                        behaviorState.id
                    );
                    assignVehicleBudgets(
                        behaviorState,
                        draftState,
                        simulatedRegion
                    );
                }
                break;
            case 'resourceRequestDataReceivedEvent':
                {
                    behaviorState.vehiclesRequestedByRegions[
                        event.simulatedRegion
                    ] = event.resourcesRequested.vehicleCounts;
                    logBehavior(
                        draftState,
                        [],
                        `Es wurde eine Fahrzeuganfrage erhallten`,
                        simulatedRegion.id,
                        behaviorState.id
                    );
                    assignVehicleBudgets(
                        behaviorState,
                        draftState,
                        simulatedRegion
                    );
                }
                break;
            default:
            // ignore event
        }
    },
};

function handlePatientDataReceived(
    commandBehaviorState: Mutable<CommandBehaviorState>,
    patientDataReceivedEvent: PatientDataReceivedEvent,
    simulatedRegion: Mutable<SimulatedRegion>,
    draftState: Mutable<ExerciseState>
) {
    if (!patientDataReceivedEvent.informationAvailable) {
        return;
    }
    // Data received
    commandBehaviorState.patientTraysWithInformation[
        patientDataReceivedEvent.simulatedRegion
    ] = true;
    // Update data
    commandBehaviorState.patientsExpectedInRegions[
        patientDataReceivedEvent.simulatedRegion
    ] = patientDataReceivedEvent.patientsInRegion;
    commandBehaviorState.patientsTransportedFromRegions[
        patientDataReceivedEvent.simulatedRegion
    ] = emptyPatientResourceDescription;
}

function handleVehicleDataReceived(
    commandBehaviorState: Mutable<CommandBehaviorState>,
    vehicleDataReceivedEvent: VehicleDataReceivedEvent
) {
    if (!vehicleDataReceivedEvent.informationAvailable) {
        // No vehicles in region
        console.log('Error in command behavior staging area not answering');
        return;
    }
    // Update data
    if (
        commandBehaviorState.stagingAreas[
            vehicleDataReceivedEvent.simulatedRegion
        ]
    ) {
        commandBehaviorState.totalVehiclesInStagingAreas =
            subtractPartialResourceDescriptions(
                commandBehaviorState.totalVehiclesInStagingAreas,
                commandBehaviorState.vehiclesExpectedInRegions[
                    vehicleDataReceivedEvent.simulatedRegion
                ] ?? {}
            ) as ResourceDescription;

        commandBehaviorState.totalVehiclesInStagingAreas =
            addPartialResourceDescriptions([
                commandBehaviorState.totalVehiclesInStagingAreas,
                vehicleDataReceivedEvent.vehiclesInRegion,
            ]) as ResourceDescription;
    }

    const newVehicles = subtractPartialResourceDescriptions(
        vehicleDataReceivedEvent.vehiclesInRegion,
        commandBehaviorState.vehiclesExpectedInRegions[
            vehicleDataReceivedEvent.simulatedRegion
        ] ?? {}
    ) as ResourceDescription;
    commandBehaviorState.vehiclesOnTheWayToRegions[
        vehicleDataReceivedEvent.simulatedRegion
    ] = minResourceDescription(
        subtractPartialResourceDescriptions(
            commandBehaviorState.vehiclesOnTheWayToRegions[
                vehicleDataReceivedEvent.simulatedRegion
            ] ?? {},
            newVehicles
        ) as ResourceDescription,
        0
    );
    commandBehaviorState.vehiclesExpectedInRegions[
        vehicleDataReceivedEvent.simulatedRegion
    ] = vehicleDataReceivedEvent.vehiclesInRegion;
}

function sendVehiclesToRegion(
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

function getTransferPointOfSimulatedRegion(
    simulatedRegionId: UUID,
    draftState: Mutable<ExerciseState>
): TransferPoint {
    return Object.values(draftState.transferPoints).find((transferPoint) =>
        isInSpecificSimulatedRegion(transferPoint, simulatedRegionId)
    )!;
}

function issueCommand(
    simulatedRegion: Mutable<SimulatedRegion>,
    draftState: Mutable<ExerciseState>,
    event: ExerciseSimulationEvent
) {
    addActivity(
        simulatedRegion,
        IssueCommandActivityState.create(nextUUID(draftState), event)
    );
}

function assignVehicleBudgets(
    commandBehaviorState: Mutable<CommandBehaviorState>,
    draftState: Mutable<ExerciseState>,
    simulatedRegion: Mutable<SimulatedRegion>
) {
    const unsecuredRegions = Object.keys(
        commandBehaviorState.patientTrays
    ).filter(
        (patientTray) => !commandBehaviorState.patientTraysSecured[patientTray]
    );
    // Guess 7% sk I 19% sk II 74% SK III nach DRK Heftchen Seite 39 unten oder BMI 2013 Sefrin et al 2013
    // Guess that trays are equally sized

    let averagePatientTraySize = Math.ceil(
        Object.keys(commandBehaviorState.patientTraysWithInformation).reduce(
            (totalNumberOfPatients, patientTrayId) =>
                totalNumberOfPatients +
                totalPatientsInRegion(patientTrayId, commandBehaviorState),
            0
        ) /
            Object.keys(
                commandBehaviorState.patientTraysWithInformation
            ).reduce((numberOfPatientTrays, _) => numberOfPatientTrays + 1, 0)
    );

    if (!averagePatientTraySize) {
        averagePatientTraySize = 0;
    }

    const assumedPatientsInRegion = Object.fromEntries(
        unsecuredRegions.map((region) => {
            let assumedPatients: ResourceDescription<PatientStatus>;
            if (
                commandBehaviorState.patientTraysWithInformation[region] &&
                commandBehaviorState.patientsExpectedInRegions[region]
            ) {
                assumedPatients =
                    commandBehaviorState.patientsExpectedInRegions[region]!;
            } else {
                assumedPatients = {
                    white: averagePatientTraySize,
                    black: 0,
                    blue: 0,
                    green: 0,
                    red: 0,
                    yellow: 0,
                };
            }
            // Ceil red and yellow to assume the worst and floor green to not assume way to many patients
            // TODO: use data from incident
            assumedPatients.red += Math.ceil(assumedPatients.white * 0.07);
            assumedPatients.yellow += Math.ceil(assumedPatients.white * 0.19);
            assumedPatients.green += Math.floor(assumedPatients.white * 0.74);
            assumedPatients.white = 0;
            return [region, assumedPatients];
        })
    );

    // Assume the following needs per region as max of needs as in const above and the requested vehicles

    const assumedPersonnelNeedsInRegion = Object.fromEntries(
        Object.entries(assumedPatientsInRegion).map(([region, patients]) => [
            region,
            subtractResourceDescription(
                // Factor in one nfs for lead of region
                addResourceDescription(personnelNeedsFromPatients(patients), {
                    gf: 0,
                    notarzt: 0,
                    notSan: 1,
                    rettSan: 0,
                    san: 0,
                }),
                personnelExpectedToGetToRegion(region, commandBehaviorState)
            ),
        ])
    );

    Object.keys(commandBehaviorState.patientTraysSecured).forEach((region) => {
        if (commandBehaviorState.vehiclesRequestedByRegions[region]) {
            assumedPersonnelNeedsInRegion[region] = vehiclesToPersonnel(
                commandBehaviorState.vehiclesRequestedByRegions[region]!
            );
        }
    });

    const remainingRequests = cloneDeep(
        commandBehaviorState.vehiclesRequestedByRegions
    );

    const remainingAvailableVehicles = subtractPartialResourceDescriptions(
        commandBehaviorState.totalVehiclesInStagingAreas,
        addPartialResourceDescriptions(
            Object.values(commandBehaviorState.vehiclesOnTheWayToRegions)
        )
    ) as ResourceDescription;

    const logVehicleValue = cloneDeep(remainingAvailableVehicles);

    const logNeedValue = cloneDeep(assumedPersonnelNeedsInRegion);

    let allocatedVehicles: {
        [simulatedRegionId: UUID]: ResourceDescription;
    } = {};

    const usableVehicles = new Set<string>();
    let needsLastIteration: { [x: string]: any } = {};

    for (const personnelType of [
        'notarzt',
        'notSan',
        'rettSan',
        'san',
    ] as PersonnelType[]) {
        Object.entries(personnelInVehicles)
            .filter(([_, personnel]) => personnel[personnelType] > 0)
            .map(([vehicleType, _]) => vehicleType)
            .forEach((a) => usableVehicles.add(a));
        // It is not unnecessary :)
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const assumedNeedsInRegion = StrictObject.entries(
            assumedPersonnelNeedsInRegion
            // eslint-disable-next-line @typescript-eslint/no-loop-func
        ).map(([region, needs]) => [
            region,
            needs[personnelType] +
                ((needsLastIteration[region] ?? 0) < 0
                    ? needsLastIteration[region]
                    : 0),
        ]) as [UUID, number][];

        console.log(
            `[${personnelType}] ${JSON.stringify(assumedNeedsInRegion)}`
        );

        while (areVehiclesLeft(usableVehicles, remainingAvailableVehicles)) {
            // TODO: Regions with no personnel have highest need
            // TODO: B raum nicht überfordern
            assumedNeedsInRegion.sort(([_a, a], [_b, b]) => b - a);
            if (!assumedNeedsInRegion[0] || assumedNeedsInRegion[0][1] <= 0) {
                break;
            }
            const region = assumedNeedsInRegion[0][0];
            // TODO: Use Vehicle that fits best
            let wantedVehicle = (Object.entries(
                remainingRequests[region] ?? {}
            ).filter(
                ([vehicleType, vehicleCount]) =>
                    usableVehicles.has(vehicleType) &&
                    vehicleCount > 0 &&
                    (remainingAvailableVehicles[vehicleType] ?? 0) > 0
            )[0] ?? [undefined])[0];
            if (!wantedVehicle) {
                // TODO: Use Vehicle that fits best
                wantedVehicle = Object.entries(
                    remainingAvailableVehicles
                ).filter(
                    ([vehicleType, vehicleCount]) =>
                        usableVehicles.has(vehicleType) && vehicleCount > 0
                )[0]![0];
            } else {
                remainingRequests[region]![wantedVehicle]--;
            }
            if (!allocatedVehicles[region]) {
                allocatedVehicles[region] = {};
            }
            if (!allocatedVehicles[region]![wantedVehicle]) {
                allocatedVehicles[region]![wantedVehicle] = 1;
            } else {
                allocatedVehicles[region]![wantedVehicle]++;
            }
            remainingAvailableVehicles[wantedVehicle]--;
            const a: any = {};
            a[wantedVehicle] = 1;
            assumedPersonnelNeedsInRegion[region] = subtractResourceDescription(
                assumedPersonnelNeedsInRegion[region]!,
                vehiclesToPersonnel(a)
            );
            assumedNeedsInRegion[0][1]--;
        }
        needsLastIteration = Object.fromEntries(assumedNeedsInRegion);
    }
    if (Object.keys(allocatedVehicles).length > 0) {
        logBehavior(
            draftState,
            [],
            `Die folgenden Fahrzeuge: ${displayAnyPerRegion(
                allocatedVehicles,
                draftState
            )} wurden basierend auf den folgenden Patientenzahlen: ${displayAnyPerRegion(
                assumedPatientsInRegion,
                draftState
            )}welche die folgenden Bedürfnisse infuzieren: ${displayAnyPerRegion(
                logNeedValue,
                draftState
            )} versendet. Die folgenden Fahrzeuge standen zur Verfügung:${JSON.stringify(
                logVehicleValue
            )}`,
            simulatedRegion.id,
            commandBehaviorState.id
        );
    }

    // TODO: Send excess requested vehicles if no more need determined (not if EV secured)
    Object.entries(allocatedVehicles).forEach(([region, vehicles]) =>
        sendVehiclesToRegion(
            region,
            vehicles,
            simulatedRegion,
            commandBehaviorState,
            draftState
        )
    );

    allocatedVehicles = {};

    // Transport to hospital

    const assumedPatientsNotTransportedInRegions = Object.fromEntries(
        Object.keys(commandBehaviorState.patientTrays).map((region) => [
            region,
            subtractResourceDescription(
                commandBehaviorState.patientsExpectedInRegions[region] ??
                    emptyPatientResourceDescription,
                commandBehaviorState.patientsTransportedFromRegions[region] ??
                    emptyPatientResourceDescription
            ),
        ])
    );

    for (const patientStatus of ['red', 'yellow', 'green'] as PatientStatus[]) {
        usableVehicles.clear();
        Object.entries(transportablePatients).forEach(([type, patients]) => {
            if (patients[patientStatus] > 0) {
                usableVehicles.add(type);
            }
        });

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const assumedPatientsOfCategoryNotTransportedInRegions = Object.entries(
            assumedPatientsNotTransportedInRegions
        ).map(([region, patients]) => [region, patients[patientStatus]]) as [
            UUID,
            number
        ][];

        while (areVehiclesLeft(usableVehicles, remainingAvailableVehicles)) {
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
                    usableVehicles.has(vehicleType) && vehicleCount > 0
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

            assumedPatientsOfCategoryNotTransportedInRegions[0][1]--;

            const res = cloneDeepMutable(
                commandBehaviorState.patientsTransportedFromRegions[region]
                    ? commandBehaviorState.patientsTransportedFromRegions[
                          region
                      ]!
                    : emptyPatientResourceDescription
            );
            res[patientStatus] +=
                transportablePatients[wantedVehicle]![patientStatus];

            commandBehaviorState.patientsTransportedFromRegions[region] = res;
        }
    }

    if (Object.keys(allocatedVehicles).length > 0) {
        logBehavior(
            draftState,
            [],
            `Die folgenden Fahrzeuge: ${displayAnyPerRegion(
                allocatedVehicles,
                draftState
            )} wurden basierend auf den folgenden Patientenzahlen: ${displayAnyPerRegion(
                assumedPatientsNotTransportedInRegions,
                draftState
            )}zum PAtientenabtransport versendet. Die folgenden Fahrzeuge standen zur Verfügung:${JSON.stringify(
                logVehicleValue
            )}`,
            simulatedRegion.id,
            commandBehaviorState.id
        );
    }

    // TODO: Send excess requested vehicles if no more need determined (not if EV secured)
    Object.entries(allocatedVehicles).forEach(([region, vehicles]) =>
        sendVehiclesToRegion(
            region,
            vehicles,
            simulatedRegion,
            commandBehaviorState,
            draftState,
            true
        )
    );
}

function totalPatientsInRegion(
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

function personnelNeedsFromPatients(
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

function isRegionExpectedToNOTGetALeader(
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

function personnelExpectedToGetToRegion(
    simulatedRegionId: UUID,
    commandBehaviorState: CommandBehaviorState
): ResourceDescription<PersonnelType> {
    const vehiclesExpectedToBeInRegion = addPartialResourceDescriptions([
        commandBehaviorState.vehiclesExpectedInRegions[simulatedRegionId] ?? {},
        commandBehaviorState.vehiclesOnTheWayToRegions[simulatedRegionId] ?? {},
    ]) as ResourceDescription;
    return vehiclesToPersonnel(vehiclesExpectedToBeInRegion);
}

function vehiclesToPersonnel(
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

function areVehiclesLeft(
    vehicleTypes: Set<string>,
    vehicles: ResourceDescription
): boolean {
    return Object.entries(vehicles).some(
        ([vehicleType, vehicleCount]) =>
            vehicleTypes.has(vehicleType) && vehicleCount > 0
    );
}

function noMorePersonnelNeeded(
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

function canStartTransport(
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

function displayAnyPerRegion(
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
