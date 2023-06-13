import { IsUUID } from 'class-validator';
import { noop } from 'lodash-es';
import { getCreate } from '../../models/utils/get-create';
import { UUID, UUIDSet, uuid, uuidValidationOptions } from '../../utils';
import { IsUUIDSet, IsValue } from '../../utils/validators';

import type {
    SimulationBehavior,
    SimulationBehaviorState,
} from './simulation-behavior';

export class CommandBehaviorState implements SimulationBehaviorState {
    @IsValue('commandBehavior' as const)
    readonly type = 'commandBehavior';

    @IsUUID(4, uuidValidationOptions)
    public readonly id: UUID = uuid();

    @IsUUIDSet()
    public readonly stagingAreas: UUIDSet = {};

    @IsUUIDSet()
    public readonly patientTrays: UUIDSet = {};

    static readonly create = getCreate(this);
}

export const commandBehavior: SimulationBehavior<CommandBehaviorState> = {
    behaviorState: CommandBehaviorState,
    handleEvent(draftState, simulatedRegion, behaviorState, event) {
        noop();
    },
};
