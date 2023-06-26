import { IsBoolean, IsUUID } from 'class-validator';
import { getCreate } from '../../models/utils/get-create';
import { IsValue } from '../../utils/validators';
import { UUID, uuidValidationOptions } from '../../utils';
import { IsResourceDescription } from '../../utils/validators/is-resource-description';
import { ResourceDescription } from '../../models/utils/resource-description';
import type { PatientStatus } from '../../models';
import type { SimulationEvent } from './simulation-event';

export class PatientDataReceivedEvent implements SimulationEvent {
    @IsValue('patientDataReceivedEvent')
    readonly type = 'patientDataReceivedEvent';

    @IsUUID(4, uuidValidationOptions)
    readonly simulatedRegion: UUID;

    @IsResourceDescription()
    readonly patientsInRegion: ResourceDescription<PatientStatus>;

    @IsBoolean()
    readonly informationAvailable: boolean;

    /**
     * @deprecated Use {@link create} instead
     */
    constructor(
        simulatedRegion: UUID,
        patientsInRegion: ResourceDescription<PatientStatus>,
        informationAvailable: boolean
    ) {
        this.simulatedRegion = simulatedRegion;
        this.patientsInRegion = patientsInRegion;
        this.informationAvailable = informationAvailable;
    }

    static readonly create = getCreate(this);
}
