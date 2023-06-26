import { IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { getCreate } from '../../models/utils/get-create';
import { IsValue } from '../../utils/validators';
import { UUID, uuidValidationOptions } from '../../utils';
import { VehicleResource } from '../../models/utils/rescue-resource';
import type { SimulationEvent } from './simulation-event';

export class ResourceRequestDataReceivedEvent implements SimulationEvent {
    @IsValue('resourceRequestDataReceivedEvent')
    readonly type = 'resourceRequestDataReceivedEvent';

    @IsUUID(4, uuidValidationOptions)
    readonly simulatedRegion: UUID;

    @Type(() => VehicleResource)
    @ValidateNested()
    readonly resourcesRequested: VehicleResource;

    /**
     * @deprecated Use {@link create} instead
     */
    constructor(simulatedRegion: UUID, resourcesRequested: VehicleResource) {
        this.simulatedRegion = simulatedRegion;
        this.resourcesRequested = resourcesRequested;
    }

    static readonly create = getCreate(this);
}
