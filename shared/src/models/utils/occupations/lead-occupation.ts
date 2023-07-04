import { IsValue } from '../../../utils/validators';
import { getCreate } from '../get-create';
import type { Occupation } from './occupation';

export class LeadOccupation implements Occupation {
    @IsValue('leadOccupation')
    readonly type = 'leadOccupation';

    static readonly create = getCreate(this);
}
