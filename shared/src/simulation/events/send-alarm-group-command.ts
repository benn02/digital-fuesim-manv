import { IsInt, IsUUID } from 'class-validator';
import { getCreate } from '../../models/utils/get-create';
import { IsValue } from '../../utils/validators';
import { UUID, uuidValidationOptions } from '../../utils';
import type { SimulationEvent } from './simulation-event';

export class SendAlarmGroupCommandEvent implements SimulationEvent {
    @IsValue('sendAlarmGroupCommandEvent')
    readonly type = 'sendAlarmGroupCommandEvent';

    @IsUUID(4, uuidValidationOptions)
    readonly targetSimulatedRegion: UUID;

    /**
     * The Number of patients that are to be treated in total *NOT* additionally
     */

    @IsInt()
    readonly patients: number;

    /**
     * @deprecated Use {@link create} instead
     */
    constructor(targetSimulatedRegion: UUID, patients: number) {
        this.targetSimulatedRegion = targetSimulatedRegion;
        this.patients = patients;
    }

    static readonly create = getCreate(this);
}
