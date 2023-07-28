import { IsInt, IsUUID, ValidateIf } from 'class-validator';
import cloneDeep from 'lodash-es/cloneDeep';
import { getCreate } from '../../../models/utils/get-create';
import type { Mutable } from '../../../utils';
import {
    StrictObject,
    UUID,
    UUIDSet,
    uuid,
    uuidValidationOptions,
} from '../../../utils';
import { IsUUIDSet, IsValue } from '../../../utils/validators';

import {
    type ResourceDescription,
    addPartialResourceDescriptions,
    subtractPartialResourceDescriptions,
    addResourceDescription,
    subtractResourceDescription,
    minResourceDescription,
    maxBetweenResourceDescriptions,
    minBetweenResourceDescriptions,
} from '../../../models/utils/resource-description';
import { IsPatientsPerUUID } from '../../../utils/validators/is-patients-per-uuid';
import type { PatientStatus } from '../../../models/utils/patient-status';
import type { PatientDataReceivedEvent } from '../../events/patient-data-received';
import type { SimulatedRegion } from '../../../models/simulated-region';
import type { ExerciseState } from '../../../state';
import { PatientDataRequestedCommandEvent } from '../../events/patient-data-requested-command';
import { VehicleDataRequestedCommandEvent } from '../../events/vehicle-data-requested-command';
import type { VehicleDataReceivedEvent } from '../../events/vehicle-data-received';
import { IsResourceDescription } from '../../../utils/validators/is-resource-description';
import type { PersonnelType } from '../../../models/utils/personnel-type';
import { logBehavior } from '../../../store/action-reducers/utils/log';
import { SendAlarmGroupCommandEvent } from '../../events/send-alarm-group-command';
import type {
    SimulationBehavior,
    SimulationBehaviorState,
} from '../simulation-behavior';
import {
    COLLECT_PATIENT_DATA_INTERVAL,
    COLLECT_VEHICLE_DATA_INTERVAL,
    COLLECT_VEHICLE_DATA_INTERVAL_PT,
    PatientsPerRegion,
    VehiclesPerRegion,
    emptyPatientResourceDescription,
    personnelInVehicles,
} from './constants';
import {
    areVehiclesLeft,
    displayAnyPerRegion,
    getTransferPointOfSimulatedRegion,
    issueCommand,
    nameOfSimulatedRegion,
    patientsAfterTransport,
    personnelExpectedToGetToRegion,
    personnelNeedsFromPatients,
    sendVehiclesToRegion,
    totalPatientsInRegion,
    totalResources,
    vehiclesToPersonnel,
} from './helpers';
import { calculateVehicleAllocationForHospitalTransport } from './allocations';

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

    @IsInt()
    public readonly alarmGroupPatients: number = 0;

    @IsInt()
    public readonly ticks: number = 0;

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
                    behaviorState.ticks++;
                    if (behaviorState.ticks === 5) {
                        behaviorState.ticks = 0;
                        assignVehicleBudgets(
                            behaviorState,
                            draftState,
                            simulatedRegion
                        );
                    }
                    Object.keys(behaviorState.patientTrays)
                        .filter(
                            (patientTray) =>
                                !behaviorState.patientTraysContacted[
                                    patientTray
                                ]
                        )
                        .forEach((patientTray) => {
                            /*issueCommand(
                                simulatedRegion,
                                draftState,
                                PatientDataRequestedCommandEvent.create(
                                    patientTray,
                                    true
                                )
                            );*/
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
                        `Es wurden Patientendaten von ${nameOfSimulatedRegion(
                            event.simulatedRegion,
                            draftState
                        )} erhallten`,
                        simulatedRegion.id,
                        behaviorState.id
                    );
                    handlePatientDataReceived(
                        behaviorState,
                        event,
                        simulatedRegion,
                        draftState
                    );
                }
                break;
            case 'vehicleDataReceivedEvent':
                {
                    logBehavior(
                        draftState,
                        [],
                        `Es wurden Fahrzeugdaten von ${nameOfSimulatedRegion(
                            event.simulatedRegion,
                            draftState
                        )} erhallten`,
                        simulatedRegion.id,
                        behaviorState.id
                    );
                    handleVehicleDataReceived(behaviorState, event);
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
                    issueCommand(
                        simulatedRegion,
                        draftState,
                        PatientDataRequestedCommandEvent.create(
                            event.simulatedRegionId,
                            true
                        )
                    );
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
                        `Es wurde ein Behandlugsstatuswechsel in ${nameOfSimulatedRegion(
                            event.simulatedRegionId,
                            draftState
                        )} erkannt`,
                        simulatedRegion.id,
                        behaviorState.id
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
    let vehiclesInRegion = vehicleDataReceivedEvent.vehiclesInRegion;
    // Update data
    if (
        commandBehaviorState.stagingAreas[
            vehicleDataReceivedEvent.simulatedRegion
        ]
    ) {
        // Remove SA Leader
        vehiclesInRegion = subtractPartialResourceDescriptions(
            vehiclesInRegion,
            { RTW: 1 }
        ) as ResourceDescription;

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
                vehiclesInRegion,
            ]) as ResourceDescription;
    }

    const newVehicles = subtractPartialResourceDescriptions(
        vehiclesInRegion,
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
    ] = vehiclesInRegion;
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

    const numInformedRegions = Object.keys(
        commandBehaviorState.patientTraysWithInformation
    ).length;

    const numPatientsInInformedRegions = Object.keys(
        commandBehaviorState.patientTraysWithInformation
    ).reduce(
        (totalNumberOfPatients, patientTrayId) =>
            totalNumberOfPatients +
            totalPatientsInRegion(patientTrayId, commandBehaviorState),
        0
    );

    const numRegions = Object.keys(commandBehaviorState.patientTrays).length;

    const numUninformedRegions = numRegions - numInformedRegions;

    let averagePatientTraySize = Math.ceil(
        numPatientsInInformedRegions / numInformedRegions
    );

    if (!averagePatientTraySize) {
        averagePatientTraySize = 5; // TODO: Magic Number
    }

    const assumedNumPatients =
        10 *
        Math.ceil(
            0.1 *
                ((2 / 3) * numUninformedRegions * averagePatientTraySize +
                    numPatientsInInformedRegions)
        ); // TODO: Magic Number

    if (assumedNumPatients > commandBehaviorState.alarmGroupPatients) {
        commandBehaviorState.alarmGroupPatients = assumedNumPatients;
        issueCommand(
            simulatedRegion,
            draftState,
            SendAlarmGroupCommandEvent.create(
                getTransferPointOfSimulatedRegion(
                    Object.keys(commandBehaviorState.stagingAreas)[0]!,
                    draftState
                ).id,
                assumedNumPatients
            )
        );
        logBehavior(
            draftState,
            [],
            `Es wurden Alarmgruppen für ${assumedNumPatients} Patienten bestellt basierend auf ${numPatientsInInformedRegions} bekannten und ${
                numUninformedRegions * averagePatientTraySize
            } vorhergesagten Patienten.`,
            simulatedRegion.id,
            commandBehaviorState.id
        );
    }

    const assumedPatientsInRegion = Object.fromEntries(
        unsecuredRegions.map((region) => {
            let assumedPatients: ResourceDescription<PatientStatus>;
            if (
                commandBehaviorState.patientTraysWithInformation[region] &&
                commandBehaviorState.patientsExpectedInRegions[region]
            ) {
                assumedPatients = cloneDeep(
                    commandBehaviorState.patientsExpectedInRegions[region]!
                );
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

    let remainingAvailableVehicles = subtractPartialResourceDescriptions(
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

    // TODO: Hübscher refactoren (vlt funktionen assign for treat/transport)

    const assumedPatientsNotTransportedInRegionsRed = Object.fromEntries(
        Object.keys(commandBehaviorState.patientTrays).map((region) => [
            region,
            minBetweenResourceDescriptions(
                {
                    black: 0,
                    blue: 0,
                    green: 0,
                    red: 100,
                    white: 0,
                    yellow: 0,
                },
                subtractResourceDescription(
                    commandBehaviorState.patientsExpectedInRegions[region] ??
                        emptyPatientResourceDescription,
                    commandBehaviorState.patientsTransportedFromRegions[
                        region
                    ] ?? emptyPatientResourceDescription
                )
            ),
        ])
    );

    allocatedVehicles = calculateVehicleAllocationForHospitalTransport(
        assumedPatientsNotTransportedInRegionsRed,
        remainingAvailableVehicles
    );

    if (totalResources(remainingAvailableVehicles) > 0) {
        logBehavior(
            draftState,
            [],
            `Die folgenden Fahrzeuge: ${displayAnyPerRegion(
                allocatedVehicles,
                draftState
            )} wurden basierend auf den folgenden Patientenzahlen: ${displayAnyPerRegion(
                assumedPatientsNotTransportedInRegionsRed,
                draftState
            )}zum Patientenabtransport roter Patienten versendet. Die folgenden Fahrzeuge standen zur Verfügung:${JSON.stringify(
                remainingAvailableVehicles
            )}`,
            simulatedRegion.id,
            commandBehaviorState.id
        );
    }

    Object.entries(allocatedVehicles).forEach(([region, vehicles]) => {
        sendVehiclesToRegion(
            region,
            vehicles,
            simulatedRegion,
            commandBehaviorState,
            draftState,
            true
        );
        commandBehaviorState.patientsTransportedFromRegions[region] =
            patientsAfterTransport(
                commandBehaviorState.patientsTransportedFromRegions[region] ??
                    emptyPatientResourceDescription,
                vehicles
            );
    });

    const totalAllocatedVehicles = addPartialResourceDescriptions(
        Object.values(allocatedVehicles)
    );
    remainingAvailableVehicles = cloneDeep(
        subtractPartialResourceDescriptions(
            remainingAvailableVehicles,
            totalAllocatedVehicles
        ) as ResourceDescription
    );

    allocatedVehicles = {};

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

        while (areVehiclesLeft(usableVehicles, remainingAvailableVehicles)) {
            // TODO: Regions with no personnel have highest need
            // TODO: B raum nicht überfordern
            // TODO: also send when no data but v in braum
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
            )}welche die folgenden Bedürfnisse indizieren: ${displayAnyPerRegion(
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

    allocatedVehicles = calculateVehicleAllocationForHospitalTransport(
        assumedPatientsNotTransportedInRegions,
        remainingAvailableVehicles
    );

    if (totalResources(remainingAvailableVehicles) > 0) {
        logBehavior(
            draftState,
            [],
            `Die folgenden Fahrzeuge: ${displayAnyPerRegion(
                allocatedVehicles,
                draftState
            )} wurden basierend auf den folgenden Patientenzahlen: ${displayAnyPerRegion(
                assumedPatientsNotTransportedInRegions,
                draftState
            )}zum Patientenabtransport versendet. Die folgenden Fahrzeuge standen zur Verfügung:${JSON.stringify(
                remainingAvailableVehicles
            )}`,
            simulatedRegion.id,
            commandBehaviorState.id
        );
    }

    // TODO: Send excess requested vehicles if no more need determined (not if EV secured)
    Object.entries(allocatedVehicles).forEach(([region, vehicles]) => {
        sendVehiclesToRegion(
            region,
            vehicles,
            simulatedRegion,
            commandBehaviorState,
            draftState,
            true
        );
        commandBehaviorState.patientsTransportedFromRegions[region] =
            patientsAfterTransport(
                commandBehaviorState.patientsTransportedFromRegions[region] ??
                    emptyPatientResourceDescription,
                vehicles
            );
    });
}
