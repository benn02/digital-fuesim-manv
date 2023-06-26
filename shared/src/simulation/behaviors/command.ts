import { IsUUID } from 'class-validator';
import { getCreate } from '../../models/utils/get-create';
import { UUID, UUIDSet, uuid, uuidValidationOptions } from '../../utils';
import { IsUUIDSet, IsValue } from '../../utils/validators';

import type { ResourceDescription } from '../../models/utils/resource-description';
import { IsPatientsPerUUID } from '../../utils/validators/is-patients-per-uuid';
import type { PatientStatus } from '../../models/utils/patient-status';
import { sendSimulationEvent } from '../events/utils';
import { PatientDataRequestedCommandEvent } from '../events/patient-data-requested-command';
import type {
    SimulationBehavior,
    SimulationBehaviorState,
} from './simulation-behavior';

interface PatientsPerRegion {
    [simulatedRegionId: UUID]: ResourceDescription<PatientStatus>;
}

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

    static readonly create = getCreate(this);
}

export const commandBehavior: SimulationBehavior<CommandBehaviorState> = {
    behaviorState: CommandBehaviorState,
    handleEvent(draftState, simulatedRegion, behaviorState, event) {
        switch (event.type) {
            case 'tickEvent':
                {
                    sendSimulationEvent(
                        simulatedRegion,
                        PatientDataRequestedCommandEvent.create(
                            Object.keys(behaviorState.patientTrays)[0]!,
                            true
                        )
                    );
                }
                break;
            case 'patientDataReceivedEvent':
                {
                    console.log(JSON.stringify(event));
                }
                break;
            default:
            // ignore event
        }
    },
};
