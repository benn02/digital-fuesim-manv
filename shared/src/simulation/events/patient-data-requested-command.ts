import { IsBoolean, IsInt, IsUUID } from 'class-validator';
import { getCreate } from '../../models/utils/get-create';
import { IsValue } from '../../utils/validators';
import { UUID, uuidValidationOptions } from '../../utils';
import type { SimulationEvent } from './simulation-event';

export class PatientDataRequestedCommandEvent implements SimulationEvent {
    @IsValue('patientDataRequestedCommandEvent')
    readonly type = 'patientDataRequestedCommandEvent';

    @IsUUID(4, uuidValidationOptions)
    readonly simulatedRegion: UUID;

    @IsBoolean()
    readonly onlyOnce: boolean;

    @IsInt()
    readonly interval?: number;

    /**
     * @deprecated Use {@link create} instead
     */
    constructor(simulatedRegion: UUID, onlyOnce: boolean, interval?: number) {
        this.simulatedRegion = simulatedRegion;
        this.onlyOnce = onlyOnce;
        this.interval = interval;
    }

    static readonly create = getCreate(this);
}
