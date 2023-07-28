import type { PatientStatus } from '../../../models/utils/patient-status';
import type { PersonnelType } from '../../../models/utils/personnel-type';
import type { ResourceDescription } from '../../../models/utils/resource-description';
import type { UUID } from '../../../utils/uuid';

export const COLLECT_PATIENT_DATA_INTERVAL = 5 * 60 * 1000;
export const COLLECT_VEHICLE_DATA_INTERVAL = 5 * 1 * 1000;
export const COLLECT_VEHICLE_DATA_INTERVAL_PT = 5 * 60 * 1000;

export type stage =
    | 'contactInitiation'
    | 'countingPatients'
    | 'securingPatients'
    | 'transportingPatients';

export interface PatientsPerRegion {
    [simulatedRegionId: UUID]: ResourceDescription<PatientStatus>;
}

export interface VehiclesPerRegion {
    [simulatedRegionId: UUID]: ResourceDescription;
}

export const emptyPatientResourceDescription = {
    red: 0,
    green: 0,
    black: 0,
    blue: 0,
    white: 0,
    yellow: 0,
};

export const assumedPatientPersonnelNeeds: {
    [patientStatus in PatientStatus]: ResourceDescription<PersonnelType>;
} = {
    black: {
        gf: 0,
        notarzt: 0,
        notSan: 0,
        rettSan: 0,
        san: 0,
    },
    blue: {
        gf: 0,
        notarzt: 0,
        notSan: 0,
        rettSan: 0,
        san: 1,
    },
    green: {
        gf: 0,
        notarzt: 0,
        notSan: 0,
        rettSan: 0,
        san: 0.5,
    },
    red: {
        gf: 0,
        notarzt: 0.5,
        notSan: 1,
        rettSan: 1,
        san: 0,
    },
    white: {
        gf: 0,
        notarzt: 0,
        notSan: 0,
        rettSan: 0,
        san: 0,
    },
    yellow: {
        gf: 0,
        notarzt: 0.25,
        notSan: 0,
        rettSan: 1,
        san: 0,
    },
};

export const personnelInVehicles: {
    [vehicleType: string]: ResourceDescription<PersonnelType>;
} = {
    RTW: {
        gf: 0,
        notarzt: 0,
        notSan: 1,
        rettSan: 1,
        san: 0,
    },
    KTW: {
        gf: 0,
        notarzt: 0,
        notSan: 0,
        rettSan: 1,
        san: 1,
    },
    'KTW (KatSchutz)': {
        gf: 0,
        notarzt: 0,
        notSan: 0,
        rettSan: 1,
        san: 1,
    },
    NEF: {
        gf: 0,
        notarzt: 1,
        notSan: 1,
        rettSan: 0,
        san: 0,
    },
    'GW-San': {
        gf: 1,
        notarzt: 1,
        notSan: 0,
        rettSan: 2,
        san: 2,
    },
    RTH: {
        gf: 0,
        notarzt: 1,
        notSan: 1,
        rettSan: 0,
        san: 0,
    },
};
export const transportablePatients: {
    [vehicleType: string]: ResourceDescription<PatientStatus>;
} = {
    RTW: {
        black: 0,
        blue: 0,
        green: 2,
        red: 2,
        white: 0,
        yellow: 2,
    },
    KTW: {
        black: 0,
        blue: 0,
        green: 2,
        red: 2,
        white: 0,
        yellow: 2,
    },
    'KTW (KatSchutz)': {
        black: 0,
        blue: 0,
        green: 2,
        red: 0,
        white: 0,
        yellow: 1,
    },
    NEF: {
        black: 0,
        blue: 0,
        green: 0,
        red: 0,
        white: 0,
        yellow: 0,
    },
    'GW-San': {
        black: 0,
        blue: 0,
        green: 0,
        red: 0,
        white: 0,
        yellow: 0,
    },
    RTH: {
        black: 0,
        blue: 0,
        green: 1,
        red: 1,
        white: 0,
        yellow: 1,
    },
};
