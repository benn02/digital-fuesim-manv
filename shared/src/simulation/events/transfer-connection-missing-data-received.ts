import { IsUUID } from 'class-validator';
import { getCreate } from '../../models/utils/get-create';
import { IsValue } from '../../utils/validators';
import {} from '../utils/treatment';
import { UUID, uuidArrayValidationOptions } from '../../utils';
import type { SimulationEvent } from './simulation-event';

export class TransferConnectionMissingDataReceivedEvent
    implements SimulationEvent
{
    @IsValue('transferConnectionMissingDataReceivedEvent')
    readonly type = 'transferConnectionMissingDataReceivedEvent';

    @IsUUID(4, uuidArrayValidationOptions)
    readonly simulatedRegionId: UUID;

    @IsUUID(4, uuidArrayValidationOptions)
    readonly transferPointId: UUID;

    /**
     * @deprecated Use {@link create} instead
     */
    constructor(simulatedRegionId: UUID, transferPointId: UUID) {
        this.simulatedRegionId = simulatedRegionId;
        this.transferPointId = transferPointId;
    }

    static readonly create = getCreate(this);
}
