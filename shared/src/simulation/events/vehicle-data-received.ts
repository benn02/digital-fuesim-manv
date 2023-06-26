import { IsBoolean, IsUUID } from 'class-validator';
import { getCreate } from '../../models/utils/get-create';
import { IsValue } from '../../utils/validators';
import { UUID, uuidValidationOptions } from '../../utils';
import { IsResourceDescription } from '../../utils/validators/is-resource-description';
import { ResourceDescription } from '../../models/utils/resource-description';
import type { SimulationEvent } from './simulation-event';

export class VehicleDataReceivedEvent implements SimulationEvent {
    @IsValue('vehicleDataReceivedEvent')
    readonly type = 'vehicleDataReceivedEvent';

    @IsUUID(4, uuidValidationOptions)
    readonly simulatedRegion: UUID;

    @IsResourceDescription()
    readonly vehiclesInRegion: ResourceDescription;

    @IsBoolean()
    readonly informationAvailable: boolean;

    /**
     * @deprecated Use {@link create} instead
     */
    constructor(
        simulatedRegion: UUID,
        vehiclesInRegion: ResourceDescription,
        informationAvailable: boolean
    ) {
        this.simulatedRegion = simulatedRegion;
        this.vehiclesInRegion = vehiclesInRegion;
        this.informationAvailable = informationAvailable;
    }

    static readonly create = getCreate(this);
}
