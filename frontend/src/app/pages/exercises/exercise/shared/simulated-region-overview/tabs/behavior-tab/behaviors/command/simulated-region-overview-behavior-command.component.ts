import type { OnChanges } from '@angular/core';
import { Component, Input } from '@angular/core';
import { Store } from '@ngrx/store';
import { UUID } from 'digital-fuesim-manv-shared';
import type {
    CommandBehaviorState,
    SimulatedRegion,
} from 'digital-fuesim-manv-shared';
import type { Observable } from 'rxjs';
import { combineLatest, map } from 'rxjs';
import { ExerciseService } from 'src/app/core/exercise.service';
import type { AppState } from 'src/app/state/app.state';
import {
    createSelectBehaviorState,
    selectSimulatedRegions,
} from 'src/app/state/application/selectors/exercise.selectors';

@Component({
    selector: 'app-simulated-region-overview-behavior-command',
    templateUrl: './simulated-region-overview-behavior-command.component.html',
    styleUrls: ['./simulated-region-overview-behavior-command.component.scss'],
})
export class SimulatedRegionOverviewBehaviorCommandComponent
    implements OnChanges
{
    @Input()
    simulatedRegionId!: UUID;

    @Input()
    commandBehaviorId!: UUID;

    commandBehaviorState$!: Observable<CommandBehaviorState>;

    public managedSimulatedStagingAreas$!: Observable<SimulatedRegion[]>;
    public managedSimulatedPatientTrays$!: Observable<SimulatedRegion[]>;
    public possibleNewSimulatedRegionsToAssign$!: Observable<SimulatedRegion[]>;

    constructor(
        private readonly exerciseService: ExerciseService,
        public readonly store: Store<AppState>
    ) {}

    ngOnChanges(): void {
        this.commandBehaviorState$ = this.store.select(
            createSelectBehaviorState<CommandBehaviorState>(
                this.simulatedRegionId,
                this.commandBehaviorId
            )
        );

        const simulatedRegions$ = this.store.select(selectSimulatedRegions);

        this.managedSimulatedPatientTrays$ = combineLatest([
            this.commandBehaviorState$,
            simulatedRegions$,
        ]).pipe(
            map(([behaviorState, simulatedRegions]) =>
                Object.keys(behaviorState.patientTrays).map(
                    (patientTrayId) => simulatedRegions[patientTrayId]!
                )
            )
        );

        this.managedSimulatedStagingAreas$ = combineLatest([
            this.commandBehaviorState$,
            simulatedRegions$,
        ]).pipe(
            map(([behaviorState, simulatedRegions]) =>
                Object.keys(behaviorState.stagingAreas).map(
                    (stagingAreaId) => simulatedRegions[stagingAreaId]!
                )
            )
        );

        this.possibleNewSimulatedRegionsToAssign$ = combineLatest([
            this.commandBehaviorState$,
            simulatedRegions$,
        ]).pipe(
            map(([behaviorState, simulatedRegions]) =>
                Object.values(simulatedRegions).filter(
                    (simulatedRegion) =>
                        !behaviorState.patientTrays[simulatedRegion.id] &&
                        !behaviorState.stagingAreas[simulatedRegion.id] &&
                        this.simulatedRegionId !== simulatedRegion.id
                )
            )
        );
    }

    public addPatientTray(patientTrayId: UUID) {
        this.exerciseService.proposeAction({
            type: '[CommandBehavior] Add Patient Tray',
            simulatedRegionId: this.simulatedRegionId,
            behaviorId: this.commandBehaviorId,
            patientTrayId,
        });
    }

    public addStagingArea(stagingAreaId: UUID) {
        this.exerciseService.proposeAction({
            type: '[CommandBehavior] Add Staging Area',
            simulatedRegionId: this.simulatedRegionId,
            behaviorId: this.commandBehaviorId,
            stagingAreaId,
        });
    }

    public removePatientTray(patientTrayId: UUID) {
        this.exerciseService.proposeAction({
            type: '[CommandBehavior] Remove Patient Tray',
            simulatedRegionId: this.simulatedRegionId,
            behaviorId: this.commandBehaviorId,
            patientTrayId,
        });
    }

    public removeStagingArea(stagingAreaId: UUID) {
        this.exerciseService.proposeAction({
            type: '[CommandBehavior] Remove Staging Area',
            simulatedRegionId: this.simulatedRegionId,
            behaviorId: this.commandBehaviorId,
            stagingAreaId,
        });
    }
}
