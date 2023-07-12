import type { SimulatedRegion } from '../../models';
import type { Mutable } from '../../utils';
import { cloneDeepMutable } from '../../utils';
import type { ExerciseSimulationEvent } from './exercise-simulation-event';
const DEBUG = false;
export function sendSimulationEvent(
    simulatedRegion: Mutable<SimulatedRegion>,
    event: ExerciseSimulationEvent
) {
    simulatedRegion.inEvents.push(cloneDeepMutable(event));
    if (DEBUG && event.type !== 'tickEvent') {
        console.log(
            `[EVENT] ${simulatedRegion.name}: ${JSON.stringify(event)}`
        );
    }
}
