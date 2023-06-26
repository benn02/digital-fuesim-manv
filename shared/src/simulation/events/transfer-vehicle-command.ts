import { IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { getCreate } from '../../models/utils/get-create';
import { IsValue } from '../../utils/validators';
import { UUID, uuidValidationOptions } from '../../utils';
import { IsResourceDescription } from '../../utils/validators/is-resource-description';
import { ResourceDescription } from '../../models/utils/resource-description';
import {
    ExerciseOccupation,
    occupationTypeOptions,
} from '../../models/utils/occupations/exercise-occupation';
import type { SimulationEvent } from './simulation-event';

export class TransferVehiclesCommandEvent implements SimulationEvent {
    @IsValue('transferVehiclesCommandEvent')
    readonly type = 'transferVehiclesCommandEvent';

    @IsUUID(4, uuidValidationOptions)
    readonly simulatedRegion: UUID;

    @IsResourceDescription()
    readonly requestedVehicles: ResourceDescription;

    @IsUUID(4, uuidValidationOptions)
    readonly transferDestinationId: UUID;

    @IsOptional()
    @Type(...occupationTypeOptions)
    readonly successorOccupation?: ExerciseOccupation;

    /**
     * @deprecated Use {@link create} instead
     */
    constructor(
        simulatedRegion: UUID,
        requestedVehicles: ResourceDescription,
        transferDestinationId: UUID,
        successorOccupation?: ExerciseOccupation
    ) {
        this.simulatedRegion = simulatedRegion;
        this.requestedVehicles = requestedVehicles;
        this.transferDestinationId = transferDestinationId;
        this.successorOccupation = successorOccupation;
    }

    static readonly create = getCreate(this);
}
