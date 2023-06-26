import { IsUUID } from 'class-validator';
import { getCreate } from '../../models/utils/get-create';
import { IsValue } from '../../utils/validators';
import { UUID, uuidValidationOptions } from '../../utils';
import type { SimulationEvent } from './simulation-event';

export class StartTransferToHospitalCommandEvent implements SimulationEvent {
    @IsValue('startTransferToHospitalCommandEvent')
    readonly type = 'startTransferToHospitalCommandEvent';

    @IsUUID(4, uuidValidationOptions)
    readonly simulatedRegion: UUID;

    /**
     * @deprecated Use {@link create} instead
     */
    constructor(simulatedRegion: UUID) {
        this.simulatedRegion = simulatedRegion;
    }

    static readonly create = getCreate(this);
}
