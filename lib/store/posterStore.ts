import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  PosterState, StepId, DishInfo, StyleId,
  BackgroundOption, CopySet, PosterElement,
} from '@/lib/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, IS_MOCK_MODE } from '@/lib/constants';

interface PosterStore extends PosterState {
  setStep: (step: StepId) => void;
  nextStep: () => void;
  prevStep: () => void;

  setOriginalImage: (image: string, file: File) => void;
  clearOriginalImage: () => void;

  setDishInfo: (info: DishInfo) => void;
  setIsRecognizing: (v: boolean) => void;

  // Phase 3
  setRemovedBgImage: (image: string) => void;
  setEnhancedImage: (image: string) => void;
  setProcessedImage: (image: string) => void;
  setIsProcessing: (v: boolean) => void;
  setRemoveBgProgress: (v: number) => void;
  setEnhanceProgress: (v: number | ((prev: number) => number)) => void;
  setUseRemovedBg: (v: boolean) => void;

  setSelectedStyle: (style: StyleId) => void;
  setGeneratedBackgrounds: (bgs: BackgroundOption[]) => void;
  setSelectedBackground: (bg: BackgroundOption) => void;
  setIsGeneratingBackground: (v: boolean) => void;

  setGeneratedCopySets: (sets: CopySet[]) => void;
  setSelectedCopy: (copy: CopySet) => void;
  setIsGeneratingCopy: (v: boolean) => void;

  setPosterElements: (elements: PosterElement[]) => void;
  updateElement: (id: string, updates: Partial<PosterElement>) => void;

  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: Omit<PosterState, 'originalImageFile'> & { originalImageFile: null } = {
  currentStep: 1,
  originalImage: null,
  originalImageFile: null,
  dishInfo: null,
  isRecognizing: false,
  removedBgImage: null,
  enhancedImage: null,
  processedImage: null,
  isProcessing: false,
  removeBgProgress: 0,
  enhanceProgress: 0,
  useRemovedBg: true,
  selectedStyle: null,
  generatedBackgrounds: [],
  selectedBackground: null,
  isGeneratingBackground: false,
  generatedCopySets: [],
  selectedCopy: null,
  isGeneratingCopy: false,
  posterElements: [],
  canvasWidth: CANVAS_WIDTH,
  canvasHeight: CANVAS_HEIGHT,
  isMockMode: IS_MOCK_MODE,
  error: null,
};

export const usePosterStore = create<PosterStore>()(
  persist(
    (set) => ({
      ...initialState,

      setStep: (step) => set({ currentStep: step }),
      nextStep: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 7) as StepId })),
      prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 1) as StepId })),

      setOriginalImage: (image, file) => set({ originalImage: image, originalImageFile: file }),
      clearOriginalImage: () => set({ originalImage: null, originalImageFile: null }),

      setDishInfo: (info) => set({ dishInfo: info }),
      setIsRecognizing: (v) => set({ isRecognizing: v }),

      setRemovedBgImage: (image) => set({ removedBgImage: image }),
      setEnhancedImage: (image) => set({ enhancedImage: image }),
      setProcessedImage: (image) => set({ processedImage: image }),
      setIsProcessing: (v) => set({ isProcessing: v }),
      setRemoveBgProgress: (v) => set({ removeBgProgress: v }),
      setEnhanceProgress: (v) =>
        set((s) => ({ enhanceProgress: typeof v === 'function' ? v(s.enhanceProgress) : v })),
      setUseRemovedBg: (v) => set({ useRemovedBg: v }),

      setSelectedStyle: (style) => set({ selectedStyle: style }),
      setGeneratedBackgrounds: (bgs) => set({ generatedBackgrounds: bgs }),
      setSelectedBackground: (bg) => set({ selectedBackground: bg }),
      setIsGeneratingBackground: (v) => set({ isGeneratingBackground: v }),

      setGeneratedCopySets: (sets) => set({ generatedCopySets: sets }),
      setSelectedCopy: (copy) => set({ selectedCopy: copy }),
      setIsGeneratingCopy: (v) => set({ isGeneratingCopy: v }),

      setPosterElements: (elements) => set({ posterElements: elements }),
      updateElement: (id, updates) =>
        set((s) => ({
          posterElements: s.posterElements.map((el) =>
            el.id === id ? { ...el, ...updates } : el
          ),
        })),

      setError: (error) => set({ error }),
      reset: () => set(initialState),
    }),
    {
      name: 'posterchef-store',
      partialize: (state) => ({
        currentStep:          state.currentStep,
        originalImage:        state.originalImage,
        dishInfo:             state.dishInfo,
        removedBgImage:       state.removedBgImage,
        enhancedImage:        state.enhancedImage,
        processedImage:       state.processedImage,
        useRemovedBg:         state.useRemovedBg,
        selectedStyle:        state.selectedStyle,
        generatedBackgrounds: state.generatedBackgrounds,
        selectedBackground:   state.selectedBackground,
        generatedCopySets:    state.generatedCopySets,
        selectedCopy:         state.selectedCopy,
        posterElements:       state.posterElements,
        canvasWidth:          state.canvasWidth,
        canvasHeight:         state.canvasHeight,
      }),
    }
  )
);
