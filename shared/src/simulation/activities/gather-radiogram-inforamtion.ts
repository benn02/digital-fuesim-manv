import { IsUUID } from 'class-validator';
import { noop } from 'lodash-es';
import { getCreate } from '../../models/utils/get-create';
import { UUID, uuidValidationOptions } from '../../utils';
import { IsValue } from '../../utils/validators';
import { sendSimulationEvent } from '../events/utils';
import { PatientDataReceivedEvent } from '../events/patient-data-received';
import { isUnread } from '../../models/radiogram/radiogram-helpers';
import { markRadiogramDone } from '../../models/radiogram/radiogram-helpers-mutable';
import { TreatmentProgressDataReceivedEvent } from '../events/treatment-progress-data-received';
import { VehicleDataReceivedEvent } from '../events/vehicle-data-received';
import { TransferConnectionMissingDataReceivedEvent } from '../events/transfer-connection-missing-data-received';
import { ResourceRequestDataReceivedEvent } from '../events/resource-request-data-received';
import type {
    SimulationActivity,
    SimulationActivityState,
} from './simulation-activity';

export class GatherRadiogramInformationActivityState
    implements SimulationActivityState
{
    @IsValue('gatherRadiogramInformationActivity' as const)
    public readonly type = 'gatherRadiogramInformationActivity';

    @IsUUID(4, uuidValidationOptions)
    public readonly id: UUID;

    /**
     * @deprecated Use {@link create} instead
     */
    constructor(id: UUID) {
        this.id = id;
    }

    static readonly create = getCreate(this);
}

export const gatherRadiogramInformationActivity: SimulationActivity<GatherRadiogramInformationActivityState> =
    {
        activityState: GatherRadiogramInformationActivityState,
        tick(
            draftState,
            simulatedRegion,
            activityState,
            _tickInterval,
            terminate
        ) {
            const unreadRadiograms = Object.values(
                draftState.radiograms
            ).filter((radiogram) => isUnread(radiogram));
            for (const radiogram of unreadRadiograms) {
                switch (radiogram.type) {
                    case 'materialCountRadiogram':
                        {
                            // Not needed
                            noop();
                        }
                        break;
                    case 'missingTransferConnectionRadiogram':
                        {
                            sendSimulationEvent(
                                simulatedRegion,
                                TransferConnectionMissingDataReceivedEvent.create(
                                    radiogram.simulatedRegionId,
                                    radiogram.targetTransferPointId
                                )
                            );
                            markRadiogramDone(draftState, radiogram.id);
                        }
                        break;

                    case 'personnelCountRadiogram':
                        {
                            // Not needed
                            noop();
                        }
                        break;
                    case 'resourceRequestRadiogram':
                        {
                            sendSimulationEvent(
                                simulatedRegion,
                                ResourceRequestDataReceivedEvent.create(
                                    radiogram.simulatedRegionId,
                                    radiogram.requiredResource
                                )
                            );
                            markRadiogramDone(draftState, radiogram.id);
                        }
                        break;
                    case 'transferCategoryCompletedRadiogram':
                        {
                            noop();
                        }
                        break;
                    case 'transferCountsRadiogram':
                        {
                            noop();
                        }
                        break;
                    case 'treatmentStatusRadiogram':
                        {
                            sendSimulationEvent(
                                simulatedRegion,
                                TreatmentProgressDataReceivedEvent.create(
                                    radiogram.simulatedRegionId,
                                    radiogram.treatmentStatus
                                )
                            );
                            markRadiogramDone(draftState, radiogram.id);
                        }
                        break;
                    case 'newPatientDataRequestedRadiogram':
                        {
                            noop();
                        }
                        break;
                    case 'patientCountRadiogram':
                        {
                            sendSimulationEvent(
                                simulatedRegion,
                                PatientDataReceivedEvent.create(
                                    radiogram.simulatedRegionId,
                                    radiogram.patientCount,
                                    radiogram.informationAvailable
                                )
                            );
                            markRadiogramDone(draftState, radiogram.id);
                        }
                        break;
                    case 'vehicleCountRadiogram':
                        {
                            sendSimulationEvent(
                                simulatedRegion,
                                VehicleDataReceivedEvent.create(
                                    radiogram.simulatedRegionId,
                                    radiogram.vehicleCount,
                                    radiogram.informationAvailable
                                )
                            );
                            markRadiogramDone(draftState, radiogram.id);
                        }
                        break;
                    default:
                    // ignore radiogram
                }
            }
            terminate();
        },
    };
