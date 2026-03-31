import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  PosterState, StepId, DishInfo, CopySet, PosterElement,
} from '@/lib/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, IS_MOCK_MODE } from '@/lib/constants';

export type PosterStyleId =
  | 'modern-minimalist'
  | 'rustic-farmhouse'
  | 'elegant-fine-dining'
  | 'bright-cafe'
  | 'vintage-chalkboard'
  | 'bold-pop';

interface PosterStore extends PosterState {
  setStep: (step: StepId) => void;
  nextStep: () => void;
  prevStep: () => void;

  setOriginalImage: (image: string, file: File) => void;
  clearOriginalImage: () => void;

  setDishInfo: (info: DishInfo) => void;
  setIsRecognizing: (v: boolean) => void;

  // Phase 9: 风格选择 + AI 全景生图
  selectedPosterStyle: PosterStyleId | null;
  setSelectedPosterStyle: (style: PosterStyleId) => void;
  generatedPosterImage: string | null;   // AI 生成的完整海报底图 base64
  setGeneratedPosterImage: (img: string | null) => void;
  isGeneratingPoster: boolean;
  setIsGeneratingPoster: (v: boolean) => void;

  setGeneratedCopySets: (sets: CopySet[]) => void;
  setSelectedCopy: (copy: CopySet) => void;
  setIsGeneratingCopy: (v: boolean) => void;

  setPosterElements: (elements: PosterElement[]) => void;
  updateElement: (id: string, updates: Partial<PosterElement>) => void;
  setPosterPreviewUrl: (url: string | null) => void;

  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: Omit<PosterState, 'originalImageFile'> & { originalImageFile: null } & {
  selectedPosterStyle: PosterStyleId | null;
  generatedPosterImage: string | null;
  isGeneratingPoster: boolean;
} = {
  currentStep: 1,
  originalImage: null,
  originalImageFile: null,
  dishInfo: null,
  isRecognizing: false,
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
  posterPreviewUrl: null,
  isMockMode: IS_MOCK_MODE,
  error: null,
  // Phase 9
  selectedPosterStyle: null,
  generatedPosterImage: null,
  isGeneratingPoster: false,
};

export const usePosterStore = create<PosterStore>()(
  persist(
    (set) => ({
      ...initialState,

      setStep: (step) => set({ currentStep: step }),
      nextStep: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 5) as StepId })),
      prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 1) as StepId })),

      setOriginalImage: (image, file) => set({ originalImage: image, originalImageFile: file }),
      clearOriginalImage: () => set({ originalImage: null, originalImageFile: null }),

      setDishInfo: (info) => set({ dishInfo: info }),
      setIsRecognizing: (v) => set({ isRecognizing: v }),

      setSelectedPosterStyle: (style) => set({ selectedPosterStyle: style }),
      setGeneratedPosterImage: (img) => set({ generatedPosterImage: img }),
      setIsGeneratingPoster: (v) => set({ isGeneratingPoster: v }),

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
      setPosterPreviewUrl: (url) => set({ posterPreviewUrl: url }),

      setError: (error) => set({ error }),
      reset: () => set(initialState),
    }),
    {
      name: 'posterchef-store',
      partialize: (state) => ({
        currentStep:          state.currentStep,
        originalImage:        state.originalImage,
        dishInfo:             state.dishInfo,
        selectedPosterStyle:  state.selectedPosterStyle,
        generatedPosterImage: state.generatedPosterImage,
        generatedCopySets:    state.generatedCopySets,
        selectedCopy:         state.selectedCopy,
        posterElements:       state.posterElements,
        canvasWidth:          state.canvasWidth,
        canvasHeight:         state.canvasHeight,
        posterPreviewUrl:     state.posterPreviewUrl,
      }),
    }
  )
);
