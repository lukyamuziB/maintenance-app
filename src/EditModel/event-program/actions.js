const createActionCreator = (type) => (payload) => ({ type, payload });

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Stepper
export const STEP_CHANGE = 'STEP_CHANGE';
export const STEP_NEXT = 'STEP_NEXT';
export const STEP_PREVIOUS = 'STEP_PREVIOUS';

export const changeStep = (stepKey) => ({ type: STEP_CHANGE, payload: stepKey });
export const nextStep = () => ({ type: STEP_NEXT });
export const previousStep = () => ({ type: STEP_PREVIOUS });

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Model
export const MODEL_TO_EDIT_LOADED = 'MODEL_TO_EDIT_LOADED';
export const MODEL_TO_EDIT_FIELD_CHANGED = 'MODEL_TO_EDIT_FIELD_CHANGED';

export const editFieldChanged = (field, value) => ({ type: MODEL_TO_EDIT_FIELD_CHANGED, payload: { field, value } });

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Event program
export const EVENT_PROGRAM_LOAD = 'EVENT_PROGRAM_LOAD';
export const EVENT_PROGRAM_LOAD_SUCCESS = 'EVENT_PROGRAM_LOAD_SUCCESS';
export const EVENT_PROGRAM_LOAD_ERROR = 'EVENT_PROGRAM_LOAD_ERROR';

export const loadEventProgram = createActionCreator(EVENT_PROGRAM_LOAD);
export const loadEventProgramSuccess = createActionCreator(EVENT_PROGRAM_LOAD_SUCCESS);
export const loadEventProgramFailure = createActionCreator(EVENT_PROGRAM_LOAD_ERROR);

export const EVENT_PROGRAM_SAVE = 'EVENT_PROGRAM_SAVE';
export const EVENT_PROGRAM_SAVE_SUCCESS = 'EVENT_PROGRAM_SAVE_SUCCESS';
export const EVENT_PROGRAM_SAVE_ERROR = 'EVENT_PROGRAM_SAVE_ERROR'

export const saveEventProgram = createActionCreator(EVENT_PROGRAM_SAVE);
export const saveEventProgramSuccess = createActionCreator(EVENT_PROGRAM_SAVE_SUCCESS);
export const saveEventProgramError = createActionCreator(EVENT_PROGRAM_SAVE_ERROR);

export const NOTIFY_USER = 'NOTIFY_USER';
export const notifyUser = createActionCreator(NOTIFY_USER);