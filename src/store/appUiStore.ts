import { create } from 'zustand';

export type AppModalId =
  | 'newTemplate'
  | 'rules'
  | 'audit'
  | 'fonts'
  | 'mappingDictionary'
  | 'shortcuts'
  | 'preferences'
  | 'mcpDraftReview';

type ModalState = Record<AppModalId, boolean>;

interface AppUiState {
  modals: ModalState;
  setModalOpen: (modal: AppModalId, isOpen: boolean) => void;
  closeAllModals: () => void;
}

const CLOSED_MODALS: ModalState = {
  newTemplate: false,
  rules: false,
  audit: false,
  fonts: false,
  mappingDictionary: false,
  shortcuts: false,
  preferences: false,
  mcpDraftReview: false,
};

export const useAppUiStore = create<AppUiState>((set) => ({
  modals: CLOSED_MODALS,
  setModalOpen: (modal, isOpen) => set((state) => ({
    modals: { ...state.modals, [modal]: isOpen },
  })),
  closeAllModals: () => set({ modals: CLOSED_MODALS }),
}));