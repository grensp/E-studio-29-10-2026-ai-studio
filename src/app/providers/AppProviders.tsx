import React from 'react';
import { LocalizationProvider } from '../../context/LocalizationContext';

export interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return <LocalizationProvider>{children}</LocalizationProvider>;
};
