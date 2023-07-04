import { getCreate } from '../../models/utils/get-create';
import { IsValue } from '../../utils/validators';
import type { SimulationEvent } from './simulation-event';

export class DebugEvent implements SimulationEvent {
    @IsValue('debugEvent')
    readonly type = 'debugEvent';

    static readonly create = getCreate(this);
}
