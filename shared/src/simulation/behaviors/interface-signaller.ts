import { IsUUID } from 'class-validator';
import { getCreate } from '../../models/utils/get-create';
import { UUID, UUIDSet, uuid, uuidValidationOptions } from '../../utils';
import { IsUUIDSet, IsValue } from '../../utils/validators';

import { addActivity } from '../activities/utils';
import { GatherRadiogramInformationActivityState } from '../activities/gather-radiogram-inforamtion';
import { nextUUID } from '../utils/randomness';
import { SimulationActionReducers } from '../../store/action-reducers/simulation';
import { getElement } from '../../store/action-reducers/utils';
import { IsResourceDescription } from '../../utils/validators/is-resource-description';
import { ResourceDescription } from '../../models/utils/resource-description';
import { EmergencyOperationCenterActionReducers } from '../../store/action-reducers/emergency-operation-center';
import { SendRemoteEventActivityState } from '../activities';
import { TransferVehiclesRequestEvent } from '../events';
import type {
    SimulationBehavior,
    SimulationBehaviorState,
} from './simulation-behavior';

export class InterfaceSignallerBehaviorState
    implements SimulationBehaviorState
{
    @IsValue('interfaceSignallerBehavior' as const)
    readonly type = 'interfaceSignallerBehavior';

    /**
     * Maps Alarm group uuids to the amount of patients the alarm group and all those meant for lower numbers are meant for
     */

    @IsResourceDescription()
    public readonly knownAlarmGroups: ResourceDescription = {};

    @IsUUIDSet()
    public readonly calledAlarmGroups: UUIDSet = {};

    @IsUUID(4, uuidValidationOptions)
    public readonly id: UUID = uuid();

    static readonly create = getCreate(this);
}

export const interfaceSignallerBehavior: SimulationBehavior<InterfaceSignallerBehaviorState> =
    {
        behaviorState: InterfaceSignallerBehaviorState,
        handleEvent(draftState, simulatedRegion, behaviorState, event) {
            switch (event.type) {
                case 'tickEvent':
                    {
                        addActivity(
                            simulatedRegion,
                            GatherRadiogramInformationActivityState.create(
                                nextUUID(draftState)
                            )
                        );
                    }
                    break;
                case 'patientDataRequestedCommandEvent':
                    {
                        if (event.onlyOnce) {
                            SimulationActionReducers.createReport.reducer(
                                draftState,
                                {
                                    type: '[ReportBehavior] Create Report',
                                    simulatedRegionId: event.simulatedRegion,
                                    informationType: 'patientCount',
                                }
                            );
                        } else {
                            SimulationActionReducers.createRecurringReports.reducer(
                                draftState,
                                {
                                    type: '[ReportBehavior] Create Recurring Report',
                                    simulatedRegionId: event.simulatedRegion,
                                    informationType: 'patientCount',
                                    interval: event.interval!,
                                    behaviorId: getElement(
                                        draftState,
                                        'simulatedRegion',
                                        event.simulatedRegion
                                    ).behaviors.find(
                                        (behavior) =>
                                            behavior.type === 'reportBehavior'
                                    )!.id,
                                }
                            );
                        }
                    }
                    break;
                case 'vehicleDataRequestedCommandEvent':
                    {
                        if (event.onlyOnce) {
                            SimulationActionReducers.createReport.reducer(
                                draftState,
                                {
                                    type: '[ReportBehavior] Create Report',
                                    simulatedRegionId: event.simulatedRegion,
                                    informationType: 'vehicleCount',
                                }
                            );
                        } else {
                            SimulationActionReducers.createRecurringReports.reducer(
                                draftState,
                                {
                                    type: '[ReportBehavior] Create Recurring Report',
                                    simulatedRegionId: event.simulatedRegion,
                                    informationType: 'vehicleCount',
                                    interval: event.interval!,
                                    behaviorId: getElement(
                                        draftState,
                                        'simulatedRegion',
                                        event.simulatedRegion
                                    ).behaviors.find(
                                        (behavior) =>
                                            behavior.type === 'reportBehavior'
                                    )!.id,
                                }
                            );
                        }
                    }
                    break;

                case 'sendAlarmGroupCommandEvent':
                    {
                        Object.entries(behaviorState.knownAlarmGroups).forEach(
                            ([alarmGroupId, patientAmount]) => {
                                if (
                                    patientAmount <= event.patients &&
                                    !behaviorState.calledAlarmGroups[
                                        alarmGroupId
                                    ]
                                ) {
                                    EmergencyOperationCenterActionReducers.sendAlarmGroup.reducer(
                                        draftState,
                                        {
                                            type: '[Emergency Operation Center] Send Alarm Group',
                                            alarmGroupId,
                                            clientName:
                                                'Simulierter Schnittstellenfunker',
                                            firstVehiclesCount: 0,
                                            firstVehiclesTargetTransferPointId:
                                                event.targetSimulatedRegion,
                                            targetTransferPointId:
                                                event.targetSimulatedRegion,
                                        }
                                    );
                                    behaviorState.calledAlarmGroups[
                                        alarmGroupId
                                    ] = true;
                                }
                            }
                        );
                    }
                    break;
                case 'startTransferToHospitalCommandEvent':
                    {
                        SimulationActionReducers.startTransport.reducer(
                            draftState,
                            {
                                type: '[ManagePatientsTransportToHospitalBehavior] Start Transport',
                                simulatedRegionId: event.simulatedRegion,
                                behaviorId: getElement(
                                    draftState,
                                    'simulatedRegion',
                                    event.simulatedRegion
                                ).behaviors.find(
                                    (behavior) =>
                                        behavior.type ===
                                        'managePatientTransportToHospitalBehavior'
                                )!.id,
                            }
                        );
                    }
                    break;
                case 'transferVehiclesCommandEvent':
                    {
                        addActivity(
                            simulatedRegion,
                            SendRemoteEventActivityState.create(
                                nextUUID(draftState),
                                event.simulatedRegion,
                                TransferVehiclesRequestEvent.create(
                                    event.requestedVehicles,
                                    'transferPoint',
                                    event.transferDestinationId,
                                    simulatedRegion.id,
                                    undefined,
                                    event.successorOccupation
                                )
                            )
                        );
                    }
                    break;
                default:
                // ignore Event58
            }
        },
    };
