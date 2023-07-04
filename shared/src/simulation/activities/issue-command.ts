import { Type } from 'class-transformer';
import { IsUUID, ValidateNested } from 'class-validator';
import { UUID, uuidValidationOptions } from '../../utils';
import { IsValue } from '../../utils/validators';
import { sendSimulationEvent } from '../events/utils';
import { getCreate } from '../../models/utils/get-create';
import {
    ExerciseSimulationEvent,
    simulationEventTypeOptions,
} from '../events/exercise-simulation-event';
import type {
    SimulationActivity,
    SimulationActivityState,
} from './simulation-activity';

export class IssueCommandActivityState implements SimulationActivityState {
    @IsValue('issueCommandActivity' as const)
    public readonly type = 'issueCommandActivity';

    @IsUUID(4, uuidValidationOptions)
    public readonly id: UUID;

    @Type(...simulationEventTypeOptions)
    @ValidateNested()
    public readonly event: ExerciseSimulationEvent;

    /**
     * @deprecated Use {@link create} instead
     */
    constructor(id: UUID, event: ExerciseSimulationEvent) {
        this.id = id;
        this.event = event;
    }

    static readonly create = getCreate(this);
}

export const issueCommandActivity: SimulationActivity<IssueCommandActivityState> =
    {
        activityState: IssueCommandActivityState,
        tick(
            _draftState,
            simulatedRegion,
            activityState,
            _tickInterval,
            terminate
        ) {
            sendSimulationEvent(simulatedRegion, activityState.event);
            terminate();
        },
    };
