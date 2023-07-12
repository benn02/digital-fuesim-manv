import type { OnChanges } from '@angular/core';
import { Component, Input } from '@angular/core';
import { Store } from '@ngrx/store';
import type {
    AlarmGroup,
    InterfaceSignallerBehaviorState,
} from 'digital-fuesim-manv-shared';
import { UUID } from 'digital-fuesim-manv-shared';
import type { Observable } from 'rxjs';
import { combineLatest, map } from 'rxjs';
import { ExerciseService } from 'src/app/core/exercise.service';
import type { AppState } from 'src/app/state/app.state';
import {
    createSelectBehaviorState,
    selectAlarmGroups,
} from 'src/app/state/application/selectors/exercise.selectors';

@Component({
    selector: 'app-simulated-region-overview-behavior-interface-signaller',
    templateUrl:
        './simulated-region-overview-behavior-interface-signaller.component.html',
    styleUrls: [
        './simulated-region-overview-behavior-interface-signaller.component.scss',
    ],
})
export class SimulatedRegionOverviewBehaviorInterfaceSignallerComponent
    implements OnChanges
{
    @Input()
    simulatedRegionId!: UUID;

    @Input()
    behaviorId!: UUID;

    behaviorState$!: Observable<InterfaceSignallerBehaviorState>;

    public knownAlarmGroups$!: Observable<[AlarmGroup, number][]>;
    public possibleNewAlarmGroups$!: Observable<AlarmGroup[]>;

    constructor(
        private readonly exerciseService: ExerciseService,
        public readonly store: Store<AppState>
    ) {}

    ngOnChanges(): void {
        this.behaviorState$ = this.store.select(
            createSelectBehaviorState<InterfaceSignallerBehaviorState>(
                this.simulatedRegionId,
                this.behaviorId
            )
        );

        const alarmGroups$ = this.store.select(selectAlarmGroups);

        this.knownAlarmGroups$ = combineLatest([
            this.behaviorState$,
            alarmGroups$,
        ]).pipe(
            map(([behaviorState, alarmGroups]) =>
                Object.keys(behaviorState.knownAlarmGroups).map(
                    (alarmGroupId) =>
                        [
                            alarmGroups[alarmGroupId]!,
                            behaviorState.knownAlarmGroups[alarmGroupId]!,
                        ]!
                )
            )
        );

        this.possibleNewAlarmGroups$ = combineLatest([
            this.behaviorState$,
            alarmGroups$,
        ]).pipe(
            map(([behaviorState, alarmGroups]) =>
                Object.values(alarmGroups).filter(
                    (alarmGroup) =>
                        !behaviorState.knownAlarmGroups[alarmGroup.id]
                )
            )
        );
    }

    public addAlarmGroup(alarmGroupId: UUID) {
        this.exerciseService.proposeAction({
            type: '[InterfaceSignallerBehavior] Add Alarm Group',
            simulatedRegionId: this.simulatedRegionId,
            behaviorId: this.behaviorId,
            alarmGroupId,
        });
    }

    public removeAlarmGroup(alarmGroupId: UUID) {
        this.exerciseService.proposeAction({
            type: '[InterfaceSignallerBehavior] Remove Alarm Group',
            simulatedRegionId: this.simulatedRegionId,
            behaviorId: this.behaviorId,
            alarmGroupId,
        });
    }

    public changeAlarmGroup(alarmGroupId: UUID, newThreshold: number) {
        this.exerciseService.proposeAction({
            type: '[InterfaceSignallerBehavior] Change Alarm Group Threshold',
            simulatedRegionId: this.simulatedRegionId,
            behaviorId: this.behaviorId,
            alarmGroupId,
            newThreshold,
        });
    }
}
