import { IsUUID } from 'class-validator';
import { getCreate } from '../../../models/utils';
import { UUID, uuidValidationOptions } from '../../../utils';
import { IsValue } from '../../../utils/validators';
import type { SimulationEvent } from '../simulation-event';

export class CollectVehicleCountEvent implements SimulationEvent {
    @IsValue('collectVehicleCountEvent')
    readonly type = 'collectVehicleCountEvent';

    @IsUUID(4, uuidValidationOptions)
    readonly generateReportActivityId: UUID;

    /**
     * @deprecated Use {@link create} instead.
     */
    constructor(generateReportActivityId: UUID) {
        this.generateReportActivityId = generateReportActivityId;
    }

    static readonly create = getCreate(this);
}
