import { IsUUID } from 'class-validator';
import { getCreate } from '../../models/utils/get-create';
import { IsLiteralUnion, IsValue } from '../../utils/validators';
import {
    TreatmentProgress,
    treatmentProgressAllowedValues,
} from '../utils/treatment';
import { UUID, uuidArrayValidationOptions } from '../../utils';
import type { SimulationEvent } from './simulation-event';

export class TreatmentProgressDataReceivedEvent implements SimulationEvent {
    @IsValue('treatmentProgressDataReceivedEvent')
    readonly type = 'treatmentProgressDataReceivedEvent';

    @IsUUID(4, uuidArrayValidationOptions)
    readonly simulatedRegionId: UUID;

    @IsLiteralUnion(treatmentProgressAllowedValues)
    readonly newProgress: TreatmentProgress;

    /**
     * @deprecated Use {@link create} instead
     */
    constructor(simulatedRegionId: UUID, newProgress: TreatmentProgress) {
        this.simulatedRegionId = simulatedRegionId;
        this.newProgress = newProgress;
    }

    static readonly create = getCreate(this);
}
