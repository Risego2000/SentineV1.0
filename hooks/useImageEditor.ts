import { useReducer, useCallback } from 'react';

export interface ImageEditorState {
  zoom: number;
  brightness: number;
  contrast: number;
  saturate: number;
  sharpness: number;
  selectedImage: string | null;
}

export type ImageEditorAction =
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_BRIGHTNESS'; payload: number }
  | { type: 'SET_CONTRAST'; payload: number }
  | { type: 'SET_SATURATE'; payload: number }
  | { type: 'SET_SHARPNESS'; payload: number }
  | { type: 'SET_SELECTED_IMAGE'; payload: string | null }
  | { type: 'RESET' };

const initialState: ImageEditorState = {
  zoom: 1,
  brightness: 1,
  contrast: 1,
  saturate: 1,
  sharpness: 0,
  selectedImage: null,
};

const reducer = (state: ImageEditorState, action: ImageEditorAction): ImageEditorState => {
  switch (action.type) {
    case 'SET_ZOOM':
      return { ...state, zoom: action.payload };
    case 'SET_BRIGHTNESS':
      return { ...state, brightness: action.payload };
    case 'SET_CONTRAST':
      return { ...state, contrast: action.payload };
    case 'SET_SATURATE':
      return { ...state, saturate: action.payload };
    case 'SET_SHARPNESS':
      return { ...state, sharpness: action.payload };
    case 'SET_SELECTED_IMAGE':
      return { ...state, selectedImage: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
};

export const useImageEditor = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setZoom = useCallback((zoom: number) => dispatch({ type: 'SET_ZOOM', payload: zoom }), []);
  const setBrightness = useCallback((brightness: number) => dispatch({ type: 'SET_BRIGHTNESS', payload: brightness }), []);
  const setContrast = useCallback((contrast: number) => dispatch({ type: 'SET_CONTRAST', payload: contrast }), []);
  const setSaturate = useCallback((saturate: number) => dispatch({ type: 'SET_SATURATE', payload: saturate }), []);
  const setSharpness = useCallback((sharpness: number) => dispatch({ type: 'SET_SHARPNESS', payload: sharpness }), []);
  const setSelectedImage = useCallback((image: string | null) => dispatch({ type: 'SET_SELECTED_IMAGE', payload: image }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return {
    state,
    setZoom,
    setBrightness,
    setContrast,
    setSaturate,
    setSharpness,
    setSelectedImage,
    reset,
  };
};
