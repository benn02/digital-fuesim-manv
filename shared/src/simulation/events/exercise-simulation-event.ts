import type { Type } from 'class-transformer';
import type { Constructor } from '../../utils';
import { SimulationEvent } from './simulation-event';
import { MaterialAvailableEvent } from './material-available';
import { NewPatientEvent } from './new-patient';
import { PersonnelAvailableEvent } from './personnel-available';
import { TickEvent } from './tick';
import { VehicleArrivedEvent } from './vehicle-arrived';
import { TreatmentsTimerEvent } from './treatments-timer-event';
import { TreatmentProgressChangedEvent } from './treatment-progress-changed';
import { CollectInformationEvent } from './collect';
import { StartCollectingInformationEvent } from './start-collecting';
import { ResourceRequiredEvent } from './resources-required';
import { VehiclesSentEvent } from './vehicles-sent';
import { TryToDistributeEvent } from './try-to-distribute';
import { VehicleTransferSuccessfulEvent } from './vehicle-transfer-successful';
import { TransferConnectionMissingEvent } from './transfer-connection-missing';
import { SendRequestEvent } from './send-request';
import { LeaderChangedEvent } from './leader-changed';
import { MaterialRemovedEvent } from './material-removed';
import { PersonnelRemovedEvent } from './personnel-removed';
import { PatientRemovedEvent } from './patient-removed';
import { VehicleRemovedEvent } from './vehicle-removed';
import { TransferPatientsInSpecificVehicleRequestEvent } from './transfer-patients-in-specific-vehicle-request';
import { TransferSpecificVehicleRequestEvent } from './transfer-specific-vehicle-request';
import { TransferVehiclesRequestEvent } from './transfer-vehicles-request';
import { TransferPatientsRequestEvent } from './transfer-patients-request';
import { RequestReceivedEvent } from './request-received';
import { StartTransferEvent } from './start-transfer';
import { DoTransferEvent } from './do-transfer';
import { PatientTransferToHospitalSuccessfulEvent } from './patient-transfer-to-hospital-successful';
import { PatientCategoryTransferToHospitalFinishedEvent } from './patient-category-transfer-to-hospital-finished';
import { TryToSendToHospitalEvent } from './try-to-send-to-hospital';
import { AskForPatientDataEvent } from './ask-for-patient-data-event';
import { PatientsCountedEvent } from './patients-counted';
import { PatientDataRequestedCommandEvent } from './patient-data-requested-command';
import { PatientDataReceivedEvent } from './patient-data-received';
import { VehicleDataRequestedCommandEvent } from './vehicle-data-requested-command';
import { VehicleDataReceivedEvent } from './vehicle-data-received';
import { TreatmentProgressDataReceivedEvent } from './treatment-progress-data-received';
import { SendAlarmGroupCommandEvent } from './send-alarm-group-command';
import { TransferConnectionMissingDataReceivedEvent } from './transfer-connection-missing-data-received';
import { ResourceRequestDataReceivedEvent } from './resource-request-data-received';
import { StartTransferToHospitalCommandEvent } from './start-transfer-to-hospital-command';
import { TransferVehiclesCommandEvent } from './transfer-vehicle-command';

export const simulationEvents = {
    MaterialAvailableEvent,
    NewPatientEvent,
    PersonnelAvailableEvent,
    TickEvent,
    TreatmentProgressChangedEvent,
    TreatmentsTimerEvent,
    VehicleArrivedEvent,
    CollectInformationEvent,
    StartCollectingInformationEvent,
    ResourceRequiredEvent,
    VehiclesSentEvent,
    TryToDistributeEvent,
    VehicleTransferSuccessfulEvent,
    TransferConnectionMissingEvent,
    SendRequestEvent,
    LeaderChangedEvent,
    MaterialRemovedEvent,
    PersonnelRemovedEvent,
    PatientRemovedEvent,
    VehicleRemovedEvent,
    TransferPatientsInSpecificVehicleRequestEvent,
    TransferSpecificVehicleRequestEvent,
    TransferVehiclesRequestEvent,
    TransferPatientsRequestEvent,
    RequestReceivedEvent,
    StartTransferEvent,
    DoTransferEvent,
    PatientCategoryTransferToHospitalFinishedEvent,
    PatientTransferToHospitalSuccessfulEvent,
    TryToSendToHospitalEvent,
    AskForPatientDataEvent,
    PatientsCountedEvent,
    PatientDataReceivedEvent,
    PatientDataRequestedCommandEvent,
    VehicleDataRequestedCommandEvent,
    VehicleDataReceivedEvent,
    TreatmentProgressDataReceivedEvent,
    SendAlarmGroupCommandEvent,
    TransferConnectionMissingDataReceivedEvent,
    ResourceRequestDataReceivedEvent,
    StartTransferToHospitalCommandEvent,
    TransferVehiclesCommandEvent,
};

export type ExerciseSimulationEvent = InstanceType<
    (typeof simulationEvents)[keyof typeof simulationEvents]
>;

type ExerciseSimulationEventDictionary = {
    [EventType in ExerciseSimulationEvent as EventType['type']]: Constructor<EventType>;
};

// TODO: compute dynamically
export const simulationEventDictionary: ExerciseSimulationEventDictionary = {
    materialAvailableEvent: MaterialAvailableEvent,
    newPatientEvent: NewPatientEvent,
    personnelAvailableEvent: PersonnelAvailableEvent,
    tickEvent: TickEvent,
    treatmentProgressChangedEvent: TreatmentProgressChangedEvent,
    treatmentsTimerEvent: TreatmentsTimerEvent,
    vehicleArrivedEvent: VehicleArrivedEvent,
    collectInformationEvent: CollectInformationEvent,
    startCollectingInformationEvent: StartCollectingInformationEvent,
    resourceRequiredEvent: ResourceRequiredEvent,
    vehiclesSentEvent: VehiclesSentEvent,
    tryToDistributeEvent: TryToDistributeEvent,
    vehicleTransferSuccessfulEvent: VehicleTransferSuccessfulEvent,
    transferConnectionMissingEvent: TransferConnectionMissingEvent,
    sendRequestEvent: SendRequestEvent,
    leaderChangedEvent: LeaderChangedEvent,
    materialRemovedEvent: MaterialRemovedEvent,
    personnelRemovedEvent: PersonnelRemovedEvent,
    patientRemovedEvent: PatientRemovedEvent,
    vehicleRemovedEvent: VehicleRemovedEvent,
    transferPatientsInSpecificVehicleRequestEvent:
        TransferPatientsInSpecificVehicleRequestEvent,
    transferSpecificVehicleRequestEvent: TransferSpecificVehicleRequestEvent,
    transferVehiclesRequestEvent: TransferVehiclesRequestEvent,
    transferPatientsRequestEvent: TransferPatientsRequestEvent,
    requestReceivedEvent: RequestReceivedEvent,
    startTransferEvent: StartTransferEvent,
    doTransferEvent: DoTransferEvent,
    patientCategoryTransferToHospitalFinishedEvent:
        PatientCategoryTransferToHospitalFinishedEvent,
    patientTransferToHospitalSuccessfulEvent:
        PatientTransferToHospitalSuccessfulEvent,
    tryToSendToHospitalEvent: TryToSendToHospitalEvent,
    askForPatientDataEvent: AskForPatientDataEvent,
    patientsCountedEvent: PatientsCountedEvent,
    patientDataReceivedEvent: PatientDataReceivedEvent,
    patientDataRequestedCommandEvent: PatientDataRequestedCommandEvent,
    vehicleDataRequestedCommandEvent: VehicleDataRequestedCommandEvent,
    vehicleDataReceivedEvent: VehicleDataReceivedEvent,
    treatmentProgressDataReceivedEvent: TreatmentProgressDataReceivedEvent,
    sendAlarmGroupCommandEvent: SendAlarmGroupCommandEvent,
    transferConnectionMissingDataReceivedEvent:
        TransferConnectionMissingDataReceivedEvent,
    resourceRequestDataReceivedEvent: ResourceRequestDataReceivedEvent,
    startTransferToHospitalCommandEvent: StartTransferToHospitalCommandEvent,
    transferVehiclesCommandEvent: TransferVehiclesCommandEvent,
};

export const simulationEventTypeOptions: Parameters<typeof Type> = [
    () => SimulationEvent,
    {
        keepDiscriminatorProperty: true,
        discriminator: {
            property: 'type',
            subTypes: Object.entries(simulationEventDictionary).map(
                ([name, value]) => ({ name, value })
            ),
        },
    },
];
